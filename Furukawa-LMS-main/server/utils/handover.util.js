import { pool } from "../db/connectDB.js";
import logger from "../logger/winston.logger.js";
import fs from "fs";
import path from "path";

// Helper for file logging
const logToFile = (msg) => {
    try {
        const logFile = path.join(process.cwd(), 'debug_handover.log');
        const time = new Date().toISOString();
        if (typeof msg === 'object') msg = JSON.stringify(msg);
        fs.appendFileSync(logFile, `[${time}] ${msg}\n`);
    } catch (e) {
        console.error("Failed to write to debug log", e);
    }
};

export const checkAndProcessHandover = async (userId, currentLevel) => {
    if (currentLevel === 'L1') return; // Only for L2+ (or whatever the logic is)

    try {
        logToFile(`[HandoverUtil] Processing handover for user ${userId} at level ${currentLevel}`);

        // Dynamic imports to avoid circular deps if any, though models are usually fine
        const User = (await import("../models/auth.model.js")).default;
        const Department = (await import("../models/department.model.js")).default;
        const HandoverSheet = (await import("../models/handoverSheet.model.js")).default;
        const NotificationService = (await import("../services/notification.service.js")).default;

        // 1. Get User Details
        const user = await User.findById(userId);
        if (!user || !user.department) {
            logToFile(`[HandoverUtil] User not found or no department.`);
            return;
        }

        const departmentId = user.department;
        logToFile(`[HandoverUtil] User ${user.fullName} (${user.empId}) in Dept ${departmentId}`);

        // 2. Get/Create Handover Sheet
        let sheet = await HandoverSheet.findByDepartmentId(departmentId);
        if (!sheet) {
            logToFile(`[HandoverUtil] Creating new sheet for department ${departmentId}`);
            sheet = await HandoverSheet.create({
                departmentId,
                date: new Date(),
                entries: [],
                signatures: {},
                metadata: {},
                createdBy: 'SYSTEM'
            });
        }

        // 3. Check if exists
        const entries = sheet.entries || [];
        const exists = entries.some(e => String(e.studentId) === String(userId));

        if (exists) {
            logToFile(`[HandoverUtil] User already in sheet.`);
            return;
        }

        // 4. Add Student
        const department = await Department.findById(departmentId);

        let instructorName = "";
        let instructorEmail = null;
        let instructorFullName = "Trainer";

        if (department && department.instructor) {
            if (typeof department.instructor === 'object') {
                instructorName = department.instructor.fullName;
                instructorEmail = department.instructor.email;
                instructorFullName = department.instructor.fullName;
            } else {
                const u = await User.findById(department.instructor);
                if (u) {
                    instructorName = u.fullName;
                    instructorEmail = u.email;
                    instructorFullName = u.fullName;
                }
            }
        }

        const newEntry = {
            sn: entries.length + 1,
            studentId: String(userId),
            employeeName: user.fullName,
            empCode: user.empId || "",
            marks: "0%",
            department: department ? department.name : "Quality",
            process: "",
            mentor: instructorName,
            interview1: "",
            interview2: ""
        };

        logToFile(`[HandoverUtil] Adding entry: ${JSON.stringify(newEntry)}`);
        sheet.entries.push(newEntry);
        sheet.updatedBy = 'SYSTEM (Auto-Handover)';
        await sheet.save();
        logToFile(`[HandoverUtil] Sheet saved.`);

        // 5. Trigger Email Notification via Centralized Service
        NotificationService.sendFormReport("Handover Sheet", departmentId, sheet)
            .catch(err => console.error("[HandoverUtil] Notification failed:", err));

        logToFile(`[HandoverUtil] Notification triggered via NotificationService.`);

    } catch (err) {
        logToFile(`[HandoverUtil] Error: ${err.message}\n${err.stack}`);
        logger.error("Handover Processing Failed", err);
    }
};
// ... existing code ...

export const checkAndProcessMaxLevelNotification = async (userId, currentLevel) => {
    try {
        logToFile(`[MaxLevelUtil] Checking max level for user ${userId} at level ${currentLevel}`);

        const User = (await import("../models/auth.model.js")).default;
        const Department = (await import("../models/department.model.js")).default;
        const CourseLevelConfig = (await import("../models/courseLevelConfig.model.js")).default;
        const { generateMaxLevelNotificationEmail } = await import("./emailTemplates.js");
        const sendMail = (await import("./mail.util.js")).default;

        // 1. Get Active Config & Max Level
        const config = await CourseLevelConfig.getActiveConfig();
        if (!config || !config.levels || config.levels.length === 0) {
            logToFile(`[MaxLevelUtil] No active config or levels found.`);
            return;
        }

        const maxLevelObj = config.levels[config.levels.length - 1];
        const maxLevelName = maxLevelObj.name;

        logToFile(`[MaxLevelUtil] Max level defined is: ${maxLevelName}`);

        // Normalize for comparison
        const normalize = (s) => String(s).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

        if (normalize(currentLevel) !== normalize(maxLevelName)) {
            logToFile(`[MaxLevelUtil] User level ${currentLevel} is not max level.`);
            return;
        }

        // 2. User reached max level -> Get Details
        const user = await User.findById(userId);
        if (!user || !user.department) {
            logToFile(`[MaxLevelUtil] User not found or no department.`);
            return;
        }

        const department = await Department.findById(user.department);
        if (!department) return;

        // 3. Get Instructor
        let instructorEmail = null;
        let instructorName = "Trainer";

        if (department.instructor) {
            if (typeof department.instructor === 'object') {
                instructorEmail = department.instructor.email;
                instructorName = department.instructor.fullName;
            } else {
                const u = await User.findById(department.instructor);
                if (u) {
                    instructorEmail = u.email;
                    instructorName = u.fullName;
                }
            }
        }

        if (instructorEmail) {
            const emailHtml = generateMaxLevelNotificationEmail({
                instructorName,
                studentName: user.fullName,
                studentId: user.empId || "N/A",
                level: currentLevel,
                departmentName: department.name
            });

            await sendMail(
                instructorEmail,
                `Max Skill Level Reached - ${user.fullName}`,
                emailHtml
            );
            logToFile(`[MaxLevelUtil] Max level notification sent to ${instructorEmail}`);
        } else {
            logToFile(`[MaxLevelUtil] No instructor email to send notification.`);
        }

    } catch (err) {
        logToFile(`[MaxLevelUtil] Error: ${err.message}`);
        console.error("Max Level Notification Failed", err);
    }
};
