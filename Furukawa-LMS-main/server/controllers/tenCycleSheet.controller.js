import { executeQuery } from "../db/mssqlHelper.js";
import TenCycleSheet from "../models/tenCycleSheet.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listTenCycleSheets = asyncHandler(async (req, res) => {
    const { departmentId } = req.query;

    if (!departmentId) {
        return res.status(200).json(new ApiResponse(200, [], "No department selected"));
    }

    const sheets = await TenCycleSheet.findByDepartmentId(departmentId);
    const [deps] = await executeQuery("SELECT id, name FROM departments WHERE id = ?", [departmentId]);
    const deptName = deps[0]?.name || "";

    const result = sheets.map((s) => ({
        id: s.id,
        departmentId: s.departmentId,
        departmentName: deptName,
        formType: s.formType,
        createdDate: s.createdDate,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
    }));

    return res.status(200).json(new ApiResponse(200, result, "10 cycle sheets fetched successfully"));
});

export const createTenCycleSheet = asyncHandler(async (req, res) => {
    const { departmentId, formType } = req.body || {};

    if (!departmentId) throw new ApiError("Department is required", 400);
    if (!["form1", "form2"].includes(formType)) throw new ApiError("Invalid form type", 400);

    const [deps] = await executeQuery("SELECT id FROM departments WHERE id = ?", [departmentId]);
    if (deps.length === 0) throw new ApiError("Department not found", 404);

    const sheet = await TenCycleSheet.create({
        departmentId,
        formType,
        qualityEngineer: "",
        qualityEngineerSign: "",
        dojoEngineer: "",
        dojoEngineerSign: "",
        entries: [],
        createdBy: req.user?.fullName || req.user?.name || req.user?.userName || "",
    });

    return res.status(201).json(new ApiResponse(201, sheet, "10 cycle sheet created successfully"));
});

export const getTenCycleSheetById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const sheet = await TenCycleSheet.findById(id);
    if (!sheet) throw new ApiError("10 cycle sheet not found", 404);

    const [deps] = await executeQuery("SELECT id, name FROM departments WHERE id = ?", [sheet.departmentId]);
    const departmentName = deps[0]?.name || "";

    return res.status(200).json(
        new ApiResponse(200, { ...sheet, departmentName }, "10 cycle sheet fetched successfully")
    );
});

export const updateTenCycleSheetById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { formType, qualityEngineer, qualityEngineerSign, dojoEngineer, dojoEngineerSign, entries } = req.body || {};

    const existing = await TenCycleSheet.findById(id);
    if (!existing) throw new ApiError("10 cycle sheet not found", 404);

    if (!["form1", "form2"].includes(formType)) throw new ApiError("Invalid form type", 400);

    const updated = await TenCycleSheet.updateById(id, {
        formType,
        qualityEngineer,
        qualityEngineerSign,
        dojoEngineer,
        dojoEngineerSign,
        entries: Array.isArray(entries) ? entries : [],
        updatedBy: req.user?.fullName || req.user?.name || req.user?.userName || "",
    });

    return res.status(200).json(new ApiResponse(200, updated, "10 cycle sheet updated successfully"));
});
