import { executeQuery } from "../db/mssqlHelper.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import NotificationService from "../services/notification.service.js";
import { SkillMatrixConfig } from "../models/skillMatrixConfig.model.js";
import { SkillMatrixEvaluation } from "../models/skillMatrixEvaluation.model.js";
import SkillMatrixDashboardConfig from "../models/skillMatrixDashboardConfig.model.js";
import User from "../models/auth.model.js";
import CourseLevelConfig from "../models/courseLevelConfig.model.js";

// Helper to safely parse JSON
const parseJSON = (data, fallback = null) => {
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch (e) { return fallback; }
    }
    return data || fallback;
};

const normalizeParam = (val) => {
    if (!val || val === 'undefined' || val === 'null' || val === '') return null;
    return val;
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

    // Ensure line is NULLable in DB (we drop the uq_skill_matrix_full_hierarchy constraint if exists, alter line to nullable, then let the unique constraint block recreate it)
    await executeQuery(`
        IF EXISTS (
            SELECT 1 FROM sys.columns c
            INNER JOIN sys.objects o ON c.object_id = o.object_id
            WHERE o.name = 'skill_matrices' AND c.name = 'line' AND c.is_nullable = 0
        )
        BEGIN
            IF EXISTS (SELECT 1 FROM sys.objects WHERE type = 'UQ' AND name = 'uq_skill_matrix_full_hierarchy')
            BEGIN
                ALTER TABLE skill_matrices DROP CONSTRAINT uq_skill_matrix_full_hierarchy;
            END
            ALTER TABLE skill_matrices ALTER COLUMN line VARCHAR(255) NULL;
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

    const normDept = normalizeParam(department);
    const normLine = normalizeParam(line);
    const normSection = normalizeParam(section);
    const normSubSection = normalizeParam(subSection);
    const normStation = normalizeParam(station);

    if (!normDept) {
        throw new ApiError(400, "Department is required");
    }
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    // Prepare JSON strings
    const entriesJson = JSON.stringify(entries || []);
    const headerJson = JSON.stringify(headerInfo || {});
    const footerJson = JSON.stringify(footerInfo || {});

    // Build Where Clause for existence check
    const whereClauses = ["department = ?", "month = ?"];
    const whereParams = [normDept, targetMonth];

    if (normLine) { whereClauses.push("line = ?"); whereParams.push(normLine); } else { whereClauses.push("line IS NULL"); }
    if (normSection) { whereClauses.push("section = ?"); whereParams.push(normSection); } else { whereClauses.push("section IS NULL"); }
    if (normSubSection) { whereClauses.push("subSection = ?"); whereParams.push(normSubSection); } else { whereClauses.push("subSection IS NULL"); }
    if (normStation) { whereClauses.push("station = ?"); whereParams.push(normStation); } else { whereClauses.push("station IS NULL"); }

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
            [normDept, normSection, normLine, normSubSection, normStation, targetMonth, entriesJson, headerJson, footerJson]
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

            // Fetch machineId -> subSectionId mapping
            const [mRows] = await executeQuery("SELECT id, subSectionId FROM [machines]");
            const machineSubSectionMap = {};
            mRows.forEach(m => {
                machineSubSectionMap[String(m.id)] = String(m.subSectionId);
            });

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
                        
                        let maxWeight = 1;
                        let skillMapChanged = false;

                        if (entry.stations && Array.isArray(entry.stations)) {
                            entry.stations.forEach(s => {
                                const levelStr = s.curr || "L-1";
                                const stationIdStr = String(s.machineId || "");
                                const subSectionIdStr = machineSubSectionMap[stationIdStr];

                                // A. Track Max Weight from THIS matrix for potential upgrade
                                const match = levelStr.match(/\d+/);
                                if (match) {
                                    const w = parseInt(match[0]);
                                    if (w > maxWeight) maxWeight = w;
                                }

                                // B. Sync SubSection-Specific Proficiency
                                if (subSectionIdStr) {
                                    if (currentSkillMap[subSectionIdStr] !== levelStr) {
                                        currentSkillMap[subSectionIdStr] = levelStr;
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
    const dept = normalizeParam(departmentId || req.params.departmentId);
    const line = normalizeParam(lineId || req.params.lineId);
    const section = normalizeParam(sectionId);
    const subSection = normalizeParam(subSectionId);
    const station = normalizeParam(stationId);

    if (!dept) {
        throw new ApiError(400, "Department ID is required");
    }

    let whereClauses = ["department = ?"];
    let params = [dept];

    if (line) { whereClauses.push("line = ?"); params.push(line); } else { whereClauses.push("line IS NULL"); }
    if (section) { whereClauses.push("section = ?"); params.push(section); } else { whereClauses.push("section IS NULL"); }
    if (subSection) { whereClauses.push("subSection = ?"); params.push(subSection); } else { whereClauses.push("subSection IS NULL"); }
    if (station) { whereClauses.push("station = ?"); params.push(station); } else { whereClauses.push("station IS NULL"); }
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
                WHEN sm.station IS NOT NULL AND TRY_CAST(sm.station AS INT) IS NOT NULL THEN (SELECT COUNT(DISTINCT u.id) FROM users u WHERE (u.stationId = CAST(sm.station AS INT) OR u.id IN (SELECT user_id FROM machine_assignments WHERE machine_id = CAST(sm.station AS INT))) AND (u.isDeleted = 0 OR u.isDeleted IS NULL) AND u.role IN ('STUDENT', 'CUSTOM') AND (u.status IS NULL OR u.status != 'LEFT'))
                WHEN sm.subSection IS NOT NULL AND TRY_CAST(sm.subSection AS INT) IS NOT NULL THEN (SELECT COUNT(DISTINCT u.id) FROM users u WHERE u.subSectionId = CAST(sm.subSection AS INT) AND (u.isDeleted = 0 OR u.isDeleted IS NULL) AND u.role IN ('STUDENT', 'CUSTOM') AND (u.status IS NULL OR u.status != 'LEFT'))
                WHEN sm.line IS NOT NULL AND TRY_CAST(sm.line AS INT) IS NOT NULL THEN (SELECT COUNT(DISTINCT u.id) FROM users u WHERE u.lineId = CAST(sm.line AS INT) AND (u.isDeleted = 0 OR u.isDeleted IS NULL) AND u.role IN ('STUDENT', 'CUSTOM') AND (u.status IS NULL OR u.status != 'LEFT'))
                WHEN sm.section IS NOT NULL AND TRY_CAST(sm.section AS INT) IS NOT NULL THEN (SELECT COUNT(DISTINCT u.id) FROM users u WHERE u.sectionId = CAST(sm.section AS INT) AND (u.isDeleted = 0 OR u.isDeleted IS NULL) AND u.role IN ('STUDENT', 'CUSTOM') AND (u.status IS NULL OR u.status != 'LEFT'))
                ELSE (SELECT COUNT(DISTINCT u.id) FROM users u WHERE (u.departmentId = TRY_CAST(sm.department AS INT) OR u.department = sm.department) AND (u.isDeleted = 0 OR u.isDeleted IS NULL) AND u.role IN ('STUDENT', 'CUSTOM') AND (u.status IS NULL OR u.status != 'LEFT'))
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

// Helper to calculate operator efficiency from evalData
const calculateUserEfficiency = (evalData) => {
    if (!evalData) return 0;
    let parsed = evalData;
    if (typeof evalData === 'string') {
        try {
            parsed = JSON.parse(evalData);
        } catch (e) {
            return 0;
        }
    }
    
    // Rule L4: Able to teach other operators (sIdx = 3)
    // All 5 questions ('3-0', '3-1', '3-2', '3-3', '3-4') must be OK
    const l4Keys = ['3-0', '3-1', '3-2', '3-3', '3-4'];
    const isL4Ok = l4Keys.every(k => parsed[k]?.standard === 'OK');
    if (isL4Ok) {
        return 100;
    }

    // Rule L3: Whether he can operate in the standard time? (sIdx = 2, iIdx = 0 -> '2-0')
    const l3Data = parsed['2-0'];
    if (l3Data?.standard === 'OK') {
        const val = parseFloat(l3Data.okVal);
        if (!isNaN(val)) return val;
    }

    // Rule L2: Whether his operation in charge is at least 75%? (sIdx = 1, iIdx = 1 -> '1-1')
    const l2Data = parsed['1-1'];
    if (l2Data?.standard === 'OK') {
        const val = parseFloat(l2Data.okVal);
        if (!isNaN(val)) return val;
    }

    // Rule L1: The operation method is correct with the standard or not (sIdx = 0, iIdx = 2 -> '0-2')
    const l1Data = parsed['0-2'];
    if (l1Data?.standard === 'OK') {
        const val = parseFloat(l1Data.okVal);
        if (!isNaN(val)) return val;
    }

    return 0;
};

// @desc    Get Skill Matrix Efficiency Stats for operators in a hierarchy
// @route   GET /api/v1/skill-matrix/evaluations/efficiency
// @access  Private
const getSkillMatrixEfficiencyStats = asyncHandler(async (req, res) => {
    const { departmentId, sectionId, lineId, subSectionId } = req.query;

    let whereClauses = ["(u.isDeleted = 0 OR u.isDeleted IS NULL)", "u.role IN ('STUDENT', 'CUSTOM')", "(u.status IS NULL OR u.status != 'LEFT')"];
    let params = [];

    if (departmentId) {
        whereClauses.push("u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [sections] s2 CROSS APPLY OPENJSON(ISNULL(s2.users, '[]')) u_inner WHERE s2.departmentId = ?)");
        params.push(departmentId);
    }
    if (sectionId) {
        whereClauses.push("u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [sections] s2 CROSS APPLY OPENJSON(ISNULL(s2.users, '[]')) u_inner WHERE s2.id = ?)");
        params.push(sectionId);
    }
    if (lineId) {
        whereClauses.push("u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [lines] l2 CROSS APPLY OPENJSON(ISNULL(l2.users, '[]')) u_inner WHERE l2.id = ?)");
        params.push(lineId);
    }
    if (subSectionId) {
        whereClauses.push("u.id IN (SELECT DISTINCT CAST(u_inner.[value] AS INT) FROM [sub_sections] ss2 CROSS APPLY OPENJSON(ISNULL(ss2.users, '[]')) u_inner WHERE ss2.id = ?)");
        params.push(subSectionId);
    }

    const sql = `
        SELECT 
            u.id, 
            u.fullName, 
            u.empId, 
            u.currentEffeciency,
            u.skillEffeciency
        FROM users u
        WHERE ${whereClauses.join(' AND ')}
    `;

    const [rows] = await executeQuery(sql, params);

    const results = rows.map(row => {
        let skillEffMap = row.skillEffeciency || {};
        if (typeof skillEffMap === 'string') {
            try {
                skillEffMap = JSON.parse(skillEffMap);
            } catch (e) {
                skillEffMap = {};
            }
        }

        let efficiency = 0;
        if (subSectionId) {
            efficiency = skillEffMap[String(subSectionId)] !== undefined ? skillEffMap[String(subSectionId)] : 0;
        } else {
            efficiency = row.currentEffeciency || 0;
        }

        return {
            id: row.id,
            fullName: row.fullName,
            empId: row.empId,
            efficiency: Math.round(efficiency * 100) / 100
        };
    });

    res.status(200).json(
        new ApiResponse(200, results, "Skill matrix efficiency stats fetched successfully")
    );
});

// @desc    Get Skill Matrix Efficiency Summary for all departments and sections
// @route   GET /api/v1/skill-matrix/evaluations/summary
// @access  Private
const getSkillMatrixEfficiencySummary = asyncHandler(async (req, res) => {
    const sql = `
        SELECT 
            u.id as userId,
            u.fullName,
            u.empId,
            u.status as userStatus,
            d.id as departmentId,
            d.name as departmentName,
            s_res.sectionId,
            s_res.sectionName,
            s_res.sectionCategory,
            l_res.lineId,
            l_res.lineName,
            ss_res.subSectionId,
            ss_res.subSectionName,
            sme.evalData,
            al.logStatus as logStatus,
            CONVERT(VARCHAR(10), dates.attendanceDate, 120) as attendanceDate,
            al_shift.shift,
            u.currentEffeciency
        FROM users u
        CROSS JOIN (
            SELECT DISTINCT [date] as attendanceDate FROM attendance_logs
        ) dates
        OUTER APPLY (
            SELECT TOP 1 ss.id as subSectionId, ss.name as subSectionName, ss.lineId as ssLineId 
            FROM sub_sections ss WHERE ss.id = u.subSectionId
        ) ss_res
        OUTER APPLY (
            SELECT TOP 1 l.id as lineId, l.name as lineName, l.sectionId as lSectionId, l.department as lDeptId
            FROM [lines] l WHERE l.id = COALESCE(u.lineId, ss_res.ssLineId)
        ) l_res
        OUTER APPLY (
            SELECT TOP 1 s.id as sectionId, s.name as sectionName, s.category as sectionCategory, s.departmentId as sDeptId
            FROM [sections] s WHERE s.id = COALESCE(u.sectionId, l_res.lSectionId)
        ) s_res
        OUTER APPLY (
            SELECT TOP 1 d.id, d.name
            FROM departments d 
            WHERE d.id = COALESCE(u.departmentId, s_res.sDeptId, l_res.lDeptId)
               OR (u.departmentId IS NULL AND (u.department = d.name OR TRY_CAST(u.department AS INT) = d.id))
        ) d
        OUTER APPLY (
            SELECT TOP 1 [status] as logStatus
            FROM attendance_logs
            WHERE userId = u.id AND [date] = dates.attendanceDate
        ) al
        OUTER APPLY (
            SELECT TOP 1 [shift]
            FROM attendance_logs
            WHERE userId = u.id AND [shift] IS NOT NULL AND [date] = dates.attendanceDate
        ) al_shift
        LEFT JOIN skill_matrix_evaluations sme ON u.id = sme.studentId
        WHERE (u.isDeleted = 0 OR u.isDeleted IS NULL)
          AND u.role IN ('STUDENT', 'CUSTOM')
          AND (u.status IS NULL OR u.status != 'LEFT')
    `;

    const [rows] = await executeQuery(sql);

    res.status(200).json(
        new ApiResponse(200, rows, "Skill matrix efficiency summary fetched successfully")
    );
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

const DEFAULT_SKILL_CONFIG = {
    headerDefaults: {
        processInCharge: '',
        resultPerson: ''
    },
    docDefaults: {
        docNo: 'FRM-HR-007',
        revNo: '02',
        revDate: '06/10/17',
        dateOfIssue: '04-02-2018'
    },
    levels: {
        0: { title: "OK in education training of operation contents but speed is no more than 74%", items: [{ id: 1, text: "Learnt the basic knowledge of process or not", method: "Confirm the education record" }, { id: 2, text: "The understanding test result is satisfying the standard or not", method: "Look in the understand test result of education record" }, { id: 3, text: "The operation method is correct with the standard or not", method: "Observe his operation by each product (type)" }, { id: 4, text: "Whether the operation is as operation-steps.", method: "Observe his operation by each product." }, { id: 5, text: "Whether he knows the inspection method, name of part, equipment, system", method: "Check the method of inspection at begin of operation" }, { id: 6, text: "Whether he knows the evaluation standard in operation (OK or NG product)", method: "Make question and hear his answer" }] },
        1: { title: "OK in education training of operation contents but speed is just 75-99%", items: [{ id: 1, text: "Whether he confirms the quality correctly?", method: "Observe the operation" }, { id: 2, text: "Whether his operation in charge is at least 75%?", method: "Measure the operation time" }, { id: 3, text: "Whether he can report the abnormality (Andon) correctly?", method: "Judge by operation observance and question" }, { id: 4, text: "Whether he changes the steps of operation or operation method by himself?", method: "Observe the operation" }] },
        2: { title: "Able to operation by himself (Speed & operation as the standard is OK)", items: [{ id: 1, text: "Whether he can operate in the standard time?", method: "Measure the operation time" }, { id: 2, text: "Whether he understand the judgement method & the treatment of the abnormality?", method: "Make question and fill the answer" }, { id: 3, text: "Whether he understand the operation standard and obey as it. Can he give the an idea of improvement?", method: "Observe the operation in over 2 cycles and make question to him about the improvement (Standard operation table)" }] },
        3: { title: "Able to teach other operators", items: [{ id: 1, text: "Whether the result in understanding test was over the standard", method: "Look in the understanding test result of education record" }, { id: 2, text: "Whether he understands the method of teaching", method: "Make questions about the teaching method and confirmation when teaching" }, { id: 3, text: "Whether he is good at confirmation about the understanding after teaching or in teaching", method: "Confirm the teaching method" }, { id: 4, text: "Can he change the teaching method belonging the level of operator (Understanding ability)?", method: "Confirm the teaching method" }, { id: 5, text: "Whether he understand the operation standard and obey as it.", method: "Confirm the teaching method and operation content (basing on the standard-operation-table)" }] }
    }
};

const computeEarnedLevel = (evalData, skillCertConfig, activeConfigLevels) => {
    const levels = skillCertConfig?.levels || {};
    let consecutiveOk = 0;

    for (let sIdx = 0; sIdx < activeConfigLevels.length; sIdx++) {
        const levelDef = levels[sIdx];
        if (!levelDef) break; // no more sections defined

        const items = levelDef.items || [];
        if (items.length === 0) break;

        const allOk = items.every((_, iIdx) =>
            evalData?.[`${sIdx}-${iIdx}`]?.standard === 'OK'
        );
        if (!allOk) break;
        consecutiveOk++;
    }

    if (consecutiveOk === 0) return null;
    return activeConfigLevels[consecutiveOk - 1]?.name || null;
};

/**
 * Save Skill Matrix Certificate Evaluation
 */
const saveSkillMatrixEvaluation = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const { departmentId, subSectionId, headerData, docData, evalData, opinion, sendEmail } = req.body;

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

    // Sync student efficiency fields
    try {
        const student = await User.findById(studentId);
        if (student) {
            const calculatedEfficiency = calculateUserEfficiency(evalData);
            const targetSubSectionId = subSectionId || student.subSectionId || student.targetSubSectionId;

            if (targetSubSectionId) {
                const subSecKey = String(targetSubSectionId);
                let skillEffMap = student.skillEffeciency || {};
                if (typeof skillEffMap === 'string') {
                    try { skillEffMap = JSON.parse(skillEffMap); } catch (e) { skillEffMap = {}; }
                }

                // Update mapping
                skillEffMap[subSecKey] = calculatedEfficiency;

                // Update fields
                student.currentEffeciency = calculatedEfficiency;
                student.skillEffeciency = skillEffMap;

                await student.save();
                console.log(`[SkillMatrixEvaluation] Synced operator ${studentId} efficiency for subSectionId ${subSecKey}: ${calculatedEfficiency}%`);
            }
        }
    } catch (err) {
        console.error("[SkillMatrixEvaluation] Failed to sync operator efficiency:", err);
    }

    let levelUpgraded = false;
    let newLevel = null;

    // Level upgrade based on skill matrix certificate evaluation
    try {
        const activeConfig = await CourseLevelConfig.getActiveConfig();
        const certConfig = await SkillMatrixConfig.findByDepartmentId(departmentId || 'GLOBAL');
        const skillCertConfig = certConfig?.config || DEFAULT_SKILL_CONFIG;
        const parsedEvalData = parseJSON(evalData, {});

        const earnedLevelName = computeEarnedLevel(parsedEvalData, skillCertConfig, activeConfig.levels);

        if (earnedLevelName) {
            const [uRows] = await executeQuery(
                "SELECT currentLevel, currentSkill, subSectionId, targetSubSectionId FROM users WHERE id = ?", [studentId]
            );
            if (uRows.length > 0) {
                const userData = uRows[0];
                const currentGlobal = userData.currentLevel || 'L0';
                
                // Find order of levels in activeConfig
                const currentLevelObj = activeConfig.levels.find(l => l.name.toUpperCase() === currentGlobal.toUpperCase());
                const currentLevelOrder = currentLevelObj ? currentLevelObj.order : -1;

                const earnedLevelObj = activeConfig.levels.find(l => l.name.toUpperCase() === earnedLevelName.toUpperCase());
                const earnedLevelOrder = earnedLevelObj ? earnedLevelObj.order : -1;

                let skillMap = parseJSON(userData.currentSkill, {});
                let skillMapChanged = false;

                const normalizeId = (id) => {
                    if (!id || id === 'undefined' || id === 'null' || id === '') return null;
                    return id;
                };
                const targetSubSecId = normalizeId(subSectionId) || normalizeId(userData.subSectionId) || normalizeId(userData.targetSubSectionId);

                if (targetSubSecId) {
                    const subSecKey = String(targetSubSecId);
                    const currentSubSecSkill = skillMap[subSecKey] || 'L0';
                    const currentSubSecSkillObj = activeConfig.levels.find(l => l.name.toUpperCase() === currentSubSecSkill.toUpperCase());
                    const currentSubSecSkillOrder = currentSubSecSkillObj ? currentSubSecSkillObj.order : -1;

                    if (earnedLevelOrder > currentSubSecSkillOrder) {
                        skillMap[subSecKey] = earnedLevelName;
                        skillMapChanged = true;
                    }
                }

                const newGlobalOrder = Math.max(currentLevelOrder, earnedLevelOrder);
                const newGlobalLevelObj = activeConfig.levels.find(l => l.order === newGlobalOrder);
                const newGlobalLevelName = newGlobalLevelObj ? newGlobalLevelObj.name : earnedLevelName;

                if (newGlobalOrder > currentLevelOrder) {
                    levelUpgraded = true;
                    newLevel = newGlobalLevelName;
                }

                if (levelUpgraded || skillMapChanged) {
                    await executeQuery(
                        "UPDATE users SET currentLevel = ?, currentSkill = ?, updatedAt = GETDATE() WHERE id = ?",
                        [newGlobalLevelName, JSON.stringify(skillMap), studentId]
                    );

                    if (levelUpgraded) {
                        const { checkAndProcessHandover, checkAndProcessMaxLevelNotification } = await import("../utils/handover.util.js");
                        await checkAndProcessHandover(studentId, newGlobalLevelName);
                        await checkAndProcessMaxLevelNotification(studentId, newGlobalLevelName);
                    }
                }

                if (skillMapChanged && targetSubSecId) {
                    try {
                        const matrixLevelName = earnedLevelName.includes('-') ? earnedLevelName : earnedLevelName.replace('L', 'L-');
                        
                        // 1. Fetch all machines in this sub-section
                        const [machinesInSubSec] = await executeQuery(
                            "SELECT id FROM machines WHERE subSectionId = ?",
                            [targetSubSecId]
                        );
                        const machineIds = machinesInSubSec.map(m => String(m.id));

                        if (machineIds.length > 0) {
                            // 2. Query all skill matrices that contain this operator's userId in their JSON entries
                            const studentIdStr = String(studentId);
                            const [matchingMatrices] = await executeQuery(
                                `SELECT id, entries FROM skill_matrices 
                                 WHERE entries LIKE '%"userId":' + ? + '%' 
                                    OR entries LIKE '%"userId":"' + ? + '"%'`,
                                [studentIdStr, studentIdStr]
                            );

                            for (const matrix of matchingMatrices) {
                                let entriesList = parseJSON(matrix.entries, []);
                                if (!Array.isArray(entriesList)) continue;

                                let matrixChanged = false;
                                for (const entry of entriesList) {
                                    const entryUserId = String(entry.userId || entry._id || "");
                                    if (entryUserId === studentIdStr) {
                                        if (entry.stations && Array.isArray(entry.stations)) {
                                            for (const s of entry.stations) {
                                                const stationIdStr = String(s.machineId || s._id || "");
                                                if (machineIds.includes(stationIdStr)) {
                                                    if (s.curr !== matrixLevelName) {
                                                        s.curr = matrixLevelName;
                                                        matrixChanged = true;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                if (matrixChanged) {
                                    await executeQuery(
                                        "UPDATE skill_matrices SET entries = ?, updatedAt = GETDATE() WHERE id = ?",
                                        [JSON.stringify(entriesList), matrix.id]
                                    );
                                    console.log(`[SkillMatrixEvaluation] Auto-synced operator ${studentId} level ${matrixLevelName} in skill matrix ID ${matrix.id}`);
                                }
                            }
                        }
                    } catch (syncErr) {
                        console.error("[SkillMatrixEvaluation] Failed to auto-sync saved skill matrices:", syncErr);
                    }
                }
            }
        }
    } catch (err) {
        console.error("[SkillMatrixEvaluation] Failed to compute level upgrade:", err);
    }

    if (sendEmail) {
        try {
            const [uRows] = await executeQuery(
                "SELECT fullName, empId, currentLevel FROM users WHERE id = ?",
                [studentId]
            );
            const user = uRows[0] || {};

            let departmentName = '';
            if (departmentId) {
                const [deptRows] = await executeQuery(
                    "SELECT name FROM departments WHERE id = ?",
                    [departmentId]
                );
                if (deptRows.length > 0) {
                    departmentName = deptRows[0].name;
                }
            }

            const emailFormData = {
                studentName: headerData?.trainee || user.fullName || "N/A",
                studentCode: headerData?.employeeNo || user.empId || "N/A",
                departmentName: departmentName || "N/A",
                lineName: headerData?.processInCharge || "N/A",
                processName: headerData?.processInCharge || "N/A",
                level: user.currentLevel || "N/A",
                skillDescription: opinion || "The associate has successfully completed the training and evaluation for the specified process.",
                ...req.body
            };

            NotificationService.sendFormReport("Skill Matrix Certificate Sheet", departmentId, emailFormData, studentId)
                .catch(err => console.error("[SkillMatrixCert] Notification failed:", err));
        } catch (err) {
            console.error("[SkillMatrixCert] Notification preparation failed:", err);
        }
    }

    res.json(new ApiResponse(200, { ...evaluation, levelUpgraded, newLevel }, "Evaluation saved successfully"));
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
    getSkillMatrixEfficiencyStats,
    getSkillMatrixEfficiencySummary,
    getSkillMatrixDashboardConfig,
    saveSkillMatrixDashboardConfig,
    getSkillMatrixDashboardHistory
};

