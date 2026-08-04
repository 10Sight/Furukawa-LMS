import { poolPromise } from "../db/connectDB.js";
import { executeQuery } from "../db/mssqlHelper.js";

const formatDateLocal = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

const parseDateLocal = (dateStr) => {
    if (!dateStr) return null;
    const [y, m, d] = String(dateStr).split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
};

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

const getDesignationShutterExclusionCondition = (alias = "u") => `
    NOT EXISTS (
        SELECT 1
        FROM designation_shutters ds
        WHERE ds.designation IS NOT NULL
          AND ds.designation = ${alias}.designation
    )
`;

const getDesignationShutterExclusionSql = (alias = "u") =>
    `AND ${getDesignationShutterExclusionCondition(alias)}`;

async function runTest() {
    try {
        console.log("Awaiting connection...");
        await poolPromise;
        
        const indiaNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        indiaNow.setHours(0, 0, 0, 0);

        const yesterday = new Date(indiaNow);
        yesterday.setDate(yesterday.getDate() - 1);

        const todayStr = formatDateLocal(indiaNow);
        const yesterdayStr = formatDateLocal(yesterday);

        let todayHasAttendance = false;
        const checkTodaySql = `
            SELECT TOP 1 1 
            FROM attendance_logs al
            WHERE CONVERT(DATE, al.[date]) = CONVERT(DATE, ?, 23)
              AND (
                  UPPER(LTRIM(RTRIM(CAST(al.shift AS NVARCHAR(100))))) = 'A'
                  OR UPPER(LTRIM(RTRIM(CAST(al.shift AS NVARCHAR(100))))) = 'SHIFT A'
                  OR UPPER(LTRIM(RTRIM(CAST(al.shift AS NVARCHAR(100))))) = 'A SHIFT'
                  OR UPPER(LTRIM(RTRIM(CAST(al.shift AS NVARCHAR(100))))) = 'A-SHIFT'
              )
        `;
        const [todayCheckRows] = await executeQuery(checkTodaySql, [todayStr]);
        todayHasAttendance = todayCheckRows && todayCheckRows.length > 0;
        
        console.log("todayHasAttendance:", todayHasAttendance);
        const effectiveDateStr = todayHasAttendance ? todayStr : yesterdayStr;
        console.log("effectiveDateStr:", effectiveDateStr);

        let rangeStart = parseDateLocal(effectiveDateStr);
        let rangeEnd = parseDateLocal(effectiveDateStr);
        
        const sqlStartDate = formatDateLocal(rangeStart);
        const sqlEndDate = formatDateLocal(rangeEnd);
        console.log("sqlStartDate:", sqlStartDate);
        console.log("sqlEndDate:", sqlEndDate);

        const joinDateSQL = userDateToDateSql("u.joiningDate");
        const leaveDateSQL = userDateToDateSql("u.leavingDate");
        const attritionJoinDateSQL = joinDateSQL;
        
        const bucketCaseSQL = `
            CASE
                WHEN tenureDays BETWEEN 0 AND 16 THEN '0-16d'
                WHEN tenureDays BETWEEN 17 AND 30 THEN '17-30d'
                WHEN tenureDays BETWEEN 31 AND 60 THEN '31-60d'
                WHEN tenureDays BETWEEN 61 AND 90 THEN '61-90d'
                WHEN tenureDays BETWEEN 91 AND 180 THEN '3m-6m'
                WHEN tenureDays BETWEEN 181 AND 270 THEN '6m-9m'
                WHEN tenureDays BETWEEN 271 AND 365 THEN '9m-1y'
                WHEN tenureDays BETWEEN 366 AND 730 THEN '1y-2y'
                WHEN tenureDays BETWEEN 731 AND 1095 THEN '2y-3y'
                ELSE '3y-others'
            END
        `;

        const tenureAttritionTodaySql = `CONVERT(DATE, ?, 23)`;

        let attritionSql = `
            SELECT
                ${bucketCaseSQL} AS bucket,
                COUNT(DISTINCT userId) AS leftCount
            FROM (
                SELECT
                    u.id AS userId,
                    CASE 
                        WHEN DATEDIFF(DAY, ${attritionJoinDateSQL}, ${leaveDateSQL}) < 0 THEN 0 
                        ELSE DATEDIFF(DAY, ${attritionJoinDateSQL}, ${leaveDateSQL}) 
                    END AS tenureDays
                FROM users u
                WHERE
                  UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ISNULL(u.status, ''))))) = 'LEFT'
                  AND ${attritionJoinDateSQL} IS NOT NULL
                  AND ${leaveDateSQL} IS NOT NULL
                  AND ${leaveDateSQL} = ${tenureAttritionTodaySql}
                  AND ISNULL(u.isDeleted, 0) = 0
                  AND ISNULL(u.isTemporary, 0) = 0
                  AND u.empId IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
                  ${getDesignationShutterExclusionSql("u")}
            ) parsed
            WHERE tenureDays IS NOT NULL
              AND tenureDays >= 0
            GROUP BY ${bucketCaseSQL}
        `;

        console.log("Executing attritionSql with param:", sqlEndDate);
        const [rows] = await executeQuery(attritionSql, [sqlEndDate]);
        console.log("Query Result:", JSON.stringify(rows, null, 2));

    } catch (e) {
        console.error("Test failed:", e);
    } finally {
        process.exit(0);
    }
}

runTest();

