import CourseLevelConfig from "../models/courseLevelConfig.model.js";
import Progress from "../models/progress.model.js";
import User from "../models/auth.model.js";
import { pool } from "../db/connectDB.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Helper to manually populate user fields
const populateConfig = async (config) => {
  if (!config) return null;

  // createdBy
  if (config.createdBy && typeof config.createdBy !== 'object') {
    const u = await User.findById(config.createdBy);
    if (u) config.createdBy = { _id: u.id, fullName: u.fullName, email: u.email };
  }

  // lastModifiedBy
  if (config.lastModifiedBy && typeof config.lastModifiedBy !== 'object') {
    const u = await User.findById(config.lastModifiedBy);
    if (u) config.lastModifiedBy = { _id: u.id, fullName: u.fullName, email: u.email };
  }
  return config;
};

/**
 * Get the active course level configuration
 * @route GET /api/course-level-config/active
 * @access Public (needed for student level display)
 */
export const getActiveConfig = asyncHandler(async (req, res) => {
  const config = await CourseLevelConfig.getActiveConfig();

  if (!config) {
    throw new ApiError("No active course level configuration found", 404);
  }

  // No deep populate needed for active config usually, but consistency good
  // Not populating for public access to minimal data, but standard response fine.

  res.json(new ApiResponse(200, config, "Active configuration fetched successfully"));
});

/**
 * Get all course level configurations
 * @route GET /api/course-level-config
 * @access Admin, SuperAdmin
 */
export const getAllConfigs = asyncHandler(async (req, res) => {
  const configs = await CourseLevelConfig.find({ sort: { isDefault: -1, createdAt: -1 } });

  const populatedConfigs = await Promise.all(configs.map(populateConfig));

  res.json(new ApiResponse(200, populatedConfigs, "Configurations fetched successfully"));
});

/**
 * Get a specific configuration by ID
 * @route GET /api/course-level-config/:id
 * @access Admin, SuperAdmin
 */
export const getConfigById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const rawConfig = await CourseLevelConfig.findById(id);

  if (!rawConfig) {
    throw new ApiError("Configuration not found", 404);
  }

  const config = await populateConfig(rawConfig);

  res.json(new ApiResponse(200, config, "Configuration fetched successfully"));
});

/**
 * Create a new course level configuration
 * @route POST /api/course-level-config
 * @access Admin, SuperAdmin
 */
export const createConfig = asyncHandler(async (req, res) => {
  const { name, description, levels, isDefault } = req.body;

  // Validate required fields
  if (!name || !levels || !Array.isArray(levels) || levels.length === 0) {
    throw new ApiError("Name and at least one level are required", 400);
  }

  // Validate each level
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    if (!level.name || level.order === undefined) {
      throw new ApiError(`Level at index ${i} must have name and order`, 400);
    }
    if (!level.completionTimeframe ||
      level.completionTimeframe.minDays === undefined ||
      level.completionTimeframe.maxDays === undefined) {
      throw new ApiError(`Level at index ${i} must have completionTimeframe with minDays and maxDays`, 400);
    }
    if (level.completionTimeframe.minDays < 0 || level.completionTimeframe.maxDays < 0) {
      throw new ApiError(`Level at index ${i} cannot have negative days`, 400);
    }
    if (level.completionTimeframe.minDays > level.completionTimeframe.maxDays) {
      throw new ApiError(`Level at index ${i}: minDays cannot be greater than maxDays`, 400);
    }
  }

  const config = await CourseLevelConfig.create({
    name,
    description: description || "",
    levels,
    isDefault: isDefault || false,
    isActive: true,
    createdBy: req.user.id,
    lastModifiedBy: req.user.id,
  });

  res.json(new ApiResponse(201, config, "Configuration created successfully"));
});

/**
 * Update an existing course level configuration
 * @route PATCH /api/course-level-config/:id
 * @access Admin, SuperAdmin
 */
export const updateConfig = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, levels, isDefault, isActive } = req.body;

  const config = await CourseLevelConfig.findById(id);

  if (!config) {
    throw new ApiError("Configuration not found", 404);
  }

  // Validate levels if provided
  if (levels) {
    if (!Array.isArray(levels) || levels.length === 0) {
      throw new ApiError("Levels must be a non-empty array", 400);
    }

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      if (!level.name || level.order === undefined) {
        throw new ApiError(`Level at index ${i} must have name and order`, 400);
      }
      if (!level.completionTimeframe ||
        level.completionTimeframe.minDays === undefined ||
        level.completionTimeframe.maxDays === undefined) {
        throw new ApiError(`Level at index ${i} must have completionTimeframe with minDays and maxDays`, 400);
      }
      if (level.completionTimeframe.minDays < 0 || level.completionTimeframe.maxDays < 0) {
        throw new ApiError(`Level at index ${i} cannot have negative days`, 400);
      }
      if (level.completionTimeframe.minDays > level.completionTimeframe.maxDays) {
        throw new ApiError(`Level at index ${i}: minDays cannot be greater than maxDays`, 400);
      }
    }

    config.levels = levels;
  }

  if (name) config.name = name;
  if (description !== undefined) config.description = description;
  if (isDefault !== undefined) config.isDefault = isDefault;
  if (isActive !== undefined) config.isActive = isActive;

  config.lastModifiedBy = req.user.id;

  await config.save();

  res.json(new ApiResponse(200, config, "Configuration updated successfully"));
});

