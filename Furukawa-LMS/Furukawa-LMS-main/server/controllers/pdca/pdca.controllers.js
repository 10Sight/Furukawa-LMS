import PDCAModel from "../../models/pdca/pdca.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import path from "path";
import fs from "fs";
import { executeQuery } from "../../db/mssqlHelper.js";

// Helper to determine actor name
const getActorName = (req) => {
    return req.user?.fullName || req.user?.userName || req.body?.createdBy?.name || 'System User';
};

// --- A. PDCA Record Management ---

/**
 * 1. Create a PDCA record
 * POST /api/v1/pdca
 */
export const createPDCARecord = asyncHandler(async (req, res) => {
    const { topic, plant, scope } = req.body;

    if (!topic || !String(topic).trim()) {
        throw new ApiError("Topic is required", 400);
    }

    const actor = getActorName(req);
    const newRecord = await PDCAModel.create(req.body, actor);

    return res.status(201).json(new ApiResponse(201, newRecord, "PDCA record created successfully"));
});

/**
 * 2. List PDCA records
 * GET /api/v1/pdca
 */
export const getPDCARecords = asyncHandler(async (req, res) => {
    const { plant, scope, search, page, limit } = req.query;

    const result = await PDCAModel.findAll({
        plant,
        scope,
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 100
    });

    return res.status(200).json(new ApiResponse(200, result, "PDCA records fetched successfully"));
});

/**
 * 3. Retrieve a single PDCA record
 * GET /api/v1/pdca/:id
 */
export const getPDCARecordById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const record = await PDCAModel.findByRecordId(id);

    if (!record) {
        throw new ApiError(`PDCA record with ID ${id} not found`, 404);
    }

    return res.status(200).json(new ApiResponse(200, record, "PDCA record retrieved successfully"));
});

/**
 * 4. Update a PDCA record
 * PUT /api/v1/pdca/:id
 */
export const updatePDCARecord = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const actor = getActorName(req);

    const updated = await PDCAModel.update(id, req.body, actor);
    if (!updated) {
        throw new ApiError(`PDCA record with ID ${id} not found`, 404);
    }

    return res.status(200).json(new ApiResponse(200, updated, "PDCA record updated successfully"));
});

/**
 * 5. Delete a PDCA record
 * DELETE /api/v1/pdca/:id
 */
export const deletePDCARecord = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const actor = getActorName(req);

    const deleted = await PDCAModel.delete(id, actor);
    if (!deleted) {
        throw new ApiError(`PDCA record with ID ${id} not found`, 404);
    }

    return res.status(200).json(new ApiResponse(200, { id }, "PDCA record deleted successfully"));
});

// --- B. PDCA Sheet Management ---

/**
 * 6. Retrieve the PDCA sheet
 * GET /api/v1/pdca/:id/sheet
 */
export const getPDCASheet = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const record = await PDCAModel.findByRecordId(id);
    if (!record) {
        throw new ApiError(`PDCA record with ID ${id} not found`, 404);
    }

    const sheet = await PDCAModel.getSheet(record.id);
    return res.status(200).json(new ApiResponse(200, sheet, "PDCA sheet retrieved successfully"));
});

/**
 * 7. Save the PDCA sheet
 * PUT /api/v1/pdca/:id/sheet
 */
export const savePDCASheet = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const actor = getActorName(req);

    let record = await PDCAModel.findByRecordId(id);
    if (!record) {
        // Auto-create base record if saving sheet for newly initialized record
        record = await PDCAModel.create({
            id,
            topic: req.body?.headerInfo?.topicName || "PDCA Audit Sheet",
            plant: req.body?.plant || "Gujrat",
            scope: "Company"
        }, actor);
    }

    const savedSheet = await PDCAModel.saveSheet(record.id, req.body, actor);
    return res.status(200).json(new ApiResponse(200, savedSheet, "PDCA sheet saved successfully"));
});

// --- C. CFT Topic Management ---

/**
 * 8. Create a CFT topic
 * POST /api/v1/pdca/cft
 */
export const createCFTTopic = asyncHandler(async (req, res) => {
    const { name, topic } = req.body;
    const title = name || topic;

    if (!title || !String(title).trim()) {
        throw new ApiError("CFT Topic Name is required", 400);
    }

    const actor = getActorName(req);
    const cftTopic = await PDCAModel.createCft(req.body, actor);

    return res.status(201).json(new ApiResponse(201, cftTopic, "CFT topic created successfully"));
});

/**
 * 9. List CFT topics
 * GET /api/v1/pdca/cft
 */
export const getCFTTopics = asyncHandler(async (req, res) => {
    const { plant, search, page, limit } = req.query;

    const result = await PDCAModel.findAll({
        plant,
        scope: 'CFT',
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 100
    });

    return res.status(200).json(new ApiResponse(200, result, "CFT topics retrieved successfully"));
});

/**
 * 10. Update a CFT topic
 * PUT /api/v1/pdca/cft/:id
 */
export const updateCFTTopic = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const actor = getActorName(req);

    const updated = await PDCAModel.update(id, req.body, actor);
    if (!updated) {
        throw new ApiError(`CFT topic with ID ${id} not found`, 404);
    }

    return res.status(200).json(new ApiResponse(200, updated, "CFT topic updated successfully"));
});

/**
 * 11. Delete a CFT topic
 * DELETE /api/v1/pdca/cft/:id
 */
