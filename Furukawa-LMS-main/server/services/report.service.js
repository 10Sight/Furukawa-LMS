import { pool } from "../db/connectDB.js";
import ExcelJS from "exceljs";
import nodemailer from "nodemailer";

// 1. Transporter (Pooling Enabled)
const transporter = nodemailer.createTransport({
    pool: true,
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
    },
    tls: { rejectUnauthorized: false },
    maxConnections: 5,
    maxMessages: 100
});

export const getReportData = async () => {
    try {
        const querySql = `
            SELECT 
                d.name AS department_name,
                l.id AS sub_section_id,
                l.name AS sub_section_name,
                COALESCE(req.totalRequired, 0) AS totalRequired,
                (SELECT COUNT(*) FROM users u 
                 WHERE u.subSectionId = l.id 
                 AND u.isDeleted = 0 AND u.role != 'admin') AS totalActual
            FROM [lines] l
            JOIN departments d ON l.sectionId = d.id
            LEFT JOIN (
                SELECT subSectionId, SUM(prodPlan) as totalRequired 
                FROM requirements 
                WHERE month = DATENAME(month, GETDATE()) 
                AND year = YEAR(GETDATE())
                GROUP BY subSectionId
            ) req ON l.id = req.subSectionId
            WHERE d.status != 'CANCELLED'
            ORDER BY d.name, l.name
        `;

        const result = await pool.query(querySql);
        return result.recordset || [];
    } catch (error) {
        console.error("Database Query Error:", error);
        return []; // Error aane par empty array return karein taaki process na ruke
    }
};

export const generateAndSend = async (emails, subjectSuffix = "") => {
    try {
        console.log("Starting Report Generation...");

        const reportData = await getReportData();

        // CHANGE: Ab yahan 'return' nahi hai, process continue hoga
        if (!reportData || reportData.length === 0) {
            console.warn("⚠️ No data found in database. Generating an empty report.");
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Manpower Report');

        // Column Setup
        worksheet.columns = [
            { key: 'department', width: 20 },
            { key: 'section', width: 40 },
            { key: 'required', width: 18 },
            { key: 'available', width: 18 },
            { key: 'actual', width: 18 },
            { key: 'gap', width: 15 },
            { key: 'ot', width: 15 },
        ];

        // Header Section
        worksheet.mergeCells('A1:G1');
        worksheet.getCell('A1').value = 'Production Manpower Gap Report';
        worksheet.getCell('A1').font = { size: 14, bold: true };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        const fullDate = new Date().toLocaleDateString('en-GB');
        worksheet.getCell('A2').value = `Report Date: ${fullDate}`;

        // Table Headers
        const headerRow = worksheet.getRow(4);
        headerRow.values = ['Department', 'Section', 'Required (Plan)', 'Available', 'Actual', 'Gap', 'OT'];
        headerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center' };
            cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Data Population (Agar data empty hai toh yeh loop skip ho jayega)
        let grandAvailable = 0, grandActual = 0, grandGap = 0, grandRequired = 0;
        let contentStartRow = 5;

        reportData.forEach((item, i) => {
            const currentRow = contentStartRow + i;
            const required = Math.round(Number(item.totalRequired)) || 0;
            const actualVal = Number(item.totalActual) || 0;
            const gapVal = actualVal - required;

            grandRequired += required;
            grandActual += actualVal;
            grandGap += gapVal;

            const row = worksheet.getRow(currentRow);
            row.values = { department: item.department_name, section: item.sub_section_name, required, available: required, actual: actualVal, gap: gapVal, ot: 0 };
            row.eachCell((cell) => cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } });
        });

        // Footer Row
        const totalRowIndex = contentStartRow + (reportData.length || 0);
        const totalRow = worksheet.getRow(totalRowIndex);
        totalRow.values = ["TOTAL", "", grandRequired, grandRequired, grandActual, grandGap, 0];
        totalRow.font = { bold: true };

        // Send Email
        const buffer = await workbook.xlsx.writeBuffer();
        await transporter.sendMail({
            from: `"Manpower System" <${process.env.SMTP_USERNAME}>`,
            to: Array.isArray(emails) ? emails.join(',') : emails,
            subject: `Production Manpower Report - ${fullDate} ${subjectSuffix}`,
            html: `<h3>Manpower Daily Report</h3><p>Attached is the report. <b>Note:</b> No records were found for the current month.</p>`,
            attachments: [{ filename: `Manpower_Report_${fullDate.replace(/\//g, '-')}.xlsx`, content: buffer }]
        });

        console.log(`✅ Email sent successfully (File may be empty if no data).`);

    } catch (error) {
        console.error("❌ FATAL ERROR in generateAndSend:", error.message);
        throw error;
    }
};

export default { getReportData, generateAndSend };