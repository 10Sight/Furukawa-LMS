import DepartmentCCConfig from "../models/departmentCCConfig.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getAllDepartmentCCConfigs = asyncHandler(async (req, res) => {
    const configs = await DepartmentCCConfig.findAll();
    return res.status(200).json(new ApiResponse(200, configs, "Department CC configs fetched successfully"));
});

const getDepartmentCCConfigById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const config = await DepartmentCCConfig.findById(id);
    if (!config) {
        return res.status(404).json(new ApiResponse(404, null, "Department CC config not found"));
    }
    return res.status(200).json(new ApiResponse(200, config, "Department CC config fetched successfully"));
});

const createDepartmentCCConfig = asyncHandler(async (req, res) => {
    const { deptId, departmentHeadName, departmentHeadEmail, isActive } = req.body;
    if (!deptId) {
        return res.status(400).json(new ApiResponse(400, null, "Department ID is required"));
    }
    if (!departmentHeadEmail) {
        return res.status(400).json(new ApiResponse(400, null, "Department head email is required"));
    }

    const config = await DepartmentCCConfig.create({
        deptId,
        departmentHeadName,
        departmentHeadEmail,
        isActive: isActive !== undefined ? isActive : 1
    });

    return res.status(201).json(new ApiResponse(201, config, "Department CC config created successfully"));
});

const updateDepartmentCCConfig = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { deptId, departmentHeadName, departmentHeadEmail, isActive } = req.body;

    const updated = await DepartmentCCConfig.update(id, { deptId, departmentHeadName, departmentHeadEmail, isActive });
    if (!updated) {
        return res.status(404).json(new ApiResponse(404, null, "Department CC config not found or no changes made"));
    }

    return res.status(200).json(new ApiResponse(200, updated, "Department CC config updated successfully"));
});

const deleteDepartmentCCConfig = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await DepartmentCCConfig.delete(id);
    return res.status(200).json(new ApiResponse(200, null, "Department CC config deleted successfully"));
});

export {
    getAllDepartmentCCConfigs,
    getDepartmentCCConfigById,
    createDepartmentCCConfig,
    updateDepartmentCCConfig,
    deleteDepartmentCCConfig
};