export const deleteCFTTopic = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const actor = getActorName(req);

    const deleted = await PDCAModel.delete(id, actor);
    if (!deleted) {
        throw new ApiError(`CFT topic with ID ${id} not found`, 404);
    }

    return res.status(200).json(new ApiResponse(200, { id }, "CFT topic deleted successfully"));
});

// --- D. CFT Member Management ---

/**
 * 12. Retrieve CFT members
 * GET /api/v1/pdca/cft/:id/members
 */
export const getCFTMembers = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const members = await PDCAModel.getCftMembers(id);

    return res.status(200).json(new ApiResponse(200, members, "CFT members retrieved successfully"));
});

/**
 * 13. Update CFT member assignments
 * PUT /api/v1/pdca/cft/:id/members
 */
export const updateCFTMembers = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const actor = getActorName(req);
    const members = req.body.members || req.body;

    if (!Array.isArray(members)) {
        throw new ApiError("Members must be an array of employee assignments", 400);
    }

    const updated = await PDCAModel.updateCftMembers(id, members, actor);
    return res.status(200).json(new ApiResponse(200, updated, "CFT members updated successfully"));
});

// --- E. Attachment and Evidence Management ---

/**
 * 14. Upload an attachment
 * POST /api/v1/pdca/:id/attachments
 */
export const uploadAttachment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rowId, fieldName } = req.body;

    if (!req.file) {
        throw new ApiError("No file uploaded", 400);
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const attachment = await PDCAModel.createAttachment({
        pdcaRecordId: id,
        rowId: rowId || '',
        fieldName: fieldName || '',
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
        uploadedBy: getActorName(req)
    });

    return res.status(201).json(new ApiResponse(201, {
        id: attachment?.id,
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
        rowId,
        fieldName
    }, "Attachment uploaded successfully"));
});

/**
 * 15. Retrieve or access an attachment
 * GET /api/v1/pdca/:id/attachments/:attachmentId
 */
export const getAttachment = asyncHandler(async (req, res) => {
    const { id, attachmentId } = req.params;
    const attachment = await PDCAModel.getAttachmentById(attachmentId);

    if (!attachment || attachment.pdcaRecordId !== id) {
        throw new ApiError("Attachment not found", 404);
    }

    const filePath = path.join(process.cwd(), "uploads", attachment.filename);
    if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
    }

    return res.status(200).json(new ApiResponse(200, attachment, "Attachment metadata retrieved"));
});

/**
 * 16. Delete an attachment
 * DELETE /api/v1/pdca/:id/attachments/:attachmentId
 */
export const deleteAttachment = asyncHandler(async (req, res) => {
    const { id, attachmentId } = req.params;
    const attachment = await PDCAModel.getAttachmentById(attachmentId);

    if (!attachment || attachment.pdcaRecordId !== id) {
        throw new ApiError("Attachment not found", 404);
    }

    await PDCAModel.deleteAttachment(attachmentId);

    // Clean up file if present
    try {
        const filePath = path.join(process.cwd(), "uploads", attachment.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch {}

    return res.status(200).json(new ApiResponse(200, { attachmentId }, "Attachment deleted successfully"));
});

// --- F. Audit History ---

/**
 * 17. Retrieve PDCA history
 * GET /api/v1/pdca/:id/history
 */
export const getPDCAHistory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const history = await PDCAModel.getHistory(id);

    return res.status(200).json(new ApiResponse(200, history, "PDCA history retrieved successfully"));
});

// --- G. Metadata and Dropdowns ---

/**
 * 18. Retrieve PDCA metadata
 * GET /api/v1/pdca/metadata
 */
export const getPDCAMetadata = asyncHandler(async (req, res) => {
    // Fetch departments from database if available
    let departments = [
        'Production', 'SRC Quality', 'IQC Quality', 'Die Casting',
        'Wiring Harness', 'Press & Stamping', 'Robotics', 'Tool Room',
        'Plant Maintenance', 'EHS Safety', 'Logistics',
        'Engineering', 'Human Resources', 'Finance & Accounts', 'Purchase', 'IT'
    ];

    try {
        const [deptRows] = await executeQuery(`SELECT name FROM departments WHERE isDeleted = 0 OR isDeleted IS NULL ORDER BY name ASC`);
        if (deptRows && deptRows.length > 0) {
            departments = [...new Set([...deptRows.map(d => d.name).filter(Boolean), ...departments])];
        }
    } catch {}

    // Fetch active employees/users for staff dropdown
    let employees = [];
    try {
        const [userRows] = await executeQuery(`
            SELECT TOP 100 id, fullName, userName, email
            FROM users
            WHERE isDeleted = 0 OR isDeleted IS NULL
            ORDER BY fullName ASC
        `);
        if (userRows && userRows.length > 0) {
            employees = userRows.map(u => ({
                id: u.id,
                name: u.fullName || u.userName,
                code: u.userName || String(u.id),
                email: u.email || ''
            }));
        }
    } catch {}

    const metadata = {
        plants: ['Gujrat', 'Bawal'],
        scopes: ['Company', 'Department', 'Self PDCA', 'CFT'],
        shifts: ['Day', 'Night', 'General', 'A', 'B', 'C'],
        statuses: ['Open', 'Under Observation', 'Delayed', 'Closed'],
        departments,
        employees
    };

    return res.status(200).json(new ApiResponse(200, metadata, "PDCA metadata retrieved successfully"));
});
