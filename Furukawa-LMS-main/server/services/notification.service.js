import ExcelJS from "exceljs";
import sendMail from "../utils/mail.util.js";
import EmailConfiguration from "../models/emailConfiguration.model.js";
import Department from "../models/department.model.js";
import User from "../models/auth.model.js";
import Machine from "../models/machine.model.js";
import Line from "../models/line.model.js";
import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";
import ENV from "../configs/env.config.js";

class NotificationService {
    /**
     * Sends a form report via email based on configuration.
     * @param {string} formName - Predefined form name (e.g., 'Multi Skill Sheet')
     * @param {number} [departmentId] - Department identifier (optional if studentId provided)
     * @param {object} formData - The data to be included in the report
     * @param {number} [studentId] - Student identifier to resolve department if needed
     */
    static async sendFormReport(formName, departmentId, formData, studentId = null, sectionId = null) {
        try {
            logger.info(`[NotificationService] Processing ${formName} for department ${departmentId} or student ${studentId}`);

            // Auto-resolve dept if missing
            if (!departmentId && studentId) {
                departmentId = await this._resolveDepartmentId(studentId);
            }

            // 1. Fetch Email Configuration
            const config = await EmailConfiguration.findByFormDeptAndSection(formName, departmentId || null, sectionId || formData?.sectionId || null);
            if (!config) {
                logger.info(`[NotificationService] No active email configuration for ${formName}, dept ${departmentId}, and section ${sectionId}. Skipping.`);
                return;
            }

            // 2. Resolve Recipients
            const toRecipients = config.toEmails ? config.toEmails.split(',').map(e => e.trim()).filter(Boolean) : [];
            const ccRecipients = config.ccEmails ? config.ccEmails.split(',').map(e => e.trim()).filter(Boolean) : [];

            // 3. Include Trainer if enabled
            if (config.includeTrainer) {
                const department = await Department.findById(departmentId);
                if (department && department.instructor) {
                    const instructor = await User.findById(department.instructor);
                    if (instructor && instructor.email && !toRecipients.includes(instructor.email) && !ccRecipients.includes(instructor.email)) {
                        ccRecipients.push(instructor.email);
                    }
                }
            }

            if (toRecipients.length === 0) {
                logger.warn(`[NotificationService] No recipients found for ${formName} after resolving. Skipping.`);
                return;
            }

            // 4. Resolve Metadata Names
            const department = await Department.findById(departmentId);
            const deptName = department?.name || "Unknown Department";
            if (formData) formData.departmentName = deptName;

            // 5. Generate Excel Report based on Form Name
            const workbook = new ExcelJS.Workbook();
            const filename = await this._generateExcel(workbook, formName, departmentId, formData);

            // 6. Send Email
            const buffer = await workbook.xlsx.writeBuffer();
            const subject = `${formName} Update - ${deptName} (${new Date().toLocaleDateString()})`;
            
            let actionButtons = "";
            if (formName === "Daily 5M Recording Sheet" && formData.recordId) {
                const adminUrl = ENV.ADMIN_URL || "http://localhost:5173";
                actionButtons = `
                    <div style="margin: 20px 0;">
                        <p><strong>Actions:</strong></p>
                        <a href="${adminUrl}/cms/approvals/status?approve=${formData.recordId}" 
                           style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px; display: inline-block;">
                           Approve
                        </a>
                        <a href="${adminUrl}/cms/approvals/status?decline=${formData.recordId}" 
                           style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                           Decline
                        </a>
                    </div>
                `;
            }

            let htmlMessage = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <p>Hello,</p>
                    <p>The <strong>${formName}</strong> for department <strong>${deptName}</strong> has been updated.</p>
                    ${actionButtons}
                    <p>Please find the attached Excel report for your reference.</p>
                    <br/>
                    <p>Best Regards,<br/>LMS System</p>
                </div>
            `;

            if (formName === "Daily 5M Recording Sheet") {
                const date = formData?.date || new Date().toLocaleDateString();
                const adminUrl = ENV.ADMIN_URL || "http://localhost:5173";
                const reviewUrl = `${adminUrl}/cms/daily-5m-recording?recordId=${formData.recordId}`;

                htmlMessage = `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <p>Dear All,</p>
                        <p style="font-weight: bold; color: #d32f2f;">Safety First!</p>
                        <p><strong>Sub:</strong> (Daily 5M Recording - ${deptName} (${date}))</p>
                        <p>Please find the attached Daily 5M Recording sheet for <strong>${deptName}</strong> on <strong>${date}</strong>.</p>
                        
                        <div style="margin: 25px 0;">
                            <a href="${reviewUrl}" 
                               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                               Review Recording Form
                            </a>
                        </div>

                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                        <p style="font-size: 14px; color: #666;">Quick Actions (Direct Status Change):</p>
                        ${actionButtons}
                        <br/>
                        <p>Regards,<br/><strong>FME Digital Portal</strong></p>
                    </div>
                `;
            }


            await sendMail(
                toRecipients.join(','),
                subject,
                htmlMessage,
                [
                    {
                        filename: filename,
                        content: buffer
                    }
                ],
                ccRecipients.join(',')
            );

            // If sendMail doesn't handle CC explicitly in the message object but takes comma separated list in first arg, 
            // we might need to update sendMail or just merge CC into TO if appropriate. 
            // Usually, CC belongs in the transport options. Let's check sendMail again.
            // Ah, sendMail only takes 'email' (TO). I should update sendMail to support CC.

            logger.info(`[NotificationService] Email sent successfully for ${formName} to ${toRecipients.join(',')}`);

        } catch (error) {
            logger.error(`[NotificationService] Failed to send report: ${error.message}`, error);
        }
    }

    static async _generateExcel(workbook, formName, departmentId, formData) {
        const worksheet = workbook.addWorksheet(formName.substring(0, 31)); // Max 31 chars
        let filename = `${formName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

        switch (formName) {
            case "Multi Skill Sheet":
                await this._fillMultiSkillSheet(worksheet, departmentId, formData);
                break;
            case "Handover Sheet":
                await this._fillHandoverSheet(worksheet, departmentId, formData);
                break;
            case "On Job Training Record Sheet":
                await this._fillOJTRecordSheet(worksheet, formData);
                break;
            case "On Job Training Evaluation Sheet":
                await this._fillOJTEvaluationSheet(worksheet, formData);
                break;
            case "Skill Matrix Certificate Sheet":
                this._fillCertificateSheet(worksheet, formData);
                break;
            case "Operator Observance Check Sheet":
                this._fillObservanceSheet(worksheet, formData);
                break;
            case "3-Day Monitoring Sheet":
                this._fillThreeDaySheet(worksheet, formData);
                break;
            case "16-Day Monitoring Sheet":
                this._fillSixteenDaySheet(worksheet, formData);
                break;
            case "10-Cycle Check Sheet":
                this._fillTenCycleSheet(worksheet, formData);
                break;
            case "Skill Matrix Sheet":
                this._fillSkillMatrixSheet(worksheet, formData);
                break;
            case "Daily Production Report Sheet":
                this._fillDPRSheet(worksheet, formData);
                break;
            case "Daily 5M Recording Sheet":
                this._fillDaily5MRecordingSheet(worksheet, formData);
                break;
            case "Associates Headcount Report":
                await this._fillAssociatesHeadcountSheet(worksheet, departmentId, formData);
                break;
            default:
                this._fillGenericSheet(worksheet, formData);
        }
        return filename;
    }

    static async _fillMultiSkillSheet(worksheet, departmentId, formData) {
        const { selectedLines = [], tableData = {} } = formData || {};

        // 1. Fetch Department & Students
        const department = await Department.findById(departmentId);
        if (!department) {
            logger.warn(`[NotificationService] Department ${departmentId} not found for Multi Skill Sheet`);
            return;
        }

        // Fetch students (Users) in this department
        let students = [];
        try {
            // SQL abstraction fix: User.find with $or is not supported. Fetching and filtering manually for accuracy.
            const allUsers = await User.find({ isDeleted: 0 });
            students = allUsers.filter(u => {
                const isByDeptName = u.department === department.name;
                const isByDeptId = u.departments && (u.departments.includes(String(departmentId)) || u.departments.includes(Number(departmentId)));
                const isExplicitlyEnrolled = department.students && department.students.includes(u.id);
                return isByDeptName || isByDeptId || isExplicitlyEnrolled;
            });
        } catch (error) {
            logger.error(`[NotificationService] Error fetching students: ${error.message}`);
        }

        // 2. Fetch Machines and Lines for selected lines to build columns
        const machineColumns = [];
        const linesMap = {};
        for (let i = 0; i < selectedLines.length; i++) {
            const lineId = selectedLines[i];
            if (!lineId) {
                machineColumns.push({
                    key: `slot-${i}-empty`,
                    machineName: "-",
                    lineName: "-",
                    slotIdx: i
                });
                continue;
            }

            if (!linesMap[lineId]) {
                const line = await Line.findById(lineId);
                linesMap[lineId] = line ? line.name : "Unknown Line";
            }

            const machines = await Machine.find({ line: lineId, isActive: 1 });
            if (machines.length === 0) {
                machineColumns.push({
                    key: `slot-${i}-no-machine`,
                    machineName: "-",
                    lineName: linesMap[lineId],
                    slotIdx: i
                });
            } else {
                machines.forEach(m => {
                    machineColumns.push({
                        key: `slot-${i}-machine-${m.id}`,
                        machineName: m.name,
                        lineName: linesMap[lineId],
                        slotIdx: i
                    });
                });
            }
        }

        const totalProcessCols = machineColumns.length || 1;

        // --- Header Section ---
        worksheet.mergeCells(1, 1, 1, 4 + totalProcessCols);
        const companyCell = worksheet.getCell(1, 1);
        companyCell.value = 'FURUKAWA MINDA ELECTRIC PVT. LTD.';
        companyCell.font = { bold: true, size: 10 };
        companyCell.alignment = { horizontal: 'right' };

        worksheet.mergeCells(2, 1, 2, 4 + totalProcessCols);
        const titleCell = worksheet.getCell(2, 1);
        titleCell.value = 'MULTI SKILLING PLAN & ACTUAL SHEET';
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { horizontal: 'center' };

        // Row 3: Info row (optional, like department name)
        worksheet.mergeCells(3, 1, 3, 4 + totalProcessCols);
        const infoCell = worksheet.getCell(3, 1);
        infoCell.value = `Department: ${department.name} | Date: ${new Date().toLocaleDateString()}`;
        infoCell.font = { bold: true };

        // --- Table Headers ---
        // Row 4: Static Headers + Line Names
        const row4Values = ['Sr. No', 'Associates Name', 'Card No', 'Plan/Actual'];
        machineColumns.forEach(col => row4Values.push(col.lineName));
        const row4 = worksheet.addRow(row4Values);

        // Row 5: Static Headers + Machine names
        const row5Values = ['', '', '', ''];
        machineColumns.forEach(col => row5Values.push(col.machineName));
        const row5 = worksheet.addRow(row5Values);

        // Merging static headers across Row 4 & 5
        worksheet.mergeCells('A4:A5');
        worksheet.mergeCells('B4:B5');
        worksheet.mergeCells('C4:C5');
        worksheet.mergeCells('D4:D5');

        // Merge Line Names horizontally for machines belonging to same line
        let startCol = 5;
        for (let i = 0; i < machineColumns.length; i++) {
            const currentLine = machineColumns[i].lineName;
            const nextLine = machineColumns[i + 1]?.lineName;

            if (currentLine !== nextLine) {
                if (startCol < 5 + i) {
                    worksheet.mergeCells(4, startCol, 4, 5 + i);
                }
                startCol = 5 + i + 1;
            }
        }

        // Style headers
        [row4, row5].forEach(row => {
            row.eachCell(cell => this._applyHeaderStyle(cell));
        });

        // Set column widths
        worksheet.getColumn(1).width = 8;
        worksheet.getColumn(2).width = 30;
        worksheet.getColumn(3).width = 15;
        worksheet.getColumn(4).width = 12;
        for (let i = 5; i <= 4 + totalProcessCols; i++) {
            worksheet.getColumn(i).width = 15;
        }

        // --- Data Rows ---
        students.forEach((student, index) => {
            const studentId = String(student.id || student._id);
            const userPlanActual = tableData[studentId] || { plan: {}, actual: {} };

            // Plan Row
            const planRowValues = [
                index + 1,
                student.fullName,
                student.empId || student.userName,
                'Plan'
            ];
            machineColumns.forEach(col => {
                planRowValues.push(userPlanActual.plan?.[col.key] || "");
            });
            const planRow = worksheet.addRow(planRowValues);

            // Actual Row
            const actualRowValues = [
                '',
                '',
                '',
                'Actual'
            ];
            machineColumns.forEach(col => {
                actualRowValues.push(userPlanActual.actual?.[col.key] || "");
            });
            const actualRow = worksheet.addRow(actualRowValues);

            // Merge student info cells across Plan/Actual rows
            const startRow = planRow.number;
            worksheet.mergeCells(`A${startRow}:A${startRow + 1}`);
            worksheet.mergeCells(`B${startRow}:B${startRow + 1}`);
            worksheet.mergeCells(`C${startRow}:C${startRow + 1}`);

            [planRow, actualRow].forEach(row => {
                row.eachCell(cell => this._applyBorderStyle(cell));
                row.getCell(4).font = { bold: true };
            });

            // Color 'Plan' and 'Actual' identifiers
            planRow.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
            actualRow.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
        });

        // --- Footer Section ---
        const footerRowNumber = worksheet.lastRow.number + 2;
        worksheet.mergeCells(footerRowNumber, 1, footerRowNumber, 4 + totalProcessCols);
        const footerCell = worksheet.getCell(footerRowNumber, 1);
        footerCell.value = 'FRM-WH-QA-150 | REV: 01 | REV DATE: 01.01.2023 | PAGE: 1 OF 1';
        footerCell.font = { italic: true, size: 9 };
        footerCell.alignment = { horizontal: 'center' };
    }

    static async _fillHandoverSheet(worksheet, departmentId, formData) {
        // --- Header Section ---
        worksheet.mergeCells('A1:F1');
        const companyCell = worksheet.getCell('A1');
        companyCell.value = 'FURUKAWA MINDA ELECTRIC PVT. LTD.';
        companyCell.font = { bold: true, size: 10 };
        companyCell.alignment = { horizontal: 'right' };

        worksheet.mergeCells('A2:F2');
        const titleCell = worksheet.getCell('A2');
        titleCell.value = 'HANDOVER SHEET';
        titleCell.font = { bold: true, size: 16 };
        titleCell.alignment = { horizontal: 'center' };

        // --- Metadata Section ---
        const meta = formData.metadata || {};
        worksheet.addRow(['DATE:', formData.date || '', '', 'SECTION:', meta.section || '', '']);
        worksheet.mergeCells(worksheet.lastRow.number, 1, worksheet.lastRow.number, 1);
        worksheet.mergeCells(worksheet.lastRow.number, 4, worksheet.lastRow.number, 4);

        // --- Main Table Headers ---
        const headerRow = worksheet.addRow(['SN.', 'Employee Name', 'Emp. Code', 'Marks', 'Process', 'Mentor']);
        headerRow.font = { bold: true };
        headerRow.eachCell(cell => {
            this._applyHeaderStyle(cell);
        });

        worksheet.columns = [
            { key: 'sn', width: 5 },
            { key: 'employeeName', width: 30 },
            { key: 'empCode', width: 15 },
            { key: 'marks', width: 10 },
            { key: 'process', width: 20 },
            { key: 'mentor', width: 20 }
        ];

        // --- Data Rows ---
        if (formData && formData.entries && Array.isArray(formData.entries)) {
            formData.entries.forEach((entry, idx) => {
                const row = worksheet.addRow({
                    sn: idx + 1,
                    employeeName: entry.employeeName,
                    empCode: entry.empCode,
                    marks: entry.marks,
                    process: entry.process,
                    mentor: entry.mentor
                });
                row.eachCell(cell => {
                    this._applyBorderStyle(cell);
                });
            });
        }

        // --- Footer Section ---
        const lastRowNumber = worksheet.lastRow.number + 2;
        worksheet.mergeCells(`A${lastRowNumber}:F${lastRowNumber}`);
        const footerCell = worksheet.getCell(`A${lastRowNumber}`);
        footerCell.value = 'FRM-WH-QA-160 | REV: 02 | REV DATE: 15.06.2023 | PAGE: 1 OF 1';
        footerCell.font = { size: 9 };
        footerCell.alignment = { horizontal: 'center' };
    }
    static _applyHeaderStyle(cell) {
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'medium' },
            right: { style: 'thin' }
        };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD9D9D9' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    static _applyBorderStyle(cell) {
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle' };
    }

