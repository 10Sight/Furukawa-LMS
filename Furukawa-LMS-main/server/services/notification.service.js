import ExcelJS from "exceljs";
import sendMail from "../utils/mail.util.js";
import EmailConfiguration from "../models/emailConfiguration.model.js";
import Department from "../models/department.model.js";
import User from "../models/auth.model.js";
import Machine from "../models/machine.model.js";
import Line from "../models/line.model.js";
import SubSection from "../models/subSection.model.js";
import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";
import MonitoringConfig from "../models/monitoringConfig.model.js";
import ENV from "../configs/env.config.js";
import emailTemplates from "../utils/emailTemplates.js";

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

            // Quick Actions template removed as we move to row-wise approval within the form

            let htmlMessage = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <p>Hello,</p>
                    <p>The <strong>${formName}</strong> for department <strong>${deptName}</strong> has been updated.</p>
                    <p>Please find the attached Excel report for your reference.</p>
                    <br/>
                    <p>Best Regards,<br/>LMS System</p>
                </div>
            `;

            if (formName === "Daily 5M Recording Sheet") {
                const date = formData?.date || new Date().toLocaleDateString();
                const adminUrl = ENV.ADMIN_URL || "http://192.168.90.19:5174";
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
                                Review & Approve Recording
                            </a>
                        </div>

                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
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
            case "Skill Upgradation Sheet":
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
        const { year, tableData = {} } = formData || {};

        // 1. Fetch Department & Students
        const department = await Department.findById(departmentId);
        if (!department) {
            logger.warn(`[NotificationService] Department ${departmentId} not found for Multi Skill Sheet`);
            return;
        }

        // Fetch students (Users) in this department
        let students = [];
        try {
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
        worksheet.mergeCells(1, 1, 1, 18);
        const companyCell = worksheet.getCell(1, 1);
        companyCell.value = 'FURUKAWA MINDA ELECTRIC PVT. LTD.';
        companyCell.font = { bold: true, size: 10 };
        companyCell.alignment = { horizontal: 'right' };

        worksheet.mergeCells(2, 1, 2, 18);
        const titleCell = worksheet.getCell(2, 1);
        titleCell.value = 'MULTI SKILLING PLAN & ACTUAL SHEET';
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { horizontal: 'center' };

        // Row 3: Info row (department and year)
        worksheet.mergeCells(3, 1, 3, 18);
        const infoCell = worksheet.getCell(3, 1);
        infoCell.value = `Department: ${department.name} | Year: ${year || new Date().getFullYear()} | Date: ${new Date().toLocaleDateString()}`;
        infoCell.font = { bold: true };

        // --- Table Headers ---
        // Row 4: Static Headers + Quarter Headers
        const row4Values = [
            'Sr. No', 'Associates Name', 'Card No', 'Shift', 'Model & Line', 'Station',
            'Jan-March', '', '',
            'April-June', '', '',
            'July-Sep', '', '',
            'Oct-Dec', '', ''
        ];
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
        worksheet.mergeCells('E4:E5');
        worksheet.mergeCells('F4:F5');

        // Merge Quarter Headers horizontally
        worksheet.mergeCells('G4:I4');
        worksheet.mergeCells('J4:L4');
        worksheet.mergeCells('M4:O4');
        worksheet.mergeCells('P4:R4');

        // Style headers
        [row4, row5].forEach(row => {
            row.eachCell(cell => this._applyHeaderStyle(cell));
        });

        // Set column widths
        worksheet.getColumn(1).width = 8;
        worksheet.getColumn(2).width = 25;
        worksheet.getColumn(3).width = 15;
        worksheet.getColumn(4).width = 10;
        worksheet.getColumn(5).width = 18;
        worksheet.getColumn(6).width = 15;
        for (let i = 7; i <= 18; i++) {
            worksheet.getColumn(i).width = 15;
        }

        // --- Data Rows ---
        students.forEach((student, index) => {
            const studentId = String(student.id || student._id);
            const data = tableData[studentId] || {};

            const rowValues = [
                index + 1,
                student.fullName,
                student.empId || student.userName,
                data.shift || "",
                data.modelLine || "",
                data.station || "",
                data.q1Skill || "",
                data.q1Date || "",
                data.q1Status || "",
                data.q2Skill || "",
                data.q2Date || "",
                data.q2Status || "",
                data.q3Skill || "",
                data.q3Date || "",
                data.q3Status || "",
                data.q4Skill || "",
                data.q4Date || "",
                data.q4Status || ""
            ];

            const row = worksheet.addRow(rowValues);
            row.eachCell(cell => this._applyBorderStyle(cell));
        });

        // --- Footer Section ---
        const footerRowNumber = worksheet.lastRow.number + 2;
        worksheet.mergeCells(footerRowNumber, 1, footerRowNumber, 18);
        const footerCell = worksheet.getCell(footerRowNumber, 1);
        footerCell.value = 'FRM-WH-QA-236 | REV: 01 | REV DATE: 01.01.2023 | PAGE: 1 OF 1';
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
        const N = attendance.length;
        const half = Math.ceil(N / 2);
        for (let i = 0; i < half; i++) {
            const leftIndex = i;
            const rightIndex = i + half;
            const left = attendance[leftIndex] || {};
            const right = attendance[rightIndex] || {};
            const row = worksheet.addRow([
                leftIndex + 1, left.date || '', left.name || '', left.ecode || '', left.department || '',
                rightIndex + 1, rightIndex < N ? (right.date || '') : '', rightIndex < N ? (right.name || '') : '', rightIndex < N ? (right.ecode || '') : '', rightIndex < N ? (right.department || '') : ''
            ]);
            row.eachCell(cell => this._applyBorderStyle(cell));
        }

        // --- Prepared By / Checked By Footer ---
        worksheet.addRow([]);
        const signRow = worksheet.addRow([
            'Prepared By :-', formData.creatorName || formData.trainingGivenBy || '', '', '', '',
            'Checked By :-', '', '', '', ''
        ]);
        signRow.font = { bold: true, size: 10 };
        worksheet.mergeCells(signRow.number, 1, signRow.number, 1);
        worksheet.mergeCells(signRow.number, 2, signRow.number, 5);
        worksheet.mergeCells(signRow.number, 6, signRow.number, 6);
        worksheet.mergeCells(signRow.number, 7, signRow.number, 10);

        for (let c = 1; c <= 10; c++) {
            const cell = signRow.getCell(c);
            cell.alignment = { vertical: 'middle', horizontal: c === 2 ? 'left' : 'center' };
            cell.border = {
                top: { style: 'thin' },
                bottom: { style: 'thin' },
                left: c === 1 || c === 6 ? { style: 'thin' } : undefined,
                right: c === 5 || c === 10 ? { style: 'thin' } : undefined
            };
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

        // --- Signature Section ---
        const sigRowStart = worksheet.lastRow.number + 2;
        worksheet.addRow(['', 'Prepared By', '', 'Checked By', '', 'Approved By']);
        worksheet.mergeCells(sigRowStart, 2, sigRowStart, 3);
        worksheet.mergeCells(sigRowStart, 4, sigRowStart, 5);

        worksheet.addRow(['Sign.', formData.preparedBy ? 'Prepared' : '', '', formData.checkedBy || '', '', formData.verifiedBy || '']);
        worksheet.mergeCells(sigRowStart + 1, 2, sigRowStart + 1, 3);
        worksheet.mergeCells(sigRowStart + 1, 4, sigRowStart + 1, 5);

        const checkedByName = formData.checkedBy ? formData.checkedBy.replace("Approved By: ", "").replace("Rejected By: ", "") : "";
        const verifiedByName = formData.verifiedBy ? formData.verifiedBy.replace("Approved By: ", "").replace("Rejected By: ", "") : "";
        worksheet.addRow(['Name', formData.preparedBy || '', '', checkedByName, '', verifiedByName]);
        worksheet.mergeCells(sigRowStart + 2, 2, sigRowStart + 2, 3);
        worksheet.mergeCells(sigRowStart + 2, 4, sigRowStart + 2, 5);

        for (let r = sigRowStart; r <= sigRowStart + 2; r++) {
            const row = worksheet.getRow(r);
            row.font = { bold: true, size: 9 };
            row.eachCell(cell => {
                this._applyBorderStyle(cell);
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
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
        const { gridData = {}, employeeName, employeeCode, dept, handoverDate, trgResult, workingWith, lineLeaderName, studentId } = formData;

        // 1. Resolve Config
        let config = formData.config;
        if (!config && studentId) {
            const user = await User.findById(studentId);
            const resolvedConfig = await MonitoringConfig.findByTypeAndDepartment('3DAY', user?.departmentId || dept, user?.sectionId || 0);
            config = resolvedConfig?.config;
        }
        if (!config) config = []; // Fallback

        // 2. Setup Columns (Total 5 + 33 + 1 = 39)
        // Static: S.No (1), Parameters (2), Check Name (3,4), Mark (5) -> 5
        // Monitoring: 33 (11 per day * 3)
        // Eval: 1
        const columns = [
            { width: 5 }, // S.No
            { width: 25 }, // Parameters
            { width: 35 }, // Check Name Label
            { width: 10 }, // Mark (Static space for Eval label alignment)
            { width: 8 }, // Mark (Max)
        ];
        // Detailed Days (1-3) -> 11 cols each
        for (let d = 0; d < 3; d++) {
            for (let i = 0; i < 10; i++) columns.push({ width: 4 });
            columns.push({ width: 6 }); // Total
        }
        // Evaluation
        columns.push({ width: 20 });
        worksheet.columns = columns;

        // 3. Header Section
        worksheet.mergeCells(1, 1, 1, 39);
        const companyCell = worksheet.getCell(1, 1);
        companyCell.value = 'FURUKAWA MINDA ELECTRIC PVT. LTD.';
        companyCell.font = { bold: true, size: 10 };
        companyCell.alignment = { horizontal: 'right' };

        worksheet.mergeCells(2, 1, 2, 35);
        const titleCell = worksheet.getCell(2, 1);
        titleCell.value = '3-DAY MONITORING SHEET';
        titleCell.font = { bold: true, size: 16 };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Doc Info Box
        worksheet.mergeCells(2, 36, 2, 39);
        const docInfoCell = worksheet.getCell(2, 36);
        docInfoCell.value = 'Document No.: FRM-HR-003\nRevision No.: 05\nRevision Date: 12.08.23';
        docInfoCell.font = { size: 8, bold: true };
        docInfoCell.alignment = { wrapText: true, vertical: 'middle' };
        docInfoCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };

        // 4. Info Grid
        const applyInfoStyle = (cell) => {
            cell.font = { bold: true, size: 9 };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
        };

        const addInfoRow = (label1, val1, label2, val2, startRow) => {
            worksheet.mergeCells(startRow, 1, startRow, 2);
            const l1 = worksheet.getCell(startRow, 1);
            l1.value = label1;
            applyInfoStyle(l1);

            worksheet.mergeCells(startRow, 3, startRow, 15);
            const v1 = worksheet.getCell(startRow, 3);
            v1.value = `: ${val1 || ''}`;
            v1.font = { color: { argb: 'FF0000FF' }, bold: true };
            applyInfoStyle(v1);

            worksheet.mergeCells(startRow, 16, startRow, 18);
            const l2 = worksheet.getCell(startRow, 16);
            l2.value = label2;
            applyInfoStyle(l2);

            worksheet.mergeCells(startRow, 19, startRow, 39);
            const v2 = worksheet.getCell(startRow, 19);
            v2.value = `: ${val2 || ''}`;
            v2.font = { color: { argb: 'FF0000FF' }, bold: true };
            applyInfoStyle(v2);
        };

        addInfoRow('Employee Name', employeeName, 'Handover Date', handoverDate, 3);
        addInfoRow('Employee Code', employeeCode, 'Trg. Result', trgResult, 4);
        addInfoRow('Process Name', formData.processName, 'Working With', workingWith, 5);
        addInfoRow('Dept.', dept, 'Line & Leader Name', lineLeaderName, 6);

        // 5. Table Headers (Row 7-9)
        worksheet.mergeCells(7, 1, 9, 1); worksheet.getCell(7, 1).value = 'S.No';
        worksheet.mergeCells(7, 2, 9, 2); worksheet.getCell(7, 2).value = 'Parameters';
        worksheet.mergeCells(7, 3, 9, 4); worksheet.getCell(7, 3).value = 'Check Items';
        worksheet.mergeCells(7, 5, 9, 5); worksheet.getCell(7, 5).value = 'Mark (Max)';
        worksheet.mergeCells(7, 6, 7, 38); worksheet.getCell(7, 6).value = 'DAY WISE PERFORMANCE MONITORING';
        worksheet.mergeCells(7, 39, 9, 39); worksheet.getCell(7, 39).value = 'Evaluation after monitoring of 3 days';

        // Day Headers
        for (let d = 1; d <= 3; d++) {
            const startCol = 6 + (d - 1) * 11;
            worksheet.mergeCells(8, startCol, 8, startCol + 10);
            worksheet.getCell(8, startCol).value = `Day-${d}`;
            for (let i = 1; i <= 10; i++) worksheet.getCell(9, startCol + i - 1).value = i;
            worksheet.getCell(9, startCol + 10).value = 'Total';
        }

        // Style Headers
        for (let r = 7; r <= 9; r++) {
            worksheet.getRow(r).eachCell(cell => {
                this._applyHeaderStyle(cell);
                cell.font = { bold: true, size: 8 };
            });
        }

        // 6. Data Rows
        let currentRow = 10;
        config.forEach((cat, catIdx) => {
            const catId = cat.id || `cat${catIdx + 1}`;

            cat.rows.forEach((row, rowIdx) => {
                const isCycleDetailed = row.type === 'cycle_detailed';
                const hasCT = !!row.hasCT;

                // Detailed cycle rows create two Excel rows if hasCT is true
                const subRows = hasCT ? [
                    { id: 'ct', label: row.label, mark: 'C/T', bg: 'FFF8F8F8' },
                    { id: 'score', label: '', mark: row.weight, hasMark: true }
                ] : [{ id: (isCycleDetailed ? 'score' : ''), label: row.label, mark: row.weight, hasMark: true }];

                subRows.forEach((sub, sIdx) => {
                    const excelRow = worksheet.getRow(currentRow);

                    // Merges for Category Labels
                    if (rowIdx === 0 && sIdx === 0) {
                        const rowCount = cat.rows.reduce((acc, r) => acc + (r.hasCT ? 2 : 1), 0);
                        worksheet.mergeCells(currentRow, 1, currentRow + rowCount - 1, 1);
                        worksheet.getCell(currentRow, 1).value = catIdx + 1;
                        worksheet.mergeCells(currentRow, 2, currentRow + rowCount - 1, 2);
                        worksheet.getCell(currentRow, 2).value = cat.category;

                        // Evaluation Side Box
                        worksheet.mergeCells(currentRow, 39, currentRow + rowCount - 1, 39);
                        const evalBox = worksheet.getCell(currentRow, 39);
                        evalBox.value = `Total Mark: ${cat.totalMark}\nActual: ${gridData[`${catId}_eval_total`] || '0'}\nTarget: ${cat.target || '100%'}\nActual %: ${gridData[`${catId}_eval_actual`] || '0%'}`;
                        evalBox.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
                    }

                    // Check Item Label (Merged horizontally)
                    if (hasCT && sIdx === 0) {
                        worksheet.mergeCells(currentRow, 3, currentRow + 1, 3);
                        worksheet.getCell(currentRow, 3).value = sub.label;
                    } else if (!hasCT) {
                        worksheet.mergeCells(currentRow, 3, currentRow, 4);
                        worksheet.getCell(currentRow, 3).value = sub.label;
                    }

                    // Mark column content
                    worksheet.getCell(currentRow, 5).value = sub.mark;

                    // Monitoring Data
                    for (let d = 1; d <= 3; d++) {
                        const startCol = 6 + (d - 1) * 11;
                        if (isCycleDetailed) {
                            for (let i = 0; i < 10; i++) {
                                const key = `${row.id}_day${d}_${sub.id}_${i}`;
                                worksheet.getCell(currentRow, startCol + i).value = gridData[key] || '';
                            }
                            const avgKey = `${row.id}_day${d}_${sub.id}_avg`;
                            const avgCell = worksheet.getCell(currentRow, startCol + 10);
                            avgCell.value = gridData[avgKey] || '';
                            avgCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
                        } else {
                            worksheet.mergeCells(currentRow, startCol, currentRow, startCol + 10);
                            worksheet.getCell(currentRow, startCol).value = gridData[`${row.id}_day${d}`] || '';
                            worksheet.getCell(currentRow, startCol).alignment = { horizontal: 'center' };
                        }
                    }

                    excelRow.eachCell(cell => {
                        this._applyBorderStyle(cell);
                        cell.font = { size: 8 };
                        if (sub.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sub.bg } };
                    });

                    currentRow++;
                });
            });
        });

        // 7. Footer
        worksheet.mergeCells(currentRow + 1, 1, currentRow + 1, 39);
        const footerCell = worksheet.getCell(currentRow + 1, 1);
        footerCell.value = 'FRM-HR-003 | REV: 05 | REV DATE: 12.08.23 | PAGE: 1 OF 1';
        footerCell.alignment = { horizontal: 'center' };
    }

    static async _fillSixteenDaySheet(worksheet, formData) {
        const { gridData = {}, employeeName, employeeCode, dept, handoverDate, trgResult, workingWith, lineLeaderName, studentId } = formData;

        // 1. Resolve Config
        let config = formData.config;
        if (!config && studentId) {
            const user = await User.findById(studentId);
            const resolvedConfig = await MonitoringConfig.findByTypeAndDepartment('16DAY', user?.departmentId || dept, user?.sectionId || 0);
            config = resolvedConfig?.config;
        }
        if (!config) config = []; // Fallback

        const daysDetailed = ["d1", "d2", "d3"];
        const daysSummary = Array.from({ length: 13 }, (_, i) => `day${i + 4}`);

        // 2. Setup Columns (Total 5 + 46 + 1 = 52)
        // Static: S.No (1), Parameters (2), Check Name (3,4), Mark (5) -> 5
        // Monitoring: 46
        // Eval: 1
        const columns = [
            { width: 5 }, // S.No
            { width: 25 }, // Parameters
            { width: 35 }, // Check Name Label
            { width: 20 }, // Check Name Sub-label
            { width: 8 }, // Mark
        ];
        // Detailed Days (1-3) -> 11 cols each
        for (let d = 0; d < 3; d++) {
            for (let i = 0; i < 10; i++) columns.push({ width: 4 });
            columns.push({ width: 6 }); // Avg/Total
        }
        // Summary Days (4-16) -> 13 cols
        for (let d = 0; d < 13; d++) columns.push({ width: 8 });
        // Evaluation
        columns.push({ width: 15 });

        worksheet.columns = columns;

        // 3. Header Section (Matching UI)
        worksheet.mergeCells(1, 1, 1, 52);
        const companyCell = worksheet.getCell(1, 1);
        companyCell.value = 'FURUKAWA MINDA ELECTRIC PVT. LTD.';
        companyCell.font = { bold: true, size: 10 };
        companyCell.alignment = { horizontal: 'right' };

        worksheet.mergeCells(2, 1, 2, 48);
        const titleCell = worksheet.getCell(2, 1);
        titleCell.value = 'ASSOCIATE PERFORMANCE MONITORING CHECK SHEET';
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Doc Info Box
        worksheet.mergeCells(2, 49, 2, 52);
        const docInfoCell = worksheet.getCell(2, 49);
        docInfoCell.value = 'Document No.: FRM-HR-004\nRevision No.: 07\nRevision Date: 11.12.21';
        docInfoCell.font = { size: 8, bold: true };
        docInfoCell.alignment = { wrapText: true, vertical: 'middle' };
        docInfoCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };

        // 4. Info Grid (Row 3-6)
        const applyInfoStyle = (cell) => {
            cell.font = { bold: true, size: 9 };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
        };

        const addInfoRow = (label1, val1, label2, val2, startRow) => {
            worksheet.mergeCells(startRow, 1, startRow, 2);
            const l1 = worksheet.getCell(startRow, 1);
            l1.value = label1;
            applyInfoStyle(l1);

            worksheet.mergeCells(startRow, 3, startRow, 26);
            const v1 = worksheet.getCell(startRow, 3);
            v1.value = `: ${val1 || ''}`;
            v1.font = { color: { argb: 'FF0000FF' }, bold: true };
            applyInfoStyle(v1);

            worksheet.mergeCells(startRow, 27, startRow, 29);
            const l2 = worksheet.getCell(startRow, 27);
            l2.value = label2;
            applyInfoStyle(l2);

            worksheet.mergeCells(startRow, 30, startRow, 52);
            const v2 = worksheet.getCell(startRow, 30);
            v2.value = `: ${val2 || ''}`;
            v2.font = { color: { argb: 'FF0000FF' }, bold: true };
            applyInfoStyle(v2);
        };

        addInfoRow('Employee Name', employeeName, 'Handover Date', handoverDate, 3);
        addInfoRow('Employee Code', employeeCode, 'Trg. Result', trgResult, 4);
        addInfoRow('Process Name', formData.processName, 'Working With', workingWith, 5);
        addInfoRow('Dept.', dept, 'Line & Leader Name', lineLeaderName, 6);

        // 5. Table Headers (Row 7-9)
        worksheet.mergeCells(7, 1, 9, 1); // S.No
        const snH = worksheet.getCell(7, 1); snH.value = 'S.No';
        worksheet.mergeCells(7, 2, 9, 2); // Parameters
        const paramH = worksheet.getCell(7, 2); paramH.value = 'Parameters';
        worksheet.mergeCells(7, 3, 9, 4); // Check Name
        const checkH = worksheet.getCell(7, 3); checkH.value = 'Check Name';
        worksheet.mergeCells(7, 5, 9, 5); // Mark
        const markH = worksheet.getCell(7, 5); markH.value = 'Mark (Max)';

        worksheet.mergeCells(7, 6, 7, 51); // Day Wise Title
        const dayWiseH = worksheet.getCell(7, 6); dayWiseH.value = 'DAY WISE PERFORMANCE MONITORING';
        dayWiseH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

        worksheet.mergeCells(7, 52, 9, 52); // Evaluation
        const evalH = worksheet.getCell(7, 52); evalH.value = 'Evaluation after monitoring of 16 days';

        // Row 8: Days
        worksheet.mergeCells(8, 6, 8, 16); // Day 1
        worksheet.getCell(8, 6).value = 'Day-1';
        worksheet.mergeCells(8, 17, 8, 27); // Day 2
        worksheet.getCell(8, 17).value = 'Day-2';
        worksheet.mergeCells(8, 28, 8, 38); // Day 3
        worksheet.getCell(8, 28).value = 'Day-3';

        for (let i = 4; i <= 16; i++) {
            worksheet.mergeCells(8, 38 + (i - 3), 9, 38 + (i - 3));
            worksheet.getCell(8, 38 + (i - 3)).value = `Day-${i}`;
        }

        // Row 9: Sub-cols for Day 1-3
        for (let d = 0; d < 3; d++) {
            const startCol = 6 + (d * 11);
            for (let i = 0; i < 10; i++) {
                worksheet.getCell(9, startCol + i).value = i + 1;
            }
            worksheet.getCell(9, startCol + 10).value = 'Avg/Total';
        }

        // Style all headers
        for (let r = 7; r <= 9; r++) {
            const row = worksheet.getRow(r);
            row.eachCell(cell => {
                this._applyHeaderStyle(cell);
                cell.font = { bold: true, size: 8 };
            });
        }

        // 6. Data Rows
        let currentRow = 10;
        config.forEach((cat, catIdx) => {
            const totalRowsInCat = cat.rows.reduce((acc, row) => acc + (row.type === 'cycle_detailed' ? 4 : 1), 0);

            // Render rows for category
            cat.rows.forEach((row, rowIdx) => {
                const isCycleDetailed = row.type === 'cycle_detailed';
                const subRows = isCycleDetailed ? [
                    { id: 'target', label: 'C/T Target (Sec.)', hasMark: false },
                    { id: 'actual', label: 'C/T Actual', hasMark: false },
                    { id: 'achievement', label: 'Achievement %', hasMark: false, bg: 'FFFFFFE0' },
                    { id: 'score', label: 'Score', hasMark: true }
                ] : [{ id: '', label: row.label, hasMark: true }];

                subRows.forEach((sub, sIdx) => {
                    const excelRow = worksheet.getRow(currentRow);

                    // Merges for Category Labels
                    if (rowIdx === 0 && sIdx === 0) {
                        worksheet.mergeCells(currentRow, 1, currentRow + totalRowsInCat - 1, 1);
                        worksheet.getCell(currentRow, 1).value = catIdx + 1;
                        worksheet.mergeCells(currentRow, 2, currentRow + totalRowsInCat - 1, 2);
                        worksheet.getCell(currentRow, 2).value = cat.category;
                    }

                    // Merges for Parameter Label
                    if (isCycleDetailed && sIdx === 0) {
                        worksheet.mergeCells(currentRow, 3, currentRow + 2, 3);
                        worksheet.getCell(currentRow, 3).value = row.label;
                    } else if (!isCycleDetailed) {
                        worksheet.mergeCells(currentRow, 3, currentRow, 4);
                        worksheet.getCell(currentRow, 3).value = row.label;
                    }

                    // Sub-label (Target/Actual/etc)
                    if (isCycleDetailed) {
                        worksheet.getCell(currentRow, 4).value = sub.label;
                    }

                    // Mark
                    if (sub.hasMark) {
                        worksheet.getCell(currentRow, 5).value = row.weight;
                    }

                    // Data - Detailed Days (1-3)
                    daysDetailed.forEach((dayPrefix, dIdx) => {
                        const startCol = 6 + (dIdx * 11);
                        for (let i = 0; i < 10; i++) {
                            const key = isCycleDetailed ? `${row.id}_${dayPrefix}_${sub.id}_${i}` : `${row.id}_${dayPrefix}_${i}`;
                            worksheet.getCell(currentRow, startCol + i).value = gridData[key] || '';
                        }
                        const avgKey = isCycleDetailed ? `${row.id}_${dayPrefix}_${sub.id}_avg` : `${row.id}_${dayPrefix}_avg`;
                        const avgCell = worksheet.getCell(currentRow, startCol + 10);
                        avgCell.value = gridData[avgKey] || '';
                        avgCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Yellow
                    });

                    // Data - Summary Days (4-16)
                    daysSummary.forEach((dayKey, dsIdx) => {
                        const colIdx = 39 + dsIdx;
                        const key = isCycleDetailed ? `${row.id}_${dayKey}_${sub.id}` : `${row.id}_${dayKey}`;
                        worksheet.getCell(currentRow, colIdx).value = gridData[key] || '';
                    });

                    // Evaluation
                    if (sub.hasMark || !isCycleDetailed) {
                        worksheet.getCell(currentRow, 52).value = gridData[`${row.id}_eval`] || '';
                    }

                    // Final styling for row
                    excelRow.eachCell(cell => {
                        this._applyBorderStyle(cell);
                        cell.font = { size: 8 };
                        if (sub.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sub.bg } };
                    });

                    currentRow++;
                });
            });

            // Category Summary Row (Actual % / Total)
            const summaryRow = worksheet.getRow(currentRow);
            worksheet.mergeCells(currentRow, 1, currentRow, 4);
            worksheet.getCell(currentRow, 1).value = `Total Achievement % for ${cat.category.split('\n')[0]}`;
            worksheet.getCell(currentRow, 5).value = cat.totalMark || '';

            [...daysDetailed, ...daysSummary].forEach((d, dIdx) => {
                const colIdx = dIdx < 3 ? 16 + (dIdx * 11) : 39 + (dIdx - 3);
                worksheet.getCell(currentRow, colIdx).value = gridData[`${cat.id}_${d}_actual`] || '';
            });
            worksheet.getCell(currentRow, 52).value = gridData[`${cat.id}_eval_actual`] || '';

            summaryRow.eachCell(cell => {
                this._applyBorderStyle(cell);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCEEFF' } }; // Light Blue
                cell.font = { bold: true, size: 8 };
            });
            currentRow++;
        });

        // 7. Footer
        worksheet.mergeCells(currentRow + 1, 1, currentRow + 1, 52);
        const footerCell = worksheet.getCell(currentRow + 1, 1);
        footerCell.value = 'FRM-HR-004 | REV: 07 | REV DATE: 11.12.21 | PAGE: 1 OF 1';
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
        worksheet.mergeCells('A1:L1');
        const companyCell = worksheet.getCell('A1');
        companyCell.value = 'FURUKAWA MINDA ELECTRIC PVT. LTD.';
        companyCell.font = { bold: true, size: 10 };
        companyCell.alignment = { horizontal: 'right' };

        worksheet.mergeCells('A2:L2');
        const titleCell = worksheet.getCell('A2');
        titleCell.value = 'DAILY PRODUCTION REPORT';
        titleCell.font = { bold: true, size: 16 };
        titleCell.alignment = { horizontal: 'center' };

        // --- Info Section ---
        worksheet.addRow(['Date:', formData.date || '', 'Department:', formData.departmentName || formData.department || '', 'Shift:', formData.shift || '', 'Supervisor:', formData.leaderName || '']);
        worksheet.getRow(worksheet.lastRow.number).font = { bold: true };

        // --- 1. Delivery Section ---
        worksheet.addRow([]);
        const deliveryTitle = worksheet.addRow(['DELIVERY PERFORMANCE']);
        deliveryTitle.font = { bold: true, size: 12 };
        worksheet.mergeCells(deliveryTitle.number, 1, deliveryTitle.number, 12);

        const deliveryHeader = worksheet.addRow(['S.No', 'W/H Code', 'Plan Qty', 'Lot No', 'Start Time', '1st Hr', '2nd Hr', '3rd Hr', '4th Hr', '5th Hr', 'Total', 'Gap']);
        deliveryHeader.eachCell(cell => this._applyHeaderStyle(cell));

        if (formData.delivery && Array.isArray(formData.delivery)) {
            formData.delivery.forEach((item, index) => {
                if (!item.wHCode && !item.plan) return; // Skip empty rows
                const total = Number(item.total || 0);
                const gap = Number(item.plan || 0) - total;
                const row = worksheet.addRow([index + 1, item.wHCode || '', item.plan || 0, item.lotNo || '', item.startTime || '', item.hr1 || 0, item.hr2 || 0, item.hr3 || 0, item.hr4 || 0, item.hr5 || 0, total, gap]);
                row.eachCell(cell => this._applyBorderStyle(cell));
            });
        }

        // --- 2. Quality Section ---
        worksheet.addRow([]);
        const qualityTitle = worksheet.addRow(['QUALITY PERFORMANCE']);
        qualityTitle.font = { bold: true, size: 12 };
        worksheet.mergeCells(qualityTitle.number, 1, qualityTitle.number, 12);

        const qualityHeader = worksheet.addRow(['Type', 'Production Qty', 'Defect Qty', 'PPM', '', '', '', '', '', '', '', '']);
        worksheet.mergeCells(qualityHeader.number, 2, qualityHeader.number, 2);
        qualityHeader.eachCell(cell => this._applyHeaderStyle(cell));

        const q = formData.quality || {};
        const qRows = [
            ['Customer End', q.customerEndDefect?.productionQty || 0, q.customerEndDefect?.defectQty || 0, q.customerEndDefect?.ppm || 0],
            ['Internal Defect', q.internalDefect?.productionQty || 0, q.internalDefect?.defectQty || 0, q.internalDefect?.ppm || 0]
        ];
        qRows.forEach(qr => {
            const row = worksheet.addRow(qr);
            row.eachCell(cell => this._applyBorderStyle(cell));
        });

        // --- 3. Down Time Section ---
        worksheet.addRow([]);
        const dtTitle = worksheet.addRow(['DOWN TIME DETAILS']);
        dtTitle.font = { bold: true, size: 12 };
        worksheet.mergeCells(dtTitle.number, 1, dtTitle.number, 12);

        const dtHeader = worksheet.addRow(['Description', '1st Hr', '2nd Hr', '3rd Hr', '4th Hr', 'Total', '', '', '', '', '', '']);
        dtHeader.eachCell(cell => this._applyHeaderStyle(cell));

        const dt = formData.downTime || {};
        Object.entries(dt).forEach(([key, val]) => {
            if (typeof val !== 'object') return;
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            const row = worksheet.addRow([label, val.hr1 || 0, val.hr2 || 0, val.hr3 || 0, val.hr4 || 0, val.total || 0]);
            row.eachCell(cell => this._applyBorderStyle(cell));
        });

        // --- 4. Moral (Manpower) Section ---
        worksheet.addRow([]);
        const moralTitle = worksheet.addRow(['MORAL / MANPOWER STATUS']);
        moralTitle.font = { bold: true, size: 12 };
        worksheet.mergeCells(moralTitle.number, 1, moralTitle.number, 12);

        const moralHeader = worksheet.addRow(['Process', 'Handover', 'Present', 'Absent', 'Present (Actual)', '', '', '', '', '', '', '']);
        moralHeader.eachCell(cell => this._applyHeaderStyle(cell));

        if (formData.moral && Array.isArray(formData.moral)) {
            formData.moral.forEach(m => {
                const row = worksheet.addRow([m.process || '', m.handover || 0, m.present || 0, m.absent || 0, m.present2 || 0]);
                row.eachCell(cell => this._applyBorderStyle(cell));
            });
        }

        // --- 5. Kaizen Section ---
        worksheet.addRow([]);
        const kaizenTitle = worksheet.addRow(['KAIZEN DETAILS']);
        kaizenTitle.font = { bold: true, size: 12 };
        worksheet.mergeCells(kaizenTitle.number, 1, kaizenTitle.number, 12);

        const kaizenHeader = worksheet.addRow(['S.No', 'Details', 'Benefit', 'Status', 'Resp', '', '', '', '', '', '', '']);
        kaizenHeader.eachCell(cell => this._applyHeaderStyle(cell));

        if (formData.kaizenDetails && Array.isArray(formData.kaizenDetails)) {
            formData.kaizenDetails.forEach((k, idx) => {
                if (!k.details) return;
                const row = worksheet.addRow([idx + 1, k.details || '', k.benefit || '', k.status || '', k.resp || '']);
                row.eachCell(cell => this._applyBorderStyle(cell));
            });
        }

        // --- Footer ---
        const lastRowNumber = worksheet.lastRow.number + 2;
        worksheet.mergeCells(`A${lastRowNumber}:L${lastRowNumber}`);
        const footerCell = worksheet.getCell(`A${lastRowNumber}`);
        footerCell.value = 'FRM-PR-274 | REV: 03 | REV DATE: 09.02.2026';
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
