import SectionHead from "../models/sectionHead.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { executeQuery as executeSql } from "../db/mssqlHelper.js";

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

export {
    getAllSectionHeads,
    getSectionHeadById,
    createSectionHead,
    updateSectionHead,
    deleteSectionHead
};
