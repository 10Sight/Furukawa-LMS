import Contractor from "../models/contractor.model.js";
import { executeQuery } from "../db/mssqlHelper.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createContractor = asyncHandler(async (req, res) => {
    const { name, location, phoneNumber, email, startDate, status } = req.body;
    if (!name || !String(name).trim()) {
        throw new ApiError("Contractor name is required", 400);
    }
    const contractor = await Contractor.create({
        name: String(name).trim(),
        location: location || null,
        phoneNumber: phoneNumber || null,
        email: email || null,
        startDate: startDate || null,
        status: status || 'active',
    });
    return res.status(201).json(new ApiResponse(201, contractor, "Contractor created successfully"));
});

const getAllContractors = asyncHandler(async (req, res) => {
    const contractors = await Contractor.findAll();
    return res.status(200).json(new ApiResponse(200, contractors, "Contractors fetched successfully"));
});

const getContractorById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const contractor = await Contractor.findById(id);
    if (!contractor) throw new ApiError("Contractor not found", 404);
    const users = await Contractor.getUsersByContractor(id);
    return res.status(200).json(new ApiResponse(200, { contractor, users }, "Contractor fetched successfully"));
});

const updateContractor = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const contractor = await Contractor.findById(id);
    if (!contractor) throw new ApiError("Contractor not found", 404);
    if (req.body.name !== undefined && !String(req.body.name).trim()) {
        throw new ApiError("Contractor name cannot be empty", 400);
    }
    const updated = await Contractor.update(id, req.body);
    return res.status(200).json(new ApiResponse(200, updated, "Contractor updated successfully"));
});

const deleteContractor = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const contractor = await Contractor.findById(id);
    if (!contractor) throw new ApiError("Contractor not found", 404);
    await executeQuery('UPDATE users SET contractorId = NULL WHERE contractorId = ?', [id]);
    await Contractor.delete(id);
    return res.status(200).json(new ApiResponse(200, null, "Contractor deleted successfully"));
});

export {
    createContractor,
    getAllContractors,
    getContractorById,
    updateContractor,
    deleteContractor,
};
