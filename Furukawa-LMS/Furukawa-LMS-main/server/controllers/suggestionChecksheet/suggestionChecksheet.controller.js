import SuggestionChecksheetModel from "../../models/suggestionChecksheet/suggestionChecksheet.model.js";
import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";

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
  const data = req.body;
  const newRecord = await SuggestionChecksheetModel.create(data);
  return res.status(201).json(new ApiResponse(201, newRecord, "Suggestion checksheet created successfully"));
});

export const updateSuggestionChecksheet = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const updated = await SuggestionChecksheetModel.update(id, updateData);
  return res.status(200).json(new ApiResponse(200, updated, "Suggestion checksheet updated successfully"));
});

export const deleteSuggestionChecksheet = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const success = await SuggestionChecksheetModel.delete(id);
  return res.status(200).json(new ApiResponse(200, { success }, "Suggestion checksheet deleted successfully"));
});
