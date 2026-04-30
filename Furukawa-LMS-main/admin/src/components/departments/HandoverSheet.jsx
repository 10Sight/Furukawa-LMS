import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconDeviceFloppy, IconPrinter, IconDownload } from "@tabler/icons-react";
import axiosInstance from "@/Helper/axiosInstance";
import { toast } from "sonner";
import { exportToExcel } from "@/utils/exportHelper";
import { Loader2, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { IconSettings, IconHistory, IconPlus, IconTrash } from "@tabler/icons-react";
import { format } from "date-fns";
import UserAutocomplete from '../common/UserAutocomplete';

const HandoverSheet = ({ departmentId, sectionId = null, students = [], departmentName, sectionName = "", instructorName }) => {
    const authUser = useSelector(state => state.auth.user);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [entries, setEntries] = useState([]); // Array of objects matching table rows
    const [signatures, setSignatures] = useState({
        educationCell: "",
        hod: ""
    });

    const [metadata, setMetadata] = useState({
        docNo: "FRM-HR-003",
        revNo: "05",
        revDate: "30.01.2024",
        issueDate: "01.06.09"
    });
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [submittedAt, setSubmittedAt] = useState(null);

    // Layout Config State
    const [tableConfig, setTableConfig] = useState(null);
    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const [jsonConfigStr, setJsonConfigStr] = useState("");
    const [layoutRemark, setLayoutRemark] = useState("");
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [configHistory, setConfigHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingConfig, setLoadingConfig] = useState(false);
    const hasInitialized = useRef(false);
    const lastSessionKey = useRef("");

    const currentSessionKey = `${departmentId}-${sectionId || 'all'}-${date}`;

    const fetchConfig = async () => {
        if (!departmentId) return;
        try {
            setLoadingConfig(true);
            const response = await axiosInstance.get(`/api/departments/handover-sheet/config/${departmentId}?sectionId=${sectionId || ""}`);
            if (response.data.success && response.data.data.config) {
                setTableConfig(response.data.data.config);
                setJsonConfigStr(JSON.stringify(response.data.data.config, null, 2));
            } else {
                setTableConfig(null);
                setJsonConfigStr("");
            }
        } catch (error) {
            console.error("Error fetching handover sheet config:", error);
        } finally {
            setLoadingConfig(false);
        }
    };

    const handleSaveConfig = async () => {
        if (!layoutRemark.trim()) {
            toast.error("Please enter a remark detailing your layout changes.");
            return;
        }

        try {
            let parsedConfig;
            try {
                parsedConfig = JSON.parse(jsonConfigStr);
            } catch (e) {
                toast.error("Invalid JSON format");
                return;
            }

            await axiosInstance.post(`/api/departments/handover-sheet/config/save`, {
                departmentId,
                sectionId: sectionId || null,
                config: parsedConfig,
                remark: layoutRemark
            });

            setTableConfig(parsedConfig);
            setIsEditingLayout(false);
            setLayoutRemark("");
            toast.success("Configuration saved successfully");
        } catch (error) {
            console.error("Error saving handover sheet config:", error);
            toast.error("Failed to save configuration");
        }
    };

    const fetchHistory = async () => {
        try {
            setLoadingHistory(true);
            const response = await axiosInstance.get(`/api/departments/handover-sheet/history/${departmentId}?sectionId=${sectionId || ""}`);
            if (response.data.success) {
                setConfigHistory(response.data.data);
                setIsHistoryOpen(true);
            }
        } catch (error) {
            console.error("Error fetching handover sheet history:", error);
            toast.error("Failed to load history");
        } finally {
            setLoadingHistory(false);
        }
    };

    // Initialize or Reset
    useEffect(() => {
        if (!departmentId) return;

        const fetchData = async () => {
            setLoading(true);
            
            // Check if we need to reset initialization because of selection change
            if (lastSessionKey.current !== currentSessionKey) {
                hasInitialized.current = false;
                lastSessionKey.current = currentSessionKey;
            }

            // Only initialize once per (department + section)
            if (hasInitialized.current) {
                setLoading(false);
                return;
            }

            try {
                // Also fetch config
                await fetchConfig();

                const response = await axiosInstance.get(`/api/departments/${departmentId}/handover-sheet?sectionId=${sectionId || ""}&date=${date}`);
                const data = response.data?.data;

                if (!data?.isNew) {
                    // Use the date from the data if available, but keep our selected date
                    // setDate(data.date ? data.date.split('T')[0] : date); 
                    const fetchedEntries = data.entries || [];
                    if (fetchedEntries.length === 0) {
                        fetchedEntries.push({
                            sn: 1,
                            studentId: "",
                            employeeName: "",
                            empCode: "",
                            marks: "0%",
                            department: sectionName || departmentName || "",
                            process: "",
                            mentor: "",
                            interview1: "",
                            interview2: "",
                            interviewStatus: "",
                            statusActionBy: ""
                        });
                    }
                    setEntries(fetchedEntries);
                    setSignatures(data.signatures || { educationCell: "", hod: "" });
                    if (data.metadata) setMetadata(data.metadata);
                    setIsSubmitted(!!data.isSubmitted);
                    setSubmittedAt(data.submittedAt);
                    hasInitialized.current = true;
                } else {
                    // Reset to a clean slate for the new date
                    setIsSubmitted(false);
                    setSubmittedAt(null);
                    setSignatures({ educationCell: "", hod: "" });
                    
                    if (students && students.length > 0) {
                    // Initial population from students list if new
                    const eligibleStudents = students.filter(student => student.currentLevel && student.currentLevel !== 'L1');

                    const initialEntries = eligibleStudents.map((student, index) => ({
                        sn: index + 1,
                        studentId: student._id,
                        employeeName: student.fullName,
                        empCode: student.empId || "",
                        marks: "0%",
                        department: sectionName || departmentName || "Quality",
                        process: "",
                        mentor: "",
                        interview1: "",
                        interview2: "",
                        interviewStatus: "",
                        statusActionBy: ""
                    }));

                    if (initialEntries.length === 0) {
                        initialEntries.push({
                            sn: 1,
                            studentId: "",
                            employeeName: "",
                            empCode: "",
                            marks: "0%",
                            department: sectionName || departmentName || "",
                            process: "",
                            mentor: "",
                            interview1: "",
                            interview2: "",
                            interviewStatus: "",
                            statusActionBy: ""
                        });
                    }

                    setEntries(initialEntries);
                    hasInitialized.current = true;
                } else {
                    // Totally empty new sheet
                    setEntries([{
                        sn: 1,
                        studentId: "",
                        employeeName: "",
                        empCode: "",
                        marks: "0%",
                        department: sectionName || departmentName || "",
                        process: "",
                        mentor: "",
                        interview1: "",
                        interview2: "",
                        interviewStatus: "",
                        statusActionBy: ""
                    }]);
                    hasInitialized.current = true;
                }
            }
        } catch (error) {
            console.error("Error fetching handover sheet:", error);
            toast.error("Failed to fetch handover sheet data");
        } finally {
            setLoading(false);
        }
    };

        fetchData();
    }, [departmentId, sectionId, date, students.length, departmentName, instructorName]);

    const handleEntryChange = (index, field, value) => {
        const newEntries = [...entries];
        newEntries[index] = { ...newEntries[index], [field]: value };
        setEntries(newEntries);
    };

    const handleUserSelect = (index, user) => {
        const newEntries = [...entries];
        newEntries[index] = {
            ...newEntries[index],
            studentId: user.id,
            employeeName: user.fullName,
            empCode: user.empId || "",
            department: sectionName || user.deptName || departmentName || "",
            process: user.machineName || ""
        };
        setEntries(newEntries);
    };

    const addRow = () => {
        setEntries([...entries, {
            sn: entries.length + 1,
            studentId: "",
            employeeName: "",
            empCode: "",
            marks: "0%",
            department: sectionName || departmentName || "",
            process: "",
            mentor: "",
            interview1: "",
            interview2: "",
            interviewStatus: "",
            statusActionBy: ""
        }]);
    };

    const removeRow = (index) => {
        const newEntries = entries.filter((_, i) => i !== index).map((entry, i) => ({
            ...entry,
            sn: i + 1
        }));
        setEntries(newEntries);
    };

    const handleSignatureChange = (field, value) => {
        setSignatures(prev => ({ ...prev, [field]: value }));
    };

    const handleMetadataChange = (field, value) => {
        setMetadata(prev => ({ ...prev, [field]: value }));
    };
    
    const handleStatusAction = (index, status) => {
        const newEntries = [...entries];
        const userName = authUser?.fullName || authUser?.name || "Unknown User";
        newEntries[index] = { 
            ...newEntries[index], 
            interviewStatus: status,
            statusActionBy: userName,
            statusActionAt: status ? new Date().toISOString() : null
        };
        setEntries(newEntries);

        // Auto-fill HOD signature when someone approves/rejects a row
        if (status && !signatures.hod) {
            setSignatures(prev => ({ ...prev, hod: userName }));
        }
    };

    const handleSave = async (isSubmit = false) => {
        setSaving(true);
        const userName = authUser?.fullName || authUser?.name || "System";
        
        // Auto-fill Education Cell signature if not set
        const updatedSignatures = { ...signatures };
        if (!updatedSignatures.educationCell) {
            updatedSignatures.educationCell = userName;
            setSignatures(updatedSignatures);
        }

        try {
            const response = await axiosInstance.post(`/api/departments/${departmentId}/handover-sheet`, {
                departmentId,
                sectionId: sectionId || null,
                date,
                entries,
                signatures: updatedSignatures,
                metadata,
                isSubmitted: isSubmit
            });
            
            if (isSubmit) {
                setIsSubmitted(true);
                setSubmittedAt(new Date().toISOString());
            }
            
            toast.success(isSubmit ? "Handover sheet submitted and emailed successfully" : "Handover sheet progress saved successfully");
        } catch (error) {
            console.error("Error saving handover sheet:", error);
            toast.error(isSubmit ? "Failed to submit handover sheet" : "Failed to save handover sheet");
        } finally {
            setSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div className="flex justify-center p-8"><IconDeviceFloppy className="h-8 w-8 animate-spin" /></div>;

    return (
        <>
            <Card className="w-full shadow-lg print:shadow-none">
                <CardHeader className="border-b bg-gray-50/50">
                    <div className="grid grid-cols-[1fr_2fr_1fr] items-start gap-4 py-4 min-h-[100px]">
                        <div className="flex items-center h-full">
                            {/* Logo or empty space for symmetry */}
                            <img src="/fme_transparent.png" alt="FURUKAWA" className="h-12 w-auto object-contain" />
                        </div>
                        <CardTitle className="text-xl font-bold text-center uppercase self-center">
                            List of Employees Handed Over to Shop Floor After Induction Training
                        </CardTitle>
                        <div className="text-[10px] text-right text-muted-foreground space-y-1 self-start">
                            <div className="flex items-center justify-end gap-1">
                                <span className="font-semibold whitespace-nowrap">DOCUMENT NO.</span>
                                <Input
                                    className="h-5 w-24 text-[10px] px-1 py-0 bg-transparent border-slate-300"
                                    value={metadata.docNo}
                                    onChange={(e) => handleMetadataChange('docNo', e.target.value)}
                                />
                            </div>
                            <div className="flex items-center justify-end gap-1">
                                <span className="font-semibold whitespace-nowrap">REVISION No.</span>
                                <Input
                                    className="h-5 w-24 text-[10px] px-1 py-0 bg-transparent border-slate-300"
                                    value={metadata.revNo}
                                    onChange={(e) => handleMetadataChange('revNo', e.target.value)}
                                />
                            </div>
                            <div className="flex items-center justify-end gap-1">
                                <span className="font-semibold whitespace-nowrap">REVISION DATE:</span>
                                <Input
                                    className="h-5 w-24 text-[10px] px-1 py-0 bg-transparent border-slate-300"
                                    value={metadata.revDate}
                                    onChange={(e) => handleMetadataChange('revDate', e.target.value)}
                                />
                            </div>
                            <div className="flex items-center justify-end gap-1">
                                <span className="font-semibold whitespace-nowrap">ISSUE DT.</span>
                                <Input
                                    className="h-5 w-24 text-[10px] px-1 py-0 bg-transparent border-slate-300"
                                    value={metadata.issueDate}
                                    onChange={(e) => handleMetadataChange('issueDate', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {/* Meta Info */}
                    <div className="grid grid-cols-2 gap-8 text-sm font-medium">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <span>From:</span>
                                <span className="text-blue-600">Education Centre</span>
                            </div>
                        </div>
                        <div className="space-y-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                                <span>To:</span>
                                <span className="text-blue-600">{(sectionName ? `${departmentName} - ${sectionName}` : departmentName) || "Department"}</span>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <span>Date:</span>
                                <Input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-40 h-8"
                                />
                            </div>
                            <div className="flex items-center gap-2 justify-end no-print">
                                {isSubmitted && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold border border-green-200 animate-in fade-in zoom-in duration-300">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                        SUBMITTED {submittedAt && `ON ${format(new Date(submittedAt), "PP")}`}
                                    </div>
                                )}
                                <Button variant="outline" onClick={fetchHistory}>
                                    <IconHistory className="h-4 w-4 mr-2" />
                                    History
                                </Button>
                                <Button variant="outline" onClick={() => setIsEditingLayout(true)}>
                                    <IconSettings className="h-4 w-4 mr-2" />
                                    Edit Layout
                                </Button>
                                <Button
                                    variant="outline"
                                    className="border-green-600 text-green-600 hover:bg-green-50"
                                    onClick={() => exportToExcel("Handover Sheet", { departmentId, sectionId })}
                                >
                                    <IconDownload className="h-4 w-4 mr-2" />
                                    Export
                                </Button>
                                <Button variant="outline" onClick={handlePrint}>
                                    <IconPrinter className="h-4 w-4 mr-2" />
                                    Print
                                </Button>
                                <Button 
                                    className="bg-green-600 hover:bg-green-700 text-white border-green-700"
                                    onClick={() => handleSave(false)} 
                                    disabled={saving}
                                >
                                    <IconDeviceFloppy className="h-4 w-4 mr-2" />
                                    {saving ? "Saving..." : "Save Progress"}
                                </Button>
                                <Button 
                                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all"
                                    onClick={() => handleSave(true)} 
                                    disabled={saving}
                                >
                                    <Save className="h-4 w-4 mr-2" />
                                    {saving ? "Submitting..." : "Submit & Email"}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Main Table */}
                    <div className="border border-gray-300 overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    {tableConfig && tableConfig.columns ? (
                                        tableConfig.columns.map((col, idx) => (
                                            <th key={idx} className={`border p-2 ${col.className || ""}`} style={col.style || {}}>
                                                {col.header}
                                            </th>
                                        ))
                                    ) : (
                                        <>
                                            <th className="border p-2 whitespace-nowrap">SN.</th>
                                            <th className="border p-2 whitespace-nowrap">Employee Name</th>
                                            <th className="border p-2 whitespace-nowrap">Emp. Code</th>
                                            <th className="border p-2 whitespace-nowrap">Marks Secured in Induction Training</th>
                                            <th className="border p-2 whitespace-nowrap">Department</th>
                                            <th className="border p-2 whitespace-nowrap">Process</th>
                                            <th className="border p-2 whitespace-nowrap">Mentor</th>
                                            <th className="border p-2 whitespace-nowrap">1st Interview Accident</th>
                                            <th className="border p-2 whitespace-nowrap">2nd Interview Practical</th>
                                            <th className="border p-2 whitespace-nowrap">Approve / Reject</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((entry, index) => (
                                    <tr key={entry.studentId || index} className="hover:bg-gray-50">
                                        {tableConfig && tableConfig.columns ? (
                                            tableConfig.columns.map((col, colIdx) => (
                                                <td key={colIdx} className="border p-1">
                                                    {col.field === 'sn' ? (
                                                        <div className="text-center">{index + 1}</div>
                                                    ) : col.field === 'employeeName' && !col.readOnly ? (
                                                        <UserAutocomplete
                                                            mode="all"
                                                            excludeAdmins={true}
                                                            excludeTrainers={true}
                                                            value={entry.employeeName}
                                                            onChange={(user) => handleUserSelect(index, user)}
                                                            onTextChange={(val) => handleEntryChange(index, 'employeeName', val)}
                                                            placeholder="Search..."
                                                            compact={true}
                                                            className="w-full"
                                                            inputClassName="border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-400 text-blue-600 font-medium"
                                                        />
                                                    ) : col.field === 'mentor' && !col.readOnly ? (
                                                        <UserAutocomplete
                                                            mode="all"
                                                            excludeAdmins={true}
                                                            value={entry.mentor}
                                                            onChange={(user) => handleEntryChange(index, 'mentor', user.fullName)}
                                                            onTextChange={(val) => handleEntryChange(index, 'mentor', val)}
                                                            placeholder="Search..."
                                                            compact={true}
                                                            className="w-full"
                                                            inputClassName="border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-400 text-center"
                                                        />
                                                    ) : col.readOnly ? (
                                                        <div className={`p-1 ${col.field === 'employeeName' ? 'font-medium text-blue-600' : 'text-center'}`}>
                                                            {entry[col.field]}
                                                        </div>
                                                    ) : (
                                                        <Input
                                                            value={entry[col.field] || ""}
                                                            onChange={(e) => handleEntryChange(index, col.field, e.target.value)}
                                                            className="h-7 min-w-[20px] text-center border-none shadow-none focus:ring-1 focus:ring-blue-400 inline-block w-auto"
                                                            size={Math.max((entry[col.field] || "").toString().length || 1, 5)}
                                                        />
                                                    )}
                                                </td>
                                            ))
                                        ) : (
                                            <>
                                                <td className="border p-1 text-center font-medium whitespace-nowrap">
                                                    {index + 1}
                                                </td>
                                                <td className="border p-1">
                                                    <UserAutocomplete
                                                        mode="all"
                                                        excludeAdmins={true}
                                                        excludeTrainers={true}
                                                        value={entry.employeeName}
                                                        onChange={(user) => handleUserSelect(index, user)}
                                                        onTextChange={(val) => handleEntryChange(index, 'employeeName', val)}
                                                        placeholder="Search Employee..."
                                                        compact={true}
                                                        className="min-w-[150px]"
                                                        inputClassName="border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-400 text-blue-600 font-medium"
                                                    />
                                                </td>
                                                <td className="border p-1 text-center">
                                                    <Input
                                                        value={entry.empCode || ""}
                                                        onChange={(e) => handleEntryChange(index, 'empCode', e.target.value)}
                                                        className="h-7 min-w-[40px] text-center border-none shadow-none focus:ring-1 focus:ring-blue-400 inline-block w-auto"
                                                        size={Math.max((entry.empCode || "").length || 1, 8)}
                                                    />
                                                </td>
                                                <td className="border p-1 text-center">
                                                    <Input
                                                        value={entry.marks}
                                                        onChange={(e) => handleEntryChange(index, 'marks', e.target.value)}
                                                        className="h-7 min-w-[30px] text-center border-none shadow-none focus:ring-1 focus:ring-blue-400 inline-block w-auto"
                                                        size={Math.max((entry.marks || "").toString().length || 1, 4)}
                                                    />
                                                </td>
                                                <td className="border p-1 text-center">
                                                    <Input
                                                        value={entry.department}
                                                        onChange={(e) => handleEntryChange(index, 'department', e.target.value)}
                                                        className="h-7 min-w-[80px] text-center border-none shadow-none focus:ring-1 focus:ring-blue-400 inline-block w-auto"
                                                        size={Math.max((entry.department || "").length || 1, 10)}
                                                    />
                                                </td>
                                                <td className="border p-1 text-center">
                                                    <Input
                                                        value={entry.process}
                                                        onChange={(e) => handleEntryChange(index, 'process', e.target.value)}
                                                        className="h-7 min-w-[80px] text-center border-none shadow-none focus:ring-1 focus:ring-blue-400 inline-block w-auto"
                                                        size={Math.max((entry.process || "").length || 1, 10)}
                                                    />
                                                </td>
                                                <td className="border p-1">
                                                    <UserAutocomplete
                                                        mode="all"
                                                        excludeAdmins={true}
                                                        value={entry.mentor}
                                                        onChange={(user) => handleEntryChange(index, 'mentor', user.fullName)}
                                                        onTextChange={(val) => handleEntryChange(index, 'mentor', val)}
                                                        placeholder="Search Mentor..."
                                                        compact={true}
                                                        className="min-w-[120px]"
                                                        inputClassName="border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-400 text-center"
                                                    />
                                                </td>
                                                <td className="border p-1 text-center">
                                                    <Input
                                                        value={entry.interview1}
                                                        onChange={(e) => handleEntryChange(index, 'interview1', e.target.value)}
                                                        className="h-7 min-w-[50px] text-center border-none shadow-none focus:ring-1 focus:ring-blue-400 inline-block w-auto"
                                                        size={Math.max((entry.interview1 || "").length || 1, 10)}
                                                    />
                                                </td>
                                                <td className="border p-1 text-center">
                                                    <Input
                                                        value={entry.interview2}
                                                        onChange={(e) => handleEntryChange(index, 'interview2', e.target.value)}
                                                        className="h-7 min-w-[50px] text-center border-none shadow-none focus:ring-1 focus:ring-blue-400 inline-block w-auto"
                                                        size={Math.max((entry.interview2 || "").length || 1, 10)}
                                                    />
                                                </td>
                                                <td className="border p-1">
                                                    {!entry.interviewStatus ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Button 
                                                                variant="ghost" 
                                                                className="h-7 px-2 text-[10px] font-bold text-green-600 hover:text-green-700 hover:bg-green-50 border border-green-200"
                                                                onClick={() => handleStatusAction(index, 'APPROVE')}
                                                            >
                                                                APPROVE
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                className="h-7 px-2 text-[10px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200"
                                                                onClick={() => handleStatusAction(index, 'REJECT')}
                                                            >
                                                                REJECT
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center py-1">
                                                            <div className={`text-[10px] font-bold uppercase ${entry.interviewStatus === 'APPROVE' ? 'text-green-600' : 'text-red-600'}`}>
                                                                {entry.interviewStatus === 'APPROVE' ? 'Approved' : 'Rejected'}
                                                            </div>
                                                            <div className="text-[9px] text-gray-500 leading-tight text-center">
                                                                by: {entry.statusActionBy}
                                                            </div>
                                                            <button 
                                                                onClick={() => handleStatusAction(index, "")}
                                                                className="mt-1 text-[8px] text-blue-500 hover:underline no-print"
                                                            >
                                                                Reset
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                                {/* Empty rows to maintain look if needed */}

                            </tbody>
                        </table>
                        <div className="mt-2 flex justify-start no-print">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={addRow}
                                className="flex items-center gap-1 text-xs border-dashed"
                            >
                                <IconPlus size={14} /> Add Row
                            </Button>
                        </div>
                    </div>

                    {/* Footer Notes */}
                    <div className="text-xs font-bold border border-black p-2 mt-4">
                        Note:- Candidate (NEW MANPOWER) handover in W/H Assembly and C&C must be approved by QA Incharge & Prod. Incharge.
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-8 mt-12 pt-8">
                        <div className="space-y-2">
                            <div className="border-b border-black min-h-[32px] flex items-end pb-1 px-1">
                                <span className="text-sm font-bold text-blue-700 italic">
                                    {signatures.educationCell || "____________________"}
                                </span>
                            </div>
                            <p className="text-sm font-bold">Signature Education Cell</p>
                            <p className="text-[10px] text-gray-500 italic">Form Filled By</p>
                        </div>
                        <div className="space-y-2 text-right">
                            <div className="border-b border-black min-h-[32px] flex items-end justify-end pb-1 px-1">
                                <span className="text-sm font-bold text-blue-700 italic">
                                    {signatures.hod || "____________________"}
                                </span>
                            </div>
                            <p className="text-sm font-bold">Signature of HOD/Incharge</p>
                            <p className="text-[10px] text-gray-500 italic">Form Approved By</p>
                        </div>
                    </div>

                    <div className="flex justify-end mt-8 no-print gap-4">
                        <Button
                            variant="outline"
                            onClick={() => exportToExcel("Handover Sheet", { departmentId, sectionId })}
                            className="border-green-600 text-green-600 hover:bg-green-50"
                        >
                            Export to Excel
                        </Button>
                        <Button 
                            variant="outline"
                            onClick={() => handleSave(false)} 
                            disabled={saving} 
                            className="gap-2 border-green-600 text-green-600 hover:bg-green-50"
                        >
                            <IconDeviceFloppy className="h-4 w-4" />
                            Save Progress
                        </Button>
                        <Button onClick={() => handleSave(true)} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Submit & Email Sheet
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Layout Dialog */}
            <Dialog open={isEditingLayout} onOpenChange={setIsEditingLayout}>
                <DialogContent className="max-w-[800px] max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Edit Handover Sheet Configuration (JSON)</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto p-1 space-y-4">
                        <Textarea
                            className="font-mono text-xs h-[400px]"
                            value={jsonConfigStr}
                            onChange={(e) => setJsonConfigStr(e.target.value)}
                            placeholder='e.g. { "columns": [{"header": "SN.", "field": "sn"}] }'
                        />
                        <div className="space-y-2">
                            <Label htmlFor="hs-remark">Remark (Required)</Label>
                            <Input
                                id="hs-remark"
                                placeholder="Briefly describe the changes made to the layout..."
                                value={layoutRemark}
                                onChange={(e) => setLayoutRemark(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex justify-between p-4 border-t">
                        <Button variant="ghost" onClick={() => setIsEditingLayout(false)}>Cancel</Button>
                        <Button onClick={handleSaveConfig} disabled={!layoutRemark.trim()}>
                            Save Configuration
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* History Dialog */}
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-[600px] max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Layout Change History</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto p-4 space-y-4">
                        {loadingHistory ? (
                            <div className="flex justify-center py-10"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div>
                        ) : configHistory.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">No history found.</div>
                        ) : (
                            configHistory.map((entry, idx) => (
                                <div key={idx} className="border p-3 rounded-lg space-y-2 bg-slate-50">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-semibold">{entry.updatedBy}</span>
                                        <span className="text-muted-foreground text-xs">{format(new Date(entry.createdAt), "PP p")}</span>
                                    </div>
                                    <div className="text-sm border-l-2 border-blue-400 pl-2">
                                        {entry.remark}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default HandoverSheet;
