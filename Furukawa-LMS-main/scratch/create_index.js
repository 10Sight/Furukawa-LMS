import { executeQuery } from '../server/db/mssqlHelper.js';

async function optimize() {
    try {
        console.log("Creating index IX_Attendance_DateStatus...");
        await executeQuery(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Attendance_DateStatus' AND object_id = OBJECT_ID('attendance_logs'))
            BEGIN
                CREATE INDEX IX_Attendance_DateStatus ON attendance_logs([date], status, userId, shift)
            END
        `);
        console.log("Index created successfully.");

        process.exit(0);
    } catch (err) {
        console.error("Error creating index:", err);
        process.exit(1);
    }
}
optimize();
