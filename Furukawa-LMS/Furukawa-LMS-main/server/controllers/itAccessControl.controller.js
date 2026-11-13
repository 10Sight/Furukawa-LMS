import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import ITAccessControl from "../models/itAccessControl.model.js";
import { FIELDS, GROUPS, STAFF_EMP_ID_PREFIX } from "../utils/itAccessControlFields.js";

// IT Access Control Register (MIS Portal). The page builds its table and the Excel export from
// `fields`/`groups`, so the column definitions live only in utils/itAccessControlFields.js.

export const getRegister = asyncHandler(async (req, res) => {
    const rows = await ITAccessControl.getRegister();
    return res.status(200).json(new ApiResponse(200, {
        fields: FIELDS,
        groups: GROUPS,
        empIdPrefix: STAFF_EMP_ID_PREFIX,
        rows,
    }, "IT access control register fetched"));
});

export const saveRegister = asyncHandler(async (req, res) => {
    const actor = { id: req.user?.id ?? null, name: req.user?.fullName || req.user?.userName || null };
    // Optional origin of the changes, e.g. "import:Access_Q3.xlsx"; stored on each history row.
    const rawSource = req.body?.source;
    if (rawSource !== undefined && rawSource !== null && typeof rawSource !== "string") throw new ApiError("source must be text", 400);
    const source = rawSource ? rawSource.trim().slice(0, 255) || null : null;
    const result = await ITAccessControl.saveRows(req.body?.rows, actor, { source });
    return res.status(200).json(new ApiResponse(200, result, result.saved ? "Access control changes saved" : "Nothing to save"));
});

export const getRowHistory = asyncHandler(async (req, res) => {
    const userId = Number.parseInt(req.params.userId, 10);
    if (!Number.isInteger(userId) || userId <= 0) throw new ApiError("userId is required", 400);
    const history = await ITAccessControl.getHistory(userId);
    return res.status(200).json(new ApiResponse(200, { history }, "History fetched"));
});