    static _fillGenericSheet(worksheet, formData) {
        worksheet.addRow(["Field", "Value"]);
        worksheet.getRow(1).font = { bold: true };

        Object.entries(formData).forEach(([key, val]) => {
            if (typeof val === 'object' && val !== null) {
                worksheet.addRow([key, JSON.stringify(val)]);
            } else {
                worksheet.addRow([key, val]);
            }
        });
    }

    static async _fillOJTRecordSheet(worksheet, formData) {
        // --- Header Section ---
        worksheet.mergeCells('A1:J1');
        const companyCell = worksheet.getCell('A1');
        companyCell.value = 'FURUKAWA MINDA ELECTRIC PVT. LTD.';
        companyCell.font = { bold: true, size: 10 };
        companyCell.alignment = { horizontal: 'right' };

        worksheet.mergeCells('A2:J2');
        const titleCell = worksheet.getCell('A2');
        titleCell.value = 'OJT TRAINING RECORD SHEET';
        titleCell.font = { bold: true, size: 16 };
        titleCell.alignment = { horizontal: 'center' };

        // --- Info Section ---
        worksheet.addRow(['Area / Line :-', formData.areaLine || '', '', '', '', '', '', '', 'Date:-', formData.trainingDate || '']);
        worksheet.mergeCells(worksheet.lastRow.number, 1, worksheet.lastRow.number, 1);
        worksheet.mergeCells(worksheet.lastRow.number, 2, worksheet.lastRow.number, 8);

        worksheet.addRow(['Training Given By', formData.trainingGivenBy || '']);
        worksheet.mergeCells(worksheet.lastRow.number, 2, worksheet.lastRow.number, 10);

        worksheet.addRow(['Training Topic', formData.trainingTopic || '']);
        worksheet.mergeCells(worksheet.lastRow.number, 2, worksheet.lastRow.number, 10);

        worksheet.addRow(['Training Start Time :-', formData.trainingStartTime || '', 'Training End Time :-', formData.trainingEndTime || '', 'Training Duration :-', formData.trainingDuration || '']);
        worksheet.mergeCells(worksheet.lastRow.number, 2, worksheet.lastRow.number, 2);
        worksheet.mergeCells(worksheet.lastRow.number, 4, worksheet.lastRow.number, 4);
        worksheet.mergeCells(worksheet.lastRow.number, 6, worksheet.lastRow.number, 10);

        // --- Training Detail Section ---
        worksheet.addRow([]);
        worksheet.addRow(['Training Detail']).font = { bold: true, size: 12 };
        worksheet.mergeCells(worksheet.lastRow.number, 1, worksheet.lastRow.number, 10);
        worksheet.getCell(worksheet.lastRow.number, 1).alignment = { horizontal: 'center' };

        if (formData.trainingLog && Array.isArray(formData.trainingLog)) {
            formData.trainingLog.forEach((log, index) => {
                const row = worksheet.addRow([`${index + 1}.`, log.description || '']);
                worksheet.mergeCells(row.number, 2, row.number, 10);
                row.getCell(2).alignment = { wrapText: true };
            });
        }

        // --- Attendance Section ---
        worksheet.addRow([]);
        worksheet.addRow(['Attendance']).font = { bold: true, size: 12 };
        worksheet.mergeCells(worksheet.lastRow.number, 1, worksheet.lastRow.number, 10);
        worksheet.getCell(worksheet.lastRow.number, 1).alignment = { horizontal: 'center' };

        const attHeader = worksheet.addRow(['S.No', 'Date', 'Name', 'E.Code', 'Section', 'S.No', 'Date', 'Name', 'E.Code', 'Section']);
        attHeader.eachCell(cell => this._applyHeaderStyle(cell));

        const attendance = formData.attendanceRecords || [];
        for (let i = 0; i < 10; i++) {
            const left = attendance[i] || {};
            const right = attendance[i + 10] || {};
            const row = worksheet.addRow([
                i + 1, left.date || '', left.name || '', left.ecode || '', left.department || '',
                i + 11, right.date || '', right.name || '', right.ecode || '', right.department || ''
            ]);
            row.eachCell(cell => this._applyBorderStyle(cell));
        }

        // --- Footer ---
        const footerRow = worksheet.addRow([]);
        worksheet.mergeCells(footerRow.number + 1, 1, footerRow.number + 1, 10);
        const footerCell = worksheet.getCell(footerRow.number + 1, 1);
        footerCell.value = 'FRM-WH-QA-178 | REV: 02 | REV DATE: 19.06.2021 | PAGE: 1 OF 1';
        footerCell.alignment = { horizontal: 'center' };
    }

