// import { poolPromise } from "../db/connectDB.js";
import { poolPromise } from "../server/db/connectDB.js";
import { executeQuery } from "../server/db/mssqlHelper.js";

const formatDateLocal = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
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
        const todayStr = formatDateLocal(indiaNow);

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

        // 1. Get Attrition Counts
        const tenureAttritionTodaySql = `CONVERT(DATE, ?, 23)`;
        const attritionSql = `
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

        const [attrRows] = await executeQuery(attritionSql, [todayStr]);
        console.log("Attrition rows:", attrRows);

        // 2. Get Master Headcount
        const masterSql = `
            SELECT
                ${bucketCaseSQL} AS bucket,
                COUNT(DISTINCT userId) AS activeCount
            FROM (
                SELECT
                    u.id AS userId,
                    CASE
                        WHEN ${joinDateSQL} IS NULL THEN 1096
                        ELSE DATEDIFF(DAY, ${joinDateSQL}, CONVERT(DATE, ?, 23))
                    END AS tenureDays
                FROM users u
                WHERE ISNULL(u.isDeleted, 0) = 0
                  AND ISNULL(u.isTemporary, 0) = 0
                  AND u.empId IS NOT NULL
                  AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''
                  AND (
                        UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ISNULL(u.status, ''))))) <> 'LEFT'
                        OR ${leaveDateSQL} IS NULL
                        OR ${leaveDateSQL} > CONVERT(DATE, ?, 23)
                      )
                  ${getDesignationShutterExclusionSql("u")}
            ) parsed
            WHERE tenureDays IS NOT NULL
              AND tenureDays >= 0
            GROUP BY ${bucketCaseSQL}
        `;
        const [masterRows] = await executeQuery(masterSql, [todayStr, todayStr]);
        console.log("Master Headcount rows:", masterRows);

        // Calculate Denominators
        const attrMap = {};
        attrRows.forEach(r => { attrMap[r.bucket] = r.leftCount; });

        const masterMap = {};
        masterRows.forEach(r => { masterMap[r.bucket] = r.activeCount; });

        const buckets = [
            { value: '0-16d', label: '0–16 days' },
            { value: '17-30d', label: '17–30 days' },
            { value: '31-60d', label: '31–60 days' },
            { value: '61-90d', label: '61–90 days' },
            { value: '3m-6m', label: '3m–6m' },
            { value: '6m-9m', label: '6m–9m' },
            { value: '9m-1y', label: '9m–1y' },
            { value: '1y-2y', label: '1y–2y' },
            { value: '2y-3y', label: '2y–3y' },
            { value: '3y-others', label: '3y & others' }
        ];

        let totalLeft = 0;
        let totalMaster = 0;
        buckets.forEach(b => {
            totalLeft += (attrMap[b.value] || 0);
            totalMaster += (masterMap[b.value] || 0);
        });

        console.log("--- BUCKET DETAILS ---");
        buckets.forEach(b => {
            const left = attrMap[b.value] || 0;
            const master = masterMap[b.value] || 0;
            const commonTotal = totalMaster > 0 ? totalMaster : totalLeft;
            const percentage = commonTotal > 0 ? ((left / commonTotal) * 100).toFixed(1) : 0;
            console.log(`${b.label}: Count = ${left}, Master Active = ${master}, Percentage = ${percentage}% (using commonTotal = ${commonTotal})`);
        });

    } catch (e) {
        console.error("Test failed:", e);
    } finally {
        process.exit(0);
    }
}

runTest();