import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";
import { formatLocalDate } from "../utils/istDate.util.js";

// Tracks manual admin overrides of Handover Sheet eligibility, kept entirely separate from
// evaluation_test_attempts/attempted_quizzes so overrides never masquerade as genuine test passes.
//
// forDate = NULL   -> blanket override, eligible for any Handover Sheet date.
// forDate = a date -> only eligible for a sheet built on that exact date (fixes the case where a
//                     trainee's real passedDate is NULL/after the sheet date and can't be fixed by
//                     re-running the eligibility check; an admin explicitly approves that one date).
class HandoverEligibilityOverride {
    constructor(data) {
        this.id = data.id;
        this.studentId = data.studentId;
        this.departmentId = data.departmentId;
        this.isActive = !!data.isActive;
        this.forDate = data.forDate instanceof Date ? formatLocalDate(data.forDate) : (data.forDate || null);
        this.reason = data.reason;
        this.overriddenBy = data.overriddenBy;
        this.overriddenByName = data.overriddenByName;
        this.createdAt = data.createdAt;
        this.revokedBy = data.revokedBy;
        this.revokedByName = data.revokedByName;
        this.revokedAt = data.revokedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='handover_eligibility_overrides' AND xtype='U')
            BEGIN
                CREATE TABLE handover_eligibility_overrides (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    studentId INT NOT NULL,
                    departmentId INT NOT NULL,
                    isActive BIT DEFAULT 1,
                    forDate DATE NULL,
                    reason NVARCHAR(500) NULL,
                    overriddenBy INT NULL,
                    overriddenByName NVARCHAR(255) NULL,
                    createdAt DATETIME DEFAULT GETDATE(),
                    revokedBy INT NULL,
                    revokedByName NVARCHAR(255) NULL,
                    revokedAt DATETIME NULL
                )
                CREATE UNIQUE INDEX idx_active_handover_override
                    ON handover_eligibility_overrides(studentId, departmentId, forDate)
                    WHERE isActive = 1
            END
        `;
        try {
            await executeQuery(query);
            logger.info("MSSQL handover_eligibility_overrides table initialized successfully.");

            await migrationHelper.ensureColumnExists("handover_eligibility_overrides", "forDate", "DATE NULL");

            // Older deployments may still have the pre-forDate 2-column filtered unique index;
            // replace it so a blanket override and per-date overrides can coexist without clashing.
            const [idxRows] = await executeQuery(`
                SELECT i.name, COUNT(*) as colCount
                FROM sys.indexes i
                JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
                WHERE i.object_id = OBJECT_ID('handover_eligibility_overrides') AND i.name = 'idx_active_handover_override'
                GROUP BY i.name
            `);
            if (idxRows.length > 0 && idxRows[0].colCount < 3) {
                await executeQuery("DROP INDEX idx_active_handover_override ON handover_eligibility_overrides");
                await executeQuery(`
                    CREATE UNIQUE INDEX idx_active_handover_override
                        ON handover_eligibility_overrides(studentId, departmentId, forDate)
                        WHERE isActive = 1
                `);
                logger.info("Migrated idx_active_handover_override to include forDate.");
            }
        } catch (error) {
            logger.error("Failed to initialize handover_eligibility_overrides table", error);
            throw error;
        }
    }

    // Exact match: forDate = null finds the blanket override; a date finds that date's override.
    static async findActive(studentId, departmentId, forDate = null) {
        const [rows] = forDate
            ? await executeQuery(
                "SELECT TOP 1 * FROM handover_eligibility_overrides WHERE studentId = ? AND departmentId = ? AND forDate = ? AND isActive = 1",
                [studentId, departmentId, forDate]
            )
            : await executeQuery(
                "SELECT TOP 1 * FROM handover_eligibility_overrides WHERE studentId = ? AND departmentId = ? AND forDate IS NULL AND isActive = 1",
                [studentId, departmentId]
            );
        return rows.length > 0 ? new HandoverEligibilityOverride(rows[0]) : null;
    }

    // All active overrides (blanket + every date-scoped one) for a student/department, for diagnostics display.
    static async findAllActive(studentId, departmentId) {
        const [rows] = await executeQuery(
            "SELECT * FROM handover_eligibility_overrides WHERE studentId = ? AND departmentId = ? AND isActive = 1 ORDER BY createdAt DESC",
            [studentId, departmentId]
        );
        return rows.map((r) => new HandoverEligibilityOverride(r));
    }

    // Active overrides applicable to a specific department + sheet date (blanket or exact date match),
    // joined to users, for getHandoverSheet's eligibleUsers computation.
    static async findActiveForSheet(departmentId, date) {
        const [rows] = await executeQuery(`
            SELECT
                o.id as overrideId, o.studentId, o.forDate, o.reason,
                u.fullName as employeeName, u.userName as employeeCode,
                u.targetDeptId, u.targetSectionId as sectionId, u.targetLineId as lineId,
                u.targetSubSectionId as subSectionId, u.targetStationId as stationId,
                l.name as lineName, st.name as stationName
            FROM handover_eligibility_overrides o
            JOIN users u ON o.studentId = u.id
            LEFT JOIN [lines] l ON u.targetLineId = l.id
            LEFT JOIN machines st ON u.targetStationId = st.id
            WHERE o.departmentId = ?
              AND o.isActive = 1
              AND (o.forDate IS NULL OR CAST(o.forDate AS DATE) = CAST(? AS DATE))
              AND u.isTemporary = 1
              AND u.targetDeptId = ?
        `, [departmentId, date, departmentId]);
        return rows;
    }

    // Idempotent: returns the existing active override for the same (studentId, departmentId, forDate)
    // instead of inserting a duplicate.
    static async create({ studentId, departmentId, forDate = null, reason, overriddenBy, overriddenByName }) {
        const existing = await this.findActive(studentId, departmentId, forDate);
        if (existing) return existing;

        const [rows] = await executeQuery(
            `INSERT INTO handover_eligibility_overrides (studentId, departmentId, forDate, reason, overriddenBy, overriddenByName)
             OUTPUT INSERTED.*
             VALUES (?, ?, ?, ?, ?, ?)`,
            [studentId, departmentId, forDate || null, reason || null, overriddenBy || null, overriddenByName || null]
        );
        return new HandoverEligibilityOverride(rows[0]);
    }

    static async revoke(studentId, departmentId, forDate, revokedBy, revokedByName) {
        const [rows] = forDate
            ? await executeQuery(
                `UPDATE handover_eligibility_overrides
                 SET isActive = 0, revokedBy = ?, revokedByName = ?, revokedAt = GETDATE()
                 OUTPUT INSERTED.*
                 WHERE studentId = ? AND departmentId = ? AND forDate = ? AND isActive = 1`,
                [revokedBy || null, revokedByName || null, studentId, departmentId, forDate]
            )
            : await executeQuery(
                `UPDATE handover_eligibility_overrides
                 SET isActive = 0, revokedBy = ?, revokedByName = ?, revokedAt = GETDATE()
                 OUTPUT INSERTED.*
                 WHERE studentId = ? AND departmentId = ? AND forDate IS NULL AND isActive = 1`,
                [revokedBy || null, revokedByName || null, studentId, departmentId]
            );
        return rows.length > 0 ? new HandoverEligibilityOverride(rows[0]) : null;
    }
}

HandoverEligibilityOverride.init().catch((err) => logger.error("Failed to initialize handover_eligibility_overrides table:", err));

export default HandoverEligibilityOverride;
