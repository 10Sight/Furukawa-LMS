import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

// Tracks which students have already been emailed about their 16-Day Monitoring
// eligibility unlocking, keyed by (studentId, handoverApprovedAt) so a future
// re-approval cycle (e.g. re-hire) naturally triggers a fresh notification.
class SixteenDayEligibilityNotification {
    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sixteen_day_eligibility_notifications' and xtype='U')
            BEGIN
                CREATE TABLE sixteen_day_eligibility_notifications (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    studentId INT NOT NULL,
                    handoverApprovedAt VARCHAR(50) NOT NULL,
                    notifiedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT fk_eligibility_notif_student FOREIGN KEY (studentId) REFERENCES users(id) ON DELETE CASCADE,
                    CONSTRAINT uq_eligibility_notif UNIQUE (studentId, handoverApprovedAt)
                )
            END
        `;
        try {
            await executeQuery(query);
        } catch (error) {
            logger.error("Failed to initialize sixteen_day_eligibility_notifications table", error);
        }
    }

    static async hasBeenNotified(studentId, handoverApprovedAt) {
        const [rows] = await executeQuery(
            "SELECT id FROM sixteen_day_eligibility_notifications WHERE studentId = ? AND handoverApprovedAt = ?",
            [studentId, handoverApprovedAt]
        );
        return rows.length > 0;
    }

    static async markNotified(studentId, handoverApprovedAt) {
        try {
            await executeQuery(
                "INSERT INTO sixteen_day_eligibility_notifications (studentId, handoverApprovedAt) VALUES (?, ?)",
                [studentId, handoverApprovedAt]
            );
        } catch (error) {
            // Unique constraint hit (concurrent tick already marked it) — safe to ignore.
            logger.warn(`[SixteenDayEligibilityNotification] markNotified skipped for student ${studentId}: ${error.message}`);
        }
    }
}

SixteenDayEligibilityNotification.init().catch(err =>
    console.error("Failed to initialize sixteen_day_eligibility_notifications table:", err)
);

export default SixteenDayEligibilityNotification;
