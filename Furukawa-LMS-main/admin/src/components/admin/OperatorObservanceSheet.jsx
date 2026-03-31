import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import axiosInstance from '@/Helper/axiosInstance';
import { Loader2 } from "lucide-react";
import { exportToExcel } from "@/utils/exportHelper";

// Check Contents defined in the image
const CHECK_CONTENTS = [
    {
        id: "workingManner",
        title: "Working Manner",
        desc: "◆ Do work As per work standards \n◆ Confirm around the process whether he/she is capable to manage 5S on process or not."
    },
    {
        id: "cycleTime",
        title: "Cycle Time",
        desc: "◆ As per Running part no.\n(As per conveyor run at that time)"
    },
    {
        id: "checkSheets",
        title: "Check Sheets (If applicable)",
        desc: "◆ Confirm that he/she is aware about contents of check sheets."
    },
    {
        id: "processProductAwareness",
        title: "Process & Product Awareness",
        desc: "◆ Confirm the type of defect can occur on process and impact of bypass."
    },
    {
        id: "pastCustomerClaim",
        title: "Past Customer Claim Information",
        desc: "◆ Operator must be aware regarding the past customer claim"
    },
    { id: "checkedByLine", title: "Checked By (Line Incharge)", desc: "" },
    { id: "verificationByShift", title: "Verification By (Shift Incharge)", desc: "" }
];

