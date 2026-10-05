import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";
import {
    calculateUserEfficiency, 
    computeEarnedLevel, 
    getPeriodFromDate, 
    DEFAULT_SKILL_CONFIG 
} from "../utils/skillMatrix.util.js";

class SkillMatrixEvaluation {
    constructor(data) {
        this.id = data.id;
        this.studentId = data.studentId;
        this.departmentId = data.departmentId;
        this.headerData = typeof data.headerData === 'string' ? JSON.parse(data.headerData) : (data.headerData || {});
        this.docData = typeof data.docData === 'string' ? JSON.parse(data.docData) : (data.docData || {});
        this.evalData = typeof data.evalData === 'string' ? JSON.parse(data.evalData) : (data.evalData || {});
        this.opinion = data.opinion || "";
        this.updatedBy = data.updatedBy;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
        
        // New columns
        this.sheetIndex = data.sheetIndex !== undefined ? data.sheetIndex : 1;
        this.period = data.period || "";
        this.isActive = data.isActive === true || data.isActive === 1 || data.isActive === '1';
        this.earnedLevel = data.earnedLevel || null;
        this.efficiency = data.efficiency !== undefined && data.efficiency !== null ? parseFloat(data.efficiency) : 0;
    }

    static async init() {
        try {
            if (!await migrationHelper.tableExists('skill_matrix_evaluations')) {
                await executeQuery(`
                    CREATE TABLE skill_matrix_evaluations (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        studentId INT NOT NULL,
                        departmentId VARCHAR(255),
                        headerData NVARCHAR(MAX),
                        docData NVARCHAR(MAX),
                        evalData NVARCHAR(MAX),
                        opinion NVARCHAR(MAX),
                        updatedBy INT,
                        createdAt DATETIME DEFAULT GETDATE(),
                        updatedAt DATETIME DEFAULT GETDATE(),
                        CONSTRAINT uq_sm_eval_student UNIQUE (studentId)
                    )
                `);
            }

            // Schema updates
            // 1. Drop unique constraint on studentId so multiple sheets can exist per user
            await executeQuery(`
                IF EXISTS (SELECT * FROM sys.objects WHERE type = 'UQ' AND name = 'uq_sm_eval_student')
                BEGIN
                    ALTER TABLE skill_matrix_evaluations DROP CONSTRAINT uq_sm_eval_student;
                END
            `);

            // 2. Add sheetIndex, period, isActive, earnedLevel, efficiency columns if missing
            await migrationHelper.ensureColumnExists('skill_matrix_evaluations', 'sheetIndex', 'INT');
            await migrationHelper.ensureColumnExists('skill_matrix_evaluations', 'period', 'VARCHAR(50)');
            await migrationHelper.ensureColumnExists('skill_matrix_evaluations', 'isActive', 'BIT');
            await migrationHelper.ensureColumnExists('skill_matrix_evaluations', 'earnedLevel', 'VARCHAR(50)');
            await migrationHelper.ensureColumnExists('skill_matrix_evaluations', 'efficiency', 'FLOAT');
            // Widen existing efficiency column to FLOAT so values >100 can be stored
            await executeQuery(`
                IF COL_LENGTH('skill_matrix_evaluations', 'efficiency') IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM sys.columns c
                    JOIN sys.types t ON c.user_type_id = t.user_type_id
                    WHERE c.object_id = OBJECT_ID('skill_matrix_evaluations')
                    AND c.name = 'efficiency'
                    AND t.name IN ('decimal', 'numeric')
                )
                BEGIN
                    ALTER TABLE skill_matrix_evaluations ALTER COLUMN efficiency FLOAT;
                END
            `);

            // Speeds up the "latest active sheet per student" lookup (getAllUsers'
            // includeEvaluationInfo OUTER APPLY, findActiveByStudentId) from a full scan to
            // an index seek: (studentId, isActive) covers the WHERE, INCLUDE covers the SELECT.
            await migrationHelper.ensureIndexExists(
                'skill_matrix_evaluations',
                'idx_sme_student_active',
                `CREATE NONCLUSTERED INDEX idx_sme_student_active
                 ON skill_matrix_evaluations (studentId, isActive)
                 INCLUDE (sheetIndex, period, earnedLevel, efficiency, updatedAt)`
            );

            // Run automated migration for legacy single-sheet records
            await this.migrateExisting();

        } catch (error) {
            logger.error("Failed to initialize SkillMatrixEvaluation schema", error);
        }
    }

