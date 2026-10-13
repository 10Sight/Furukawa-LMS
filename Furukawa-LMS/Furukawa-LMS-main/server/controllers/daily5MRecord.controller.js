import Daily5MRecord from "../models/daily5MRecord.model.js";
import Department from "../models/department.model.js";
import Section from "../models/section.model.js";
import { ApiError } from "../utils/ApiError.js";
import NotificationService from "../services/notification.service.js";
import { executeQuery } from "../db/mssqlHelper.js";
import logAudit from "../utils/auditLogger.js";
import { canActOnRow, matchesDaily5MRouting } from "../../shared/daily5mRouting.js";
import { scope5MRequest, canView5MRecord } from "../utils/daily5mScope.util.js";
import { hasAnyPermission } from "../middlewares/roleAuth.middleware.js";
import { formatLocalDate } from "../utils/istDate.util.js";

const toDateStr = (value) => value instanceof Date ? (formatLocalDate(value) || "") : String(value || "").split('T')[0];

// Row dates must be today unless the user holds daily5m:select_past_date, and the date of an
// approved row is frozen unless they hold daily5m:edit_approved_date (which also requires a remark).
// Only dates that are new or changed are checked, so previously saved rows never block a re-save.
// Returns the date to store on the session: it follows row 0, and on an existing session it only
// moves when row 0's date was changed by this save (the client-sent date is ignored).
const check5MDates = ({ user, recordData, date, previous, adminRemarks }) => {
    const isAdmin = user?.isAdmin || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
    const canSelectPastDate = isAdmin || hasAnyPermission(user, ['daily5m:select_past_date']);
    const canEditApprovedDate = isAdmin || hasAnyPermission(user, ['daily5m:edit_approved_date']);
    // Plant-local "today" (IST), independent of the server's own timezone
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    const rangeError = (dateStr, label) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new ApiError(`${label}: Invalid date (${dateStr}).`, 400);
        if (dateStr > todayStr) return new ApiError(`${label}: Future dates are not allowed (${dateStr}).`, 400);
        if (dateStr < todayStr && !canSelectPastDate) {
            return new ApiError(`${label}: You do not have permission to select past dates (${dateStr}).`, 403);
        }
        return null;
    };

    const approvedDateChanges = [];
    const backdatedRows = [];
    for (let i = 0; i < 20; i++) {
        const newDate = toDateStr(recordData?.[`rec_${i}_Date`]);
        const prevDate = toDateStr(previous?.recordData?.[`rec_${i}_Date`]);
        if (newDate === prevDate) continue;

        const wasApproved = previous?.recordData?.[`rec_${i}_RowStatus`] === 'APPROVED' || (!!prevDate && previous?.status === 'APPROVED');
        if (wasApproved) {
            if (!canEditApprovedDate) {
                return { error: new ApiError(`Row ${i + 1}: You do not have permission to edit the date of an approved row.`, 403) };
            }
            approvedDateChanges.push({ rowIndex: i, from: prevDate, to: newDate || null });
        }
        if (newDate) {
            const error = rangeError(newDate, `Row ${i + 1}`);
            if (error) return { error };
            if (newDate < todayStr) backdatedRows.push({ rowIndex: i, date: newDate });
        }
    }

    if (approvedDateChanges.length > 0 && String(adminRemarks || "").trim().length < 10) {
        return { error: new ApiError("A remark of at least 10 characters is required when changing the date of an approved row.", 400) };
    }

    const row0Date = toDateStr(recordData?.rec_0_Date);
    let sessionDate;
    if (previous) {
        const row0Changed = row0Date && row0Date !== toDateStr(previous.recordData?.rec_0_Date);
        sessionDate = row0Changed ? row0Date : (toDateStr(previous.date) || toDateStr(date));
    } else if (row0Date) {
        sessionDate = row0Date;
    } else {
        sessionDate = toDateStr(date);
        const error = rangeError(sessionDate, "Session date");
        if (error) return { error };
    }

    const isBackdatedSession = !previous && sessionDate < todayStr;
    return { sessionDate, approvedDateChanges, backdatedRows, isBackdatedSession };
};

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
        let previous = null;
        if (sessionId) {
            const [existingRows] = await executeQuery(
                `SELECT TOP 1 recordData, submittedBy, date, status FROM daily_5m_records WHERE sessionId = ? ORDER BY createdAt DESC`,
                [sessionId]
            );
            if (existingRows && existingRows.length > 0 && existingRows[0].recordData) {
                previousRecordData = typeof existingRows[0].recordData === 'string'
                    ? JSON.parse(existingRows[0].recordData)
                    : existingRows[0].recordData;
                previousSubmittedBy = existingRows[0].submittedBy;
            }
            if (existingRows && existingRows.length > 0) {
                previous = { recordData: previousRecordData || {}, date: existingRows[0].date, status: existingRows[0].status };
            }
        }

        const dateCheck = check5MDates({ user: req.user, recordData, date, previous, adminRemarks });
        if (dateCheck.error) {
            return next(dateCheck.error);
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
            date: dateCheck.sessionDate,
            shift,
            line,
            recordData,
            formType,
            sessionId,
            adminRemarks,
            submittedBy: userId
        });

        if (dateCheck.approvedDateChanges.length > 0) {
            logAudit(userId, "UPDATE_DAILY_5M_APPROVED_DATE", {
                sessionId: newRecord.sessionId,
                changes: dateCheck.approvedDateChanges,
                remark: String(adminRemarks).trim()
            }, { resourceType: "DAILY_5M_RECORD", resourceId: newRecord.id, req })
                .catch(err => console.error("logAudit(UPDATE_DAILY_5M_APPROVED_DATE) failed:", err.message));
        }
        if (dateCheck.backdatedRows.length > 0 || dateCheck.isBackdatedSession) {
            logAudit(userId, "BACKDATE_DAILY_5M", {
                sessionId: newRecord.sessionId,
                sessionDate: dateCheck.sessionDate,
                rows: dateCheck.backdatedRows
            }, { resourceType: "DAILY_5M_RECORD", resourceId: newRecord.id, req })
                .catch(err => console.error("logAudit(BACKDATE_DAILY_5M) failed:", err.message));
        }

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
        logAudit(userId, auditAction, { departmentId, sectionId, formType, date: dateCheck.sessionDate, shift }, { resourceType: "DAILY_5M_RECORD", resourceId: newRecord.id, req })
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

        const limitInt = parseInt(limit) || 50;
        const scoped = scope5MRequest(req.user, departmentId, sectionId);
        if (scoped.forbidden) {
            return next(new ApiError(scoped.forbidden, 403));
        }

        const filters = {
            departmentId: scoped.departmentId === 'all' ? null : scoped.departmentId,
            sectionId: scoped.sectionId,
            startDate,
            endDate,
            search,
            formType,
            groupBySession: groupBySession === 'true',
            limit: limitInt,
            offset: parseInt(offset) || 0,
            allowedDepartmentIds: scoped.empty ? [] : scoped.allowedDepartmentIds,
            allowedSectionIds: scoped.allowedSectionIds
        };

        const { records, totalCount } = await Daily5MRecord.findAll(filters);

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

        // Users outside the record's own department/section may still open it when that source
        // department (or section) routes its approvals to them. Their department/section lists
        // don't include the source, so send what the sheet needs to label it and check routing.
        let routedAccess = null;
        if (!canView5MRecord(req.user, record)) {
            const [sourceDepartment, sourceSection] = await Promise.all([
                Department.findById(record.departmentId),
                record.sectionId ? Section.findById(record.sectionId) : Promise.resolve(null)
            ]);
            if (!matchesDaily5MRouting(req.user, sourceDepartment, sourceSection)) {
                return next(new ApiError("You do not have access to this record", 403));
            }
            const routingSource = (source) => source && {
                id: source.id,
                name: source.name,
                category: source.category || null,
                daily5mApproverDeptId: source.daily5mApproverDeptId || null,
                daily5mApproverSectionId: source.daily5mApproverSectionId || null,
                daily5mApproverLineId: source.daily5mApproverLineId || null
            };
            routedAccess = { department: routingSource(sourceDepartment), section: routingSource(sourceSection) };
        }

        logAudit(req.user?.id, "VIEW_DAILY_5M_RECORD_DETAILS", { recordId: id }, { resourceType: "DAILY_5M_RECORD", resourceId: id, req })
            .catch(err => console.error("logAudit(VIEW_DAILY_5M_RECORD_DETAILS) failed:", err.message));

        res.status(200).json({
            success: true,
            message: "Record fetched successfully",
            data: record,
            routedAccess
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

        const scoped = scope5MRequest(req.user, departmentId, sectionId);
        if (scoped.forbidden) {
            return next(new ApiError(scoped.forbidden, 403));
        }

        const stats = await Daily5MRecord.getStats({
            departmentId: scoped.departmentId,
            sectionId: scoped.sectionId,
            startDate,
            endDate,
            formType,
            allowedDepartmentIds: scoped.empty ? [] : scoped.allowedDepartmentIds,
            allowedSectionIds: scoped.allowedSectionIds
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

        const scoped = scope5MRequest(req.user, departmentId, sectionId);
        if (scoped.forbidden) {
            return next(new ApiError(scoped.forbidden, 403));
        }

        const rowStats = await Daily5MRecord.getRowStats({
            departmentId: scoped.departmentId,
            sectionId: scoped.sectionId,
            startDate,
            endDate,
            allowedDepartmentIds: scoped.empty ? [] : scoped.allowedDepartmentIds,
            allowedSectionIds: scoped.allowedSectionIds
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

