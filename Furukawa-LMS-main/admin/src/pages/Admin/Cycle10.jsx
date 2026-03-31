import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2, Save, Download } from "lucide-react";
import axiosInstance from '@/Helper/axiosInstance';
import { exportToExcel } from "@/utils/exportHelper";
import { toast } from "sonner";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const Cycle10 = () => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingSheets, setLoadingSheets] = useState(false);
    const [sheetList, setSheetList] = useState([]);
    const [selectedSheetId, setSelectedSheetId] = useState("");
    const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [createDepartmentId, setCreateDepartmentId] = useState("");
    const [createFormType, setCreateFormType] = useState("form1");
    const [createdDate, setCreatedDate] = useState("");
    const [currentDepartmentName, setCurrentDepartmentName] = useState("");

    const { data: departmentsData } = useGetAllDepartmentsQuery({ page: 1, limit: 500 });
    const departments = departmentsData?.data?.departments || [];

    // Header Data
    const [headerData, setHeaderData] = useState({
        qualityEngineer: "Ram Singh",
        qualityEngineerSign: "Ram Singh",
        dojoEngineer: "Rohit",
        dojoEngineerSign: "Rohit Kumar"
    });

    // Default Row Structure
    const createNewRow = (id = Date.now()) => ({
        id,
        date: new Date().toISOString().split('T')[0],
        lineMachine: '',
        modelName: '',
        partName: '',
        operationName: '',
        sopNo: '',

        // Section A: Ask Four Questions
        secA_q1: false, secA_q2: false, secA_q3: false, secA_q4: false,
        // Section A: General Points Check Marking
        secA_gp1: false, secA_gp2: false, secA_gp3: false, secA_gp4: false, secA_gp5: false, secA_gp6: false,

        // Section B: Measuring Instrument Using Method
        secB_vernier: false, secB_micrometer: false, secB_bladeMicrometer: false,
        secB_gaugingLength: false, secB_bendUpGauge: false,

        // Section C: Cross Inspection Marking
        secC_1: false, secC_2: false, secC_3: false, secC_4: false, secC_5: false,

        // Results
        inspectorName: '',
        empCode: '',
        skillLevel: '',
        obsSecA: '',
        obsSecB: '',
        obsSecC: '',
        passScore: '100%',
        overallResult: 'Passed',
        inspectorSign: '',
        tlSign: '',
        remark: '',

        // Form 2 specific fields
        form2_secA_obs: '', form2_secA_reason: '', form2_secA_action: '',
        form2_secB_obs: '', form2_secB_reason: '', form2_secB_action: '',
        form2_secC_obs: '', form2_secC_reason: '', form2_secC_action: '',
    });

    const [rows, setRows] = useState([]);

    // Form Type State
    const [formType, setFormType] = useState('form1');

    useEffect(() => {
        if (!selectedDepartmentFilter) {
            setSheetList([]);
            return;
        }
        fetchSheets(selectedDepartmentFilter);
    }, [selectedDepartmentFilter]);

    const fetchSheets = async (departmentId) => {
        try {
            setLoadingSheets(true);
            const response = await axiosInstance.get(`/api/ten-cycle-sheets?departmentId=${departmentId}`);
            if (response.data.success) {
                setSheetList(response.data.data || []);
            }
        } catch (error) {
            toast.error("Failed to load 10 cycle sheets");
        } finally {
            setLoadingSheets(false);
        }
    };

    const fetchSheetById = async (sheetId) => {
        try {
            setLoading(true);
            const response = await axiosInstance.get(`/api/ten-cycle-sheets/${sheetId}`);
            if (response.data.success) {
                const data = response.data.data;
                setSelectedSheetId(String(data.id));
                setHeaderData({
                    qualityEngineer: data.qualityEngineer || "",
                    qualityEngineerSign: data.qualityEngineerSign || "",
                    dojoEngineer: data.dojoEngineer || "",
                    dojoEngineerSign: data.dojoEngineerSign || ""
                });
                setFormType(data.formType || "form1");
                setRows(data.entries && data.entries.length > 0 ? data.entries : [createNewRow()]);
                setCreatedDate(data.createdDate ? String(data.createdDate).split("T")[0] : "");
                setCurrentDepartmentName(data.departmentName || "");
            }
        } catch (error) {
            toast.error("Failed to load selected sheet");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSheet = async () => {
        if (!createDepartmentId) {
            toast.error("Please select department");
            return;
        }
        try {
            const response = await axiosInstance.post(`/api/ten-cycle-sheets`, {
                departmentId: createDepartmentId,
                formType: createFormType,
            });
            const created = response?.data?.data;
            toast.success("10 cycle sheet created");
            setCreateOpen(false);
            setSelectedDepartmentFilter(String(createDepartmentId));
            await fetchSheets(String(createDepartmentId));
            if (created?.id) await fetchSheetById(String(created.id));
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to create sheet");
        }
    };

    const handleSave = async () => {
        if (!selectedSheetId) {
            toast.error("No sheet selected");
            return;
        }
        try {
            setSaving(true);
            const payload = {
                ...headerData,
                formType,
                entries: rows
            };
            await axiosInstance.put(`/api/ten-cycle-sheets/${selectedSheetId}`, payload);
            toast.success("10 Cycle Check Saved Successfully");
            if (selectedDepartmentFilter) await fetchSheets(selectedDepartmentFilter);
        } catch (error) {
            console.error("Error saving data:", error);
            toast.error("Failed to save data");
        } finally {
            setSaving(false);
        }
    };

    const addRow = () => {
        setRows([...rows, createNewRow()]);
    };

    const removeRow = (id) => {
        if (rows.length === 1) return;
        setRows(rows.filter(row => row.id !== id));
    };

    const handleRowChange = (id, field, value) => {
        setRows(rows.map(row => row.id === id ? { ...row, [field]: value } : row));
    };

    const handleHeaderChange = (field, value) => {
        setHeaderData(prev => ({ ...prev, [field]: value }));
    };

    // Helper to render Text Input for Form 2 cells
    const renderTextInput = (row, field) => (
        <textarea
            className="w-full h-full p-1 text-[10px] resize-none outline-none bg-transparent"
            value={row[field] || ''}
            onChange={(e) => handleRowChange(row.id, field, e.target.value)}
            rows={2}
        />
    );

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    if (!selectedSheetId) {
        return (
            <Card className="w-full">
                <CardContent className="p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h1 className="text-xl font-bold">10 Cycle Check Sheets</h1>
                        <Button onClick={() => setCreateOpen(true)}>Add 10 Cycle Sheet</Button>
                    </div>

                    <div className="max-w-sm">
                        <label className="text-sm font-medium mb-1 block">Department</label>
                        <Select value={selectedDepartmentFilter} onValueChange={setSelectedDepartmentFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                                {departments.map((dept) => (
                                    <SelectItem key={dept._id || dept.id} value={String(dept._id || dept.id)}>
                                        {dept.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="border rounded">
                        {loadingSheets ? (
                            <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading sheets...
                            </div>
                        ) : sheetList.length === 0 ? (
                            <div className="p-4 text-sm text-muted-foreground">
                                No sheets found. Create a new 10 cycle sheet.
                            </div>
                        ) : (
                            <div className="divide-y">
                                {sheetList.map((sheet) => (
                                    <button
                                        key={sheet.id}
                                        className="w-full text-left p-3 hover:bg-muted/50"
                                        onClick={() => fetchSheetById(String(sheet.id))}
                                    >
                                        <div className="font-medium">
                                            {sheet.departmentName || "Department"} - {sheet.formType === "form1" ? "Form 1" : "Form 2"}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Created: {sheet.createdDate ? String(sheet.createdDate).split("T")[0] : "-"}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create 10 Cycle Sheet</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Department</label>
                                    <Select value={createDepartmentId} onValueChange={setCreateDepartmentId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {departments.map((dept) => (
                                                <SelectItem key={dept._id || dept.id} value={String(dept._id || dept.id)}>
                                                    {dept.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Form Type</label>
                                    <Select value={createFormType} onValueChange={setCreateFormType}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select form type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="form1">Form 1 (Checkbox)</SelectItem>
                                            <SelectItem value="form2">Form 2 (Text Observations)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Date of Creation</label>
                                    <Input value={new Date().toISOString().split("T")[0]} disabled />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                                <Button onClick={handleCreateSheet}>Create</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full overflow-hidden">
            <CardContent className="p-4 space-y-4">
                {/* Header & Toggle Section */}
                <div className="flex flex-col space-y-2 mb-4">
                    <div className="flex justify-between items-start">
                        <Button variant="outline" onClick={() => setSelectedSheetId("")}>Back to Sheets</Button>
                        <div className="text-sm font-semibold">
                            {formType === "form2" ? "Form 2 (Text Observations)" : "Form 1 (Checkbox)"}
                        </div>
                    </div>

                    <div className="flex justify-between items-center border-b-2 border-black pb-1 relative">
                        <h1 className="text-xl font-bold uppercase w-full text-center">
                            10 CYCLE CHECK MONITORING SHEET ( Existing Inspector )
                        </h1>
                        <span className="font-bold text-xs absolute right-0 top-0">FURUKAWA MINDA ELECTRIC PVT.LTD.</span>
                        <span className="text-xs absolute right-0 bottom-0 text-blue-600 font-bold">
                            Dept.:-{currentDepartmentName || "-"} | Created:-{createdDate || "-"}
                        </span>
                    </div>

                    <div className="border border-black grid grid-cols-2">
                        {/* Quality Engineer Side */}
                        <div className="border-r border-black">
                            <div className="flex border-b border-black">
                                <div className="w-1/2 p-1 font-bold text-xs bg-gray-50">Quality Engineer/Supervisor Name:-</div>
                                <div className="w-1/2 p-1">
                                    <Input
                                        className="h-6 text-xs p-1 border-none focus-visible:ring-0 text-blue-600 font-bold"
                                        value={headerData.qualityEngineer}
                                        onChange={e => handleHeaderChange('qualityEngineer', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex">
                                <div className="w-1/2 p-1 font-bold text-xs bg-gray-50">Quality Engineer/Supervisor Signature:-</div>
                                <div className="w-1/2 p-1">
                                    <Input
                                        className="h-6 text-xs p-1 border-none focus-visible:ring-0 text-blue-600 font-bold"
                                        value={headerData.qualityEngineerSign}
                                        onChange={e => handleHeaderChange('qualityEngineerSign', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        {/* Dojo Engineer Side */}
                        <div>
                            <div className="flex border-b border-black">
                                <div className="w-1/2 p-1 font-bold text-xs bg-gray-50">Dojo Engineer Name:-</div>
                                <div className="w-1/2 p-1">
                                    <Input
                                        className="h-6 text-xs p-1 border-none focus-visible:ring-0 text-blue-600 font-bold"
                                        value={headerData.dojoEngineer}
                                        onChange={e => handleHeaderChange('dojoEngineer', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex">
                                <div className="w-1/2 p-1 font-bold text-xs bg-gray-50">Dojo Engineer Signature:-</div>
                                <div className="w-1/2 p-1">
                                    <Input
                                        className="h-6 text-xs p-1 border-none focus-visible:ring-0 text-blue-600 font-bold"
                                        value={headerData.dojoEngineerSign}
                                        onChange={e => handleHeaderChange('dojoEngineerSign', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto border-2 border-black">
                    {formType === 'form1' ? (
                        /* FORM 1: Checkbox Style */
                        <table className="w-full text-[10px] border-collapse min-w-[1800px]">
                            <thead>
                                <tr className="bg-gray-50 text-center font-bold">
                                    <th rowSpan="3" className="border border-black p-1 w-8">Sr No.</th>
                                    <th rowSpan="3" className="border border-black p-1 w-20">Date</th>
                                    <th rowSpan="3" className="border border-black p-1 w-16">Line/ Machine No.</th>
                                    <th rowSpan="3" className="border border-black p-1 w-16">Model Name</th>
                                    <th rowSpan="3" className="border border-black p-1 w-20">Part Name</th>
                                    <th rowSpan="3" className="border border-black p-1 w-20">Operation Name</th>
                                    <th rowSpan="3" className="border border-black p-1 w-16">SOP No</th>

                                    {/* Section A */}
                                    <th colSpan="10" className="border border-black p-1">Section - A</th>

                                    {/* Section B */}
                                    <th colSpan="5" className="border border-black p-1">Section - B</th>

                                    {/* Section C */}
                                    <th colSpan="5" className="border border-black p-1">Section-C</th>

                                    {/* Result Info */}
                                    <th rowSpan="3" className="border border-black p-1 w-16">Inspector Name</th>
                                    <th rowSpan="3" className="border border-black p-1 w-12">Emp. Code</th>
                                    <th rowSpan="3" className="border border-black p-1 w-8">Skill Level</th>
                                    <th rowSpan="3" className="border border-black p-1 w-24">Observation in Section - A</th>
                                    <th rowSpan="3" className="border border-black p-1 w-24">Observation in Section - B</th>
                                    <th rowSpan="3" className="border border-black p-1 w-24">Observation in Section - C</th>
                                    <th rowSpan="3" className="border border-black p-1 w-8">Pass Score %</th>
                                    <th rowSpan="3" className="border border-black p-1 w-8">Overall Result</th>
                                    <th rowSpan="3" className="border border-black p-1 w-12">Inspector Sign.</th>
                                    <th rowSpan="3" className="border border-black p-1 w-12">TL Sign.</th>
                                    <th rowSpan="3" className="border border-black p-1 w-24">Remark if any</th>
                                </tr>
                                <tr className="bg-gray-50 text-center font-bold text-[9px]">
                                    {/* Sec A Subs */}
                                    <th colSpan="4" className="border border-black p-1">Ask Four Quest. Marking</th>
                                    <th colSpan="6" className="border border-black p-1">General Points Check Marking</th>

                                    {/* Sec B Subs */}
                                    <th colSpan="5" className="border border-black p-1">Measuring Instrument Using Method</th>

                                    {/* Sec C Subs */}
                                    <th colSpan="5" className="border border-black p-1">Cross Inspection Marking</th>
                                </tr>
                                <tr className="bg-gray-50 text-center font-bold text-[9px]">
                                    {/* A - Questions */}
                                    <th className="border border-black w-4">Q 1</th>
                                    <th className="border border-black w-4">Q 2</th>
                                    <th className="border border-black w-4">Q 3</th>
                                    <th className="border border-black w-4">Q 4</th>
                                    {/* A - General */}
                                    <th className="border border-black w-4">Q 1</th>
                                    <th className="border border-black w-4">Q 2</th>
                                    <th className="border border-black w-4">Q 3</th>
                                    <th className="border border-black w-4">Q 4</th>
                                    <th className="border border-black w-4">Q 5</th>
                                    <th className="border border-black w-4">Q 6</th>

                                    {/* B - Instruments vertical text often */}
                                    <th className="border border-black w-4"><div className="transform -rotate-90 h-16 w-4 flex items-center justify-center">Micrometer</div></th>
                                    <th className="border border-black w-4"><div className="transform -rotate-90 h-16 w-4 flex items-center justify-center">Point Micrometer</div></th>
                                    <th className="border border-black w-4"><div className="transform -rotate-90 h-16 w-4 flex items-center justify-center">Blade Micrometer</div></th>
                                    <th className="border border-black w-4"><div className="transform -rotate-90 h-16 w-4 flex items-center justify-center">Gauging Length</div></th>
                                    <th className="border border-black w-4"><div className="transform -rotate-90 h-16 w-4 flex items-center justify-center">Bend up Gauge</div></th>

                                    {/* C - Cross Insp */}
                                    <th className="border border-black w-4">1</th>
                                    <th className="border border-black w-4">2</th>
                                    <th className="border border-black w-4">3</th>
                                    <th className="border border-black w-4">4</th>
                                    <th className="border border-black w-4">5</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, index) => (
                                    <tr key={row.id} className="text-center group hover:bg-gray-50">
                                        <td className="border border-black relative">
                                            {index + 1}
                                            <button onClick={() => removeRow(row.id)} className="absolute left-0 top-0 text-red-500 opacity-0 group-hover:opacity-100 p-0.5"><Trash2 size={10} /></button>
                                        </td>
                                        {/* Basics */}
                                        <td className="border border-black p-0"><input type="date" className="w-full text-center bg-transparent outline-none p-1" value={row.date} onChange={(e) => handleRowChange(row.id, 'date', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.lineMachine} onChange={(e) => handleRowChange(row.id, 'lineMachine', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.modelName} onChange={(e) => handleRowChange(row.id, 'modelName', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.partName} onChange={(e) => handleRowChange(row.id, 'partName', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.operationName} onChange={(e) => handleRowChange(row.id, 'operationName', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.sopNo} onChange={(e) => handleRowChange(row.id, 'sopNo', e.target.value)} /></td>

                                        {/* Section A - Checks */}
                                        {['secA_q1', 'secA_q2', 'secA_q3', 'secA_q4', 'secA_gp1', 'secA_gp2', 'secA_gp3', 'secA_gp4', 'secA_gp5', 'secA_gp6'].map(field => (
                                            <td key={field} className="border border-black p-0 align-middle">
                                                <div className="flex justify-center items-center h-full">
                                                    <input type="checkbox" className="w-3 h-3" checked={row[field]} onChange={(e) => handleRowChange(row.id, field, e.target.checked)} />
                                                </div>
                                            </td>
                                        ))}

                                        {/* Section B - Checks */}
                                        {['secB_vernier', 'secB_micrometer', 'secB_bladeMicrometer', 'secB_gaugingLength', 'secB_bendUpGauge'].map(field => (
                                            <td key={field} className="border border-black p-0 align-middle">
                                                <div className="flex justify-center items-center h-full">
                                                    <input type="checkbox" className="w-3 h-3" checked={row[field]} onChange={(e) => handleRowChange(row.id, field, e.target.checked)} />
                                                </div>
                                            </td>
                                        ))}

                                        {/* Section C - Checks */}
                                        {['secC_1', 'secC_2', 'secC_3', 'secC_4', 'secC_5'].map(field => (
                                            <td key={field} className="border border-black p-0 align-middle">
                                                <div className="flex justify-center items-center h-full">
                                                    <input type="checkbox" className="w-3 h-3" checked={row[field]} onChange={(e) => handleRowChange(row.id, field, e.target.checked)} />
                                                </div>
                                            </td>
                                        ))}

                                        {/* Footer Info */}
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.inspectorName} onChange={(e) => handleRowChange(row.id, 'inspectorName', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.empCode} onChange={(e) => handleRowChange(row.id, 'empCode', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.skillLevel} onChange={(e) => handleRowChange(row.id, 'skillLevel', e.target.value)} /></td>

                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.obsSecA} onChange={(e) => handleRowChange(row.id, 'obsSecA', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.obsSecB} onChange={(e) => handleRowChange(row.id, 'obsSecB', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.obsSecC} onChange={(e) => handleRowChange(row.id, 'obsSecC', e.target.value)} /></td>

                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.passScore} onChange={(e) => handleRowChange(row.id, 'passScore', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.overallResult} onChange={(e) => handleRowChange(row.id, 'overallResult', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.inspectorSign} onChange={(e) => handleRowChange(row.id, 'inspectorSign', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.tlSign} onChange={(e) => handleRowChange(row.id, 'tlSign', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.remark} onChange={(e) => handleRowChange(row.id, 'remark', e.target.value)} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        /* FORM 2: Text Observation Style */
                        <table className="w-full text-[10px] border-collapse min-w-[1200px]">
                            <thead>
                                <tr className="bg-gray-50 text-center font-bold">
                                    <th rowSpan="2" className="border border-black p-1 w-8">Sr No.</th>
                                    <th rowSpan="2" className="border border-black p-1 w-20">Date</th>
                                    <th rowSpan="2" className="border border-black p-1 w-16">Line/ Machine No.</th>
                                    <th rowSpan="2" className="border border-black p-1 w-16">Model Name</th>
                                    <th rowSpan="2" className="border border-black p-1 w-20">Part Name</th>
                                    <th rowSpan="2" className="border border-black p-1 w-20">Operation Name</th>
                                    <th rowSpan="2" className="border border-black p-1 w-16">SOP No</th>
                                    <th rowSpan="2" className="border border-black p-1 w-20">Operator Name</th>
                                    <th rowSpan="2" className="border border-black p-1 w-12">Emp. Code</th>
                                    <th rowSpan="2" className="border border-black p-1 w-8">Skill Level</th>

                                    <th colSpan="3" className="border border-black p-1">Section - A</th>
                                    <th colSpan="3" className="border border-black p-1">Section - B</th>
                                    <th colSpan="3" className="border border-black p-1">Section - C</th>
                                </tr>
                                <tr className="bg-gray-50 text-center font-bold text-[9px]">
                                    <th className="border border-black p-1 min-w-[100px]">Observation</th>
                                    <th className="border border-black p-1 min-w-[100px]">Reason</th>
                                    <th className="border border-black p-1 min-w-[100px]">Action</th>

                                    <th className="border border-black p-1 min-w-[100px]">Observation</th>
                                    <th className="border border-black p-1 min-w-[100px]">Reason</th>
                                    <th className="border border-black p-1 min-w-[100px]">Action</th>

                                    <th className="border border-black p-1 min-w-[100px]">Observation</th>
                                    <th className="border border-black p-1 min-w-[100px]">Reason</th>
                                    <th className="border border-black p-1 min-w-[100px]">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, index) => (
                                    <tr key={row.id} className="text-center group hover:bg-gray-50">
                                        <td className="border border-black relative">
                                            {index + 1}
                                            <button onClick={() => removeRow(row.id)} className="absolute left-0 top-0 text-red-500 opacity-0 group-hover:opacity-100 p-0.5"><Trash2 size={10} /></button>
                                        </td>
                                        <td className="border border-black p-0"><input type="date" className="w-full text-center bg-transparent outline-none p-1" value={row.date} onChange={(e) => handleRowChange(row.id, 'date', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.lineMachine} onChange={(e) => handleRowChange(row.id, 'lineMachine', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.modelName} onChange={(e) => handleRowChange(row.id, 'modelName', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.partName} onChange={(e) => handleRowChange(row.id, 'partName', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.operationName} onChange={(e) => handleRowChange(row.id, 'operationName', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.sopNo} onChange={(e) => handleRowChange(row.id, 'sopNo', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.inspectorName} onChange={(e) => handleRowChange(row.id, 'inspectorName', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.empCode} onChange={(e) => handleRowChange(row.id, 'empCode', e.target.value)} /></td>
                                        <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600" value={row.skillLevel} onChange={(e) => handleRowChange(row.id, 'skillLevel', e.target.value)} /></td>

                                        {/* Sec A */}
                                        <td className="border border-black p-0">{renderTextInput(row, 'form2_secA_obs')}</td>
                                        <td className="border border-black p-0">{renderTextInput(row, 'form2_secA_reason')}</td>
                                        <td className="border border-black p-0">{renderTextInput(row, 'form2_secA_action')}</td>

                                        {/* Sec B */}
                                        <td className="border border-black p-0">{renderTextInput(row, 'form2_secB_obs')}</td>
                                        <td className="border border-black p-0">{renderTextInput(row, 'form2_secB_reason')}</td>
                                        <td className="border border-black p-0">{renderTextInput(row, 'form2_secB_action')}</td>

                                        {/* Sec C */}
                                        <td className="border border-black p-0">{renderTextInput(row, 'form2_secC_obs')}</td>
                                        <td className="border border-black p-0">{renderTextInput(row, 'form2_secC_reason')}</td>
                                        <td className="border border-black p-0">{renderTextInput(row, 'form2_secC_action')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="flex justify-between mt-4 print:hidden gap-2">
                    <div className="flex gap-2">
                        <Button onClick={addRow} className="gap-2" variant="outline">
                            <Plus size={16} /> Add 10 Cycle Row
                        </Button>
                        <Button
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-50"
                            onClick={() => exportToExcel("10-Cycle Check Sheet", { id: selectedSheetId })}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export
                        </Button>
                    </div>
                    <Button onClick={handleSave} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700">
                        {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={16} />} Save Sheet
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default Cycle10;
