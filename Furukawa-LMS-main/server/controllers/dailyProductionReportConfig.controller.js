import DailyProductionReportConfig from "../models/dailyProductionReportConfig.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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
            { text: "Present (2)", width: "w-12" }
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

export const getDPRConfigHistory = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    if (!departmentId) throw new ApiError(400, "Department ID is required");

    const history = await DailyProductionReportConfig.getHistory(departmentId);
    res.json(new ApiResponse(200, history, "Configuration history fetched"));
});