    static async migrateExisting() {
        try {
            // Find all records that haven't been migrated (where sheetIndex is null)
            const [rows] = await executeQuery("SELECT id, createdAt, evalData, departmentId FROM skill_matrix_evaluations WHERE sheetIndex IS NULL");
            if (rows && rows.length > 0) {
                logger.info(`Migrating ${rows.length} existing skill matrix evaluation records...`);
                
                // Get active levels config to calculate earned levels
                const [levelConfigs] = await executeQuery("SELECT TOP 1 levels FROM course_level_configs WHERE isActive = 1");
                let activeConfigLevels = [];
                if (levelConfigs && levelConfigs.length > 0) {
                    try {
                        const parsed = JSON.parse(levelConfigs[0].levels);
                        activeConfigLevels = parsed || [];
                    } catch (e) {
                        logger.error("Failed to parse course level config in migration", e);
                    }
                }

                for (const row of rows) {
                    let evalData = {};
                    try {
                        evalData = typeof row.evalData === 'string' ? JSON.parse(row.evalData) : (row.evalData || {});
                    } catch (e) {
                        evalData = {};
                    }

                    const efficiency = calculateUserEfficiency(evalData);
                    
                    // Fetch department config for levels mapping
                    const deptId = row.departmentId || 'GLOBAL';
                    const [deptConfigs] = await executeQuery("SELECT config FROM skill_matrix_certificate_configs WHERE departmentId = ?", [deptId]);
                    let skillCertConfig = DEFAULT_SKILL_CONFIG;
                    if (deptConfigs && deptConfigs.length > 0) {
                        try {
                            skillCertConfig = JSON.parse(deptConfigs[0].config);
                        } catch (e) {}
                    }

                    const earnedLevel = computeEarnedLevel(evalData, skillCertConfig, activeConfigLevels) || 'L0';
                    const createdAt = row.createdAt || new Date();
                    const period = getPeriodFromDate(createdAt);

                    await executeQuery(
                        `UPDATE skill_matrix_evaluations SET 
                         sheetIndex = 1, isActive = 1, period = ?, earnedLevel = ?, efficiency = ? 
                         WHERE id = ?`,
                        [period, earnedLevel, efficiency, row.id]
                    );
                }
                logger.info("Skill matrix evaluation records migration complete!");
            }
        } catch (error) {
            logger.error("Failed to migrate existing SkillMatrixEvaluation data", error);
        }
    }

    static async findByStudentId(studentId) {
        // Deprecated but kept for backward compatibility -> routes to active sheet
        return this.findActiveByStudentId(studentId);
    }

    static async findActiveByStudentId(studentId) {
        const [rows] = await executeQuery("SELECT * FROM skill_matrix_evaluations WHERE studentId = ? AND isActive = 1", [studentId]);
        if (rows.length === 0) return null;
        return new SkillMatrixEvaluation(rows[0]);
    }

    static async findAllByStudentId(studentId) {
        const [rows] = await executeQuery("SELECT * FROM skill_matrix_evaluations WHERE studentId = ? ORDER BY sheetIndex DESC, createdAt DESC", [studentId]);
        return rows.map(r => new SkillMatrixEvaluation(r));
    }

