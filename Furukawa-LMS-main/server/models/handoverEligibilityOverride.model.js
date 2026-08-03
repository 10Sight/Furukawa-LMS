import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

// Tracks manual admin overrides of Handover Sheet eligibility, kept entirely separate from
// evaluation_test_attempts/attempted_quizzes so overrides never masquerade as genuine test passes.
class HandoverEligibilityOverride {
    constructor(data) {
        this.id = data.id;
        this.studentId = data.studentId;
        this.departmentId = data.departmentId;
        this.isActive = !!data.isActive;
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
                    reason NVARCHAR(500) NULL,
                    overriddenBy INT NULL,
                    overriddenByName NVARCHAR(255) NULL,
                    createdAt DATETIME DEFAULT GETDATE(),
                    revokedBy INT NULL,
                    revokedByName NVARCHAR(255) NULL,
                    revokedAt DATETIME NULL
                )
                CREATE UNIQUE INDEX idx_active_handover_override
                    ON handover_eligibility_overrides(studentId, departmentId)
                    WHERE isActive = 1
            END
        `;
        try {
            await executeQuery(query);
            logger.info("MSSQL handover_eligibility_overrides table initialized successfully.");
        } catch (error) {
            logger.error("Failed to initialize handover_eligibility_overrides table", error);
            throw error;
        }
    }

    static async findActive(studentId, departmentId) {
        const [rows] = await executeQuery(
            "SELECT TOP 1 * FROM handover_eligibility_overrides WHERE studentId = ? AND departmentId = ? AND isActive = 1 ORDER BY createdAt DESC",
            [studentId, departmentId]
        );
        return rows.length > 0 ? new HandoverEligibilityOverride(rows[0]) : null;
    }

    // Idempotent: returns the existing active override instead of inserting a duplicate.
    static async create({ studentId, departmentId, reason, overriddenBy, overriddenByName }) {
        const existing = await this.findActive(studentId, departmentId);
        if (existing) return existing;

        const [rows] = await executeQuery(
            `INSERT INTO handover_eligibility_overrides (studentId, departmentId, reason, overriddenBy, overriddenByName)
             OUTPUT INSERTED.*
             VALUES (?, ?, ?, ?, ?)`,
            [studentId, departmentId, reason || null, overriddenBy || null, overriddenByName || null]
        );
        return new HandoverEligibilityOverride(rows[0]);
    }

    static async revoke(studentId, departmentId, revokedBy, revokedByName) {
        const [rows] = await executeQuery(
            `UPDATE handover_eligibility_overrides
             SET isActive = 0, revokedBy = ?, revokedByName = ?, revokedAt = GETDATE()
             OUTPUT INSERTED.*
             WHERE studentId = ? AND departmentId = ? AND isActive = 1`,
            [revokedBy || null, revokedByName || null, studentId, departmentId]
        );
        return rows.length > 0 ? new HandoverEligibilityOverride(rows[0]) : null;
    }
}

HandoverEligibilityOverride.init().catch((err) => logger.error("Failed to initialize handover_eligibility_overrides table:", err));

export default HandoverEligibilityOverride;
