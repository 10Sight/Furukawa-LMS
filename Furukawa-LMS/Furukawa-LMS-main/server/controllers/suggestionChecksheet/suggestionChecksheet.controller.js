import SuggestionChecksheetModel from "../../models/suggestionChecksheet/suggestionChecksheet.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";

// Helper to sanitize payload by removing deprecated columns: Description, Categories, Employee Code, Priority, rejectAccepted
const sanitizeChecksheetPayload = (payload = {}) => {
  const clean = { ...payload };
  delete clean.description;
  delete clean.Description;
  delete clean.category;
  delete clean.Category;
  delete clean.categories;
  delete clean.Categories;
  delete clean.employeeCode;
  delete clean.EmployeeCode;
  delete clean.employee_code;
  delete clean['Employee Code'];
  delete clean.priority;
  delete clean.Priority;
  delete clean.rejectedAccepted;
  delete clean.RejectedAccepted;
  delete clean.rejectAccepted;
  delete clean.RejectAccepted;
  return clean;
};

// Helper to determine creator name
const resolveCreatorName = (req) => {
  return (
    req.body?.createdBy ||
    req.body?.['Created by'] ||
    req.user?.fullName ||
    req.user?.userName ||
    req.headers?.['x-user-name'] ||
    req.body?.submittedBy ||
    req.body?.employeeName ||
    'System User'
  );
};

export const getAllSuggestionChecksheets = asyncHandler(async (req, res) => {
  const { unit, search, status } = req.query;
  const records = await SuggestionChecksheetModel.getAll({ unit, search, status });
  return res.status(200).json(new ApiResponse(200, records, "Suggestion checksheets retrieved successfully"));
});

export const getSuggestionChecksheetById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const record = await SuggestionChecksheetModel.getById(id);
  if (!record) {
    throw new ApiError(404, `Suggestion checksheet not found for ID: ${id}`);
  }
  return res.status(200).json(new ApiResponse(200, record, "Suggestion checksheet retrieved successfully"));
});

export const createSuggestionChecksheet = asyncHandler(async (req, res) => {
  const sanitized = sanitizeChecksheetPayload(req.body || {});
  sanitized.createdBy = sanitized.createdBy || resolveCreatorName(req);

  const newRecord = await SuggestionChecksheetModel.create(sanitized);
  return res.status(201).json(new ApiResponse(201, newRecord, "Suggestion checksheet created successfully"));
});

export const updateSuggestionChecksheet = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sanitized = sanitizeChecksheetPayload(req.body || {});

  const updated = await SuggestionChecksheetModel.update(id, sanitized);
  return res.status(200).json(new ApiResponse(200, updated, "Suggestion checksheet updated successfully"));
});

export const deleteSuggestionChecksheet = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const success = await SuggestionChecksheetModel.delete(id);
  return res.status(200).json(new ApiResponse(200, { success }, "Suggestion checksheet deleted successfully"));
});
