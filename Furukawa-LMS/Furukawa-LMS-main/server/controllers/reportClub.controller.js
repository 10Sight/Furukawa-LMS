import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import ReportClub from "../models/reportClub.model.js";
import Section from "../models/section.model.js";
import Department from "../models/department.model.js";

// Resolves the section IDs to their department(s). Returns a single departmentId
// when every section belongs to the same department (backward-compatible single-dept
// club), or null when the club spans multiple departments.
const resolveDepartmentId = async (sectionIds) => {
    const departmentIds = new Set();
    for (const sectionId of sectionIds) {
        const section = await Section.findById(sectionId);
        if (!section) throw new ApiError(`Invalid section ID: ${sectionId}`, 400);
        if (section.departmentId) departmentIds.add(section.departmentId);
    }
    const uniqueDeptIds = [...departmentIds];
    return uniqueDeptIds.length === 1 ? uniqueDeptIds[0] : null;
};

/**
 * @desc    Create a new report club
 * @route   POST /api/report-clubs
 * @access  Private (Admin/SuperAdmin)
 */
export const createClub = asyncHandler(async (req, res) => {
    const { name, sectionIds } = req.body;
    const createdBy = req.user.id || req.user._id;

    if (!name || !sectionIds || !Array.isArray(sectionIds) || sectionIds.length === 0) {
        throw new ApiError("Club name and at least one section are required", 400);
    }

    const departmentId = await resolveDepartmentId(sectionIds);

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

    // Enrich with aggregated sectionCount and per-section department info
    const enrichedClubs = await Promise.all(clubs.map(async (club) => {
        let totalCount = 0;
        const sectionDetails = [];
        const departmentNamesById = new Map();

        for (const sectionId of club.sectionIds) {
            const section = await Section.findById(sectionId);
            if (section) {
                totalCount += section.sectionCount || 0;

                if (section.departmentId && !departmentNamesById.has(section.departmentId)) {
                    const department = await Department.findById(section.departmentId);
                    departmentNamesById.set(section.departmentId, department?.name || "Unknown");
                }

                sectionDetails.push({
                    id: section.id,
                    name: section.name,
                    category: section.category,
                    count: section.sectionCount,
                    departmentId: section.departmentId,
                    departmentName: departmentNamesById.get(section.departmentId)
                });
            }
        }

        const departmentIds = [...departmentNamesById.keys()];
        const departmentName = club.departmentName || [...departmentNamesById.values()].join(", ") || "N/A";

        return {
            ...club,
            departmentName,
            departmentIds,
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
    const { name, sectionIds, showInReport } = req.body;

    const club = await ReportClub.findById(id);
    if (!club) throw new ApiError("Club not found", 404);

    let departmentId;
    if (sectionIds !== undefined) {
        if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
            throw new ApiError("sectionIds must be a non-empty array", 400);
        }
        departmentId = await resolveDepartmentId(sectionIds);
    }

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