    static async _fillOJTEvaluationSheet(worksheet, formData) {
        // --- Header ---
        worksheet.mergeCells('A1:Q1');
        const companyCell = worksheet.getCell('A1');
        companyCell.value = 'FURUKAWA MINDA ELECTRIC PVT. LTD.';
        companyCell.font = { bold: true, size: 10 };
        companyCell.alignment = { horizontal: 'right' };

        worksheet.mergeCells('A2:Q2');
        const titleCell = worksheet.getCell('A2');
        titleCell.value = 'Level-1 Practical Evaluation of On the Job Training';
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { horizontal: 'center' };

        // --- Info ---
        worksheet.addRow(['Model:', formData.model || '', '', '', 'Line/Machine:', (formData.line?.name || '') + ' / ' + (formData.machine?.name || '')]);
        worksheet.addRow(['Name of Associate:', formData.studentName || '', '', '', 'Date of Joining:', formData.doj || '']);

        // --- Main Table Headers ---
        const h1 = worksheet.addRow(['Date', 'HOURS', 'PRODUCTION TARGET', 'TOTAL PART PRODUCTION', 'OK PARTS', 'Rejection', 'CYCLE TIME', '', 'NC Tag', 'ESCALATION SYSTEM', 'SOS FOLLOW', 'Customer Complaint', 'PPE USES', 'Associate Sign', 'Trainer Sign', 'TL Sign', 'Incharge Sign']);
        const h2 = worksheet.addRow(['', '', '', '', '', '', 'Target', 'Actual', '', '', '', '', '', '', '', '', '']);

        // Merging for headers
        ['A', 'B', 'C', 'D', 'E', 'F', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q'].forEach(col => {
            worksheet.mergeCells(`${col}${h1.number}:${col}${h2.number}`);
        });
        worksheet.mergeCells(`G${h1.number}:H${h1.number}`);

