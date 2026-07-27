import { poolPromise } from "../server/db/connectDB.js";
import { executeQuery } from "../server/db/mssqlHelper.js";

async function runCheck() {
    try {
        console.log("Connecting...");
        await poolPromise;

        // 1. Count using the User's exact query
        const [userQueryRows] = await executeQuery(`
            SELECT COUNT(*) AS cnt
            FROM users
            WHERE isDeleted = 0 
              AND isTemporary = 0 
              AND status = 'PRESENT'
              AND ISNULL(designation, '') NOT IN (
                  '1076',
                  '1077',
                  '1081',
                  'DRIVER',
                  'Supervisor',
                  'Staff'
              )
        `);
        console.log("User's Raw SQL count:", userQueryRows[0].cnt);

        // 2. Count using Dashboard logic
        const [dashQueryRows] = await executeQuery(`
            SELECT COUNT(*) AS cnt
            FROM users u
            WHERE ISNULL(u.isDeleted, 0) = 0
              AND ISNULL(u.isTemporary, 0) = 0
              AND u.empId IS NOT NULL
              AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
              AND NOT EXISTS (
                  SELECT 1 FROM designation_shutters ds 
                  WHERE ds.designation IS NOT NULL AND ds.designation = u.designation
              )
              AND (
                  UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ISNULL(u.status, ''))))) <> 'LEFT'
                  OR u.leavingDate IS NULL
              )
        `);
        console.log("Dashboard current active logic count:", dashQueryRows[0].cnt);

        // 3. Find why there is a difference
        console.log("\n--- Checking status distribution for active/non-LEFT users ---");
        const [statusRows] = await executeQuery(`
            SELECT ISNULL(status, 'NULL/Empty') AS user_status, COUNT(*) AS cnt
            FROM users u
            WHERE ISNULL(u.isDeleted, 0) = 0
              AND ISNULL(u.isTemporary, 0) = 0
              AND u.empId IS NOT NULL
              AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
              AND NOT EXISTS (
                  SELECT 1 FROM designation_shutters ds 
                  WHERE ds.designation IS NOT NULL AND ds.designation = u.designation
              )
            GROUP BY status
        `);
        console.log(JSON.stringify(statusRows, null, 2));

        console.log("\n--- Checking designation shutters names in DB ---");
        const [shutterRows] = await executeQuery(`SELECT designation FROM designation_shutters`);
        console.log("Designations in designation_shutters:", shutterRows.map(r => r.designation));

        console.log("\n--- Checking if there are active users with designations not in designation_shutters but in user's manual list ---");
        const [manualExclusionCheck] = await executeQuery(`
            SELECT designation, COUNT(*) as cnt
            FROM users u
            WHERE ISNULL(u.isDeleted, 0) = 0
              AND ISNULL(u.isTemporary, 0) = 0
              AND designation IN ('1076', '1077', '1081', 'DRIVER', 'Supervisor', 'Staff')
              AND NOT EXISTS (
                  SELECT 1 FROM designation_shutters ds 
                  WHERE ds.designation IS NOT NULL AND ds.designation = u.designation
              )
            GROUP BY designation
        `);
        console.log(JSON.stringify(manualExclusionCheck, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

runCheck();
