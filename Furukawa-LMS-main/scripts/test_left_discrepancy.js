import { poolPromise } from "../server/db/connectDB.js";
import { executeQuery } from "../server/db/mssqlHelper.js";

const userDateToDateSql = (columnSql) => `
    COALESCE(
        TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 23),
        TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 103),
        TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 105),
        TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 120),
        TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 121),
        TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 101),
        TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 110),
        TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 106),
        TRY_CONVERT(DATE, NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${columnSql}))), ''), 'NULL'), 107)
    )
`;

async function runCheck() {
    try {
        console.log("Connecting...");
        await poolPromise;

        const reportDateStr = '2026-07-25';
        const joiningDateSql = userDateToDateSql("joiningDate");
        const leavingDateSql = userDateToDateSql("leavingDate");

        console.log("--- Analyzing LEFT employees ---");
        
        // 1. Total LEFT employees
        const [totalLeft] = await executeQuery(`
            SELECT COUNT(*) as cnt FROM users 
            WHERE isDeleted = 0 AND isTemporary = 0 AND status = 'LEFT'
              AND ISNULL(designation, '') NOT IN ('1076', '1077', '1081', 'DRIVER', 'Supervisor', 'Staff')
        `);
        console.log("Total LEFT employees (excl. designations):", totalLeft[0].cnt);

        // 2. LEFT employees with leavingDate IS NULL
        const [leftNullLeaving] = await executeQuery(`
            SELECT COUNT(*) as cnt FROM users u
            WHERE isDeleted = 0 AND isTemporary = 0 AND status = 'LEFT'
              AND ISNULL(designation, '') NOT IN ('1076', '1077', '1081', 'DRIVER', 'Supervisor', 'Staff')
              AND ${leavingDateSql} IS NULL
        `);
        console.log("LEFT employees with leavingDate IS NULL:", leftNullLeaving[0].cnt);

        // 3. LEFT employees with leavingDate in the future (after reportDate)
        const [leftFutureLeaving] = await executeQuery(`
            SELECT COUNT(*) as cnt FROM users u
            WHERE isDeleted = 0 AND isTemporary = 0 AND status = 'LEFT'
              AND ISNULL(designation, '') NOT IN ('1076', '1077', '1081', 'DRIVER', 'Supervisor', 'Staff')
              AND ${leavingDateSql} > CONVERT(DATE, ?, 23)
        `, [reportDateStr]);
        console.log("LEFT employees with leavingDate in the future:", leftFutureLeaving[0].cnt);

        console.log("\n--- Analyzing PRESENT employees ---");

        // 4. PRESENT employees with future joining date
        const [presentFutureJoining] = await executeQuery(`
            SELECT COUNT(*) as cnt FROM users u
            WHERE isDeleted = 0 AND isTemporary = 0 AND status = 'PRESENT'
              AND ISNULL(designation, '') NOT IN ('1076', '1077', '1081', 'DRIVER', 'Supervisor', 'Staff')
              AND ${joiningDateSql} > CONVERT(DATE, ?, 23)
        `, [reportDateStr]);
        console.log("PRESENT employees with future joining date:", presentFutureJoining[0].cnt);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

runCheck();
