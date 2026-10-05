import { executeQuery } from "../db/mssqlHelper.js";

async function runCheck() {
    try {
        console.log("Checking VIVEK users table fields...");
        const [users] = await executeQuery(`
            SELECT id, fullName, status, empId, joiningDate, leavingDate, isDeleted, isTemporary, designation
            FROM users
            WHERE empId = 'APN1380'
        `);
        console.log("User record:", JSON.stringify(users, null, 2));

        if (users.length === 0) {
            console.log("User APN1380 not found in database!");
            return;
        }

        const u = users[0];

        console.log("Checking designation shutters for designation:", u.designation);
        const [shutters] = await executeQuery(`
            SELECT * FROM designation_shutters WHERE designation = ?
        `, [u.designation]);
        console.log("Designation shutters count:", shutters.length);
        console.log("Shutters:", JSON.stringify(shutters, null, 2));

        console.log("Checking if Shift A attendance exists for today (2026-07-25)...");
        const [checkRows] = await executeQuery(`
            SELECT COUNT(*) AS cnt
            FROM attendance_logs
            WHERE CONVERT(DATE, [date]) = CONVERT(DATE, '2026-07-25', 23)
              AND (
                  UPPER(LTRIM(RTRIM(CAST(shift AS NVARCHAR(100))))) = 'A'
                  OR UPPER(LTRIM(RTRIM(CAST(shift AS NVARCHAR(100))))) = 'SHIFT A'
                  OR UPPER(LTRIM(RTRIM(CAST(shift AS NVARCHAR(100))))) = 'A SHIFT'
                  OR UPPER(LTRIM(RTRIM(CAST(shift AS NVARCHAR(100))))) = 'A-SHIFT'
              )
        `);
        console.log("Shift A check count:", checkRows[0].cnt);

        console.log("Running normal daily attrition query for today...");
        const [normRows] = await executeQuery(`
            SELECT u.id, u.leavingDate
            FROM users u
            WHERE UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ISNULL(u.status, ''))))) = 'LEFT'
              AND u.leavingDate IS NOT NULL
              AND LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))) != ''
              AND UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate)))) != 'NULL'
              AND COALESCE(
                  TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 23),
                  TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 103)
              ) = CONVERT(DATE, '2026-07-25', 23)
              AND u.empId = 'APN1380'
        `);
        console.log("Normal attrition match count:", normRows.length);

        console.log("Running Tenure Attrition query with negative tenure fix...");
        const [tenureRows] = await executeQuery(`
            SELECT
                u.id,
                u.joiningDate,
                u.leavingDate,
                CASE 
                    WHEN DATEDIFF(DAY, COALESCE(
                        TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 23),
                        TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 103)
                    ), COALESCE(
                        TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 23),
                        TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 103)
                    )) < 0 THEN 0 
                    ELSE DATEDIFF(DAY, COALESCE(
                        TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 23),
                        TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 103)
                    ), COALESCE(
                        TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 23),
                        TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 103)
                    ))
                END AS tenureDays
            FROM users u
            WHERE UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ISNULL(u.status, ''))))) = 'LEFT'
              AND COALESCE(
                  TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 23),
                  TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.joiningDate))), ''), 103)
              ) IS NOT NULL
              AND COALESCE(
                  TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 23),
                  TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 103)
              ) IS NOT NULL
              AND COALESCE(
                  TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 23),
                  TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), u.leavingDate))), ''), 103)
              ) = CONVERT(DATE, '2026-07-25', 23)
              AND u.empId = 'APN1380'
        `);
        console.log("Tenure attrition match count:", tenureRows.length);
        console.log("Matched Tenure rows:", JSON.stringify(tenureRows, null, 2));

    } catch (e) {
        console.error("Error in runCheck:", e);
    } finally {
        process.exit(0);
    }
}

runCheck();
