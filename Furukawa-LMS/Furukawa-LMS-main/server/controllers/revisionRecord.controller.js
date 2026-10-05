import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import RevisionRecordService from "../services/revisionRecord.service.js";

const toId = (value) => (value && value !== "all" ? parseInt(value) : null);

/**
 * @desc    Get all revision records (global defaults + department/section
 *          overrides), optionally narrowed by department/section/sheetKey, or
 *          restricted to just the global rows via isGlobal=true
 * @route   GET /api/revision-records
 * @access  Private
 */
export const getAllRecords = asyncHandler(async (req, res) => {
    const records = await RevisionRecordService.getAllRecords(
        toId(req.query.departmentId),
        toId(req.query.sectionId),
        req.query.sheetKey || null,
        req.query.isGlobal === "true"
    );
    res.json(new ApiResponse(200, records, "Revision records fetched successfully"));
});

/**
 * @desc    Get audit history logs, optionally narrowed by department/section
 *          and/or a single sheet
 * @route   GET /api/revision-records/history
 * @access  Private
 */
export const getHistoryLogs = asyncHandler(async (req, res) => {
    const logs = await RevisionRecordService.getHistoryLogs(
        toId(req.query.departmentId),
        toId(req.query.sectionId),
        req.query.sheetKey || null
    );
    res.json(new ApiResponse(200, logs, "Revision history fetched successfully"));
});

/**
 * @desc    Get the most specific matching revision record for a sheet given a
 *          department/section context, for forms to render their doc/rev header
 *          from (falls back department+section -> department -> global default)
 * @route   GET /api/revision-records/sheet/:sheetKey
 * @access  Private
 */
export const getRecordBySheetKey = asyncHandler(async (req, res) => {
    const record = await RevisionRecordService.getLatestForSheet(
        req.params.sheetKey,
        toId(req.query.departmentId),
        toId(req.query.sectionId)
    );
    if (!record) throw new ApiError("Revision record not found", 404);
    res.json(new ApiResponse(200, record, "Revision record fetched successfully"));
});

/**
 * @desc    Update a revision record (by id) and log the change to history. The
 *          record's own department/section scope is fixed and not changed here.
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

/**
 * @desc    Create or update a department/section-scoped override for a sheet
 *          (exact-scope match; inserts a new row if none exists yet)
 * @route   PUT /api/revision-records/sheet/:sheetKey
 * @access  Private (Admin/SuperAdmin)
 */
export const upsertRecordForScope = asyncHandler(async (req, res) => {
    const { sheetKey } = req.params;
    const {
        sheetName, departmentId, sectionId,
        docNo, revNo, revDate, affectedSrNoPage, affectedSrNoPageHi, changeDetails, changeDetailsHi
    } = req.body;

    if (!docNo || !revNo) {
        throw new ApiError("Document No. and Revision No. are required", 400);
    }
    if (!departmentId) {
        throw new ApiError("Department is required for a department-scoped override", 400);
    }

    const saved = await RevisionRecordService.upsertForScope(
        sheetKey,
        parseInt(departmentId),
        sectionId ? parseInt(sectionId) : null,
        { sheetName, docNo, revNo, revDate, affectedSrNoPage, affectedSrNoPageHi, changeDetails, changeDetailsHi },
        req.user
    );
    res.json(new ApiResponse(200, saved, "Revision record saved successfully"));
});
