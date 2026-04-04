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
                s.name AS section_name,
                COALESCE(req.totalRequired, 0) AS totalRequired,
                COALESCE(usr.totalActual, 0) AS totalActual
            FROM sections s
            LEFT JOIN (
                SELECT section_name, SUM(prod_plan) as totalRequired 
                FROM requirements 
                WHERE month_name = DATENAME(month, GETDATE()) 
                AND year_val = YEAR(GETDATE())
                GROUP BY section_name
            ) req ON s.name = req.section_name
            LEFT JOIN (
                -- Using users table to count actual M/P if sectionId maps. Wait!
                -- users table has sectionId.
                SELECT sectionId, COUNT(*) as totalActual 
                FROM users u 
                WHERE u.isDeleted = 0 AND u.role != 'admin'
                GROUP BY sectionId
            ) usr ON s.id = usr.sectionId
            ORDER BY s.name
        `;

        const result = await pool.query(querySql);
        return result.recordset || [];
    } catch (error) {
        console.error("Database Query Error:", error);
        return [];
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
        const worksheet = workbook.addWorksheet('Manpower Report', {
            views: [{ showGridLines: true }]
        });

        // Setup Columns matching image
        worksheet.columns = [
            { key: 'section', width: 45 },
            { key: 'required', width: 22 },
            { key: 'available', width: 22 },
            { key: 'actual', width: 22 },
            { key: 'gap', width: 15 },
            { key: 'ot', width: 18 }
        ];

        const BLUE_BG = 'FFB4C6E7';
        const YELLOW_BG = 'FFFFFF00';

        // Add 2 spacer rows at start (to match image starting from Row 1 with dates)
        // Row 1: Merged cell for "9 Feb" over Available, Actual, Gap.
        // Full date "09-02-2026" on OT mandays cell.
        const d = new Date();
        const shortDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const exactDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

        const row1 = worksheet.getRow(1);
        row1.height = 20;

        // Merge Columns C, D, E for short date text
        worksheet.mergeCells('C1:E1');
        const c1 = worksheet.getCell('C1');
        c1.value = shortDate;
        c1.font = { bold: true };
        c1.alignment = { horizontal: 'center', vertical: 'middle' };
        c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_BG } };
        // Apply borders to merged cells
        ['C1', 'D1', 'E1'].forEach(cell => {
            worksheet.getCell(cell).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        });

        const f1 = worksheet.getCell('F1');
        f1.value = exactDate;
        f1.font = { bold: true };
        f1.alignment = { horizontal: 'center', vertical: 'middle' };
        f1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_BG } };
        f1.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

        // Row 2: Headers
        const headerRow = worksheet.getRow(2);
        headerRow.height = 30; // taller header to fit text
        headerRow.values = [
            'Section',
            'Total required\nM/P',
            'Total\nAvailable\nM/P',
            'Total\nActual\nM/P',
            'Gap',
            'OT\nmandays'
        ];

        headerRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
            
            if (colNumber === 2) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_BG } };
            } else if (colNumber > 2) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_BG } };
            }
        });

        // Data Population
        let grandRequired = 0, grandAvailable = 0, grandActual = 0, grandGap = 0, grandOt = 0;
        let contentStartRow = 3;

        reportData.forEach((item, i) => {
            const currentRow = contentStartRow + i;
            const required = Math.round(Number(item.totalRequired)) || 0;
            const available = required; // As per existing logic/image
            const actualVal = Number(item.totalActual) || 0;
            const gapVal = actualVal - required;
            const otVal = 0; // Default OT mandays

            grandRequired += required;
            grandAvailable += available;
            grandActual += actualVal;
            grandGap += gapVal;
            grandOt += otVal;

            const row = worksheet.getRow(currentRow);
            row.values = { 
                section: item.section_name, 
                required: required, 
                available: available, 
                actual: actualVal, 
                gap: gapVal, 
                ot: otVal 
            };
            
            row.eachCell((cell, colNumber) => {
                cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                // Center align all numbers
                if (colNumber > 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
                
                // Set Column background colors
                if (colNumber === 2) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_BG } };
                } else if (colNumber > 2) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_BG } };
                }
            });
        });

        // Footer Row
        const totalRowIndex = contentStartRow + (reportData.length || 0);
        const totalRow = worksheet.getRow(totalRowIndex);
        
        totalRow.values = ["", grandRequired, grandAvailable, grandActual, grandGap, grandOt];
        
        totalRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
            
            // In the image, the total row is entirely light blue, except the last cell (OT) is Yellow
            if (colNumber === 6) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_BG } };
            } else if (colNumber > 1) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_BG } };
            } else {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_BG } };
            }
        });

        // Send Email
        const buffer = await workbook.xlsx.writeBuffer();
        await transporter.sendMail({
            from: `"Manpower System" <${process.env.SMTP_USERNAME}>`,
            to: Array.isArray(emails) ? emails.join(',') : emails,
            subject: `Production Manpower Report - ${exactDate} ${subjectSuffix}`,
            html: `<h3>Manpower Daily Report</h3><p>Attached is the Excel manpower report grouped by sections.</p>`,
            attachments: [{ filename: `Manpower_Report_${exactDate}.xlsx`, content: buffer }]
        });

        console.log(`✅ Email sent successfully`);

    } catch (error) {
        console.error("❌ FATAL ERROR in generateAndSend:", error.message);
        throw error;
    }
};

export default { getReportData, generateAndSend };