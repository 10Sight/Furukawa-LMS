import SectionHead from "../models/sectionHead.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { executeQuery as executeSql } from "../db/mssqlHelper.js";

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const cleanText = (value) => String(value ?? "").trim();

const normalizeSqlRows = (result) => {
    // Supports both common helper return formats:
    // 1) rows
    // 2) [rows, meta]
    if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
    if (Array.isArray(result)) return result;
    if (result?.recordset && Array.isArray(result.recordset)) return result.recordset;
    return [];
};

const getAllSectionHeads = asyncHandler(async (req, res) => {
    const heads = await SectionHead.findAll();

    return res
        .status(200)
        .json(new ApiResponse(200, heads, "Section heads fetched successfully"));
});

const getSectionHeadById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const head = await SectionHead.findById(id);

    if (!head) {
        return res
            .status(404)
            .json(new ApiResponse(404, null, "Section head not found"));
    }

    return res
        .status(200)
        .json(new ApiResponse(200, head, "Section head fetched successfully"));
});

const createSectionHead = asyncHandler(async (req, res) => {
    const { sectionId, subSectionId, email, name, CCMail } = req.body;

    const cleanedEmail = normalizeEmail(email);
    const cleanedName = cleanText(name);

    if (!sectionId) {
        return res
            .status(400)
            .json(new ApiResponse(400, null, "Section is required"));
    }

    if (!cleanedEmail) {
        return res
            .status(400)
            .json(new ApiResponse(400, null, "Email is required"));
    }

    if (!cleanedName) {
        return res
            .status(400)
            .json(new ApiResponse(400, null, "Recipient name is required"));
    }

    const head = await SectionHead.create({
        sectionId,
        subSectionId,
        email: cleanedEmail,
        name: cleanedName,
        CCMail,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, head, "Section head created successfully"));
});

const updateSectionHead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { sectionId, subSectionId, email, name, CCMail } = req.body;

    const cleanedEmail = normalizeEmail(email);
    const cleanedName = cleanText(name);

    if (!sectionId) {
        return res
            .status(400)
            .json(new ApiResponse(400, null, "Section is required"));
    }

    if (!cleanedEmail) {
        return res
            .status(400)
            .json(new ApiResponse(400, null, "Email is required"));
    }

    if (!cleanedName) {
        return res
            .status(400)
            .json(new ApiResponse(400, null, "Recipient name is required"));
    }

    const updated = await SectionHead.update(id, {
        sectionId,
        subSectionId,
        email: cleanedEmail,
        name: cleanedName,
        CCMail,
    });

    if (!updated) {
        return res
            .status(404)
            .json(new ApiResponse(404, null, "Section head not found or no changes made"));
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updated, "Section head updated successfully"));
});

const deleteSectionHead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await SectionHead.delete(id);

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Section head deleted successfully"));
});

const getGlobalCcEmails = asyncHandler(async (req, res) => {
    try {
        const result = await executeSql(`
            SELECT email
            FROM global_cc_emails
            WHERE is_active = 1
              AND email IS NOT NULL
              AND LTRIM(RTRIM(email)) != ''
            ORDER BY id ASC
        `);

        const rows = normalizeSqlRows(result);
        const emails = rows
            .map((row) => normalizeEmail(row.email))
            .filter((email) => email && email.includes("@"));

        return res
            .status(200)
            .json(new ApiResponse(200, emails, "Global CC emails fetched successfully"));
    } catch (error) {
        console.error("Error fetching global CC emails:", error);
        return res
            .status(500)
            .json(new ApiResponse(500, [], "Failed to fetch global CC emails"));
    }
});

const updateGlobalCcEmails = asyncHandler(async (req, res) => {
    const { ccEmails } = req.body;

    if (!Array.isArray(ccEmails)) {
        return res
            .status(400)
            .json(new ApiResponse(400, null, "ccEmails must be an array"));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validatedEmails = [
        ...new Set(
            ccEmails
                .map((email) => normalizeEmail(email))
                .filter((email) => emailRegex.test(email))
        ),
    ];

    try {
        // The frontend sends the full current CC list on every add/remove.
        // So first deactivate all old CC emails, then reactivate/insert the submitted list.
        await executeSql(`
            UPDATE global_cc_emails
            SET is_active = 0, updated_at = GETDATE()
        `);

        for (const email of validatedEmails) {
            await executeSql(
                `
                IF EXISTS (
                    SELECT 1
                    FROM global_cc_emails
                    WHERE LOWER(LTRIM(RTRIM(email))) = LOWER(LTRIM(RTRIM(?)))
                )
                BEGIN
                    UPDATE global_cc_emails
                    SET is_active = 1, updated_at = GETDATE()
                    WHERE LOWER(LTRIM(RTRIM(email))) = LOWER(LTRIM(RTRIM(?)))
                END
                ELSE
                BEGIN
                    INSERT INTO global_cc_emails (email, is_active, created_at)
                    VALUES (?, 1, GETDATE())
                END
                `,
                [email, email, email]
            );
        }

        return res
            .status(200)
            .json(new ApiResponse(200, validatedEmails, "Global CC emails updated successfully"));
    } catch (error) {
        console.error("Error updating global CC emails:", error);
        return res
            .status(500)
            .json(new ApiResponse(500, null, "Failed to save global CC emails"));
    }
});

export {
    getAllSectionHeads,
    getSectionHeadById,
    createSectionHead,
    updateSectionHead,
    deleteSectionHead,
    getGlobalCcEmails,
    updateGlobalCcEmails,
};
