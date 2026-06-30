import { executeQuery } from "../db/mssqlHelper.js";
import DesignationShutter from "../models/designationShutter.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getUniqueDesignations = asyncHandler(async (req, res) => {
  const [rows] = await executeQuery(`
    SELECT DISTINCT designation
    FROM users
    WHERE designation IS NOT NULL AND designation != '' AND (isDeleted = 0 OR isDeleted IS NULL)
      AND designation NOT IN (SELECT designation FROM designation_shutters)
    ORDER BY designation ASC
  `);
  const designations = rows.map(r => r.designation);
  res.json(new ApiResponse(200, designations, "Unique designations fetched successfully"));
});

export const getDesignationsWithCounts = asyncHandler(async (req, res) => {
  const [rows] = await executeQuery(`
    SELECT
      u.designation,
      COUNT(*) AS totalCount,
      SUM(CASE WHEN (u.status IS NULL OR u.status != 'LEFT') THEN 1 ELSE 0 END) AS activeCount,
      CASE WHEN ds.designation IS NOT NULL THEN 1 ELSE 0 END AS isShuttered
    FROM users u
    LEFT JOIN designation_shutters ds ON ds.designation = u.designation
    WHERE u.designation IS NOT NULL AND u.designation != '' AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
      AND (u.isTemporary = 0 OR u.isTemporary IS NULL)
    GROUP BY u.designation, ds.designation
    ORDER BY u.designation ASC
  `);
  res.json(new ApiResponse(200, rows, "Designations with counts fetched successfully"));
});

export const shutterDesignation = asyncHandler(async (req, res) => {
  const { designation } = req.body;
  if (!designation) throw new ApiError(400, "designation is required");
  await DesignationShutter.shutter(designation);
  res.json(new ApiResponse(200, null, `Designation "${designation}" shuttered successfully`));
});

export const unshutterDesignation = asyncHandler(async (req, res) => {
  const { designation } = req.body;
  if (!designation) throw new ApiError(400, "designation is required");
  await DesignationShutter.unshutter(designation);
  res.json(new ApiResponse(200, null, `Designation "${designation}" unshuttered successfully`));
});