        h1.eachCell(cell => this._applyHeaderStyle(cell));
        h2.eachCell(cell => this._applyHeaderStyle(cell));

        // --- Data Rows ---
        const entries = formData.entries || [];
        entries.forEach(entry => {
            const row = worksheet.addRow([
                entry.date || '', entry.hours || '', entry.productionTarget || '', entry.totalPartProduction || '',
                entry.okParts || '', entry.rejection || '', entry.cycleTimeTarget || '', entry.cycleTimeActual || '',
                entry.ncTag || '', entry.escalationSystem || '', entry.sosFollow || '', entry.customerComplaint || '',
                entry.ppeUses || '', '', '', '', ''
            ]);
            row.eachCell(cell => this._applyBorderStyle(cell));
        });

        // --- Summary Rows ---
        const summaryRow = worksheet.addRow(['TOTAL', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        worksheet.mergeCells(summaryRow.number, 1, summaryRow.number, 1);
        summaryRow.getCell(1).font = { bold: true };

        // Summary Statistics Box (Merged area)
        const statRowStart = summaryRow.number;
        worksheet.mergeCells(`I${statRowStart}:M${statRowStart + 2}`);
        const statCell = worksheet.getCell(`I${statRowStart}`);
        statCell.value = `TOTAL MARKS: ${formData.totalMarks || ''}\nOBTAINED: ${formData.totalMarksObtained || ''}\nPERCENTAGE: ${formData.totalPercentage || ''}%\nRESULT: ${formData.result || ''}`;
        statCell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
        statCell.font = { bold: true };
        statCell.border = { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } };

        // --- Footer ---
        worksheet.addRow([]);
        const footerRow = worksheet.addRow(['FRM-WH-QA-156 | REV: 06 | REV DATE: 15.06.2024 | PAGE: 1 OF 1']);
        worksheet.mergeCells(footerRow.number, 1, footerRow.number, 17);
        footerRow.getCell(1).alignment = { horizontal: 'center' };
    }

    static async _fillCertificateSheet(worksheet, formData) {
        // --- Header ---
        worksheet.mergeCells('A1:D1');
        const companyCell = worksheet.getCell('A1');
        companyCell.value = 'FURUKAWA MINDA ELECTRIC PVT. LTD.';
        companyCell.font = { bold: true, size: 10 };
        companyCell.alignment = { horizontal: 'right' };

        worksheet.mergeCells('A2:D2');
        const titleCell = worksheet.getCell('A2');
        titleCell.value = 'SKILL EVALUATION CERTIFICATE';
        titleCell.font = { bold: true, size: 18, color: { argb: 'FF000080' } };
        titleCell.alignment = { horizontal: 'center' };

        // --- Certificate Border ---
        for (let i = 1; i <= 4; i++) {
            worksheet.getColumn(i).width = 25;
        }

        worksheet.addRow([]);
        worksheet.addRow(['TRAINEE INFORMATION']).font = { bold: true, underline: true };
        worksheet.addRow(['Name:', formData.studentName || 'N/A', 'Emp Code:', formData.studentCode || 'N/A']);
        worksheet.addRow(['Department:', formData.departmentName || 'N/A', 'Line:', formData.lineName || 'N/A']);
        worksheet.addRow(['Process:', formData.processName || 'N/A', 'Date of Issue:', new Date().toLocaleDateString()]);

        worksheet.addRow([]);
        worksheet.addRow(['EVALUATION RESULT']).font = { bold: true, underline: true };
        const levelRow = worksheet.addRow(['Qualified Level:', 'L' + (formData.level || 'N/A'), '', '']);
        levelRow.getCell(2).font = { bold: true, size: 14, color: { argb: 'FF008000' } };

        worksheet.addRow([]);
        worksheet.addRow(['Skill Description:']).font = { bold: true };
        const descRow = worksheet.addRow([formData.skillDescription || 'The associate has successfully completed the training and evaluation for the specified process and is now qualified to operate independently.']);
        worksheet.mergeCells(descRow.number, 1, descRow.number + 2, 4);
        descRow.getCell(1).alignment = { wrapText: true, vertical: 'top' };

        // --- Signature Section ---
        worksheet.addRow([]);
        worksheet.addRow([]);
        const sigRow = worksheet.addRow(['Trainer Signature', '', 'HOD Signature', '']);
        sigRow.font = { bold: true };

        // Apply outer border to certificate area
        const lastRow = worksheet.lastRow.number;
        for (let r = 1; r <= lastRow; r++) {
            for (let c = 1; c <= 4; c++) {
                const cell = worksheet.getCell(r, c);
                if (r === 1) cell.border = { ...cell.border, top: { style: 'medium' } };
                if (r === lastRow) cell.border = { ...cell.border, bottom: { style: 'medium' } };
                if (c === 1) cell.border = { ...cell.border, left: { style: 'medium' } };
                if (c === 4) cell.border = { ...cell.border, right: { style: 'medium' } };
            }
        }
    }

