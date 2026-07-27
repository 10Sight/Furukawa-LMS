import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import RevisionRecordService from "../services/revisionRecord.service.js";

/**
 * @desc    Get all active revision records
 * @route   GET /api/revision-records
 * @access  Private
 */
export const getAllRecords = asyncHandler(async (req, res) => {
    const records = await RevisionRecordService.getAllRecords();
    res.json(new ApiResponse(200, records, "Revision records fetched successfully"));
});

/**
 * @desc    Get audit history logs
 * @route   GET /api/revision-records/history
 * @access  Private
 */
export const getHistoryLogs = asyncHandler(async (req, res) => {
    const logs = await RevisionRecordService.getHistoryLogs();
    res.json(new ApiResponse(200, logs, "Revision history fetched successfully"));
});

/**
 * @desc    Get the active revision record for a single sheet, for forms to
 *          render their live doc/rev header from
 * @route   GET /api/revision-records/sheet/:sheetKey
 * @access  Private
 */
export const getRecordBySheetKey = asyncHandler(async (req, res) => {
    const record = await RevisionRecordService.getLatestForSheet(req.params.sheetKey);
    if (!record) throw new ApiError("Revision record not found", 404);
    res.json(new ApiResponse(200, record, "Revision record fetched successfully"));
});

/**
 * @desc    Update a revision record and log the change to history
 * @route   PUT /api/revision-records/:id
 * @access  Private (Admin/SuperAdmin)
 */
export const updateRecord = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { docNo, revNo, revDate, affectedSrNoPage, affectedSrNoPageHi, changeDetails, changeDetailsHi } = req.body;

    if (!docNo || !revNo) {
        throw new ApiError("Document No. and Revision No. are required", 400);
    }

    const updated = await RevisionRecordService.updateRecord(
        id,
        { docNo, revNo, revDate, affectedSrNoPage, affectedSrNoPageHi, changeDetails, changeDetailsHi },
        req.user
    );
    res.json(new ApiResponse(200, updated, "Revision record updated successfully"));
});
