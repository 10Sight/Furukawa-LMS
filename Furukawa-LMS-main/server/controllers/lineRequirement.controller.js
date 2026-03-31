import LineRequirement from "../models/lineRequirement.model.js";
import LineRequirementHistory from "../models/lineRequirementHistory.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { executeQuery } from "../db/mssqlHelper.js";

/**
 * Get requirements for lines based on filters
 * This will return lines joined with their requirement details if they exist
 */
export const getLineRequirements = asyncHandler(async (req, res) => {
    const { departmentId, sectionId, lineId, type, year, month, date } = req.query;

    let sql = `
        SELECT 
            l.id as lineId, l.name as lineName, l.uniCode as lineCode,
            s.id as sectionId, s.name as sectionName,
            d.id as departmentId, d.name as departmentName,
            lr.id as requirementId, lr.quantity, lr.type as requirementType,
            lr.requirementDate, lr.requirementMonth, lr.requirementYear
        FROM [lines] l
        INNER JOIN [sections] s ON l.sectionId = s.id
        INNER JOIN departments d ON l.department = d.id
        LEFT JOIN line_requirements lr ON l.id = lr.lineId 
            AND lr.type = ? 
            AND lr.requirementYear = ?
            AND (lr.requirementMonth = ? OR (lr.requirementMonth IS NULL AND ? IS NULL))
            AND (lr.requirementDate = ? OR (lr.requirementDate IS NULL AND ? IS NULL))
        WHERE l.isActive = 1
    `;
    
    const params = [
        type || 'MONTHLY',
        parseInt(year) || new Date().getFullYear(),
        month ? parseInt(month) : null, month ? parseInt(month) : null,
        date || null, date || null
    ];

    if (departmentId) { sql += " AND d.id = ?"; params.push(departmentId); }
    if (sectionId) { sql += " AND s.id = ?"; params.push(sectionId); }
    if (lineId) { sql += " AND l.id = ?"; params.push(lineId); }

    sql += " ORDER BY d.name, s.name, l.name";

    const [rows] = await executeQuery(sql, params);

    res.status(200).json(
        new ApiResponse(200, rows, "Line requirements fetched successfully")
    );
});

/**
 * Update or Create a line requirement and log history
 */
export const updateLineRequirement = asyncHandler(async (req, res) => {
    const { lineId, quantity, type, requirementDate, requirementMonth, requirementYear } = req.body;

    if (!lineId || quantity === undefined || !type || !requirementYear) {
        throw new ApiError("Missing required fields", 400);
    }

    // 1. Get current requirement to calculate change for history
    const checkSql = `
        SELECT quantity FROM line_requirements 
        WHERE lineId = ? AND type = ? AND requirementYear = ?
        AND (requirementMonth = ? OR (requirementMonth IS NULL AND ? IS NULL))
        AND (requirementDate = ? OR (requirementDate IS NULL AND ? IS NULL))
    `;
    const [existing] = await executeQuery(checkSql, [
        lineId, type, requirementYear, 
        requirementMonth || null, requirementMonth || null,
        requirementDate || null, requirementDate || null
    ]);

    const oldQuantity = existing.length > 0 ? existing[0].quantity : 0;
    const newQuantity = parseInt(quantity);

    // 2. Update or Create
    const requirementId = await LineRequirement.createOrUpdate({
        lineId, requirementDate, requirementMonth, requirementYear, quantity: newQuantity, type
    });

    // 3. Log History
    await LineRequirementHistory.create({
        lineId,
        oldQuantity,
        newQuantity,
        type,
        requirementDate,
        requirementMonth,
        requirementYear,
        changedBy: req.user?.id || req.user?._id
    });

    res.status(200).json(
        new ApiResponse(200, { id: requirementId }, "Requirement updated and history logged")
    );
});

/**
 * Get change history for a specific line
 */
export const getHistoryByLine = asyncHandler(async (req, res) => {
    const { lineId } = req.params;
    const history = await LineRequirementHistory.findByLine(lineId);
    
    res.status(200).json(
        new ApiResponse(200, history, "Line history fetched successfully")
    );
});