    static async _fillObservanceSheet(worksheet, formData) {
        // --- Header ---
        worksheet.mergeCells('A1:F1');
        const companyCell = worksheet.getCell('A1');
        companyCell.value = 'FURUKAWA MINDA ELECTRIC PVT. LTD.';
        companyCell.font = { bold: true, size: 10 };
        companyCell.alignment = { horizontal: 'right' };

        worksheet.mergeCells('A2:F2');
        const titleCell = worksheet.getCell('A2');
        titleCell.value = 'OPERATOR OBSERVANCE CHECK SHEET';
        titleCell.font = { bold: true, size: 16 };
        titleCell.alignment = { horizontal: 'center' };

        // --- Info Section ---
        worksheet.addRow(['Line:', formData.lineName || '', 'Process:', formData.processName || '', 'Operator:', formData.operatorNameCode || '']);
        worksheet.addRow(['Date:', formData.date || '', 'Shift:', formData.shift || '', 'Observer:', formData.observerName || '']);
        worksheet.getRow(worksheet.lastRow.number - 1).font = { bold: true };
        worksheet.getRow(worksheet.lastRow.number).font = { bold: true };

        // --- Checklist Table ---
        worksheet.addRow([]);
        const headerRow = worksheet.addRow(['S.No', 'Checkpoint / Activity', 'Observation (Yes/No)', 'Description of Gap (if any)', '', 'Final Judgment']);
        worksheet.mergeCells(headerRow.number, 4, headerRow.number, 5);
        headerRow.eachCell(cell => this._applyHeaderStyle(cell));

        worksheet.columns = [
            { key: 'sn', width: 5 },
            { key: 'checkpoint', width: 40 },
            { key: 'status', width: 20 },
            { key: 'gap1', width: 15 },
            { key: 'gap2', width: 15 },
            { key: 'judgment', width: 15 }
        ];

        if (formData.observanceData) {
            Object.entries(formData.observanceData).forEach(([checkpoint, status], index) => {
                const row = worksheet.addRow({
                    sn: index + 1,
                    checkpoint: checkpoint,
                    status: status,
                    gap1: '',
                    gap2: '',
                    judgment: ''
                });
                worksheet.mergeCells(row.number, 4, row.number, 5);
                row.eachCell(cell => this._applyBorderStyle(cell));
            });
        }

        // --- Footer Section ---
        const lastRowNumber = worksheet.lastRow.number + 2;
        worksheet.mergeCells(`A${lastRowNumber}:F${lastRowNumber}`);
        const footerCell = worksheet.getCell(`A${lastRowNumber}`);
        footerCell.value = 'FRM-WH-QA-172 | REV: 02 | REV DATE: 10.10.2022 | PAGE: 1 OF 1';
        footerCell.alignment = { horizontal: 'center' };
    }

    static async _fillThreeDaySheet(worksheet, formData) {
        // --- Header ---
        worksheet.mergeCells('A1:G1');
        const companyCell = worksheet.getCell('A1');
        companyCell.value = 'FURUKAWA MINDA ELECTRIC PVT. LTD.';
        companyCell.font = { bold: true, size: 10 };
        companyCell.alignment = { horizontal: 'right' };

        worksheet.mergeCells('A2:G2');
        const titleCell = worksheet.getCell('A2');
        titleCell.value = '3-DAY MONITORING SHEET';
        titleCell.font = { bold: true, size: 16 };
        titleCell.alignment = { horizontal: 'center' };

        // --- Info Section ---
        worksheet.addRow(['Line:', formData.lineName || '', 'Process:', formData.processName || '', 'Station:', formData.stationName || '', 'Operator:', formData.studentName || '']);
        worksheet.getRow(worksheet.lastRow.number).font = { bold: true };

        // --- Monitoring Table ---
        worksheet.addRow([]);
        const headerRow = worksheet.addRow(['Day', 'Checkpoint / Activity', 'Status (OK/NG)', 'Remarks', '', '', 'Final Result']);
        worksheet.mergeCells(headerRow.number, 4, headerRow.number, 6);
        headerRow.eachCell(cell => this._applyHeaderStyle(cell));

        worksheet.columns = [
            { key: 'day', width: 10 },
            { key: 'checkpoint', width: 40 },
            { key: 'status', width: 15 },
            { key: 'rem1', width: 10 },
            { key: 'rem2', width: 10 },
            { key: 'rem3', width: 10 },
            { key: 'result', width: 15 }
        ];

        if (formData.entries) {
            Object.entries(formData.entries).forEach(([day, checkpoints]) => {
                if (typeof checkpoints === 'object' && checkpoints !== null) {
                    Object.entries(checkpoints).forEach(([cp, status], idx) => {
                        const row = worksheet.addRow({
                            day: idx === 0 ? day : '',
                            checkpoint: cp,
                            status: status,
                            rem1: '', rem2: '', rem3: '',
                            result: ''
                        });
                        worksheet.mergeCells(row.number, 4, row.number, 6);
                        row.eachCell(cell => this._applyBorderStyle(cell));
                    });
                }
            });
        }

        // --- Footer ---
        const lastRowNumber = worksheet.lastRow.number + 2;
        worksheet.mergeCells(`A${lastRowNumber}:G${lastRowNumber}`);
        const footerCell = worksheet.getCell(`A${lastRowNumber}`);
        footerCell.value = 'FRM-WH-QA-180 | REV: 01 | REV DATE: 12.08.2023 | PAGE: 1 OF 1';
        footerCell.alignment = { horizontal: 'center' };
    }

