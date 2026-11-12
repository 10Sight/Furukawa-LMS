// Plain-data layout defaults and column helpers for the Daily 5M sheet, shared by
// Daily5MRecording, Daily5MLayoutEditor and Daily5MLayoutParts (kept out of the .jsx
// component module so React fast refresh keeps working).

// Total column count of a header grid, accounting for cells carried down by rowSpan.
export const countHeaderColumns = (headers = []) => {
    let carried = []; // remaining rowSpan of each cell started in an earlier row, with its width
    let maxColumns = 0;
    headers.forEach((row) => {
        const ownWidth = row.reduce((n, h) => n + (h.colSpan || 1), 0);
        const carriedWidth = carried.reduce((n, c) => n + c.width, 0);
        maxColumns = Math.max(maxColumns, ownWidth + carriedWidth);
        carried = [
            ...carried.map(c => ({ ...c, rows: c.rows - 1 })),
            ...row.map(h => ({ rows: (h.rowSpan || 1) - 1, width: h.colSpan || 1 }))
        ].filter(c => c.rows > 0);
    });
    return maxColumns;
};

export const DEFAULT_CRIMPING_CONFIG = {
    headers: [
        // Row 1
        [{ text: "Daily 5M Recording Man -Crimping section", colSpan: 42, className: "bg-blue-50 text-lg font-bold" }],
        // Row 2
        [{ text: "*If any part NG during retroactive and containment inspection then 100% parts to be check since last OK (Set up / In-process)", colSpan: 42, className: "bg-yellow-50 text-red-600 font-semibold text-[16px]" }],
        // Row 3
        [
            { text: "(To be filled by Leader / Supervisor)", colSpan: 7, className: "bg-gray-100" },
            { text: "Auth. Person", colSpan: 3, className: "bg-emerald-50 text-emerald-800 font-bold border-black" },
            { text: "(To be filled by Leader / Supervisor)", colSpan: 7, className: "bg-gray-100" },
            { text: "Retroactive Inspection (To be filled by Leader / Supervisor Before Change)", colSpan: 6, className: "bg-gray-100" },
            { text: "Set up Approval After Change (To be filled by Quality dept., Pick 5 samples for judgement)", colSpan: 9, className: "bg-gray-100" },
            { text: "Containment Action if required", colSpan: 7, className: "bg-gray-100" },
            { text: "Process Owner", rowSpan: 3 },
            { text: "Approved By (QA Incharge)", rowSpan: 3 },
            { text: "Approve or Reject", rowSpan: 3, className: "bg-slate-100 font-bold" }
        ],
        // Row 4
        [
            { text: "Sr. No.", rowSpan: 2 },
            { text: "Date", rowSpan: 2 },
            { text: "Station M/C No", rowSpan: 2 },
            { text: "Shift", rowSpan: 2 },
            { text: "Planned / <br /> Un-Planned", rowSpan: 2 },
            { text: "Problem", rowSpan: 2 },
            { text: "Process Name", rowSpan: 2 },
            { text: "Auth. Operator / <br /> Inspector Name", rowSpan: 2 },
            { text: "Operator Code / <br /> ID", rowSpan: 2 },
            { text: "Current <br /> Skill <br /> Level", rowSpan: 2 },
            { text: "Req. Min <br /> Skill Level", rowSpan: 2 },
            { text: "Deputy Person Name (If req.)", rowSpan: 2 },
            { text: "Operator <br /> Code", rowSpan: 2 },
            { text: "Actual Skill <br /> Level", rowSpan: 2 },
            { text: "Deputed From <br /> (Line/Process/Station)", rowSpan: 2 },
            { text: "Deputation Plan <br /> (Date)", rowSpan: 2 },
            { text: "OJT Status <br /> (Attached OJT sheet)", rowSpan: 2 },

            { text: "Last Produced Part Status <br /> Parameters", rowSpan: 2 },
            { text: "Standard", colSpan: 2 },
            { text: "Result", colSpan: 2 },
            { text: "Status", rowSpan: 2, isSplit: true, splitLabels: ["Status", "Prod Supr Sign"] },

            { text: "Inspector Name", rowSpan: 2 },
            { text: "Part No.", rowSpan: 2 },
            { text: "Lot No.", rowSpan: 2 },
            { text: "Circuit No.", rowSpan: 2 },
            { text: "Set up Verification (Parameters)", rowSpan: 2 },
            { text: "Result (After Change)", colSpan: 2 },
            { text: "QA Shift In-charge name", rowSpan: 2 },
            { text: "Status", rowSpan: 2 },

            { text: "Support Person Name", rowSpan: 2 },
            { text: "Visual Check (100%)", colSpan: 2 },
            { text: "Dimension Check (Every 2 hours)", colSpan: 3 },
            { text: "Remarks", rowSpan: 2 }
        ],
        // Row 5
        [
            // Retro Sub
            { text: "F" }, { text: "R" }, { text: "F" }, { text: "R" },
            // Setup Sub
            { text: "F" }, { text: "R" },
            // Containment Sub
            { text: "Produced Qty." }, { text: "NG Qty." },
            { text: "1st Check" }, { text: "2nd Check" }, { text: "3rd Check" }
        ]
    ],
    bodyRows: 5
};

// Default configuration for the editable "5M Change Type" footer table (matches the legacy hardcoded layout)
export const DEFAULT_CHANGE_TYPE_CONFIG = {
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
};

// Column count of the rendered sheet, including the injected "Approve or Reject" column.
export const countSheetColumns = (headers, formType) =>
    countHeaderColumns(headers) + (formType !== 'crimping' ? 1 : 0);
