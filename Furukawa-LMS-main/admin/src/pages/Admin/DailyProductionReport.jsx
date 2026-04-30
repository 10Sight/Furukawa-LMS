import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
    Save as IconSave,
    Printer as IconPrinter,
    RefreshCw as IconRefresh,
    Download as IconDownload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToExcel } from "@/utils/exportHelper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
import {
    useGetDailyProductionReportQuery,
    useSaveDailyProductionReportMutation,
    useCheckDailyProductionReportMutation,
    useListDailyProductionReportsQuery,
    useGetDPRConfigQuery,
    useSaveDPRConfigMutation,
    useGetDPRConfigHistoryQuery,
    useLazyGetManpowerStatsQuery,
    useLazyGetBatchMachineAssignmentsQuery,
} from "@/Redux/AllApi/DailyProductionReportApi";
import toast from "react-hot-toast";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Settings as IconSettings } from "lucide-react";

// ----- Subcomponents for the Complex Table Sections -----

const SectionHeader = ({ title }) => (
    <div className="bg-blue-100 p-1 border border-black text-center font-bold text-sm">
        {title}
    </div>
);

const DefectDetailSection = ({ title, data, onChange, disabled }) => (
    <div className="mt-2">
        <div className="bg-gray-100 p-1 border border-black font-bold text-xs">
            {title}
        </div>
        <table className="w-full border-collapse border border-black text-center mt-0 text-[8px]">
            <thead className="bg-gray-50 font-bold">
                <tr>
                    <th className="border border-black p-0.5 w-[3%]">SR NO.</th>
                    <th className="border border-black p-0.5 w-[7%]">W/H CODE</th>
                    <th className="border border-black p-0.5 w-[10%]">DEFECT NAME</th>
                    <th className="border border-black p-0.5 w-[4%]">QTY</th>
                    <th className="border border-black p-0.5 w-[8%]">PROCESS NAME</th>
                    <th className="border border-black p-0.5 w-[8%]">ASSOCIATE NAME</th>
                    <th className="border border-black p-0.5 w-[5%]">STN. NO.</th>
                    <th className="border border-black p-0.5 w-[6%]">Cou./Branch</th>
                    <th className="border border-black p-0.5 w-[6%]">WIRE COLOUR</th>
                    <th className="border border-black p-0.5 w-[5%]">Down Time</th>
                    <th className="border border-black p-0.5 w-[13%]">Root Cause</th>
                    <th className="border border-black p-0.5 w-[15%]">Counter measure</th>
                    <th className="border border-black p-0.5 w-[5%]">Tgt Date</th>
                    <th className="border border-black p-0.5 w-[5%]">Resp</th>
                </tr>
            </thead>
            <tbody>
                {data.map((row, idx) => (
                    <tr key={idx} className="h-5">
                        <td className="border border-black p-0">{idx + 1}</td>
                        <td className="border border-black p-0"><TextCell value={row.whCode} onChange={(v) => onChange(idx, 'whCode', v)} textAlign="center" disabled={disabled} /></td>
                        <td className="border border-black p-0"><TextCell value={row.defectName} onChange={(v) => onChange(idx, 'defectName', v)} disabled={disabled} /></td>
                        <td className="border border-black p-0"><NumberCell value={row.qty} onChange={(v) => onChange(idx, 'qty', v)} disabled={disabled} /></td>
                        <td className="border border-black p-0"><TextCell value={row.processName} onChange={(v) => onChange(idx, 'processName', v)} disabled={disabled} /></td>
                        <td className="border border-black p-0"><TextCell value={row.associateName} onChange={(v) => onChange(idx, 'associateName', v)} disabled={disabled} /></td>
                        <td className="border border-black p-0"><TextCell value={row.stnNo} onChange={(v) => onChange(idx, 'stnNo', v)} textAlign="center" disabled={disabled} /></td>
                        <td className="border border-black p-0"><TextCell value={row.couBranch} onChange={(v) => onChange(idx, 'couBranch', v)} textAlign="center" disabled={disabled} /></td>
                        <td className="border border-black p-0"><TextCell value={row.wireColour} onChange={(v) => onChange(idx, 'wireColour', v)} textAlign="center" disabled={disabled} /></td>
                        <td className="border border-black p-0"><TextCell value={row.downTime} onChange={(v) => onChange(idx, 'downTime', v)} textAlign="center" disabled={disabled} /></td>
                        <td className="border border-black p-0"><TextCell value={row.rootCause} onChange={(v) => onChange(idx, 'rootCause', v)} disabled={disabled} /></td>
                        <td className="border border-black p-0"><TextCell value={row.counterMeasure} onChange={(v) => onChange(idx, 'counterMeasure', v)} disabled={disabled} /></td>
                        <td className="border border-black p-0"><TextCell value={row.tgtDate} onChange={(v) => onChange(idx, 'tgtDate', v)} textAlign="center" disabled={disabled} /></td>
                        <td className="border border-black p-0"><TextCell value={row.resp} onChange={(v) => onChange(idx, 'resp', v)} textAlign="center" disabled={disabled} /></td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const NumberCell = ({ value, onChange, disabled }) => (
    <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        disabled={disabled}
        className="w-full h-full text-center outline-none bg-transparent"
        min="0"
    />
);

const TextCell = ({ value, onChange, disabled, textAlign = 'left', className = '' }) => (
    <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full h-full text-${textAlign} px-1 outline-none bg-transparent ${className}`}
    />
);

const emptyDeliveryRow = { wHCode: "", plan: 0, lotNo: "", startTime: "", hr1: 0, hr2: 0, hr3: 0, hr4: 0, hr5: 0, total: 0 };
const emptyDefectDetailRow = {
    whCode: "",
    defectName: "",
    qty: 0,
    processName: "",
    associateName: "",
    stnNo: "",
    couBranch: "",
    wireColour: "",
    downTime: "",
    rootCause: "",
    counterMeasure: "",
    tgtDate: "",
    resp: ""
};

const getInitialManpowerRows = (configRows) => {
    // If we have custom config rows, map them
    if (configRows && configRows.length > 0) {
        return configRows.map((r, i) => ({
            srNo: i + 1,
            stNo: r.stNo || "-",
            process: r.process || "",
            stationId: r.stationId,
            data: [
                ["", "", "", "", ""], 
                ["", "", "", "", ""],
                ["", "", "", "", ""],
                [null, null, null, null, null]
            ]
        }));
    }

    // Default legacy rows if no config exists
    const rows = Array(40).fill(null).map((_, i) => ({
        srNo: i + 1,
        stNo: i < 2 ? "-" : (i < 23 ? i - 1 : i - 22),
        process: "",
        data: [
            ["", "", "", "", ""], 
            ["", "", "", "", ""],
            ["", "", "", "", ""],
            [null, null, null, null, null]
        ]
    }));

    const setProcess = (sr, label) => { if (rows[sr - 1]) rows[sr - 1].process = label; };
    setProcess(1, "Charging");
    setProcess(2, "Material Trolley");
    for (let i = 3; i <= 22; i++) setProcess(i, "Sub Assy");
    setProcess(23, "Torque");
    setProcess(24, "Mounting");
    setProcess(25, "Mounting");
    setProcess(26, "Mounting");
    setProcess(27, "Mounting");
    setProcess(28, "Tapping");
    setProcess(29, "Tapping");
    setProcess(30, "Tapping");
    setProcess(31, "Tapping");
    setProcess(32, "Tapping");
    setProcess(33, "Tapping");
    setProcess(34, "Clamp Cutting");
    setProcess(35, "Clamp Attach");
    setProcess(36, "Leader");
    setProcess(37, "Sub Leader");
    setProcess(38, "Dimension");
    setProcess(39, "ECT Inspection");
    setProcess(40, "High Voltage");
    
    return rows;
};

const initialManpowerRows = getInitialManpowerRows();

const emptyKaizenRow = { details: "", benefit: "", status: "", resp: "" };

const KaizenSection = ({ data, onChange, disabled }) => (
    <div className="w-full mt-1 border border-black">
        <div className="bg-gray-100 border-b border-black font-bold px-1 text-[10px] py-0.5 uppercase flex justify-between">
            <span>Kaizens : ( No. of Kaizen Intiated along with its banifites)</span>
            <span className="mr-8">Qty.- {data.filter(k => k.details).length}</span>
        </div>
        <table className="w-full border-collapse border border-black text-[9px]">
            <thead>
                <tr className="bg-gray-50 h-5">
                    <th className="border border-black w-[5%]">SR NO.</th>
                    <th className="border border-black w-[45%]">Kaizen Details</th>
                    <th className="border border-black w-[30%]">Benefit and comparision with old practice</th>
                    <th className="border border-black w-[10%]">Status</th>
                    <th className="border border-black w-[10%]">Resp</th>
                </tr>
            </thead>
            <tbody>
                {data.map((row, idx) => (
                    <tr key={idx} className="h-6">
                        <td className="border border-black text-center">{idx + 1}</td>
                        <td className="border border-black p-0">
                            <TextCell value={row.details} onChange={(v) => onChange(idx, 'details', v)} fontSize="text-[9px]" disabled={disabled} />
                        </td>
                        <td className="border border-black p-0">
                            <TextCell value={row.benefit} onChange={(v) => onChange(idx, 'benefit', v)} fontSize="text-[9px]" disabled={disabled} />
                        </td>
                        <td className="border border-black p-0">
                            <TextCell value={row.status} onChange={(v) => onChange(idx, 'status', v)} fontSize="text-[9px]" disabled={disabled} />
                        </td>
                        <td className="border border-black p-0">
                            <TextCell value={row.resp} onChange={(v) => onChange(idx, 'resp', v)} fontSize="text-[9px]" disabled={disabled} />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const FormFooter = () => (
    <div className="w-full mt-2 flex justify-between items-center text-[10px] font-bold border-t border-black pt-1">
        <div>FRM-PR-274</div>
        <div>Rev.-03</div>
        <div>Date- 09.02.2026</div>
    </div>
);

const ManpowerAttendanceSection = ({ data, onChange, disabled, navigate, date, shift }) => {
    // Split data into two columns dynamically
    const midPoint = Math.ceil(data.length / 2);
    const leftCol = data.slice(0, midPoint);
    const rightCol = data.slice(midPoint);

    const onNameClick = (userData) => {
        if (!userData || !navigate) return;
        
        // Pass full metadata in playUser state
        const playUser = {
            ...userData,
            date: date,
            shift: shift,
            logShift: shift
        };
        
        navigate('/cms/daily-5m-recording', { state: { playUser } });
    };

    const renderTablePart = (rows, startIdx) => (
        <table className="w-1/2 border-collapse border border-black text-[8px] print:text-[7px]">
            <thead>
                <tr className="bg-gray-100 h-5">
                    <th className="border border-black w-[5%] leading-tight">Sr. No.</th>
                    <th className="border border-black w-[8%] leading-tight">Station</th>
                    <th className="border border-black w-[12%] leading-tight">Sub-Section</th>
                    <th className="border border-black w-[5%] leading-tight">Label</th>
                    {[1, 2, 3, 4, 5].map(n => (
                        <th key={n} className="border border-black w-[14%]">{n}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row, idx) => {
                    const globalIdx = startIdx + idx;
                    // Check if we should merge process cell (e.g. Sub Assy)
                    const currentProcess = (row.process || "").trim();
                    const prevProcess = idx > 0 ? (rows[idx - 1].process || "").trim() : null;
                    const showProcess = idx === 0 || currentProcess !== prevProcess;
                    
                    const processRowSpan = rows.slice(idx).findIndex(r => (r.process || "").trim() !== currentProcess);
                    const spanCount = processRowSpan === -1 ? rows.length - idx : processRowSpan;

                    return (
                        <React.Fragment key={row.srNo}>
                            {/* Name Row */}
                            <tr className="h-3">
                                <td rowSpan={2} className="border border-black text-center">{row.srNo}</td>
                                <td rowSpan={2} className="border border-black text-center">{row.stNo}</td>
                                {showProcess && (
                                    <td rowSpan={spanCount * 2} className="border border-black px-1 font-bold text-center align-middle">{row.process}</td>
                                )}
                                <td className="border border-black px-1 font-bold">Name</td>
                                {row.data[0].map((val, cIdx) => {
                                    const status = row.data[2]?.[cIdx];
                                    const userData = row.data[3]?.[cIdx];
                                    const isAbsent = status === 'Absent';
                                    const isPresent = status === 'Present';
                                    return (
                                        <td key={cIdx} className={`border border-black p-0 relative ${isAbsent ? 'bg-red-50' : isPresent ? 'bg-green-50' : ''}`}>
                                            <div className="flex items-center h-full">
                                                {isAbsent && val ? (
                                                    <div 
                                                        className="w-full h-full px-1 py-0.5 text-red-600 font-bold cursor-pointer hover:underline flex items-center"
                                                        onClick={() => onNameClick(userData)}
                                                        title="Click to record Daily 5M"
                                                    >
                                                        {val}
                                                    </div>
                                                ) : (
                                                    <TextCell 
                                                        value={val} 
                                                        onChange={(v) => onChange(globalIdx, 0, cIdx, v)} 
                                                        fontSize="text-[8px]"
                                                        padding="p-0.5"
                                                        disabled={disabled}
                                                        className={isAbsent ? 'text-red-600 font-bold' : isPresent ? 'text-green-600 font-bold' : ''}
                                                    />
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                            {/* Code Row */}
                            <tr className="h-3">
                                <td className="border border-black px-1 font-bold">Code</td>
                                {row.data[1].map((val, cIdx) => {
                                    const status = row.data[2]?.[cIdx];
                                    const isAbsent = status === 'Absent';
                                    const isPresent = status === 'Present';
                                    return (
                                        <td key={cIdx} className={`border border-black p-0 relative ${isAbsent ? 'bg-red-50' : isPresent ? 'bg-green-50' : ''}`}>
                                            <div className="flex items-center h-full">
                                                <TextCell 
                                                    value={val} 
                                                    onChange={(v) => onChange(globalIdx, 1, cIdx, v)} 
                                                    fontSize="text-[8px]"
                                                    padding="p-0.5"
                                                    disabled={disabled}
                                                    className={isAbsent ? 'text-red-600 font-bold' : isPresent ? 'text-green-600 font-bold' : ''}
                                                />
                                                {isAbsent && val && (
                                                    <span className="absolute right-0 top-0 text-[6px] bg-blue-600 text-white px-0.5 rounded-bl font-bold">5M</span>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        </React.Fragment>
                    );
                })}
            </tbody>
        </table>
    );

    return (
        <div className="w-full mt-1 border border-black">
            <div className="bg-gray-100 border-b border-black font-bold px-1 text-[10px] py-0.5 uppercase">
                Manpower Attendance summary
            </div>
            <div className="flex w-full items-start">
                {renderTablePart(leftCol, 0)}
                {renderTablePart(rightCol, midPoint)}
            </div>
        </div>
    );
};

const DailyProductionReport = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { theme } = useSelector((state) => state.theme);
    const { user } = useSelector((state) => state.auth);
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN" || user?.isAdmin;
    const isShiftIncharge = user?.role === "SHIFT_INCHARGE" || user?.customRole?.name?.toUpperCase() === "SHIFT INCHARGE";
    const canApprove = isAdmin || isShiftIncharge;

    // Filter State
    const [selectedDate, setSelectedDate] = useState(location.state?.date || format(new Date(), "yyyy-MM-dd"));
    const [selectedDepartment, setSelectedDepartment] = useState(location.state?.department || "");
    const [selectedSection, setSelectedSection] = useState("");
    const [selectedLine, setSelectedLine] = useState(location.state?.line || "");
    const [selectedShift, setSelectedShift] = useState(location.state?.shift || "A");

    // Options Data
    const { data: deptData } = useGetAllDepartmentsQuery({ limit: 100 });
    const departments = deptData?.data?.departments || [];

    const { data: sectionData, isFetching: sectionsFetching } = useGetSectionsByDepartmentQuery(
        selectedDepartment,
        { skip: !selectedDepartment }
    );
    const sections = sectionData?.data || [];

    const { data: lineData, isFetching: linesFetching } = useGetLinesBySectionQuery(
        selectedSection,
        { skip: !selectedSection }
    );
    const lines = lineData?.data || [];

    // Report Form State
    const defaultFormData = {
        leaderName: "",
        delivery: Array(6).fill({ ...emptyDeliveryRow }),
        quality: {
            customerEndDefect: { productionQty: 0, defectQty: 0, ppm: 0 },
            internalDefect: { productionQty: 0, defectQty: 0, ppm: 0 }
        },
        downTime: {
            circuitsShortageFromCharging: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            componentsShortageFromStore: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            tubeShortage: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            changeoverTime: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            qualityIssuesFromCC: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            qualityIssuesInAssembly: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            delayInInspectionDim: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            delayInInspectionECT: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            delayInInspectionVisual: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            machineBreakDownCPG: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            machineBreakDownConveyor: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            machineBreakDownTorqueTight: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            machineBreakDownGreaseInsert: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            machineBreakDownFABoard: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            machineBreakDownABCrimping: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            machineBreakDownGromett: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            testPaperForSkillEvaluation: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            meetingTimeTrainingTime: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
            planNotAvailable: { hr1: 0, hr2: 0, hr3: 0, hr4: 0, total: 0 },
        },
        shiftCommunication: Array(3).fill({ issue: "" }),
        moral: [
            { process: "Leader", handover: "", present: 0, absent: 0, present2: 0 },
            { process: "Sub Leader", handover: "", present: 0, absent: 0, present2: 0 },
            { process: "Charging", handover: "", present: 0, absent: 0, present2: 0 },
            { process: "Sub Assy", handover: "", present: 0, absent: 0, present2: 0 },
            { process: "Material Trolley", handover: "", present: 0, absent: 0, present2: 0 },
            { process: "Tapping", handover: "", present: 0, absent: 0, present2: 0 },
            { process: "Clamp Cutting", handover: "", present: 0, absent: 0, present2: 0 },
            { process: "Clamp Attach", handover: "", present: 0, absent: 0, present2: 0 },
            { process: "Dimension", handover: "", present: 0, absent: 0, present2: 0 },
            { process: "ECT Inspection", handover: "", present: 0, absent: 0, present2: 0 },
            { process: "High Voltage", handover: "", present: 0, absent: 0, present2: 0 },
            { process: "COH", handover: "", present: 0, absent: 0, present2: 0 },
            { process: "EMDEP", handover: "", present: 0, absent: 0, present2: 0 },
            { process: "Twist Wrap", handover: "", present: 0, absent: 0, present2: 0 },
            { process: "Optional", handover: "", present: 0, absent: 0, present2: 0 },
            { process: "Visual", handover: "", present: 0, absent: 0, present2: 0 },
            { process: "Leader", handover: "", present: 0, absent: 0, present2: 0 },
        ],
        directEfficiency: { target: 0, actual: 0 },
        customerEndDefectDetails: Array(5).fill({ ...emptyDefectDetailRow }),
        internalDefectDetails: Array(5).fill({ ...emptyDefectDetailRow }),
        manpowerAttendance: initialManpowerRows,
        kaizenDetails: Array(2).fill({ ...emptyKaizenRow }),
        madeBy: "",
                        checkedBy: "",
        isSubmitted: false
    };

    const [formData, setFormData] = useState(defaultFormData);

    const [checkReport, { isLoading: isChecking }] = useCheckDailyProductionReportMutation();

    // Auto-fill Made By for new/draft reports
    useEffect(() => {
        if (!formData.madeBy && user?.name) {
            setFormData(prev => ({ ...prev, madeBy: user.name }));
        }
    }, [user?.name, formData.madeBy]);

    // Template Configuration State
    const [tableConfig, setTableConfig] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editingSection, setEditingSection] = useState(null); // 'delivery', 'quality', etc.
    const [jsonConfigStr, setJsonConfigStr] = useState("");
    const [layoutRemark, setLayoutRemark] = useState("");
    const [isViewingHistory, setIsViewingHistory] = useState(false);

    // Fetch Config Query (Department Specific)
    const { data: configResp, isFetching: configFetching } = useGetDPRConfigQuery(
        selectedDepartment,
        { skip: !selectedDepartment }
    );

    // Global Manpower Config
    const { data: globalConfigResp } = useGetDPRConfigQuery("GLOBAL");

    // Fetch Report Query
    const { data: reportResp, isFetching: reportFetching, refetch } = useGetDailyProductionReportQuery(
        { date: selectedDate, department: selectedDepartment, line: selectedLine, shift: selectedShift },
        { skip: !selectedDate || !selectedDepartment || !selectedLine || !selectedShift }
    );

    // Mutations
    const [saveConfig, { isLoading: isSavingConfig }] = useSaveDPRConfigMutation();
    const [saveReport, { isLoading: isSaving }] = useSaveDailyProductionReportMutation();

    // Daily Stats
    const { data: dailyStatsResp } = useListDailyProductionReportsQuery(
        { date: selectedDate },
        { skip: !selectedDate }
    );

    const dailyStats = React.useMemo(() => {
        const reports = dailyStatsResp?.data || [];
        return {
            total: reports.length,
            approved: reports.filter(r => r.status === 'APPROVED').length,
            rejected: reports.filter(r => r.status === 'REJECTED').length,
            submitted: reports.filter(r => r.status === 'SUBMITTED').length,
            draft: reports.filter(r => r.status === 'DRAFT' || !r.status).length,
        };
    }, [dailyStatsResp]);

    // Stats fetching
    const [getManpowerStats] = useLazyGetManpowerStatsQuery();
    const [getBatchAssignments] = useLazyGetBatchMachineAssignmentsQuery();
    const [isFetchingStats, setIsFetchingStats] = useState(false);
    const [isFetchingAssignments, setIsFetchingAssignments] = useState(false);

    // Auto-fetch manpower stats when Date, Shift or Config changes
    useEffect(() => {
        const fetchStats = async () => {
            const canEdit = !formData.isSubmitted && (formData.status !== 'APPROVED');
            if (!canEdit) return;

            const moralRows = formData.moral || globalConfigResp?.data?.config?.moral?.rows || tableConfig?.moral?.rows || null;
            if (!selectedDate || !selectedShift || !moralRows) return;

            const subSectionIds = moralRows
                .map(r => r.subSectionId)
                .filter(Boolean);

            if (subSectionIds.length === 0) return;

            try {
                setIsFetchingStats(true);
                const response = await getManpowerStats({
                    date: selectedDate,
                    shift: selectedShift,
                    subSectionIds
                }).unwrap();

                if (response.success && response.data) {
                    const statsMap = {};
                    response.data.forEach(s => {
                        statsMap[s.subSectionId] = s;
                    });

                    const updatedMoral = formData.moral.map(row => {
                        const stats = statsMap[row.subSectionId];
                        if (stats) {
                            return {
                                ...row,
                                handover: stats.totalCount || 0,
                                present: stats.presentCount || 0,
                                absent: stats.absentCount || 0
                            };
                        }
                        return row;
                    });

                    // Only update if data actually changed to avoid infinite loops
                    const hasChanged = JSON.stringify(updatedMoral) !== JSON.stringify(formData.moral);
                    if (hasChanged) {
                        setFormData(prev => ({ ...prev, moral: updatedMoral }));
                    }
                }
            } catch (err) {
                console.error("Failed to fetch manpower stats:", err);
            } finally {
                setIsFetchingStats(false);
            }
        };

        fetchStats();
    }, [selectedDate, selectedShift, tableConfig, globalConfigResp, formData.moral, getManpowerStats]);

    // Auto-fetch Machine Assignments for Attendance Table when Date, Shift or Config changes
    useEffect(() => {
        const fetchAssignments = async () => {
            const globalAttendanceRows = globalConfigResp?.data?.config?.attendance?.rows || tableConfig?.attendance?.rows || null;
            if (!selectedDate || !selectedShift || !globalAttendanceRows) return;

            const machineIds = globalAttendanceRows
                .map(r => r.stationId)
                .filter(Boolean);

            if (machineIds.length === 0) return;

            try {
                setIsFetchingAssignments(true);
                const response = await getBatchAssignments({
                    date: selectedDate,
                    shift: selectedShift,
                    machineIds
                }).unwrap();

                if (response.success && response.data) {
                    const assignmentMap = response.data;

                    const updatedAttendance = formData.manpowerAttendance.map(row => {
                        // Find stationId from config if missing in row (important for legacy or mismatched rows)
                        const configRow = globalAttendanceRows.find(cr => String(cr.srNo) === String(row.srNo));
                        const sId = row.stationId || configRow?.stationId;
                        
                        // Use string key to match JSON response
                        const assignments = sId ? assignmentMap[String(sId)] : null;
                        
                        if (assignments && assignments.length > 0) {
                            // Clone specific row data
                            const newNameRow = [...row.data[0]];
                            const newCodeRow = [...row.data[1]];
                            // Ensure 3rd sub-array exists for status
                            const newStatusRow = (row.data[2] && row.data[2].length === 5) ? [...row.data[2]] : Array(5).fill("");
                            // Add 4th sub-array for user metadata
                            const newUserDataRow = (row.data[3] && row.data[3].length === 5) ? [...row.data[3]] : Array(5).fill(null);

                            // Map first 5 assigned names/codes to columns 1-5
                            assignments.slice(0, 5).forEach((assign, idx) => {
                                // Only populate if empty to avoid overwriting manual changes
                                if (!newNameRow[idx]) newNameRow[idx] = assign.fullName;
                                if (!newCodeRow[idx]) newCodeRow[idx] = assign.empId;
                                // Always update status to reflect real-time attendance
                                newStatusRow[idx] = assign.status;
                                // Store full metadata
                                newUserDataRow[idx] = assign;
                            });

                            return {
                                ...row,
                                stationId: sId,
                                // Ensure we return all 4 sub-arrays
                                data: [newNameRow, newCodeRow, newStatusRow, newUserDataRow]
                            };
                        }
                        return row;
                    });

                    // Only update if data actually changed
                    const hasChanged = JSON.stringify(updatedAttendance) !== JSON.stringify(formData.manpowerAttendance);
                    if (hasChanged) {
                        setFormData(prev => ({ ...prev, manpowerAttendance: updatedAttendance }));
                    }
                }
            } catch (err) {
                console.error("Failed to fetch machine assignments:", err);
            } finally {
                setIsFetchingAssignments(false);
            }
        };

        fetchAssignments();
    }, [selectedDate, selectedShift, tableConfig, globalConfigResp, getBatchAssignments, formData.manpowerAttendance]);

    // Initialize/Update form data when report fetch results are available
    useEffect(() => {
        if (configResp?.data?.config) {
            setTableConfig(configResp.data.config);
            // We don't initialize formData here anymore to avoid conflicts with the report effect
        }
    }, [configResp]);

    // Populate form data on fetch
    useEffect(() => {
        // Global rows take priority if configured via Setup page
        const configMoralRows = globalConfigResp?.data?.config?.moral?.rows || tableConfig?.moral?.rows || null;
        const configAttendanceRows = globalConfigResp?.data?.config?.attendance?.rows || tableConfig?.attendance?.rows || null;

        if (reportResp?.data) {
            // Merge fetched data with defaults to ensure all arrays/objects exist
            const loadedData = reportResp.data.data || {};

            // Pad arrays if they don't have enough entries
            const deliveryCount = tableConfig?.delivery?.rows || 6;
            const paddedDelivery = [...(loadedData.delivery || [])];
            while (paddedDelivery.length < deliveryCount) paddedDelivery.push({ ...emptyDeliveryRow });

            const paddedShiftComm = [...(loadedData.shiftCommunication || [])];
            const shiftCommCount = tableConfig?.shiftComm?.rows || 3;
            while (paddedShiftComm.length < shiftCommCount) paddedShiftComm.push({ issue: "" });

            // Merge moral: prioritize saved report data, fallback to config rows, then to default
            const baseMoralRows = configMoralRows || defaultFormData.moral;
            const mergedMoral = baseMoralRows.map((defItem, idx) => {
                return (loadedData.moral && loadedData.moral[idx]) 
                    ? loadedData.moral[idx] 
                    : { ...defItem, handover: "", present: 0, absent: 0, present2: 0 };
            });

            // Pad Defect Details
            const paddedCustomerDefects = [...(loadedData.customerEndDefectDetails || [])];
            while (paddedCustomerDefects.length < 5) paddedCustomerDefects.push({ ...emptyDefectDetailRow });

            const paddedInternalDefects = [...(loadedData.internalDefectDetails || [])];
            while (paddedInternalDefects.length < 5) paddedInternalDefects.push({ ...emptyDefectDetailRow });

            // Pad / Merge Manpower
            const runtimeInitialRows = getInitialManpowerRows(configAttendanceRows);
            const mergedManpower = runtimeInitialRows.map((row) => {
                // Match primarily by stationId (unique DB identifier)
                // Fallback to srNo if stationId is missing (e.g. legacy or custom rows)
                const found = (loadedData.manpowerAttendance || []).find(m => 
                    (row.stationId && m.stationId && String(m.stationId) === String(row.stationId)) || 
                    (!row.stationId && String(m.srNo) === String(row.srNo))
                );
                
                if (found) {
                    // Ensure the data array has 3 sub-arrays (Name, Code, Status)
                    const mergedData = [...found.data];
                    while (mergedData.length < 3) mergedData.push(Array(5).fill(""));
                    return { ...row, ...found, data: mergedData };
                }
                return row;
            });

            // Pad Kaizens
            const paddedKaizens = [...(loadedData.kaizenDetails || [])];
            while (paddedKaizens.length < 2) paddedKaizens.push({ ...emptyKaizenRow });

            setFormData({
                ...defaultFormData,
                ...loadedData,
                delivery: paddedDelivery,
                shiftCommunication: paddedShiftComm,
                moral: mergedMoral,
                customerEndDefectDetails: paddedCustomerDefects,
                internalDefectDetails: paddedInternalDefects,
                manpowerAttendance: mergedManpower,
                kaizenDetails: paddedKaizens
            });
        } else {
            // New report: use defaults BUT with custom moral rows if config exists
            const runtimeInitialRows = getInitialManpowerRows(configAttendanceRows);
            
            if (configMoralRows) {
                setFormData({
                    ...defaultFormData,
                    manpowerAttendance: runtimeInitialRows,
                    moral: configMoralRows.map(row => ({
                        ...row,
                        handover: "",
                        present: 0,
                        absent: 0,
                        present2: 0
                    }))
                });
            } else {
                setFormData({
                    ...defaultFormData,
                    manpowerAttendance: runtimeInitialRows
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportResp, tableConfig, globalConfigResp]);

    // Handlers
    const handleDeliveryChange = (index, field, value) => {
        const newDelivery = [...formData.delivery];
        newDelivery[index] = { ...newDelivery[index], [field]: value };
        // Auto calculate total
        if (['hr1', 'hr2', 'hr3', 'hr4', 'hr5'].includes(field)) {
            newDelivery[index].total =
                Number(newDelivery[index].hr1 || 0) +
                Number(newDelivery[index].hr2 || 0) +
                Number(newDelivery[index].hr3 || 0) +
                Number(newDelivery[index].hr4 || 0) +
                Number(newDelivery[index].hr5 || 0);
        }
        setFormData({ ...formData, delivery: newDelivery });
    };

    const handleQualityChange = (type, field, value) => {
        const newQuality = { ...formData.quality };
        newQuality[type] = { ...newQuality[type], [field]: value };
        // Auto calc PPM
        if (field === 'productionQty' || field === 'defectQty') {
            const prod = Number(newQuality[type].productionQty || 0);
            const def = Number(newQuality[type].defectQty || 0);
            newQuality[type].ppm = prod > 0 ? Math.round((def / prod) * 1000000) : 0;
        }
        setFormData({ ...formData, quality: newQuality });
    };

    const handleDownTimeChange = (key, field, value) => {
        const newDownTime = { ...formData.downTime };
        newDownTime[key] = { ...newDownTime[key], [field]: value };
        // Auto calc total
        if (['hr1', 'hr2', 'hr3', 'hr4'].includes(field)) {
            newDownTime[key].total =
                Number(newDownTime[key].hr1 || 0) +
                Number(newDownTime[key].hr2 || 0) +
                Number(newDownTime[key].hr3 || 0) +
                Number(newDownTime[key].hr4 || 0);
        }
        setFormData({ ...formData, downTime: newDownTime });
    };

    const handleMoralChange = (index, field, value) => {
        const newMoral = [...formData.moral];
        newMoral[index] = { ...newMoral[index], [field]: value };
        setFormData({ ...formData, moral: newMoral });
    };

    const handleDefectDetailChange = (key, idx, field, val) => {
        const newData = [...formData[key]];
        newData[idx] = { ...newData[idx], [field]: val };
        setFormData({ ...formData, [key]: newData });
    };

    const handleManpowerChange = (rowIdx, subRowIdx, colIdx, val) => {
        const newData = [...formData.manpowerAttendance];
        const newRow = { ...newData[rowIdx] };
        newRow.data = [...newRow.data];
        newRow.data[subRowIdx] = [...newRow.data[subRowIdx]];
        newRow.data[subRowIdx][colIdx] = val;

        // If name or code changed, clear auto-fetched status
        if (subRowIdx === 0 || subRowIdx === 1) {
            const newStatusRow = [...(newRow.data[2] || Array(5).fill(""))];
            newStatusRow[colIdx] = "";
            newRow.data[2] = newStatusRow;
        }

        newData[rowIdx] = newRow;
        setFormData({ ...formData, manpowerAttendance: newData });
    };

    const handleKaizenChange = (idx, field, val) => {
        const newData = [...formData.kaizenDetails];
        newData[idx] = { ...newData[idx], [field]: val };
        setFormData({ ...formData, kaizenDetails: newData });
    };

    const handleSubmit = async (submitType = 'save') => {
        if (!selectedDepartment || !selectedLine || !selectedDate || !selectedShift) {
            toast.error("Please select Date, Department, Line, and Shift filters before saving.");
            return;
        }

        const isSubmitAction = submitType === 'submit';

        try {
            const payload = {
                date: selectedDate,
                department: selectedDepartment,
                line: selectedLine,
                shift: selectedShift,
                ...formData,
                isSubmitted: isSubmitAction ? true : formData.isSubmitted
            };
            await saveReport(payload).unwrap();
            toast.success(isSubmitAction ? "Report submitted and email sent!" : "Report saved successfully!");
            refetch();
        } catch (err) {
            toast.error(err?.data?.message || "Failed to save report. Please try again.");
        }
    };

    const handleCheck = async (action) => {
        try {
            await checkReport({
                date: selectedDate,
                department: selectedDepartment,
                line: selectedLine,
                shift: selectedShift,
                action
            }).unwrap();
            toast.success(`Report ${action}d successfully`);
            refetch();
        } catch (err) {
            toast.error(err?.data?.message || `Failed to ${action} report`);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const openEditor = (section) => {
        setEditingSection(section);
        setJsonConfigStr(JSON.stringify(tableConfig[section], null, 2));
        setIsEditing(true);
    };

    const handleSaveConfig = async () => {
        if (!layoutRemark.trim()) {
            toast.error("Please enter a remark detailing your layout changes.");
            return;
        }
        try {
            let parsedSectionConfig;
            try {
                parsedSectionConfig = JSON.parse(jsonConfigStr);
            } catch (e) {
                toast.error("Invalid JSON format", e.message);
                return;
            }

            const updatedConfig = { ...tableConfig, [editingSection]: parsedSectionConfig };
            await saveConfig({ departmentId: selectedDepartment, config: updatedConfig, remark: layoutRemark }).unwrap();

            setTableConfig(updatedConfig);
            setIsEditing(false);
            setLayoutRemark("");
            toast.success("Configuration saved successfully");
        } catch (error) {
            toast.error("Failed to save configuration", error?.data?.message || error.message);
        }
    };

    // Extract selected names for header
    const departmentName = departments.find(d => (d._id || d.id) === selectedDepartment)?.name || "Select Dept";
    const lineName = lines.find(l => (l._id || l.id) === selectedLine)?.name || "Select Line";
    const canEdit = !formData.isSubmitted || isAdmin;

    return (
        <div className="space-y-6 pb-20">
            {/* Top Filter Controls (No Print Area) */}
            <div className="print:hidden space-y-4">
                <div>
                    <h1 className={`text-2xl font-bold tracking-tight ${theme.textMain}`}>
                        Daily Production Report
                    </h1>
                    <p className={`text-sm ${theme.textMuted}`}>
                        Select Department, Line, Date, and Shift to view or manage reports.
                    </p>
                </div>

                <div className={`p-4 rounded-xl border ${theme.border} ${theme.card} shadow-sm flex flex-wrap gap-4 items-end`}>
                    <div className="space-y-1.5 flex-1 min-w-[200px]">
                        <Label>Date</Label>
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-[200px]">
                        <Label>Department</Label>
                        <Select 
                            value={selectedDepartment} 
                            onValueChange={(val) => {
                                setSelectedDepartment(val);
                                setSelectedSection("");
                                setSelectedLine("");
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Department" />
                            </SelectTrigger>
                            <SelectContent>
                                {departments.map((dept) => (
                                    <SelectItem key={dept.id || dept._id} value={dept.id || dept._id}>
                                        {dept.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-[200px]">
                        <Label>Section</Label>
                        <Select 
                            value={selectedSection} 
                            onValueChange={(val) => {
                                setSelectedSection(val);
                                setSelectedLine("");
                            }} 
                            disabled={!selectedDepartment || sectionsFetching}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={sectionsFetching ? "Loading..." : "Select Section"} />
                            </SelectTrigger>
                            <SelectContent>
                                {sections.map((sec) => (
                                    <SelectItem key={sec.id || sec._id} value={sec.id || sec._id}>
                                        {sec.name} ({sec.category})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-[200px]">
                        <Label>Line</Label>
                        <Select value={selectedLine} onValueChange={setSelectedLine} disabled={!selectedSection || linesFetching}>
                            <SelectTrigger>
                                <SelectValue placeholder={linesFetching ? "Loading..." : "Select Line"} />
                            </SelectTrigger>
                            <SelectContent>
                                {lines.map((line) => (
                                    <SelectItem key={line.id || line._id} value={line.id || line._id}>
                                        {line.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-[150px]">
                        <Label>Shift</Label>
                        <Select value={selectedShift} onValueChange={setSelectedShift}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Shift" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="A">A-Shift</SelectItem>
                                <SelectItem value="B">B-Shift</SelectItem>
                                <SelectItem value="C">C-Shift</SelectItem>
                                <SelectItem value="G">G-Shift</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <Button
                            variant="outline"
                            onClick={() => refetch()}
                            disabled={!selectedLine || reportFetching}
                        >
                            <IconRefresh className="w-4 h-4 mr-2" />
                            Reload
                        </Button>
                        <Button onClick={handlePrint}>
                            <IconPrinter className="w-4 h-4 mr-2" />
                            Print
                        </Button>
                        <Button
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-50"
                            onClick={() => exportToExcel("Daily Production Report Sheet", {
                                date: selectedDate,
                                departmentId: selectedDepartment,
                                lineId: selectedLine,
                                shift: selectedShift
                            })}
                            disabled={!selectedLine || reportFetching}
                        >
                            <IconDownload className="w-4 h-4 mr-2" />
                            Export
                        </Button>
                    </div>
                </div>
            </div>

            {/* Daily Summary Table */}
            <div className={`p-4 rounded-xl border ${theme.border} ${theme.card} shadow-sm print:hidden`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                        Daily Report Summary ({selectedDate})
                    </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="text-xs text-gray-500 uppercase font-bold mb-1">Total Reports</div>
                        <div className="text-2xl font-black">{dailyStats.total}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                        <div className="text-xs text-blue-500 uppercase font-bold mb-1">Submitted</div>
                        <div className="text-2xl font-black text-blue-600">{dailyStats.submitted}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                        <div className="text-xs text-green-500 uppercase font-bold mb-1">Approved</div>
                        <div className="text-2xl font-black text-green-600">{dailyStats.approved}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                        <div className="text-xs text-red-500 uppercase font-bold mb-1">Rejected</div>
                        <div className="text-2xl font-black text-red-600">{dailyStats.rejected}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-orange-50 border border-orange-100">
                        <div className="text-xs text-orange-500 uppercase font-bold mb-1">In Draft</div>
                        <div className="text-2xl font-black text-orange-600">{dailyStats.draft}</div>
                    </div>
                </div>
            </div>

            {reportFetching && (
                <div className="flex justify-center p-10 print:hidden">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            )}

            {/* The Complex Reporting Form (Print Area) */}
            {!reportFetching && selectedDepartment && selectedLine && (
                <div className={`overflow-x-auto print:mt-0 print:pt-0`}>
                    {/* Main Table Container mimicking Excel format */}
                    <div className="min-w-[1000px] border-[2px] border-black bg-white text-black p-1 text-[11px] leading-tight font-sans">

                        {/* Header Area */}
                        <div className="flex justify-between items-center mb-1">
                            <div className="font-bold text-xl ml-4">
                                Daily Production Report ({departmentName})
                            </div>
                            <div>
                                <img src="/fme_transparent.png" alt="Logo" className="h-8 max-w-[150px] object-contain" />
                            </div>
                        </div>

                        {/* Top Meta Data Table */}
                        <table className="w-full border-collapse border border-black mb-1">
                            <tbody>
                                <tr>
                                    <td className="border border-black p-1 font-bold w-1/4">
                                        Line Name- {lineName}
                                    </td>
                                    <td className="border border-black p-1 font-bold w-1/4">
                                        leader Name- <input type="text" disabled={!canEdit} className="w-32 bg-transparent outline-none border-none border-b border-gray-400 disabled:opacity-70" value={formData.leaderName} onChange={e => setFormData({ ...formData, leaderName: e.target.value })} />
                                    </td>
                                    <td className="border border-black p-1 font-bold w-1/4">
                                        Shift- {selectedShift}
                                    </td>
                                    <td className="border border-black p-1 font-bold w-1/4">
                                        Date- {selectedDate}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Delivery & Quality Sections Side-by-Side */}
                        <div className="flex w-full mb-1">

                            {/* Delivery Table (Left) */}
                            <div className="w-[70%] border-r-[2px] border-black pr-1">
                                <div className="flex justify-between items-center bg-blue-100 border border-black pr-1">
                                    <div className="flex-1 text-center font-bold text-sm py-1">
                                        {tableConfig?.delivery?.title || "Delivery (Schedule Adherence)"}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 print:hidden"
                                        onClick={() => openEditor('delivery')}
                                        disabled={!tableConfig || !canEdit}
                                    >
                                        <IconSettings className="w-3 h-3" />
                                    </Button>
                                </div>
                                <table className="w-full border-collapse border border-black text-center mt-1">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            {(tableConfig?.delivery?.headers || [
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
                                            ]).map((h, i) => (
                                                <th key={i} className={`border border-black p-1 ${h.width || ''}`} dangerouslySetInnerHTML={{ __html: h.text }}></th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.delivery.map((row, idx) => (
                                            <tr key={idx} className="h-6">
                                                <td className="border border-black p-0">{idx + 1}</td>
                                                <td className="border border-black p-0"><TextCell value={row.wHCode} onChange={(v) => handleDeliveryChange(idx, 'wHCode', v)} textAlign="center" disabled={!canEdit} /></td>
                                                <td className="border border-black p-0"><NumberCell value={row.plan} onChange={(v) => handleDeliveryChange(idx, 'plan', v)} disabled={!canEdit} /></td>
                                                <td className="border border-black p-0"><TextCell value={row.lotNo} onChange={(v) => handleDeliveryChange(idx, 'lotNo', v)} textAlign="center" disabled={!canEdit} /></td>
                                                <td className="border border-black p-0"><TextCell value={row.startTime} onChange={(v) => handleDeliveryChange(idx, 'startTime', v)} textAlign="center" disabled={!canEdit} /></td>
                                                <td className="border border-black p-0"><NumberCell value={row.hr1} onChange={(v) => handleDeliveryChange(idx, 'hr1', v)} disabled={!canEdit} /></td>
                                                <td className="border border-black p-0"><NumberCell value={row.hr2} onChange={(v) => handleDeliveryChange(idx, 'hr2', v)} disabled={!canEdit} /></td>
                                                <td className="border border-black p-0"><NumberCell value={row.hr3} onChange={(v) => handleDeliveryChange(idx, 'hr3', v)} disabled={!canEdit} /></td>
                                                <td className="border border-black p-0"><NumberCell value={row.hr4} onChange={(v) => handleDeliveryChange(idx, 'hr4', v)} disabled={!canEdit} /></td>
                                                <td className="border border-black p-0 font-bold bg-gray-50">{row.total}</td>
                                            </tr>
                                        ))}
                                        {/* Delivery Total Row */}
                                        <tr className="h-6 font-bold bg-gray-100">
                                            <td colSpan={2} className="border border-black p-1 text-right">Total</td>
                                            <td className="border border-black p-1 text-center">
                                                {formData.delivery.reduce((sum, r) => sum + (r.plan || 0), 0)}
                                            </td>
                                            <td colSpan={2} className="border border-black p-1 bg-white"></td>
                                            <td className="border border-black p-1 text-center">{formData.delivery.reduce((sum, r) => sum + (r.hr1 || 0), 0)}</td>
                                            <td className="border border-black p-1 text-center">{formData.delivery.reduce((sum, r) => sum + (r.hr2 || 0), 0)}</td>
                                            <td className="border border-black p-1 text-center">{formData.delivery.reduce((sum, r) => sum + (r.hr3 || 0), 0)}</td>
                                            <td className="border border-black p-1 text-center">{formData.delivery.reduce((sum, r) => sum + (r.hr4 || 0), 0)}</td>
                                            <td className="border border-black p-1 text-center">{formData.delivery.reduce((sum, r) => sum + (r.total || 0), 0)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Quality Table (Right) */}
                            <div className="w-[30%] pl-1">
                                <div className="flex justify-between items-center bg-blue-100 border border-black pr-1">
                                    <div className="flex-1 text-center font-bold text-sm py-1">
                                        {tableConfig?.quality?.title || "Quality (Defect Summary)"}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 print:hidden"
                                        onClick={() => openEditor('quality')}
                                        disabled={!tableConfig || !canEdit}
                                    >
                                        <IconSettings className="w-3 h-3" />
                                    </Button>
                                </div>
                                <table className="w-full border-collapse border border-black mt-1 text-left">
                                    <tbody>
                                        <tr>
                                            <th colSpan={2} className="border border-black p-1 bg-gray-100">Customer End Defect</th>
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-1">Production Qty.</td>
                                            <td className="border border-black p-0 w-20"><NumberCell value={formData.quality.customerEndDefect.productionQty} onChange={(v) => handleQualityChange('customerEndDefect', 'productionQty', v)} disabled={!canEdit} /></td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-1">Defect Qty.</td>
                                            <td className="border border-black p-0 w-20"><NumberCell value={formData.quality.customerEndDefect.defectQty} onChange={(v) => handleQualityChange('customerEndDefect', 'defectQty', v)} disabled={!canEdit} /></td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-1">PPM</td>
                                            <td className="border border-black p-1 text-center bg-gray-50">{formData.quality.customerEndDefect.ppm}</td>
                                        </tr>
                                        <tr>
                                            <th colSpan={2} className="border border-black p-1 bg-gray-100 mt-2">Internal Defect</th>
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-1">Production Qty.</td>
                                            <td className="border border-black p-0 w-20"><NumberCell value={formData.quality.internalDefect.productionQty} onChange={(v) => handleQualityChange('internalDefect', 'productionQty', v)} disabled={!canEdit} /></td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-1">Defect Qty.</td>
                                            <td className="border border-black p-0 w-20"><NumberCell value={formData.quality.internalDefect.defectQty} onChange={(v) => handleQualityChange('internalDefect', 'defectQty', v)} disabled={!canEdit} /></td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-1">PPM</td>
                                            <td className="border border-black p-1 text-center bg-gray-50">{formData.quality.internalDefect.ppm}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Bottom Section: DownTime + Comm + Moral */}
                        <div className="flex w-full">

                            {/* DownTime Summary (Left spanning roughly half) */}
                            <div className="w-[55%] border-r-[2px] border-black pr-1 flex flex-col">
                                <div className="flex justify-between items-center bg-blue-100 border border-black pr-1">
                                    <div className="flex-1 text-center font-bold text-sm py-1">
                                        {tableConfig?.downTime?.title || "Down Time Summary"}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 print:hidden"
                                        onClick={() => openEditor('downTime')}
                                        disabled={!tableConfig || !canEdit}
                                    >
                                        <IconSettings className="w-3 h-3" />
                                    </Button>
                                </div>
                                <table className="w-full border-collapse border border-black mt-1 text-[10px]">
                                    <thead>
                                        <tr className="bg-gray-100 text-center text-[9px]">
                                            {(tableConfig?.downTime?.headers || [
                                                { text: "Down Time :", colSpan: 2 },
                                                { text: "1st 2 Hrs", width: "w-10" },
                                                { text: "2nd 2 Hrs", width: "w-10" },
                                                { text: "3rd 2 Hrs", width: "w-10" },
                                                { text: "4th 2 Hrs", width: "w-10" },
                                                { text: "Total", width: "w-10" }
                                            ]).map((h, i) => (
                                                <th key={i} className={`border border-black p-0.5 ${h.width || ''}`} colSpan={h.colSpan || 1} dangerouslySetInnerHTML={{ __html: h.text }}></th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Render standard down time rows. Extracting a unified row render function for brevity */}
                                        {(() => {
                                            const DownTimeRow = ({ label, objKey, colSpan = 2 }) => (
                                                <tr className="h-[18px]">
                                                    <td className="border border-black px-1" colSpan={colSpan}>{label}</td>
                                                    <td className="border border-black p-0"><NumberCell value={formData.downTime[objKey].hr1} onChange={(v) => handleDownTimeChange(objKey, 'hr1', v)} disabled={!canEdit} /></td>
                                                    <td className="border border-black p-0"><NumberCell value={formData.downTime[objKey].hr2} onChange={(v) => handleDownTimeChange(objKey, 'hr2', v)} disabled={!canEdit} /></td>
                                                    <td className="border border-black p-0"><NumberCell value={formData.downTime[objKey].hr3} onChange={(v) => handleDownTimeChange(objKey, 'hr3', v)} disabled={!canEdit} /></td>
                                                    <td className="border border-black p-0"><NumberCell value={formData.downTime[objKey].hr4} onChange={(v) => handleDownTimeChange(objKey, 'hr4', v)} disabled={!canEdit} /></td>
                                                    <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime[objKey].total}</td>
                                                </tr>
                                            );

                                            return (
                                                <>
                                                    <DownTimeRow label="Circuits shortage from Charging" objKey="circuitsShortageFromCharging" />
                                                    <DownTimeRow label="Components shortage from store" objKey="componentsShortageFromStore" />
                                                    <DownTimeRow label="Tube shortage" objKey="tubeShortage" />
                                                    <DownTimeRow label="Changeover time" objKey="changeoverTime" />
                                                    <DownTimeRow label="Quality issues from C&C" objKey="qualityIssuesFromCC" />
                                                    <DownTimeRow label="Quality issues in assembly" objKey="qualityIssuesInAssembly" />

                                                    {/* Nested Inspection Delays */}
                                                    <tr>
                                                        <td className="border border-black px-1 w-24" rowSpan={3}>Delay in Inspection</td>
                                                        <td className="border border-black px-1">Dim</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionDim.hr1} onChange={(v) => handleDownTimeChange('delayInInspectionDim', 'hr1', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionDim.hr2} onChange={(v) => handleDownTimeChange('delayInInspectionDim', 'hr2', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionDim.hr3} onChange={(v) => handleDownTimeChange('delayInInspectionDim', 'hr3', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionDim.hr4} onChange={(v) => handleDownTimeChange('delayInInspectionDim', 'hr4', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.delayInInspectionDim.total}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black px-1">ECT</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionECT.hr1} onChange={(v) => handleDownTimeChange('delayInInspectionECT', 'hr1', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionECT.hr2} onChange={(v) => handleDownTimeChange('delayInInspectionECT', 'hr2', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionECT.hr3} onChange={(v) => handleDownTimeChange('delayInInspectionECT', 'hr3', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionECT.hr4} onChange={(v) => handleDownTimeChange('delayInInspectionECT', 'hr4', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.delayInInspectionECT.total}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black px-1">Visual</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionVisual.hr1} onChange={(v) => handleDownTimeChange('delayInInspectionVisual', 'hr1', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionVisual.hr2} onChange={(v) => handleDownTimeChange('delayInInspectionVisual', 'hr2', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionVisual.hr3} onChange={(v) => handleDownTimeChange('delayInInspectionVisual', 'hr3', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionVisual.hr4} onChange={(v) => handleDownTimeChange('delayInInspectionVisual', 'hr4', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.delayInInspectionVisual.total}</td>
                                                    </tr>

                                                    {/* Nested Machine Breakdown */}
                                                    <tr>
                                                        <td className="border border-black px-1" rowSpan={7}>Machine Under Break Down</td>
                                                        <td className="border border-black px-1">CPG</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownCPG.hr1} onChange={(v) => handleDownTimeChange('machineBreakDownCPG', 'hr1', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownCPG.hr2} onChange={(v) => handleDownTimeChange('machineBreakDownCPG', 'hr2', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownCPG.hr3} onChange={(v) => handleDownTimeChange('machineBreakDownCPG', 'hr3', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownCPG.hr4} onChange={(v) => handleDownTimeChange('machineBreakDownCPG', 'hr4', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.machineBreakDownCPG.total}</td>
                                                    </tr>
                                                    <tr><td className="border border-black px-1">Conveyor</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownConveyor.hr1} onChange={(v) => handleDownTimeChange('machineBreakDownConveyor', 'hr1', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownConveyor.hr2} onChange={(v) => handleDownTimeChange('machineBreakDownConveyor', 'hr2', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownConveyor.hr3} onChange={(v) => handleDownTimeChange('machineBreakDownConveyor', 'hr3', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownConveyor.hr4} onChange={(v) => handleDownTimeChange('machineBreakDownConveyor', 'hr4', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.machineBreakDownConveyor.total}</td>
                                                    </tr>
                                                    <tr><td className="border border-black px-1">Torque Tight</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownTorqueTight.hr1} onChange={(v) => handleDownTimeChange('machineBreakDownTorqueTight', 'hr1', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownTorqueTight.hr2} onChange={(v) => handleDownTimeChange('machineBreakDownTorqueTight', 'hr2', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownTorqueTight.hr3} onChange={(v) => handleDownTimeChange('machineBreakDownTorqueTight', 'hr3', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownTorqueTight.hr4} onChange={(v) => handleDownTimeChange('machineBreakDownTorqueTight', 'hr4', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.machineBreakDownTorqueTight.total}</td>
                                                    </tr>
                                                    <tr><td className="border border-black px-1">Grease Insert</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownGreaseInsert.hr1} onChange={(v) => handleDownTimeChange('machineBreakDownGreaseInsert', 'hr1', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownGreaseInsert.hr2} onChange={(v) => handleDownTimeChange('machineBreakDownGreaseInsert', 'hr2', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownGreaseInsert.hr3} onChange={(v) => handleDownTimeChange('machineBreakDownGreaseInsert', 'hr3', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownGreaseInsert.hr4} onChange={(v) => handleDownTimeChange('machineBreakDownGreaseInsert', 'hr4', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.machineBreakDownGreaseInsert.total}</td>
                                                    </tr>
                                                    <tr><td className="border border-black px-1">F/A Board</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownFABoard.hr1} onChange={(v) => handleDownTimeChange('machineBreakDownFABoard', 'hr1', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownFABoard.hr2} onChange={(v) => handleDownTimeChange('machineBreakDownFABoard', 'hr2', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownFABoard.hr3} onChange={(v) => handleDownTimeChange('machineBreakDownFABoard', 'hr3', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownFABoard.hr4} onChange={(v) => handleDownTimeChange('machineBreakDownFABoard', 'hr4', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.machineBreakDownFABoard.total}</td>
                                                    </tr>
                                                    <tr><td className="border border-black px-1">A/B Crimping</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownABCrimping.hr1} onChange={(v) => handleDownTimeChange('machineBreakDownABCrimping', 'hr1', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownABCrimping.hr2} onChange={(v) => handleDownTimeChange('machineBreakDownABCrimping', 'hr2', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownABCrimping.hr3} onChange={(v) => handleDownTimeChange('machineBreakDownABCrimping', 'hr3', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownABCrimping.hr4} onChange={(v) => handleDownTimeChange('machineBreakDownABCrimping', 'hr4', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.machineBreakDownABCrimping.total}</td>
                                                    </tr>
                                                    <tr><td className="border border-black px-1">Gromett</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownGromett.hr1} onChange={(v) => handleDownTimeChange('machineBreakDownGromett', 'hr1', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownGromett.hr2} onChange={(v) => handleDownTimeChange('machineBreakDownGromett', 'hr2', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownGromett.hr3} onChange={(v) => handleDownTimeChange('machineBreakDownGromett', 'hr3', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownGromett.hr4} onChange={(v) => handleDownTimeChange('machineBreakDownGromett', 'hr4', v)} disabled={!canEdit} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.machineBreakDownGromett.total}</td>
                                                    </tr>

                                                    <DownTimeRow label="Test paper for skill evaluation" objKey="testPaperForSkillEvaluation" />
                                                    <DownTimeRow label="Meeting Time/Training Time" objKey="meetingTimeTrainingTime" />
                                                    <DownTimeRow label="Plan Not Available" objKey="planNotAvailable" />

                                                    {/* Total Row */}
                                                    <tr className="bg-gray-100 font-bold h-[20px]">
                                                        <td className="border border-black px-1 text-center" colSpan={2}>Total</td>
                                                        <td className="border border-black text-center">{Object.values(formData.downTime).reduce((s, o) => s + (o.hr1 || 0), 0)}</td>
                                                        <td className="border border-black text-center">{Object.values(formData.downTime).reduce((s, o) => s + (o.hr2 || 0), 0)}</td>
                                                        <td className="border border-black text-center">{Object.values(formData.downTime).reduce((s, o) => s + (o.hr3 || 0), 0)}</td>
                                                        <td className="border border-black text-center">{Object.values(formData.downTime).reduce((s, o) => s + (o.hr4 || 0), 0)}</td>
                                                        <td className="border border-black text-center">{Object.values(formData.downTime).reduce((s, o) => s + (o.total || 0), 0)}</td>
                                                    </tr>
                                                </>
                                            );
                                        })()}

                                    </tbody>
                                </table>
                            </div>

                            {/* Right Side container for Shift Communication & Moral */}
                            <div className="w-[45%] pl-1 flex flex-col pt-1">

                                {/* Shift Communication */}
                                <div className="flex justify-between items-center bg-blue-100 border border-black pr-1">
                                    <div className="flex-1 text-center font-bold text-sm py-1">
                                        {tableConfig?.shiftComm?.title || "Shift Communication"}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 print:hidden"
                                        onClick={() => openEditor('shiftComm')}
                                        disabled={!tableConfig || !canEdit}
                                    >
                                        <IconSettings className="w-3 h-3" />
                                    </Button>
                                </div>
                                <table className="w-full border-collapse border border-black text-center mb-1 text-[10px]">
                                    <thead>
                                        <tr className="bg-gray-100 h-5">
                                            <th className="border border-black" colSpan={2}>
                                                {tableConfig?.shiftComm?.headerText || "Previous shift issues and general information during start up :"}
                                            </th>
                                        </tr>
                                        <tr className="bg-gray-100 h-5">
                                            <th className="border border-black w-10">Sr. No.</th>
                                            <th className="border border-black">Issues and Information</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.shiftCommunication.map((item, idx) => (
                                            <tr key={idx} className="h-6">
                                                <td className="border border-black">{idx + 1}</td>
                                                <td className="border border-black p-0">
                                                    <TextCell value={item.issue} disabled={!canEdit} onChange={(v) => {
                                                        const newComm = [...formData.shiftCommunication];
                                                        newComm[idx] = { issue: v };
                                                        setFormData({ ...formData, shiftCommunication: newComm });
                                                    }} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Moral (Manpower Summary) */}
                                <div className="flex justify-between items-center bg-blue-100 border border-black pr-1 mt-1">
                                    <div className="flex-1 text-center font-bold text-sm py-1">
                                        {tableConfig?.moral?.title || "Moral (Manpower Summary)"}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 print:hidden"
                                        onClick={() => openEditor('moral')}
                                        disabled={!tableConfig || !canEdit}
                                    >
                                        <IconSettings className="w-3 h-3" />
                                    </Button>
                                </div>
                                <table className="w-full border-collapse border border-black text-[10px] mt-1 text-center">
                                    <thead>
                                        <tr className="bg-gray-100 h-5">
                                            {(tableConfig?.moral?.headers || [
                                                { text: "Sr. No.", width: "w-8" },
                                                { text: "Process" },
                                                { text: "Section Count", width: "w-16" },
                                                { text: "Present", width: "w-12" },
                                                { text: "Absent", width: "w-12" },
                                                { text: "Present (2)", width: "w-12" }
                                            ]).map((h, i) => (
                                                <th key={i} className={`border border-black ${h.width || ''}`} dangerouslySetInnerHTML={{ __html: h.text }}></th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.moral.map((item, idx) => (
                                            <tr key={idx} className="h-[14px]">
                                                <td className="border border-black">{idx + 1}</td>
                                                <td className="border border-black text-left px-1">{item.process}</td>
                                                <td className="border border-black p-0"><NumberCell value={item.handover} onChange={(v) => handleMoralChange(idx, 'handover', v)} disabled={!canEdit} /></td>
                                                <td className="border border-black p-0"><NumberCell value={item.present} onChange={(v) => handleMoralChange(idx, 'present', v)} disabled={!canEdit} /></td>
                                                <td className="border border-black p-0 text-red-600"><NumberCell value={item.absent} onChange={(v) => handleMoralChange(idx, 'absent', v)} disabled={!canEdit} /></td>
                                                <td className="border border-black p-0 text-blue-600"><NumberCell value={item.present2} onChange={(v) => handleMoralChange(idx, 'present2', v)} disabled={!canEdit} /></td>
                                            </tr>
                                        ))}
                                        <tr className="bg-gray-100 font-bold h-[20px]">
                                            <td className="border border-black" colSpan={2}>Total</td>
                                            <td className="border border-black bg-white"></td>
                                            <td className="border border-black">{formData.moral.reduce((s, i) => s + (i.present || 0), 0)}</td>
                                            <td className="border border-black text-red-600">{formData.moral.reduce((s, i) => s + (i.absent || 0), 0)}</td>
                                            <td className="border border-black text-blue-600">{formData.moral.reduce((s, i) => s + (i.present2 || 0), 0)}</td>
                                        </tr>
                                    </tbody>
                                </table>

                            </div>

                        </div>

                        {/* Direct Efficiency Section */}
                        <div className="flex justify-between items-center bg-blue-100 border border-black pr-1 mt-1">
                            <div className="flex-1 text-center font-bold text-sm py-1">
                                {tableConfig?.footer?.efficiencyTitle || "Direct Efficiency"}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 print:hidden"
                                onClick={() => openEditor('footer')}
                                disabled={!tableConfig || !canEdit}
                            >
                                <IconSettings className="w-3 h-3" />
                            </Button>
                        </div>
                        <table className="w-full border-collapse border border-black font-bold mt-1 text-[11px]">
                            <tbody>
                                <tr>
                                    <td className="border border-black p-1 text-center w-[50%]">Direct Efficiency</td>
                                    <td className="border border-black p-0 w-[25%] bg-gray-100 text-center border-b">Target</td>
                                    <td className="border border-black p-0 w-[25%] border-b"><NumberCell value={formData.directEfficiency.target} onChange={(v) => setFormData({ ...formData, directEfficiency: { ...formData.directEfficiency, target: v } })} disabled={!canEdit} /></td>
                                </tr>
                                <tr>
                                    <td className="border border-transparent"></td>
                                    <td className="border border-black p-0 bg-gray-100 text-center">Actual</td>
                                    <td className="border border-black p-0"><NumberCell value={formData.directEfficiency.actual} onChange={(v) => setFormData({ ...formData, directEfficiency: { ...formData.directEfficiency, actual: v } })} disabled={!canEdit} /></td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Defect Detail Tables (Now in the Middle) */}
                        <div className="w-full mt-1">
                        <DefectDetailSection 
                                title="Customer End Defect Detail" 
                                data={formData.customerEndDefectDetails} 
                                onChange={(idx, field, val) => handleDefectDetailChange('customerEndDefectDetails', idx, field, val)} 
                                disabled={!canEdit}
                            />
                            <DefectDetailSection 
                                title="Internal Defect Detail:" 
                                data={formData.internalDefectDetails} 
                                onChange={(idx, field, val) => handleDefectDetailChange('internalDefectDetails', idx, field, val)} 
                                disabled={!canEdit}
                            />
                        </div>

                        {/* Manpower Attendance Summary */}
                        <ManpowerAttendanceSection 
                            data={formData.manpowerAttendance}
                            onChange={handleManpowerChange}
                            disabled={!canEdit}
                            navigate={navigate}
                            date={selectedDate}
                            shift={selectedShift}
                        />

                        {/* Kaizen Details (New) */}
                        <KaizenSection 
                            data={formData.kaizenDetails}
                            onChange={handleKaizenChange}
                            disabled={!canEdit}
                        />

                        {/* Signatures Section (Now at the Bottom) */}
                        <div className="flex justify-between items-center bg-blue-100 border border-black pr-1 mt-2">
                            <div className="flex-1 text-center font-bold text-sm py-1">
                                {tableConfig?.footer?.signatureTitle || "Approvals & Signatures"}
                            </div>
                        </div>
                        <table className="w-full border-collapse border border-black font-bold mt-1 text-[11px]">
                            <tbody>
                                <tr>
                                    <td className="border border-black p-1 text-right pr-4 bg-gray-100 w-[40%]">{tableConfig?.footer?.madeByLabel || "Made By (Line Leader):"}</td>
                                    <td className="border border-black p-0 w-[60%]">
                                        <TextCell 
                                            value={formData.madeBy || (formData.isSubmitted ? "..." : "")} 
                                            onChange={(v) => setFormData({ ...formData, madeBy: v })} 
                                            disabled={!canEdit} 
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-1 text-right pr-4 bg-gray-100">{tableConfig?.footer?.checkedByLabel || "Checked By (Shift Incharge):"}</td>
                                    <td className="border border-black p-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold">
                                                {formData.checkedBy || "Pending Approval"}
                                            </span>
                                            {formData.isSubmitted && formData.status === 'SUBMITTED' && canApprove && (
                                                <div className="flex gap-2 print:hidden">
                                                    <Button 
                                                        size="xs" 
                                                        className="h-7 bg-green-600 hover:bg-green-700 text-white text-[10px]"
                                                        onClick={() => handleCheck('approve')}
                                                        disabled={isChecking}
                                                    >
                                                        Approve
                                                    </Button>
                                                    <Button 
                                                        size="xs" 
                                                        variant="destructive"
                                                        className="h-7 text-[10px]"
                                                        onClick={() => handleCheck('reject')}
                                                        disabled={isChecking}
                                                    >
                                                        Reject
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Official Form Footer */}
                        <FormFooter />

                    </div>

                    <div className="mt-6 flex justify-between items-center print:hidden">
                        <div className="flex gap-2 items-center">
                            {formData.status && (
                                <div className={`px-4 py-2 rounded-full font-bold text-sm ${
                                    formData.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                    formData.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                    formData.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-700'
                                }`}>
                                    Status: {formData.status}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <Button 
                                variant="outline" 
                                size="lg" 
                                onClick={() => handleSubmit('save')} 
                                disabled={isSaving || !canEdit || formData.status === 'APPROVED'}
                            >
                                {isSaving ? (
                                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2"></div>
                                ) : (
                                    <IconSave className="w-5 h-5 mr-2" />
                                )}
                                Save as Draft
                            </Button>

                            <Button 
                                size="lg" 
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => handleSubmit('submit')} 
                                disabled={isSaving || !canEdit || formData.status === 'APPROVED'}
                            >
                                {isSaving ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                ) : (
                                    <IconDownload className="w-5 h-5 mr-2" />
                                )}
                                {formData.isSubmitted ? "Update & Resubmit" : "Submit & Send Email"}
                            </Button>
                        </div>
                    </div>

                </div>
            )}

            {!reportFetching && (!selectedDepartment || !selectedLine) && (
                <div className={`text-center p-12 mt-6 rounded-xl border border-dashed ${theme.border} ${theme.card}`}>
                    <IconRefresh className="mx-auto w-12 h-12 text-gray-400 mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Filters Required</h3>
                    <p className="text-gray-500 max-w-sm mx-auto">
                        Please select a Department and Line above to view or start filling out today's production report.
                    </p>
                </div>
            )}

            {/* Template Editor Dialog */}
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogContent className="max-w-[800px] max-h-[90vh] flex flex-col bg-white">
                    <DialogHeader>
                        <DialogTitle>
                            Edit {editingSection ? editingSection.charAt(0).toUpperCase() + editingSection.slice(1) : "Section"} Template
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto p-1 space-y-4">
                        <Textarea
                            className="font-mono text-xs h-[400px]"
                            value={jsonConfigStr}
                            onChange={(e) => setJsonConfigStr(e.target.value)}
                        />
                        <div className="space-y-2">
                            <Label htmlFor="remark">Remark (Required)</Label>
                            <Input
                                id="remark"
                                placeholder="Describe the changes made to the template..."
                                value={layoutRemark}
                                onChange={(e) => setLayoutRemark(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex justify-between">
                        <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                        <Button onClick={handleSaveConfig} disabled={!layoutRemark.trim() || isSavingConfig}>
                            {isSavingConfig ? "Saving..." : "Save Template"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
};

export default DailyProductionReport;
