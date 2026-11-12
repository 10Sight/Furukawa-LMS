import DailyProductionReportConfig from "../models/dailyProductionReportConfig.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import logAudit from "../utils/auditLogger.js";
import RevisionRecordService from "../services/revisionRecord.service.js";
import {
    DPR_GLOBAL_KEY,
    resolveDprPresentation,
    validateDprPresentation,
    mergeDprPresentation,
} from "../../shared/dprLayout.js";

// Default Configuration matching the current hardcoded table in DailyProductionReport.jsx
const DEFAULT_DPR_CONFIG = {
    delivery: {
        title: "Delivery (Schedule Adherence)",
        headers: [
            { text: "S.No", width: "w-8" },
            { text: "W-H CODE", width: "w-24" },
            { text: "PLAN", width: "w-16" },
            { text: "Lot No.", width: "w-16" },
            { text: "Start Time", width: "w-16" },
            { text: "1st 2 Hrs", width: "w-16" },
            { text: "2nd 2 Hrs", width: "w-16" },
            { text: "3rd 2 Hrs", width: "w-16" },
            { text: "4th 2 Hrs", width: "w-16" },
            { text: "Total", width: "w-16" }
        ],
        rows: 6
    },
    quality: {
        title: "Quality (Defect Summary)",
        sections: [
            {
                name: "customerEndDefect",
                label: "Customer End Defect",
                fields: ["Production Qty.", "Defect Qty.", "PPM"]
            },
            {
                name: "internalDefect",
                label: "Internal Defect",
                fields: ["Production Qty.", "Defect Qty.", "PPM"]
            }
        ]
    },
    downTime: {
        title: "Down Time Summary",
        headers: [
            { text: "Down Time :", colSpan: 2 },
            { text: "1st 2 Hrs", width: "w-10" },
            { text: "2nd 2 Hrs", width: "w-10" },
            { text: "3rd 2 Hrs", width: "w-10" },
            { text: "4th 2 Hrs", width: "w-10" },
            { text: "Total", width: "w-10" }
        ],
        rows: [
            { label: "Circuits shortage from Charging", key: "circuitsShortageFromCharging" },
            { label: "Components shortage from store", key: "componentsShortageFromStore" },
            { label: "Tube shortage", key: "tubeShortage" },
            { label: "Changeover time", key: "changeoverTime" },
            { label: "Quality issues from C&C", key: "qualityIssuesFromCC" },
            { label: "Quality issues in assembly", key: "qualityIssuesInAssembly" },
            {
                label: "Delay in Inspection",
                children: [
                    { label: "Dim", key: "delayInInspectionDim" },
                    { label: "ECT", key: "delayInInspectionECT" },
                    { label: "Visual", key: "delayInInspectionVisual" }
                ]
            },
            {
                label: "Machine Under Break Down",
                children: [
                    { label: "CPG", key: "machineBreakDownCPG" },
                    { label: "Conveyor", key: "machineBreakDownConveyor" },
                    { label: "Torque Tight", key: "machineBreakDownTorqueTight" },
                    { label: "Grease Insert", key: "machineBreakDownGreaseInsert" },
                    { label: "F/A Board", key: "machineBreakDownFABoard" },
                    { label: "A/B Crimping", key: "machineBreakDownABCrimping" },
                    { label: "Gromett", key: "machineBreakDownGromett" }
                ]
            },
            { label: "Test paper for skill evaluation", key: "testPaperForSkillEvaluation" },
            { label: "Meeting Time/Training Time", key: "meetingTimeTrainingTime" },
            { label: "Plan Not Available", key: "planNotAvailable" }
        ]
    },
    shiftComm: {
        title: "Shift Communication",
        headerText: "Previous shift issues and general information during start up :",
        rows: 3
    },
    moral: {
        title: "Moral (Manpower Summary)",
        headers: [
            { text: "Sr. No.", width: "w-8" },
            { text: "Process" },
            { text: "Handover", width: "w-16" },
            { text: "Present", width: "w-12" },
            { text: "Absent", width: "w-12" },
            { text: "Present %", width: "w-12" }
        ],
        rows: [
            { process: "Leader" },
            { process: "Sub Leader" },
            { process: "Charging" },
            { process: "Sub Assy" },
            { process: "Material Trolley" },
            { process: "Tapping" },
            { process: "Clamp Cutting" },
            { process: "Clamp Attach" },
            { process: "Dimension" },
            { process: "ECT Inspection" },
            { process: "High Voltage" },
            { process: "COH" },
            { process: "EMDEP" },
            { process: "Twist Wrap" },
            { process: "Optional" },
            { process: "Visual" },
            { process: "Leader" }
        ]
    },
    attendance: {
        title: "Manpower Attendance Summary",
        rows: [] // Stores { stationId, stNo, process }
    },
    footer: {
        title: "Efficiency & Signatures",
        madeByLabel: "Made By (Line Leader):",
        checkedByLabel: "Checked By (Shift Incharge):"
    }
};

export const getDPRConfig = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    if (!departmentId) throw new ApiError(400, "Department ID is required");

    const configRecord = await DailyProductionReportConfig.findByDepartmentId(departmentId);

    if (!configRecord) {
        return res.json(new ApiResponse(200, { isDefault: true, config: DEFAULT_DPR_CONFIG }, "Default configuration returned"));
    }

    res.json(new ApiResponse(200, { isDefault: false, config: configRecord.config }, "Custom configuration fetched"));
});

