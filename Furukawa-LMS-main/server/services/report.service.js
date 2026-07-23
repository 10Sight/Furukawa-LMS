import { poolPromise } from "../db/connectDB.js";

import ExcelJS from "exceljs";

import nodemailer from "nodemailer";





// =================================================

// TRANSPORTER

// =================================================

const transporter = nodemailer.createTransport({

    pool: true,

    host: process.env.SMTP_HOST || "smtp.office365.com",

    port: parseInt(process.env.SMTP_PORT) || 587,

    secure: false,

    requireTLS: true,

    auth: {

        user: process.env.SMTP_USERNAME,

        pass: process.env.SMTP_PASSWORD

    },

    tls: { ciphers: "TLSv1.2", rejectUnauthorized: false }

});





// =================================================

// CONSTANTS / HELPERS

// =================================================

const MONTH_NAMES = [

    'January', 'February', 'March', 'April', 'May', 'June',

    'July', 'August', 'September', 'October', 'November', 'December'

];



const getPct = (num, den) => {

    const numerator = Number(num) || 0;

    const denominator = Number(den) || 0;

    if (!denominator) return "0%";

    return Math.round((numerator / denominator) * 100) + "%";

};



const getNum = (obj, key) => parseFloat(Number(obj?.[key] || 0).toFixed(2));



// Keep report dates in local calendar format instead of UTC conversion.

// This is important because every automated report must show yesterday's data.

const formatDateKey = (dateObj) => {

    const y = dateObj.getFullYear();

    const m = String(dateObj.getMonth() + 1).padStart(2, "0");

    const d = String(dateObj.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;

};



const formatDisplayDate = (dateObj) => {

    const d = String(dateObj.getDate()).padStart(2, "0");

    const m = String(dateObj.getMonth() + 1).padStart(2, "0");

    const y = dateObj.getFullYear();

    return `${d}-${m}-${y}`;

};



// Match the Dashboard's India-time calendar handling exactly.

// The automated report generated on 19-Jul must therefore use 18-Jul data.

const getIndiaNow = () => {

    const indiaNow = new Date(

        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })

    );

    indiaNow.setHours(0, 0, 0, 0);

    return indiaNow;

};



const getIndiaYesterday = () => {

    const reportDate = getIndiaNow();

    reportDate.setDate(reportDate.getDate() - 1);

    return reportDate;

};



// Same designation exclusion used by the first Dashboard manpower graph.

const getDesignationShutterExclusionSql = (alias = "u") => `

    AND NOT EXISTS (

        SELECT 1

        FROM designation_shutters ds

        WHERE ds.designation IS NOT NULL

          AND ds.designation = ${alias}.designation

    )

`;



// users.joiningDate / leavingDate can be NVARCHAR in different formats.

// This is copied from the Dashboard logic so report and graph evaluate dates identically.

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





// Same eligible-user rule used by Dashboard Daily Manpower Trend attendance.

const getEligibleAttendanceUserSql = (alias = "u") => `

    AND ISNULL(${alias}.isDeleted, 0) = 0

    AND ISNULL(${alias}.isTemporary, 0) = 0

    AND ${alias}.empId IS NOT NULL

    AND ${alias}.empId != ''

    ${getDesignationShutterExclusionSql(alias)}

`;



// Same 3-way section hierarchy rule used by Dashboard when Department + Section are selected:

// 1) users.sectionId directly matches

// 2) sectionId is NULL and line/sub-section resolves to the section

// 3) user id exists in sections.users JSON

const getDashboardSectionMatchSql = (userAlias = "u", sectionAlias = "s") => `
    (
        /* PRIORITY 1: a valid users.sectionId always wins */
        (
            ${userAlias}.sectionId = ${sectionAlias}.id
        )

        OR

        /* PRIORITY 2: use line/sub-section only when no valid direct section exists */
        (
            NOT EXISTS (
                SELECT 1
                FROM sections directSection
                WHERE directSection.id = ${userAlias}.sectionId
                  AND directSection.departmentId = ${userAlias}.departmentId
                  AND ISNULL(directSection.isActive, 1) = 1
            )
            AND EXISTS (
                SELECT 1
                FROM [lines] resolvedLine
                LEFT JOIN sub_sections resolvedSubSection
                    ON resolvedSubSection.id = ${userAlias}.subSectionId
                INNER JOIN sections resolvedSection
                    ON resolvedSection.id = resolvedLine.sectionId
                   AND resolvedSection.departmentId = ${userAlias}.departmentId
                   AND ISNULL(resolvedSection.isActive, 1) = 1
                WHERE resolvedLine.id = COALESCE(${userAlias}.lineId, resolvedSubSection.lineId)
                  AND ISNULL(resolvedLine.isActive, 1) = 1
                  AND resolvedLine.sectionId = ${sectionAlias}.id
            )
        )

        OR

        /*
         * PRIORITY 3: sections.users JSON is only a fallback.
         * It is ignored when a valid direct section or valid line-resolved section exists.
         * If stale JSON lists the same user in multiple sections, the lowest active section id
         * is selected so the employee can never be counted twice.
         */
        (
            NOT EXISTS (
                SELECT 1
                FROM sections directSection
                WHERE directSection.id = ${userAlias}.sectionId
                  AND directSection.departmentId = ${userAlias}.departmentId
                  AND ISNULL(directSection.isActive, 1) = 1
            )
            AND NOT EXISTS (
                SELECT 1
                FROM [lines] anyResolvedLine
                LEFT JOIN sub_sections anyResolvedSubSection
                    ON anyResolvedSubSection.id = ${userAlias}.subSectionId
                INNER JOIN sections anyResolvedSection
                    ON anyResolvedSection.id = anyResolvedLine.sectionId
                   AND anyResolvedSection.departmentId = ${userAlias}.departmentId
                   AND ISNULL(anyResolvedSection.isActive, 1) = 1
                WHERE anyResolvedLine.id = COALESCE(${userAlias}.lineId, anyResolvedSubSection.lineId)
                  AND ISNULL(anyResolvedLine.isActive, 1) = 1
            )
            AND EXISTS (
                SELECT 1
                FROM OPENJSON(
                    CASE
                        WHEN ISJSON(CAST(${sectionAlias}.[users] AS NVARCHAR(MAX))) = 1
                        THEN CAST(${sectionAlias}.[users] AS NVARCHAR(MAX))
                        ELSE N'[]'
                    END
                ) jsonSectionUser
                WHERE TRY_CAST(jsonSectionUser.[value] AS INT) = ${userAlias}.id
            )
            AND NOT EXISTS (
                SELECT 1
                FROM sections earlierJsonSection
                CROSS APPLY OPENJSON(
                    CASE
                        WHEN ISJSON(CAST(earlierJsonSection.[users] AS NVARCHAR(MAX))) = 1
                        THEN CAST(earlierJsonSection.[users] AS NVARCHAR(MAX))
                        ELSE N'[]'
                    END
                ) earlierJsonUser
                WHERE earlierJsonSection.departmentId = ${userAlias}.departmentId
                  AND ISNULL(earlierJsonSection.isActive, 1) = 1
                  AND earlierJsonSection.id < ${sectionAlias}.id
                  AND TRY_CAST(earlierJsonUser.[value] AS INT) = ${userAlias}.id
            )
        )
    )
`;


// Same shift matching rule as Dashboard addShiftFilter().

const getDashboardShiftMatchSql = (alias = "al", shiftValue = "A") => {

    const safeShift = String(shiftValue || "").trim().toUpperCase().replace(/'/g, "''");

    const shiftColumn = `UPPER(LTRIM(RTRIM(CAST(${alias}.shift AS NVARCHAR(100)))))`;

    const shiftColumnCompact = `REPLACE(REPLACE(REPLACE(${shiftColumn}, ' ', ''), '-', ''), '_', '')`;



    return `

        (

            ${shiftColumn} = '${safeShift}'

            OR ${shiftColumn} = 'SHIFT ${safeShift}'

            OR ${shiftColumn} = '${safeShift} SHIFT'

            OR ${shiftColumnCompact} = '${safeShift}'

            OR ${shiftColumnCompact} = 'SHIFT${safeShift}'

            OR ${shiftColumnCompact} = '${safeShift}SHIFT'

            OR (

                '${safeShift}' = 'G'

                AND ${shiftColumnCompact} IN ('G', 'GEN', 'GENERAL', 'GENERALSHIFT', 'SHIFTG', 'GSHIFT')

            )

        )

    `;

};



const safeMerge = (ws, range) => {

    try { ws.mergeCells(range); } catch (_) { }

};



const applyBorder = (cell, thick = false) => {

    const s = { style: thick ? "medium" : "thin" };

    cell.border = { top: s, bottom: s, left: s, right: s };

};



const styleCell = (cell, {

    bold = false,

    color = "FF000000",

    bg = null,

    hAlign = "center",

    vAlign = "middle",

    wrap = false,

    thick = false,

    sz = 12

} = {}) => {

    cell.font = { bold, color: { argb: color }, size: sz, name: "Calibri" };

    cell.alignment = { horizontal: hAlign, vertical: vAlign, wrapText: wrap };

    applyBorder(cell, thick);

    if (bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };

};



const setYellow = (cell) => {

    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };

};





// =================================================

// STEP 1: Fetch all departments + sections

// =================================================

async function fetchDeptSections(dbPool) {

    const rows = (await dbPool.request().query(`

        SELECT

            d.id          AS deptId,

            d.name        AS department_name,

            d.uniCode     AS department_code,

            s.id          AS sectionId,

            s.name        AS section_name,

            s.uniCode     AS section_code,

            s.category

        FROM departments d

        LEFT JOIN sections s

            ON  s.departmentId = d.id

            AND s.isActive = 1

        ORDER BY d.name ASC, s.name ASC

    `)).recordset || [];

    console.log(`[fetchDeptSections] rows: ${rows.length}`);

    return rows;

}





// =================================================

// STEP 2: Fetch required headcount from requirements

// EXACT SAME LOGIC AS DASHBOARD FIRST DAILY MANPOWER TREND GRAPH:

// - Report date = yesterday (India time)

// - Day 1-15 => prodPlanFN01, Day 16-end => prodPlanFN02

// - Same approved/system-approved requirement-row rule

// - Section mapping supports sectionCode OR sectionName, exactly like dashboard

// =================================================

