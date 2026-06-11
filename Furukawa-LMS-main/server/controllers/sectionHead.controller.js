import SectionHead from "../models/sectionHead.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { executeQuery as executeSql } from "../db/mssqlHelper.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE_PATH = path.join(__dirname, "../global_cc_emails.json");

const getAllSectionHeads = asyncHandler(async (req, res) => {
    // This fetches joined sectionName/subSectionName from SQL directly per our Model
    const heads = await SectionHead.findAll();
    return res.status(200).json(new ApiResponse(200, heads, "Section heads fetched successfully"));
});

const getSectionHeadById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const head = await SectionHead.findById(id);
    if (!head) {
        return res.status(404).json(new ApiResponse(404, null, "Section head not found"));
    }
    return res.status(200).json(new ApiResponse(200, head, "Section head fetched successfully"));
});

const createSectionHead = asyncHandler(async (req, res) => {
    const { sectionId, subSectionId, email, name, CCMail } = req.body;
    if (!email) {
        return res.status(400).json(new ApiResponse(400, null, "Email is required"));
    }

    const head = await SectionHead.create({
        sectionId,
        subSectionId,
        email,
        name,
        CCMail
    });

    return res.status(201).json(new ApiResponse(201, head, "Section head created successfully"));
});

const updateSectionHead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { sectionId, subSectionId, email, name, CCMail } = req.body;

    const updated = await SectionHead.update(id, { sectionId, subSectionId, email, name, CCMail });
    if (!updated) {
        return res.status(404).json(new ApiResponse(404, null, "Section head not found or no changes made"));
    }

    return res.status(200).json(new ApiResponse(200, updated, "Section head updated successfully"));
});

const deleteSectionHead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await SectionHead.delete(id);
    return res.status(200).json(new ApiResponse(200, null, "Section head deleted successfully"));
});

const getGlobalCcEmails = asyncHandler(async (req, res) => {
    try {
        if (!fs.existsSync(CONFIG_FILE_PATH)) {
            return res.status(200).json(new ApiResponse(200, [], "Global CC emails fetched successfully"));
        }
        const data = await fs.promises.readFile(CONFIG_FILE_PATH, "utf8");
        const parsed = JSON.parse(data);
        return res.status(200).json(new ApiResponse(200, parsed.ccEmails || [], "Global CC emails fetched successfully"));
    } catch (error) {
        console.error("Error reading global CC emails config:", error);
        return res.status(200).json(new ApiResponse(200, [], "Global CC emails fetched successfully"));
    }
});

const updateGlobalCcEmails = asyncHandler(async (req, res) => {
    const { ccEmails } = req.body;
    if (!Array.isArray(ccEmails)) {
        return res.status(400).json(new ApiResponse(400, null, "ccEmails must be an array"));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validatedEmails = ccEmails.map(e => String(e).trim()).filter(e => emailRegex.test(e));

    try {
        await fs.promises.writeFile(CONFIG_FILE_PATH, JSON.stringify({ ccEmails: validatedEmails }, null, 2), "utf8");
        return res.status(200).json(new ApiResponse(200, validatedEmails, "Global CC emails updated successfully"));
    } catch (error) {
        console.error("Error writing global CC emails config:", error);
        return res.status(500).json(new ApiResponse(500, null, "Failed to save global CC emails"));
    }
});

export {
    getAllSectionHeads,
    getSectionHeadById,
    createSectionHead,
    updateSectionHead,
    deleteSectionHead,
    getGlobalCcEmails,
    updateGlobalCcEmails
};
