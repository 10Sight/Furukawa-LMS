import Daily5MConfig from "../models/daily5MConfig.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import sendMail from "../utils/mail.util.js";

// Default Configuration matching the current hardcoded table
const DEFAULT_CONFIG = {
    headers: [
        // Row 1
        [{ text: "Daily 5M Recording Man - {DeptName}", colSpan: 44, className: "bg-blue-50 text-lg font-bold" }],
        // Row 2
        [{ text: "*If any part NG during retroactive and containment inspection then 100% parts to be check since last OK (Set up / In-process)", colSpan: 44, className: "bg-yellow-50 text-red-600 font-semibold" }],
        // Row 3
        [
            { text: "(To be filled by Leader / Supervisor)", colSpan: 17, className: "bg-gray-100" },
            { text: "Retroactive Inspection (To be filled by Leader / Supervisor Before Change)", colSpan: 6, className: "bg-gray-100" },
            { text: "First part Approval After Change (To be filled by Quality dept., Pick 5 samples for judgement)", colSpan: 12, className: "bg-gray-100" },
            { text: "Containment Action if required", colSpan: 7, className: "bg-gray-100" },
            { text: "Process Owner", rowSpan: 3, width: "w-20" },
            { text: "Approved By (QA Incharge)", rowSpan: 3, width: "w-20" }
        ],
        // Row 4
        [
            { text: "Sr.no", rowSpan: 2 },
            { text: "Date", rowSpan: 2 },
            { text: "Line Name", rowSpan: 2 },
            { text: "Shift", rowSpan: 2 },
            { text: "Planned / Un-Planned", rowSpan: 2 },
            { text: "Process Name", rowSpan: 2 },
            { text: "Problem", rowSpan: 2 },
            { text: "Operator Code/ID", rowSpan: 2 },
            { text: "Auth. Operator / Inspector Name", rowSpan: 2 },
            { text: "Current Skill Level", rowSpan: 2 },
            { text: "Req. Min Skill Level", rowSpan: 2 },
            { text: "Deputed Person Name", rowSpan: 2 },
            { text: "Operator Code", rowSpan: 2 },
            { text: "Actual Skill Level", rowSpan: 2 },
            { text: "Deputed From (Line/Process/Station)", rowSpan: 2 },
            { text: "Deputation Plan (Date)", rowSpan: 2 },
            { text: "OJT Status (Attached OJT sheet)", rowSpan: 2 },

            { text: "Last Produced Part Status (Parameters)", rowSpan: 2 },
            { text: "Standard", colSpan: 2 },
            { text: "Result", colSpan: 2 },
            { text: "Status/Sign", rowSpan: 2, isSplit: true, splitLabels: ["Status", "Prod Supr Sign"] },

            { text: "Leader Name", rowSpan: 2 },
            { text: "Part No.", rowSpan: 2, width: "w-12" },
            { text: "Lot No.", rowSpan: 2, width: "w-12" },
            { text: "Sr. No.", rowSpan: 2, width: "w-10" },
            { text: "First part Approval Verification (5 Parts)", rowSpan: 2 },
            { text: "Result (After Change)", colSpan: 5 },
            { text: "QA Shift In-charge name", rowSpan: 2 },
            { text: "Status", rowSpan: 2 },

            { text: "Support Person Name", rowSpan: 2 },
            { text: "Visual Check (100%)", colSpan: 2 },
            { text: "Dimension Check (Every 2 hours)", colSpan: 3 },
            { text: "Remarks", rowSpan: 2 }
        ],
        // Row 5 (Sub headers)
        [
            // Retro Sub
            { text: "", className: "min-w-[50px]" }, { text: "", className: "min-w-[50px]" }, { text: "", className: "min-w-[50px]" }, { text: "", className: "min-w-[50px]" },
            // FP Result Sub
            { text: "1", width: "w-16" }, { text: "2", width: "w-16" }, { text: "3", width: "w-16" }, { text: "4", width: "w-16" }, { text: "5", width: "w-16" },
            // Containment Sub
            { text: "Produced Qty.", width: "w-12" }, { text: "NG Qty.", width: "w-12" },
            { text: "1st Check", width: "w-12" }, { text: "2nd Check", width: "w-12" }, { text: "3rd Check", width: "w-12" }
        ]
    ],
    // The columns definition is strictly for data mapping if we were generating rows dynamically from DB records. 
    // However, since the sheet is "empty rows to be filled", we mainly just define the structure for the *User Interface* to render inputs.
    // We will assume a fixed number of rows (e.g., 5) or dynamic rows, where each cell maps to the column index/id.
    bodyRows: 5 // Default rows
};

export const get5MConfig = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    if (!departmentId) throw new ApiError("Department ID is required", 400);

    const configRecord = await Daily5MConfig.findByDepartmentId(departmentId);

    // If no custom config, return default
    if (!configRecord) {
        return res.json(new ApiResponse(200, { isDefault: true, config: DEFAULT_CONFIG }, "Default configuration returned"));
    }

    res.json(new ApiResponse(200, { isDefault: false, config: configRecord.config }, "Custom configuration fetched"));
});

export const save5MConfig = asyncHandler(async (req, res) => {
    const { departmentId, config, remark } = req.body;
    if (!departmentId || !config) throw new ApiError("Department ID and Config are required", 400);
    if (!remark) throw new ApiError("Remark is required when updating configuration", 400);

    const userName = req.user?.name || "Admin"; // Assuming req.user is populated by auth middleware

    const updated = await Daily5MConfig.upsert(departmentId, config, remark, userName);
    res.json(new ApiResponse(200, updated, "Configuration saved successfully"));
});

export const getConfigHistory = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    if (!departmentId) throw new ApiError("Department ID is required", 400);

    const history = await Daily5MConfig.getHistory(departmentId);
    res.json(new ApiResponse(200, history, "Configuration history fetched"));
});

export const getAllConfigHistory = asyncHandler(async (req, res) => {
    const history = await Daily5MConfig.getAllHistory();
    res.json(new ApiResponse(200, history, "All configuration history fetched"));
});

export const send5MPDF = asyncHandler(async (req, res) => {
    const { email, pdfBase64, departmentName, date } = req.body;

    if (!email || !pdfBase64) {
        throw new ApiError("Email and PDF data are required", 400);
    }

    // Convert base64 to buffer
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const subject = `Daily 5M Recording - ${departmentName} (${date})`;
    const message = `
        <div style="font-family: sans-serif; line-height: 1.5;">
            <h2>Daily 5M Recording Sheet</h2>
            <p>Please find the attached Daily 5M Recording sheet for <b>${departmentName}</b> on <b>${date}</b>.</p>
            <hr />
            <p style="font-size: 12px; color: #666;">This is an automated email from Furukawa Minda LMS.</p>
        </div>
    `;

    const attachments = [{
        filename: `Daily_5M_${departmentName.replace(/\s+/g, '_')}_${date}.pdf`,
        content: buffer,
        contentType: 'application/pdf'
    }];

    await sendMail(email, subject, message, attachments);

    res.json(new ApiResponse(200, null, "Email sent successfully with PDF attachment"));
});
