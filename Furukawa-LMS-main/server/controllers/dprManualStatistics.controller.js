import DPRManualStatistics from "../models/dprManualStatistics.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * @desc    Get DPR Manual Statistics for a 7-day range ending at the specified date
 * @route   GET /api/v1/daily-production-report/manual-stats
 * @access  Private
 */
export const getDPRManualStats = asyncHandler(async (req, res, next) => {
    const { date } = req.query;

    if (!date) {
        return next(new ApiError("Please provide a date", 400));
    }

    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
        return next(new ApiError("Invalid date format", 400));
    }

    // Calculate start date (6 days prior) to get a full 7-day range
    const endDateStr = selectedDate.toISOString().split("T")[0];
    const startDate = new Date(selectedDate);
    startDate.setDate(startDate.getDate() - 6);
    const startDateStr = startDate.toISOString().split("T")[0];

    // Fetch existing records for this range
    const records = await DPRManualStatistics.findDateRange(startDateStr, endDateStr);

    // Map database results to their dates for quick lookup
    const recordMap = {};
    records.forEach(r => {
        recordMap[r.date] = r;
    });

    // Construct a full 7-day array, pre-filling defaults for missing days
    const resultList = [];
    const tempDate = new Date(startDate);

    for (let i = 0; i < 7; i++) {
        const currentDateStr = tempDate.toISOString().split("T")[0];
        
        if (recordMap[currentDateStr]) {
            resultList.push(recordMap[currentDateStr]);
        } else {
            // Default blank record
            resultList.push({
                date: currentDateStr,
                srcEffPlan: 0,
                srcEffActual: 0,
                srcEffTarget: 95.0,
                srcDefAuto: 0,
                srcDefManual: 0,
                srcDefJoint: 0,
                srcDefProduction: 0,
                srcDefTarget: 5.9,
                qaDefAuto: 0,
                qaDefManual: 0,
                qaDefJoint: 0,
                qaDefProduction: 0,
                qaDefTarget: 5.9,
                qaEffPlan: 0,
                qaEffActual: 0,
                qaEffTarget: 95.0
            });
        }
        tempDate.setDate(tempDate.getDate() + 1);
    }

    // Also get or define the specific selected date record to make form binding easier
    const selectedRecord = recordMap[endDateStr] || {
        date: endDateStr,
        srcEffPlan: 0,
        srcEffActual: 0,
        srcEffTarget: 95.0,
        srcDefAuto: 0,
        srcDefManual: 0,
        srcDefJoint: 0,
        srcDefProduction: 0,
        srcDefTarget: 5.9,
        qaDefAuto: 0,
        qaDefManual: 0,
        qaDefJoint: 0,
        qaDefProduction: 0,
        qaDefTarget: 5.9,
        qaEffPlan: 0,
        qaEffActual: 0,
        qaEffTarget: 95.0
    };

    res.status(200).json({
        success: true,
        data: {
            selectedRecord,
            trend: resultList
        }
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
