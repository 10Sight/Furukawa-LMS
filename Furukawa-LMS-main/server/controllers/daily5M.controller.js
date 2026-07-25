import Daily5MConfig from "../models/daily5MConfig.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import sendMail from "../utils/mail.util.js";
import logAudit from "../utils/auditLogger.js";

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
            { text: "Sr. No.", rowSpan: 2, width: "w-12" },
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
    bodyRows: 5, // Default rows

    // Editable "5M Change Type" footer table (matches the legacy hardcoded layout)
    changeTypeTable: {
        title: "5M Change type: Man",
        rows: [
            [
                { text: "Expected Change (Planned)", rowSpan: 7, className: "border border-black p-1.5 text-center font-bold align-middle bg-slate-50" },
                { text: "Associate on planned leave / Absent without information (During start of shift)", rowSpan: 2, className: "border border-black py-0.5 px-0" },
                { text: "Depute operator on station of same skill", className: "border border-black py-0.5 px-0" },
                { text: "OJT", className: "border border-black p-1 text-center font-semibold" },
                { text: "First Part Approval", className: "border border-black p-1 text-center font-semibold" },
                { text: "Containment Action", className: "border border-black p-1 text-center font-semibold" },
                { text: "Un-expected Change (Un-planned)", rowSpan: 7, className: "border border-black p-1.5 text-center font-bold align-middle bg-slate-50" },
                { text: "Support operator / Work load (VD) adjustment", rowSpan: 2, className: "border border-black py-0.5 px-0" },
                { text: "(a) Depute associates from similar skill and process from same or other line/machine", className: "border border-black py-0.5 px-0" },
                { text: "OJT", className: "border border-black p-1 text-center font-semibold" },
                { text: "First Part Approval", className: "border border-black p-1 text-center font-semibold" },
                { text: "Containment Action", className: "border border-black p-1 text-center font-semibold" },
                { text: "Abnormal Condition", rowSpan: 7, className: "border border-black p-1.5 text-center font-bold align-middle bg-slate-50" },
                { text: "Extent working hours from 8 hrs (Over time)", rowSpan: 4, className: "border border-black py-0.5 px-0" },
                { text: "Expert person shall check produced part (line/station/process change during over time)", className: "border border-black py-0.5 px-0" },
                { text: "OJT", className: "border border-black p-1 text-center font-semibold" },
                { text: "First Part Approval", className: "border border-black p-1 text-center font-semibold" }
            ],
            [
                { text: "In case of less skill- a) less skill associates can produce parts under supervision of expert", className: "border border-black py-0.5 px-0" },
                { text: "OJT", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "First Part Approval", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "Containment Action", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "In case of less skill- (b) less skill associates under supervision of expert after training of defects", className: "border border-black py-0.5 px-0" },
                { text: "OJT", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "First Part Approval", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "Containment Action", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "", className: "border border-black py-0.5 px-0" },
                { text: "", className: "border border-black py-0.5 px-0 text-center" },
                { text: "", className: "border border-black py-0.5 px-0 text-center" }
            ],
            [
                { text: "New associates", className: "border border-black py-0.5 px-0" },
                { text: "Depute new associate to work station under supervision of expert", className: "border border-black py-0.5 px-0" },
                { text: "OJT", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "First Part Approval", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "Containment Action", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "Gate pass due to emergency (Operator not able to work due to sickness or accident)", rowSpan: 2, className: "border border-black py-0.5 px-0" },
                { text: "Operator of same skill deputed", className: "border border-black py-0.5 px-0" },
                { text: "", className: "border border-black py-0.5 px-0 text-center" },
                { text: "First Part Approval", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "Retroactive", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "", className: "border border-black py-0.5 px-0" },
                { text: "", className: "border border-black py-0.5 px-0 text-center" },
                { text: "", className: "border border-black py-0.5 px-0 text-center" }
            ],
            [
                { text: "Job Rotation / Multi-skill", className: "border border-black py-0.5 px-0" },
                { text: "Part/Product training before placing on the station", className: "border border-black py-0.5 px-0" },
                { text: "OJT", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "First Part Approval", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "Containment Action", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "Operator unskilled deputed", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "OJT", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "First Part Approval", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "Containment Action", className: "border border-black p-0.5 text-center font-semibold" },
                { text: "", className: "border border-black py-0.5 px-0" },
                { text: "", className: "border border-black py-0.5 px-0 text-center" },
                { text: "", className: "border border-black py-0.5 px-0 text-center" }
            ],
            [
                { text: "Associate work after Long vacation (1 month)", className: "border border-black py-0.5 px-0" },
                { text: "Depute associate under supervision of expert", className: "border border-black py-0.5 px-0" },
                { text: "OJT", className: "border border-black p-1 text-center font-semibold" },
                { text: "First Part Approval", className: "border border-black p-1 text-center font-semibold" },
                { text: "Containment Action", className: "border border-black p-1 text-center font-semibold" },
                { text: "", className: "border border-black py-0.5 px-0" },
                { text: "", className: "border border-black py-0.5 px-0" },
                { text: "", className: "border border-black p-1 text-center" },
                { text: "", className: "border border-black p-1 text-center" },
                { text: "", className: "border border-black p-1 text-center" },
                { text: "", className: "border border-black py-0.5 px-0" },
                { text: "", className: "border border-black py-0.5 px-0" },
                { text: "", className: "border border-black p-1 text-center" },
                { text: "", className: "border border-black p-1 text-center" }
            ],
            [
                { text: "Planned Gate pass", rowSpan: 2, className: "border border-black py-0.5 px-0" },
                { text: "Depute operator on station of same skill", className: "border border-black py-0.5 px-0" },
                { text: "", className: "border border-black p-1 text-center" },
                { text: "Setup Approval", className: "border border-black p-1 text-center font-semibold" },
                { text: "Containment Action", className: "border border-black p-1 text-center font-semibold" },
                { text: "", className: "border border-black py-0.5 px-0" },
                { text: "", className: "border border-black py-0.5 px-0" },
                { text: "", className: "border border-black p-1 text-center" },
                { text: "", className: "border border-black p-1 text-center" },
                { text: "", className: "border border-black p-1 text-center" },
                { text: "", className: "border border-black py-0.5 px-0" },
                { text: "", className: "border border-black py-0.5 px-0" },
                { text: "", className: "border border-black p-1 text-center" },
                { text: "", className: "border border-black p-1 text-center" }
            ],
            [
                { text: "In case of less skill- a) less skill associates can produce parts under supervision of expert", className: "border border-black py-0.5 px-0" },
                { text: "OJT", className: "border border-black p-1 text-center font-semibold" },
                { text: "Setup Approval", className: "border border-black p-1 text-center font-semibold" },
                { text: "Containment Action", className: "border border-black p-1 text-center font-semibold" },
                { text: "", className: "border border-black py-0.5 px-0" },
                { text: "", className: "border border-black py-0.5 px-0" },
                { text: "", className: "border border-black p-1 text-center" },
                { text: "", className: "border border-black p-1 text-center" },
                { text: "", className: "border border-black p-1 text-center" },
                { text: "", className: "border border-black py-0.5 px-0" },
                { text: "", className: "border border-black py-0.5 px-0" },
                { text: "", className: "border border-black p-1 text-center" },
                { text: "", className: "border border-black p-1 text-center" }
            ]
        ],
        notes: [
            { term: "* Retro parts:", definition: "Retro parts are the parts which are already produced when we come to know of change in process like m/c breakdown, poka yoke failures etc." },
            { term: "* Containment parts:", definition: "Containment parts are the parts produced after change (ex. Part produced by lower operator, part produced at time of poka yoke bypass)" }
        ]
    }
};

