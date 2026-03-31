import DailyProductionReport from '../models/dailyProductionReport.model.js';
import { ApiError } from '../utils/ApiError.js';
import NotificationService from '../services/notification.service.js';

/**
 * @desc    Get Daily Production Report
 * @route   GET /api/v1/daily-production-report
 * @access  Private
 */
export const getDailyProductionReport = async (req, res, next) => {
    try {
        const { date, department, line, shift } = req.query;

        if (!date || !department || !line || !shift) {
            return next(new ApiError('Please provide date, department, line, and shift', 400));
        }

        // For the MySQL query, we use the exact date string 'YYYY-MM-DD'
        // Let's ensure the date string is in YYYY-MM-DD format
        const formattedDate = new Date(date).toISOString().split('T')[0];

        const report = await DailyProductionReport.findOne({
            date: formattedDate,
            department,
            line,
            shift
        });

        // Trigger Email Notification
        NotificationService.sendFormReport("Daily Production Report Sheet", department, req.body)
            .catch(err => console.error("[DPR] Notification failed:", err));

        res.status(200).json({
            success: true,
            data: report // Will be null if not found, frontend should handle this by showing a blank form
        });
    } catch (error) {
        next(new ApiError(error.message, 500));
    }
};

/**
 * @desc    Save/Update Daily Production Report
 * @route   POST /api/v1/daily-production-report
 * @access  Private
 */
export const saveDailyProductionReport = async (req, res, next) => {
    try {
        const { date, department, line, shift } = req.body;

        if (!date || !department || !line || !shift) {
            return next(new ApiError('Please provide date, department, line, and shift', 400));
        }

        const formattedDate = new Date(date).toISOString().split('T')[0];

        // Prepare update data adding the formatted date
        const updateData = { ...req.body, date: formattedDate };

        // Use custom upsert method from MySQL class
        const report = await DailyProductionReport.upsert(updateData);

        res.status(200).json({
            success: true,
            message: 'Report saved successfully',
            data: report
        });
    } catch (error) {
        if (error.code === 11000) {
            return next(new ApiError('A report for this date, department, line, and shift already exists.', 400));
        }
        next(new ApiError(error.message, 500));
    }
};
