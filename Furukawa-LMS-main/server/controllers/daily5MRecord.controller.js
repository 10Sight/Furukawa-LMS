import Daily5MRecord from "../models/daily5MRecord.model.js";
import Department from "../models/department.model.js";
import Section from "../models/section.model.js";
import { ApiError } from "../utils/ApiError.js";
import NotificationService from "../services/notification.service.js";
import { executeQuery } from "../db/mssqlHelper.js";
import logAudit from "../utils/auditLogger.js";
import { canActOnRow } from "../../shared/daily5mRouting.js";

// Create a new record
export const create5MRecord = async (req, res, next) => {
    try {
        const { departmentId, sectionId, date, shift, line, recordData, formType, sessionId, adminRemarks } = req.body;
        const userId = req.user.id; // From auth middleware

        if (!departmentId || !date) {
            return next(new ApiError("Department and Date are required", 400));
        }

        // Fetch the previous state of this session (if any) so we can detect row-level
        // approve/reject transitions caused by this save.
        let previousRecordData = null;
        let previousSubmittedBy = null;
        if (sessionId) {
            const [existingRows] = await executeQuery(
                `SELECT TOP 1 recordData, submittedBy FROM daily_5m_records WHERE sessionId = ? ORDER BY createdAt DESC`,
                [sessionId]
            );
            if (existingRows && existingRows.length > 0 && existingRows[0].recordData) {
                previousRecordData = typeof existingRows[0].recordData === 'string'
                    ? JSON.parse(existingRows[0].recordData)
                    : existingRows[0].recordData;
                previousSubmittedBy = existingRows[0].submittedBy;
            }
        }

        // Server-side Segregation of Duties check: validate every row transitioning to
        // APPROVED/REJECTED against the source department's configured approval routing.
        // Self-approval is blocked for everyone, including admins; the routing check alone
        // is bypassable by admins (see canActOnRow).
        if (previousRecordData && recordData) {
            const [sourceDepartment, sourceSection] = await Promise.all([
                Department.findById(departmentId),
                sectionId ? Section.findById(sectionId) : Promise.resolve(null)
            ]);
            for (let i = 0; i < 20; i++) {
                const prevStatus = previousRecordData[`rec_${i}_RowStatus`];
                const newStatus = recordData[`rec_${i}_RowStatus`];
                if (newStatus && newStatus !== prevStatus && (newStatus === 'APPROVED' || newStatus === 'REJECTED')) {
                    const { allowed, reason } = canActOnRow(req.user, previousSubmittedBy, sourceDepartment, sourceSection);
                    if (!allowed) {
                        return next(new ApiError(reason, 403));
                    }
                }
            }
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

        if (previousRecordData && recordData) {
            for (let i = 0; i < 20; i++) {
                const prevStatus = previousRecordData[`rec_${i}_RowStatus`];
                const newStatus = recordData[`rec_${i}_RowStatus`];
                if (newStatus && newStatus !== prevStatus && (newStatus === 'APPROVED' || newStatus === 'REJECTED')) {
                    logAudit(userId, "ROW_CHECK_DAILY_5M", {
                        rowIndex: i,
                        outcome: newStatus,
                        actionBy: recordData[`rec_${i}_ActionBy`] || null
                    }, { resourceType: "DAILY_5M_RECORD", resourceId: newRecord.id, req })
                        .catch(err => console.error("logAudit(ROW_CHECK_DAILY_5M) failed:", err.message));
                }
            }
        }

        const auditAction = sessionId ? "UPDATE_DAILY_5M_RECORD" : "CREATE_DAILY_5M_RECORD";
        logAudit(userId, auditAction, { departmentId, sectionId, formType, date, shift }, { resourceType: "DAILY_5M_RECORD", resourceId: newRecord.id, req })
            .catch(err => console.error(`logAudit(${auditAction}) failed:`, err.message));

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

        logAudit(userId, "VIEW_DAILY_5M_RECORDS_LIST", { departmentId, sectionId, startDate, endDate, formType }, { resourceType: "DAILY_5M_RECORD", req })
            .catch(err => console.error("logAudit(VIEW_DAILY_5M_RECORDS_LIST) failed:", err.message));

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

        logAudit(req.user?.id, "VIEW_DAILY_5M_RECORD_DETAILS", { recordId: id }, { resourceType: "DAILY_5M_RECORD", resourceId: id, req })
            .catch(err => console.error("logAudit(VIEW_DAILY_5M_RECORD_DETAILS) failed:", err.message));

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

        logAudit(req.user?.id, "DELETE_DAILY_5M_RECORD", { recordId: id }, { resourceType: "DAILY_5M_RECORD", resourceId: id, req })
            .catch(err => console.error("logAudit(DELETE_DAILY_5M_RECORD) failed:", err.message));

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

        logAudit(req.user.id, "SUBMIT_DAILY_5M_RECORD", { recordId: id }, { resourceType: "DAILY_5M_RECORD", resourceId: id, req })
            .catch(err => console.error("logAudit(SUBMIT_DAILY_5M_RECORD) failed:", err.message));

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

        logAudit(req.user?.id, "SEND_DAILY_5M_EMAIL", { recordId: id }, { resourceType: "DAILY_5M_RECORD", resourceId: id, req })
            .catch(err => console.error("logAudit(SEND_DAILY_5M_EMAIL) failed:", err.message));

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

        logAudit(userId, "APPROVE_DAILY_5M_RECORD", { recordId: id }, { resourceType: "DAILY_5M_RECORD", resourceId: id, req })
            .catch(err => console.error("logAudit(APPROVE_DAILY_5M_RECORD) failed:", err.message));

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

        logAudit(userId, "DECLINE_DAILY_5M_RECORD", { recordId: id }, { resourceType: "DAILY_5M_RECORD", resourceId: id, req })
            .catch(err => console.error("logAudit(DECLINE_DAILY_5M_RECORD) failed:", err.message));

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

