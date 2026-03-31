import { useRef, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IconPrinter, IconDeviceFloppy, IconArrowLeft, IconCamera, IconTrash, IconDownload } from "@tabler/icons-react";
import { exportToExcel } from "@/utils/exportHelper";
import { toast } from "sonner";
import { useGetOnJobTrainingByIdQuery, useUpdateOnJobTrainingMutation } from "@/Redux/AllApi/OnJobTrainingApi";

const OJTTrainingRecordSheet = ({ ojtId, studentName = "Associate Name", readOnly = false, onBack }) => {
    const componentRef = useRef();

    // API Hooks
    const { data: ojtData, isLoading, refetch } = useGetOnJobTrainingByIdQuery(ojtId, { skip: !ojtId });
    const [updateOnJobTraining, { isLoading: isSaving }] = useUpdateOnJobTrainingMutation();

    // State
    const [trainingData, setTrainingData] = useState({
        areaLine: "New Manpower",
        date: new Date().toISOString().split('T')[0],
        trainingGivenBy: "",
        trainingTopic: "",
        trainingStartTime: "",
        trainingEndTime: "",
        trainingDetail: "",
        trainingDetailImage: null, // Base64 image
        trainingLog: [{ id: 1, image: null, description: "" }], // List of {id, image, description}
        attendanceRecords: Array(20).fill({})
    });
    const fileInputRef = useRef(null);

    // Initialize from API data
    useEffect(() => {
        if (ojtData?.data) {
            const data = ojtData.data;
            setTrainingData(prev => ({
                ...prev,
                areaLine: data.areaLine || "New Manpower",
                date: data.trainingDate || data.date || new Date().toISOString().split('T')[0],
                trainingGivenBy: data.trainingGivenBy || "",
                trainingTopic: data.trainingTopic || "",
                trainingStartTime: data.trainingStartTime || "",
                trainingEndTime: data.trainingEndTime || "",
                // trainingDetail/Image kept for fallback, but main source is trainingLog
                trainingDetail: data.trainingDetail || "",
                trainingDetailImage: data.trainingDetailImage || null,
                trainingLog: (data.trainingLog && data.trainingLog.length > 0)
                    ? data.trainingLog
                    : (data.trainingDetail || data.trainingDetailImage)
                        ? [{ id: 1, image: data.trainingDetailImage, description: data.trainingDetail }]
                        : [{ id: 1, image: null, description: "" }],
                attendanceRecords: data.attendanceRecords || Array(20).fill({})
            }));
        }
    }, [ojtData]);

    const handleInputChange = (field, value) => {
        if (readOnly) return;
        setTrainingData(prev => ({ ...prev, [field]: value }));
    };

    const handleAttendanceChange = (index, field, value) => {
        if (readOnly) return;
        const newRecords = [...trainingData.attendanceRecords];
        newRecords[index] = { ...newRecords[index], [field]: value };
        setTrainingData(prev => ({ ...prev, attendanceRecords: newRecords }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setTrainingData(prev => ({ ...prev, trainingDetailImage: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setTrainingData(prev => ({ ...prev, trainingDetailImage: null }));
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
                    ...trainingData,
                    trainingDate: trainingData.date // Map to backend field name
                }
            };

            await updateOnJobTraining(payload).unwrap();
            toast.success("Training record saved successfully!");
            refetch();
        } catch (error) {
            toast.error(error?.data?.message || "Failed to save training record");
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (isLoading) return <div className="p-4 text-center">Loading training record...</div>;

    return (
        <div className="space-y-6 print:space-y-0 text-xs text-black">
            <style>
                {`
@media print {
    body * {
        visibility: hidden;
    }
    #printable - content, #printable - content * {
        visibility: visible;
    }
    #printable - content {
        position: absolute;
        left: 0;
        top: 0;
        width: 100 %;
        height: 100 %;
        overflow: hidden;
    }
                        .no - print {
        display: none!important;
    }
    input, textarea {
        border: none!important;
        background: transparent!important;
        padding: 0!important;
    }
                        * {
                            - webkit - print - color - adjust: exact!important;
    print - color - adjust: exact!important;
}
                    }
`}
            </style>

            {/* Action Bar */}
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm no-print border">
                <div className="flex items-center gap-4">
                    {onBack && (
                        <Button variant="outline" size="sm" onClick={onBack}>
                            <IconArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                    )}
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">OJT Training Record Sheet</h1>
                        <p className="text-sm text-gray-500">Training record and attendance</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {!readOnly && (
                        <Button onClick={handleSave} disabled={isSaving} className="gap-2 bg-blue-600 hover:bg-blue-700">
                            <IconDeviceFloppy className="w-4 h-4" />
                            {isSaving ? "Saving..." : "Save"}
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        className="gap-2 border-green-600 text-green-600 hover:bg-green-50"
                        onClick={() => exportToExcel("On Job Training Record Sheet", { id: ojtId })}
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
                    <div className="p-4 min-w-[1000px] bg-white text-black" ref={componentRef} id="printable-content">
                        {/* Main Container Box */}
                        <div className="border border-black">

                            {/* Header - Company Title (Right Aligned) */}
                            <div className="text-right border-b border-black p-1">
                                <h1 className="font-bold text-[10px] uppercase">FURUKAWA MINDA ELECTRIC PVT. LTD.</h1>
                            </div>

                            {/* Title (Centered) */}
                            <div className="text-center border-b border-black p-1">
                                <h2 className="font-bold text-base uppercase">OJT TRAINING RECORD SHEET</h2>
                            </div>

                            {/* Info Rows */}
                            <div className="flex border-b border-black">
                                <div className="flex-1 p-1 pl-2 border-r border-black flex items-center">
                                    <span className="font-bold whitespace-nowrap">Area / Line :-</span>
                                    <Input
                                        disabled={readOnly}
                                        className="inline border-none h-auto p-0 ml-2 focus-visible:ring-0 text-blue-600 font-semibold flex-1"
                                        value={trainingData.areaLine}
                                        onChange={e => handleInputChange('areaLine', e.target.value)}
                                        placeholder="Enter Area/Line"
                                    />
                                </div>
                                <div className="w-[200px] p-1 pr-2 flex items-center justify-end">
                                    <span className="font-bold mr-2">Date:-</span>
                                    <Input
                                        disabled={readOnly}
                                        type="date"
                                        className="inline w-32 border-none h-auto p-0 focus-visible:ring-0 text-blue-600 font-semibold text-right"
                                        value={trainingData.date}
                                        onChange={e => handleInputChange('date', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex border-b border-black">
                                <div className="flex-1 p-1 pl-2 flex items-center">
                                    <span className="font-bold whitespace-nowrap w-32">Training Given By</span>
                                    <Input
                                        disabled={readOnly}
                                        className="inline border-none h-auto p-0 focus-visible:ring-0 text-blue-600 font-semibold flex-1 text-center"
                                        value={trainingData.trainingGivenBy}
                                        onChange={e => handleInputChange('trainingGivenBy', e.target.value)}
                                        placeholder="Trainer Name"
                                    />
                                </div>
                            </div>

                            <div className="flex border-b border-black">
                                <div className="flex-1 p-1 pl-2 flex items-center">
                                    <span className="font-bold whitespace-nowrap w-32">Training Topic</span>
                                    <Input
                                        disabled={readOnly}
                                        className="inline border-none h-auto p-0 focus-visible:ring-0 text-blue-600 font-semibold flex-1 text-center text-lg" // Larger text for topic
                                        value={trainingData.trainingTopic}
                                        onChange={e => handleInputChange('trainingTopic', e.target.value)}
                                        placeholder="Topic Name"
                                    />
                                </div>
                            </div>

                            <div className="flex border-b border-black text-xs">
                                <div className="flex-1 p-1 pl-2 border-r border-black flex items-center">
                                    <span className="font-bold whitespace-nowrap">Training Start Time :-</span>
                                    <Input
                                        disabled={readOnly}
                                        type="time"
                                        className="inline w-24 border-none h-auto p-0 ml-1 focus-visible:ring-0 text-blue-600 font-semibold"
                                        value={trainingData.trainingStartTime}
                                        onChange={e => handleInputChange('trainingStartTime', e.target.value)}
                                    />
                                </div>
                                <div className="flex-1 p-1 pl-2 border-r border-black flex items-center">
                                    <span className="font-bold whitespace-nowrap">Training End Time :-</span>
                                    <Input
                                        disabled={readOnly}
                                        type="time"
                                        className="inline w-24 border-none h-auto p-0 ml-1 focus-visible:ring-0 text-blue-600 font-semibold"
                                        value={trainingData.trainingEndTime}
                                        onChange={e => handleInputChange('trainingEndTime', e.target.value)}
                                    />
                                </div>
                                <div className="flex-1 p-1 pl-2 flex items-center">
                                    <span className="font-bold whitespace-nowrap">Training Duration :-</span>
                                    <span className="ml-2 text-blue-600 font-semibold">
                                        {/* Calculate duration simply for display if possible, or just user input? Image shows "10 min". Let's stick strictly to input or calculation. Since there is no state for duration, I will calculate it if both times exist, else show placeholder. */}
                                        {(() => {
                                            if (trainingData.trainingStartTime && trainingData.trainingEndTime) {
                                                const start = new Date(`1970-01-01T${trainingData.trainingStartTime} `);
                                                const end = new Date(`1970-01-01T${trainingData.trainingEndTime} `);
                                                const diff = (end - start) / 60000; // minutes
                                                return diff > 0 ? `${diff} min` : "--";
                                            }
                                            return "--";
                                        })()}
                                    </span>
                                </div>
                            </div>

                            {/* Training Detail Section */}
                            <div className="border-b border-black">
                                <div className="flex justify-between items-center p-1 border-b border-black dashed">
                                    <div className="text-center font-bold text-xs flex-1">Training Detail</div>
                                    {!readOnly && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-6 gap-1"
                                            onClick={() => {
                                                setTrainingData(prev => ({
                                                    ...prev,
                                                    trainingLog: [...(prev.trainingLog || []), { id: Date.now(), image: null, description: "" }]
                                                }));
                                            }}
                                        >
                                            <IconCamera className="w-3 h-3" /> Add Section
                                        </Button>
                                    )}
                                </div>
                                <div className="p-2 min-h-[120px] grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {(trainingData.trainingLog && trainingData.trainingLog.length > 0) ? (
                                        trainingData.trainingLog.map((log, index) => (
                                            <div key={log.id || index} className="border border-gray-200 p-2 rounded relative flex flex-col h-full">
                                                {/* Section Header */}
                                                {!readOnly && (
                                                    <div className="flex justify-end gap-2 mb-2 bg-gray-50 p-1 -mt-2 -mx-2 border-b border-gray-200 rounded-t">
                                                        {!log.image && (
                                                            <label className="cursor-pointer text-blue-600 hover:text-blue-800 text-[10px] flex items-center gap-1">
                                                                <IconCamera className="w-3 h-3" /> Add Image
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files[0];
                                                                        if (file) {
                                                                            const reader = new FileReader();
                                                                            reader.onloadend = () => {
                                                                                const newLog = [...trainingData.trainingLog];
                                                                                newLog[index].image = reader.result;
                                                                                setTrainingData(prev => ({ ...prev, trainingLog: newLog }));
                                                                            };
                                                                            reader.readAsDataURL(file);
                                                                        }
                                                                    }}
                                                                />
                                                            </label>
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                const newLog = trainingData.trainingLog.filter((_, i) => i !== index);
                                                                setTrainingData(prev => ({ ...prev, trainingLog: newLog }));
                                                            }}
                                                            className="text-red-500 hover:text-red-700 text-[10px] flex items-center gap-1"
                                                            title="Remove Section"
                                                        >
                                                            <IconTrash className="w-3 h-3" /> Remove
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Image Display */}
                                                {log.image && (
                                                    <div className="mb-2 relative w-full group flex justify-center bg-gray-50 border rounded p-1 min-h-[120px]">
                                                        <img src={log.image} alt="Training Attach" className="h-32 object-contain" />
                                                        {!readOnly && (
                                                            <button
                                                                onClick={() => {
                                                                    const newLog = [...trainingData.trainingLog];
                                                                    newLog[index].image = null;
                                                                    setTrainingData(prev => ({ ...prev, trainingLog: newLog }));
                                                                }}
                                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                title="Remove Image"
                                                            >
                                                                <IconTrash className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Text Area */}
                                                <Textarea
                                                    disabled={readOnly}
                                                    className="w-full h-full min-h-[80px] border-none p-1 text-sm text-blue-600 resize-none focus-visible:ring-0 leading-relaxed bg-transparent flex-1"
                                                    placeholder={`${index + 1}. Enter description...`}
                                                    value={log.description}
                                                    onChange={(e) => {
                                                        const newLog = [...trainingData.trainingLog];
                                                        newLog[index].description = e.target.value;
                                                        setTrainingData(prev => ({ ...prev, trainingLog: newLog }));
                                                    }}
                                                />
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-gray-400 text-center italic py-4">
                                            No details added. Click "Add Section" to begin.
                                        </div>
                                    )}
                                </div>
                            </div>



                            {/* Attendance Header */}
                            <div className="text-center font-bold text-xs p-1 border-b border-black">Attendance</div>

                            {/* Attendance Table */}
                            <div className="border-b border-black">
                                <table className="w-full border-collapse text-[10px]">
                                    <thead>
                                        <tr className="border-b border-black bg-gray-50 print:bg-transparent">
                                            <th className="border-r border-black p-1 w-8">S.No</th>
                                            <th className="border-r border-black p-1 w-20">Date</th>
                                            <th className="border-r border-black p-1 text-left pl-2">Name</th>
                                            <th className="border-r border-black p-1 w-16">E.Code</th>
                                            <th className="border-r border-black p-1 w-16">Section</th>

                                            <th className="border-r border-black p-1 w-8">S.No</th>
                                            <th className="border-r border-black p-1 w-20">Date</th>
                                            <th className="border-r border-black p-1 text-left pl-2">Name</th>
                                            <th className="border-r border-black p-1 w-16">E.Code</th>
                                            <th className="p-1 w-16">Section</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array(10).fill(0).map((_, i) => (
                                            <tr key={i} className="h-6 border-b border-black last:border-b-0">
                                                {/* Left Side (1-10) */}
                                                <td className="border-r border-black text-center font-bold text-blue-600">{i + 1}</td>
                                                <td className="border-r border-black p-0">
                                                    <Input disabled={readOnly} type="date" className="w-full h-full border-none p-0 text-[10px] text-center text-blue-600 focus-visible:ring-0"
                                                        value={trainingData.attendanceRecords[i]?.date || ""} onChange={e => handleAttendanceChange(i, 'date', e.target.value)} />
                                                </td>
                                                <td className="border-r border-black p-0">
                                                    <Input disabled={readOnly} className="w-full h-full border-none p-0 px-1 text-[10px] text-blue-600 focus-visible:ring-0 uppercase"
                                                        value={trainingData.attendanceRecords[i]?.name || ""} onChange={e => handleAttendanceChange(i, 'name', e.target.value)} />
                                                </td>
                                                <td className="border-r border-black p-0">
                                                    <Input disabled={readOnly} className="w-full h-full border-none p-0 text-[10px] text-center text-blue-600 focus-visible:ring-0 uppercase"
                                                        value={trainingData.attendanceRecords[i]?.ecode || ""} onChange={e => handleAttendanceChange(i, 'ecode', e.target.value)} />
                                                </td>
                                                <td className="border-r border-black p-0">
                                                    <Input disabled={readOnly} className="w-full h-full border-none p-0 text-[10px] text-center text-blue-600 focus-visible:ring-0 uppercase"
                                                        value={trainingData.attendanceRecords[i]?.department || ""} onChange={e => handleAttendanceChange(i, 'department', e.target.value)} />
                                                </td>

                                                {/* Right Side (11-20) */}
                                                <td className="border-r border-black text-center font-bold text-blue-600">{i + 11}</td>
                                                <td className="border-r border-black p-0">
                                                    <Input disabled={readOnly} type="date" className="w-full h-full border-none p-0 text-[10px] text-center text-blue-600 focus-visible:ring-0"
                                                        value={trainingData.attendanceRecords[i + 10]?.date || ""} onChange={e => handleAttendanceChange(i + 10, 'date', e.target.value)} />
                                                </td>
                                                <td className="border-r border-black p-0">
                                                    <Input disabled={readOnly} className="w-full h-full border-none p-0 px-1 text-[10px] text-blue-600 focus-visible:ring-0 uppercase"
                                                        value={trainingData.attendanceRecords[i + 10]?.name || ""} onChange={e => handleAttendanceChange(i + 10, 'name', e.target.value)} />
                                                </td>
                                                <td className="border-r border-black p-0">
                                                    <Input disabled={readOnly} className="w-full h-full border-none p-0 text-[10px] text-center text-blue-600 focus-visible:ring-0 uppercase"
                                                        value={trainingData.attendanceRecords[i + 10]?.ecode || ""} onChange={e => handleAttendanceChange(i + 10, 'ecode', e.target.value)} />
                                                </td>
                                                <td className="p-0">
                                                    <Input disabled={readOnly} className="w-full h-full border-none p-0 text-[10px] text-center text-blue-600 focus-visible:ring-0 uppercase"
                                                        value={trainingData.attendanceRecords[i + 10]?.department || ""} onChange={e => handleAttendanceChange(i + 10, 'department', e.target.value)} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer Section */}
                            <div className="grid grid-cols-2 text-xs border-b border-black">
                                <div className="border-r border-black p-1 flex items-center h-8">
                                    <span className="font-bold">Prepared By :-</span>
                                </div>
                                <div className="p-1 flex items-center h-8">
                                    <span className="font-bold">Checked By :-</span>
                                </div>
                            </div>
                        </div>

                        {/* Document Validation Footer - Outside the main border to look like page footer */}
                        <div className="flex justify-between text-[10px] font-bold p-1 border border-black border-t-0 uppercase">
                            <div>FRM-WH-QA-178</div>
                            <div className="flex gap-12">
                                <span>REV: 02</span>
                                <span>REV DATE: 19.06.2021</span>
                            </div>
                            <div>PAGE: 1 OF 1</div>
                        </div>

                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default OJTTrainingRecordSheet;
