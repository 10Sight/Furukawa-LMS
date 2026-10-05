import EmailConfiguration from "../models/emailConfiguration.model.js";
import handoverNotificationScheduler from "../services/handoverNotificationScheduler.js";
import sixteenDayMonitoringScheduler from "../services/sixteenDayMonitoringScheduler.js";
import sixteenDayEligibilityScheduler from "../services/sixteenDayEligibilityScheduler.js";
import leftRequestNotificationScheduler from "../services/leftRequestNotificationScheduler.js";
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
    const { formName, departmentId, sectionId, toEmails, ccEmails, includeTrainer, isActive, scheduledTime } = req.body;
    if (!formName) {
        return res.status(400).json(new ApiResponse(400, null, "Form name is required"));
    }

    const config = await EmailConfiguration.create({
        formName,
        departmentId,
        sectionId,
        toEmails,
        ccEmails,
        includeTrainer,
        isActive,
        scheduledTime
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

const testHandoverScheduler = asyncHandler(async (_req, res) => {
    const result = await handoverNotificationScheduler.runNow();
    return res.status(200).json(new ApiResponse(200, result, "Handover scheduler test complete"));
});

const testSixteenDayScheduler = asyncHandler(async (_req, res) => {
    const result = await sixteenDayMonitoringScheduler.runNow();
    return res.status(200).json(new ApiResponse(200, result, "16-Day monitoring scheduler test complete"));
});

const testSixteenDayEligibilityScheduler = asyncHandler(async (_req, res) => {
    const result = await sixteenDayEligibilityScheduler.runNow();
    return res.status(200).json(new ApiResponse(200, result, "16-Day eligibility scheduler test complete"));
});

const testLeftRequestScheduler = asyncHandler(async (_req, res) => {
    const result = await leftRequestNotificationScheduler.runNow();
    return res.status(200).json(new ApiResponse(200, result, "Left request digest scheduler test complete"));
});

export {
    getAllConfigurations,
    getConfigurationById,
    createConfiguration,
    updateConfiguration,
    deleteConfiguration,
    testHandoverScheduler,
    testSixteenDayScheduler,
    testSixteenDayEligibilityScheduler,
    testLeftRequestScheduler
};