async function fetchRequirements(dbPool, monthNumber, yearVal, reportDay = 1) {

    const reqColumn = reportDay <= 15 ? "prodPlanFN01" : "prodPlanFN02";



    // Same approval rule used by Dashboard getDashboardStats().

    const approvalCondition = `

        AND (

            (

                ISNULL(r.is_active, 0) = 1

                AND LOWER(LTRIM(RTRIM(ISNULL(r.approvalStatus, 'approved')))) IN (

                    'approved',

                    'system_approved',

                    'system approved',

                    'system-approved',

                    'systemapproved'

                )

            )

            OR LOWER(LTRIM(RTRIM(ISNULL(r.approvalStatus, '')))) IN (

                'system_approved',

                'system approved',

                'system-approved',

                'systemapproved'

            )

        )

    `;



    const sectionJoinSql = `

        LEFT JOIN sections s

            ON (

                UPPER(LTRIM(RTRIM(CAST(r.sectionCode AS NVARCHAR(510)))))

                    = UPPER(LTRIM(RTRIM(CAST(s.uniCode AS NVARCHAR(510)))))

                OR UPPER(LTRIM(RTRIM(CAST(r.sectionName AS NVARCHAR(510)))))

                    = UPPER(LTRIM(RTRIM(CAST(s.name AS NVARCHAR(510)))))

            )

            AND ISNULL(s.isActive, 1) = 1

    `;



    const totalPromise = dbPool.request()

        .input("monthNumber", monthNumber)

        .input("yearVal", yearVal)

        .query(`

            SELECT CAST(SUM(ISNULL(r.${reqColumn}, 0)) AS BIGINT) AS totalRequired

            FROM requirements r

            ${sectionJoinSql}

            LEFT JOIN departments d ON d.id = s.departmentId

            WHERE r.[year] = @yearVal

              AND r.monthNumber = @monthNumber

              ${approvalCondition}

        `);



    const departmentPromise = dbPool.request()

        .input("monthNumber", monthNumber)

        .input("yearVal", yearVal)

        .query(`

            SELECT

                d.id AS deptId,

                CAST(SUM(ISNULL(r.${reqColumn}, 0)) AS BIGINT) AS totalRequired

            FROM requirements r

            ${sectionJoinSql}

            LEFT JOIN departments d ON d.id = s.departmentId

            WHERE r.[year] = @yearVal

              AND r.monthNumber = @monthNumber

              ${approvalCondition}

              AND d.id IS NOT NULL

            GROUP BY d.id

        `);



    const sectionPromise = dbPool.request()

        .input("monthNumber", monthNumber)

        .input("yearVal", yearVal)

        .query(`

            SELECT

                s.id AS sectionId,

                CAST(SUM(ISNULL(r.${reqColumn}, 0)) AS BIGINT) AS totalRequired

            FROM requirements r

            ${sectionJoinSql}

            WHERE r.[year] = @yearVal

              AND r.monthNumber = @monthNumber

              ${approvalCondition}

              AND s.id IS NOT NULL

            GROUP BY s.id

        `);



    const [totalResult, departmentResult, sectionResult] = await Promise.all([

        totalPromise,

        departmentPromise,

        sectionPromise

    ]);



    const byDepartment = new Map();

    const bySection = new Map();



    (departmentResult.recordset || []).forEach(r => {

        byDepartment.set(Number(r.deptId), Number(r.totalRequired) || 0);

    });

    (sectionResult.recordset || []).forEach(r => {

        bySection.set(Number(r.sectionId), Number(r.totalRequired) || 0);

    });



    const total = Number(totalResult.recordset?.[0]?.totalRequired || 0);



    console.log(

        `[fetchRequirements] DASHBOARD-EXACT month=${monthNumber}, year=${yearVal}, day=${reportDay}, total=${total}, departments=${byDepartment.size}, sections=${bySection.size}`

    );



    return { byDepartment, bySection, total };

}



// =================================================

// STEP 2B: Fetch line-wise required headcount from line_requirements

// Detailed Attendance Report must use this table, not lines.requirement.

// Day 1-15 => fn01, Day 16-end => fn02. If FN value is NULL, requirement is 0.

// =================================================

async function fetchLineRequirements(dbPool, monthNumber, yearVal, reportDay = 1) {

    const reqColumn = reportDay <= 15 ? "fn01" : "fn02";



    const emptyResult = {

        byLine: new Map(),

        bySection: new Map()

    };



    try {

        // Line-wise requirement for each line row in Detailed Attendance Report.

        // IMPORTANT: Detailed Attendance Report must use line_requirements only.

        // It must not fall back to requirements table even if a section has only one line.

        const lineRows = (await dbPool.request()

            .input("monthNumber", monthNumber)

            .input("yearVal", yearVal)

            .query(`

                SELECT

                    lr.lineId,

                    SUM(ISNULL(lr.${reqColumn}, 0)) AS totalRequired

                FROM line_requirements lr

                WHERE lr.requirementMonth = @monthNumber

                  AND lr.requirementYear = @yearVal

                  AND lr.lineId IS NOT NULL

                  AND (lr.type IS NULL OR UPPER(LTRIM(RTRIM(lr.type))) = 'MONTHLY')

                GROUP BY lr.lineId

            `)).recordset || [];



        // Section-wise total from line_requirements.

        // We use lr.sectionId first, and if it is NULL, derive the section from lines.sectionId.

        // This fixes section total mismatch when line rows are present but the section total was

        // previously calculated from the displayed rows only or from requirements table.

        const sectionRows = (await dbPool.request()

            .input("monthNumber", monthNumber)

            .input("yearVal", yearVal)

            .query(`

                SELECT

                    COALESCE(lr.sectionId, l.sectionId) AS sectionId,

                    SUM(ISNULL(lr.${reqColumn}, 0)) AS totalRequired

                FROM line_requirements lr

                LEFT JOIN [lines] l ON l.id = lr.lineId

                WHERE lr.requirementMonth = @monthNumber

                  AND lr.requirementYear = @yearVal

                  AND COALESCE(lr.sectionId, l.sectionId) IS NOT NULL

                  AND (lr.type IS NULL OR UPPER(LTRIM(RTRIM(lr.type))) = 'MONTHLY')

                GROUP BY COALESCE(lr.sectionId, l.sectionId)

            `)).recordset || [];



        const byLine = new Map();

        const bySection = new Map();



        lineRows.forEach(r => byLine.set(Number(r.lineId), Number(r.totalRequired) || 0));

        sectionRows.forEach(r => bySection.set(Number(r.sectionId), Number(r.totalRequired) || 0));



        console.log(`[fetchLineRequirements] byLine entries: ${byLine.size}, bySection entries: ${bySection.size}`);

        return { byLine, bySection };

    } catch (e) {

        console.error("[fetchLineRequirements] failed:", e.message);

        return emptyResult;

    }

}





// =================================================

// STEP 3: Fetch Total Manpower directly from users

// EXACT SAME LOGIC AS DASHBOARD FIRST DAILY MANPOWER TREND GRAPH.

// IMPORTANT:

// - NO user_hierarchy_snapshots verification

// - NO isEmployee filter

// - isDeleted = 0

// - isTemporary = 0

// - valid/non-empty empId

// - designation_shutters exclusion

// - joiningDate adds employee from that exact date

// - employee is removed only when status = LEFT and leavingDate <= report date

// - blank/invalid joiningDate stays included as an existing employee

// - Department uses users.departmentId

// - Section uses the Dashboard's 3-way hierarchy rule

// =================================================

async function fetchActiveManpowerMaps(dbPool, reportDateStr) {

    try {

        const joiningDateSql = userDateToDateSql("u.joiningDate");

        const leavingDateSql = userDateToDateSql("u.leavingDate");

        const employeeStatusSql = `UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ISNULL(u.status, '')))))`;



        const eligibleUsersCte = `

            WITH EligibleUsers AS (

                SELECT DISTINCT

                    u.id,

                    LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) AS empId,

                    u.departmentId,

                    u.sectionId,

                    u.lineId,

                    u.subSectionId

                FROM users u

                WHERE ISNULL(u.isDeleted, 0) = 0

                  AND ISNULL(u.isTemporary, 0) = 0

                  AND u.empId IS NOT NULL

                  AND LTRIM(RTRIM(CAST(u.empId AS NVARCHAR(100)))) != ''

                  ${getDesignationShutterExclusionSql("u")}

                  AND (${joiningDateSql} IS NULL OR ${joiningDateSql} <= CONVERT(DATE, @reportDate, 23))

                  AND (

                        ${employeeStatusSql} <> 'LEFT'

                        OR ${leavingDateSql} IS NULL

                        OR ${leavingDateSql} > CONVERT(DATE, @reportDate, 23)

                  )

            )

        `;



        const totalPromise = dbPool.request()

            .input("reportDate", reportDateStr)

            .query(`

                ${eligibleUsersCte}

                SELECT COUNT(DISTINCT empId) AS total

                FROM EligibleUsers

            `);



        const departmentPromise = dbPool.request()

            .input("reportDate", reportDateStr)

            .query(`

                ${eligibleUsersCte}

                SELECT

                    departmentId AS deptId,

                    COUNT(DISTINCT empId) AS cnt

                FROM EligibleUsers

                WHERE departmentId IS NOT NULL

                GROUP BY departmentId

            `);



        const linePromise = dbPool.request()

            .input("reportDate", reportDateStr)

            .query(`

                ${eligibleUsersCte}

                SELECT

                    l.id AS lineId,

                    COUNT(DISTINCT eu.empId) AS cnt

                FROM [lines] l

                INNER JOIN sections s

                    ON s.id = l.sectionId

                   AND ISNULL(s.isActive, 1) = 1

                LEFT JOIN EligibleUsers eu

                    ON eu.departmentId = s.departmentId

                   AND eu.lineId = l.id

                   AND ${getDashboardSectionMatchSql("eu", "s")}

                WHERE ISNULL(l.isActive, 1) = 1

                GROUP BY l.id

            `);



        // Section manpower must use the SAME canonical one-section rule as attendance.
        // This prevents the same employee from being counted in two section rows when
        // users.sectionId / line hierarchy / sections.users JSON contain overlapping mappings.
        const sectionPromise = dbPool.request()
            .input("reportDate", reportDateStr)
            .query(`
                ${eligibleUsersCte}

                SELECT
                    s.id AS sectionId,
                    COUNT(DISTINCT eu.empId) AS cnt
                FROM sections s
                LEFT JOIN EligibleUsers eu
                    ON eu.departmentId = s.departmentId
                   AND ${getDashboardSectionMatchSql("eu", "s")}
                WHERE ISNULL(s.isActive, 1) = 1
                GROUP BY s.id
            `);


        const [totalResult, departmentResult, lineResult, sectionResult] = await Promise.all([

            totalPromise,

            departmentPromise,

            linePromise,

            sectionPromise

        ]);



        const byDepartment = new Map();

        const bySection = new Map();

        const byLine = new Map();



        (departmentResult.recordset || []).forEach(r => {

            byDepartment.set(Number(r.deptId), Number(r.cnt) || 0);

        });

        (sectionResult.recordset || []).forEach(r => {

            bySection.set(Number(r.sectionId), Number(r.cnt) || 0);

        });

        (lineResult.recordset || []).forEach(r => {

            byLine.set(Number(r.lineId), Number(r.cnt) || 0);

        });



        const total = Number(totalResult.recordset?.[0]?.total || 0);



        console.log(

            `[fetchActiveManpowerMaps] DASHBOARD-EXACT ${reportDateStr}: total=${total}, departments=${byDepartment.size}, sections=${bySection.size}, lines=${byLine.size}`

        );



        return { byDepartment, bySection, byLine, total };



    } catch (e) {

        console.error("[fetchActiveManpowerMaps] failed:", e.message);

        return {

            byDepartment: new Map(),

            bySection: new Map(),

            byLine: new Map(),

            total: 0

        };

    }

}





