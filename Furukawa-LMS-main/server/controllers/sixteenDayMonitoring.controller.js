import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import NotificationService from "../services/notification.service.js";
import SixteenDayMonitoring from "../models/sixteenDayMonitoring.model.js";
import MonitoringConfig from "../models/monitoringConfig.model.js";

import { executeQuery } from "../db/mssqlHelper.js";

// Helper to resolve studentId (from ID, userName, empId or slug)
const resolveStudentId = async (studentId) => {
    if (!studentId) return null;
    let users;
    // Check if it's already a number
    if (!isNaN(studentId) && !isNaN(parseFloat(studentId))) {
        [users] = await executeQuery("SELECT id FROM users WHERE id = ?", [studentId]);
        if (users.length > 0) return users[0].id;
    }
    // Otherwise check userName, slug or empId
    [users] = await executeQuery("SELECT id FROM users WHERE userName = ? OR slug = ? OR empId = ?", [studentId, studentId, studentId]);
    return users.length > 0 ? users[0].id : null;
};

export const getSixteenDayMonitoring = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    let data = await SixteenDayMonitoring.findByStudentId(sid);

    if (!data) {
        return res.status(200).json(
            new ApiResponse(200, { isNew: true }, "No record found")
        );
    }

    return res.status(200).json(
        new ApiResponse(200, {
            ...data,
            isNew: false,
        }, "16 Day Monitoring fetched successfully")
    );
});

export const saveSixteenDayMonitoring = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    const {
        employeeName, employeeCode, processName, dept,
        handoverDate, trgResult, workingWith, lineLeaderName,
        gridData
    } = req.body;

    let sheet = await SixteenDayMonitoring.findByStudentId(sid);

    if (sheet) {
        sheet.employeeName = employeeName;
        sheet.employeeCode = employeeCode;
        sheet.processName = processName;
        sheet.dept = dept;
        sheet.handoverDate = handoverDate;
        sheet.trgResult = trgResult;
        sheet.workingWith = workingWith;
        sheet.lineLeaderName = lineLeaderName;
        sheet.gridData = gridData;
        sheet.updatedBy = req.user?.fullName || req.user?.name;
        await sheet.save();
    } else {
        sheet = await SixteenDayMonitoring.create({
            studentId: sid,
            employeeName,
            employeeCode,
            processName,
            dept,
            handoverDate,
            trgResult,
            workingWith,
            lineLeaderName,
            gridData,
            createdBy: req.user?.fullName || req.user?.name
        });
    }

    // Trigger Email Notification
    NotificationService.sendFormReport("16-Day Monitoring Sheet", null, req.body, studentId)
        .catch(err => console.error("[16Day] Notification failed:", err));

    return res.status(200).json(
        new ApiResponse(200, sheet, "16 Day Monitoring saved successfully")
    );
});

export const getSixteenDayMonitoringConfig = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const config = await MonitoringConfig.findByTypeAndDepartment('16DAY', departmentId);
    return res.status(200).json(
        new ApiResponse(200, { config: config?.config || null }, "16 Day Monitoring config fetched")
    );
});

export const saveSixteenDayMonitoringConfig = asyncHandler(async (req, res) => {
    const { departmentId, config, remark } = req.body;
    await MonitoringConfig.upsert({
        type: '16DAY',
        departmentId,
        config,
        remark,
        updatedBy: req.user?.name
    });
    return res.status(200).json(
        new ApiResponse(200, null, "16 Day Monitoring config saved")
    );
});

export const getSixteenDayMonitoringHistory = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const history = await MonitoringConfig.getHistory('16DAY', departmentId);
    return res.status(200).json(
        new ApiResponse(200, history, "16 Day Monitoring history fetched")
    );
});