    static async _fillSixteenDaySheet(worksheet, formData) {
        // --- Header ---
        worksheet.mergeCells('A1:H1');
        const companyCell = worksheet.getCell('A1');
        companyCell.value = 'FURUKAWA MINDA ELECTRIC PVT. LTD.';
        companyCell.font = { bold: true, size: 10 };
        companyCell.alignment = { horizontal: 'right' };

        worksheet.mergeCells('A2:H2');
        const titleCell = worksheet.getCell('A2');
        titleCell.value = '16-DAY MONITORING SHEET';
        titleCell.font = { bold: true, size: 16 };
        titleCell.alignment = { horizontal: 'center' };

        // --- Info Section ---
        worksheet.addRow(['Employee Name:', formData.studentName || '', 'Emp Code:', formData.studentCode || '', 'Line:', formData.lineName || '']);
        worksheet.addRow(['Date of Joining:', formData.doj || '', 'Process:', formData.processName || '', 'Mentor:', formData.mentorName || '']);
        worksheet.getRow(worksheet.lastRow.number - 1).font = { bold: true };
        worksheet.getRow(worksheet.lastRow.number).font = { bold: true };

        // --- Table Headers ---
        worksheet.addRow([]);
        const headerRow = worksheet.addRow(['Day', 'Target', 'Actual', 'Efficiency (%)', 'Quality (%)', 'Safety', 'Machine Status', 'Final Judgment']);
        headerRow.eachCell(cell => this._applyHeaderStyle(cell));

        worksheet.columns = [
            { key: 'day', width: 8 },
            { key: 'target', width: 12 },
            { key: 'actual', width: 12 },
            { key: 'efficiency', width: 15 },
            { key: 'quality', width: 12 },
            { key: 'safety', width: 12 },
            { key: 'machine', width: 15 },
            { key: 'judgment', width: 15 }
        ];

        // --- Data Rows (1 to 16) ---
        const monitoringData = formData.monitoringData || {};
        for (let i = 1; i <= 16; i++) {
            const dayData = monitoringData[`day_${i}`] || {};
            const row = worksheet.addRow({
                day: `Day ${i}`,
                target: dayData.target || '',
                actual: dayData.actual || '',
                efficiency: dayData.efficiency || '',
                quality: dayData.quality || '',
                safety: dayData.safety || 'OK',
                machine: dayData.machine || 'OK',
                judgment: dayData.judgment || ''
            });
            row.eachCell(cell => this._applyBorderStyle(cell));
        }

        // --- Footer ---
        const lastRowNumber = worksheet.lastRow.number + 2;
        worksheet.mergeCells(`A${lastRowNumber}:H${lastRowNumber}`);
        const footerCell = worksheet.getCell(`A${lastRowNumber}`);
        footerCell.value = 'FRM-WH-QA-182 | REV: 01 | REV DATE: 20.09.2023 | PAGE: 1 OF 1';
        footerCell.alignment = { horizontal: 'center' };
    }

    static async _fillTenCycleSheet(worksheet, formData) {
        // --- Header ---
        worksheet.mergeCells('A1:L1');
        const companyCell = worksheet.getCell('A1');
        companyCell.value = 'FURUKAWA MINDA ELECTRIC PVT. LTD.';
        companyCell.font = { bold: true, size: 10 };
        companyCell.alignment = { horizontal: 'right' };

        worksheet.mergeCells('A2:L2');
        const titleCell = worksheet.getCell('A2');
        titleCell.value = '10-CYCLE CHECK SHEET';
        titleCell.font = { bold: true, size: 16 };
        titleCell.alignment = { horizontal: 'center' };

        // --- Info Section ---
        worksheet.addRow(['Form Type:', formData.formType || '', 'Quality Engineer:', formData.qualityEngineer || '', 'Dojo Engineer:', formData.dojoEngineer || '', 'Date:', formData.date || '']);
        worksheet.getRow(worksheet.lastRow.number).font = { bold: true };

        // --- Cycles Table ---
        worksheet.addRow([]);
        const headerRow = worksheet.addRow(['Cycle No.', 'Time (sec)', '', '', '', '', '', '', '', '', 'Average', 'Judgment']);
        worksheet.mergeCells(headerRow.number, 2, headerRow.number, 10);
        headerRow.eachCell(cell => this._applyHeaderStyle(cell));

        worksheet.columns = [
            { key: 'sn', width: 10 },
            { key: 't1', width: 8 }, { key: 't2', width: 8 }, { key: 't3', width: 8 }, { key: 't4', width: 8 },
            { key: 't5', width: 8 }, { key: 't6', width: 8 }, { key: 't7', width: 8 }, { key: 't8', width: 8 },
            { key: 't9', width: 8 }, { key: 'avg', width: 15 }, { key: 'judgment', width: 15 }
        ];

        const cycles = formData.cycles || [];
        for (let i = 0; i < 10; i++) {
            const row = worksheet.addRow([i + 1, cycles[i] || '', '', '', '', '', '', '', '', '', '', '']);
            worksheet.mergeCells(row.number, 2, row.number, 10);
            row.eachCell(cell => this._applyBorderStyle(cell));
        }

        // --- Footer ---
        const lastRowNumber = worksheet.lastRow.number + 2;
        worksheet.mergeCells(`A${lastRowNumber}:L${lastRowNumber}`);
        const footerCell = worksheet.getCell(`A${lastRowNumber}`);
        footerCell.value = 'FRM-WH-QA-185 | REV: 01 | REV DATE: 05.11.2023 | PAGE: 1 OF 1';
        footerCell.alignment = { horizontal: 'center' };
    }