// =================================================

// STEP 4: Fetch Dashboard-exact attendance maps for yesterday

// SAME LOGIC AS THE FIRST DAILY MANPOWER TREND GRAPH:

// - attendance_logs.userId = users.id

// - Present = COUNT(DISTINCT u.id) where status is P / PRESENT / Present

// - eligible user: isDeleted=0, isTemporary=0, valid empId, designation shutter exclusion

// - Department = users.departmentId

// - Section = Dashboard 3-way section hierarchy + department

// - Line = Dashboard combined Department + Section + Line hierarchy

// - Shift columns use the exact Dashboard shift matching rule on attendance_logs.shift

// =================================================

async function fetchDashboardAttendanceMaps(dbPool, reportDateStr) {

    try {

        const presentCondition = `al.status IN ('P','PRESENT','Present')`;

        const shiftGeneralMatch = getDashboardShiftMatchSql("al", "G");

        const shiftAMatch = getDashboardShiftMatchSql("al", "A");

        const shiftBMatch = getDashboardShiftMatchSql("al", "B");

        const shiftCMatch = getDashboardShiftMatchSql("al", "C");



        const selectMetrics = `

            COUNT(DISTINCT CASE WHEN ${presentCondition} THEN u.id END) AS totalPresent,

            COUNT(DISTINCT CASE WHEN ${presentCondition} AND ${shiftGeneralMatch} THEN u.id END) AS shiftGeneral,

            COUNT(DISTINCT CASE WHEN ${presentCondition} AND ${shiftAMatch} THEN u.id END) AS shiftA,

            COUNT(DISTINCT CASE WHEN ${presentCondition} AND ${shiftBMatch} THEN u.id END) AS shiftB,

            COUNT(DISTINCT CASE WHEN ${presentCondition} AND ${shiftCMatch} THEN u.id END) AS shiftC,

            CAST(

                SUM(CASE WHEN ${presentCondition} THEN COALESCE(al.otHrs, 0) ELSE 0 END) / 8.0

                AS DECIMAL(10,2)

            ) AS totalOtHrs,

            CAST(

                SUM(CASE WHEN ${presentCondition} THEN COALESCE(al.hrsWorked, 0) ELSE 0 END)

                AS DECIMAL(10,2)

            ) AS totalHrsWorked

        `;



        const totalPromise = dbPool.request()

            .input("reportDate", reportDateStr)

            .query(`

                SELECT

                    ${selectMetrics}

                FROM attendance_logs al

                INNER JOIN users u

                    ON al.userId = u.id

                WHERE CONVERT(VARCHAR, al.[date], 23) = @reportDate

                  ${getEligibleAttendanceUserSql("u")}

            `);



        const departmentPromise = dbPool.request()

            .input("reportDate", reportDateStr)

            .query(`

                SELECT

                    u.departmentId AS deptId,

                    ${selectMetrics}

                FROM attendance_logs al

                INNER JOIN users u

                    ON al.userId = u.id

                WHERE CONVERT(VARCHAR, al.[date], 23) = @reportDate

                  AND u.departmentId IS NOT NULL

                  ${getEligibleAttendanceUserSql("u")}

                GROUP BY u.departmentId

            `);



        // Section query reproduces Dashboard Department + Section hierarchy filtering.

        const sectionPromise = dbPool.request()

            .input("reportDate", reportDateStr)

            .query(`

                SELECT

                    s.id AS sectionId,

                    ${selectMetrics}

                FROM sections s

                LEFT JOIN users u

                    ON u.departmentId = s.departmentId

                   AND ${getDashboardSectionMatchSql("u", "s")}

                   ${getEligibleAttendanceUserSql("u")}

                LEFT JOIN attendance_logs al

                    ON al.userId = u.id

                   AND CONVERT(VARCHAR, al.[date], 23) = @reportDate

                WHERE ISNULL(s.isActive, 1) = 1

                GROUP BY s.id

            `);



        // Line query reproduces Dashboard Department + Section + Line filtering.

        const linePromise = dbPool.request()

            .input("reportDate", reportDateStr)

            .query(`

                SELECT

                    l.id AS lineId,

                    ${selectMetrics}

                FROM [lines] l

                INNER JOIN sections s

                    ON s.id = l.sectionId

                   AND ISNULL(s.isActive, 1) = 1

                LEFT JOIN users u

                    ON u.departmentId = s.departmentId

                   AND u.lineId = l.id

                   AND ${getDashboardSectionMatchSql("u", "s")}

                   ${getEligibleAttendanceUserSql("u")}

                LEFT JOIN attendance_logs al

                    ON al.userId = u.id

                   AND CONVERT(VARCHAR, al.[date], 23) = @reportDate

                WHERE ISNULL(l.isActive, 1) = 1

                GROUP BY l.id

            `);



        const [totalResult, departmentResult, sectionResult, lineResult] = await Promise.all([

            totalPromise,

            departmentPromise,

            sectionPromise,

            linePromise

        ]);



        const byDepartment = new Map();

        const bySection = new Map();

        const byLine = new Map();



        (departmentResult.recordset || []).forEach(r => {

            byDepartment.set(Number(r.deptId), r);

        });



        (sectionResult.recordset || []).forEach(r => {

            bySection.set(Number(r.sectionId), r);

        });



        (lineResult.recordset || []).forEach(r => {

            byLine.set(Number(r.lineId), r);

        });



        const total = totalResult.recordset?.[0] || {

            totalPresent: 0,

            shiftGeneral: 0,

            shiftA: 0,

            shiftB: 0,

            shiftC: 0,

            totalOtHrs: 0,

            totalHrsWorked: 0

        };



        console.log(

            `[fetchDashboardAttendanceMaps] DASHBOARD-EXACT ${reportDateStr}: ` +

            `present=${Number(total.totalPresent) || 0}, departments=${byDepartment.size}, ` +

            `sections=${bySection.size}, lines=${byLine.size}`

        );



        return { byDepartment, bySection, byLine, total };



    } catch (e) {

        console.error("[fetchDashboardAttendanceMaps] failed:", e.message);

        return {

            byDepartment: new Map(),

            bySection: new Map(),

            byLine: new Map(),

            total: {

                totalPresent: 0,

                shiftGeneral: 0,

                shiftA: 0,

                shiftB: 0,

                shiftC: 0,

                totalOtHrs: 0,

                totalHrsWorked: 0

            }

        };

    }

}





// =================================================

// GET REPORT DATA

// =================================================

export const getReportData = async () => {

    const dbPool = await poolPromise;

    const reportDate = getIndiaYesterday(); // Dashboard/report both use yesterday in Asia/Kolkata



    const reportDateStr = formatDateKey(reportDate);

    const monthNumber = reportDate.getMonth() + 1;

    const yearVal = reportDate.getFullYear();

    const reportDay = reportDate.getDate();



    const [deptSections, reqMaps, activeMaps, attendanceMaps] = await Promise.all([

        fetchDeptSections(dbPool),

        fetchRequirements(dbPool, monthNumber, yearVal, reportDay),

        fetchActiveManpowerMaps(dbPool, reportDateStr),

        fetchDashboardAttendanceMaps(dbPool, reportDateStr)

    ]);



    const result = deptSections.map(row => {

        const sectionAttendance = row.sectionId

            ? (attendanceMaps.bySection.get(Number(row.sectionId)) || {})

            : {};

        const departmentAttendance = row.deptId

            ? (attendanceMaps.byDepartment.get(Number(row.deptId)) || {})

            : {};



        return {

            deptId: row.deptId,

            department_name: row.department_name,

            department_code: row.department_code,

            sectionId: row.sectionId,

            section_name: row.section_name,

            section_code: row.section_code,

            category: row.category,



            // Required = exact Dashboard Requirement bar logic for yesterday.

            totalRequired: row.sectionId

                ? (reqMaps.bySection.get(Number(row.sectionId)) || 0)

                : 0,

            departmentTotalRequired: row.deptId

                ? (reqMaps.byDepartment.get(Number(row.deptId)) || 0)

                : 0,

            globalTotalRequired: reqMaps.total,



            // Actual M/P = exact Dashboard Present bar logic for yesterday.

            totalPresent: getNum(sectionAttendance, "totalPresent"),

            departmentTotalPresent: getNum(departmentAttendance, "totalPresent"),

            globalTotalPresent: getNum(attendanceMaps.total, "totalPresent"),



            // Available M/P = exact Dashboard Total Manpower bar logic for yesterday.

            totalAssigned: row.sectionId

                ? (activeMaps.bySection.get(Number(row.sectionId)) || 0)

                : 0,

            departmentTotalAssigned: row.deptId

                ? (activeMaps.byDepartment.get(Number(row.deptId)) || 0)

                : 0,

            globalTotalAssigned: activeMaps.total,



            // OT Mandays uses the same eligible attendance population/hierarchy as Dashboard Present.

            totalOtHrs: getNum(sectionAttendance, "totalOtHrs"),

            departmentTotalOtHrs: getNum(departmentAttendance, "totalOtHrs"),

            globalTotalOtHrs: getNum(attendanceMaps.total, "totalOtHrs"),

        };

    });



    console.log(

        `[getReportData] report date ${reportDateStr}, merged rows: ${result.length}, ` +

        `required=${reqMaps.total}, manpower=${activeMaps.total}, attendance=${getNum(attendanceMaps.total, "totalPresent")}`

    );



    return result;

};