const OperatorObservanceSheet = ({ studentId, studentName = "", employeeCode = "" }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Header Data
    const [headerData, setHeaderData] = useState({
        lineName: "",
        processName: "",
        level1Date: "",
        operatorNameCode: ""
    });

    // Table Data Structure: 
    // { rowId: { obs1: {date, val}, obs1Re: {date, val}, obs2: {...}, obs2Re: {...}, obs3: {...}, obs3Re: {...}, obs4: {...}, obs4Re: {...}, remarks: "" } }
    const [tableData, setTableData] = useState({});

    useEffect(() => {
        fetchData();
    }, [studentId]);

    useEffect(() => {
        const autoOperatorNameCode = [studentName, employeeCode].filter(Boolean).join(" - ");
        if (autoOperatorNameCode) {
            setHeaderData(prev => ({
                ...prev,
                operatorNameCode: autoOperatorNameCode,
            }));
        }
    }, [studentName, employeeCode]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const defaultOperatorNameCode = [studentName, employeeCode].filter(Boolean).join(" - ");

            // Fallback source for assigned machine/line.
            let assignmentLineName = "";
            let assignmentProcessName = "";
            try {
                const monitoringResponse = await axiosInstance.get(`/api/progress/three-day-monitoring/${studentId}`);
                const monitoringData = monitoringResponse?.data?.data || {};
                assignmentLineName = monitoringData.lineName || "";
                assignmentProcessName = monitoringData.processName || "";
            } catch (e) {
                // Keep sheet usable if fallback lookup fails.
            }

            const response = await axiosInstance.get(`/api/operator-observance/${studentId}`);

            if (response.data.success) {
                const data = response.data.data;
                if (!data.isNew) {
                    setHeaderData({
                        lineName: data.lineName || assignmentLineName || "",
                        processName: data.processName || assignmentProcessName || "",
                        level1Date: data.level1Date ? new Date(data.level1Date).toISOString().split('T')[0] : "",
                        operatorNameCode: defaultOperatorNameCode || ""
                    });
                    setTableData(data.observanceData || {});
                } else {
                    setHeaderData(prev => ({
                        ...prev,
                        lineName: assignmentLineName || prev.lineName,
                        processName: assignmentProcessName || prev.processName,
                        level1Date: data.level1Date ? new Date(data.level1Date).toISOString().split('T')[0] : prev.level1Date,
                        operatorNameCode: defaultOperatorNameCode || prev.operatorNameCode,
                    }));
                }
            }
        } catch (error) {
            console.error("Error fetching observance data:", error);
            // toast.error("Failed to load observance sheet");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const payload = {
                ...headerData,
                observanceData: tableData
            };

            await axiosInstance.post(`/api/operator-observance/${studentId}`, payload);

            toast.success("Observance Sheet Saved Successfully");
        } catch (error) {
            console.error("Error saving observance data:", error);
            toast.error("Failed to save data");
        } finally {
            setSaving(false);
        }
    };

    const handleHeaderChange = (field, value) => {
        setHeaderData(prev => ({ ...prev, [field]: value }));
    };

    const handleTableChange = (rowId, colId, subField, value) => {
        setTableData(prev => {
            const row = prev[rowId] || {};
            const col = row[colId] || {};

            return {
                ...prev,
                [rowId]: {
                    ...row,
                    [colId]: subField ? { ...col, [subField]: value } : value
                }
            };
        });
    };

    const renderCell = (rowId, colId) => {
        const cellData = tableData[rowId]?.[colId] || {};
        return (
            <div className="flex flex-col gap-1 p-1 h-full">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] w-8">Date:</span>
                        <Input
                            type="date"
                            className="h-6 text-[10px] p-1 w-full"
                            value={cellData.date || ""}
                            onChange={(e) => handleTableChange(rowId, colId, 'date', e.target.value)}
                        />
                    </div>
                    {/* OK/NG Radio Buttons */}
                    <div className="flex items-center justify-end gap-2 text-[10px]">
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input
                                type="radio"
                                name={`${rowId}-${colId}-status`}
                                value="OK"
                                checked={cellData.status === "OK"}
                                onChange={(e) => handleTableChange(rowId, colId, 'status', e.target.value)}
                                className="w-3 h-3 text-blue-600"
                            />
                            <span>OK</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input
                                type="radio"
                                name={`${rowId}-${colId}-status`}
                                value="NG"
                                checked={cellData.status === "NG"}
                                onChange={(e) => handleTableChange(rowId, colId, 'status', e.target.value)}
                                className="w-3 h-3 text-red-600"
                            />
                            <span>NG</span>
                        </label>
                    </div>
                </div>
                <Textarea
                    className="flex-1 min-h-[50px] text-xs resize-none p-1 border-gray-200"
                    placeholder="Result..."
                    value={cellData.val || ""}
                    onChange={(e) => handleTableChange(rowId, colId, 'val', e.target.value)}
                />
            </div>
        );
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <Card className="w-full overflow-auto">
            <CardContent className="p-4 min-w-[1000px]">
                {/* Header Section */}
                <div className="border-2 border-black mb-4">
                    <div className="grid grid-cols-[3fr_1fr] border-b-2 border-black">
                        <div className="flex items-center justify-center text-3xl font-serif py-4 border-r-2 border-black">
                            Operator Observance Sheet
                        </div>
                        <div className="text-xs">
                            <div className="grid grid-cols-[1fr_1fr_1fr_1fr] border-b border-black">
                                <div className="border-r border-black"></div>
                                <div className="border-r border-black p-1">Prepared By</div>
                                <div className="border-r border-black p-1">Checked By</div>
                                <div className="p-1">Approved By</div>
                            </div>
                            <div className="grid grid-cols-[1fr_1fr_1fr_1fr] h-8 border-b border-black">
                                <div className="border-r border-black p-1 flex items-center justify-center">Sign.</div>
                                <div className="border-r border-black"></div>
                                <div className="border-r border-black"></div>
                                <div></div>
                            </div>
                            <div className="grid grid-cols-[1fr_1fr_1fr_1fr] h-8">
                                <div className="border-r border-black p-1 flex items-center justify-center">Name</div>
                                <div className="border-r border-black"></div>
                                <div className="border-r border-black"></div>
                                <div></div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 text-sm divide-x-2 divide-black">
                        <div className="p-2 flex flex-col gap-1">
                            <span className="font-semibold">Line Name-</span>
                            <Input
                                className="h-8 border-b border-black rounded-none border-t-0 border-x-0 focus-visible:ring-0 px-0"
                                value={headerData.lineName}
                                onChange={e => handleHeaderChange('lineName', e.target.value)}
                            />
                        </div>
                        <div className="p-2 flex flex-col gap-1">
                            <span className="font-semibold">Process Name-</span>
                            <Input
                                className="h-8 border-b border-black rounded-none border-t-0 border-x-0 focus-visible:ring-0 px-0"
                                value={headerData.processName}
                                onChange={e => handleHeaderChange('processName', e.target.value)}
                            />
                        </div>
                        <div className="p-2 flex flex-col gap-1">
                            <span className="font-semibold">Date of Level-1 Complete-</span>
                            <Input
                                type="date"
                                className="h-8 border-b border-black rounded-none border-t-0 border-x-0 focus-visible:ring-0 px-0"
                                value={headerData.level1Date}
                                onChange={e => handleHeaderChange('level1Date', e.target.value)}
                            />
                        </div>
                        <div className="p-2 flex flex-col gap-1">
                            <span className="font-semibold">Operator Name & Code-</span>
                            <Input
                                className="h-8 border-b border-black rounded-none border-t-0 border-x-0 focus-visible:ring-0 px-0"
                                value={headerData.operatorNameCode}
                                onChange={e => handleHeaderChange('operatorNameCode', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Table Section */}
                <div className="border-2 border-black text-sm">
                    {/* Table Header */}
                    <div className="grid grid-cols-[200px_repeat(8,1fr)_150px] divide-x border-black divide-black bg-gray-50 font-bold text-center">
                        <div className="flex items-center justify-center p-2 border-b border-black h-12">Period for Inspection--&gt;</div>
                        <div className="col-span-2 border-b border-black p-2 h-12 flex items-center justify-center">1st Observance</div>
                        <div className="col-span-2 border-b border-black p-2 h-12 flex items-center justify-center">2nd Observance</div>
                        <div className="col-span-2 border-b border-black p-2 h-12 flex items-center justify-center">3rd Observance</div>
                        <div className="col-span-2 border-b border-black p-2 h-12 flex items-center justify-center">4th Observance</div>
                        <div className="row-span-2 flex items-center justify-center p-2">Remarks (If Any)</div>

                        {/* Sub headers */}
                        <div className="border-b border-black p-2 flex items-center justify-center">Check Contents</div>

                        <div className="p-1 text-xs border-b border-black">1st Time</div>
                        <div className="p-1 text-xs border-b border-black">Reinspect (If Fail)</div>

                        <div className="p-1 text-xs border-b border-black">1st Time</div>
                        <div className="p-1 text-xs border-b border-black">Reinspect (If Fail)</div>

                        <div className="p-1 text-xs border-b border-black">1st Time</div>
                        <div className="p-1 text-xs border-b border-black">Reinspect (If Fail)</div>

                        <div className="p-1 text-xs border-b border-black">1st Time</div>
                        <div className="p-1 text-xs border-b border-black">Reinspect (If Fail)</div>
                    </div>

                    {/* Table Body */}
                    {CHECK_CONTENTS.map((row) => (
                        <div key={row.id} className="grid grid-cols-[200px_repeat(8,1fr)_150px] divide-x divide-y border-black divide-black">
                            <div className="p-2 text-sm border-black border-t">
                                <div className="font-bold">{row.title}</div>
                                <div className="text-xs text-gray-600 whitespace-pre-wrap">{row.desc}</div>
                            </div>

                            {/* 1st Obs */}
                            <div className="border-black border-t">{renderCell(row.id, 'obs1')}</div>
                            <div className="border-black border-t">{renderCell(row.id, 'obs1Re')}</div>

                            {/* 2nd Obs */}
                            <div className="border-black border-t">{renderCell(row.id, 'obs2')}</div>
                            <div className="border-black border-t">{renderCell(row.id, 'obs2Re')}</div>

                            {/* 3rd Obs */}
                            <div className="border-black border-t">{renderCell(row.id, 'obs3')}</div>
                            <div className="border-black border-t">{renderCell(row.id, 'obs3Re')}</div>

                            {/* 4th Obs */}
                            <div className="border-black border-t">{renderCell(row.id, 'obs4')}</div>
                            <div className="border-black border-t">{renderCell(row.id, 'obs4Re')}</div>

                            {/* Remarks */}
                            <div className="p-1 border-black border-t">
                                <Textarea
                                    className="w-full h-full min-h-[80px] text-xs resize-none border-none p-1 focus-visible:ring-0"
                                    value={tableData[row.id]?.remarks || ""}
                                    onChange={(e) => handleTableChange(row.id, 'remarks', null, e.target.value)}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Notes */}
                <div className="mt-4 border-2 border-black text-xs">
                    <div className="grid grid-cols-[3fr_1fr] border-b border-black">
                        <div className="p-2 border-r border-black">
                            Note: ◆ This sheet follow for the level-1 & Level-2 operator only and do inspection on mothly basis.
                        </div>
                        <div className="flex items-center justify-center font-bold bg-gray-100">
                            Revision History
                        </div>
                    </div>

                    <div className="grid grid-cols-[3fr_1fr] h-20">
                        <div className="p-2 border-r border-black flex flex-col justify-between">
                            <div>◆ If there is no abnormality found in 1st time then 2nd is not mandatory. If some lacking found in 1st time then after 1 hour training on lack points reconfirm is to be execute.</div>
                            <div>◆ During periodical inspection, inspector inspect the operator during production of 10 cycle Minimum.</div>
                        </div>
                        <div className="grid grid-cols-[1fr_2fr_2fr] divide-x divide-black h-full">
                            <div className="grid grid-rows-[auto_1fr] divide-y divide-black">
                                <div className="text-center bg-gray-50 font-bold p-1">Rev No.</div>
                                <div className="text-center p-2">00</div>
                            </div>
                            <div className="grid grid-rows-[auto_1fr] divide-y divide-black">
                                <div className="text-center bg-gray-50 font-bold p-1">Revision Date</div>
                                <div className="text-center p-2">01.04.2025</div>
                            </div>
                            <div className="grid grid-rows-[auto_1fr] divide-y divide-black">
                                <div className="text-center bg-gray-50 font-bold p-1">Revision Details</div>
                                <div className="text-center p-2">New Creation</div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-black p-1 flex justify-between text-[10px] text-gray-500">
                        <span>Doc. No:- FRM-WH-QA-277</span>
                        <span>Rev. No:00</span>
                        <span>Rev. Date : 01.04.2025</span>
                        <span>Page1:1</span>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-4">
                    <Button
                        onClick={() => exportToExcel("Operator Observance Check Sheet", { id: studentId })}
                        variant="outline"
                        className="border-green-600 text-green-600 hover:bg-green-50"
                    >
                        Export to Excel
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Observance Sheet
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default OperatorObservanceSheet;