export const get5MConfig = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    if (!departmentId) throw new ApiError("Department ID is required", 400);

    const configRecord = await Daily5MConfig.findByDepartmentId(departmentId);

    logAudit(req.user?.id, "VIEW_DAILY_5M_CONFIG", { departmentId }, { resourceType: "DAILY_5M_CONFIG", resourceId: departmentId, req })
        .catch(err => console.error("logAudit(VIEW_DAILY_5M_CONFIG) failed:", err.message));

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

    logAudit(req.user?.id, "SAVE_DAILY_5M_CONFIG", { departmentId, remark }, { resourceType: "DAILY_5M_CONFIG", resourceId: departmentId, req })
        .catch(err => console.error("logAudit(SAVE_DAILY_5M_CONFIG) failed:", err.message));

    res.json(new ApiResponse(200, updated, "Configuration saved successfully"));
});

export const getConfigHistory = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    if (!departmentId) throw new ApiError("Department ID is required", 400);

    const history = await Daily5MConfig.getHistory(departmentId);

    logAudit(req.user?.id, "VIEW_DAILY_5M_CONFIG_HISTORY", { departmentId }, { resourceType: "DAILY_5M_CONFIG", resourceId: departmentId, req })
        .catch(err => console.error("logAudit(VIEW_DAILY_5M_CONFIG_HISTORY) failed:", err.message));

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

    logAudit(req.user?.id, "SEND_DAILY_5M_PDF_EMAIL", { email, departmentName, date }, { resourceType: "DAILY_5M_RECORD", req })
        .catch(err => console.error("logAudit(SEND_DAILY_5M_PDF_EMAIL) failed:", err.message));

    res.json(new ApiResponse(200, null, "Email sent successfully with PDF attachment"));
});
