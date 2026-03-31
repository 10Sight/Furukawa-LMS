import React, { useState, useEffect } from 'react';
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
import { IconSettings, IconHistory } from "@tabler/icons-react";
import { format } from "date-fns";

const HandoverSheet = ({ departmentId, students = [], departmentName, instructorName }) => {
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

    // Layout Config State
    const [tableConfig, setTableConfig] = useState(null);
    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const [jsonConfigStr, setJsonConfigStr] = useState("");
    const [layoutRemark, setLayoutRemark] = useState("");
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [configHistory, setConfigHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingConfig, setLoadingConfig] = useState(false);

    const fetchConfig = async () => {
        try {
            setLoadingConfig(true);
            const response = await axiosInstance.get(`/api/departments/handover-sheet/config/${departmentId}`);
            if (response.data.success && response.data.data.config) {
                setTableConfig(response.data.data.config);
                setJsonConfigStr(JSON.stringify(response.data.data.config, null, 2));
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
            const response = await axiosInstance.get(`/api/departments/handover-sheet/history/${departmentId}`);
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

    useEffect(() => {
        if (departmentId) {
            fetchConfig();
        }
    }, [departmentId]);

    // Initialize entries based on students if new, or fetch existing
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axiosInstance.get(`/api/departments/${departmentId}/handover-sheet`);
                const data = response.data?.data;

                if (!data?.isNew) {
                    setDate(data.date ? data.date.split('T')[0] : new Date().toISOString().split('T')[0]);
                    setEntries(data.entries || []);
                    setSignatures(data.signatures || { educationCell: "", hod: "" });
                    if (data.metadata) setMetadata(data.metadata);

                    // console.log("Fetched entries:", data.entries);
                } else {
                    // Initial population from students list if new
                    // Filter students who have upgraded from first level (L1) -> currentLevel != 'L1'
                    const eligibleStudents = students.filter(student => student.currentLevel && student.currentLevel !== 'L1');

                    const initialEntries = eligibleStudents.map((student, index) => ({
                        sn: index + 1,
                        studentId: student._id,
                        employeeName: student.fullName,
                        empCode: student.empId || "",
                        marks: "0%", // Default or fetch if available
                        department: departmentName || "Quality", // Default or fetch
                        process: "",
                        mentor: instructorName || "",
                        interview1: "",
                        interview2: ""
                    }));
                    setEntries(initialEntries);
                }
            } catch (error) {
                console.error("Error fetching handover sheet:", error);
                toast.error("Failed to fetch handover sheet data");
            } finally {
                setLoading(false);
            }
        };

        if (departmentId) {
            fetchData();
        }
    }, [departmentId, students, instructorName]);

    const handleEntryChange = (index, field, value) => {
        const newEntries = [...entries];
        newEntries[index] = { ...newEntries[index], [field]: value };
        setEntries(newEntries);
    };

    const handleSignatureChange = (field, value) => {
        setSignatures(prev => ({ ...prev, [field]: value }));
    };

    const handleMetadataChange = (field, value) => {
        setMetadata(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await axiosInstance.post(`/api/departments/${departmentId}/handover-sheet`, {
                date,
                entries,
                signatures,
                metadata
            });
            toast.success("Handover sheet saved successfully");
        } catch (error) {
            console.error("Error saving handover sheet:", error);
            toast.error("Failed to save handover sheet");
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
                    <div className="relative flex justify-center items-center py-2 min-h-[80px]">
                        <CardTitle className="text-xl font-bold text-center uppercase max-w-[70%]">
                            List of Employees Handed Over to Shop Floor After Induction Training
                        </CardTitle>
                        <div className="absolute right-0 top-0 text-xs text-right text-muted-foreground w-48 space-y-1">
                            <div className="flex items-center justify-end gap-2">
                                <span>DOCUMENT NO.</span>
                                <Input
                                    className="h-5 w-24 text-xs px-1 py-0"
                                    value={metadata.docNo}
                                    onChange={(e) => handleMetadataChange('docNo', e.target.value)}
                                />
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <span>REVISION No.</span>
                                <Input
                                    className="h-5 w-24 text-xs px-1 py-0"
                                    value={metadata.revNo}
                                    onChange={(e) => handleMetadataChange('revNo', e.target.value)}
                                />
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <span>REVISION DATE:</span>
                                <Input
                                    className="h-5 w-24 text-xs px-1 py-0"
                                    value={metadata.revDate}
                                    onChange={(e) => handleMetadataChange('revDate', e.target.value)}
                                />
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <span>ISSUE DT.</span>
                                <Input
                                    className="h-5 w-24 text-xs px-1 py-0"
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
                                <span className="text-blue-600">{departmentName || "Department"}</span>
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
                                    onClick={() => exportToExcel("Handover Sheet", { departmentId })}
                                >
                                    <IconDownload className="h-4 w-4 mr-2" />
                                    Export
                                </Button>
                                <Button variant="outline" onClick={handlePrint}>
                                    <IconPrinter className="h-4 w-4 mr-2" />
                                    Print
                                </Button>
                                <Button onClick={handleSave} disabled={saving}>
                                    <IconDeviceFloppy className="h-4 w-4 mr-2" />
                                    {saving ? "Saving..." : "Save"}
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
                                            <th className="border p-2 w-10">SN.</th>
                                            <th className="border p-2">Employee Name</th>
                                            <th className="border p-2 w-24">Emp. Code</th>
                                            <th className="border p-2 w-24">Marks Secured in Induction Training</th>
                                            <th className="border p-2 w-32">Department</th>
                                            <th className="border p-2">Process</th>
                                            <th className="border p-2">Mentor</th>
                                            <th className="border p-2">1st Interview Accident</th>
                                            <th className="border p-2">2nd Interview Practical</th>
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
                                                    ) : col.readOnly ? (
                                                        <div className={`p-1 ${col.field === 'employeeName' ? 'font-medium text-blue-600' : 'text-center'}`}>
                                                            {entry[col.field]}
                                                        </div>
                                                    ) : (
                                                        <Input
                                                            value={entry[col.field] || ""}
                                                            onChange={(e) => handleEntryChange(index, col.field, e.target.value)}
                                                            className="h-7 text-center border-none shadow-none focus:ring-0"
                                                        />
                                                    )}
                                                </td>
                                            ))
                                        ) : (
                                            <>
                                                <td className="border p-1 text-center">{index + 1}</td>
                                                <td className="border p-1">
                                                    <div className="p-1 font-medium text-blue-600">{entry.employeeName}</div>
                                                </td>
                                                <td className="border p-1">
                                                    <div className="p-1 text-center">{entry.empCode}</div>
                                                </td>
                                                <td className="border p-1">
                                                    <Input
                                                        value={entry.marks}
                                                        onChange={(e) => handleEntryChange(index, 'marks', e.target.value)}
                                                        className="h-7 text-center border-none shadow-none focus:ring-0"
                                                    />
                                                </td>
                                                <td className="border p-1">
                                                    <Input
                                                        value={entry.department}
                                                        onChange={(e) => handleEntryChange(index, 'department', e.target.value)}
                                                        className="h-7 text-center border-none shadow-none focus:ring-0"
                                                    />
                                                </td>
                                                <td className="border p-1">
                                                    <Input
                                                        value={entry.process}
                                                        onChange={(e) => handleEntryChange(index, 'process', e.target.value)}
                                                        className="h-7 text-center border-none shadow-none focus:ring-0"
                                                    />
                                                </td>
                                                <td className="border p-1">
                                                    <Input
                                                        value={entry.mentor}
                                                        onChange={(e) => handleEntryChange(index, 'mentor', e.target.value)}
                                                        className="h-7 text-center border-none shadow-none focus:ring-0"
                                                    />
                                                </td>
                                                <td className="border p-1">
                                                    <Input
                                                        value={entry.interview1}
                                                        onChange={(e) => handleEntryChange(index, 'interview1', e.target.value)}
                                                        className="h-7 text-center border-none shadow-none focus:ring-0"
                                                    />
                                                </td>
                                                <td className="border p-1">
                                                    <Input
                                                        value={entry.interview2}
                                                        onChange={(e) => handleEntryChange(index, 'interview2', e.target.value)}
                                                        className="h-7 text-center border-none shadow-none focus:ring-0"
                                                    />
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                                {/* Empty rows to maintain look if needed */}
                                {Array.from({ length: Math.max(0, 10 - entries.length) }).map((_, i) => (
                                    <tr key={`empty-${i}`} className="h-8">
                                        <td className="border p-1"></td>
                                        <td className="border p-1"></td>
                                        <td className="border p-1"></td>
                                        <td className="border p-1"></td>
                                        <td className="border p-1"></td>
                                        <td className="border p-1"></td>
                                        <td className="border p-1"></td>
                                        <td className="border p-1"></td>
                                        <td className="border p-1"></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Notes */}
                    <div className="text-xs font-bold border border-black p-2 mt-4">
                        Note:- Candidate (NEW MANPOWER) handover in W/H Assembly and C&C must be approved by QA Incharge & Prod. Incharge.
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-8 mt-12 pt-8">
                        <div className="space-y-2">
                            <Input
                                placeholder="Signature Education Cell"
                                value={signatures.educationCell}
                                onChange={(e) => handleSignatureChange('educationCell', e.target.value)}
                                className="border-b border-t-0 border-x-0 rounded-none shadow-none focus:ring-0 px-0 placeholder:text-gray-400"
                            />
                            <p className="text-sm font-bold">Signature Education Cell</p>
                        </div>
                        <div className="space-y-2">
                            <Input
                                placeholder="Signature of HOD/Incharge"
                                value={signatures.hod}
                                onChange={(e) => handleSignatureChange('hod', e.target.value)}
                                className="border-b border-t-0 border-x-0 rounded-none shadow-none focus:ring-0 px-0 placeholder:text-gray-400 text-right"
                            />
                            <p className="text-sm font-bold text-right">Signature of HOD/Incharge</p>
                        </div>
                    </div>

                    <div className="flex justify-end mt-8 no-print gap-4">
                        <Button
                            variant="outline"
                            onClick={() => exportToExcel("Handover Sheet", { departmentId })}
                            className="border-green-600 text-green-600 hover:bg-green-50"
                        >
                            Export to Excel
                        </Button>
                        <Button onClick={handleSave} disabled={saving} className="gap-2">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save Sheet
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
