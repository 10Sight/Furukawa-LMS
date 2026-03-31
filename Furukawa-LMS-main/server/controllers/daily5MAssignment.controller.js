import Daily5MAssignment from "../models/daily5MAssignment.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Get assignments for a department
export const getAssignments = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const { role } = req.query;

    let assignments;
    if (role) {
        assignments = await Daily5MAssignment.findByDepartmentAndRole(departmentId, role);
    } else {
        assignments = await Daily5MAssignment.findByDepartment(departmentId);
    }

    res.status(200).json(new ApiResponse(200, assignments, "Assignments fetched successfully"));
});

// Create/Add a new assignment
export const addAssignment = asyncHandler(async (req, res) => {
    const { departmentId, role, userId, userName } = req.body;

    if (!departmentId || !role || !userId) {
        throw new ApiError("Department ID, role, and user ID are required", 400);
    }

    // Check if assignment already exists
    const existing = await Daily5MAssignment.findByDepartmentAndRole(departmentId, role);
    const isDuplicate = existing.some(a => a.userId == userId);
    
    if (isDuplicate) {
        throw new ApiError("User is already assigned to this role in this department", 400);
    }

    const newId = await Daily5MAssignment.create({ departmentId, role, userId, userName });
    
    res.status(201).json(new ApiResponse(201, { id: newId }, "Assignment added successfully"));
});

// Remove an assignment
export const removeAssignment = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id) {
        throw new ApiError("Assignment ID is required", 400);
    }

    const success = await Daily5MAssignment.delete(id);
    
    if (!success) {
        throw new ApiError("Assignment not found", 404);
    }

    res.status(200).json(new ApiResponse(200, null, "Assignment removed successfully"));
});
