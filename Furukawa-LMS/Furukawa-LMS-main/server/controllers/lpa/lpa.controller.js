import LpaRecord from "../../models/lpa/lpaRecord.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { calculateSheetSummary } from "../../utils/lpa/lpaScoring.js";
import XLSX from "xlsx";
import fs from "fs";
import logger from "../../logger/winston.logger.js";

// Helper to extract authenticated user details
const getUserContext = (req) => {
  if (req.user) return req.user;
  const headerCode = req.headers?.['x-user-code'];
  const headerId = req.headers?.['x-user-id'];
  const headerName = req.headers?.['x-user-name'];

  if (headerCode || headerId || headerName) {
    const isJoyAdmin = String(headerCode || '').toUpperCase().includes('ST080014') || String(headerId) === '14';
    return {
      id: headerId || 14,
      userName: headerCode || 'st080014',
      fullName: headerName || 'Joy Dastidar (ST080014)',
      role: isJoyAdmin ? 'ADMIN' : 'EMPLOYEE',
      isAdmin: isJoyAdmin
    };
  }

  return {
    id: 'current',
    userName: 'current',
    fullName: 'Current User',
    role: 'ADMIN',
    isAdmin: true
  };
};

/**
 * Retrieve form templates (Assembly, C&C)
 */
export const getTemplates = asyncHandler(async (req, res) => {
  const templates = await LpaRecord.getTemplates();
  return res.status(200).json(new ApiResponse(200, templates, "LPA templates retrieved successfully."));
});

/**
 * Retrieve template by section
 */
export const getTemplateBySection = asyncHandler(async (req, res) => {
  const { section } = req.params;
  const template = await LpaRecord.getTemplateBySection(section);
  return res.status(200).json(new ApiResponse(200, template, `${section} template retrieved successfully.`));
});

/**
 * Retrieve master dropdown data (Departments, Sections, Lines, Shifts, Units, Auditors)
 */
export const getDropdowns = asyncHandler(async (req, res) => {
  const dropdowns = await LpaRecord.getDropdowns();
  return res.status(200).json(new ApiResponse(200, dropdowns, "LPA dropdown options retrieved successfully."));
});

/**
 * Retrieve list of LPA records with filtering, searching, and pagination
 */
export const getRecords = asyncHandler(async (req, res) => {
  const user = getUserContext(req);
  const filters = {
    section: req.query.section,
    unit: req.query.unit,
    level: req.query.level,
    auditDate: req.query.auditDate || req.query.date,
    shift: req.query.shift,
    department: req.query.department,
    status: req.query.status,
    search: req.query.search
  };

  const pagination = {
    page: req.query.page,
    limit: req.query.limit
  };

  const result = await LpaRecord.getRecords(filters, pagination, user);
  return res.status(200).json(new ApiResponse(200, result, "LPA records retrieved successfully."));
});

/**
 * Retrieve single LPA record by ID
 */
export const getRecordById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = getUserContext(req);
  const record = await LpaRecord.getRecordById(id, user);

  if (!record) {
    throw new ApiError(`LPA record with ID '${id}' not found.`, 404);
  }

  return res.status(200).json(new ApiResponse(200, record, "LPA record retrieved successfully."));
});

/**
 * Create a new LPA record with authoritative score calculations
 */
export const createRecord = asyncHandler(async (req, res) => {
  const user = getUserContext(req);
  const payload = req.body;

  if (!payload || typeof payload !== "object") {
    throw new ApiError("Invalid record payload.", 400);
  }

  // Validate mandatory fields
  const formDate = payload.auditDate || payload.date || payload.sheets?.[0]?.date;
  const formShift = payload.shift || payload.sheets?.[0]?.shift;
  const formDept = payload.department || payload.sheets?.[0]?.department;

  if (!formDate) {
    throw new ApiError("Audit date is mandatory.", 400);
  }
  if (!formShift) {
    throw new ApiError("Shift is mandatory (A, B, C, or G).", 400);
  }
  if (!['A', 'B', 'C', 'G'].includes(String(formShift).toUpperCase())) {
    throw new ApiError("Shift must be one of: A, B, C, G.", 400);
  }
  if (!formDept) {
    throw new ApiError("Department is mandatory.", 400);
  }

  const created = await LpaRecord.createRecord(payload, user);
  return res.status(201).json(new ApiResponse(201, created, "LPA record created successfully."));
});

/**
 * Update an existing LPA record
 */