// =================================================

// BUILD MANPOWER EXCEL BUFFER

// =================================================

async function _buildManpowerBuffer() {

    console.log("[_buildManpowerBuffer] Starting...");



    try {

        const data = await getReportData();

        console.log(`[_buildManpowerBuffer] rows: ${data.length}`);



        const wb = new ExcelJS.Workbook();

        const ws = wb.addWorksheet("Manpower Report");



        ws.pageSetup = {

            orientation: "landscape",

            fitToPage: true,

            fitToWidth: 1,

            fitToHeight: 0

        };



        const C = {

            HEADER: "FF1F3B63",

            DEPT: "FF2F75B5",

            SECTION: "FFDCE6F1",

            SUBTOT: "FFF2F2F2",

            GRAND: "FFFFC000",

            WHITE: "FFFFFFFF",

            RED: "FFFF0000",

            BLACK: "FF000000",

        };



        ws.columns = [

            { width: 26 },

            { width: 16 },

            { width: 36 },

            { width: 22 },

            { width: 20 },

            { width: 18 },

            { width: 18 },

            { width: 18 },

            { width: 14 },

            { width: 14 }

        ];



        const makeDeptCell = (cell, value) => {

            cell.value = value;

            styleCell(cell, {

                bold: true,

                color: C.WHITE,

                bg: C.DEPT,

                hAlign: "center",

                vAlign: "middle",

                wrap: true,

                sz: 12

            });

        };



        const reportDate = getIndiaYesterday();



        // The displayed date and all report data point to yesterday.

        const reportDateLabel = formatDisplayDate(reportDate);

        const monthHeader = reportDate.toLocaleString("default", { month: "short", year: "numeric" });



        // Calculate milestone date based on yesterday (reportDate)

        const reportDay = reportDate.getDate();

        const milestoneDateObj = new Date(reportDate);

        if (reportDay <= 15) {

            milestoneDateObj.setDate(1);

        } else {

            milestoneDateObj.setDate(16);

        }

        const milestoneDate = milestoneDateObj.toLocaleDateString("en-GB").replace(/\//g, "-");



        safeMerge(ws, "A1:D1");

        // Date should appear only above "Total Required" column (F), not above Direct/Indirect (E).

        // So E1 is kept separate/blank and F1 contains the milestone date.

        safeMerge(ws, "G1:J1");



        ws.getCell("A1").value = monthHeader;

        ws.getCell("E1").value = "";

        ws.getCell("F1").value = milestoneDate;

        ws.getCell("G1").value = reportDateLabel;



        ["A1", "E1", "F1", "G1"].forEach(ref =>

            styleCell(ws.getCell(ref), {

                bold: true,

                color: C.WHITE,

                bg: C.HEADER,

                sz: 13

            })

        );



        ws.getRow(1).height = 24;



        const hdr = ws.getRow(2);

        hdr.values = [

            "Department Name",

            "Dept Code",

            "Section Name",

            "Section Code",

            "Direct/Indirect",

            "Total Required",

            "Available M/P",

            "Actual M/P",

            "Gap",

            "OT Mandays"

        ];



        hdr.eachCell({ includeEmpty: true }, cell =>

            styleCell(cell, {

                bold: true,

                color: C.WHITE,

                bg: C.HEADER,

                sz: 12,

                wrap: true

            })

        );



        hdr.height = 28;



        const deptMap = new Map();

        const deptOrder = [];



        data.forEach(r => {

            const key = r.department_code || r.department_name;



            if (!deptMap.has(key)) {

                deptMap.set(key, {

                    name: r.department_name,

                    code: r.department_code,

                    sections: []

                });

                deptOrder.push(key);

            }



            if (r.section_name) deptMap.get(key).sections.push(r);

        });



        let rowIdx = 3;

        let gReq = 0;

        let gAvail = 0;

        let gAct = 0;

        let gGap = 0;

        let gOT = 0;



        for (const key of deptOrder) {

            const dept = deptMap.get(key);

            const sections = dept.sections;

            const startRow = rowIdx;



            if (!sections.length) {

                for (let i = 0; i < 3; i++) {

                    const row = ws.getRow(rowIdx);

                    row.height = 22;



                    for (let c = 1; c <= 10; c++) {

                        row.getCell(c).value = "";

                        styleCell(row.getCell(c), {

                            bg: c <= 2 ? C.DEPT : C.SECTION,

                            color: c <= 2 ? C.WHITE : C.BLACK,

                            sz: 12

                        });

                    }



                    rowIdx++;

                }



                safeMerge(ws, `A${startRow}:A${rowIdx - 1}`);

                safeMerge(ws, `B${startRow}:B${rowIdx - 1}`);

                makeDeptCell(ws.getCell(`A${startRow}`), dept.name);

                makeDeptCell(ws.getCell(`B${startRow}`), dept.code);



            } else {

                let dReq = 0, dAvail = 0, dAct = 0, dGap = 0, dOT = 0;

                let iReq = 0, iAvail = 0, iAct = 0, iGap = 0, iOT = 0;



                sections.forEach(item => {

                    const isInd = (item.category || "").toLowerCase() === "indirect";

                    const req = Number(item.totalRequired) || 0;



                    // Available M/P = total employees assigned to the section.

                    // Actual M/P = attendance/present employees for the report date.

                    const avail = Number(item.totalAssigned) || 0;

                    const actual = Number(item.totalPresent) || 0;



                    const ot = parseFloat((Number(item.totalOtHrs) || 0).toFixed(2));



                    // Gap = Actual M/P - Total Required

                    // Actual M/P is attendance/present employees for the report date.

                    const gap = actual - req;



                    if (isInd) {

                        iReq += req;

                        iAvail += avail;

                        iAct += actual;

                        iGap += gap;

                        iOT += ot;

                    } else {

                        dReq += req;

                        dAvail += avail;

                        dAct += actual;

                        dGap += gap;

                        dOT += ot;

                    }



                    gReq += req;

                    gAvail += avail;

                    gAct += actual;

                    gGap += gap;

                    gOT += ot;



                    const row = ws.getRow(rowIdx);

                    row.height = 22;



                    [1, 2].forEach(c => {

                        row.getCell(c).value = "";

                        styleCell(row.getCell(c), {

                            bg: C.DEPT,

                            color: C.WHITE,

                            sz: 12

                        });

                    });



                    row.getCell(3).value = item.section_name;

                    row.getCell(4).value = item.section_code;

                    row.getCell(5).value = isInd ? "Indirect" : "Direct";

                    row.getCell(6).value = req;

                    row.getCell(7).value = avail;

                    row.getCell(8).value = actual;

                    row.getCell(9).value = gap;

                    row.getCell(10).value = ot;



                    for (let c = 3; c <= 10; c++) {

                        styleCell(row.getCell(c), {

                            bg: C.SECTION,

                            color: c === 9 && gap < 0 ? C.RED : C.BLACK,

                            hAlign: "center",

                            vAlign: "middle",

                            sz: 12

                        });

                    }



                    rowIdx++;

                });



                const subStart = rowIdx;



                const writeSubRow = (label, req, avail, actual, gap, ot) => {

                    const row = ws.getRow(rowIdx);

                    row.height = 22;



                    [1, 2].forEach(c => {

                        row.getCell(c).value = "";

                        styleCell(row.getCell(c), {

                            bg: C.DEPT,

                            color: C.WHITE,

                            sz: 12

                        });

                    });



                    row.getCell(3).value = "";

                    row.getCell(4).value = "";

                    row.getCell(5).value = label;

                    // Subtotal rows should show 0 instead of blank when values are zero.

                    // This applies to Direct / Indirect / Total rows.

                    row.getCell(6).value = Number(req) || 0;

                    row.getCell(7).value = Number(avail) || 0;

                    row.getCell(8).value = Number(actual) || 0;

                    row.getCell(9).value = Number(gap) || 0;

                    row.getCell(10).value = parseFloat((Number(ot) || 0).toFixed(2));



                    for (let c = 3; c <= 10; c++) {

                        styleCell(row.getCell(c), {

                            bg: C.SUBTOT,

                            color: c === 5 && typeof gap === "number" && gap < 0 ? C.RED : C.BLACK,

                            bold: c === 5,

                            hAlign: "center",

                            vAlign: "middle",

                            sz: 12

                        });

                    }



                    rowIdx++;

                };



                writeSubRow("Direct", dReq, dAvail, dAct, dGap, dOT);

                writeSubRow("Indirect", iReq, iAvail, iAct, iGap, iOT);

                /*
                 * IMPORTANT — Department Total must match Dashboard first graph
                 * when only the Department filter is selected.
                 *
                 * Direct / Indirect values above are section-wise values. They may be lower
                 * when some department employees do not have a valid section assignment.
                 * Therefore the department Total cannot be calculated only as dAct + iAct.
                 *
                 * departmentTotal* values come from the direct department-level SQL maps:
                 * users.departmentId for Available M/P and attendance Present for Actual M/P.
                 */
                const departmentSource = sections[0] || {};

                const exactDepartmentRequired =
                    departmentSource.departmentTotalRequired !== undefined
                        ? (Number(departmentSource.departmentTotalRequired) || 0)
                        : (dReq + iReq);

                const exactDepartmentAvailable =
                    departmentSource.departmentTotalAssigned !== undefined
                        ? (Number(departmentSource.departmentTotalAssigned) || 0)
                        : (dAvail + iAvail);

                const exactDepartmentActual =
                    departmentSource.departmentTotalPresent !== undefined
                        ? (Number(departmentSource.departmentTotalPresent) || 0)
                        : (dAct + iAct);

                const exactDepartmentOT =
                    departmentSource.departmentTotalOtHrs !== undefined
                        ? (Number(departmentSource.departmentTotalOtHrs) || 0)
                        : (dOT + iOT);

                /*
                 * Difference between direct department total and displayed section totals.
                 * This is not an attendance-unmapped row. It means the employee belongs to
                 * the department, but no active section could be resolved for the report row.
                 */
                const hierarchyPendingRequired = exactDepartmentRequired - (dReq + iReq);
                const hierarchyPendingAvailable = exactDepartmentAvailable - (dAvail + iAvail);
                const hierarchyPendingActual = exactDepartmentActual - (dAct + iAct);
                const hierarchyPendingOT = exactDepartmentOT - (dOT + iOT);
                const hierarchyPendingGap =
                    hierarchyPendingActual - hierarchyPendingRequired;

                const hasHierarchyPending =
                    Math.abs(hierarchyPendingRequired) > 0.0001 ||
                    Math.abs(hierarchyPendingAvailable) > 0.0001 ||
                    Math.abs(hierarchyPendingActual) > 0.0001 ||
                    Math.abs(hierarchyPendingOT) > 0.0001;

                if (hasHierarchyPending) {
                    writeSubRow(
                        "Hierarchy Pending",
                        hierarchyPendingRequired,
                        hierarchyPendingAvailable,
                        hierarchyPendingActual,
                        hierarchyPendingGap,
                        hierarchyPendingOT
                    );
                }

                const exactDepartmentGap =
                    exactDepartmentActual - exactDepartmentRequired;

                writeSubRow(

                    "Total",

                    exactDepartmentRequired,

                    exactDepartmentAvailable,

                    exactDepartmentActual,

                    exactDepartmentGap,

                    parseFloat(exactDepartmentOT.toFixed(2))

                );



                const subEnd = rowIdx - 1;



                safeMerge(ws, `C${subStart}:C${subEnd}`);

                safeMerge(ws, `D${subStart}:D${subEnd}`);



                ws.getCell(`C${subStart}`).value = "Total manpower";

                styleCell(ws.getCell(`C${subStart}`), {

                    bold: true,

                    bg: C.SUBTOT,

                    hAlign: "center",

                    vAlign: "middle",

                    sz: 12

                });



                styleCell(ws.getCell(`D${subStart}`), {

                    bg: C.SUBTOT,

                    sz: 12

                });



                safeMerge(ws, `A${startRow}:A${subEnd}`);

                safeMerge(ws, `B${startRow}:B${subEnd}`);



                makeDeptCell(ws.getCell(`A${startRow}`), dept.name);

                makeDeptCell(ws.getCell(`B${startRow}`), dept.code);

            }

        }



        /*
         * GRAND TOTAL must match the Dashboard first graph with no hierarchy filter.
         * Do not use only the sum of displayed section rows because employees with a
         * department but without a valid section would otherwise be missed.
         */
        if (data.length > 0) {
            gReq = Number(data[0]?.globalTotalRequired) || 0;
            gAvail = Number(data[0]?.globalTotalAssigned) || 0;
            gAct = Number(data[0]?.globalTotalPresent) || 0;
            gOT = Number(data[0]?.globalTotalOtHrs) || 0;
        }

        gGap = gAct - gReq;



        const gt = ws.getRow(rowIdx);

        gt.height = 28;



        safeMerge(ws, `A${rowIdx}:E${rowIdx}`);

        ws.getCell(`A${rowIdx}`).value = "GRAND TOTAL";



        styleCell(ws.getCell(`A${rowIdx}`), {

            bold: true,

            bg: C.GRAND,

            hAlign: "center",

            vAlign: "middle",

            thick: true,

            sz: 13

        });



        [gReq, gAvail, gAct, gGap, parseFloat(gOT.toFixed(2))].forEach((val, i) => {

            const cell = gt.getCell(6 + i);

            cell.value = val;



            styleCell(cell, {

                bold: true,

                bg: C.GRAND,

                color: i === 3 && val < 0 ? C.RED : C.BLACK,

                hAlign: "center",

                vAlign: "middle",

                thick: true,

                sz: 13

            });

        });



        ws.views = [{ state: "frozen", ySplit: 2 }];



        const buffer = await wb.xlsx.writeBuffer();

        console.log(`[_buildManpowerBuffer] Done. ${buffer.byteLength} bytes`);

        return buffer;



    } catch (err) {

        console.error("[_buildManpowerBuffer] FATAL:", err.message || err);

        console.error(err.stack);

        return null;

    }

}





// =================================================

// BUILD MANAGEMENT DAILY EXCEL BUFFER

// =================================================

async function _buildManagementBuffer() {

    console.log("[_buildManagementBuffer] Starting...");



    try {

        const dbPool = await poolPromise;

        const reportDate = getIndiaYesterday(); // All management report data is yesterday in Asia/Kolkata



        const reportDateStr = formatDateKey(reportDate);

        const monthNumber = reportDate.getMonth() + 1;

        const yearVal = reportDate.getFullYear();

        const reportDay = reportDate.getDate();



        // Detailed line requirement also follows yesterday's FN period.

        const requirementMonth = monthNumber;

        const requirementYear = yearVal;

        const requirementDay = reportDay;



        const secRows = (await dbPool.request().query(`

            SELECT

                s.id AS sectionId,

                s.name AS section_name,

                s.uniCode AS section_code,

                s.category AS section_category,

                d.name AS dept_name,

                d.id AS deptId

            FROM sections s

            INNER JOIN departments d ON d.id = s.departmentId

            WHERE s.isActive = 1

            ORDER BY d.name ASC, s.name ASC

        `)).recordset || [];



        console.log(`[_buildManagementBuffer] sections: ${secRows.length}`);



        const lineRows = (await dbPool.request().query(`

            SELECT

                l.id AS lineId,

                l.name AS line_name,

                l.uniCode AS line_code,

                l.sectionId

            FROM [lines] l

            WHERE l.isActive = 1

            ORDER BY l.sectionId ASC, l.name ASC

        `)).recordset || [];



        const linesBySection = new Map();



        lineRows.forEach(l => {

            if (!linesBySection.has(l.sectionId)) {

                linesBySection.set(l.sectionId, []);

            }

            linesBySection.get(l.sectionId).push(l);

        });



        const reqMaps = await fetchRequirements(dbPool, monthNumber, yearVal, reportDay);



        // Detailed Attendance Report line requirement comes from line_requirements.

        // Use yesterday's month/year/day for selecting fn01 or fn02.

        const lineReqResult = await fetchLineRequirements(

            dbPool,

            requirementMonth,

            requirementYear,

            requirementDay

        );

        const lineReqMap = lineReqResult.byLine;



        // Handover/Available manpower uses the exact Dashboard Total Manpower bar logic.

        // No user_hierarchy_snapshots verification is used.

        const activeMaps = await fetchActiveManpowerMaps(dbPool, reportDateStr);

        const handSecMap = activeMaps.bySection;

        const handLineMap = activeMaps.byLine;

        const handDeptMap = activeMaps.byDepartment;



        // Present/shift/OT/hour columns use the exact Dashboard Present bar population and hierarchy.

        const attendanceMaps = await fetchDashboardAttendanceMaps(dbPool, reportDateStr);

        const attSecMap = attendanceMaps.bySection;

        const attLineMap = attendanceMaps.byLine;

        const attDeptMap = attendanceMaps.byDepartment;



        const wb = new ExcelJS.Workbook();

        const ws = wb.addWorksheet("Management Daily");



        ws.pageSetup = {

            orientation: "landscape",

            fitToPage: true,

            fitToWidth: 1,

            fitToHeight: 0

        };



        const C = {

            BLACK: "FF000000",

            WHITE: "FFFFFFFF",

            HEADER_BG: "FF1F3B63",

            TOTAL_BG: "FFD9D9D9",

            SEC_HDR_BG: "FF808080",

        };



        ws.columns = [

            { width: 22 },

            { width: 36 },

            { width: 18 },

            { width: 18 },

            { width: 15 },

            { width: 15 },

            { width: 15 },

            { width: 15 },

            { width: 15 },

            { width: 16 },

            { width: 16 },

            { width: 20 },

            { width: 20 }

        ];



        let ri = 1;



        safeMerge(ws, `A${ri}:D${ri}`);

        ws.getCell(`A${ri}`).value = "";

        styleCell(ws.getCell(`A${ri}`), {

            bg: C.HEADER_BG,

            color: C.WHITE,

            sz: 12

        });



        safeMerge(ws, `E${ri}:I${ri}`);

        ws.getCell(`E${ri}`).value = "Actual headcount (Present)";

        styleCell(ws.getCell(`E${ri}`), {

            bold: true,

            bg: C.HEADER_BG,

            color: C.WHITE,

            sz: 13

        });



        ["J", "K", "L", "M"].forEach(col => {

            ws.getCell(`${col}${ri}`).value = "";

            styleCell(ws.getCell(`${col}${ri}`), {

                bg: C.HEADER_BG,

                color: C.WHITE,

                sz: 12

            });

        });



        ws.getRow(ri).height = 22;



        ri = 2;



        const hdrVals = {

            A: "Section",

            B: "Line/Area",

            C: "Required\nheadcount\nas per indent",

            D: "Headcount\nhandover\nas on date",

            E: "General Shift\n(8:00 ~ 17:00)",

            F: "A-Shift\n(6:00 ~ 14:30)",

            G: "B-Shift\n(14:30 ~ 23:00)",

            H: "C-Shift\n(23:00 ~ 06:00)",

            I: "Total",

            J: "OT\nMandays",

            K: "Total man\nhours",

            L: "Headcount\nRequired VS\nActual in %",

            M: "Headcount\nHandover VS\nActual in %"

        };



        Object.entries(hdrVals).forEach(([col, val]) => {

            const cell = ws.getCell(`${col}${ri}`);

            cell.value = val;



            styleCell(cell, {

                bold: true,

                bg: C.HEADER_BG,

                color: C.WHITE,

                sz: 11,

                wrap: true

            });

        });



        ws.getRow(ri).height = 58;

        ri = 3;



        const deptMap = new Map();

        const deptOrder = [];



        secRows.forEach(s => {

            if (!deptMap.has(s.deptId)) {

                deptMap.set(s.deptId, {

                    dept_name: s.dept_name,

                    sections: []

                });

                deptOrder.push(s.deptId);

            }



            deptMap.get(s.deptId).sections.push(s);

        });



        let grReq = 0;

        let grHand = 0;

        let grGen = 0;

        let grA = 0;

        let grB = 0;

        let grC = 0;

        let grAct = 0;

        let grOT = 0;

        let grHrs = 0;



        for (const deptId of deptOrder) {

            const { dept_name, sections } = deptMap.get(deptId);



            let dReq = 0;

            let dHand = 0;

            let dGen = 0;

            let dA = 0;

            let dB = 0;

            let dC = 0;

            let dAct = 0;

            let dOT = 0;

            let dHrs = 0;



            /*
             * Management summary department row must match Dashboard first graph
             * when only this Department is selected.
             *
             * Do not calculate it by summing section rows. A department employee may
             * be correctly present in users.departmentId but have no valid section/line.
             * The direct department maps keep those employees in Department Actual
             * and Available while the detailed section/line report remains filter-exact.
             */
            const deptAttendance = attDeptMap.get(Number(deptId)) || {};

            dReq = Number(reqMaps.byDepartment.get(Number(deptId))) || 0;
            dHand = Number(handDeptMap.get(Number(deptId))) || 0;
            dGen = getNum(deptAttendance, "shiftGeneral");
            dA = getNum(deptAttendance, "shiftA");
            dB = getNum(deptAttendance, "shiftB");
            dC = getNum(deptAttendance, "shiftC");
            dAct = getNum(deptAttendance, "totalPresent");
            dOT = getNum(deptAttendance, "totalOtHrs");
            dHrs = getNum(deptAttendance, "totalHrsWorked");

            grReq += dReq;

            grHand += dHand;

            grGen += dGen;

            grA += dA;

            grB += dB;

            grC += dC;

            grAct += dAct;

            grOT += dOT;

            grHrs += dHrs;



            const row = ws.getRow(ri);

            row.height = 22;



            row.getCell(1).value = dept_name;

            styleCell(row.getCell(1), {

                bold: true,

                hAlign: "left",

                sz: 11

            });



            row.getCell(2).value = dept_name;

            styleCell(row.getCell(2), {

                hAlign: "left",

                sz: 11

            });



            row.getCell(3).value = dReq;

            styleCell(row.getCell(3), { sz: 11 });

            setYellow(row.getCell(3));



            row.getCell(4).value = dHand;

            row.getCell(5).value = dGen;

            row.getCell(6).value = dA;

            row.getCell(7).value = dB;

            row.getCell(8).value = dC;

            row.getCell(9).value = dAct;

            row.getCell(10).value = parseFloat(dOT.toFixed(2));

            row.getCell(11).value = parseFloat(dHrs.toFixed(2));

            row.getCell(12).value = getPct(dAct, dReq);

            row.getCell(13).value = getPct(dAct, dHand);



            for (let c = 4; c <= 13; c++) {

                styleCell(row.getCell(c), { sz: 11 });

            }



            ri++;

        }



        /*
         * Top Management Total must match Dashboard first graph without a hierarchy
         * filter. Use global maps instead of only summing displayed department rows.
         */
        grReq = Number(reqMaps.total) || 0;
        grHand = Number(activeMaps.total) || 0;

        {
            const globalAttendance = attendanceMaps.total || {};
            grGen = getNum(globalAttendance, "shiftGeneral");
            grA = getNum(globalAttendance, "shiftA");
            grB = getNum(globalAttendance, "shiftB");
            grC = getNum(globalAttendance, "shiftC");
            grAct = getNum(globalAttendance, "totalPresent");
            grOT = getNum(globalAttendance, "totalOtHrs");
            grHrs = getNum(globalAttendance, "totalHrsWorked");
        }



        {

            const row = ws.getRow(ri);

            row.height = 22;



            safeMerge(ws, `A${ri}:B${ri}`);



            row.getCell(1).value = "Total";

            styleCell(row.getCell(1), {

                bold: true,

                bg: C.TOTAL_BG,

                hAlign: "center",

                sz: 11

            });



            styleCell(row.getCell(2), {

                bg: C.TOTAL_BG,

                sz: 11

            });



            row.getCell(3).value = grReq;

            styleCell(row.getCell(3), {

                bold: true,

                bg: C.TOTAL_BG,

                sz: 11

            });

            setYellow(row.getCell(3));



            [

                [4, grHand],

                [5, grGen],

                [6, grA],

                [7, grB],

                [8, grC],

                [9, grAct]

            ].forEach(([c, v]) => {

                row.getCell(c).value = v;

                styleCell(row.getCell(c), {

                    bold: true,

                    bg: C.TOTAL_BG,

                    sz: 11

                });

            });



            row.getCell(10).value = parseFloat(grOT.toFixed(2));

            row.getCell(11).value = parseFloat(grHrs.toFixed(2));

            row.getCell(12).value = getPct(grAct, grReq);

            row.getCell(13).value = getPct(grAct, grHand);



            for (let c = 10; c <= 13; c++) {

                styleCell(row.getCell(c), {

                    bold: true,

                    bg: C.TOTAL_BG,

                    sz: 11

                });

            }



            ri++;

        }



        ri++;



        {

            safeMerge(ws, `A${ri}:M${ri}`);



            ws.getRow(ri).height = 22;



            const lbl = ws.getCell(`A${ri}`);

            lbl.value = "Detailed Attendance Report";

            lbl.font = {

                bold: true,

                italic: true,

                size: 12,

                name: "Calibri"

            };

            lbl.alignment = {

                horizontal: "left",

                vertical: "middle"

            };



            ri++;

        }



        for (const deptId of deptOrder) {

            const { sections } = deptMap.get(deptId);



            for (const sec of sections) {

                const sc = (sec.section_code || "").toUpperCase().trim();

                const secLines = linesBySection.get(sec.sectionId) || [];

                const att = attSecMap.get(sec.sectionId) || {};



                // Section Total requirement must match Dashboard when that Section is selected:

                // requirements table + approval rule + yesterday FN01/FN02.

                // Individual line rows below still use line_requirements, exactly like Dashboard line filter.

                const secReq = reqMaps.bySection.get(Number(sec.sectionId)) || 0;

                const secHand = handSecMap.get(Number(sec.sectionId)) || 0;

                const secAct = getNum(att, "totalPresent");

                const secOT = getNum(att, "totalOtHrs"); // OT Mandays = section employees OT sum / 8

                const secHrs = getNum(att, "totalHrsWorked");

                const secGen = getNum(att, "shiftGeneral");

                const secA = getNum(att, "shiftA");

                const secB = getNum(att, "shiftB");

                const secC = getNum(att, "shiftC");



                const catLabel = sec.section_category || "Direct";

                const secLabel = `${sec.section_name}\n(${catLabel})`;

                const secBlockStart = ri;



                if (secLines.length === 0) {

                    const row = ws.getRow(ri);

                    row.height = 22;



                    row.getCell(1).value = secLabel;

                    styleCell(row.getCell(1), {

                        bold: true,

                        hAlign: "center",

                        vAlign: "middle",

                        bg: C.SEC_HDR_BG,

                        color: C.WHITE,

                        sz: 11,

                        wrap: true

                    });



                    row.getCell(2).value = sec.section_name;

                    styleCell(row.getCell(2), {

                        hAlign: "left",

                        sz: 11,

                        wrap: true

                    });



                    row.getCell(3).value = secReq;

                    styleCell(row.getCell(3), { sz: 11 });

                    setYellow(row.getCell(3));



                    row.getCell(4).value = secHand;

                    row.getCell(5).value = secGen;

                    row.getCell(6).value = secA;

                    row.getCell(7).value = secB;

                    row.getCell(8).value = secC;

                    row.getCell(9).value = secAct;

                    row.getCell(10).value = parseFloat(secOT.toFixed(2));

                    row.getCell(11).value = parseFloat(secHrs.toFixed(2));

                    row.getCell(12).value = getPct(secAct, secReq);

                    row.getCell(13).value = getPct(secAct, secHand);



                    for (let c = 4; c <= 13; c++) {

                        styleCell(row.getCell(c), { sz: 11 });

                    }



                    ri++;



                    // IMPORTANT FIX:

                    // Earlier, sections with no active line rows (single-row sections like

                    // ASSEMBLY SUB LEADER, PRODUCTION OFFICE, SPD, D&D, FG, Logistics, etc.)

                    // were written as one detail row only and the code moved to the next section.

                    // Because the Total row existed only inside the secLines.length > 0 block,

                    // these single-line sections did not get their own Total row.

                    // Now every section gets a Total row, even if it has only one displayed row.

                    const tr = ws.getRow(ri);

                    tr.height = 21;



                    safeMerge(ws, `A${ri}:B${ri}`);



                    tr.getCell(1).value = "Total";

                    styleCell(tr.getCell(1), {

                        bold: true,

                        bg: C.TOTAL_BG,

                        hAlign: "center",

                        sz: 11

                    });



                    styleCell(tr.getCell(2), {

                        bg: C.TOTAL_BG,

                        sz: 11

                    });



                    tr.getCell(3).value = secReq;

                    styleCell(tr.getCell(3), {

                        bold: true,

                        bg: C.TOTAL_BG,

                        sz: 11

                    });

                    setYellow(tr.getCell(3));



                    [

                        [4, secHand],

                        [5, secGen],

                        [6, secA],

                        [7, secB],

                        [8, secC],

                        [9, secAct]

                    ].forEach(([c, v]) => {

                        tr.getCell(c).value = v;

                        styleCell(tr.getCell(c), {

                            bold: true,

                            bg: C.TOTAL_BG,

                            sz: 11

                        });

                    });



                    tr.getCell(10).value = parseFloat(secOT.toFixed(2));

                    tr.getCell(11).value = parseFloat(secHrs.toFixed(2));

                    tr.getCell(12).value = getPct(secAct, secReq);

                    tr.getCell(13).value = getPct(secAct, secHand);



                    for (let c = 10; c <= 13; c++) {

                        styleCell(tr.getCell(c), {

                            bold: true,

                            bg: C.TOTAL_BG,

                            sz: 11

                        });

                    }



                    ri++;



                } else {

                    let totReq = 0;

                    let totHand = 0;

                    let totGen = 0;

                    let totA = 0;

                    let totB = 0;

                    let totC = 0;

                    let totAct = 0;

                    let totOT = 0;

                    let totHrs = 0;



                    secLines.forEach(ln => {

                        const latt = attLineMap.get(ln.lineId) || {};

                        const lReq = lineReqMap.get(Number(ln.lineId)) || 0;

                        const lHand = handLineMap.get(Number(ln.lineId)) || 0;

                        const lGen = getNum(latt, "shiftGeneral");

                        const lA = getNum(latt, "shiftA");

                        const lB = getNum(latt, "shiftB");

                        const lC = getNum(latt, "shiftC");

                        const lAct = getNum(latt, "totalPresent");

                        const lOT = getNum(latt, "totalOtHrs"); // OT Mandays = line employees OT sum / 8

                        const lHrs = getNum(latt, "totalHrsWorked");



                        totReq += lReq;

                        totHand += lHand;

                        totGen += lGen;

                        totA += lA;

                        totB += lB;

                        totC += lC;

                        totAct += lAct;

                        totOT += lOT;

                        totHrs += lHrs;



                        const row = ws.getRow(ri);

                        row.height = 21;



                        row.getCell(1).value = "";

                        styleCell(row.getCell(1), {

                            bg: C.SEC_HDR_BG,

                            color: C.WHITE,

                            sz: 11

                        });



                        row.getCell(2).value = ln.line_name;

                        styleCell(row.getCell(2), {

                            hAlign: "left",

                            sz: 11,

                            wrap: true

                        });



                        row.getCell(3).value = lReq;

                        styleCell(row.getCell(3), { sz: 11 });

                        setYellow(row.getCell(3));



                        row.getCell(4).value = Number(lHand) || 0;

                        row.getCell(5).value = Number(lGen) || 0;

                        row.getCell(6).value = Number(lA) || 0;

                        row.getCell(7).value = Number(lB) || 0;

                        row.getCell(8).value = Number(lC) || 0;

                        row.getCell(9).value = Number(lAct) || 0;

                        row.getCell(10).value = parseFloat((Number(lOT) || 0).toFixed(2));

                        row.getCell(11).value = parseFloat((Number(lHrs) || 0).toFixed(2));

                        row.getCell(12).value = getPct(lAct, lReq);

                        row.getCell(13).value = getPct(lAct, lHand);



                        for (let c = 4; c <= 13; c++) {

                            styleCell(row.getCell(c), { sz: 11 });

                        }



                        ri++;

                    });



                    // Section Total must match Dashboard Section filter logic, not the arithmetic

                    // sum of line_requirements rows. Line rows themselves remain line_requirements-based.

                    const totalReqForSection = reqMaps.bySection.get(Number(sec.sectionId)) || 0;



                    const secBlockEnd = ri - 1;



                    if (secBlockStart < secBlockEnd) {

                        safeMerge(ws, `A${secBlockStart}:A${secBlockEnd}`);

                    }



                    const mergedA = ws.getCell(`A${secBlockStart}`);

                    mergedA.value = secLabel;



                    styleCell(mergedA, {

                        bold: true,

                        bg: C.SEC_HDR_BG,

                        color: C.WHITE,

                        hAlign: "center",

                        vAlign: "middle",

                        sz: 11,

                        wrap: true

                    });



                    const tr = ws.getRow(ri);

                    tr.height = 21;



                    safeMerge(ws, `A${ri}:B${ri}`);



                    tr.getCell(1).value = "Total";

                    styleCell(tr.getCell(1), {

                        bold: true,

                        bg: C.TOTAL_BG,

                        hAlign: "center",

                        sz: 11

                    });



                    styleCell(tr.getCell(2), {

                        bg: C.TOTAL_BG,

                        sz: 11

                    });



                    tr.getCell(3).value = totalReqForSection;

                    styleCell(tr.getCell(3), {

                        bold: true,

                        bg: C.TOTAL_BG,

                        sz: 11

                    });

                    setYellow(tr.getCell(3));



                    [

                        [4, secHand],

                        [5, secGen],

                        [6, secA],

                        [7, secB],

                        [8, secC],

                        [9, secAct]

                    ].forEach(([c, v]) => {

                        tr.getCell(c).value = v;

                        styleCell(tr.getCell(c), {

                            bold: true,

                            bg: C.TOTAL_BG,

                            sz: 11

                        });

                    });



                    tr.getCell(10).value = parseFloat((Number(secOT) || 0).toFixed(2));

                    tr.getCell(11).value = parseFloat((Number(secHrs) || 0).toFixed(2));

                    tr.getCell(12).value = getPct(secAct, totalReqForSection);

                    tr.getCell(13).value = getPct(secAct, secHand);



                    for (let c = 10; c <= 13; c++) {

                        styleCell(tr.getCell(c), {

                            bold: true,

                            bg: C.TOTAL_BG,

                            sz: 11

                        });

                    }



                    ri++;

                }

            }

        }



        ws.views = [{ state: "frozen", ySplit: 2 }];



        const buffer = await wb.xlsx.writeBuffer();

        console.log(`[_buildManagementBuffer] Done. ${buffer.byteLength} bytes`);

        return buffer;



    } catch (err) {

        console.error("[_buildManagementBuffer] FATAL:", err.message || err);

        console.error(err.stack);

        return null;

    }

}





// =================================================

// SEND MANPOWER REPORT ONLY

// =================================================

export const generateAndSend = async (emails) => {

    try {

        const normalizedEmails = Array.isArray(emails)

            ? emails.map(email => String(email || '').trim()).filter(Boolean)

            : [String(emails || '').trim()].filter(Boolean);



        if (normalizedEmails.length === 0) {

            throw new Error("No valid Daily Manpower Report recipients configured.");

        }



        const buffer = await _buildManpowerBuffer();



        if (!buffer) {

            throw new Error("Daily Manpower Report Excel buffer could not be generated.");

        }



        const reportDate = getIndiaYesterday();

        const dt = formatDisplayDate(reportDate);



        const info = await transporter.sendMail({

            from: `"Manpower System" <${process.env.SMTP_USERNAME}>`,

            to: normalizedEmails,

            subject: `Daily Manpower Report - ${dt}`,

            html: `<p>Please find attached the daily manpower report for <b>${dt}</b>.</p>`,

            attachments: [{

                filename: `Daily_Manpower_Report_${dt}.xlsx`,

                content: Buffer.from(buffer),

                contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

            }]

        });



        console.log(

            `[generateAndSend] Sent successfully to: ${normalizedEmails.join(", ")}. MessageId: ${info?.messageId || "N/A"}`

        );



        return true;



    } catch (err) {

        console.error("[generateAndSend] ERROR:", err?.message || err);

        // IMPORTANT: rethrow the error so the scheduler does NOT mark this run as sent.

        throw err;

    }

};





// =================================================

// SEND MANAGEMENT DAILY REPORT ONLY

// =================================================

export const generateAndSendManagementDaily = async (emails) => {

    try {

        const normalizedEmails = Array.isArray(emails)

            ? emails.map(email => String(email || '').trim()).filter(Boolean)

            : [String(emails || '').trim()].filter(Boolean);



        if (normalizedEmails.length === 0) {

            throw new Error("No valid Management Daily Report recipients configured.");

        }



        const buffer = await _buildManagementBuffer();



        if (!buffer) {

            throw new Error("Management Daily Report Excel buffer could not be generated.");

        }



        const reportDate = getIndiaYesterday();

        const dt = formatDisplayDate(reportDate);



        const info = await transporter.sendMail({

            from: `"Management System" <${process.env.SMTP_USERNAME}>`,

            to: normalizedEmails,

            subject: `Daily Management Report - ${dt}`,

            html: `<p>Please find attached the Daily Management Attendance Report for <b>${dt}</b>.</p>`,

            attachments: [{

                filename: `Daily_Management_Report_${dt}.xlsx`,

                content: Buffer.from(buffer),

                contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

            }]

        });



        console.log(

            `[generateAndSendManagementDaily] Sent successfully to: ${normalizedEmails.join(", ")}. MessageId: ${info?.messageId || "N/A"}`

        );



        return true;



    } catch (err) {

        console.error("[generateAndSendManagementDaily] ERROR:", err?.message || err);

        // IMPORTANT: rethrow the error so the scheduler does NOT mark this run as sent.

        throw err;

    }

};





// =================================================

// SEND BOTH REPORTS

// =================================================

export async function sendBothReports(emails) {

    try {

        const reportDate = getIndiaYesterday();

        const dt = formatDisplayDate(reportDate);



        console.log("[sendBothReports] Building both buffers...");



        const manpowerBuf = await _buildManpowerBuffer();

        const managementBuf = await _buildManagementBuffer();



        console.log(`[sendBothReports] manpowerBuf: ${manpowerBuf ? manpowerBuf.byteLength + " bytes" : "NULL"}`);

        console.log(`[sendBothReports] managementBuf: ${managementBuf ? managementBuf.byteLength + " bytes" : "NULL"}`);



        const attachments = [];



        if (manpowerBuf) {

            attachments.push({

                filename: `Daily_Manpower_Report_${dt}.xlsx`,

                content: Buffer.from(manpowerBuf),

                contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

            });

        }



        if (managementBuf) {

            attachments.push({

                filename: `Daily_Management_Report_${dt}.xlsx`,

                content: Buffer.from(managementBuf),

                contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

            });

        }



        if (!attachments.length) {

            console.error("[sendBothReports] Both NULL — no email sent.");

            throw new Error("Both Excel report buffers could not be generated.");

        }



        const result = await transporter.sendMail({

            from: `"FME Report System" <${process.env.SMTP_USERNAME}>`,

            to: emails,

            subject: `Daily Reports (Manpower + Management) - ${dt}`,

            html: `

                <p>Please find attached <b>both</b> daily reports for <b>${dt}</b>:</p>

                <ul>

                    <li>Daily Manpower Report (.xlsx)</li>

                    <li>Daily Management Attendance Report (.xlsx)</li>

                </ul>

            `,

            attachments

        });



        console.log(`[sendBothReports] Sent. Attachments: ${attachments.length}. MsgId: ${result.messageId}`);



    } catch (err) {

        console.error("[sendBothReports] FATAL:", err.message || err);

        console.error(err.stack);

        // IMPORTANT: rethrow so the caller (manual trigger controller) knows the send failed
        // instead of reporting a false success, matching generateAndSend/generateAndSendManagementDaily.
        throw err;

    }

}







// =================================================

// AUTOMATIC EMAIL REPORT SCHEDULER

// =================================================

// Send times are provided by the controller from DB settings.

// Daily and Management Daily reports are scheduled independently.

// Existing manual sendBothReports() behavior remains unchanged.

//

// IMPORTANT FIX:

// - Each report becomes due at its configured HH:mm time and has a maximum 2-minute post-time grace window.

// - A report is NEVER sent before its configured time.

// - Old schedules are NOT caught up later in the day outside that small grace window.

// - The per-day + per-time runKey prevents duplicate sends inside the grace window.

// - Daily and Management Daily still use independent busy locks so one report does not block the other.

// - A schedule change to a different future time on the same day creates a new runKey.

const getIndiaScheduleClock = () => {

    const parts = new Intl.DateTimeFormat('en-GB', {

        timeZone: 'Asia/Kolkata',

        year: 'numeric',

        month: '2-digit',

        day: '2-digit',

        hour: '2-digit',

        minute: '2-digit',

        hourCycle: 'h23'

    }).formatToParts(new Date());



    const values = Object.fromEntries(

        parts

            .filter(part => part.type !== 'literal')

            .map(part => [part.type, part.value])

    );



    const hour = Number(values.hour || 0);

    const minute = Number(values.minute || 0);



    return {

        dateKey: `${values.year}-${values.month}-${values.day}`,

        timeKey: `${values.hour}:${values.minute}`,

        minuteOfDay: (hour * 60) + minute

    };

};



const parseScheduleMinuteOfDay = (value) => {

    const time = String(value || '').trim();



    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {

        return null;

    }



    const [hour, minute] = time.split(':').map(Number);

    return (hour * 60) + minute;

};


// Allow a very small post-time grace window so a temporary DB/event-loop delay
// cannot permanently miss the configured minute.
// IMPORTANT: This never runs before the configured time and never catches up
// old schedules later in the day.
const isScheduledMinuteDue = (
    currentMinute,
    scheduledMinute,
    graceMinutes = 5
) => {
    if (scheduledMinute === null) return false;

    const graceEndMinute = Math.min(
        (23 * 60) + 59,
        scheduledMinute + Math.max(0, Number(graceMinutes) || 0)
    );

    return (
        currentMinute >= scheduledMinute &&
        currentMinute <= graceEndMinute
    );
};



const isMailFlagEnabled = (value) => {

    if (value === true || value === 1) return true;



    const normalized = String(value ?? '').trim().toLowerCase();

    return normalized === '1' || normalized === 'true' || normalized === 'yes';

};



const getUniqueEmails = (mails, predicate) => {

    return [

        ...new Set(

            (mails || [])

                .filter(predicate)

                .map(mail => String(mail?.email || '').trim())

                .filter(Boolean)

        )

    ];

};



export function initializeEmailReportScheduler({

    getSchedule,

    getRecipients

} = {}) {

    if (

        typeof getSchedule !== 'function' ||

        typeof getRecipients !== 'function'

    ) {

        console.warn(

            "[EmailReportScheduler] Not started: getSchedule/getRecipients callback missing."

        );

        return;

    }



    // Prevent duplicate timers if the module is imported more than once.

    if (globalThis.__sarvagyaEmailReportSchedulerStarted) {

        return;

    }

    globalThis.__sarvagyaEmailReportSchedulerStarted = true;



    globalThis.__sarvagyaEmailReportLastRun =

        globalThis.__sarvagyaEmailReportLastRun || {

            daily: null,

            managementDaily: null

        };



    // Independent locks:

    // A heavy Manpower Excel build must not permanently make Management Daily miss its minute,

    // and vice versa.

    let dailyBusy = false;

    let managementDailyBusy = false;

    let schedulerTickBusy = false;



    const runDailyIfDue = async ({

        mails,

        dateKey,

        timeKey,

        minuteOfDay,

        dailyTime

    }) => {

        const scheduledMinute = parseScheduleMinuteOfDay(dailyTime);

        if (scheduledMinute === null) return;

        if (!isScheduledMinuteDue(minuteOfDay, scheduledMinute)) return;



        const normalizedTime = String(dailyTime).trim();

        const runKey = `${dateKey}|${normalizedTime}`;



        if (

            dailyBusy ||

            globalThis.__sarvagyaEmailReportLastRun.daily === runKey

        ) {

            return;

        }



        dailyBusy = true;



        try {

            const dailyEmails = getUniqueEmails(

                mails,

                mail => isMailFlagEnabled(mail?.isDailyReport)

            );



            if (dailyEmails.length === 0) {

                console.log(

                    `[EmailReportScheduler] Daily Manpower Report is due (${normalizedTime} IST), but no Daily recipients are configured.`

                );



                // Do not mark as sent. If recipient configuration is corrected during
                // the grace window, the scheduler can retry automatically.
                return;

            }



            console.log(

                `[EmailReportScheduler] Daily Manpower Report due at ${normalizedTime} IST. Current scheduler time: ${timeKey} IST. Sending to ${dailyEmails.length} recipient(s).`

            );



            await generateAndSend(dailyEmails);



            // Mark only after the send function completes.

            globalThis.__sarvagyaEmailReportLastRun.daily = runKey;



            console.log(

                `[EmailReportScheduler] Daily Manpower Report completed for schedule ${normalizedTime} IST.`

            );

        } catch (err) {

            // Do not mark lastRun on thrown failure; a later tick can retry.

            console.error(

                "[EmailReportScheduler] Daily Manpower Report failed:",

                err?.message || err

            );

        } finally {

            dailyBusy = false;

        }

    };



    const runManagementDailyIfDue = async ({

        mails,

        dateKey,

        timeKey,

        minuteOfDay,

        managementDailyTime

    }) => {

        const scheduledMinute =

            parseScheduleMinuteOfDay(managementDailyTime);



        if (scheduledMinute === null) return;

        if (!isScheduledMinuteDue(minuteOfDay, scheduledMinute)) return;



        const normalizedTime = String(managementDailyTime).trim();

        const runKey = `${dateKey}|${normalizedTime}`;



        if (

            managementDailyBusy ||

            globalThis.__sarvagyaEmailReportLastRun.managementDaily === runKey

        ) {

            return;

        }



        managementDailyBusy = true;



        try {

            const managementEmails = getUniqueEmails(

                mails,

                mail => isMailFlagEnabled(mail?.isManagementDailyReport)

            );



            if (managementEmails.length === 0) {

                console.log(

                    `[EmailReportScheduler] Management Daily Report is due (${normalizedTime} IST), but no Management Daily recipients are configured.`

                );



                // Do not mark as sent. If recipient configuration is corrected during
                // the grace window, the scheduler can retry automatically.
                return;

            }



            console.log(

                `[EmailReportScheduler] Management Daily Report due at ${normalizedTime} IST. Current scheduler time: ${timeKey} IST. Sending to ${managementEmails.length} recipient(s).`

            );



            await generateAndSendManagementDaily(managementEmails);



            // Mark only after the send function completes.

            globalThis.__sarvagyaEmailReportLastRun.managementDaily = runKey;



            console.log(

                `[EmailReportScheduler] Management Daily Report completed for schedule ${normalizedTime} IST.`

            );

        } catch (err) {

            // Do not mark lastRun on thrown failure; a later tick can retry.

            console.error(

                "[EmailReportScheduler] Management Daily Report failed:",

                err?.message || err

            );

        } finally {

            managementDailyBusy = false;

        }

    };



    const tick = async () => {

        // This lock protects only DB/settings fetching for a single tick.

        // Actual report generation uses separate locks and is started independently below.

        if (schedulerTickBusy) return;

        schedulerTickBusy = true;



        try {

            const schedule = await getSchedule();

            const { dateKey, timeKey, minuteOfDay } =

                getIndiaScheduleClock();



            const dailyScheduledMinute =

                parseScheduleMinuteOfDay(schedule?.dailyTime);



            const managementScheduledMinute =

                parseScheduleMinuteOfDay(schedule?.managementDailyTime);



            const dailyRunKey = schedule?.dailyTime

                ? `${dateKey}|${String(schedule.dailyTime).trim()}`

                : null;



            const managementRunKey = schedule?.managementDailyTime

                ? `${dateKey}|${String(schedule.managementDailyTime).trim()}`

                : null;



            const dailyDue =

                dailyScheduledMinute !== null &&

                isScheduledMinuteDue(minuteOfDay, dailyScheduledMinute) &&

                globalThis.__sarvagyaEmailReportLastRun.daily !== dailyRunKey;



            const managementDue =

                managementScheduledMinute !== null &&

                isScheduledMinuteDue(minuteOfDay, managementScheduledMinute) &&

                globalThis.__sarvagyaEmailReportLastRun.managementDaily !== managementRunKey;



            if (!dailyDue && !managementDue) {

                return;

            }



            const mails = await getRecipients();



            // Start each due report independently.

            // Do not await one before starting the other, otherwise a long Excel build can block

            // the second report. Individual functions have their own busy locks.

            if (dailyDue) {

                void runDailyIfDue({

                    mails,

                    dateKey,

                    timeKey,

                    minuteOfDay,

                    dailyTime: schedule?.dailyTime

                });

            }



            if (managementDue) {

                void runManagementDailyIfDue({

                    mails,

                    dateKey,

                    timeKey,

                    minuteOfDay,

                    managementDailyTime: schedule?.managementDailyTime

                });

            }

        } catch (err) {

            console.error(

                "[EmailReportScheduler] Tick failed:",

                err?.message || err

            );

        } finally {

            schedulerTickBusy = false;

        }

    };



    // Check frequently and send only inside the exact configured minute.

    // This prevents old/passed schedules from being sent as catch-up runs.

    const interval = setInterval(tick, 15 * 1000);



    // Do not keep Node alive only because of this timer.

    if (typeof interval.unref === 'function') {

        interval.unref();

    }



    // First check shortly after application startup.

    const initialTimer = setTimeout(tick, 3000);

    if (typeof initialTimer.unref === 'function') {

        initialTimer.unref();

    }



    console.log(

        "[EmailReportScheduler] Started. Timezone: Asia/Kolkata. Daily and Management Daily schedules run independently with a 5-minute post-time grace window."

    );

}





export default {

    getReportData,

    generateAndSend,

    generateAndSendManagementDaily,

    sendBothReports,

    initializeEmailReportScheduler

};