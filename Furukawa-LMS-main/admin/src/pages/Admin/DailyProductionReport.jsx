import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
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
import { useGetLinesByDepartmentQuery } from "@/Redux/AllApi/LineApi";
import {
    useGetDailyProductionReportQuery,
    useSaveDailyProductionReportMutation,
    useGetDPRConfigQuery,
    useSaveDPRConfigMutation,
    useGetDPRConfigHistoryQuery,
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

const NumberCell = ({ value, onChange, disabled }) => (
    <input
        type="number"
        value={value === 0 ? "" : value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-full text-center outline-none bg-transparent"
        min="0"
    />
);

const TextCell = ({ value, onChange, disabled, textAlign = 'left' }) => (
    <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full h-full text-${textAlign} px-1 outline-none bg-transparent`}
    />
);

const emptyDeliveryRow = { wHCode: "", plan: 0, lotNo: "", startTime: "", hr1: 0, hr2: 0, hr3: 0, hr4: 0, hr5: 0, total: 0 };

const DailyProductionReport = () => {
    const { theme } = useSelector((state) => state.theme);

    // Filter State
    const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [selectedDepartment, setSelectedDepartment] = useState("");
    const [selectedLine, setSelectedLine] = useState("");
    const [selectedShift, setSelectedShift] = useState("A");

    // Options Data
    const { data: deptData } = useGetAllDepartmentsQuery({ limit: 100 });
    const departments = deptData?.data?.departments || [];

    const { data: lineData, isFetching: linesFetching } = useGetLinesByDepartmentQuery(
        selectedDepartment,
        { skip: !selectedDepartment }
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
        madeBy: "",
        checkedBy: ""
    };

    const [formData, setFormData] = useState(defaultFormData);

    // Template Configuration State
    const [tableConfig, setTableConfig] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editingSection, setEditingSection] = useState(null); // 'delivery', 'quality', etc.
    const [jsonConfigStr, setJsonConfigStr] = useState("");
    const [layoutRemark, setLayoutRemark] = useState("");
    const [isViewingHistory, setIsViewingHistory] = useState(false);

    // Fetch Config Query
    const { data: configResp, isFetching: configFetching } = useGetDPRConfigQuery(
        selectedDepartment,
        { skip: !selectedDepartment }
    );

    // Mutation
    const [saveConfig, { isLoading: isSavingConfig }] = useSaveDPRConfigMutation();

    useEffect(() => {
        if (configResp?.data?.config) {
            setTableConfig(configResp.data.config);
        }
    }, [configResp]);

    // Fetch Report Query
    const { data: reportResp, isFetching: reportFetching, refetch } = useGetDailyProductionReportQuery(
        { date: selectedDate, department: selectedDepartment, line: selectedLine, shift: selectedShift },
        { skip: !selectedDate || !selectedDepartment || !selectedLine || !selectedShift }
    );

    // Mutation
    const [saveReport, { isLoading: isSaving }] = useSaveDailyProductionReportMutation();

    // Populate form data on fetch
    useEffect(() => {
        if (reportResp?.data) {
            // Merge fetched data with defaults to ensure all arrays/objects exist
            const loadedData = reportResp.data;

            // Pad arrays if they don't have enough entries
            const deliveryCount = tableConfig?.delivery?.rows || 6;
            const paddedDelivery = [...(loadedData.delivery || [])];
            while (paddedDelivery.length < deliveryCount) paddedDelivery.push({ ...emptyDeliveryRow });

            const paddedShiftComm = [...(loadedData.shiftCommunication || [])];
            const shiftCommCount = tableConfig?.shiftComm?.rows || 3;
            while (paddedShiftComm.length < shiftCommCount) paddedShiftComm.push({ issue: "" });

            // Merge moral carefully or just trust the loaded data if it exists
            const moralRows = tableConfig?.moral?.rows || defaultFormData.moral;
            const mergedMoral = moralRows.map((defItem, idx) => {
                return (loadedData.moral && loadedData.moral[idx]) ? loadedData.moral[idx] : { ...defItem, handover: "", present: 0, absent: 0, present2: 0 };
            });

            setFormData({
                ...defaultFormData,
                ...loadedData,
                delivery: paddedDelivery,
                shiftCommunication: paddedShiftComm,
                moral: mergedMoral
            });
        } else {
            setFormData(defaultFormData);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportResp]);

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

    const handleSubmit = async () => {
        if (!selectedDepartment || !selectedLine || !selectedDate || !selectedShift) {
            toast.error("Please select Date, Department, Line, and Shift filters before saving.");
            return;
        }
        try {
            const payload = {
                date: selectedDate,
                department: selectedDepartment,
                line: selectedLine,
                shift: selectedShift,
                ...formData
            };
            await saveReport(payload).unwrap();
            toast.success("Report saved successfully!");
            refetch();
        } catch (err) {
            toast.error(err?.data?.message || "Failed to save report. Please try again.");
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
                        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
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
                        <Label>Line</Label>
                        <Select value={selectedLine} onValueChange={setSelectedLine} disabled={!selectedDepartment || linesFetching}>
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
                                        leader Name- <input type="text" className="w-32 bg-transparent outline-none border-none border-b border-gray-400" value={formData.leaderName} onChange={e => setFormData({ ...formData, leaderName: e.target.value })} />
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
                                        disabled={!tableConfig}
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
                                                <td className="border border-black p-0"><TextCell value={row.wHCode} onChange={(v) => handleDeliveryChange(idx, 'wHCode', v)} textAlign="center" /></td>
                                                <td className="border border-black p-0"><NumberCell value={row.plan} onChange={(v) => handleDeliveryChange(idx, 'plan', v)} /></td>
                                                <td className="border border-black p-0"><TextCell value={row.lotNo} onChange={(v) => handleDeliveryChange(idx, 'lotNo', v)} textAlign="center" /></td>
                                                <td className="border border-black p-0"><TextCell value={row.startTime} onChange={(v) => handleDeliveryChange(idx, 'startTime', v)} textAlign="center" /></td>
                                                <td className="border border-black p-0"><NumberCell value={row.hr1} onChange={(v) => handleDeliveryChange(idx, 'hr1', v)} /></td>
                                                <td className="border border-black p-0"><NumberCell value={row.hr2} onChange={(v) => handleDeliveryChange(idx, 'hr2', v)} /></td>
                                                <td className="border border-black p-0"><NumberCell value={row.hr3} onChange={(v) => handleDeliveryChange(idx, 'hr3', v)} /></td>
                                                <td className="border border-black p-0"><NumberCell value={row.hr4} onChange={(v) => handleDeliveryChange(idx, 'hr4', v)} /></td>
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
                                        disabled={!tableConfig}
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
                                            <td className="border border-black p-0 w-20"><NumberCell value={formData.quality.customerEndDefect.productionQty} onChange={(v) => handleQualityChange('customerEndDefect', 'productionQty', v)} /></td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-1">Defect Qty.</td>
                                            <td className="border border-black p-0 w-20"><NumberCell value={formData.quality.customerEndDefect.defectQty} onChange={(v) => handleQualityChange('customerEndDefect', 'defectQty', v)} /></td>
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
                                            <td className="border border-black p-0 w-20"><NumberCell value={formData.quality.internalDefect.productionQty} onChange={(v) => handleQualityChange('internalDefect', 'productionQty', v)} /></td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-1">Defect Qty.</td>
                                            <td className="border border-black p-0 w-20"><NumberCell value={formData.quality.internalDefect.defectQty} onChange={(v) => handleQualityChange('internalDefect', 'defectQty', v)} /></td>
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
                                        disabled={!tableConfig}
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
                                                    <td className="border border-black p-0"><NumberCell value={formData.downTime[objKey].hr1} onChange={(v) => handleDownTimeChange(objKey, 'hr1', v)} /></td>
                                                    <td className="border border-black p-0"><NumberCell value={formData.downTime[objKey].hr2} onChange={(v) => handleDownTimeChange(objKey, 'hr2', v)} /></td>
                                                    <td className="border border-black p-0"><NumberCell value={formData.downTime[objKey].hr3} onChange={(v) => handleDownTimeChange(objKey, 'hr3', v)} /></td>
                                                    <td className="border border-black p-0"><NumberCell value={formData.downTime[objKey].hr4} onChange={(v) => handleDownTimeChange(objKey, 'hr4', v)} /></td>
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
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionDim.hr1} onChange={(v) => handleDownTimeChange('delayInInspectionDim', 'hr1', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionDim.hr2} onChange={(v) => handleDownTimeChange('delayInInspectionDim', 'hr2', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionDim.hr3} onChange={(v) => handleDownTimeChange('delayInInspectionDim', 'hr3', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionDim.hr4} onChange={(v) => handleDownTimeChange('delayInInspectionDim', 'hr4', v)} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.delayInInspectionDim.total}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black px-1">ECT</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionECT.hr1} onChange={(v) => handleDownTimeChange('delayInInspectionECT', 'hr1', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionECT.hr2} onChange={(v) => handleDownTimeChange('delayInInspectionECT', 'hr2', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionECT.hr3} onChange={(v) => handleDownTimeChange('delayInInspectionECT', 'hr3', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionECT.hr4} onChange={(v) => handleDownTimeChange('delayInInspectionECT', 'hr4', v)} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.delayInInspectionECT.total}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black px-1">Visual</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionVisual.hr1} onChange={(v) => handleDownTimeChange('delayInInspectionVisual', 'hr1', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionVisual.hr2} onChange={(v) => handleDownTimeChange('delayInInspectionVisual', 'hr2', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionVisual.hr3} onChange={(v) => handleDownTimeChange('delayInInspectionVisual', 'hr3', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.delayInInspectionVisual.hr4} onChange={(v) => handleDownTimeChange('delayInInspectionVisual', 'hr4', v)} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.delayInInspectionVisual.total}</td>
                                                    </tr>

                                                    {/* Nested Machine Breakdown */}
                                                    <tr>
                                                        <td className="border border-black px-1" rowSpan={7}>Machine Under Break Down</td>
                                                        <td className="border border-black px-1">CPG</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownCPG.hr1} onChange={(v) => handleDownTimeChange('machineBreakDownCPG', 'hr1', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownCPG.hr2} onChange={(v) => handleDownTimeChange('machineBreakDownCPG', 'hr2', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownCPG.hr3} onChange={(v) => handleDownTimeChange('machineBreakDownCPG', 'hr3', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownCPG.hr4} onChange={(v) => handleDownTimeChange('machineBreakDownCPG', 'hr4', v)} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.machineBreakDownCPG.total}</td>
                                                    </tr>
                                                    <tr><td className="border border-black px-1">Conveyor</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownConveyor.hr1} onChange={(v) => handleDownTimeChange('machineBreakDownConveyor', 'hr1', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownConveyor.hr2} onChange={(v) => handleDownTimeChange('machineBreakDownConveyor', 'hr2', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownConveyor.hr3} onChange={(v) => handleDownTimeChange('machineBreakDownConveyor', 'hr3', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownConveyor.hr4} onChange={(v) => handleDownTimeChange('machineBreakDownConveyor', 'hr4', v)} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.machineBreakDownConveyor.total}</td>
                                                    </tr>
                                                    <tr><td className="border border-black px-1">Torque Tight</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownTorqueTight.hr1} onChange={(v) => handleDownTimeChange('machineBreakDownTorqueTight', 'hr1', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownTorqueTight.hr2} onChange={(v) => handleDownTimeChange('machineBreakDownTorqueTight', 'hr2', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownTorqueTight.hr3} onChange={(v) => handleDownTimeChange('machineBreakDownTorqueTight', 'hr3', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownTorqueTight.hr4} onChange={(v) => handleDownTimeChange('machineBreakDownTorqueTight', 'hr4', v)} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.machineBreakDownTorqueTight.total}</td>
                                                    </tr>
                                                    <tr><td className="border border-black px-1">Grease Insert</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownGreaseInsert.hr1} onChange={(v) => handleDownTimeChange('machineBreakDownGreaseInsert', 'hr1', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownGreaseInsert.hr2} onChange={(v) => handleDownTimeChange('machineBreakDownGreaseInsert', 'hr2', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownGreaseInsert.hr3} onChange={(v) => handleDownTimeChange('machineBreakDownGreaseInsert', 'hr3', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownGreaseInsert.hr4} onChange={(v) => handleDownTimeChange('machineBreakDownGreaseInsert', 'hr4', v)} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.machineBreakDownGreaseInsert.total}</td>
                                                    </tr>
                                                    <tr><td className="border border-black px-1">F/A Board</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownFABoard.hr1} onChange={(v) => handleDownTimeChange('machineBreakDownFABoard', 'hr1', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownFABoard.hr2} onChange={(v) => handleDownTimeChange('machineBreakDownFABoard', 'hr2', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownFABoard.hr3} onChange={(v) => handleDownTimeChange('machineBreakDownFABoard', 'hr3', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownFABoard.hr4} onChange={(v) => handleDownTimeChange('machineBreakDownFABoard', 'hr4', v)} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.machineBreakDownFABoard.total}</td>
                                                    </tr>
                                                    <tr><td className="border border-black px-1">A/B Crimping</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownABCrimping.hr1} onChange={(v) => handleDownTimeChange('machineBreakDownABCrimping', 'hr1', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownABCrimping.hr2} onChange={(v) => handleDownTimeChange('machineBreakDownABCrimping', 'hr2', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownABCrimping.hr3} onChange={(v) => handleDownTimeChange('machineBreakDownABCrimping', 'hr3', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownABCrimping.hr4} onChange={(v) => handleDownTimeChange('machineBreakDownABCrimping', 'hr4', v)} /></td>
                                                        <td className="border border-black p-0 font-bold bg-gray-50 text-center">{formData.downTime.machineBreakDownABCrimping.total}</td>
                                                    </tr>
                                                    <tr><td className="border border-black px-1">Gromett</td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownGromett.hr1} onChange={(v) => handleDownTimeChange('machineBreakDownGromett', 'hr1', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownGromett.hr2} onChange={(v) => handleDownTimeChange('machineBreakDownGromett', 'hr2', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownGromett.hr3} onChange={(v) => handleDownTimeChange('machineBreakDownGromett', 'hr3', v)} /></td>
                                                        <td className="border border-black p-0"><NumberCell value={formData.downTime.machineBreakDownGromett.hr4} onChange={(v) => handleDownTimeChange('machineBreakDownGromett', 'hr4', v)} /></td>
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
                                        disabled={!tableConfig}
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
                                                    <TextCell value={item.issue} onChange={(v) => {
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
                                        disabled={!tableConfig}
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
                                                { text: "Handover", width: "w-16" },
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
                                                <td className="border border-black p-0"><TextCell value={item.handover} onChange={(v) => handleMoralChange(idx, 'handover', v)} textAlign="center" /></td>
                                                <td className="border border-black p-0"><NumberCell value={item.present} onChange={(v) => handleMoralChange(idx, 'present', v)} /></td>
                                                <td className="border border-black p-0 text-red-600"><NumberCell value={item.absent} onChange={(v) => handleMoralChange(idx, 'absent', v)} /></td>
                                                <td className="border border-black p-0 text-blue-600"><NumberCell value={item.present2} onChange={(v) => handleMoralChange(idx, 'present2', v)} /></td>
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

                        {/* Footer line table (Direct Efficiency + Signatures) */}
                        <div className="flex justify-between items-center bg-blue-100 border border-black pr-1 mt-1">
                            <div className="flex-1 text-center font-bold text-sm py-1">
                                {tableConfig?.footer?.title || "Efficiency & Signatures"}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 print:hidden"
                                onClick={() => openEditor('footer')}
                                disabled={!tableConfig}
                            >
                                <IconSettings className="w-3 h-3" />
                            </Button>
                        </div>
                        <table className="w-full border-collapse border border-black font-bold mt-1 text-[11px]">
                            <tbody>
                                <tr>
                                    <td className="border border-black p-1 text-center w-[20%]">Direct Efficiency</td>
                                    <td className="border border-black p-0 w-[10%] bg-gray-100 text-center border-b">Target</td>
                                    <td className="border border-black p-0 w-[10%] border-b"><NumberCell value={formData.directEfficiency.target} onChange={(v) => setFormData({ ...formData, directEfficiency: { ...formData.directEfficiency, target: v } })} /></td>
                                    <td className="border border-transparent w-[10%]"></td>
                                    <td className="border border-black p-1 text-right pr-4 bg-gray-100 w-[20%]">{tableConfig?.footer?.madeByLabel || "Made By (Line Leader):"}</td>
                                    <td className="border border-black p-0"><TextCell value={formData.madeBy} onChange={(v) => setFormData({ ...formData, madeBy: v })} /></td>
                                </tr>
                                <tr>
                                    <td className="border border-transparent"></td>
                                    <td className="border border-black p-0 bg-gray-100 text-center">Actual</td>
                                    <td className="border border-black p-0"><NumberCell value={formData.directEfficiency.actual} onChange={(v) => setFormData({ ...formData, directEfficiency: { ...formData.directEfficiency, actual: v } })} /></td>
                                    <td className="border border-transparent"></td>
                                    <td className="border border-black p-1 text-right pr-4 bg-gray-100">{tableConfig?.footer?.checkedByLabel || "Checked By (Shift Incharge):"}</td>
                                    <td className="border border-black p-0"><TextCell value={formData.checkedBy} onChange={(v) => setFormData({ ...formData, checkedBy: v })} /></td>
                                </tr>
                            </tbody>
                        </table>

                    </div>

                    <div className="mt-6 flex justify-end print:hidden">
                        <Button size="lg" onClick={handleSubmit} disabled={isSaving}>
                            {isSaving ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            ) : (
                                <IconSave className="w-5 h-5 mr-2" />
                            )}
                            Save Report
                        </Button>
                    </div>

                </div>
            )}

            {/* Empty State Instructions */}
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
