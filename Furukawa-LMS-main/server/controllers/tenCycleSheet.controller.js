import { executeQuery } from "../db/mssqlHelper.js";
import TenCycleSheet from "../models/tenCycleSheet.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import EmailConfiguration from "../models/emailConfiguration.model.js";
import sendMail from "../utils/mail.util.js";
import emailTemplates from "../utils/emailTemplates.js";
import ENV from "../configs/env.config.js";
import logAudit from "../utils/auditLogger.js";

export const listTenCycleSheets = asyncHandler(async (req, res) => {
    const { departmentId, sectionId, lineId, subSectionId } = req.query;

    const sheets = await TenCycleSheet.findByFilters({ departmentId, sectionId, lineId, subSectionId });

    // Batch-fetch department names for all unique departmentIds in the result
    const deptIds = [...new Set(sheets.map(s => s.departmentId).filter(Boolean))];
    let deptMap = {};
    if (deptIds.length > 0) {
        const placeholders = deptIds.map(() => "?").join(", ");
        const [deps] = await executeQuery(`SELECT id, name FROM departments WHERE id IN (${placeholders})`, deptIds);
        deps.forEach(d => { deptMap[d.id] = d.name; });
    }

    const result = sheets.map((s) => ({
        id: s.id,
        departmentId: s.departmentId,
        departmentName: deptMap[s.departmentId] || "",
        sectionId: s.sectionId,
        lineId: s.lineId,
        subSectionId: s.subSectionId,
        formType: s.formType,
        status: s.status,
        verifiedStatus: s.verifiedStatus,
        verifiedBy: s.verifiedBy,
        reviewedStatus: s.reviewedStatus,
        reviewedBy: s.reviewedBy,
        createdDate: s.createdDate,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
    }));

    return res.status(200).json(new ApiResponse(200, result, "10 cycle sheets fetched successfully"));
});

export const createTenCycleSheet = asyncHandler(async (req, res) => {
    const { departmentId, sectionId, lineId, subSectionId, formType } = req.body || {};

    if (!departmentId) throw new ApiError("Department is required", 400);
    if (!["form1", "form2", "form3"].includes(formType)) throw new ApiError("Invalid form type", 400);

    const [deps] = await executeQuery("SELECT id FROM departments WHERE id = ?", [departmentId]);
    if (deps.length === 0) throw new ApiError("Department not found", 404);

    const sheet = await TenCycleSheet.create({
        departmentId,
        sectionId,
        lineId,
        subSectionId,
        formType,
        qualityEngineer: "",
        qualityEngineerSign: "",
        dojoEngineer: "",
        dojoEngineerSign: "",
        entries: [],
        status: "Draft",
        createdBy: req.user?.fullName || req.user?.name || req.user?.userName || "",
    });

    logAudit(req.user?.id, "CREATE_TEN_CYCLE_SHEET", { sheetId: sheet.id, departmentId, sectionId, lineId, formType, status: "Draft" },
        { resourceType: "TenCycleSheet", resourceId: sheet.id, req }
    ).catch(err => console.error("logAudit(CREATE_TEN_CYCLE_SHEET) failed:", err.message));

    return res.status(201).json(new ApiResponse(201, sheet, "10 cycle sheet created successfully"));
});

export const getTenCycleSheetById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const sheet = await TenCycleSheet.findById(id);
    if (!sheet) throw new ApiError("10 cycle sheet not found", 404);

    const [deps] = await executeQuery("SELECT id, name FROM departments WHERE id = ?", [sheet.departmentId]);
    const departmentName = deps[0]?.name || "";

    return res.status(200).json(
        new ApiResponse(200, { ...sheet, departmentName }, "10 cycle sheet fetched successfully")
    );
});