    static async _fillSkillMatrixSheet(worksheet, formData) {
        // --- Header ---
        worksheet.mergeCells('A1:Z1');
        const companyCell = worksheet.getCell('A1');
        companyCell.value = 'FURUKAWA MINDA ELECTRIC PVT. LTD.';
        companyCell.font = { bold: true, size: 10 };
        companyCell.alignment = { horizontal: 'right' };

        worksheet.mergeCells('A2:Z2');
        const titleCell = worksheet.getCell('A2');
        titleCell.value = 'SKILL MATRIX SHEET - ' + (formData.month || new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
        titleCell.font = { bold: true, size: 20 };
        titleCell.alignment = { horizontal: 'center' };

        // --- Matrix Table ---
        worksheet.addRow([]);
        const skills = formData.skills || []; // List of skill names
        const headerRow = worksheet.addRow(['S.No', 'Emp Name', 'Emp Code', ...skills, 'Total Score', 'Max Possible', '%']);
        headerRow.eachCell(cell => this._applyHeaderStyle(cell));

        worksheet.columns = [
            { key: 'sn', width: 5 },
            { key: 'name', width: 30 },
            { key: 'code', width: 15 },
            ...skills.map(s => ({ width: 10 })),
            { key: 'total', width: 12 },
            { key: 'max', width: 12 },
            { key: 'percent', width: 10 }
        ];

        const entries = formData.entries || [];
        entries.forEach((emp, index) => {
            const skillValues = skills.map(s => {
                const level = emp.matrixData ? emp.matrixData[s] : null;
                return level ? 'L' + level : '-';
            });
            const row = worksheet.addRow([index + 1, emp.name, emp.employeeCode, ...skillValues, emp.totalScore || '', emp.maxScore || '', emp.percentage || '']);
            row.eachCell(cell => this._applyBorderStyle(cell));
        });

        // --- Legend ---
        worksheet.addRow([]);
        const legendRow = worksheet.addRow(['L1: Partial Knowledge', 'L2: Basic Knowledge', 'L3: Advanced Knowledge', 'L4: Expert (Can Train)']);
        legendRow.font = { italic: true };
    }

    static async _fillDPRSheet(worksheet, formData) {
        // --- Header ---
        worksheet.mergeCells('A1:J1');
        const companyCell = worksheet.getCell('A1');
        companyCell.value = 'FURUKAWA MINDA ELECTRIC PVT. LTD.';
        companyCell.font = { bold: true, size: 10 };
        companyCell.alignment = { horizontal: 'right' };

        worksheet.mergeCells('A2:J2');
        const titleCell = worksheet.getCell('A2');
        titleCell.value = 'DAILY PRODUCTION REPORT';
        titleCell.font = { bold: true, size: 16 };
        titleCell.alignment = { horizontal: 'center' };

        // --- Info Section ---
        worksheet.addRow(['Date:', formData.date || '', 'Department:', formData.department || '', 'Shift:', formData.shift || '', 'Supervisor:', formData.supervisor || '']);
        worksheet.getRow(worksheet.lastRow.number).font = { bold: true };

        // --- Production Table ---
        worksheet.addRow([]);
        const headerRow = worksheet.addRow(['S.No', 'Line', 'Model', 'Machine', 'Target', 'Actual', 'Rejection', 'Down Time', 'Efficiency (%)', 'Remarks']);
        headerRow.eachCell(cell => this._applyHeaderStyle(cell));

        worksheet.columns = [
            { key: 'sn', width: 5 },
            { key: 'line', width: 20 },
            { key: 'model', width: 20 },
            { key: 'machine', width: 20 },
            { key: 'target', width: 12 },
            { key: 'actual', width: 12 },
            { key: 'rejection', width: 12 },
            { key: 'downtime', width: 15 },
            { key: 'efficiency', width: 15 },
            { key: 'remarks', width: 25 }
        ];

        const prodData = formData.productionData || [];
        prodData.forEach((item, index) => {
            const row = worksheet.addRow([index + 1, item.line || '', item.model || '', item.machine || '', item.target || '', item.actual || '', item.rejection || '', item.downtime || '', item.efficiency || '', item.remarks || '']);
            row.eachCell(cell => this._applyBorderStyle(cell));
        });

        // --- Footer ---
        const lastRowNumber = worksheet.lastRow.number + 2;
        worksheet.mergeCells(`A${lastRowNumber}:J${lastRowNumber}`);
        const footerCell = worksheet.getCell(`A${lastRowNumber}`);
        footerCell.value = 'FRM-PR-DPR-100 | REV: 01 | REV DATE: 01.01.2024';
        footerCell.alignment = { horizontal: 'center' };
    }

    static async _fillDaily5MRecordingSheet(worksheet, formData) {
        // --- Header Section ---
        worksheet.mergeCells('A1:L1');
        const companyCell = worksheet.getCell('A1');
        companyCell.value = 'FURUKAWA MINDA ELECTRIC PVT. LTD.';
        companyCell.font = { bold: true, size: 11 };
        companyCell.alignment = { horizontal: 'right' };

        worksheet.mergeCells('A2:L2');
        const titleCell = worksheet.getCell('A2');
        titleCell.value = 'DAILY 5M RECORDING SHEET';
        titleCell.font = { bold: true, size: 18, color: { argb: 'FF000080' } };
        titleCell.alignment = { horizontal: 'center' };

        // --- Metadata Section ---
        worksheet.addRow([]);
        const infoRow = worksheet.addRow([
            'Date:', formData?.date || 'N/A',
            'Shift:', formData?.shift || 'N/A',
            'Line:', formData?.line || 'N/A',
            'Dept:', formData?.departmentName || formData?.departmentId || 'N/A',
            'Form Type:', (formData?.formType || 'standard').toUpperCase()
        ]);
        infoRow.font = { bold: true };
        infoRow.eachCell(cell => {
            if (cell.value === 'Date:' || cell.value === 'Shift:' || cell.value === 'Line:' || cell.value === 'Dept:' || cell.value === 'Form Type:') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
            }
        });

        worksheet.addRow([]);

        // --- Data Extraction ---
        const raw = (formData && formData.recordData && typeof formData.recordData === "object")
            ? formData.recordData
            : {};

        const rowMap = {};
        const fieldOrder = [];
        // Prioritize these fields in this specific order
        const orderedFields = [
            "Date", "Shift", "Line", "StationMC", "Process Name", "Problem", 
            "OperatorId", "OperatorName", "CSL", "ReqSkill", 
            "DeputedPerson", "EmpCode", "ActSkill", "DeputedOnPlan", "OJT",
            "InspectorName", "PartNo", "LotNo", "CircuitNo", "Result_Status",
            "QA_Incharge", "Process_Owner", "Approved_By", "Remarks"
        ];

        Object.entries(raw).forEach(([key, value]) => {
            const match = /^rec_(\d+)_(.+)$/.exec(key);
            if (!match) return;
            const idx = Number(match[1]);
            let field = String(match[2]).trim();
            if (!Number.isFinite(idx) || !field) return;

            // Normalize field names (some might have prefixes or different casing)
            if (!rowMap[idx]) rowMap[idx] = {};
            rowMap[idx][field] = value;
            if (!fieldOrder.includes(field)) fieldOrder.push(field);
        });

        if (Object.keys(rowMap).length === 0) {
            const noDataRow = worksheet.addRow(["No data records captured for this session."]);
            worksheet.mergeCells(noDataRow.number, 1, noDataRow.number, 12);
            noDataRow.getCell(1).alignment = { horizontal: "center" };
            noDataRow.font = { italic: true };
            return;
        }

        // --- Table Headers ---
        const headers = [
            "S.No",
            ...orderedFields.filter((f) => fieldOrder.includes(f)),
            ...fieldOrder.filter((f) => !orderedFields.includes(f) && !f.includes('Retro') && !f.includes('Result_') && !f.includes('Setup') && !f.includes('Cont_') && !f.includes('Param_'))
        ];

        const headerRow = worksheet.addRow(headers);
        headerRow.eachCell((cell) => this._applyHeaderStyle(cell));

        // Set column widths
        worksheet.columns = headers.map((h, index) => {
            if (index === 0) return { key: "sn", width: 6 };
            const width = Math.max(12, h.length + 2);
            return { key: `c${index}`, width: width > 35 ? 35 : width };
        });

        // --- Data Rows ---
        Object.keys(rowMap)
            .map(Number)
            .sort((a, b) => a - b)
            .forEach((idx, rowIndex) => {
                const rowValues = [
                    rowIndex + 1, 
                    ...headers.slice(1).map((f) => {
                        const val = rowMap[idx][f];
                        if (val === undefined || val === null) return "";
                        return val;
                    })
                ];
                const row = worksheet.addRow(rowValues);
                row.eachCell((cell) => this._applyBorderStyle(cell));
                
                // Color coding for status/judgment if present
                const statusIdx = headers.indexOf("Result_Status");
                if (statusIdx !== -1) {
                    const statusCell = row.getCell(statusIdx + 1);
                    if (statusCell.value === "OK") statusCell.font = { color: { argb: 'FF008000' }, bold: true };
                    else if (statusCell.value === "NG") statusCell.font = { color: { argb: 'FFFF0000' }, bold: true };
                }
            });

        // --- Footer Section ---
        const lastRowNumber = worksheet.lastRow.number + 2;
        worksheet.mergeCells(`A${lastRowNumber}:L${lastRowNumber}`);
        const footerCell = worksheet.getCell(`A${lastRowNumber}`);
        footerCell.value = 'FME Digital Portal - Daily 5M Recording Automated Report';
        footerCell.font = { italic: true, size: 9, color: { argb: 'FF808080' } };
        footerCell.alignment = { horizontal: 'center' };
    }