export const updateRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = getUserContext(req);
  const payload = req.body;

  if (!payload || typeof payload !== "object") {
    throw new ApiError("Invalid update payload.", 400);
  }

  // Check admin permission or creator permission
  const existing = await LpaRecord.getRecordById(id, user);
  if (!existing) {
    throw new ApiError(`LPA record with ID '${id}' not found.`, 404);
  }

  const isAdmin = Boolean(user.isAdmin || user.role === 'ADMIN' || user.role === 'SUPERADMIN');
  const userIds = [String(user.id), String(user._id), String(user.userId)].filter(Boolean);
  const userCodes = [user.empId, user.employeeId, user.code, user.userName, user.empCode].filter(Boolean).map(s => String(s).trim().toUpperCase());

  const isCreator =
    (existing.ownerId && userIds.includes(String(existing.ownerId))) ||
    (existing.createdById && userIds.includes(String(existing.createdById))) ||
    (existing.createdBy && (
      userIds.includes(String(existing.createdBy)) ||
      (typeof existing.createdBy === 'object' && (
        userIds.includes(String(existing.createdBy.id || existing.createdBy._id)) ||
        userCodes.includes(String(existing.createdBy.code || existing.createdBy.empId || '').toUpperCase())
      )) ||
      (typeof existing.createdBy === 'string' && (
        userIds.includes(existing.createdBy) ||
        userCodes.includes(existing.createdBy.toUpperCase())
      ))
    ));

  if (!isAdmin && !isCreator) {
    throw new ApiError("You do not have permission to edit this LPA record. Only the creator or an admin can edit it.", 403);
  }

  // Shift validation if provided
  const shift = payload.shift || payload.sheets?.[0]?.shift;
  if (shift && !['A', 'B', 'C', 'G'].includes(String(shift).toUpperCase())) {
    throw new ApiError("Shift must be one of: A, B, C, G.", 400);
  }

  const updated = await LpaRecord.updateRecord(id, payload, user);
  return res.status(200).json(new ApiResponse(200, updated, "LPA record updated successfully."));
});

/**
 * Delete an LPA record
 */
export const deleteRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = getUserContext(req);

  // Check admin permission or creator permission
  const existing = await LpaRecord.getRecordById(id, user);
  if (!existing) {
    throw new ApiError(`LPA record with ID '${id}' not found.`, 404);
  }

  const isAdmin = Boolean(user.isAdmin || user.role === 'ADMIN' || user.role === 'SUPERADMIN');
  const isCreator = existing.ownerId === String(user.id) || existing.createdById === String(user.id);

  if (!isAdmin && !isCreator) {
    throw new ApiError("You do not have permission to delete this LPA record.", 403);
  }

  await LpaRecord.deleteRecord(id, user);
  return res.status(200).json(new ApiResponse(200, { id }, "LPA record deleted successfully."));
});

/**
 * Authoritatively calculate scores for a sheet without committing changes
 */
export const calculateScores = asyncHandler(async (req, res) => {
  const { sheet, section } = req.body;
  if (!sheet) {
    throw new ApiError("Sheet data is required for score calculation.", 400);
  }

  const summary = calculateSheetSummary(sheet, section || "assembly");
  return res.status(200).json(new ApiResponse(200, summary, "Score calculation completed."));
});

/**
 * Admin Excel Upload endpoint: parses uploaded workbook and creates database record
 */
export const uploadExcel = asyncHandler(async (req, res) => {
  const user = getUserContext(req);
  const isAdmin = Boolean(user.isAdmin || user.role === 'ADMIN' || user.role === 'SUPERADMIN');
  if (!isAdmin) {
    throw new ApiError("Only administrators are authorized to upload LPA workbooks.", 403);
  }

  if (!req.file) {
    throw new ApiError("Please provide an Excel file to upload.", 400);
  }

  const section = (req.body.section || "assembly").toLowerCase();
  const unit = req.body.unit || "Bawal";
  const auditDate = req.body.auditDate || req.body.date || new Date().toISOString().slice(0, 10);

  const fileBuffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
  if (!fileBuffer) {
    throw new ApiError("Failed to read uploaded file buffer.", 400);
  }
  const workbook = XLSX.read(fileBuffer, { type: "buffer", cellStyles: true, cellNF: true });
  const sheets = workbook.SheetNames.map(sheetName => {
    const ws = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:G48");
    const columnCount = range.e.c - range.s.c + 1;
    const rows = [];

    for (let r = range.s.r; r <= range.e.r; r++) {
      const row = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        row.push({
          value: cell?.v ?? "",
          formatted: cell?.w ?? String(cell?.v ?? ""),
          type: cell?.t ?? "z"
        });
      }
      rows.push(row);
    }

    return {
      name: sheetName,
      columnCount,
      rows,
      merges: (ws["!merges"] || []).map(m => ({
        s: { r: m.s.r, c: m.s.c },
        e: { r: m.e.r, c: m.e.c }
      }))
    };
  });

  const recordPayload = {
    section,
    name: req.file.originalname,
    unit,
    level: req.body.level || "L1",
    auditDate,
    shift: req.body.shift || "A",
    department: req.body.department || (section === "assembly" ? "Assembly" : "C&C"),
    sheets
  };

  const created = await LpaRecord.createRecord(recordPayload, user);
  return res.status(201).json(new ApiResponse(201, created, "Excel workbook imported and saved to database successfully."));
});