    static async findById(id) {
        const [rows] = await executeQuery("SELECT * FROM skill_matrix_evaluations WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new SkillMatrixEvaluation(rows[0]);
    }

    static async delete(id) {
        const [sheetRows] = await executeQuery(
            "SELECT studentId, isActive FROM skill_matrix_evaluations WHERE id = ?",
            [id]
        );
        if (sheetRows.length === 0) return null;

        const { studentId, isActive } = sheetRows[0];
        await executeQuery("DELETE FROM skill_matrix_evaluations WHERE id = ?", [id]);

        let nextActiveSheet = null;
        if (isActive) {
            // Promote the next most recent sheet to active
            const [remaining] = await executeQuery(
                "SELECT TOP 1 id FROM skill_matrix_evaluations WHERE studentId = ? ORDER BY sheetIndex DESC, createdAt DESC",
                [studentId]
            );
            if (remaining.length > 0) {
                const nextId = remaining[0].id;
                await executeQuery(
                    "UPDATE skill_matrix_evaluations SET isActive = 1 WHERE id = ?",
                    [nextId]
                );
                const [nextRows] = await executeQuery(
                    "SELECT * FROM skill_matrix_evaluations WHERE id = ?",
                    [nextId]
                );
                nextActiveSheet = nextRows.length > 0 ? new SkillMatrixEvaluation(nextRows[0]) : null;
            }
        }

        return { studentId, wasActive: !!isActive, nextActiveSheet };
    }

    static async listAll({ departmentId, sectionId, lineId, subSectionId, search } = {}) {
        let sql = `
            SELECT
                sme.id, sme.studentId, sme.departmentId, sme.sheetIndex, sme.period,
                sme.isActive, sme.earnedLevel, sme.efficiency, sme.createdAt, sme.updatedAt,
                sme.docData,
                u.fullName, u.empId, u.cardNo,
                d.name AS departmentName,
                sec.name AS sectionName,
                l.name AS lineName,
                ss.name AS subSectionName
            FROM skill_matrix_evaluations sme
            LEFT JOIN users u ON sme.studentId = u.id
            LEFT JOIN departments d ON (sme.departmentId = CAST(d.id AS VARCHAR(255)) OR sme.departmentId = d.name)
            LEFT JOIN sections sec ON (u.sectionId = sec.id)
            LEFT JOIN [lines] l ON (u.lineId = l.id)
            LEFT JOIN sub_sections ss ON (u.subSectionId = ss.id)
            WHERE (u.isDeleted = 0 OR u.isDeleted IS NULL)
              AND u.role IN ('STUDENT', 'CUSTOM')
        `;
        const params = [];

        if (departmentId) {
            sql += " AND (sme.departmentId = ? OR d.id = TRY_CAST(? AS INT))";
            params.push(departmentId, departmentId);
        }
        if (sectionId) {
            sql += " AND u.sectionId = ?";
            params.push(sectionId);
        }
        if (lineId) {
            sql += " AND u.lineId = ?";
            params.push(lineId);
        }
        if (subSectionId) {
            sql += " AND u.subSectionId = ?";
            params.push(subSectionId);
        }
        if (search) {
            sql += " AND (u.fullName LIKE ? OR u.empId LIKE ? OR u.cardNo LIKE ?)";
            const like = `%${search}%`;
            params.push(like, like, like);
        }

        sql += " ORDER BY sme.studentId ASC, sme.sheetIndex DESC";

        const [rows] = await executeQuery(sql, params);
        return rows;
    }

    static async upsert(data) {
        const { 
            id, 
            studentId, 
            departmentId, 
            headerData, 
            docData, 
            evalData, 
            opinion, 
            updatedBy,
            sheetIndex,
            period,
            isActive,
            earnedLevel,
            efficiency
        } = data;

        if (id) {
            // Update by specific sheet ID
            await executeQuery(
                `UPDATE skill_matrix_evaluations SET 
                 departmentId = ?, headerData = ?, docData = ?, evalData = ?, opinion = ?, updatedBy = ?, 
                 sheetIndex = ?, period = ?, isActive = ?, earnedLevel = ?, efficiency = ?, updatedAt = GETDATE() 
                 WHERE id = ?`,
                [
                    departmentId, 
                    JSON.stringify(headerData), 
                    JSON.stringify(docData), 
                    JSON.stringify(evalData), 
                    opinion, 
                    updatedBy,
                    sheetIndex || 1,
                    period || getPeriodFromDate(),
                    isActive ? 1 : 0,
                    earnedLevel,
                    efficiency,
                    id
                ]
            );
            return this.findById(id);
        } else {
            // Update active sheet or insert new if none exists
            const active = await executeQuery("SELECT id FROM skill_matrix_evaluations WHERE studentId = ? AND isActive = 1", [studentId]);
            if (active[0].length > 0) {
                const activeId = active[0][0].id;
                await executeQuery(
                    `UPDATE skill_matrix_evaluations SET 
                     departmentId = ?, headerData = ?, docData = ?, evalData = ?, opinion = ?, updatedBy = ?, 
                     sheetIndex = ?, period = ?, isActive = ?, earnedLevel = ?, efficiency = ?, updatedAt = GETDATE() 
                     WHERE id = ?`,
                    [
                        departmentId, 
                        JSON.stringify(headerData), 
                        JSON.stringify(docData), 
                        JSON.stringify(evalData), 
                        opinion, 
                        updatedBy,
                        sheetIndex || 1,
                        period || getPeriodFromDate(),
                        isActive !== undefined ? (isActive ? 1 : 0) : 1,
                        earnedLevel,
                        efficiency,
                        activeId
                    ]
                );
                return this.findById(activeId);
            } else {
                // Insert new sheet
                const [insertRows] = await executeQuery(
                    `INSERT INTO skill_matrix_evaluations (studentId, departmentId, headerData, docData, evalData, opinion, updatedBy, sheetIndex, period, isActive, earnedLevel, efficiency, createdAt, updatedAt) 
                     OUTPUT INSERTED.id
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
                    [
                        studentId, 
                        departmentId, 
                        JSON.stringify(headerData), 
                        JSON.stringify(docData), 
                        JSON.stringify(evalData), 
                        opinion, 
                        updatedBy,
                        sheetIndex || 1,
                        period || getPeriodFromDate(),
                        isActive !== undefined ? (isActive ? 1 : 0) : 1,
                        earnedLevel,
                        efficiency
                    ]
                );
                return this.findById(insertRows[0].id);
            }
        }
    }
}

export { SkillMatrixEvaluation };
export default SkillMatrixEvaluation;
