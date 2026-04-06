import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import ReportClub from "../models/reportClub.model.js";
import Section from "../models/section.model.js";

/**
 * @desc    Create a new report club
 * @route   POST /api/report-clubs
 * @access  Private (Admin/SuperAdmin)
 */
export const createClub = asyncHandler(async (req, res) => {
    const { name, departmentId, sectionIds } = req.body;
    const createdBy = req.user.id || req.user._id;

    if (!name || !departmentId || !sectionIds || !Array.isArray(sectionIds) || sectionIds.length === 0) {
        throw new ApiError("All fields are required and sectionIds must be an array", 400);
    }

    const club = await ReportClub.create({ name, departmentId, sectionIds, createdBy });
    res.status(201).json(new ApiResponse(201, club, "Club created successfully"));
});

/**
 * @desc    Get all report clubs with aggregated counts
 * @route   GET /api/report-clubs
 * @access  Private
 */
export const getAllClubs = asyncHandler(async (req, res) => {
    const clubs = await ReportClub.findAll();
    
    // Enrich with aggregated sectionCount
    const enrichedClubs = await Promise.all(clubs.map(async (club) => {
        let totalCount = 0;
        const sectionDetails = [];
        
        for (const sectionId of club.sectionIds) {
            const section = await Section.findById(sectionId);
            if (section) {
                totalCount += section.sectionCount || 0;
                sectionDetails.push({
                    id: section.id,
                    name: section.name,
                    category: section.category,
                    count: section.sectionCount
                });
            }
        }
        
        return {
            ...club,
            totalSectionCount: totalCount,
            sections: sectionDetails
        };
    }));

    res.json(new ApiResponse(200, enrichedClubs, "Clubs fetched successfully"));
});

/**
 * @desc    Update a report club
 * @route   PATCH /api/report-clubs/:id
 * @access  Private (Admin/SuperAdmin)
 */
export const updateClub = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, departmentId, sectionIds, showInReport } = req.body;

    const club = await ReportClub.findById(id);
    if (!club) throw new ApiError("Club not found", 404);

    const updatedClub = await ReportClub.update(id, { name, departmentId, sectionIds, showInReport });
    res.json(new ApiResponse(200, updatedClub, "Club updated successfully"));
});

/**
 * @desc    Delete a report club
 * @route   DELETE /api/report-clubs/:id
 * @access  Private (Admin/SuperAdmin)
 */
export const deleteClub = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const success = await ReportClub.delete(id);
    if (!success) throw new ApiError("Club not found or already deleted", 404);
    res.json(new ApiResponse(200, {}, "Club deleted successfully"));
});
