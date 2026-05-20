import { executeQuery } from "../db/mssqlHelper.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import NotificationService from "../services/notification.service.js";
import { SkillMatrixConfig } from "../models/skillMatrixConfig.model.js";
import { SkillMatrixEvaluation } from "../models/skillMatrixEvaluation.model.js";
import SkillMatrixDashboardConfig from "../models/skillMatrixDashboardConfig.model.js";

// Helper to safely parse JSON
const parseJSON = (data, fallback = null) => {
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch (e) { return fallback; }
    }
    return data || fallback;
};

// Runtime migration guard for existing DBs that don't yet have month-based skill matrix schema.
const ensureSkillMatrixMonthSchema = async () => {
    // Add missing hierarchy columns if they don't exist
    await executeQuery(`
        IF COL_LENGTH('skill_matrices', 'month') IS NULL
        BEGIN
            ALTER TABLE skill_matrices ADD month VARCHAR(7);
            UPDATE skill_matrices SET month = FORMAT(createdAt, 'yyyy-MM') WHERE month IS NULL;
        END

        IF COL_LENGTH('skill_matrices', 'section') IS NULL
            ALTER TABLE skill_matrices ADD section VARCHAR(255);

        IF COL_LENGTH('skill_matrices', 'subSection') IS NULL
            ALTER TABLE skill_matrices ADD subSection VARCHAR(255);

        IF COL_LENGTH('skill_matrices', 'station') IS NULL
            ALTER TABLE skill_matrices ADD station VARCHAR(255);
    `);

    // Drop old narrow constraint if present
    await executeQuery(`
        IF EXISTS (SELECT 1 FROM sys.objects WHERE type = 'UQ' AND name = 'uq_skill_matrix_dept_line_month')
        BEGIN
            ALTER TABLE skill_matrices DROP CONSTRAINT uq_skill_matrix_dept_line_month;
        END
    `);

    // Ensure broad unique constraint exists (including all hierarchy levels)
    await executeQuery(`
        IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE type = 'UQ' AND name = 'uq_skill_matrix_full_hierarchy')
        BEGIN
            -- First, clean up any existing duplicates that would violate the new constraint
            -- We keep the most recently updated record for each unique combination
            WITH CTE AS (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY department, section, line, subSection, station, month 
                           ORDER BY updatedAt DESC, id DESC
                       ) AS rn
                FROM skill_matrices
            )
            DELETE FROM skill_matrices WHERE id IN (SELECT id FROM CTE WHERE rn > 1);

            -- Now add the constraint
            ALTER TABLE skill_matrices
            ADD CONSTRAINT uq_skill_matrix_full_hierarchy UNIQUE (department, section, line, subSection, station, month);
        END
    `);
};