export const saveDPRConfig = asyncHandler(async (req, res) => {
    const { departmentId, config, remark } = req.body;
    if (!departmentId || !config) throw new ApiError(400, "Department ID and Config are required");
    if (!remark) throw new ApiError(400, "Remark is required when updating configuration");

    const userName = req.user?.name || "Admin";

    const updated = await DailyProductionReportConfig.upsert(departmentId, config, remark, userName);
    res.json(new ApiResponse(200, updated, "Configuration saved successfully"));
});

// ── Presentation layout (DPR Layout & Revision editor) ────────────────────────
// Presentation (titles, header text, row labels, row counts) resolves Department →
// Global → defaults. Manpower rows (moral.rows / attendance.rows) are separate: they
// resolve Line → Global → Department on the client and are edited in DPRManage only.

// Config row key: a department id, or DPR_GLOBAL_KEY. Line rows (LINE_<id>) belong to
// DPRManage and are not a valid presentation scope.
const toPresentationKey = (departmentId) => {
    const raw = String(departmentId || "").trim();
    if (!raw || raw.toLowerCase() === "global") return DPR_GLOBAL_KEY;
    if (raw.toUpperCase().startsWith("LINE_")) throw new ApiError(400, "Line configs hold manpower rows only; edit them in DPR setup");
    return raw;
};
// revision_records stores the global scope as a NULL department.
const toRevisionDepartmentId = (key) => (key === DPR_GLOBAL_KEY ? null : (parseInt(key, 10) || null));

const findPresentationSource = async (key) => {
    if (key !== DPR_GLOBAL_KEY) {
        const own = await DailyProductionReportConfig.findByDepartmentId(key);
        if (own) return { record: own, scope: "department" };
    }
    const global = await DailyProductionReportConfig.findByDepartmentId(DPR_GLOBAL_KEY);
    if (global) return { record: global, scope: "global" };
    return { record: null, scope: "default" };
};

export const getDPRPresentation = asyncHandler(async (req, res) => {
    const key = toPresentationKey(req.params.departmentId);
    const { record, scope } = await findPresentationSource(key);
    res.json(new ApiResponse(200, { presentation: resolveDprPresentation(record?.config), scope }, "DPR layout fetched"));
});

// Atomic save for the layout editor: writes ONLY the presentation keys into the
// department (or Global) row — its manpower rows are kept untouched — and updates the
// Revision Table record for the same scope, which propagates the doc/rev header onto
// already-saved daily_production_reports.
export const saveDPRPresentationWithRevision = asyncHandler(async (req, res) => {
    const { departmentId, presentation, remark, revision } = req.body || {};
    if (!presentation) throw new ApiError(400, "Layout is required");
    if (!remark?.trim()) throw new ApiError(400, "Remark is required when updating configuration");
    if (!revision?.docNo?.trim() || !revision?.revNo?.trim()) {
        throw new ApiError(400, "Document No. and Revision No. are required");
    }

    const key = toPresentationKey(departmentId);
    const { record: source } = await findPresentationSource(key);
    const errors = validateDprPresentation(presentation, resolveDprPresentation(source?.config));
    if (errors.length) throw new ApiError(400, errors.join("; "));

    // Merge into this scope's own row. A brand-new row gets presentation only, so it never
    // shadows manpower rows that another scope (line / department) already provides.
    const ownRow = await DailyProductionReportConfig.findByDepartmentId(key);
    const merged = mergeDprPresentation(ownRow?.config || {}, resolveDprPresentation(presentation));
    const userName = req.user?.fullName || req.user?.name || "Admin";
    await DailyProductionReportConfig.upsert(key, merged, remark.trim(), userName);

    const savedRevision = await RevisionRecordService.upsertForScope(
        "daily-production-report",
        toRevisionDepartmentId(key),
        null, // DPR layouts are department-wide; section-level revision overrides are edited in the Revision Table.
        {
            sheetName: "Daily Production Report",
            docNo: revision.docNo,
            revNo: revision.revNo,
            issueDate: revision.issueDate,
            revDate: revision.revDate,
            affectedSrNoPage: revision.affectedSrNoPage,
            affectedSrNoPageHi: revision.affectedSrNoPageHi,
            changeDetails: revision.changeDetails,
            changeDetailsHi: revision.changeDetailsHi,
        },
        req.user
    );

    logAudit(req.user?.id, "SAVE_DPR_LAYOUT_WITH_REVISION",
        { departmentId: key, remark: remark.trim(), revisionRecordId: savedRevision.id, docNo: revision.docNo, revNo: revision.revNo },
        { resourceType: "DPR_CONFIG", resourceId: key, req }
    ).catch(err => console.error("logAudit(SAVE_DPR_LAYOUT_WITH_REVISION) failed:", err.message));

    res.json(new ApiResponse(200, { revision: savedRevision }, "DPR layout and revision saved"));
});

export const getDPRConfigHistory = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    if (!departmentId) throw new ApiError(400, "Department ID is required");

    // 'global' (layout editor) and 'GLOBAL' (DPR setup) are the same row.
    const key = String(departmentId).toLowerCase() === "global" ? DPR_GLOBAL_KEY : departmentId;
    const history = await DailyProductionReportConfig.getHistory(key);
    res.json(new ApiResponse(200, history, "Configuration history fetched"));
});
