import DPRManualStatistics from "../models/dprManualStatistics.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * @desc    Get DPR Manual Statistics for a 7-day range ending at the specified date
 * @route   GET /api/v1/daily-production-report/manual-stats
 * @access  Private
 */
const blankRecord = (dateStr) => ({
    date: dateStr,
    srcEffPlan: 0, srcEffActual: 0, srcEffTarget: 95.0,
    srcDefAuto: 0, srcDefManual: 0, srcDefJoint: 0, srcDefProduction: 0, srcDefTarget: 5.9,
    qaDefAuto: 0, qaDefManual: 0, qaDefJoint: 0, qaDefProduction: 0, qaDefTarget: 5.9,
    qaEffPlan: 0, qaEffActual: 0, qaEffTarget: 95.0,
});

export const getDPRManualStats = asyncHandler(async (req, res, next) => {
    const { date, startDate, endDate } = req.query;

    let startDateStr, endDateStr;

    if (startDate && endDate) {
        // Custom range mode
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return next(new ApiError("Invalid date format", 400));
        }
        if (start > end) {
            return next(new ApiError("startDate must be before or equal to endDate", 400));
        }
        startDateStr = start.toISOString().split("T")[0];
        endDateStr = end.toISOString().split("T")[0];
    } else if (date) {
        // Default 7-day mode: 6 days back from the selected date
        const selected = new Date(date);
        if (isNaN(selected.getTime())) {
            return next(new ApiError("Invalid date format", 400));
        }
        endDateStr = selected.toISOString().split("T")[0];
        const start7 = new Date(selected);
        start7.setDate(start7.getDate() - 6);
        startDateStr = start7.toISOString().split("T")[0];
    } else {
        return next(new ApiError("Please provide date or startDate/endDate", 400));
    }

    const records = await DPRManualStatistics.findDateRange(startDateStr, endDateStr);

    const recordMap = {};
    records.forEach(r => { recordMap[r.date] = r; });

    // Build full day-by-day array filling blanks for missing dates
    const resultList = [];
    const tempDate = new Date(startDateStr);
    const endDateObj = new Date(endDateStr);

    while (tempDate <= endDateObj) {
        const currentDateStr = tempDate.toISOString().split("T")[0];
        resultList.push(recordMap[currentDateStr] || blankRecord(currentDateStr));
        tempDate.setDate(tempDate.getDate() + 1);
    }

    const selectedRecord = recordMap[endDateStr] || blankRecord(endDateStr);

    res.status(200).json({
        success: true,
        data: { selectedRecord, trend: resultList }
    });
});

/**
 * @desc    Get all dates in a given month that have at least one non-zero value
 * @route   GET /api/v1/daily-production-report/manual-stats/filled-dates
 * @access  Private
 */
export const getDPRFilledDates = asyncHandler(async (req, res, next) => {
    const { month } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return next(new ApiError("Please provide a valid month (YYYY-MM)", 400));
    }

    const filledDates = await DPRManualStatistics.findFilledDatesInMonth(month);

    res.status(200).json({
        success: true,
        data: { filledDates }
    });
});

/**
 * @desc    Save/Upsert DPR Manual Statistics for a specific date
 * @route   POST /api/v1/daily-production-report/manual-stats
 * @access  Private
 */
export const saveDPRManualStats = asyncHandler(async (req, res, next) => {
    const { date } = req.body;

    if (!date) {
        return next(new ApiError("Please provide a date", 400));
    }

    const savedRecord = await DPRManualStatistics.upsert(req.body);

    res.status(200).json({
        success: true,
        message: "DPR Manual statistics saved successfully",
        data: savedRecord
    });
});
