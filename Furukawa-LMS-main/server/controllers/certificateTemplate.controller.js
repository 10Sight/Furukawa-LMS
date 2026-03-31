import { pool } from "../db/connectDB.js";
import CertificateTemplate from "../models/certificateTemplate.model.js";
import User from "../models/auth.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Helper for population
const populateTemplate = async (template) => {
    if (!template) return null;
    if (template.createdBy && typeof template.createdBy !== 'object') {
        const u = await User.findById(template.createdBy);
        if (u) template.createdBy = { id: u.id, fullName: u.fullName, email: u.email };
    }
    if (template.updatedBy && typeof template.updatedBy !== 'object') {
        const u = await User.findById(template.updatedBy);
        if (u) template.updatedBy = { id: u.id, fullName: u.fullName, email: u.email };
    }
    return template;
};

// Create a new certificate template (Admin only)
export const createCertificateTemplate = asyncHandler(async (req, res) => {
    const { name, description, template, styles, placeholders, isDefault } = req.body;

    if (!name || !template) {
        throw new ApiError("Name and template are required", 400);
    }

    if (placeholders && !Array.isArray(placeholders)) {
        throw new ApiError("Placeholders must be an array", 400);
    }

    const templateData = {
        name,
        description,
        template,
        styles: styles || "",
        placeholders: placeholders || [
            { key: "studentName", description: "Student's full name", required: true },
            { key: "courseName", description: "Course title", required: true },
            { key: "departmentName", description: "Department name", required: true },
            { key: "instructorName", description: "Instructor's full name", required: true },
            { key: "level", description: "Student's completion level", required: true },
            { key: "issueDate", description: "Certificate issue date", required: true },
            { key: "grade", description: "Grade or score", required: false }
        ],
        isDefault: isDefault || false,
        createdBy: req.user.id,
        updatedBy: req.user.id,
    };

    // If setting as default, unset others first
    if (templateData.isDefault) {
        await pool.query("UPDATE certificate_templates SET isDefault = 0");
    }

    const certificateTemplate = await CertificateTemplate.create(templateData);

    res.status(201).json(
        new ApiResponse(201, certificateTemplate, "Certificate template created successfully")
    );
});

// Get all certificate templates
export const getCertificateTemplates = asyncHandler(async (req, res) => {
    let templates = await CertificateTemplate.find({ isActive: 1 });

    // Sort logic (isDefault desc, createdAt desc)
    templates.sort((a, b) => {
        if (b.isDefault !== a.isDefault) return (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0);
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    templates = await Promise.all(templates.map(populateTemplate));

    res.json(new ApiResponse(200, templates, "Certificate templates fetched successfully"));
});

// Get certificate template by ID
export const getCertificateTemplateById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    let template = await CertificateTemplate.findById(id);

    if (!template || !template.isActive) {
        throw new ApiError("Certificate template not found", 404);
    }

    template = await populateTemplate(template);

    res.json(new ApiResponse(200, template, "Certificate template fetched successfully"));
});

// Get default certificate template
export const getDefaultCertificateTemplate = asyncHandler(async (req, res) => {
    let template = await CertificateTemplate.findOne({ isDefault: 1, isActive: 1 });

    if (!template) {
        // If no default template, get the first available template
        const [temps] = await pool.query("SELECT * FROM certificate_templates WHERE isActive = 1 ORDER BY createdAt ASC LIMIT 1");
        if (temps.length > 0) template = new CertificateTemplate(temps[0]);
    }

    if (!template) {
        throw new ApiError("No certificate template available", 404);
    }

    template = await populateTemplate(template);

    res.json(new ApiResponse(200, template, "Default certificate template fetched successfully"));
});

// Update certificate template
export const updateCertificateTemplate = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description, template, styles, placeholders, isDefault, isActive } = req.body;

    let existingTemplate = await CertificateTemplate.findById(id);
    if (!existingTemplate) {
        throw new ApiError("Certificate template not found", 404);
    }

    // Handle isDefault logic
    if (isDefault) {
        await pool.query("UPDATE certificate_templates SET isDefault = 0 WHERE id != ?", [id]);
    }

    if (name !== undefined) existingTemplate.name = name;
    if (description !== undefined) existingTemplate.description = description;
    if (template !== undefined) existingTemplate.template = template;
    if (styles !== undefined) existingTemplate.styles = styles;
    if (placeholders !== undefined) existingTemplate.placeholders = placeholders;
    if (isDefault !== undefined) existingTemplate.isDefault = isDefault;
    if (isActive !== undefined) existingTemplate.isActive = isActive;

    existingTemplate.updatedBy = req.user.id; // Corrected to just ID

    await existingTemplate.save();

    existingTemplate = await populateTemplate(existingTemplate);

    res.json(new ApiResponse(200, existingTemplate, "Certificate template updated successfully"));
});

// Delete certificate template (Soft delete)
export const deleteCertificateTemplate = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const template = await CertificateTemplate.findById(id);
    if (!template) {
        throw new ApiError("Certificate template not found", 404);
    }

    if (template.isDefault) {
        throw new ApiError("Cannot delete the default certificate template", 400);
    }

    template.isActive = 0; // SQL bit/boolean
    template.updatedBy = req.user.id;
    await template.save();

    res.json(new ApiResponse(200, null, "Certificate template deleted successfully"));
});

// Set template as default
export const setDefaultCertificateTemplate = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const template = await CertificateTemplate.findById(id);
    if (!template || !template.isActive) {
        throw new ApiError("Certificate template not found", 404);
    }

    // Unset all Others
    await pool.query("UPDATE certificate_templates SET isDefault = 0 WHERE id != ?", [id]);

    template.isDefault = 1;
    template.updatedBy = req.user.id;
    await template.save();

    const updatedTemplate = await populateTemplate(template);

    res.json(new ApiResponse(200, updatedTemplate, "Default certificate template updated successfully"));
});
