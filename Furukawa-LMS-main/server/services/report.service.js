import { poolPromise } from "../db/connectDB.js";
import ExcelJS from "exceljs";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    pool: true,
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
    },
    tls: { rejectUnauthorized: false }
});

export const getReportData = async () => {
    try {
        const dbPool = await poolPromise;
        
        // Yesterday's Date Calculation (Target Date)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const targetDateStr = yesterday.toISOString().slice(0, 10); 

        const mainQuery = `
            -- Step 1: Snapshots se employee aur unke section ki mapping nikalna
            WITH EmployeeSectionMap AS (
                SELECT DISTINCT 
                    LTRIM(RTRIM(employeeid)) AS empId,
                    LTRIM(RTRIM(UPPER(section_unicode))) AS secUni
                FROM user_hierarchy_snapshots
                WHERE employeeid IS NOT NULL 
                  AND section_unicode IS NOT NULL 
                  AND LTRIM(RTRIM(section_unicode)) <> ''
            ),

            -- Step 2: Attendance logs ko snapshots ke sath join karke section-wise count nikalna
            AttendanceStats AS (
                SELECT
                    esm.secUni,
                    SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT' THEN 1 ELSE 0 END) AS totalPresent,
                    COUNT(*) AS totalActual
                FROM attendance_logs al
                -- Join condition: attendance_logs.payCode = snapshots.employeeid
                INNER JOIN EmployeeSectionMap esm 
                    ON LTRIM(RTRIM(al.payCode)) = esm.empId
                WHERE CAST(al.[date] AS DATE) = @param0
                  AND UPPER(LTRIM(RTRIM(al.status))) IN ('PRESENT', 'ABSENT')
                GROUP BY esm.secUni
            )

            -- Step 3: Final Selection: Sections, Requirements, aur Mapped Attendance
            SELECT 
                base.section_unicode AS uniCode,
                base.section AS section_name,
                COALESCE(req.totalRequired, 0) AS totalRequired,
                COALESCE(att.totalPresent, 0)  AS totalPresent,
                COALESCE(att.totalActual, 0)   AS totalActual,
                -- Gap = Required - Available (Present)
                (COALESCE(req.totalRequired, 0) - COALESCE(att.totalPresent, 0)) AS gap
            FROM (
                -- Sabhi Sections ki master list snapshots se
                SELECT DISTINCT 
                    LTRIM(RTRIM(section)) AS section,
                    LTRIM(RTRIM(section_unicode)) AS section_unicode
                FROM user_hierarchy_snapshots
                WHERE section_unicode IS NOT NULL AND LTRIM(RTRIM(section_unicode)) <> ''
            ) base
            LEFT JOIN (
                -- Requirements data
                SELECT 
                    LTRIM(RTRIM(UPPER(sectionCode))) AS sec_code,
                    SUM(prodPlan) AS totalRequired
                FROM requirements
                WHERE monthName = DATENAME(month, GETDATE())
                  AND year = YEAR(GETDATE())
                GROUP BY LTRIM(RTRIM(UPPER(sectionCode)))
            ) req ON UPPER(base.section_unicode) = req.sec_code
            LEFT JOIN AttendanceStats att ON UPPER(base.section_unicode) = att.secUni
            ORDER BY base.section_unicode
        `;

        const result = await dbPool.request()
            .input('param0', targetDateStr)
            .query(mainQuery);

        return result.recordset || [];
    } catch (error) {
        console.error("[Report] Error fetching data:", error.message);
        return [];
    }
};

export const generateAndSend = async (emails, subjectSuffix = "") => {
    try {
        const reportData = await getReportData();
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Manpower Report');

        const BLUE_BG = 'FFB4C6E7';
        const YELLOW_BG = 'FFFFFF00';
        
        // Date formatting for Excel headers (Report ki date - Yesterday)
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const shortDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const exactDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

        worksheet.columns = [
            { key: 'unicode', width: 20 },
            { key: 'section', width: 40 },
            { key: 'required', width: 18 },
            { key: 'available', width: 18 },
            { key: 'actual', width: 18 },
            { key: 'gap', width: 12 }
        ];

        // Row 1 Setup
        worksheet.getRow(1).height = 25;
        worksheet.mergeCells('D1:E1');
        const d1 = worksheet.getCell('D1');
        d1.value = `Attendance: ${shortDate}`;
        d1.font = { bold: true };
        d1.alignment = { horizontal: 'center', vertical: 'middle' };
        d1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_BG } };

        const f1 = worksheet.getCell('F1');
        f1.value = exactDate;
        f1.font = { bold: true };
        f1.alignment = { horizontal: 'center', vertical: 'middle' };
        f1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_BG } };

        // Row 2: Headers
        const headerRow = worksheet.getRow(2);
        headerRow.height = 35;
        headerRow.values = ['Unicode', 'Section Name', 'Total Required', 'Total Available (Prev Day)', 'Total Actual', 'Gap'];
        
        headerRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            
            if (colNumber === 3) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_BG } };
            } else if (colNumber > 3) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_BG } };
            }
        });

        // Data Population
        let totals = { req: 0, avail: 0, act: 0, gap: 0 };
        
        reportData.forEach((item) => {
            const row = worksheet.addRow({
                unicode: item.uniCode,
                section: item.section_name,
                required: Math.round(item.totalRequired),
                available: Math.round(item.totalPresent), // Fourth Column
                actual: Math.round(item.totalActual),
                gap: Math.round(item.gap)
            });

            totals.req += Number(item.totalRequired);
            totals.avail += Number(item.totalPresent);
            totals.act += Number(item.totalActual);
            totals.gap += Number(item.gap);

            row.eachCell((cell, colNumber) => {
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                cell.alignment = { horizontal: colNumber <= 2 ? 'left' : 'center', vertical: 'middle' };
                if (colNumber === 3) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_BG } };
                } else if (colNumber > 3) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_BG } };
                }
            });
        });

        // Grand Total Row
        const footer = worksheet.addRow(["", "GRAND TOTAL", totals.req, totals.avail, totals.act, totals.gap]);
        footer.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_BG } };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        const buffer = await workbook.xlsx.writeBuffer();
        await transporter.sendMail({
            from: `"Manpower System" <${process.env.SMTP_USERNAME}>`,
            to: Array.isArray(emails) ? emails.join(',') : emails,
            subject: `Production Manpower Report (Previous Day) - ${exactDate}`,
            html: `<h3>Daily Manpower Report</h3><p>Attached is the report showing attendance count for <b>${exactDate}</b> mapped by Section.</p>`,
            attachments: [{ filename: `Manpower_Report_${exactDate}.xlsx`, content: buffer }]
        });

        console.log("✅ Previous Day Report Sent Successfully");
    } catch (error) {
        console.error("❌ generateAndSend Error:", error);
    }
};

export default { getReportData, generateAndSend };