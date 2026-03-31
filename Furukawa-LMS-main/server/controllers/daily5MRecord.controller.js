import Daily5MRecord from "../models/daily5MRecord.model.js";
import { ApiError } from "../utils/ApiError.js";
import NotificationService from "../services/notification.service.js";
import { executeQuery } from "../db/mssqlHelper.js";

// Create a new record
export const create5MRecord = async (req, res, next) => {
    try {
        const { departmentId, date, shift, line, recordData, formType, sessionId } = req.body;
        const userId = req.user.id; // From auth middleware

        if (!departmentId || !date) {
            return next(new ApiError("Department and Date are required", 400));
        }

        const newRecord = await Daily5MRecord.upsert({
            departmentId,
            date,
            shift,
            line,
            recordData,
            formType,
            sessionId,
            submittedBy: userId
        });

        NotificationService.sendFormReport("Daily 5M Recording Sheet", departmentId, {
            departmentId,
            date,
            shift,
            line,
            formType,
            recordData,
            recordId: newRecord.id
        });

        res.status(201).json({
            success: true,
            message: "5M Record saved successfully",
            data: newRecord
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

// Get records with filters
export const get5MRecords = async (req, res, next) => {
    try {
        const { departmentId } = req.params;
        const { startDate, endDate, limit, offset, formType, groupBySession } = req.query;
        const { id: userId, role } = req.user;

        const filters = {
            departmentId,
            startDate,
            endDate,
            formType,
            groupBySession: groupBySession === 'true',
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0
        };

        // Restrict visibility: Only Admins/SuperAdmins can see all records.
        // Others see only their own saved records.
        if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
            filters.submittedBy = userId;
        }

        const records = await Daily5MRecord.findAll(filters);

        res.status(200).json({
            success: true,
            message: "Records fetched successfully",
            data: records
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

// Get single record by ID
export const get5MRecordById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const record = await Daily5MRecord.findById(id);

        if (!record) {
            return next(new ApiError("Record not found", 404));
        }

        res.status(200).json({
            success: true,
            message: "Record fetched successfully",
            data: record
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

// Get single record by Date and Department (Specific to User)
export const get5MRecordByDate = async (req, res, next) => {
    try {
        const { departmentId, date, userId: queryUserId } = req.query;
        const currentUserId = req.user.id;
        const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';

        if (!departmentId || !date) {
            return next(new ApiError("Department ID and Date are required", 400));
        }

        // If admin provides a userId, fetch that specific user's record.
        // Otherwise, fetch current user's record.
        const targetUserId = (isAdmin && queryUserId) ? queryUserId : currentUserId;

        const record = await Daily5MRecord.findByDateDeptAndUser(departmentId, date, targetUserId);

        if (!record) {
            // Return 200 with null data so frontend knows it's a new empty form
            return res.status(200).json({
                success: true,
                message: "No record found for this date",
                data: null
            });
        }

        res.status(200).json({
            success: true,
            message: "Record fetched successfully",
            data: record
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

// Delete record
export const delete5MRecord = async (req, res, next) => {
    try {
        const { id } = req.params;

        const success = await Daily5MRecord.delete(id);

        if (!success) {
            return next(new ApiError("Record not found or could not be deleted", 404));
        }

        res.status(200).json({
            success: true,
            message: "Record deleted successfully"
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};
// Approval logic
export const approve5MRecord = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await Daily5MRecord.updateStatus(id, 'APPROVED', userId);

        res.status(200).json({
            success: true,
            message: "Record approved successfully"
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

export const decline5MRecord = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await Daily5MRecord.updateStatus(id, 'DECLINED', userId);

        res.status(200).json({
            success: true,
            message: "Record declined successfully"
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

export const getApprovalStatus = async (req, res, next) => {
    try {
        const { departmentId, startDate, endDate, status } = req.query;

        let sql = `
            SELECT r.id, r.date, r.shift, r.line, r.status, r.departmentId, d.name as departmentName,
                   u.fullName as submittedByName, au.fullName as approvedByName, r.createdAt
            FROM daily_5m_records r
            LEFT JOIN users u ON r.submittedBy = CAST(u.id AS NVARCHAR(255))
            LEFT JOIN users au ON r.approvedBy = au.id
            LEFT JOIN departments d ON r.departmentId = d.id
            WHERE 1=1
        `;
        const params = [];

        if (departmentId) { sql += " AND r.departmentId = ?"; params.push(departmentId); }
        if (startDate) { sql += " AND r.date >= ?"; params.push(startDate); }
        if (endDate) { sql += " AND r.date <= ?"; params.push(endDate); }
        if (status) { sql += " AND r.status = ?"; params.push(status); }

        sql += " ORDER BY r.createdAt DESC";

        const [rows] = await executeQuery(sql, params);

        res.status(200).json({
            success: true,
            message: "Approval status fetched successfully",
            data: rows
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};
