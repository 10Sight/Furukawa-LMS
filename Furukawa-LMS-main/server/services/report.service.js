import { poolPromise } from "../db/connectDB.js";
import ExcelJS from "exceljs";
import nodemailer from "nodemailer";


// =================================================
// TRANSPORTER
// =================================================
const transporter = nodemailer.createTransport({
    pool: true,
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
    },
    tls: { rejectUnauthorized: false }
});


// =================================================
// CONSTANTS / HELPERS
// =================================================
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const getPct = (num, den) => {
    if (!den || den === 0) return "#DIV/0!";
    return Math.round((num / den) * 100) + "%";
};

const getNum = (obj, key) => parseFloat(Number(obj?.[key] || 0).toFixed(2));

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
// =================================================
async function fetchRequirements(dbPool, monthName, yearVal, reportDay = 1) {
    const reqColumn = reportDay <= 15 ? "prodPlanFN01" : "prodPlanFN02";
    const rows = (await dbPool.request()
        .input("monthName", monthName)
        .input("yearVal", yearVal)
        .query(`
            SELECT
                UPPER(LTRIM(RTRIM(sectionCode))) AS secCode,
                SUM(ISNULL(${reqColumn}, 0)) AS totalRequired
            FROM requirements
            WHERE monthName = @monthName AND year = @yearVal
            GROUP BY UPPER(LTRIM(RTRIM(sectionCode)))
        `)).recordset || [];

    const map = new Map();
    rows.forEach(r => map.set(r.secCode, Number(r.totalRequired) || 0));
    console.log(`[fetchRequirements] entries: ${map.size}`);
    return map;
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
// STEP 3: Fetch Actual M/P from user_hierarchy_snapshots
// =================================================
async function fetchActualMPBySection(dbPool) {
    try {
        const rows = (await dbPool.request().query(`
            WITH latest_uhs AS (
                SELECT *
                FROM (
                    SELECT
                        uhs.*,
                        ROW_NUMBER() OVER (
                            PARTITION BY UPPER(LTRIM(RTRIM(uhs.employeeid)))
                            ORDER BY uhs.id DESC
                        ) AS rn
                    FROM user_hierarchy_snapshots uhs
                    WHERE uhs.employeeid IS NOT NULL
                      AND LTRIM(RTRIM(uhs.employeeid)) <> ''
                ) x
                WHERE x.rn = 1
            )
            SELECT
                s.id AS sectionId,
                COUNT(DISTINCT latest_uhs.employeeid) AS cnt
            FROM latest_uhs
            INNER JOIN sections s
                ON  UPPER(LTRIM(RTRIM(s.uniCode))) = UPPER(LTRIM(RTRIM(latest_uhs.section_unicode)))
                AND s.isActive = 1
            WHERE latest_uhs.section_unicode IS NOT NULL
              AND LTRIM(RTRIM(latest_uhs.section_unicode)) <> ''
            GROUP BY s.id
        `)).recordset || [];

        const map = new Map();
        rows.forEach(r => map.set(r.sectionId, Number(r.cnt) || 0));
        console.log(`[fetchActualMPBySection] primary entries: ${map.size}`);
        return map;
    } catch (e) {
        console.error("[fetchActualMPBySection] failed:", e.message);
        return new Map();
    }
}


// =================================================
// STEP 4: Fetch Available M/P from attendance_logs
// =================================================
async function fetchAvailableMPBySection(dbPool, todayStr) {
    const dateFilter = "CONVERT(VARCHAR, DATEADD(day, -1, CAST(@todayDate AS DATE)), 23)";

    const makeMap = (rows) => {
        const map = new Map();
        rows.forEach(r => map.set(r.sectionId, r));
        return map;
    };

    try {
        const rows = (await dbPool.request()
            .input("todayDate", todayStr)
            .query(`
                WITH latest_uhs AS (
                    SELECT *
                    FROM (
                        SELECT
                            uhs.*,
                            ROW_NUMBER() OVER (
                                PARTITION BY UPPER(LTRIM(RTRIM(uhs.employeeid)))
                                ORDER BY uhs.id DESC
                            ) AS rn
                        FROM user_hierarchy_snapshots uhs
                        WHERE uhs.employeeid IS NOT NULL
                          AND LTRIM(RTRIM(uhs.employeeid)) <> ''
                    ) x
                    WHERE x.rn = 1
                )
                SELECT
                    s.id AS sectionId,
                    COUNT(DISTINCT al.payCode) AS totalPresent,
                    CAST(SUM(COALESCE(al.otHrs, 0)) / 8.0 AS DECIMAL(10,2)) AS totalOtHrs
                FROM attendance_logs al
                INNER JOIN latest_uhs uhs
                    ON  UPPER(LTRIM(RTRIM(uhs.employeeid))) = UPPER(LTRIM(RTRIM(al.payCode)))
                INNER JOIN sections s
                    ON  UPPER(LTRIM(RTRIM(s.uniCode))) = UPPER(LTRIM(RTRIM(uhs.section_unicode)))
                    AND s.isActive = 1
                WHERE CONVERT(VARCHAR, al.date, 23) = ${dateFilter}
                  AND al.payCode IS NOT NULL
                  AND UPPER(LTRIM(RTRIM(ISNULL(al.status, '')))) IN ('PRESENT', 'P')
                  AND ISNULL(uhs.section_unicode,'') <> ''
                GROUP BY s.id
            `)).recordset || [];

        console.log(`[fetchAvailableMPBySection] primary rows Yesterday: ${rows.length}`);
        return makeMap(rows);

    } catch (e1) {
        console.error("[fetchAvailableMPBySection] primary failed:", e1.message);
    }

    try {
        const rows = (await dbPool.request()
            .input("todayDate", todayStr)
            .query(`
                WITH latest_uhs AS (
                    SELECT *
                    FROM (
                        SELECT
                            uhs.*,
                            ROW_NUMBER() OVER (
                                PARTITION BY UPPER(LTRIM(RTRIM(uhs.employeeid)))
                                ORDER BY uhs.id DESC
                            ) AS rn
                        FROM user_hierarchy_snapshots uhs
                        WHERE uhs.employeeid IS NOT NULL
                          AND LTRIM(RTRIM(uhs.employeeid)) <> ''
                    ) x
                    WHERE x.rn = 1
                )
                SELECT
                    s.id AS sectionId,
                    COUNT(DISTINCT al.cardNo) AS totalPresent,
                    CAST(SUM(COALESCE(al.otHrs, 0)) / 8.0 AS DECIMAL(10,2)) AS totalOtHrs
                FROM attendance_logs al
                INNER JOIN latest_uhs uhs
                    ON  UPPER(LTRIM(RTRIM(uhs.employeeid))) = UPPER(LTRIM(RTRIM(al.cardNo)))
                INNER JOIN sections s
                    ON  UPPER(LTRIM(RTRIM(s.uniCode))) = UPPER(LTRIM(RTRIM(uhs.section_unicode)))
                    AND s.isActive = 1
                WHERE CONVERT(VARCHAR, al.date, 23) = ${dateFilter}
                  AND al.cardNo IS NOT NULL
                  AND UPPER(LTRIM(RTRIM(ISNULL(al.status, '')))) IN ('PRESENT', 'P')
                  AND ISNULL(uhs.section_unicode,'') <> ''
                GROUP BY s.id
            `)).recordset || [];

        console.log(`[fetchAvailableMPBySection] fallback rows Yesterday: ${rows.length}`);
        return makeMap(rows);

    } catch (e2) {
        console.error("[fetchAvailableMPBySection] fallback failed:", e2.message);
        return new Map();
    }
}


// =================================================
// STEP 5: Fetch shift-wise attendance by section
// =================================================
async function fetchShiftAttendanceBySection(dbPool, todayStr) {
    const prevDayFilter = "CONVERT(VARCHAR, DATEADD(day, -1, CAST(@todayDate AS DATE)), 23)";

    const makeMap = (rows) => {
        const map = new Map();
        rows.forEach(r => map.set(r.sectionId, r));
        return map;
    };

    const baseCte = `
        WITH latest_uhs AS (
            SELECT *
            FROM (
                SELECT
                    uhs.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY UPPER(LTRIM(RTRIM(uhs.employeeid)))
                        ORDER BY uhs.id DESC
                    ) AS rn
                FROM user_hierarchy_snapshots uhs
                WHERE uhs.employeeid IS NOT NULL
                  AND LTRIM(RTRIM(uhs.employeeid)) <> ''
            ) x
            WHERE x.rn = 1
        )`;

    try {
        const rows = (await dbPool.request()
            .input("todayDate", todayStr)
            .query(`
                ${baseCte}
                SELECT
                    s.id AS sectionId,
                    COUNT(DISTINCT al.payCode) AS totalPresent,
                    SUM(CASE WHEN LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'G%' OR LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'GEN%' THEN 1 ELSE 0 END) AS shiftGeneral,
                    SUM(CASE WHEN LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'A%' THEN 1 ELSE 0 END) AS shiftA,
                    SUM(CASE WHEN LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'B%' THEN 1 ELSE 0 END) AS shiftB,
                    SUM(CASE WHEN LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'C%' OR LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'D%' THEN 1 ELSE 0 END) AS shiftC,
                    CAST(SUM(COALESCE(al.otHrs, 0)) / 8.0 AS DECIMAL(10,2)) AS totalOtHrs,
                    CAST(SUM(COALESCE(al.hrsWorked, 0)) AS DECIMAL(10,2)) AS totalHrsWorked
                FROM attendance_logs al
                INNER JOIN latest_uhs uhs
                    ON  UPPER(LTRIM(RTRIM(uhs.employeeid))) = UPPER(LTRIM(RTRIM(al.payCode)))
                INNER JOIN sections s
                    ON  UPPER(LTRIM(RTRIM(s.uniCode))) = UPPER(LTRIM(RTRIM(uhs.section_unicode)))
                    AND s.isActive = 1
                WHERE CONVERT(VARCHAR, al.date, 23) = ${prevDayFilter}
                  AND al.payCode IS NOT NULL
                  AND UPPER(LTRIM(RTRIM(ISNULL(al.status, '')))) IN ('PRESENT', 'P')
                  AND ISNULL(uhs.section_unicode,'') <> ''
                GROUP BY s.id
            `)).recordset || [];

        console.log(`[fetchShiftAttendanceBySection] primary rows Yesterday: ${rows.length}`);
        return makeMap(rows);

    } catch (e1) {
        console.error("[fetchShiftAttendanceBySection] primary failed:", e1.message);

        try {
            const rows = (await dbPool.request()
                .input("todayDate", todayStr)
                .query(`
                    ${baseCte}
                    SELECT
                        s.id AS sectionId,
                        COUNT(DISTINCT al.cardNo) AS totalPresent,
                        SUM(CASE WHEN LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'G%' OR LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'GEN%' THEN 1 ELSE 0 END) AS shiftGeneral,
                        SUM(CASE WHEN LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'A%' THEN 1 ELSE 0 END) AS shiftA,
                        SUM(CASE WHEN LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'B%' THEN 1 ELSE 0 END) AS shiftB,
                        SUM(CASE WHEN LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'C%' OR LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'D%' THEN 1 ELSE 0 END) AS shiftC,
                        CAST(SUM(COALESCE(al.otHrs, 0)) / 8.0 AS DECIMAL(10,2)) AS totalOtHrs,
                        CAST(SUM(COALESCE(al.hrsWorked, 0)) AS DECIMAL(10,2)) AS totalHrsWorked
                    FROM attendance_logs al
                    INNER JOIN latest_uhs uhs
                        ON  UPPER(LTRIM(RTRIM(uhs.employeeid))) = UPPER(LTRIM(RTRIM(al.cardNo)))
                    INNER JOIN sections s
                        ON  UPPER(LTRIM(RTRIM(s.uniCode))) = UPPER(LTRIM(RTRIM(uhs.section_unicode)))
                        AND s.isActive = 1
                    WHERE CONVERT(VARCHAR, al.date, 23) = ${prevDayFilter}
                      AND al.cardNo IS NOT NULL
                      AND UPPER(LTRIM(RTRIM(ISNULL(al.status, '')))) IN ('PRESENT', 'P')
                      AND ISNULL(uhs.section_unicode,'') <> ''
                    GROUP BY s.id
                `)).recordset || [];

            console.log(`[fetchShiftAttendanceBySection] fallback rows Yesterday: ${rows.length}`);
            return makeMap(rows);

        } catch (e2) {
            console.error("[fetchShiftAttendanceBySection] fallback failed:", e2.message);
            return new Map();
        }
    }
}


// =================================================
// STEP 6: Fetch shift-wise attendance by line
// =================================================
async function fetchShiftAttendanceByLine(dbPool, todayStr) {
    const prevDayFilter = "CONVERT(VARCHAR, DATEADD(day, -1, CAST(@todayDate AS DATE)), 23)";

    const makeMap = (rows) => {
        const map = new Map();
        rows.forEach(r => map.set(r.lineId, r));
        return map;
    };

    const baseCte = `
        WITH latest_uhs AS (
            SELECT *
            FROM (
                SELECT
                    uhs.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY UPPER(LTRIM(RTRIM(uhs.employeeid)))
                        ORDER BY uhs.id DESC
                    ) AS rn
                FROM user_hierarchy_snapshots uhs
                WHERE uhs.employeeid IS NOT NULL
                  AND LTRIM(RTRIM(uhs.employeeid)) <> ''
            ) x
            WHERE x.rn = 1
        )`;

    try {
        const rows = (await dbPool.request()
            .input("todayDate", todayStr)
            .query(`
                ${baseCte}
                SELECT
                    l.id AS lineId,
                    COUNT(DISTINCT al.payCode) AS totalPresent,
                    SUM(CASE WHEN LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'G%' OR LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'GEN%' THEN 1 ELSE 0 END) AS shiftGeneral,
                    SUM(CASE WHEN LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'A%' THEN 1 ELSE 0 END) AS shiftA,
                    SUM(CASE WHEN LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'B%' THEN 1 ELSE 0 END) AS shiftB,
                    SUM(CASE WHEN LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'C%' OR LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'D%' THEN 1 ELSE 0 END) AS shiftC,
                    CAST(SUM(COALESCE(al.otHrs, 0)) / 8.0 AS DECIMAL(10,2)) AS totalOtHrs,
                    CAST(SUM(COALESCE(al.hrsWorked, 0)) AS DECIMAL(10,2)) AS totalHrsWorked
                FROM attendance_logs al
                INNER JOIN latest_uhs uhs
                    ON  UPPER(LTRIM(RTRIM(uhs.employeeid))) = UPPER(LTRIM(RTRIM(al.payCode)))
                INNER JOIN [lines] l
                    ON  UPPER(LTRIM(RTRIM(l.uniCode))) = UPPER(LTRIM(RTRIM(uhs.line_unicode)))
                    AND l.isActive = 1
                WHERE CONVERT(VARCHAR, al.date, 23) = ${prevDayFilter}
                  AND al.payCode IS NOT NULL
                  AND UPPER(LTRIM(RTRIM(ISNULL(al.status, '')))) IN ('PRESENT', 'P')
                  AND ISNULL(uhs.line_unicode,'') <> ''
                GROUP BY l.id
            `)).recordset || [];

        console.log(`[fetchShiftAttendanceByLine] primary rows Yesterday: ${rows.length}`);
        return makeMap(rows);

    } catch (e1) {
        console.error("[fetchShiftAttendanceByLine] primary failed:", e1.message);

        try {
            const rows = (await dbPool.request()
                .input("todayDate", todayStr)
                .query(`
                    ${baseCte}
                    SELECT
                        l.id AS lineId,
                        COUNT(DISTINCT al.cardNo) AS totalPresent,
                        SUM(CASE WHEN LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'G%' OR LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'GEN%' THEN 1 ELSE 0 END) AS shiftGeneral,
                        SUM(CASE WHEN LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'A%' THEN 1 ELSE 0 END) AS shiftA,
                        SUM(CASE WHEN LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'B%' THEN 1 ELSE 0 END) AS shiftB,
                        SUM(CASE WHEN LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'C%' OR LTRIM(RTRIM(UPPER(ISNULL(al.shift,'')))) LIKE 'D%' THEN 1 ELSE 0 END) AS shiftC,
                        CAST(SUM(COALESCE(al.otHrs, 0)) / 8.0 AS DECIMAL(10,2)) AS totalOtHrs,
                        CAST(SUM(COALESCE(al.hrsWorked, 0)) AS DECIMAL(10,2)) AS totalHrsWorked
                    FROM attendance_logs al
                    INNER JOIN latest_uhs uhs
                        ON  UPPER(LTRIM(RTRIM(uhs.employeeid))) = UPPER(LTRIM(RTRIM(al.cardNo)))
                    INNER JOIN [lines] l
                        ON  UPPER(LTRIM(RTRIM(l.uniCode))) = UPPER(LTRIM(RTRIM(uhs.line_unicode)))
                        AND l.isActive = 1
                    WHERE CONVERT(VARCHAR, al.date, 23) = ${prevDayFilter}
                      AND al.cardNo IS NOT NULL
                      AND UPPER(LTRIM(RTRIM(ISNULL(al.status, '')))) IN ('PRESENT', 'P')
                      AND ISNULL(uhs.line_unicode,'') <> ''
                    GROUP BY l.id
                `)).recordset || [];

            console.log(`[fetchShiftAttendanceByLine] fallback rows Yesterday: ${rows.length}`);
            return makeMap(rows);

        } catch (e2) {
            console.error("[fetchShiftAttendanceByLine] fallback failed:", e2.message);
            return new Map();
        }
    }
}


// =================================================
// GET REPORT DATA
// =================================================
export const getReportData = async () => {
    const dbPool = await poolPromise;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const reportDate = new Date(today);
    reportDate.setDate(reportDate.getDate() - 1); // Yesterday is the report date
    const monthName = MONTH_NAMES[reportDate.getMonth()];
    const yearVal = reportDate.getFullYear();
    const reportDay = reportDate.getDate();

    const deptSections = await fetchDeptSections(dbPool);
    const reqMap = await fetchRequirements(dbPool, monthName, yearVal, reportDay);
    const actualMap = await fetchActualMPBySection(dbPool);
    const availMap = await fetchAvailableMPBySection(dbPool, todayStr);

    const result = deptSections.map(row => ({
        deptId: row.deptId,
        department_name: row.department_name,
        department_code: row.department_code,
        sectionId: row.sectionId,
        section_name: row.section_name,
        section_code: row.section_code,
        category: row.category,
        totalRequired: row.section_code ? (reqMap.get((row.section_code || "").toUpperCase().trim()) || 0) : 0,
        totalPresent: row.sectionId ? getNum(availMap.get(row.sectionId), "totalPresent") : 0,
        totalAssigned: row.sectionId ? (actualMap.get(row.sectionId) || 0) : 0,
        totalOtHrs: row.sectionId ? getNum(availMap.get(row.sectionId), "totalOtHrs") : 0,
    }));

    console.log(`[getReportData] merged rows: ${result.length}`);
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

        const now = new Date();
        const currentDate = now.toLocaleDateString("en-GB").replace(/\//g, "-");
        const monthHeader = now.toLocaleString("default", { month: "short", year: "numeric" });

        // Calculate milestone date based on yesterday (reportDate)
        const reportDate = new Date(now);
        reportDate.setDate(reportDate.getDate() - 1);
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
        ws.getCell("G1").value = currentDate;

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
                writeSubRow(
                    "Total",
                    dReq + iReq,
                    dAvail + iAvail,
                    dAct + iAct,
                    dGap + iGap,
                    parseFloat((dOT + iOT).toFixed(2))
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
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        
        const reportDate = new Date(today);
        reportDate.setDate(reportDate.getDate() - 1); // Yesterday is the report date
        const monthName = MONTH_NAMES[reportDate.getMonth()];
        const yearVal = reportDate.getFullYear();
        const reportDay = reportDate.getDate();

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

        const reqMap = await fetchRequirements(dbPool, monthName, yearVal, reportDay);
        const lineReqResult = await fetchLineRequirements(dbPool, reportDate.getMonth() + 1, yearVal, reportDay);
        const lineReqMap = lineReqResult.byLine;
        const lineReqSectionMap = lineReqResult.bySection;

        const handSecRows = (await dbPool.request().query(`
            WITH latest_uhs AS (
                SELECT *
                FROM (
                    SELECT
                        uhs.*,
                        ROW_NUMBER() OVER (
                            PARTITION BY UPPER(LTRIM(RTRIM(uhs.employeeid)))
                            ORDER BY uhs.id DESC
                        ) AS rn
                    FROM user_hierarchy_snapshots uhs
                    WHERE uhs.employeeid IS NOT NULL
                      AND LTRIM(RTRIM(uhs.employeeid)) <> ''
                ) x
                WHERE x.rn = 1
            )
            SELECT
                s.id AS sectionId,
                COUNT(DISTINCT latest_uhs.employeeid) AS cnt
            FROM latest_uhs
            INNER JOIN sections s
                ON  UPPER(LTRIM(RTRIM(s.uniCode))) = UPPER(LTRIM(RTRIM(latest_uhs.section_unicode)))
                AND s.isActive = 1
            WHERE latest_uhs.section_unicode IS NOT NULL
              AND LTRIM(RTRIM(latest_uhs.section_unicode)) <> ''
            GROUP BY s.id
        `)).recordset || [];

        const handSecMap = new Map();
        handSecRows.forEach(r => handSecMap.set(r.sectionId, Number(r.cnt) || 0));

        const handLineRows = (await dbPool.request().query(`
            WITH latest_uhs AS (
                SELECT *
                FROM (
                    SELECT
                        uhs.*,
                        ROW_NUMBER() OVER (
                            PARTITION BY UPPER(LTRIM(RTRIM(uhs.employeeid)))
                            ORDER BY uhs.id DESC
                        ) AS rn
                    FROM user_hierarchy_snapshots uhs
                    WHERE uhs.employeeid IS NOT NULL
                      AND LTRIM(RTRIM(uhs.employeeid)) <> ''
                ) x
                WHERE x.rn = 1
            )
            SELECT
                l.id AS lineId,
                COUNT(DISTINCT latest_uhs.employeeid) AS cnt
            FROM latest_uhs
            INNER JOIN [lines] l
                ON  UPPER(LTRIM(RTRIM(l.uniCode))) = UPPER(LTRIM(RTRIM(latest_uhs.line_unicode)))
                AND l.isActive = 1
            WHERE latest_uhs.line_unicode IS NOT NULL
              AND LTRIM(RTRIM(latest_uhs.line_unicode)) <> ''
            GROUP BY l.id
        `)).recordset || [];

        const handLineMap = new Map();
        handLineRows.forEach(r => handLineMap.set(r.lineId, Number(r.cnt) || 0));

        const attSecMap = await fetchShiftAttendanceBySection(dbPool, todayStr);
        const attLineMap = await fetchShiftAttendanceByLine(dbPool, todayStr);

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

            sections.forEach(s => {
                const sc = (s.section_code || "").toUpperCase().trim();
                const att = attSecMap.get(s.sectionId) || {};

                dReq += reqMap.get(sc) || 0;
                dHand += handSecMap.get(s.sectionId) || 0;
                dGen += getNum(att, "shiftGeneral");
                dA += getNum(att, "shiftA");
                dB += getNum(att, "shiftB");
                dC += getNum(att, "shiftC");
                dAct += getNum(att, "totalPresent");
                dOT += getNum(att, "totalOtHrs");
                dHrs += getNum(att, "totalHrsWorked");
            });

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

                // Detailed Attendance Report requirement must come from line_requirements only.
                // Do not use requirements table here, even if the section has a single line or no active line.
                const secReq = lineReqSectionMap.get(Number(sec.sectionId)) || 0;
                const secHand = handSecMap.get(sec.sectionId) || 0;
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
                        sz: 11
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
                        const lHand = handLineMap.get(ln.lineId) || 0;
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
                            sz: 11
                        });

                        row.getCell(3).value = lReq;
                        styleCell(row.getCell(3), { sz: 11 });
                        setYellow(row.getCell(3));

                        row.getCell(4).value = lHand || "";
                        row.getCell(5).value = lGen || "";
                        row.getCell(6).value = lA || "";
                        row.getCell(7).value = lB || "";
                        row.getCell(8).value = lC || "";
                        row.getCell(9).value = lAct || "";
                        row.getCell(10).value = lOT !== 0 ? parseFloat(lOT.toFixed(2)) : "";
                        row.getCell(11).value = lHrs !== 0 ? parseFloat(lHrs.toFixed(2)) : "";
                        row.getCell(12).value = getPct(lAct, lReq);
                        row.getCell(13).value = getPct(lAct, lHand);

                        for (let c = 4; c <= 13; c++) {
                            styleCell(row.getCell(c), { sz: 11 });
                        }

                        ri++;
                    });

                    // Section total should be the full line_requirements section total.
                    // If sectionId total is missing for old records, fall back to sum of displayed line rows.
                    const totalReqForSection = lineReqSectionMap.get(Number(sec.sectionId)) || totReq;

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
                        [4, totHand],
                        [5, totGen],
                        [6, totA],
                        [7, totB],
                        [8, totC],
                        [9, totAct]
                    ].forEach(([c, v]) => {
                        tr.getCell(c).value = v;
                        styleCell(tr.getCell(c), {
                            bold: true,
                            bg: C.TOTAL_BG,
                            sz: 11
                        });
                    });

                    tr.getCell(10).value = parseFloat(totOT.toFixed(2));
                    tr.getCell(11).value = parseFloat(totHrs.toFixed(2));
                    tr.getCell(12).value = getPct(totAct, totalReqForSection);
                    tr.getCell(13).value = getPct(totAct, totHand);

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
        const buffer = await _buildManpowerBuffer();

        if (!buffer) {
            console.error("[generateAndSend] Buffer NULL");
            return;
        }

        const dt = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");

        await transporter.sendMail({
            from: `"Manpower System" <${process.env.SMTP_USERNAME}>`,
            to: emails,
            subject: `Daily Manpower Report - ${dt}`,
            html: `<p>Please find attached the daily manpower report for <b>${dt}</b>.</p>`,
            attachments: [{
                filename: `Daily_Manpower_Report_${dt}.xlsx`,
                content: Buffer.from(buffer),
                contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }]
        });

        console.log(`[generateAndSend] Sent to: ${emails.join(", ")}`);

    } catch (err) {
        console.error("[generateAndSend] ERROR:", err);
    }
};


// =================================================
// SEND MANAGEMENT DAILY REPORT ONLY
// =================================================
export const generateAndSendManagementDaily = async (emails) => {
    try {
        const buffer = await _buildManagementBuffer();

        if (!buffer) {
            console.error("[generateAndSendManagementDaily] Buffer NULL");
            return;
        }

        const dt = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");

        await transporter.sendMail({
            from: `"Management System" <${process.env.SMTP_USERNAME}>`,
            to: emails,
            subject: `Daily Management Report - ${dt}`,
            html: `<p>Please find attached the Daily Management Attendance Report for <b>${dt}</b>.</p>`,
            attachments: [{
                filename: `Daily_Management_Report_${dt}.xlsx`,
                content: Buffer.from(buffer),
                contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }]
        });

        console.log(`[generateAndSendManagementDaily] Sent to: ${emails.join(", ")}`);

    } catch (err) {
        console.error("[generateAndSendManagementDaily] ERROR:", err);
    }
};


// =================================================
// SEND BOTH REPORTS
// =================================================
export async function sendBothReports(emails) {
    try {
        const dt = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");

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
            return;
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
    }
}


export default {
    getReportData,
    generateAndSend,
    generateAndSendManagementDaily,
    sendBothReports
};