// @desc    Save (Upsert) Skill Matrix
// @route   POST /api/v1/skill-matrix/save
// @access  Private (Admin)
const saveSkillMatrix = asyncHandler(async (req, res) => {
    await ensureSkillMatrixMonthSchema();

    const { department, section, line, subSection, station, month, entries, headerInfo, footerInfo } = req.body;

    if (!department || !line) {
        throw new ApiError(400, "Department and Line are required");
    }
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    // Prepare JSON strings
    const entriesJson = JSON.stringify(entries || []);
    const headerJson = JSON.stringify(headerInfo || {});
    const footerJson = JSON.stringify(footerInfo || {});

    // Build Where Clause for existence check
    const whereClauses = ["department = ?", "line = ?", "month = ?"];
    const whereParams = [department, line, targetMonth];

    if (section) { whereClauses.push("section = ?"); whereParams.push(section); } else { whereClauses.push("section IS NULL"); }
    if (subSection) { whereClauses.push("subSection = ?"); whereParams.push(subSection); } else { whereClauses.push("subSection IS NULL"); }
    if (station) { whereClauses.push("station = ?"); whereParams.push(station); } else { whereClauses.push("station IS NULL"); }

    const [existing] = await executeQuery(
        `SELECT id FROM skill_matrices WHERE ${whereClauses.join(' AND ')}`,
        whereParams
    );

    let matrixId;
    if (existing.length > 0) {
        // Update
        matrixId = existing[0].id;
        await executeQuery(
            `UPDATE skill_matrices 
             SET entries = ?, headerInfo = ?, footerInfo = ?, month = ?, updatedAt = GETDATE() 
             WHERE id = ?`,
            [entriesJson, headerJson, footerJson, targetMonth, matrixId]
        );
    } else {
        // Insert
        const [insertRows] = await executeQuery(
            `INSERT INTO skill_matrices (department, section, line, subSection, station, month, entries, headerInfo, footerInfo, createdAt, updatedAt)
             OUTPUT INSERTED.id
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
            [department, section || null, line, subSection || null, station || null, targetMonth, entriesJson, headerJson, footerJson]
        );
        matrixId = insertRows[0].id;
    }

    // Fetch updated/created
    const [rows] = await executeQuery("SELECT * FROM skill_matrices WHERE id = ?", [matrixId]);
    const matrix = rows[0];

    // Parse JSON for response
    matrix.entries = parseJSON(matrix.entries);
    matrix.headerInfo = parseJSON(matrix.headerInfo);
    matrix.footerInfo = parseJSON(matrix.footerInfo);

    // --- SYNC USER LEVELS & TRIGGER HANDOVER ---
    if (entries && Array.isArray(entries)) {
        try {
            const { checkAndProcessHandover, checkAndProcessMaxLevelNotification } = await import("../utils/handover.util.js");

            for (const entry of entries) {
                if (entry.userId) { // Skip manual
                    // 1. Fetch User Data and Current Assignments
                    const [uRows] = await executeQuery(
                        "SELECT currentLevel, currentSkill, stationId FROM users WHERE id = ?", 
                        [entry.userId]
                    );
                    
                    if (uRows.length > 0) {
                        const userData = uRows[0];
                        let currentSkillMap = parseJSON(userData.currentSkill, {});
                        const primaryStationId = String(userData.stationId || "");

                        // Fetch secondary assignments from junction table
                        const [aRows] = await executeQuery(
                            "SELECT machine_id FROM machine_assignments WHERE user_id = ?",
                            [entry.userId]
                        );
                        const assignedMachineIds = aRows.map(r => String(r.machine_id));
                        if (primaryStationId) assignedMachineIds.push(primaryStationId);
                        
                        let maxWeight = 1;
                        let skillMapChanged = false;

                        if (entry.stations && Array.isArray(entry.stations)) {
                            entry.stations.forEach(s => {
                                const levelStr = s.curr || "L-1";
                                const stationIdStr = String(s.machineId || "");

                                // A. Track Max Weight from THIS matrix for potential upgrade
                                const match = levelStr.match(/\d+/);
                                if (match) {
                                    const w = parseInt(match[0]);
                                    if (w > maxWeight) maxWeight = w;
                                }

                                // B. Sync Station-Specific Proficiency
                                // Only update operator profile if they are assigned to this specific station
                                if (assignedMachineIds.includes(stationIdStr)) {
                                    if (currentSkillMap[stationIdStr] !== levelStr) {
                                        currentSkillMap[stationIdStr] = levelStr;
                                        skillMapChanged = true;
                                    }
                                }
                            });
                        }

                        // Determine New Global Level
                        // We take the MAX of their existing level and the new matrix levels
                        const currentGlobal = userData.currentLevel || "L1";
                        const globalMatch = currentGlobal.match(/\d+/);
                        const currentGlobalWeight = globalMatch ? parseInt(globalMatch[0]) : 1;
                        
                        const finalMaxWeight = Math.max(maxWeight, currentGlobalWeight);
                        const newGlobalLevel = `L${finalMaxWeight}`;

                        if (skillMapChanged || finalMaxWeight !== currentGlobalWeight) {
                            console.log(`[SkillMatrix] Syncing User ${entry.userId}: Level ${currentGlobal}->${newGlobalLevel}, MapChanged: ${skillMapChanged}`);
                            
                            await executeQuery(
                                "UPDATE users SET currentLevel = ?, currentSkill = ?, updatedAt = GETDATE() WHERE id = ?",
                                [newGlobalLevel, JSON.stringify(currentSkillMap), entry.userId]
                            );

                            // Trigger Handover if upgraded
                            if (finalMaxWeight > currentGlobalWeight && finalMaxWeight > 1) {
                                await checkAndProcessHandover(entry.userId, newGlobalLevel);
                                await checkAndProcessMaxLevelNotification(entry.userId, newGlobalLevel);
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error("[SkillMatrix] Error syncing levels:", err);
            // Don't fail the save response
        }
    }
    // -------------------------------------------

    // Trigger Email Notification
    if (req.body.sendEmail) {
        NotificationService.sendFormReport("Skill Matrix Sheet", department, req.body)
            .catch(err => console.error("[SkillMatrix] Notification failed:", err));
    }

    res.status(200).json(
        new ApiResponse(200, matrix, "Skill Matrix saved successfully")
    );
});

// @desc    Get Skill Matrix by Department and Line
// @route   GET /api/v1/skill-matrix/:departmentId/:lineId
// @access  Private
const getSkillMatrix = asyncHandler(async (req, res) => {
    await ensureSkillMatrixMonthSchema();

    // Use query params for all flexible hierarchy filters
    const { departmentId, sectionId, lineId, subSectionId, stationId, month } = req.query;

    // Backward compatibility with params if still used, but prefer query
    const dept = departmentId || req.params.departmentId;
    const line = lineId || req.params.lineId;

    if (!dept || !line) {
        throw new ApiError(400, "Department ID and Line ID are required");
    }

    let whereClauses = ["department = ?", "line = ?"];
    let params = [dept, line];

    if (sectionId) { whereClauses.push("section = ?"); params.push(sectionId); }
    if (subSectionId) { whereClauses.push("subSection = ?"); params.push(subSectionId); }
    if (stationId) { whereClauses.push("station = ?"); params.push(stationId); }
    if (month) { whereClauses.push("month = ?"); params.push(month); }

    let sql = `SELECT * FROM skill_matrices WHERE ${whereClauses.join(' AND ')}`;
    if (!month) sql += " ORDER BY updatedAt DESC OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY";

    const [rows] = await executeQuery(sql, params);

    if (rows.length === 0) {
        // Return null data with success code if not found, 
        // frontend will handle the "not created yet" state by showing default derived data
        return res
            .status(200)
            .json(new ApiResponse(200, null, "No saved matrix found used default"));
    }

    const matrix = rows[0];
    matrix.entries = parseJSON(matrix.entries);
    matrix.headerInfo = parseJSON(matrix.headerInfo);
    matrix.footerInfo = parseJSON(matrix.footerInfo);

    res.status(200).json(
        new ApiResponse(200, matrix, "Skill Matrix fetched successfully")
    );
});

// @desc    List Skill Matrix forms with filters
// @route   GET /api/v1/skill-matrix/list
// @access  Private
const listSkillMatrices = asyncHandler(async (req, res) => {
    await ensureSkillMatrixMonthSchema();

    const { departmentId, sectionId, lineId, subSectionId, stationId, month } = req.query;

    let sql = `
        SELECT 
            sm.id, sm.department, sm.section, sm.line, sm.subSection, sm.station, sm.month, sm.createdAt, sm.updatedAt,
            sm.footerInfo,
            d.name AS departmentName,
            sec.name AS sectionName,
            l.name AS lineName,
            ss.name AS subSectionName,
            st.name AS stationName,
            l.lineLeader AS lineLeaderName,
            -- Calculate User Count based on most granular hierarchy level
            COALESCE(
              CASE 
                WHEN sm.station IS NOT NULL AND TRY_CAST(sm.station AS INT) IS NOT NULL THEN (SELECT COUNT(DISTINCT u.id) FROM users u WHERE (u.stationId = CAST(sm.station AS INT) OR u.id IN (SELECT user_id FROM machine_assignments WHERE machine_id = CAST(sm.station AS INT))) AND (u.isDeleted = 0 OR u.isDeleted IS NULL) AND u.role IN ('STUDENT', 'CUSTOM'))
                WHEN sm.subSection IS NOT NULL AND TRY_CAST(sm.subSection AS INT) IS NOT NULL THEN (SELECT COUNT(*) FROM OPENJSON((SELECT users FROM sub_sections WHERE id = CAST(sm.subSection AS INT))))
                WHEN sm.line IS NOT NULL AND TRY_CAST(sm.line AS INT) IS NOT NULL THEN (SELECT COUNT(*) FROM OPENJSON((SELECT users FROM [lines] WHERE id = CAST(sm.line AS INT))))
                WHEN sm.section IS NOT NULL AND TRY_CAST(sm.section AS INT) IS NOT NULL THEN (SELECT COUNT(*) FROM OPENJSON((SELECT users FROM [sections] WHERE id = CAST(sm.section AS INT))))
                ELSE (SELECT COUNT(DISTINCT u_inner.[value]) FROM [sections] s2 CROSS APPLY OPENJSON(ISNULL(s2.users, '[]')) u_inner WHERE s2.departmentId = TRY_CAST(sm.department AS INT) OR s2.departmentId IN (SELECT id FROM departments WHERE name = sm.department))
              END, 0) as userCount
        FROM skill_matrices sm
        LEFT JOIN departments d ON (sm.department = CAST(d.id AS VARCHAR(255)) OR sm.department = d.name)
        LEFT JOIN sections sec ON (sm.section = CAST(sec.id AS VARCHAR(255)) OR sm.section = sec.name)
        LEFT JOIN [lines] l ON (sm.line = CAST(l.id AS VARCHAR(255)) OR sm.line = l.name)
        LEFT JOIN sub_sections ss ON (sm.subSection = CAST(ss.id AS VARCHAR(255)) OR sm.subSection = ss.name)
        LEFT JOIN machines st ON (sm.station = CAST(st.id AS VARCHAR(255)) OR sm.station = st.name)
        WHERE 1 = 1
    `;
    const params = [];

    if (departmentId) { sql += " AND sm.department = ?"; params.push(departmentId); }
    if (sectionId) { sql += " AND sm.section = ?"; params.push(sectionId); }
    if (lineId) { sql += " AND sm.line = ?"; params.push(lineId); }
    if (subSectionId) { sql += " AND sm.subSection = ?"; params.push(subSectionId); }
    if (stationId) { sql += " AND sm.station = ?"; params.push(stationId); }
    if (month) { sql += " AND sm.month = ?"; params.push(month); }

    sql += " ORDER BY sm.updatedAt DESC, sm.createdAt DESC";

    const [rows] = await executeQuery(sql, params);

    // Parse JSON fields for the list
    const parsedRows = (rows || []).map(row => ({
        ...row,
        footerInfo: parseJSON(row.footerInfo)
    }));

    res.status(200).json(
        new ApiResponse(200, parsedRows, "Skill Matrix list fetched successfully")
    );
});

/**
 * Get Skill Matrix Certificate Configuration
 */
const getSkillMatrixConfig = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const config = await SkillMatrixConfig.findByDepartmentId(departmentId);

    res.json(new ApiResponse(200, { config: config ? config.config : null, history: [] }, "Configuration fetched successfully"));
});

/**
 * Save Skill Matrix Certificate Configuration
 */
const saveSkillMatrixConfig = asyncHandler(async (req, res) => {
    const { departmentId, config, remark } = req.body;

    if (!config) {
        throw new ApiError(400, "Configuration is required");
    }

    const updatedBy = req.user.id;
    const newConfig = await SkillMatrixConfig.upsert({
        departmentId,
        config,
        updatedBy,
        remark
    });

    res.json(new ApiResponse(200, newConfig, "Configuration saved successfully"));
});

/**
 * Get Skill Matrix Certificate Configuration History
 */
const getSkillMatrixCertHistory = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const history = await SkillMatrixConfig.getHistory(departmentId);
    res.json(new ApiResponse(200, history, "History fetched successfully"));
});

/**
 * Get Skill Matrix Certificate Evaluation for a student
 */
const getSkillMatrixEvaluation = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const evaluation = await SkillMatrixEvaluation.findByStudentId(studentId);

    if (!evaluation) {
        return res.json(new ApiResponse(200, { isNew: true }, "No evaluation found"));
    }

    // Parse JSON fields
    evaluation.headerData = parseJSON(evaluation.headerData);
    evaluation.docData = parseJSON(evaluation.docData);
    evaluation.evalData = parseJSON(evaluation.evalData);

    res.json(new ApiResponse(200, { ...evaluation, isNew: false }, "Evaluation fetched successfully"));
});

/**
 * Get Skill Matrix Dashboard Configuration
 */
const getSkillMatrixDashboardConfig = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const config = await SkillMatrixDashboardConfig.findByDepartmentId(departmentId);
    res.json(new ApiResponse(200, { config: config ? config.config : null, history: [] }, "Dashboard configuration fetched successfully"));
});

/**
 * Save Skill Matrix Dashboard Configuration
 */
const saveSkillMatrixDashboardConfig = asyncHandler(async (req, res) => {
    const { departmentId, config, remark } = req.body;
    if (!config) {
        throw new ApiError(400, "Configuration is required");
    }
    const updatedBy = req.user.id;
    const newConfig = await SkillMatrixDashboardConfig.upsert(departmentId, config, remark, updatedBy);
    res.json(new ApiResponse(200, newConfig, "Dashboard configuration saved successfully"));
});

/**
 * Get Skill Matrix Dashboard Configuration History
 */
const getSkillMatrixDashboardHistory = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const history = await SkillMatrixDashboardConfig.getHistory(departmentId);
    res.json(new ApiResponse(200, history, "Dashboard history fetched successfully"));
});

/**
 * Save Skill Matrix Certificate Evaluation
 */
const saveSkillMatrixEvaluation = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const { departmentId, headerData, docData, evalData, opinion } = req.body;

    const updatedBy = req.user.id;
    const evaluation = await SkillMatrixEvaluation.upsert({
        studentId,
        departmentId,
        headerData,
        docData,
        evalData,
        opinion,
        updatedBy
    });

    res.json(new ApiResponse(200, evaluation, "Evaluation saved successfully"));
});

export {
    saveSkillMatrix,
    getSkillMatrix,
    listSkillMatrices,
    getSkillMatrixConfig,
    saveSkillMatrixConfig,
    getSkillMatrixCertHistory,
    getSkillMatrixEvaluation,
    saveSkillMatrixEvaluation,
    getSkillMatrixDashboardConfig,
    saveSkillMatrixDashboardConfig,
    getSkillMatrixDashboardHistory
};

