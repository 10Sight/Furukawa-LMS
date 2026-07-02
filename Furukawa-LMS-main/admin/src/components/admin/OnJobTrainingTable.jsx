import { useRef, useState, useEffect } from "react";
// import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPrinter, IconDownload, IconDeviceFloppy, IconArrowLeft, IconCamera, IconTrash } from "@tabler/icons-react"; // cspell:ignore tabler motherson marelli Incharge IATF
import { exportToExcel } from "@/utils/exportHelper";
import { toast } from "sonner";
import { useGetOnJobTrainingByIdQuery, useUpdateOnJobTrainingMutation } from "@/Redux/AllApi/OnJobTrainingApi";

const OnJobTrainingTable = ({ ojtId, studentName = "Associate Name", model = "Model Name", readOnly = false, onBack }) => {
    const componentRef = useRef();
    const fileInputRef = useRef(null);

    // API Hooks
    // If ojtId is passed, use it. Otherwise fall back to studentId (legacy/fallback support if needed, but we are moving to ID based)
    const { data: ojtData, isLoading, refetch } = useGetOnJobTrainingByIdQuery(ojtId, { skip: !ojtId });
    const [updateOnJobTraining, { isLoading: isSaving }] = useUpdateOnJobTrainingMutation();

    // Local State
    const [entries, setEntries] = useState(Array(15).fill({}));
    const [remarks, setRemarks] = useState("");
    const [remarkImage, setRemarkImage] = useState(null); // Base64 image

    // Doc Details State
    const [docDetails, setDocDetails] = useState({
        docNo: "",
        revNo: "06",
        revDate: "15-06-2024"
    });

    // Header Info
    const [headerInfo, setHeaderInfo] = useState({
        name: "",
        line: "",
        machine: "",
        doj: ""
    });

    // Summary State
    const [summary, setSummary] = useState({
        totalMarks: "36",
        totalMarksObtained: "",
        totalPercentage: "",
        result: "",
    });

    // Initialize state when data is fetched
    useEffect(() => {
        if (ojtData?.data) {
            const data = ojtData.data;
            const fetchedEntries = data.entries || [];
            // Merge fetched entries with empty rows to ensure 15 rows always
            const mergedEntries = Array(15).fill({}).map((_, i) => fetchedEntries[i] || {});
            setEntries(mergedEntries);

            setRemarks(data.remarks || "");
            setRemarkImage(data.remarkImage || null);
            setSummary({
                totalMarks: data.totalMarks || "36",
                totalMarksObtained: data.totalMarksObtained || "",
                totalPercentage: data.totalPercentage || "",
                result: data.result || "",
            });

            // Set Doc Details
            setDocDetails({
                docNo: data.docNo || "",
                revNo: data.revNo || "06",
                revDate: data.revDate || "15-06-2024"
            });

            // Populate Header Info from relation
            setHeaderInfo({
                name: data.name || "Level-1 Practical Evaluation of On the Job Training",
                line: data.line?.name || "",
                machine: data.machine?.name + (data.machine?.machineName ? ` (${data.machine.machineName})` : "") || "",
                // defaulting DOJ to createdAt if not stored explicitly, or empty
                doj: data.student?.createdAt ? new Date(data.student.createdAt).toLocaleDateString() : ""
            });
        }
    }, [ojtData]);

    // Auto-calculate Percentage
    useEffect(() => {
        const total = parseFloat(summary.totalMarks);
        const obtained = parseFloat(summary.totalMarksObtained);

        if (!isNaN(total) && !isNaN(obtained) && total > 0) {
            const percentage = ((obtained / total) * 100).toFixed(2);
            setSummary(prev => {
                if (prev.totalPercentage !== percentage) {
                    return { ...prev, totalPercentage: percentage };
                }
                return prev;
            });
        } else if ((isNaN(obtained) || obtained === 0) && summary.totalPercentage !== "") {
            // Optional: iterate to clear percentage if input is cleared? 
            // Better to keep it simple. If fields are empty, maybe clear percentage?
            // "have to automatic percentage" - implies if I delete marks, percentage should probably go away or be 0.
            // Let's set it to "" if values are invalid to keep UI clean.
            setSummary(prev => {
                if (prev.totalPercentage !== "") {
                    return { ...prev, totalPercentage: "" };
                }
                return prev;
            });
        }
    }, [summary.totalMarks, summary.totalMarksObtained, summary.totalPercentage]);

    const handlePrint = () => {
        window.print();
    };

    const handleEntryChange = (index, field, value) => {
        if (readOnly) return;
        if (field === 'date' && value) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const enteredDate = new Date(value);
            enteredDate.setHours(0, 0, 0, 0);
            if (enteredDate < today) {
                toast.error("You cannot select a past date");
                return;
            }
        }
        const newEntries = [...entries];
        newEntries[index] = { ...newEntries[index], [field]: value };
        setEntries(newEntries);
    };

    const handleSummaryChange = (field, value) => {
        if (readOnly) return;
        setSummary(prev => ({ ...prev, [field]: value }));
    };

    const handleDocDetailChange = (field, value) => {
        if (readOnly) return;
        setDocDetails(prev => ({ ...prev, [field]: value }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setRemarkImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setRemarkImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSave = async () => {
        if (!ojtId) {
            toast.error("OJT ID is missing");
            return;
        }
        try {
            const payload = {
                id: ojtId,
                data: {
                    entries,
                    remarks,
                    remarkImage,
                    totalMarks: summary.totalMarks,
                    totalMarksObtained: summary.totalMarksObtained,
                    totalPercentage: summary.totalPercentage,
                    result: summary.result,
                    ...docDetails
                }
            };

            await updateOnJobTraining(payload).unwrap();
            toast.success("Evaluation saved successfully!");
            refetch();
        } catch (error) {
            toast.error(error?.data?.message || "Failed to save evaluation");
        }
    };

    if (isLoading) return <div className="p-4 text-center">Loading evaluation data...</div>;

    return (
        <div className="space-y-6 print:space-y-0 text-xs sm:text-xs">
            <style>
                {`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-content, #printable-content * {
              visibility: visible;
            }
            #printable-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .no-print {
              display: none !important;
            }
            input {
                border: none !important;
                background: transparent !important;
                padding: 0 !important;
                text-align: center;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}
            </style>
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm no-print border">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={onBack}>
                        <IconArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">{headerInfo.name || "On Job Training Evaluation"}</h1>
                        <p className="text-sm text-gray-500">
                            Level-1 Practical Evaluation of On the Job Training
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {!readOnly && (
                        <Button onClick={handleSave} disabled={isSaving} className="gap-2 bg-blue-600 hover:bg-blue-700">
                            <IconDeviceFloppy className="w-4 h-4" />
                            {isSaving ? "Saving..." : "Save Data"}
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        className="gap-2 border-green-600 text-green-600 hover:bg-green-50"
                        onClick={() => exportToExcel("On Job Training Evaluation Sheet", { id: ojtId })}
                    >
                        <IconDownload className="w-4 h-4" />
                        Export
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={handlePrint}>
                        <IconPrinter className="w-4 h-4" />
                        Print Form
                    </Button>
                </div>
            </div>

            <Card className="overflow-hidden border-none shadow-none">
                <CardContent className="p-0 overflow-x-auto">
                    <div className="p-2 min-w-[1200px] bg-white" ref={componentRef} id="printable-content">
                        {/* Header Details */}
                        <div className="flex justify-between items-start mb-2 border-b-2 border-black pb-2">
                            <div className="flex items-center gap-4">
                                <img src="/fme_transparent.png" alt="Logo" className="h-8 md:h-10" />
                                <h2 className="font-bold text-lg border-b border-black">{headerInfo.name || "Level-1 Practical Evaluation of On the Job Training"}</h2>
                            </div>
                            <div className="grid grid-cols-1 border border-black text-xs">
                                <div className="flex border-b border-black">
                                    <span className="p-1 border-r border-black font-semibold bg-gray-100 w-20">Doc. No.</span>
                                    <span className="p-1 w-32">
                                        <Input disabled={readOnly}
                                            className="h-full w-full border-none p-1 focus-visible:ring-0"
                                            value={docDetails.docNo}
                                            onChange={e => handleDocDetailChange('docNo', e.target.value)}
                                        />
                                    </span>
                                </div>
                                <div className="flex border-b border-black">
                                    <span className="p-1 border-r border-black font-semibold bg-gray-100 w-20">Rev. No.</span>
                                    <span className="p-1 w-32">
                                        <Input disabled={readOnly}
                                            className="h-full w-full border-none p-1 focus-visible:ring-0"
                                            value={docDetails.revNo}
                                            onChange={e => handleDocDetailChange('revNo', e.target.value)}
                                        />
                                    </span>
                                </div>
                                <div className="flex">
                                    <span className="p-1 border-r border-black font-semibold bg-gray-100 w-20">Rev. Date</span>
                                    <span className="p-1 w-32">
                                        <Input disabled={readOnly}
                                            className="h-full w-full border-none p-1 focus-visible:ring-0"
                                            value={docDetails.revDate}
                                            onChange={e => handleDocDetailChange('revDate', e.target.value)}
                                        />
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mb-4 grid grid-cols-2 gap-8 text-xs">
                            <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
                                <span className="font-bold">Model:</span>
                                <div className="border-b border-black h-5 px-2 font-medium">{model}</div>
                                <span className="font-bold">Name of Associate:</span>
                                <div className="border-b border-black h-5 px-2 font-medium">{studentName}</div>
                            </div>
                            <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
                                <span className="font-bold">Line/Machine:</span>
                                <div className="border-b border-black h-5 px-2 font-medium">{headerInfo.line} / {headerInfo.machine}</div>
                                <span className="font-bold">Date of Joining:</span>
                                <div className="border-b border-black h-5 px-2 font-medium">{headerInfo.doj}</div>
                                <span className="font-bold">Created Date:</span>
                                <div className="border-b border-black h-5 px-2 font-medium">
                                    {ojtData?.data?.createdAt ? new Date(ojtData.data.createdAt).toLocaleDateString() : ""}
                                </div>
                            </div>
                        </div>

                        {/* Main Table */}
                        <div className="border border-black mb-4">
                            <table className="w-full text-center text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 font-bold">
                                        <th rowSpan="2" className="border border-black p-1 w-16">Date</th>
                                        <th rowSpan="2" className="border border-black p-1 w-12">HOURS</th>
                                        <th rowSpan="2" className="border border-black p-1 w-20">PRODUCTION TARGET</th>
                                        <th rowSpan="2" className="border border-black p-1 w-20">TOTAL PART PRODUCTION</th>
                                        <th rowSpan="2" className="border border-black p-1 w-16">OK PARTS</th>
                                        <th rowSpan="2" className="border border-black p-1 w-16">Rejection</th>
                                        <th colSpan="2" className="border border-black p-1">CYCLE TIME</th>
                                        <th rowSpan="2" className="border border-black p-1 bg-gray-200">NC Tag (critical)</th>
                                        <th rowSpan="2" className="border border-black p-1">ESCALATION SYSTEM</th>
                                        <th rowSpan="2" className="border border-black p-1">SOS FOLLOW</th>
                                        <th rowSpan="2" className="border border-black p-1 bg-gray-200">Customer Complaint (critical)</th>
                                        <th rowSpan="2" className="border border-black p-1">PPE USES</th>
                                        <th rowSpan="2" className="border border-black p-1">Associate sign</th>
                                        <th rowSpan="2" className="border border-black p-1">MTS Trainer Sign</th>
                                        <th rowSpan="2" className="border border-black p-1">TL Sign</th>
                                        <th rowSpan="2" className="border border-black p-1">Shift Incharge Sign</th>
                                    </tr>
                                    <tr className="bg-gray-100 font-bold">
                                        <th className="border border-black p-1 w-12">Target</th>
                                        <th className="border border-black p-1 w-12">Actual</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((row, index) => (
                                        <tr key={index}>
                                            <td className="border border-black p-0 h-8">
                                                <Input disabled={readOnly} className="h-full w-full border-none text-center p-0 focus-visible:ring-0"
                                                    value={row.date?.toString().split('T')[0] ?? ""}
                                                    onChange={e => handleEntryChange(index, 'date', e.target.value)} type="date"
                                                    min={new Date().toLocaleDateString('en-CA')} />
                                            </td>
                                            <td className="border border-black p-0"><Input disabled={readOnly} className="h-full w-full border-none text-center p-0 focus-visible:ring-0" value={row.hours ?? ""} onChange={e => handleEntryChange(index, 'hours', e.target.value)} /></td>
                                            <td className="border border-black p-0"><Input disabled={readOnly} className="h-full w-full border-none text-center p-0 focus-visible:ring-0" value={row.productionTarget ?? ""} onChange={e => handleEntryChange(index, 'productionTarget', e.target.value)} /></td>
                                            <td className="border border-black p-0"><Input disabled={readOnly} className="h-full w-full border-none text-center p-0 focus-visible:ring-0" value={row.totalPartProduction ?? ""} onChange={e => handleEntryChange(index, 'totalPartProduction', e.target.value)} /></td>
                                            <td className="border border-black p-0"><Input disabled={readOnly} className="h-full w-full border-none text-center p-0 focus-visible:ring-0" value={row.okParts ?? ""} onChange={e => handleEntryChange(index, 'okParts', e.target.value)} /></td>
                                            <td className="border border-black p-0"><Input disabled={readOnly} className="h-full w-full border-none text-center p-0 focus-visible:ring-0" value={row.rejection ?? ""} onChange={e => handleEntryChange(index, 'rejection', e.target.value)} /></td>
                                            <td className="border border-black p-0"><Input disabled={readOnly} className="h-full w-full border-none text-center p-0 focus-visible:ring-0" value={row.cycleTimeTarget ?? ""} onChange={e => handleEntryChange(index, 'cycleTimeTarget', e.target.value)} /></td>
                                            <td className="border border-black p-0"><Input disabled={readOnly} className="h-full w-full border-none text-center p-0 focus-visible:ring-0" value={row.cycleTimeActual ?? ""} onChange={e => handleEntryChange(index, 'cycleTimeActual', e.target.value)} /></td>
                                            <td className="border border-black p-0 bg-gray-50"><Input disabled={readOnly} className="h-full w-full border-none text-center p-0 bg-transparent focus-visible:ring-0" value={row.ncTag ?? ""} onChange={e => handleEntryChange(index, 'ncTag', e.target.value)} /></td>
                                            <td className="border border-black p-0"><Input disabled={readOnly} className="h-full w-full border-none text-center p-0 focus-visible:ring-0" value={row.escalationSystem ?? ""} onChange={e => handleEntryChange(index, 'escalationSystem', e.target.value)} /></td>
                                            <td className="border border-black p-0"><Input disabled={readOnly} className="h-full w-full border-none text-center p-0 focus-visible:ring-0" value={row.sosFollow ?? ""} onChange={e => handleEntryChange(index, 'sosFollow', e.target.value)} /></td>
                                            <td className="border border-black p-0 bg-gray-50"><Input disabled={readOnly} className="h-full w-full border-none text-center p-0 bg-transparent focus-visible:ring-0" value={row.customerComplaint ?? ""} onChange={e => handleEntryChange(index, 'customerComplaint', e.target.value)} /></td>
                                            <td className="border border-black p-0"><Input disabled={readOnly} className="h-full w-full border-none text-center p-0 focus-visible:ring-0" value={row.ppeUses ?? ""} onChange={e => handleEntryChange(index, 'ppeUses', e.target.value)} /></td>
                                            <td className="border border-black p-0"><Input disabled={readOnly} className="h-full w-full border-none text-center p-0 focus-visible:ring-0" value={row.associateSign ?? ""} onChange={e => handleEntryChange(index, 'associateSign', e.target.value)} /></td>
                                            <td className="border border-black p-0"><Input disabled={readOnly} className="h-full w-full border-none text-center p-0 focus-visible:ring-0" value={row.mtsTrainerSign ?? ""} onChange={e => handleEntryChange(index, 'mtsTrainerSign', e.target.value)} /></td>
                                            <td className="border border-black p-0"><Input disabled={readOnly} className="h-full w-full border-none text-center p-0 focus-visible:ring-0" value={row.tlSign ?? ""} onChange={e => handleEntryChange(index, 'tlSign', e.target.value)} /></td>
                                            <td className="border border-black p-0"><Input disabled={readOnly} className="h-full w-full border-none text-center p-0 focus-visible:ring-0" value={row.shiftInchargeSign ?? ""} onChange={e => handleEntryChange(index, 'shiftInchargeSign', e.target.value)} /></td>
                                        </tr>
                                    ))}

                                    {/* Summary Rows */}
                                    <tr>
                                        <td className="border border-black p-1 font-bold">Total</td>
                                        <td className="border border-black p-1 font-bold">{entries.reduce((sum, row) => sum + (Number(row.hours) || 0), 0)}</td>
                                        <td className="border border-black p-1 font-bold">{entries.reduce((sum, row) => sum + (Number(row.productionTarget) || 0), 0)}</td>
                                        <td className="border border-black p-1 font-bold">{entries.reduce((sum, row) => sum + (Number(row.totalPartProduction) || 0), 0)}</td>
                                        <td className="border border-black p-1 font-bold">{entries.reduce((sum, row) => sum + (Number(row.okParts) || 0), 0)}</td>
                                        <td className="border border-black p-1 font-bold">{entries.reduce((sum, row) => sum + (Number(row.rejection) || 0), 0)}</td>
                                        <td className="border border-black p-1 font-bold">{entries.reduce((sum, row) => sum + (Number(row.cycleTimeTarget) || 0), 0)}</td>
                                        <td className="border border-black p-1 font-bold">{entries.reduce((sum, row) => sum + (Number(row.cycleTimeActual) || 0), 0)}</td>
                                        <td colSpan={5} rowSpan={3} className="border border-black p-0 align-top">
                                            <div className="flex h-full">
                                                <div className="flex-1 flex flex-col border-r border-black">
                                                    <div className="border-b border-black flex-1 flex items-center justify-center p-1 text-center font-bold text-[10px]">Average Pass &gt; 90%<br />Fail &lt; 90%</div>
                                                    <div className="flex-1"></div>
                                                </div>
                                                <div className="w-20 border-r border-black flex flex-col">
                                                    <div className="border-b border-black p-1 font-bold text-center text-[10px] h-10 flex items-center justify-center">TOTAL MARKS</div>
                                                    <div className="flex-1 p-0">
                                                        <Input disabled={readOnly}
                                                            className="h-full w-full border-none text-center text-lg font-bold p-0 focus-visible:ring-0"
                                                            value={summary.totalMarks}
                                                            onChange={e => handleSummaryChange('totalMarks', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="w-20 border-r border-black flex flex-col">
                                                    <div className="border-b border-black p-1 font-bold text-center text-[10px] h-10 flex items-center justify-center">TOTAL MARKS OBTAINED</div>
                                                    <div className="flex-1 p-0">
                                                        <Input disabled={readOnly}
                                                            className="h-full w-full border-none text-center text-lg font-bold p-0 focus-visible:ring-0"
                                                            value={summary.totalMarksObtained}
                                                            onChange={e => handleSummaryChange('totalMarksObtained', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="w-16 border-r border-black flex flex-col">
                                                    <div className="border-b border-black p-1 font-bold text-center text-[10px] h-10 flex items-center justify-center">Total %</div>
                                                    <div className="flex-1 p-0">
                                                        <Input disabled={readOnly}
                                                            className="h-full w-full border-none text-center text-lg font-bold p-0 focus-visible:ring-0"
                                                            value={summary.totalPercentage}
                                                            onChange={e => handleSummaryChange('totalPercentage', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="w-16 flex flex-col">
                                                    <div className="border-b border-black p-1 font-bold text-center text-[10px] h-10 flex items-center justify-center" >Result</div>
                                                    <div className="flex-1 p-0 h-full">
                                                        <select
                                                            disabled={readOnly}
                                                            className={`h-full w-full border-none text-center text-lg font-bold p-0 focus:outline-none bg-transparent ${summary.result === 'Pass' ? 'text-green-600' : summary.result === 'Fail' ? 'text-red-600' : ''}`}
                                                            value={summary.result}
                                                            onChange={e => handleSummaryChange('result', e.target.value)}
                                                        >
                                                            <option value="">Select</option>
                                                            <option value="Pass" className="text-green-600">Pass</option>
                                                            <option value="Fail" className="text-red-600">Fail</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td colSpan={3} className="border border-black p-1 bg-gray-200"></td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black p-1 font-bold">Evaluation %</td>
                                        <td className="border border-black p-1"></td>
                                        <td className="border border-black p-1"></td>
                                        <td className="border border-black p-1"></td>
                                        <td className="border border-black p-1"></td>
                                        <td className="border border-black p-1"></td>
                                        <td className="border border-black p-1 bg-gray-200"></td>
                                        <td className="border border-black p-1"></td>
                                        <td colSpan={3} className="border border-black p-1 bg-gray-200"></td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black p-1 font-bold">Evaluation Mark</td>
                                        <td className="border border-black p-1"></td>
                                        <td className="border border-black p-1"></td>
                                        <td className="border border-black p-1"></td>
                                        <td className="border border-black p-1"></td>
                                        <td className="border border-black p-1"></td>
                                        <td className="border border-black p-1 bg-gray-200"></td>
                                        <td className="border border-black p-1"></td>
                                        <td colSpan={3} className="border border-black p-1 bg-gray-200"></td>
                                    </tr>
                                    <tr>
                                        <td colSpan={13} className="border border-black p-1 text-right font-bold pr-4">Result- Pass/ Fail</td>
                                        <td colSpan={5} className="border border-black p-1"></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Scoring Matrix */}
                        <div className="border border-black mb-4">
                            <table className="w-full text-center text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th colSpan={2} className="border border-black p-1 w-32">Total Production</th>
                                        <th colSpan={2} className="border border-black p-1 w-32">OK Production</th>
                                        <th colSpan={2} className="border border-black p-1 w-32">Rejection</th>
                                        <th colSpan={2} className="border border-black p-1 w-32">Average Cycle Time</th>
                                        <th className="border border-black p-1 w-40">Process</th>
                                        <th className="border border-black p-1 w-20">Follow (Aware)</th>
                                        <th className="border border-black p-1 w-20">Not Follow (Not Aware)</th>
                                        {/* Empty columns to match table width */}
                                        <th className="border border-black p-1 bg-gray-50 flex-1"></th>
                                        <th className="border border-black p-1 bg-gray-50 flex-1"></th>
                                        <th className="border border-black p-1 bg-gray-50 flex-1"></th>
                                        <th className="border border-black p-1 bg-gray-50 flex-1"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="border border-black p-1 text-left pl-2">Target Achieved above - 95%</td>
                                        <td className="border border-black p-1 w-8">3</td>
                                        <td className="border border-black p-1 text-left pl-2">Target Achieved Above - 95%</td>
                                        <td className="border border-black p-1 w-8">3</td>
                                        <td className="border border-black p-1 text-left pl-2">Below - 0%</td>
                                        <td className="border border-black p-1 w-8">3</td>
                                        <td className="border border-black p-1 text-left pl-2">Above - 95%</td>
                                        <td className="border border-black p-1 w-8">3</td>
                                        <td className="border border-black p-1">NC Tag</td>
                                        <td className="border border-black p-1">3</td>
                                        <td className="border border-black p-1">Fail</td>
                                        <td colSpan={4} className="border border-black p-1 bg-white"></td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black p-1 text-left pl-2">Target Achieved Above - 90%</td>
                                        <td className="border border-black p-1 w-8">2</td>
                                        <td className="border border-black p-1 text-left pl-2">Target Achieved Above - 90%</td>
                                        <td className="border border-black p-1 w-8">2</td>
                                        <td className="border border-black p-1 text-left pl-2">Above - 0.5%</td>
                                        <td className="border border-black p-1 w-8">Fail</td>
                                        <td className="border border-black p-1 text-left pl-2">Above - 90%</td>
                                        <td className="border border-black p-1 w-8">1</td>
                                        <td className="border border-black p-1">Escalation</td>
                                        <td className="border border-black p-1">3</td>
                                        <td className="border border-black p-1">0</td>
                                        <td colSpan={4} className="border border-black p-1 bg-white"></td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black p-1 text-left pl-2">Target Achieved Above - 85%</td>
                                        <td className="border border-black p-1 w-8">1</td>
                                        <td className="border border-black p-1 text-left pl-2">Target Achieved Above - 85%</td>
                                        <td className="border border-black p-1 w-8">1</td>
                                        <td className="border border-black p-1 text-left pl-2">Below - 1%</td>
                                        <td className="border border-black p-1 w-8">Fail</td>
                                        <td className="border border-black p-1 text-left pl-2">Above - 85%</td>
                                        <td className="border border-black p-1 w-8">1</td>
                                        <td className="border border-black p-1">SOS</td>
                                        <td className="border border-black p-1">3</td>
                                        <td className="border border-black p-1">0</td>
                                        <td colSpan={4} className="border border-black p-1 bg-white"></td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black p-1 text-left pl-2">Target Achieved Below - 85%</td>
                                        <td className="border border-black p-1 w-8">0</td>
                                        <td className="border border-black p-1 text-left pl-2">Target Achieved Below - 85%</td>
                                        <td className="border border-black p-1 w-8">0</td>
                                        <td className="border border-black p-1 text-left pl-2">Above - 1%</td>
                                        <td className="border border-black p-1 w-8">Fail</td>
                                        <td className="border border-black p-1 text-left pl-2">Below - 85%</td>
                                        <td className="border border-black p-1 w-8">0</td>
                                        <td className="border border-black p-1">PPE</td>
                                        <td className="border border-black p-1">3</td>
                                        <td className="border border-black p-1">0</td>
                                        <td colSpan={4} className="border border-black p-1 bg-white"></td>
                                    </tr>
                                    <tr>
                                        <td colSpan={2} rowSpan={2} className="border border-black p-1"></td>
                                        <td colSpan={2} rowSpan={2} className="border border-black p-1"></td>
                                        <td colSpan={2} rowSpan={2} className="border border-black p-1"></td>
                                        <td colSpan={2} rowSpan={2} className="border border-black p-1"></td>
                                        <td className="border border-black p-1">Customer Complaint</td>
                                        <td className="border border-black p-1">3</td>
                                        <td className="border border-black p-1">Fail</td>
                                        <td colSpan={4} className="border border-black p-1 bg-white"></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Guidelines & Footer */}
                        <div className="grid grid-cols-1 border border-black text-xs mb-4">
                            <div className="grid grid-cols-[1fr_1fr] border-b border-black">
                                <div className="p-2 border-r border-black">
                                    <h3 className="font-bold underline mb-1">Guideline :-</h3>
                                    <ul className="list-disc pl-4 space-y-0.5">
                                        <li>Evaluation criteria is for quality 100% & overall 85%</li>
                                        <li>If critical operation criteria (NC Tag/Customer Complaint) fail, then result is Fail.</li>
                                        <li>Critical operation - Reprocess / NC part tracking / Customer Complaint.</li>
                                        <li>This format applicable for all Section Operator (New Joining) & External.</li>
                                    </ul>
                                </div>
                                <div className="p-2 relative">
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-bold underline">Remark :-</h3>
                                        {!readOnly && (
                                            <div>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    ref={fileInputRef}
                                                    onChange={handleImageChange}
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    title="Add Image"
                                                >
                                                    <IconCamera className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    <textarea disabled={readOnly}
                                        className="w-full h-20 border-none resize-none focus:outline-none p-1 bg-transparent"
                                        placeholder="Enter remarks here..."
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                    ></textarea>

                                    {remarkImage && (
                                        <div className="mt-2 relative inline-block group">
                                            <img src={remarkImage} alt="Remark Attachment" className="h-20 w-auto border rounded" />
                                            {!readOnly && (
                                                <button
                                                    onClick={handleRemoveImage}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Remove Image"
                                                >
                                                    <IconTrash className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Change Management Section */}
                            <div className="p-1 font-bold text-center bg-gray-100 border-b border-black">Change Management</div>
                            <div className="grid grid-cols-[100px_1fr_100px_60px_80px_1fr_80px] border-b border-black text-center font-semibold text-[10px]">
                                <div className="border-r border-black p-1">Rev No & Date</div>
                                <div className="border-r border-black p-1">What Change</div>
                                <div className="border-r border-black p-1">Why Change</div>
                                <div className="border-r border-black p-1">Rev No</div>
                                <div className="border-r border-black p-1">Rev. Date</div>
                                <div className="border-r border-black p-1">What Change</div>
                                <div className="p-1">Why Change</div>
                            </div>
                            {/* Row 1 */}
                            <div className="grid grid-cols-[100px_1fr_100px_60px_80px_1fr_80px] min-h-12 text-center text-[10px] border-b border-black">
                                <div className="border-r border-black p-1 flex items-center justify-center">Rev Date: 12/11/2018</div>
                                <div className="border-r border-black p-1 flex items-center justify-start text-left">Customer Complaint Awareness</div>
                                <div className="border-r border-black p-1 flex items-center justify-center">IATF NC</div>
                                <div className="border-r border-black p-1 flex items-center justify-center">5</div>
                                <div className="border-r border-black p-1 flex items-center justify-center">02-03-2024</div>
                                <div className="border-r border-black p-1 flex items-center justify-start text-left">Productivity, Quality & Cycle time & Format common for all Section</div>
                                <div className="p-1 flex items-center justify-center">VSA Audit</div>
                            </div>
                            {/* Row 2 */}
                            <div className="grid grid-cols-[100px_1fr_100px_60px_80px_1fr_80px] min-h-12 text-center text-[10px] border-b border-black">
                                <div className="border-r border-black p-1 flex items-center justify-center">Rev 03 Date: 02/09/2020</div>
                                <div className="border-r border-black p-1 flex items-center justify-start text-left">Company Logo Change</div>
                                <div className="border-r border-black p-1 flex items-center justify-center">Internal Audit</div>
                                <div className="border-r border-black p-1 flex items-center justify-center"></div>
                                <div className="border-r border-black p-1 flex items-center justify-center"></div>
                                <div className="border-r border-black p-1 flex items-center justify-start text-left"></div>
                                <div className="p-1 flex items-center justify-center"></div>
                            </div>
                            {/* Row 3 */}
                            <div className="grid grid-cols-[100px_1fr_100px_60px_80px_1fr_80px] min-h-12 text-center text-[10px]">
                                <div className="border-r border-black p-1 flex items-center justify-center">Rev no 4 Date 15/03/2023</div>
                                <div className="border-r border-black p-1 flex items-center justify-start text-left">Critical operation evaluation criteria change</div>
                                <div className="border-r border-black p-1 flex items-center justify-center">Customer requirement</div>
                                <div className="border-r border-black p-1 flex items-center justify-center"></div>
                                <div className="border-r border-black p-1 flex items-center justify-center"></div>
                                <div className="border-r border-black p-1 flex items-center justify-start text-left"></div>
                                <div className="p-1 flex items-center justify-center"></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 border border-black text-xs text-center font-bold">
                            <div className="p-2 border-r border-black">Prepared By</div>
                            <div className="p-2 border-r border-black">Checked By</div>
                            <div className="p-2 border-r border-black">Approved By (HOD)</div>
                            <div className="p-2">HR Head</div>
                        </div>

                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default OnJobTrainingTable;
