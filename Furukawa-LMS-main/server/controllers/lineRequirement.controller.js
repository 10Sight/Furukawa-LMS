import LineRequirement from "../models/lineRequirement.model.js";
import LineRequirementHistory from "../models/lineRequirementHistory.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { executeQuery } from "../db/mssqlHelper.js";

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export const getLineRequirements = asyncHandler(async (req, res) => {
    const { departmentId, sectionId, lineId, year, month } = req.query;
    const resolvedYear = parseInt(year) || new Date().getFullYear();
    const resolvedMonth = month ? parseInt(month) : (new Date().getMonth() + 1);

    let sql = `
        SELECT
            l.id as lineId, l.name as lineName, l.uniCode as lineCode,
            s.id as sectionId, s.name as sectionName,
            d.id as departmentId, d.name as departmentName,
            lr.id as requirementId,
            ISNULL(lr.fn01, 0) as fn01,
            ISNULL(lr.fn02, 0) as fn02,
            ISNULL(lr.quantity, 0) as quantity,
            lr.requirementDate, lr.requirementMonth, lr.requirementYear
        FROM [lines] l
        INNER JOIN [sections] s ON l.sectionId = s.id
        INNER JOIN departments d ON l.department = d.id
        LEFT JOIN line_requirements lr ON l.id = lr.lineId
            AND lr.type = 'MONTHLY'
            AND lr.requirementYear = ?
            AND lr.requirementMonth = ?
        WHERE l.isActive = 1
    `;
    const params = [resolvedYear, resolvedMonth];

    if (departmentId) { sql += " AND d.id = ?"; params.push(departmentId); }
    if (sectionId) { sql += " AND s.id = ?"; params.push(sectionId); }
    if (lineId) { sql += " AND l.id = ?"; params.push(lineId); }
    sql += " ORDER BY d.name, s.name, l.name";

    const [rows] = await executeQuery(sql, params);

    // Detect requirements table schema variant (camelCase vs snake_case)
    const [colCheck] = await executeQuery(`
        SELECT
            COL_LENGTH('requirements', 'monthName')    as hasMonthName,
            COL_LENGTH('requirements', 'month_name')   as hasMonthNameSnake,
            COL_LENGTH('requirements', 'year')         as hasYear,
            COL_LENGTH('requirements', 'year_val')     as hasYearVal,
            COL_LENGTH('requirements', 'lineCode')     as hasLineCode,
            COL_LENGTH('requirements', 'sectionName')  as hasSectionName,
            COL_LENGTH('requirements', 'section_name') as hasSectionNameSnake
    `);
    const colInfo = colCheck[0] || {};
    const monthCol      = colInfo.hasMonthName       ? 'r.monthName'   : 'r.month_name';
    const yearCol       = colInfo.hasYear            ? 'r.year'        : 'r.year_val';
    const sectionNameCol = colInfo.hasSectionName    ? 'r.sectionName' : 'r.section_name';

    // Fetch production plan targets — join strategy depends on which columns exist
    let targetSql, targetParams;

    if (colInfo.hasLineCode) {
        // camelCase schema: join via lineCode -> lines -> sections -> departments
        targetSql = `
            SELECT
                ISNULL(SUM(CAST(r.prodPlanFN01 AS INT)), 0) as targetFN01,
                ISNULL(SUM(CAST(r.prodPlanFN02 AS INT)), 0) as targetFN02
            FROM requirements r
            INNER JOIN [lines] l ON r.lineCode = l.uniCode
            INNER JOIN [sections] s ON l.sectionId = s.id
            INNER JOIN departments d ON l.department = d.id
            WHERE LOWER(${monthCol}) = LOWER(?) AND ${yearCol} = ? AND ISNULL(r.is_active, 0) = 1 AND l.isActive = 1
        `;
        targetParams = [MONTH_NAMES[resolvedMonth - 1], resolvedYear];
        if (departmentId) { targetSql += " AND d.id = ?"; targetParams.push(departmentId); }
        if (sectionId) { targetSql += " AND s.id = ?"; targetParams.push(sectionId); }
    } else {
        // snake_case schema: join via section_name -> sections table
        targetSql = `
            SELECT
                ISNULL(SUM(CAST(r.prodPlanFN01 AS INT)), 0) as targetFN01,
                ISNULL(SUM(CAST(r.prodPlanFN02 AS INT)), 0) as targetFN02
            FROM requirements r
            INNER JOIN [sections] s ON LOWER(${sectionNameCol}) = LOWER(s.name)
            WHERE LOWER(${monthCol}) = LOWER(?) AND ${yearCol} = ? AND ISNULL(r.is_active, 0) = 1
        `;
        targetParams = [MONTH_NAMES[resolvedMonth - 1], resolvedYear];
        if (sectionId) { targetSql += " AND s.id = ?"; targetParams.push(sectionId); }
        else if (departmentId) {
            targetSql += " AND s.id IN (SELECT id FROM [sections] WHERE departmentId = ?)";
            targetParams.push(departmentId);
        }
    }

    const [targetRows] = await executeQuery(targetSql, targetParams);
    const targetFN01 = targetRows[0]?.targetFN01 || 0;
    const targetFN02 = targetRows[0]?.targetFN02 || 0;

    res.status(200).json(
        new ApiResponse(200, { lines: rows, targetFN01, targetFN02 }, "Line requirements fetched successfully")
    );
});

export const updateLineRequirement = asyncHandler(async (req, res) => {
    const { lineId, fn01, fn02, requirementMonth, requirementYear } = req.body;

    if (!lineId || fn01 === undefined || fn02 === undefined || !requirementYear) {
        throw new ApiError("Missing required fields", 400);
    }

    const checkSql = `
        SELECT fn01, fn02, quantity FROM line_requirements
        WHERE lineId = ? AND type = 'MONTHLY' AND requirementYear = ? AND requirementMonth = ?
    `;
    const [existing] = await executeQuery(checkSql, [
        lineId, requirementYear, requirementMonth || null
    ]);

    const oldFn01 = existing.length > 0 ? (existing[0].fn01 || 0) : 0;
    const oldFn02 = existing.length > 0 ? (existing[0].fn02 || 0) : 0;
    const oldQuantity = existing.length > 0 ? (existing[0].quantity || 0) : 0;
    const newFn01 = parseInt(fn01) || 0;
    const newFn02 = parseInt(fn02) || 0;
    const newQuantity = newFn01 + newFn02;

    const requirementId = await LineRequirement.createOrUpdate({
        lineId,
        requirementMonth,
        requirementYear,
        fn01: newFn01,
        fn02: newFn02,
        type: 'MONTHLY'
    });

    await LineRequirementHistory.create({
        lineId,
        oldFn01,
        newFn01,
        oldFn02,
        newFn02,
        oldQuantity,
        newQuantity,
        type: 'MONTHLY',
        requirementMonth,
        requirementYear,
        changedBy: req.user?.id || req.user?._id
    });

    res.status(200).json(
        new ApiResponse(200, { id: requirementId }, "Requirement updated and history logged")
    );
});

export const getHistoryByLine = asyncHandler(async (req, res) => {
    const { lineId } = req.params;
    const history = await LineRequirementHistory.findByLine(lineId);

    res.status(200).json(
        new ApiResponse(200, history, "Line history fetched successfully")
    );
});