/**
 * Delete a course level configuration
 * @route DELETE /api/course-level-config/:id
 * @access Admin, SuperAdmin
 */
export const deleteConfig = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const config = await CourseLevelConfig.findById(id);

  if (!config) {
    throw new ApiError("Configuration not found", 404);
  }

  // Prevent deletion if it's the only active configuration
  const [rows] = await pool.query("SELECT COUNT(*) as count FROM course_level_configs WHERE isActive = 1");
  const activeConfigCount = rows[0].count;

  // Using loose equality for bools/ints from SQL
  if (config.isActive && activeConfigCount <= 1) {
    // Check if this specific one is the one active one
    // Logic: if only 1 active, and current is active, prevents deletion.
    throw new ApiError("Cannot delete the only active configuration", 400);
  }

  // Prevent deletion if it's the default configuration without setting another as default
  if (config.isDefault) {
    throw new ApiError("Cannot delete the default configuration. Set another configuration as default first.", 400);
  }

  await pool.query("DELETE FROM course_level_configs WHERE id = ?", [id]);

  res.json(new ApiResponse(200, null, "Configuration deleted successfully"));
});

/**
 * Set a configuration as default
 * @route PATCH /api/course-level-config/:id/set-default
 * @access Admin, SuperAdmin
 */
export const setAsDefault = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const config = await CourseLevelConfig.findById(id);

  if (!config) {
    throw new ApiError("Configuration not found", 404);
  }

  config.isDefault = true;
  config.isActive = true; // Ensure it's also active
  config.lastModifiedBy = req.user.id;

  await config.save(); // Model save() handles unsetting other defaults

  res.json(new ApiResponse(200, config, "Configuration set as default successfully"));
});

/**
 * Validate level compatibility with existing progress records
 * @route POST /api/course-level-config/validate-compatibility
 * @access Admin, SuperAdmin
 */
export const validateCompatibility = asyncHandler(async (req, res) => {
  const { levels } = req.body;

  if (!levels || !Array.isArray(levels)) {
    throw new ApiError("Levels array is required", 400);
  }

  // Get all unique current levels from progress records
  // SQL specific query
  const [levelRows] = await pool.query("SELECT DISTINCT currentLevel FROM progress WHERE currentLevel IS NOT NULL");
  const existingLevels = levelRows.map(r => r.currentLevel);

  const levelNames = levels.map(l => l.name.toUpperCase());
  const incompatibleLevels = existingLevels.filter(
    level => level && !levelNames.includes(level.toUpperCase())
  );

  const isCompatible = incompatibleLevels.length === 0;

  // Count affected students
  let affectedStudentsCount = 0;
  if (!isCompatible) {
    // Count where currentLevel IN incompatibleLevels
    // Construct placeholders
    const placeholders = incompatibleLevels.map(() => '?').join(',');
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as count FROM progress WHERE currentLevel IN (${placeholders})`,
      incompatibleLevels
    );
    affectedStudentsCount = countRows[0].count;
  }

  res.json(new ApiResponse(200, {
    isCompatible,
    incompatibleLevels,
    affectedStudentsCount,
    suggestion: !isCompatible
      ? "Some existing student levels are not in the new configuration. Consider migrating students first."
      : "Configuration is compatible with existing progress records"
  }, "Compatibility check completed"));
});

/**
 * Migrate student levels when changing configuration
 * @route POST /api/course-level-config/migrate-levels
 * @access Admin, SuperAdmin
 */
export const migrateLevels = asyncHandler(async (req, res) => {
  const { levelMapping } = req.body;

  // levelMapping format: { "oldLevelName": "newLevelName", ... }
  if (!levelMapping || typeof levelMapping !== "object") {
    throw new ApiError("Level mapping object is required", 400);
  }

  const updates = [];

  for (const [oldLevel, newLevel] of Object.entries(levelMapping)) {
    // Update logic in SQL
    const [result] = await pool.query(
      `UPDATE progress SET currentLevel = ?, lockedLevel = NULL, levelLockEnabled = 0 WHERE currentLevel = ?`,
      [newLevel, oldLevel]
    );

    updates.push({
      oldLevel,
      newLevel,
      studentsUpdated: result.affectedRows
    });
  }

  res.json(new ApiResponse(200, { updates }, "Level migration completed successfully"));
});
