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
// GET REPORT DATA
// Returns ALL departments. Departments without
// active sections will still appear with null
// section fields.
// =================================================
export const getReportData = async () => {
    try {
        const dbPool = await poolPromise;

        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);

        const monthNames = [
            'January', 'February', 'March', 'April',
            'May', 'June', 'July', 'August',
            'September', 'October', 'November', 'December'
        ];

        const monthName = monthNames[today.getMonth()];
        const monthNumber = today.getMonth() + 1;
        const yearVal = today.getFullYear();

        // ── ORIGINAL QUERY — completely untouched ─────
        const query = `
            SELECT
                d.id            AS deptId,
                d.name          AS department_name,
                d.uniCode       AS department_code,

                s.id            AS sectionId,
                s.name          AS section_name,
                s.uniCode       AS section_code,
                s.category,

                COALESCE(req.totalRequired, 0) AS totalRequired,
                COALESCE(att.totalPresent,  0) AS totalPresent,
                COALESCE(att.totalActual,   0) AS totalActual,

                COALESCE(att.totalPresent, 0)
                    - (COALESCE(att.totalActual, 0) - COALESCE(att.totalPresent, 0))
                AS gap

            FROM departments d

            -- LEFT JOIN so departments with no active sections still appear
            LEFT JOIN sections s
                ON d.id = s.departmentId
                AND s.isActive = 1

            LEFT JOIN (
                SELECT
                    UPPER(LTRIM(RTRIM(sectionCode))) AS secCode,
                    SUM(prodPlan) AS totalRequired
                FROM requirements
                WHERE monthName   = @monthName
                  AND monthNumber = @monthNumber
                  AND year        = @yearVal
                GROUP BY UPPER(LTRIM(RTRIM(sectionCode)))
            ) req ON req.secCode = UPPER(LTRIM(RTRIM(s.uniCode)))

            LEFT JOIN (
                SELECT
                    u.sectionId,
                    SUM(CASE WHEN UPPER(al.status) = 'PRESENT' THEN 1 ELSE 0 END) AS totalPresent,
                    COUNT(*) AS totalActual
                FROM attendance_logs al
                INNER JOIN users u ON u.id = al.userId
                WHERE CONVERT(date, al.date) = @todayDate
                  AND UPPER(al.status) IN ('PRESENT', 'ABSENT')
                GROUP BY u.sectionId
            ) att ON att.sectionId = s.id

            ORDER BY
                -- Departments with NO sections first
                CASE WHEN s.id IS NULL THEN 0 ELSE 1 END ASC,
                d.name ASC,
                s.name ASC
        `;

        const result = await dbPool.request()
            .input("monthName", monthName)
            .input("monthNumber", monthNumber)
            .input("yearVal", yearVal)
            .input("todayDate", todayStr)
            .query(query);

        // ── SEPARATE OT QUERY ─────────────────────────
        // Runs independently so it can never affect the
        // main data above. If it fails, report still sends
        // with OT = 0 for all sections.
        //
        // Logic:
        //   1. Find today's attendance rows
        //   2. Match payCode -> user_hierarchy_snapshots.employeeId
        //   3. From that, get the user's sectionId
        //   4. SUM(otHrs) per sectionId, then divide by 8 in JS
        // ─────────────────────────────────────────────
        let otBySectionId = {};
        try {
            const otResult = await dbPool.request()
                .input("todayDate", todayStr)
                .query(`
                    SELECT
                        u.sectionId,
                        SUM(COALESCE(a.otHrs, 0)) AS totalOtHrs
                    FROM attendance a
                    INNER JOIN user_hierarchy_snapshots uhs
                        ON UPPER(LTRIM(RTRIM(a.payCode))) = UPPER(LTRIM(RTRIM(uhs.employeeId)))
                    INNER JOIN users u
                        ON u.id = uhs.userId
                    WHERE CONVERT(date, a.date) = @todayDate
                    GROUP BY u.sectionId
                `);

            (otResult.recordset || []).forEach(row => {
                otBySectionId[row.sectionId] = Number(row.totalOtHrs) || 0;
            });
        } catch (otErr) {
            // OT query failed — log it but don't crash the report
            console.error("[getReportData] OT query failed, OT will show 0:", otErr);
        }

        // ── Attach overtimeValue (otHrs / 8) to each row
        const records = result.recordset || [];
        records.forEach(r => {
            const rawOT = r.sectionId ? (otBySectionId[r.sectionId] || 0) : 0;
            r.overtimeValue = rawOT / 8;
        });

        return records;

    } catch (e) {
        console.error("[getReportData]", e);
        return [];
    }
};


