import EmailConfiguration from "../models/emailConfiguration.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getAllConfigurations = asyncHandler(async (req, res) => {
    const configs = await EmailConfiguration.findAll();
    return res.status(200).json(new ApiResponse(200, configs, "Configurations fetched successfully"));
});

const getConfigurationById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const config = await EmailConfiguration.findById(id);
    if (!config) {
        return res.status(404).json(new ApiResponse(404, null, "Configuration not found"));
    }
    return res.status(200).json(new ApiResponse(200, config, "Configuration fetched successfully"));
});

const createConfiguration = asyncHandler(async (req, res) => {
    const { formName, departmentId, toEmails, ccEmails, includeTrainer, isActive } = req.body;
    if (!formName) {
        return res.status(400).json(new ApiResponse(400, null, "Form name is required"));
    }

    const config = await EmailConfiguration.create({
        formName,
        departmentId,
        toEmails,
        ccEmails,
        includeTrainer,
        isActive
    });

    return res.status(201).json(new ApiResponse(201, config, "Configuration created successfully"));
});

const updateConfiguration = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = req.body;

    const updated = await EmailConfiguration.update(id, data);
    if (!updated) {
        return res.status(404).json(new ApiResponse(404, null, "Configuration not found or no changes made"));
    }

    return res.status(200).json(new ApiResponse(200, updated, "Configuration updated successfully"));
});

const deleteConfiguration = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await EmailConfiguration.delete(id);
    return res.status(200).json(new ApiResponse(200, null, "Configuration deleted successfully"));
});

export {
    getAllConfigurations,
    getConfigurationById,
    createConfiguration,
    updateConfiguration,
    deleteConfiguration
};
