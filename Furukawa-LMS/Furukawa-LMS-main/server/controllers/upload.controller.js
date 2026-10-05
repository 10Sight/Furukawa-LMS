import { saveToLocal } from "../utils/fileStorage.util.js";
import fs from "fs";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";

// Upload single file
export const uploadSingleFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError("No file uploaded", 400);
  }

  try {
    const result = await saveToLocal(req.file, "general");

    if (!result.success) {
      throw new Error(result.error || "Upload failed");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, {
          url: result.url,
          fileName: result.fileName
        }, "File uploaded successfully")
      );
  } catch (err) {
    throw new ApiError(err?.message || "Failed to upload file", 500);
  }
});

// Upload multiple files
export const uploadMultipleFiles = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new ApiError("No files uploaded", 400);
  }

  const results = [];
  const errors = [];

  // Parallel uploads could be faster but serial is safer for resource limits
  for (const file of req.files) {
    try {
      const result = await saveToLocal(file, "general");

      if (result.success) {
        results.push({
          url: result.url,
          originalName: file.originalname
        });
      } else {
        errors.push({ file: file.originalname, error: result.error });
      }
    } catch (err) {
      errors.push({ file: file.originalname, error: err.message });
    }
  }

  if (results.length === 0 && errors.length > 0) {
    throw new ApiError(`All uploads failed. Errors: ${errors.map(e => e.error).join(', ')}`, 500);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, { uploaded: results, errors }, "Files processed")
    );
});