// =================================================
// GENERATE AND SEND
// =================================================
export const generateAndSend = async (emails) => {
    try {
        const data = await getReportData();

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Manpower Report");

        // ── Colours ──────────────────────────────────
        const HEADER = "FF1F3B63";
        const DEPT = "FF2F75B5";
        const SECTION = "FFDCE6F1";
        const SUBTOT = "FFF2F2F2";
        const GRAND = "FFFFC000";
        const WHITE = "FFFFFFFF";
        const RED = "FFFF0000";
        const BLACK = "FF000000";

        // ── Column widths ─────────────────────────────
        ws.columns = [
            { width: 22 },   // A  Department Name
            { width: 14 },   // B  Dept Code
            { width: 30 },   // C  Section Name
            { width: 18 },   // D  Section Code
            { width: 16 },   // E  Direct/Indirect
            { width: 16 },   // F  Total Required
            { width: 16 },   // G  Available M/P
            { width: 16 },   // H  Actual M/P
            { width: 12 },   // I  Gap
            { width: 12 },   // J  OT (Overtime)
        ];

        // ── Style helpers ─────────────────────────────
        const applyBorder = (cell, thick = false) => {
            const s = { style: thick ? "medium" : "thin" };
            cell.border = { top: s, bottom: s, left: s, right: s };
        };

        const styleCell = (cell, {
            bold = false,
            color = BLACK,
            bg = null,
            hAlign = "center",
            vAlign = "middle",
            wrap = false,
            thick = false,
            fontSize = 10
        } = {}) => {
            cell.font = { bold, color: { argb: color }, size: fontSize, name: "Calibri" };
            cell.alignment = { horizontal: hAlign, vertical: vAlign, wrapText: wrap };
            applyBorder(cell, thick);
            if (bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        };

        // Fill a cell with dept background (used after merging)
        const makeDeptCell = (cell, value) => {
            cell.value = value;
            styleCell(cell, {
                bold: true, color: WHITE, bg: DEPT,
                hAlign: "center", vAlign: "middle", wrap: true
            });
        };

        // ── Dates ─────────────────────────────────────
        const now = new Date();
        const currentDate = now.toLocaleDateString("en-GB").replace(/\//g, "-");
        const monthHeader = now.toLocaleString("default", { month: "short", year: "numeric" });

        // ── ROW 1: merged header spans ────────────────
        ws.mergeCells("A1:D1");
        ws.mergeCells("E1:F1");
        ws.mergeCells("G1:J1");   // extended to cover new OT column

        ws.getCell("A1").value = monthHeader;
        ws.getCell("E1").value = currentDate;
        ws.getCell("G1").value = currentDate;

        ["A1", "E1", "G1"].forEach(ref => {
            styleCell(ws.getCell(ref), { bold: true, color: WHITE, bg: HEADER });
        });

        ws.getRow(1).height = 20;

        // ── ROW 2: column headers ─────────────────────
        const headerRow = ws.getRow(2);
        headerRow.values = [
            "Department Name", "Dept Code",
            "Section Name", "Section Code",
            "Direct/Indirect", "Total Required",
            "Available M/P", "Actual M/P", "Gap", "OT"
        ];
        headerRow.eachCell({ includeEmpty: true }, cell => {
            styleCell(cell, { bold: true, color: WHITE, bg: HEADER });
        });
        headerRow.height = 22;

        // ── Group ALL data by department ──────────────
        // Preserve order returned by SQL (no-section depts first)
        const deptMap = new Map();   // key = dept_code || dept_name
        const deptOrder = [];          // preserve insertion order

        data.forEach(r => {
            const key = r.department_code || r.department_name;
            if (!deptMap.has(key)) {
                deptMap.set(key, {
                    name: r.department_name,
                    code: r.department_code,
                    sections: []          // stays empty if dept has no sections
                });
                deptOrder.push(key);
            }
            // Only push if there is actually a section on this row
            if (r.section_name) {
                deptMap.get(key).sections.push(r);
            }
        });

        // ── Standard row height (matches section rows) ─
        const STD_ROW_H = 18;

        let rowIndex = 3;
        let grandReq = 0;
        let grandAvail = 0;
        let grandAct = 0;
        let grandGap = 0;
        let grandOT = 0;

        // ── Write every department ────────────────────
        for (const key of deptOrder) {
            const dept = deptMap.get(key);
            const sections = dept.sections;
            const hasSecs = sections.length > 0;

            const deptStartRow = rowIndex;

            if (!hasSecs) {
                // ======================================
                // DEPARTMENT WITH NO SECTIONS
                // Render exactly 3 rows (same size as
                // Direct/Indirect/Total subtotal block)
                // so the dept cell height is identical
                // to departments that have sections.
                // Cols C–J are empty.
                // ======================================
                for (let i = 0; i < 3; i++) {
                    const row = ws.getRow(rowIndex);
                    row.height = STD_ROW_H;
                    for (let col = 1; col <= 10; col++) {
                        const cell = row.getCell(col);
                        cell.value = "";
                        styleCell(cell, {
                            bg: col <= 2 ? DEPT : SECTION,
                            color: col <= 2 ? WHITE : BLACK
                        });
                    }
                    rowIndex++;
                }

                // Merge dept name & code across those 3 rows
                ws.mergeCells(`A${deptStartRow}:A${rowIndex - 1}`);
                makeDeptCell(ws.getCell(`A${deptStartRow}`), dept.name);

                ws.mergeCells(`B${deptStartRow}:B${rowIndex - 1}`);
                makeDeptCell(ws.getCell(`B${deptStartRow}`), dept.code);

            } else {
                // ======================================
                // DEPARTMENT WITH SECTIONS
                // ======================================
                let dirReq = 0, dirAvail = 0, dirAct = 0, dirGap = 0, dirOT = 0;
                let indReq = 0, indAvail = 0, indAct = 0, indGap = 0, indOT = 0;

                // ── Section rows ──────────────────────
                sections.forEach(item => {
                    const isInd = (item.category || "").toLowerCase() === "indirect";
                    const type = isInd ? "Indirect" : "Direct";
                    const req = Number(item.totalRequired) || 0;
                    const avail = Number(item.totalPresent) || 0;
                    const actual = Number(item.totalActual) || 0;
                    const gap = Number(item.gap) || 0;
                    const ot = Number(item.overtimeValue) || 0;

                    if (isInd) {
                        indReq += req; indAvail += avail; indAct += actual; indGap += gap; indOT += ot;
                    } else {
                        dirReq += req; dirAvail += avail; dirAct += actual; dirGap += gap; dirOT += ot;
                    }

                    grandReq += req;
                    grandAvail += avail;
                    grandAct += actual;
                    grandGap += gap;
                    grandOT += ot;

                    const row = ws.getRow(rowIndex);
                    row.height = STD_ROW_H;

                    // A & B will be dept cells (merged later — set blank now)
                    row.getCell(1).value = "";
                    row.getCell(2).value = "";
                    row.getCell(3).value = item.section_name;
                    row.getCell(4).value = item.section_code;
                    row.getCell(5).value = type;
                    row.getCell(6).value = req;
                    row.getCell(7).value = avail;
                    row.getCell(8).value = actual;
                    row.getCell(9).value = gap;
                    row.getCell(10).value = parseFloat(ot.toFixed(2));

                    for (let col = 1; col <= 10; col++) {
                        const cell = row.getCell(col);
                        styleCell(cell, {
                            bg: col <= 2 ? DEPT : SECTION,
                            color: col <= 2 ? WHITE
                                : (col === 9 && gap < 0 ? RED : BLACK),
                            bold: col <= 2,
                            hAlign: "center",
                            vAlign: "middle"
                        });
                    }

                    rowIndex++;
                });

                const sectionEndRow = rowIndex - 1;
                const subtotalStartRow = rowIndex;

                // ── Subtotal block: Direct / Indirect / Total ──
                const writeSubRow = (label, req, avail, actual, gap, ot) => {
                    const row = ws.getRow(rowIndex);
                    row.height = STD_ROW_H;

                    row.getCell(1).value = "";   // dept merge
                    row.getCell(2).value = "";   // dept merge
                    row.getCell(3).value = "";   // "Total manpower" merge (set below)
                    row.getCell(4).value = "";   // blank
                    row.getCell(5).value = label;

                    // Show value only if non-zero, else blank for cleaner look
                    row.getCell(6).value = req !== 0 ? req : "";
                    row.getCell(7).value = avail !== 0 ? avail : "";
                    row.getCell(8).value = actual !== 0 ? actual : "";
                    row.getCell(9).value = gap !== 0 ? gap : "";
                    row.getCell(10).value = ot !== 0 ? parseFloat(ot.toFixed(2)) : "";

                    for (let col = 1; col <= 10; col++) {
                        const cell = row.getCell(col);
                        styleCell(cell, {
                            bg: col <= 2 ? DEPT : SUBTOT,
                            color: col <= 2 ? WHITE
                                : (col === 9 && typeof gap === "number" && gap < 0 ? RED : BLACK),
                            bold: col === 5,
                            hAlign: "center",
                            vAlign: "middle"
                        });
                    }

                    rowIndex++;
                };

                writeSubRow("Direct",
                    dirReq, dirAvail, dirAct, dirGap, dirOT);
                writeSubRow("Indirect",
                    indReq, indAvail, indAct, indGap, indOT);
                writeSubRow("Total",
                    dirReq + indReq,
                    dirAvail + indAvail,
                    dirAct + indAct,
                    dirGap + indGap,
                    dirOT + indOT);

                const subtotalEndRow = rowIndex - 1;

                // ── "Total manpower" label: merge C across subtotal rows ──
                ws.mergeCells(`C${subtotalStartRow}:C${subtotalEndRow}`);
                const tmCell = ws.getCell(`C${subtotalStartRow}`);
                tmCell.value = "Total manpower";
                styleCell(tmCell, {
                    bold: true, bg: SUBTOT,
                    hAlign: "center", vAlign: "middle"
                });

                // ── Merge D across subtotal rows (blank) ──
                ws.mergeCells(`D${subtotalStartRow}:D${subtotalEndRow}`);
                styleCell(ws.getCell(`D${subtotalStartRow}`), { bg: SUBTOT });

                // ── Merge dept name across ALL rows of this dept ──
                ws.mergeCells(`A${deptStartRow}:A${subtotalEndRow}`);
                makeDeptCell(ws.getCell(`A${deptStartRow}`), dept.name);

                ws.mergeCells(`B${deptStartRow}:B${subtotalEndRow}`);
                makeDeptCell(ws.getCell(`B${deptStartRow}`), dept.code);
            }
        }

        // ── GRAND TOTAL ───────────────────────────────
        const gtRow = ws.getRow(rowIndex);
        gtRow.height = 22;

        ws.mergeCells(`A${rowIndex}:E${rowIndex}`);
        const gtLabel = ws.getCell(`A${rowIndex}`);
        gtLabel.value = "GRAND TOTAL";
        styleCell(gtLabel, {
            bold: true, bg: GRAND,
            hAlign: "center", vAlign: "middle", thick: true
        });

        [grandReq, grandAvail, grandAct, grandGap, grandOT].forEach((val, i) => {
            const cell = gtRow.getCell(6 + i);
            cell.value = i === 4 ? parseFloat(val.toFixed(2)) : val;
            styleCell(cell, {
                bold: true, bg: GRAND,
                color: (i === 3 && val < 0) ? RED : BLACK,
                hAlign: "center", vAlign: "middle", thick: true
            });
        });

        // ── Freeze top 2 rows ─────────────────────────
        ws.views = [{ state: "frozen", ySplit: 2 }];

        // ── Send email ────────────────────────────────
        const buffer = await wb.xlsx.writeBuffer();

        await transporter.sendMail({
            from: `"Manpower System" <${process.env.SMTP_USERNAME}>`,
            to: emails,
            subject: `Daily Manpower Report - ${currentDate}`,
            html: `<p>Please find attached the daily manpower report for <b>${currentDate}</b>.</p>`,
            attachments: [{
                filename: `Daily_Manpower_Report_${currentDate}.xlsx`,
                content: buffer
            }]
        });

        console.log("Report Sent Successfully");

    } catch (err) {
        console.error("[generateAndSend]", err);
    }
};


export default { getReportData, generateAndSend };