    static async _resolveDepartmentId(studentId) {
        try {
            const [rows] = await executeQuery(`
                SELECT TOP 1 l.sectionId as departmentId
                FROM machine_assignments ma
                INNER JOIN machines m ON ma.machine_id = m.id
                INNER JOIN [lines] l ON m.line = l.id
                WHERE ma.user_id = ?
                ORDER BY ma.assigned_at DESC, ma.id DESC
            `, [studentId]);
            return rows[0]?.departmentId || null;
        } catch (error) {
            logger.error(`[NotificationService] Error resolving department for student ${studentId}: ${error.message}`);
            return null;
        }
    }

    static async _fillAssociatesHeadcountSheet(worksheet, departmentId, formData) {
        const { tableData = {}, date } = formData || {};
        const reportDate = date ? new Date(date) : new Date();
        const year = reportDate.getFullYear();
        const month = reportDate.getMonth();

        // 1. Fetch Department Info
        let deptName = "WIRING HARNESS MANUFACTURING";
        if (departmentId) {
            const department = await Department.findById(departmentId);
            if (department) deptName = department.name;
        }

        // 2. Setup Columns (Particulars + Days)
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const headerDates = [];
        const prevMonthLastDay = new Date(year, month, 0);
        headerDates.push(prevMonthLastDay);
        for (let day = 1; day <= daysInMonth; day++) {
            headerDates.push(new Date(year, month, day));
        }

        worksheet.columns = [
            { header: 'Particulars', key: 'particulars', width: 40 },
            ...headerDates.map((d, i) => ({
                header: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).replace(/ /g, '-'),
                key: d.toISOString().split('T')[0],
                width: 10
            }))
        ];

        // 3. Styling Utility
        const applyRowStyles = (row, bg) => {
            row.eachCell((cell, colNumber) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                if (bg) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: bg.replace('bg-', '').replace('yellow-200', 'FFFFE0').replace('orange-100', 'FFE5B4').replace('amber-300', 'FFBF00').replace('amber-100', 'FFFACD') }
                    };
                }
                if (colNumber === 1) cell.font = { bold: true };
            });
        };

        const rows = [
            { label: "Headcount required as per production plan", bold: true },
            { label: "Headcount required as per sale plan", bold: true },
            { label: "C&C and inspection Headcount Required", bg: "FFFFE0" },
            { label: "ASSY and inspection Headcount Required", bg: "FFFFE0" },
            { type: "spacer" },
            { label: "Hiring Plan" },
            { type: "spacer" },
            { label: "Hiring Actual", bg: "FFE5B4" },
            { type: "spacer" },
            { label: "Handover Plan" },
            { label: "Handover Actual", bg: "FFE5B4" },
            { type: "spacer" },
            { label: "Headcount available", bold: true },
            { label: "C&C and inspection Headcount available", bg: "FFFFE0" },
            { label: "ASSY and inspection Headcount available", bg: "FFFFE0" },
            { type: "spacer" },
            { label: "Present in Training Cell", bold: true },
            { label: "Attrition & Absenteeism of Training Cell (Nos)" },
            { label: "Handed-over after training (Cumulative)" },
            { label: "C&C and inspection Handed-over after training (Cumulative)", bg: "FFFFE0" },
            { label: "ASSY Handed-over after training (Cumulative)", bg: "FFFFE0" },
            { type: "spacer" },
            { label: "Separated (Cumulative)" },
            { label: "Actual Separations (Cumulative)", bg: "FFBF00" },
            { label: "Expected Separations (Cumulative)", bg: "FFFACD" },
            { label: "Gap", bg: "FFBF00" },
            { label: "C&C and inspection Separated (Cumulative)", bg: "FFFFE0" },
            { label: "ASSY and inspection Separated (Cumulative)", bg: "FFFFE0" },
            { type: "spacer" },
            { label: "Absent" },
            { label: "C&C and inspection absent", bg: "FFFFE0" },
            { label: "ASSY and inspection absent", bg: "FFFFE0" },
            { type: "spacer" },
            { label: "Net Available Headcount (Total)", bold: true },
            { type: "spacer" },
            { label: "Net Available Headcount Above 3 Months", bold: true },
            { label: "C&C and inspection Net Available Headcount", bg: "FFFFE0" },
            { label: "ASSY and inspection Net Available Headcount", bg: "FFFFE0" },
            { type: "spacer" },
            { label: "Absenteeism %", bold: true },
            { label: "C&C and inspection Absenteeism %", bg: "FFFFE0" },
            { label: "ASSY and inspection Absenteeism %", bg: "FFFFE0" },
            { type: "spacer" },
            { label: "Total Headcount (Present + Absent)" },
            { label: "Left in nos (Daily)" },
            { label: "Attrition % Daily" },
            { label: "Attrition % Cumulative", bold: true },
            { label: "Weekly Attrition %" },
            { type: "spacer" },
            { label: "Shift-wise Breakdown of Available Manpower", bold: true },
            { label: "A-Shift" },
            { label: "G-Shift" },
            { label: "B-Shift" },
            { label: "C-Shift" },
            { type: "spacer" },
            { label: "Shift-wise Breakdown of Assigned Manpower", bold: true },
            { label: "A-Shift" },
            { label: "G-Shift" },
            { label: "B-Shift" },
            { label: "C-Shift" },
            { type: "spacer" },
            { label: "Shift-wise Attendance", bold: true },
            { label: "A-Shift" },
            { label: "G-Shift" },
            { label: "B-Shift" },
            { label: "C-Shift" },
        ];

        // 4. Fill Rows
        rows.forEach(item => {
            if (item.type === 'spacer') {
                worksheet.addRow({});
                return;
            }

            const rowData = { particulars: item.label };
            headerDates.forEach(dateObj => {
                const dateKey = dateObj.toISOString().split('T')[0];
                rowData[dateKey] = tableData[`${item.label}_${dateKey}`] || '';
            });

            const row = worksheet.addRow(rowData);
            applyRowStyles(row, item.bg);
            if (item.bold) row.font = { bold: true };
        });

        // Title row at the top
        worksheet.insertRow(1, [`ASSOCIATES HEADCOUNT: ${deptName.toUpperCase()}`]);
        worksheet.mergeCells(1, 1, 1, daysInMonth + 2);
        const titleRow = worksheet.getRow(1);
        titleRow.font = { bold: true, size: 14, color: { argb: 'FFFF0000' } };
        titleRow.alignment = { horizontal: 'center' };
    }
}

export default NotificationService;
