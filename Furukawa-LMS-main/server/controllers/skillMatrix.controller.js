import { executeQuery } from "../db/mssqlHelper.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import NotificationService from "../services/notification.service.js";
import Department from "../models/department.model.js";
import Section from "../models/section.model.js";
import { canActOnSkillMatrix, SKILL_MATRIX_SIGNATURE_ROLES } from "../../shared/skillMatrixRouting.js";
import { SkillMatrixConfig } from "../models/skillMatrixConfig.model.js";
import { SkillMatrixEvaluation } from "../models/skillMatrixEvaluation.model.js";
import SkillMatrixDashboardConfig from "../models/skillMatrixDashboardConfig.model.js";
import CourseLevelConfig from "../models/courseLevelConfig.model.js";
import {
    calculateUserEfficiency,
    isLevelFullyOK,
    getPeriodFromDate,
    DEFAULT_SKILL_CONFIG,
    syncStudentSkillProgress
} from "../utils/skillMatrix.util.js";

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


// Resolves a level string to a comparable weight. Numeric "L<n>" levels (including negative
// trainee levels like "L-3") are weighted by their own suffix, matching the numeric convention
// used elsewhere (e.g. Rule B reconstructs level strings as `L${weight}`). Only non-numeric,
// custom-named levels ("Expert", etc.) fall back to the configured level order — config `order`
// is 0-indexed (L1 = 0) and would misalign with the numeric convention if checked first.
const getLevelWeight = (levelStr, activeLevels) => {
    if (!levelStr) return -99;
    const cleanLevel = String(levelStr).trim().toUpperCase();

    const match = cleanLevel.match(/-?\d+/);
    if (match) return parseInt(match[0]);

    if (activeLevels && Array.isArray(activeLevels)) {
        const found = activeLevels.find(l => l.name.toUpperCase() === cleanLevel);
        if (found && found.order !== undefined) return found.order;
    }

    return -99;
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
        `SELECT id, footerInfo FROM skill_matrices WHERE ${whereClauses.join(' AND ')}`,
        whereParams
    );

    // Segregation of Duties: a QA/Safety/Process signature that is being newly set, changed, or
    // cleared must be authorized against that role's configured Skill Matrix approval routing for
    // the source department/section (see shared/skillMatrixRouting.js). Only the roles that actually
    // changed are checked, so a QA-authorized user editing signatures.qa isn't blocked just because
    // they aren't authorized for signatures.safety.
    if (existing.length > 0) {
        const previousFooterInfo = parseJSON(existing[0].footerInfo, {});
        const previousSignatures = previousFooterInfo?.config?.signatures || {};
        const newSignatures = footerInfo?.config?.signatures || {};

        const changedRoles = SKILL_MATRIX_SIGNATURE_ROLES.filter(
            (role) => (previousSignatures[role] || "") !== (newSignatures[role] || "")
        );

        if (changedRoles.length > 0) {
            const [sourceDepartment, sourceSection] = await Promise.all([
                Department.findById(normDept),
                normSection ? Section.findById(normSection) : Promise.resolve(null)
            ]);

            for (const role of changedRoles) {
                const { allowed, reason } = canActOnSkillMatrix(req.user, sourceDepartment, sourceSection, role);
                if (!allowed) {
                    throw new ApiError(reason, 403);
                }
            }
        }
    }

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
            const activeConfig = await CourseLevelConfig.getActiveConfig();
            const activeLevels = activeConfig ? activeConfig.levels : [];

            // Fetch machineId -> subSectionId mapping
            const [mRows] = await executeQuery("SELECT id, subSectionId FROM [machines]");
            const machineSubSectionMap = {};
            mRows.forEach(m => {
                if (m.subSectionId != null) {
                    machineSubSectionMap[String(m.id)] = String(m.subSectionId);
                }
            });

            for (const entry of entries) {
                if (entry.userId) { // Skip manual
                    // 1. Fetch User Data and Current Assignments
                    const [uRows] = await executeQuery(
                        "SELECT currentLevel, currentSkill, stationId, subSectionId, targetSubSectionId FROM users WHERE id = ?",
                        [entry.userId]
                    );

                    if (uRows.length > 0) {
                        const userData = uRows[0];
                        let currentSkillMap = parseJSON(userData.currentSkill, {});

                        let maxWeight = 1;
                        let skillMapChanged = false;
                        const subSectionMaxLevels = {};

                        if (entry.stations && Array.isArray(entry.stations)) {
                            entry.stations.forEach(s => {
                                // Skip stations with no real level assigned yet. handleSave on the
                                // frontend submits the ENTIRE visible matrix (every row currently on
                                // screen), not just the row the admin actually edited. Defaulting an
                                // empty/unset curr to "L-1" here used to certify every other user in
                                // the batch at Level 1 and overwrite their currentLevel/currentSkill,
                                // even though nobody touched their data.
                                if (!s.curr || s.curr === '-' || s.curr === 'L-0') return;

                                const levelStr = s.curr;
                                const stationIdStr = String(s.machineId || "");
                                const subSectionIdStr = machineSubSectionMap[stationIdStr];
                                const weight = getLevelWeight(levelStr, activeLevels);

                                // A. Track Max Weight from THIS matrix for potential upgrade
                                if (weight > maxWeight) maxWeight = weight;

                                // B. Aggregate the max level per sub-section from THIS matrix
                                if (subSectionIdStr) {
                                    const currentMax = subSectionMaxLevels[subSectionIdStr];
                                    if (!currentMax || weight > getLevelWeight(currentMax, activeLevels)) {
                                        subSectionMaxLevels[subSectionIdStr] = levelStr;
                                    }
                                }
                            });
                        }

                        // Sync SubSection-Specific Proficiency map with the aggregated per-subsection max
                        for (const [subSecId, maxLevel] of Object.entries(subSectionMaxLevels)) {
                            if (currentSkillMap[subSecId] !== maxLevel) {
                                currentSkillMap[subSecId] = maxLevel;
                                skillMapChanged = true;
                            }
                        }

                        // Determine New Global Level
                        const currentGlobal = userData.currentLevel || "L1";
                        const currentGlobalWeight = getLevelWeight(currentGlobal, activeLevels);
                        const activeSubSecId = userData.subSectionId || userData.targetSubSectionId;

                        let newGlobalLevel;
                        if (activeSubSecId) {
                            // Rule A: currentLevel must always match the operator's active sub-section,
                            // so it can be corrected (including downgraded) to stay in sync.
                            newGlobalLevel = currentSkillMap[String(activeSubSecId)] || currentGlobal;
                        } else {
                            // Rule B: no active sub-section (e.g. mentors/trainers) — fall back to the
                            // max across this matrix and their existing level, never downgrading.
                            const finalMaxWeight = Math.max(maxWeight, currentGlobalWeight);
                            newGlobalLevel = `L${finalMaxWeight}`;
                        }

                        const newGlobalWeight = getLevelWeight(newGlobalLevel, activeLevels);

                        if (skillMapChanged || newGlobalLevel !== currentGlobal) {
                            console.log(`[SkillMatrix] Syncing User ${entry.userId}: Level ${currentGlobal}->${newGlobalLevel}, MapChanged: ${skillMapChanged}`);

                            await executeQuery(
                                "UPDATE users SET currentLevel = ?, currentSkill = ?, updatedAt = GETDATE() WHERE id = ?",
                                [newGlobalLevel, JSON.stringify(currentSkillMap), entry.userId]
                            );

                            // Trigger Handover if upgraded
                            if (newGlobalWeight > currentGlobalWeight && newGlobalWeight > 1) {
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
            u.currentEffeciency,
            COALESCE(u.isTemporary, 0) as isTemporary
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
        LEFT JOIN skill_matrix_evaluations sme ON u.id = sme.studentId AND sme.isActive = 1
        WHERE (u.isDeleted = 0 OR u.isDeleted IS NULL)
          AND u.role IN ('STUDENT', 'CUSTOM')
          AND (u.status IS NULL OR u.status != 'LEFT')
          AND (u.isTemporary = 0 OR u.isTemporary IS NULL)
          AND (u.designation IS NULL OR u.designation = '' OR u.isTemporary = 1 OR u.designation NOT IN (SELECT designation FROM designation_shutters))
    `;

    const [rows] = await executeQuery(sql);

    res.status(200).json(
        new ApiResponse(200, rows, "Skill matrix efficiency summary fetched successfully")
    );
});

/**
 * Get Skill Matrix Certificate Evaluation for a student (active sheet)
 */
const getSkillMatrixEvaluation = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const evaluation = await SkillMatrixEvaluation.findActiveByStudentId(studentId);

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
 * Get all evaluation sheets for a student
 */
const getEvaluationSheets = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sheets = await SkillMatrixEvaluation.findAllByStudentId(studentId);
    
    const parsedSheets = sheets.map(s => {
        s.headerData = parseJSON(s.headerData);
        s.docData = parseJSON(s.docData);
        s.evalData = parseJSON(s.evalData);
        return s;
    });

    res.status(200).json(
        new ApiResponse(200, parsedSheets, "Evaluation sheets fetched successfully")
    );
});

/**
 * Get a specific evaluation sheet by ID
 */
const getEvaluationSheet = asyncHandler(async (req, res) => {
    const { sheetId } = req.params;
    const sheet = await SkillMatrixEvaluation.findById(sheetId);
    if (!sheet) {
        throw new ApiError(404, "Evaluation sheet not found");
    }
    sheet.headerData = parseJSON(sheet.headerData);
    sheet.docData = parseJSON(sheet.docData);
    sheet.evalData = parseJSON(sheet.evalData);

    res.status(200).json(
        new ApiResponse(200, sheet, "Evaluation sheet fetched successfully")
    );
});

/**
 * Create a new evaluation sheet for a student
 */
const createEvaluationSheet = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const { departmentId } = req.body;
    
    // Set all existing sheets for this student to isActive = 0
    await executeQuery(
        "UPDATE skill_matrix_evaluations SET isActive = 0 WHERE studentId = ?",
        [studentId]
    );

    // Get the next sheetIndex
    const [indexRows] = await executeQuery(
        "SELECT MAX(sheetIndex) as maxIndex FROM skill_matrix_evaluations WHERE studentId = ?",
        [studentId]
    );
    const nextIndex = (indexRows[0]?.maxIndex || 0) + 1;

    // Prefill from previous sheet if it exists
    const [prevActive] = await executeQuery(
        "SELECT TOP 1 headerData, docData FROM skill_matrix_evaluations WHERE studentId = ? ORDER BY sheetIndex DESC",
        [studentId]
    );
    
    let headerData = {};
    let docData = {};
    if (prevActive && prevActive.length > 0) {
        headerData = parseJSON(prevActive[0].headerData) || {};
        docData = parseJSON(prevActive[0].docData) || {};
    }

    // Set evaluation date
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    headerData.dateOfEvaluation = `${dd} - ${mm} - ${yyyy}`;

    const newPeriod = getPeriodFromDate();

    // Create the new active sheet
    const newSheet = await SkillMatrixEvaluation.upsert({
        studentId,
        departmentId: departmentId || 'GLOBAL',
        headerData,
        docData,
        evalData: {},
        opinion: "",
        updatedBy: req.user.id,
        sheetIndex: nextIndex,
        period: newPeriod,
        isActive: 1,
        earnedLevel: "L0",
        efficiency: 0
    });

    res.status(201).json(
        new ApiResponse(201, newSheet, "New evaluation sheet created successfully")
    );
});

/**
 * Save evaluation sheet by ID (updating calculations and syncing user details if active)
 */
const saveEvaluationSheet = asyncHandler(async (req, res) => {
    const { sheetId } = req.params;
    const { departmentId, subSectionId, headerData, docData, evalData, opinion, sendEmail, period } = req.body;

    const existingSheet = await SkillMatrixEvaluation.findById(sheetId);
    if (!existingSheet) {
        throw new ApiError(404, "Evaluation sheet not found");
    }

    const studentId = existingSheet.studentId;

    // Compute level config context
    const activeConfig = await CourseLevelConfig.getActiveConfig();
    const certConfig = await SkillMatrixConfig.findByDepartmentId(departmentId || 'GLOBAL');
    const skillCertConfig = certConfig?.config || DEFAULT_SKILL_CONFIG;

    // Resolve the student's current level/skill once, up-front, so we can determine
    // which level section is "unlocked" and never trust the client for this decision.
    const [uRows] = await executeQuery(
        "SELECT currentLevel, currentSkill, subSectionId, targetSubSectionId FROM users WHERE id = ?", [studentId]
    );
    const userData = uRows[0] || null;
    const currentGlobal = userData?.currentLevel || 'L0';
    let skillMap = parseJSON(userData?.currentSkill, {});

    const normalizeId = (id) => {
        if (!id || id === 'undefined' || id === 'null' || id === '') return null;
        return id;
    };
    const targetSubSecId = normalizeId(subSectionId) || normalizeId(userData?.subSectionId) || normalizeId(userData?.targetSubSectionId);
    const subSecKeyForLevel = targetSubSecId ? String(targetSubSecId) : null;

    const resolvedLevelName = (subSecKeyForLevel && skillMap[subSecKeyForLevel]) || currentGlobal || 'L1';
    const currentLevelIdx = (() => {
        const idx = (activeConfig.levels || []).findIndex(
            l => l.name?.toUpperCase() === String(resolvedLevelName).toUpperCase()
        );
        return idx >= 0 ? idx : 0;
    })();

    // Levels are unlocked for editing, so a trainer may fill out any level's section
    // (not just the student's current one) and save it as a draft or towards an upgrade.
    const incomingEvalData = parseJSON(evalData, {});
    const existingEvalData = parseJSON(existingSheet.evalData, {});
    const mergedEvalData = { ...existingEvalData, ...incomingEvalData };

    const calculatedEfficiency = calculateUserEfficiency(mergedEvalData);

    // Earned level = the highest-order level whose section is fully OK, awarded as that
    // level's own name. This lets a student skip straight to L3 if the L3 section is
    // complete, even if L1/L2 were never (or not yet) filled in.
    let earnedLevelName = 'L0';
    const levelIndices = Object.keys(skillCertConfig.levels || {})
        .map(Number)
        .sort((a, b) => b - a); // highest order first

    for (const sIdx of levelIndices) {
        if (isLevelFullyOK(mergedEvalData, skillCertConfig, sIdx)) {
            const lvlObj = activeConfig.levels.find(l => l.order === sIdx);
            if (lvlObj) {
                earnedLevelName = lvlObj.name;
                break;
            }
        }
    }

    const updatedBy = req.user.id;
    const evaluation = await SkillMatrixEvaluation.upsert({
        id: sheetId,
        studentId,
        departmentId,
        headerData,
        docData,
        evalData: mergedEvalData,
        opinion,
        updatedBy,
        sheetIndex: existingSheet.sheetIndex,
        period: period || existingSheet.period || getPeriodFromDate(),
        isActive: existingSheet.isActive ? 1 : 0,
        earnedLevel: earnedLevelName,
        efficiency: calculatedEfficiency
    });

    let levelUpgraded = false;
    let newLevel = null;

    const hasEvalData = Object.keys(mergedEvalData).length > 0;

    // Only update student stats and sync matrix if this sheet is active AND has evaluated data.
    // Saving an empty active sheet must not overwrite the operator's current efficiency/level.
    if (existingSheet.isActive && hasEvalData) {
        try {
            const syncResult = await syncStudentSkillProgress({
                studentId,
                subSectionId,
                calculatedEfficiency,
                earnedLevelName,
                activeConfig
            });
            levelUpgraded = syncResult.levelUpgraded;
            newLevel = syncResult.newLevel;
        } catch (err) {
            console.error("[SkillMatrixEvaluation] Failed to sync operator skill progress:", err);
        }
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

/**
 * Save Skill Matrix Certificate Evaluation (Active sheet backward compatibility)
 */
const saveSkillMatrixEvaluation = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    
    // Find active sheet or create one
    let activeSheet = await SkillMatrixEvaluation.findActiveByStudentId(studentId);
    if (!activeSheet) {
        activeSheet = await SkillMatrixEvaluation.upsert({
            studentId,
            departmentId: req.body.departmentId || 'GLOBAL',
            headerData: req.body.headerData || {},
            docData: req.body.docData || {},
            evalData: req.body.evalData || {},
            opinion: req.body.opinion || "",
            updatedBy: req.user.id,
            sheetIndex: 1,
            period: getPeriodFromDate(),
            isActive: 1
        });
    }
    
    // Delegate to saveEvaluationSheet
    req.params.sheetId = activeSheet.id;
    return saveEvaluationSheet(req, res);
});

/**
 * List all evaluation sheets across all operators (admin monitoring view)
 */
const listAllEvaluationSheets = asyncHandler(async (req, res) => {
    const { departmentId, sectionId, lineId, subSectionId, search } = req.query;
    const rows = await SkillMatrixEvaluation.listAll({ departmentId, sectionId, lineId, subSectionId, search });
    res.status(200).json(new ApiResponse(200, rows, "Evaluation sheets fetched successfully"));
});

/**
 * Delete an evaluation sheet by ID.
 * If it was the active sheet, promotes the next most recent sheet to active
 * and syncs the operator's currentLevel and currentEfficiency accordingly.
 */
const deleteEvaluationSheet = asyncHandler(async (req, res) => {
    const { sheetId } = req.params;

    const result = await SkillMatrixEvaluation.delete(sheetId);
    if (!result) {
        throw new ApiError(404, "Evaluation sheet not found");
    }

    const { studentId, wasActive, nextActiveSheet } = result;

    if (wasActive) {
        if (nextActiveSheet) {
            // Sync operator stats from the newly promoted active sheet
            const efficiency = nextActiveSheet.efficiency ?? 0;
            const earnedLevel = nextActiveSheet.earnedLevel || null;

            const [uRows] = await executeQuery(
                "SELECT subSectionId, targetSubSectionId, skillEffeciency, currentSkill FROM users WHERE id = ?",
                [studentId]
            );
            if (uRows.length > 0) {
                const userData = uRows[0];
                let skillEffMap = userData.skillEffeciency || {};
                if (typeof skillEffMap === 'string') {
                    try { skillEffMap = JSON.parse(skillEffMap); } catch (e) { skillEffMap = {}; }
                }

                const subSecId = String(userData.subSectionId || userData.targetSubSectionId || "");
                if (subSecId) skillEffMap[subSecId] = efficiency;

                await executeQuery(
                    "UPDATE users SET currentEffeciency = ?, skillEffeciency = ?, updatedAt = GETDATE() WHERE id = ?",
                    [efficiency, JSON.stringify(skillEffMap), studentId]
                );

                if (earnedLevel) {
                    // Mirror the reverted level into currentSkill for the active sub-section too,
                    // otherwise currentLevel and currentSkill drift apart again (the same bug this
                    // sync is meant to prevent).
                    const currentSkillMap = parseJSON(userData.currentSkill, {});
                    if (subSecId) currentSkillMap[subSecId] = earnedLevel;

                    await executeQuery(
                        "UPDATE users SET currentLevel = ?, currentSkill = ?, updatedAt = GETDATE() WHERE id = ?",
                        [earnedLevel, JSON.stringify(currentSkillMap), studentId]
                    );
                }
            }
        } else {
            // No remaining sheets — reset efficiency only, never downgrade level
            await executeQuery(
                "UPDATE users SET currentEffeciency = 0, updatedAt = GETDATE() WHERE id = ?",
                [studentId]
            );
        }
    }

    res.status(200).json(new ApiResponse(200, { studentId, wasActive, nextActiveSheet }, "Evaluation sheet deleted successfully"));
});

/**
 * Delete a Skill Matrix sheet by ID
 */
const deleteSkillMatrix = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const [existing] = await executeQuery("SELECT id FROM skill_matrices WHERE id = ?", [id]);
    if (existing.length === 0) {
        throw new ApiError(404, "Skill Matrix sheet not found");
    }

    await executeQuery("DELETE FROM skill_matrices WHERE id = ?", [id]);

    res.status(200).json(new ApiResponse(200, { id }, "Skill Matrix sheet deleted successfully"));
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

export {
    saveSkillMatrix,
    getSkillMatrix,
    listSkillMatrices,
    deleteSkillMatrix,
    getSkillMatrixConfig,
    saveSkillMatrixConfig,
    getSkillMatrixCertHistory,
    getSkillMatrixEvaluation,
    saveSkillMatrixEvaluation,
    getEvaluationSheets,
    getEvaluationSheet,
    createEvaluationSheet,
    saveEvaluationSheet,
    listAllEvaluationSheets,
    deleteEvaluationSheet,
    getSkillMatrixEfficiencyStats,
    getSkillMatrixEfficiencySummary,
    getSkillMatrixDashboardConfig,
    saveSkillMatrixDashboardConfig,
    getSkillMatrixDashboardHistory
};