export const updateTenCycleSheetById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { formType, qualityEngineer, qualityEngineerSign, dojoEngineer, dojoEngineerSign, entries, isSubmit } = req.body || {};

    const existing = await TenCycleSheet.findById(id);
    if (!existing) throw new ApiError("10 cycle sheet not found", 404);

    if (!["form1", "form2", "form3"].includes(formType)) throw new ApiError("Invalid form type", 400);

    const updated = await TenCycleSheet.updateById(id, {
        formType,
        qualityEngineer,
        qualityEngineerSign,
        dojoEngineer,
        dojoEngineerSign,
        entries: Array.isArray(entries) ? entries : [],
        status: isSubmit ? "Submitted" : existing.status,
        checkedBy: existing.checkedBy || req.user?.fullName || req.user?.name || "",
        verifiedBy: existing.verifiedBy,
        verifiedStatus: existing.verifiedStatus,
        verifiedAt: existing.verifiedAt,
        reviewedBy: existing.reviewedBy,
        reviewedStatus: existing.reviewedStatus,
        reviewedAt: existing.reviewedAt,
        updatedBy: req.user?.fullName || req.user?.name || req.user?.userName || "",
    });

    if (isSubmit) {
        // ... (existing email logic remains same)
        try {
            // Fetch metadata for email
            const [deptRows] = await executeQuery("SELECT name FROM departments WHERE id = ?", [existing.departmentId]);
            const [sectionRows] = await executeQuery("SELECT name FROM sections WHERE id = ?", [existing.sectionId]);
            const [lineRows] = await executeQuery("SELECT name FROM lines WHERE id = ?", [existing.lineId]);
            const [subSectionRows] = await executeQuery("SELECT name FROM sub_sections WHERE id = ?", [existing.subSectionId]);

            const departmentName = deptRows[0]?.name || "N/A";
            const sectionName = sectionRows[0]?.name || "N/A";
            const lineName = lineRows[0]?.name || "N/A";
            const subSectionName = subSectionRows[0]?.name || "N/A";

            // Get email configuration
            const config = await EmailConfiguration.findByFormDeptAndSection(
                "10-Cycle Check Sheet",
                existing.departmentId,
                existing.sectionId
            );

            if (config) {
                let to = config.toEmails || "";
                let cc = config.ccEmails || "";

                if (config.includeTrainer) {
                    const [trainers] = await executeQuery(
                        "SELECT email FROM users WHERE departmentId = ? AND (isTrainer = 1 OR role = 'INSTRUCTOR')",
                        [existing.departmentId]
                    );
                    const trainerEmails = trainers.map(t => t.email).filter(e => e).join(", ");
                    if (trainerEmails) to = to ? `${to}, ${trainerEmails}` : trainerEmails;
                }

                if (to) {
                    const portalUrl = `${ENV.ADMIN_URL || 'http://localhost:5173'}/admin/10-cycle-sheet?id=${id}`;
                    const html = emailTemplates.generateTenCycleSheetEmail({
                        departmentName,
                        sectionName,
                        lineName,
                        subSectionName,
                        formType,
                        date: new Date().toISOString().split('T')[0],
                        entries: updated.entries,
                        portalUrl
                    });

                    await sendMail(to, `10-Cycle Sheet Submitted: ${departmentName} - ${lineName}`, html, [], cc);
                }
            }
        } catch (emailError) {
            console.error("Failed to send 10-Cycle email:", emailError);
            // Don't fail the request if email fails
        }
    }

    logAudit(req.user?.id, isSubmit ? "SUBMIT_TEN_CYCLE_SHEET" : "SAVE_TEN_CYCLE_SHEET_DRAFT",
        { sheetId: id, formType, entriesCount: Array.isArray(updated.entries) ? updated.entries.length : 0, qualityEngineer, dojoEngineer },
        { resourceType: "TenCycleSheet", resourceId: id, req }
    ).catch(err => console.error(`logAudit(${isSubmit ? "SUBMIT_TEN_CYCLE_SHEET" : "SAVE_TEN_CYCLE_SHEET_DRAFT"}) failed:`, err.message));

    return res.status(200).json(new ApiResponse(200, updated, isSubmit ? "10 cycle sheet submitted successfully" : "10 cycle sheet updated successfully"));
});

export const approveTenCycleSheet = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action, role } = req.body; // action: 'APPROVE' or 'REJECT', role: 'VERIFY' or 'APPROVE'

    const existing = await TenCycleSheet.findById(id);
    if (!existing) throw new ApiError("10 cycle sheet not found", 404);

    const userName = req.user?.fullName || req.user?.name || "";
    const updateData = { ...existing };

    if (role === 'VERIFY') {
        updateData.verifiedBy = userName;
        updateData.verifiedStatus = action;
        updateData.verifiedAt = new Date();
    } else if (role === 'APPROVE') {
        updateData.reviewedBy = userName;
        updateData.reviewedStatus = action;
        updateData.reviewedAt = new Date();
    } else {
        throw new ApiError("Invalid role for approval", 400);
    }

    const updated = await TenCycleSheet.updateById(id, {
        ...updateData,
        updatedBy: userName
    });

    const outcome = action === 'APPROVE' ? 'Approved' : 'Rejected';
    if (role === 'VERIFY') {
        logAudit(req.user?.id, "VERIFY_TEN_CYCLE_SHEET", { sheetId: id, outcome, verifiedBy: userName },
            { resourceType: "TenCycleSheet", resourceId: id, req }
        ).catch(err => console.error("logAudit(VERIFY_TEN_CYCLE_SHEET) failed:", err.message));
    } else {
        logAudit(req.user?.id, "APPROVE_TEN_CYCLE_SHEET", { sheetId: id, outcome, reviewedBy: userName },
            { resourceType: "TenCycleSheet", resourceId: id, req }
        ).catch(err => console.error("logAudit(APPROVE_TEN_CYCLE_SHEET) failed:", err.message));
    }

    return res.status(200).json(new ApiResponse(200, updated, `10-Cycle sheet ${action.toLowerCase()}ed successfully`));
});

export const deleteTenCycleSheet = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await TenCycleSheet.findById(id);
    if (!existing) throw new ApiError("10 cycle sheet not found", 404);

    await TenCycleSheet.delete(id);

    logAudit(req.user?.id, "DELETE_TEN_CYCLE_SHEET",
        { sheetId: id, departmentId: existing.departmentId, formType: existing.formType, deletedBy: req.user?.fullName || req.user?.name || req.user?.userName || "" },
        { resourceType: "TenCycleSheet", resourceId: id, req }
    ).catch(err => console.error("logAudit(DELETE_TEN_CYCLE_SHEET) failed:", err.message));

    return res.status(200).json(new ApiResponse(200, {}, "10 cycle sheet deleted successfully"));
});
