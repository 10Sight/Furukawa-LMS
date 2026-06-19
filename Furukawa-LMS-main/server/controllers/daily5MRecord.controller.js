import Daily5MRecord from "../models/daily5MRecord.model.js";
import { ApiError } from "../utils/ApiError.js";
import NotificationService from "../services/notification.service.js";
import { executeQuery } from "../db/mssqlHelper.js";

// Create a new record
export const create5MRecord = async (req, res, next) => {
    try {
        const { departmentId, sectionId, date, shift, line, recordData, formType, sessionId, adminRemarks } = req.body;
        const userId = req.user.id; // From auth middleware

        if (!departmentId || !date) {
            return next(new ApiError("Department and Date are required", 400));
        }

        const newRecord = await Daily5MRecord.upsert({
            departmentId,
            sectionId,
            date,
            shift,
            line,
            recordData,
            formType,
            sessionId,
            adminRemarks,
            submittedBy: userId
        });

        /* Automatic report sending removed as per user request to move to a Save -> Preview -> Submit flow */
        /*
        NotificationService.sendFormReport("Daily 5M Recording Sheet", departmentId, {
            departmentId,
            sectionId,
            date,
            shift,
            line,
            formType,
            recordData,
            recordId: newRecord.id
        });
        */

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
        const { sectionId, startDate, endDate, limit, offset, formType, groupBySession, search } = req.query;
        const { id: userId, role } = req.user;

        const filters = {
            departmentId: departmentId === 'all' ? null : departmentId,
            sectionId,
            startDate,
            endDate,
            search,
            formType,
            groupBySession: groupBySession === 'true',
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0
        };

        // Visibility restriction removed: All users can now see history for their departments
        // Previously: filters.submittedBy = userId; for regular users

        const { records, totalCount } = await Daily5MRecord.findAll(filters);
        const limitInt = parseInt(limit) || 50;

        res.status(200).json({
            success: true,
            message: "Records fetched successfully",
            data: records,
            pagination: {
                total: totalCount,
                pages: Math.ceil(totalCount / limitInt),
                currentPage: Math.floor((parseInt(offset) || 0) / limitInt) + 1,
                pageSize: limitInt
            }
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
        const { departmentId, sectionId, date, userId: queryUserId } = req.query;
        const currentUserId = req.user.id;
        const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';

        if (!departmentId || !date) {
            return next(new ApiError("Department ID and Date are required", 400));
        }

        // Fetch the latest record for this department/section/date across all users to allow viewing history.
        // If an admin wants a specific user's record, they can still specify it.
        const targetUserId = (isAdmin && queryUserId) ? queryUserId : null;

        const record = await Daily5MRecord.findByDateDeptAndUser(departmentId, date, targetUserId, sectionId);

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

// Submit record (Update status to SUBMITTED)
export const submit5MRecord = async (req, res, next) => {
    try {
        const { id } = req.params;
        const record = await Daily5MRecord.findById(id);

        if (!record) {
            return next(new ApiError("Record not found", 404));
        }

        // Update record status to 'SUBMITTED' in database
        await Daily5MRecord.updateStatus(id, 'SUBMITTED', req.user.id);

        res.status(200).json({
            success: true,
            message: "Record submitted successfully"
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

// Send 5M Record Email notification
export const send5MEmail = async (req, res, next) => {
    try {
        const { id } = req.params;
        const record = await Daily5MRecord.findById(id);

        if (!record) {
            return next(new ApiError("Record not found", 404));
        }

        // Trigger Notification Service
        await NotificationService.sendFormReport("Daily 5M Recording Sheet", record.departmentId, {
            departmentId: record.departmentId,
            sectionId: record.sectionId,
            date: record.date ? new Date(record.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            shift: record.shift,
            line: record.line,
            formType: record.formType,
            recordData: record.recordData,
            recordId: record.id
        });

        res.status(200).json({
            success: true,
            message: "Email notification sent successfully"
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

// Approve a record
export const approve5MRecord = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const success = await Daily5MRecord.updateStatus(id, 'APPROVED', userId);

        if (!success) {
            return next(new ApiError("Record not found", 404));
        }

        res.status(200).json({
            success: true,
            message: "Record approved successfully"
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

// Decline a record
export const decline5MRecord = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const success = await Daily5MRecord.updateStatus(id, 'REJECTED', userId);

        if (!success) {
            return next(new ApiError("Record not found", 404));
        }

        res.status(200).json({
            success: true,
            message: "Record declined successfully"
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

// Get Approval status summary
export const getApprovalStatus = async (req, res, next) => {
    try {
        const query = `
            SELECT status, COUNT(*) as count 
            FROM daily_5m_records 
            GROUP BY status
        `;
        const [rows] = await executeQuery(query);
        
        res.status(200).json({
            success: true,
            data: rows
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};// Get daily stats for bar chart
export const getDaily5MStats = async (req, res, next) => {
    try {
        const { departmentId } = req.params;
        const { sectionId, startDate, endDate, formType } = req.query;

        const stats = await Daily5MRecord.getStats({
            departmentId,
            sectionId,
            startDate,
            endDate,
            formType
        });

        res.status(200).json({
            success: true,
            message: "Stats fetched successfully",
            data: stats
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

export const getDaily5MRowStats = async (req, res, next) => {
    try {
        const { departmentId } = req.params;
        const { sectionId, startDate, endDate } = req.query;

        const rowStats = await Daily5MRecord.getRowStats({
            departmentId,
            sectionId,
            startDate,
            endDate
        });

        res.status(200).json({
            success: true,
            message: "Row stats fetched successfully",
            data: rowStats
        });
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
};

