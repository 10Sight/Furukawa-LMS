import { poolPromise } from "../server/db/connectDB.js";
import { executeQuery } from "../server/db/mssqlHelper.js";

async function runCheck() {
    try {
        console.log("Connecting...");
        await poolPromise;

        console.log("--- Checking status distribution for all users with exclusions ---");
        const [rows] = await executeQuery(`
            SELECT ISNULL(status, 'NULL/Empty') AS user_status, COUNT(*) AS cnt
            FROM users
            WHERE isDeleted = 0 
              AND isTemporary = 0
              AND ISNULL(designation, '') NOT IN (
                  '1076',
                  '1077',
                  '1081',
                  'DRIVER',
                  'Supervisor',
                  'Staff'
              )
            GROUP BY status
        `);
        console.log(JSON.stringify(rows, null, 2));

        console.log("\n--- Checking if there are any duplicate empId entries for active status ---");
        const [dups] = await executeQuery(`
            SELECT empId, COUNT(*) as cnt
            FROM users
            WHERE isDeleted = 0 
              AND isTemporary = 0
              AND ISNULL(designation, '') NOT IN ('1076', '1077', '1081', 'DRIVER', 'Supervisor', 'Staff')
            GROUP BY empId
            HAVING COUNT(*) > 1
        `);
        console.log("Duplicates:", JSON.stringify(dups, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

runCheck();
