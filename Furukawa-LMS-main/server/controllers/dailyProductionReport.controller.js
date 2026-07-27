import DailyProductionReport from '../models/dailyProductionReport.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import NotificationService from '../services/notification.service.js';
import RevisionRecordService from '../services/revisionRecord.service.js';

/**
 * @desc    Get Daily Production Report
 * @route   GET /api/v1/daily-production-report
 * @access  Private
 */
export const getDailyProductionReport = asyncHandler(async (req, res, next) => {
    const { date, department, line, shift } = req.query;

    if (!date || !department || !line || !shift) {
        return next(new ApiError('Please provide date, department, line, and shift', 400));
    }

    const formattedDate = new Date(date).toISOString().split('T')[0];

    const report = await DailyProductionReport.findOne({
        date: formattedDate,
        department,
        line,
        shift
    });

    res.status(200).json({
        success: true,
        data: report
    });
});

/**
 * @desc    Save/Update Daily Production Report
 * @route   POST /api/v1/daily-production-report
 * @access  Private
 */
export const saveDailyProductionReport = asyncHandler(async (req, res, next) => {
    const { date, department, line, shift, isSubmitted } = req.body;

    if (!date || !department || !line || !shift) {
        return next(new ApiError('Please provide date, department, line, and shift', 400));
    }

    const formattedDate = new Date(date).toISOString().split('T')[0];

    // 1. Check if report already exists
    const existingReport = await DailyProductionReport.findOne({
        date: formattedDate,
        department,
        line,
        shift
    });

    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN' || req.user.isAdmin;

    // Check if it's already approved
    if (existingReport && existingReport.status === 'APPROVED' && !isAdmin) {
        return next(new ApiError('This report has been approved and cannot be edited.', 403));
    }

    // Check if it's submitted and user is not admin
    if (existingReport && existingReport.isSubmitted && !isAdmin) {
        return next(new ApiError('This report has already been submitted and cannot be edited.', 403));
    }

    // Prepare update data
    const updateData = {
        ...req.body,
        date: formattedDate,
        submittedBy: isSubmitted ? req.user.id : (existingReport?.submittedBy || null),
        status: isSubmitted ? 'SUBMITTED' : (existingReport?.status || 'DRAFT')
    };

    // Brand-new report: freeze whatever the Revision Table currently says for this
    // form. Existing reports are untouched — the model's UPDATE branch never writes
    // these columns, regardless of what's in updateData.
    if (!existingReport) {
        const revision = await RevisionRecordService.getLatestForSheet('daily-production-report');
        if (revision?.docNo) {
            updateData.docNo = revision.docNo;
            updateData.revNo = revision.revNo;
            updateData.revDate = revision.revDate;
        }
    }

    // Auto-set madeBy if being submitted and not set
    if (isSubmitted && (!updateData.madeBy || updateData.madeBy === "")) {
        updateData.madeBy = req.user.name || req.user.userName;
    }

    // Use custom upsert method from MySQL class
    const report = await DailyProductionReport.upsert(updateData);

    // 2. Trigger Email Notification ONLY if being submitted now
    if (isSubmitted && (!existingReport || !existingReport.isSubmitted)) {
        NotificationService.sendFormReport("Daily Production Report Sheet", department, updateData)
            .catch(err => console.error("[DPR] Notification failed:", err));
    }

    res.status(200).json({
        success: true,
        message: isSubmitted ? 'Report submitted successfully' : 'Report saved successfully',
        data: report
    });
});

/**
 * @desc    Approve/Reject Daily Production Report
 * @route   POST /api/v1/daily-production-report/check
 * @access  Private (Admin/Authorized)
 */
export const checkDailyProductionReport = asyncHandler(async (req, res, next) => {
    const { date, department, line, shift, action, remark } = req.body;

    if (!date || !department || !line || !shift || !action) {
        return next(new ApiError('Please provide all required fields', 400));
    }

    const formattedDate = new Date(date).toISOString().split('T')[0];
    const report = await DailyProductionReport.findOne({ date: formattedDate, department, line, shift });

    if (!report) {
        return next(new ApiError('Report not found', 404));
    }

    const userName = req.user.name || req.user.userName;
    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
    const checkedByLabel = action === 'approve' ? `Approved by ${userName}` : `Rejected by ${userName}`;

    const updateData = {
        ...report,
        status: newStatus,
        checkedBy: checkedByLabel,
        checkedByUserId: req.user.id
    };

    const updated = await DailyProductionReport.upsert(updateData);

    res.status(200).json({
        success: true,
        message: `Report ${action}d successfully`,
        data: updated
    });
});

/**
 * @desc    List Daily Production Reports
 * @route   GET /api/v1/daily-production-report/list
 * @access  Private
 */
export const listDailyProductionReports = async (req, res, next) => {
    try {
        const filters = req.query;
        const { reports, totalCount } = await DailyProductionReport.findAll(filters);

        res.status(200).json({
            success: true,
            data: reports,
            totalCount
        });
    } catch (error) {
        next(new ApiError(error.message, 500));
    }
};

/**
 * @desc    Delete Daily Production Report
 * @route   DELETE /api/v1/daily-production-report/:id
 * @access  Private
 */
export const deleteDailyProductionReport = async (req, res, next) => {
    try {
        const { id } = req.params;
        await DailyProductionReport.delete(id);

        res.status(200).json({
            success: true,
            message: 'Report deleted successfully'
        });
    } catch (error) {
        next(new ApiError(error.message, 500));
    }
};

/**
 * @desc    Get Manpower Attendance Statistics for specific sub-sections
 * @route   GET /api/v1/daily-production-report/manpower-stats
 * @access  Private
 */
export const getManpowerStats = async (req, res, next) => {
    try {
        const { date, shift } = req.query;
        // Handle both 'subSectionIds' and 'subSectionIds[]' (common with Axios)
        const subSectionIds = req.query.subSectionIds || req.query['subSectionIds[]'];

        if (!date || !shift || !subSectionIds) {
            return next(new ApiError('Please provide date, shift, and subSectionIds', 400));
        }

        const ids = Array.isArray(subSectionIds) ? subSectionIds : subSectionIds.split(',');
        if (ids.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }

        const stats = await DailyProductionReport.getManpowerStats(date, shift, ids);

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        next(new ApiError(error.message, 500));
    }
};

/**
 * @desc    Get assigned employees for multiple machines (Stations) for DPR
 * @route   GET /api/v1/daily-production-report/machine-assignments
 * @access  Private
 */
export const getBatchMachineAssignments = async (req, res, next) => {
    try {
        const { date, shift } = req.query;
        // Handle both 'machineIds' and 'machineIds[]' (common with Axios)
        const machineIds = req.query.machineIds || req.query['machineIds[]'];

        if (!date || !shift || !machineIds) {
            return next(new ApiError('Please provide machineIds, date, and shift', 400));
        }

        const ids = Array.isArray(machineIds) ? machineIds : machineIds.split(',');
        if (ids.length === 0) {
            return res.status(200).json({ success: true, data: {} });
        }

        const assignments = await DailyProductionReport.getBatchMachineAssignments(ids, date, shift);

        res.status(200).json({
            success: true,
            data: assignments
        });
    } catch (error) {
        next(new ApiError(error.message, 500));
    }
};
