import { useRef, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IconPrinter, IconDeviceFloppy, IconArrowLeft, IconCamera, IconTrash, IconDownload, IconPlus, IconSend, IconCheck, IconX } from "@tabler/icons-react";
import { exportToExcel } from "@/utils/exportHelper";
import { toast } from "sonner";
import { useGetOnJobTrainingByIdQuery, useGetPublicOnJobTrainingQuery, useUpdateOnJobTrainingMutation } from "@/Redux/AllApi/OnJobTrainingApi";
import { useLogActionMutation } from "@/Redux/AllApi/AuditApi";
import UserAutocomplete from "@/components/common/UserAutocomplete";
import useRevisionInfo from "@/hooks/useRevisionInfo";

const OJTTrainingRecordSheet = ({ ojtId, shareToken, studentName = "Associate Name", readOnly = false, onBack }) => {
    const { user: authUser } = useSelector((state) => state.auth);

    const hasPermission = (permission) => {
        if (!authUser) return false;
        if (authUser.role === "SUPERADMIN" || authUser.isAdmin) return true;
        if (authUser.role === "INSTRUCTOR" || authUser.isTrainer) return true;
        return authUser.customRole?.permissions?.includes(permission);
    };

    const hasSignOffPermission = () => {
        return hasPermission("on_job_training:checked_by") || hasPermission("on_job_training:approved_by");
    };

    const componentRef = useRef();

    // API Hooks
    const { data: ojtByIdData, isLoading: isLoadingById, refetch: refetchById } = useGetOnJobTrainingByIdQuery(ojtId, { skip: !ojtId || !!shareToken });
    const { data: ojtByTokenData, isLoading: isLoadingByToken, error: shareError, refetch: refetchByToken } = useGetPublicOnJobTrainingQuery(shareToken, { skip: !shareToken });
    const ojtData = shareToken ? ojtByTokenData : ojtByIdData;
    const isLoading = shareToken ? isLoadingByToken : isLoadingById;
    const refetch = shareToken ? refetchByToken : refetchById;
    const [updateOnJobTraining, { isLoading: isSaving }] = useUpdateOnJobTrainingMutation();
    const [logAction] = useLogActionMutation();

    const revisionInfo = useRevisionInfo(
        "on-job-training",
        { docNo: "FRM-WH-QA-178", revNo: "02", revDate: "19.06.2021" },
        { departmentId: ojtData?.data?.department?.id }
    );

    // State
    const [trainingData, setTrainingData] = useState({
        areaLine: "New Manpower",
        date: new Date().toLocaleDateString('en-CA'),
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
            const computedAreaLine = data.section?.name
                ? `${data.section.name}${data.subSection?.name ? ` / ${data.subSection.name}` : ""}`
                : (data.areaLine || "New Manpower");
                
            const formatDate = (dateStr) => {
                if (!dateStr) return "";
                return new Date(dateStr).toLocaleDateString('en-CA');
            };

            const rawRecords = data.attendanceRecords || [];
            const minRows = Math.max(20, rawRecords.length);
            const formattedAttendance = Array(minRows).fill({}).map((_, idx) => {
                const rec = rawRecords[idx] || {};
                return {
                    date: formatDate(rec.date),
                    name: rec.name || "",
                    ecode: rec.ecode || "",
                    department: rec.department || "",
                    result: rec.result || "Pending"
                };
            });

            setTrainingData(prev => ({
                ...prev,
                areaLine: computedAreaLine,
                date: formatDate(data.trainingDate || data.date) || new Date().toLocaleDateString('en-CA'),
                trainingGivenBy: data.trainingGivenBy || data.creatorName || "",
                trainingTopic: data.trainingTopic || data.name || "",
                trainingStartTime: data.trainingStartTime || "",
                trainingEndTime: data.trainingEndTime || "",
                // trainingDetail/Image kept for fallback, but main source is trainingLog
                trainingDetail: data.trainingDetail || "",
                trainingDetailImage: data.trainingDetailImage || null,
                trainingLog: (data.trainingLog && data.trainingLog.length > 0)
                    ? data.trainingLog.map(item => ({ ...item }))
                    : (data.trainingDetail || data.trainingDetailImage)
                        ? [{ id: 1, image: data.trainingDetailImage, description: data.trainingDetail }]
                        : [{ id: 1, image: null, description: "" }],
                attendanceRecords: formattedAttendance
            }));
        }
    }, [ojtData]);

    const handleInputChange = (field, value) => {
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
            if (enteredDate > today) {
                toast.error("You cannot select a future date");
                return;
            }
        }
        setTrainingData(prev => ({ ...prev, [field]: value }));
    };

    const handleAttendanceChange = (index, field, value) => {
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
            if (enteredDate > today) {
                toast.error("You cannot select a future date");
                return;
            }
        }
        setTrainingData(prev => {
            const newRecords = [...prev.attendanceRecords];
            newRecords[index] = { ...newRecords[index], [field]: value };
            return { ...prev, attendanceRecords: newRecords };
        });
    };

    const handleMultipleAttendanceChange = (index, updates) => {
        if (readOnly) return;
        setTrainingData(prev => {
            const newRecords = [...prev.attendanceRecords];
            newRecords[index] = { ...newRecords[index], ...updates };
            return { ...prev, attendanceRecords: newRecords };
        });
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

    // Approves/rejects/resets a single trainee's row and immediately persists the whole
    // attendanceRecords array (self-saving, so trainers don't need a separate Save click per row).
    const handleRowStatusUpdate = async (index, newStatus) => {
        if (!ojtId) {
            toast.error("OJT ID is missing");
            return;
        }
        const updatedRecords = trainingData.attendanceRecords.map((rec, i) =>
            i === index ? { ...rec, result: newStatus } : rec
        );
        setTrainingData(prev => ({ ...prev, attendanceRecords: updatedRecords }));

        try {
            await updateOnJobTraining({
                id: ojtId,
                data: { attendanceRecords: updatedRecords }
            }).unwrap();
            toast.success(newStatus === "Pending" ? "Trainee status reset" : `Trainee ${newStatus.toLowerCase()} successfully!`);
            refetch();
        } catch (error) {
            toast.error(error?.data?.message || "Failed to update trainee status");
        }
    };

    // Approves/rejects/resets the sheet itself (Checked By). This is intentionally decoupled
    // from individual trainee rows — the backend only grants a trainee's OJT badge based on
    // their own row-level result, so sheet approval alone does not approve any trainee.
    const handleSheetStatusUpdate = async (newStatus) => {
        if (!ojtId) {
            toast.error("OJT ID is missing");
            return;
        }
        try {
            await updateOnJobTraining({
                id: ojtId,
                data: { result: newStatus }
            }).unwrap();
            toast.success(newStatus === "Pending" ? "Sheet status reset" : `Sheet ${newStatus.toLowerCase()} successfully!`);
            refetch();
        } catch (error) {
            toast.error(error?.data?.message || "Failed to update sheet status");
        }
    };

    const renderRowApproval = (index) => {
        const rec = trainingData.attendanceRecords[index];
        if (!rec || (!rec.name && !rec.ecode)) return null;
        const status = rec.result || "Pending";
        const canSignOff = !readOnly && hasSignOffPermission();

        if (status === "Pending") {
            if (!canSignOff) return null;
            return (
                <div className="flex items-center justify-center gap-1.5 no-print">
                    <button type="button" onClick={() => handleRowStatusUpdate(index, "Approved")} title="Approve" className="text-green-600 hover:text-green-800">
                        <IconCheck className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => handleRowStatusUpdate(index, "Rejected")} title="Reject" className="text-rose-600 hover:text-rose-800">
                        <IconX className="w-3.5 h-3.5" />
                    </button>
                </div>
            );
        }

        const badgeClass = status === "Approved" ? "bg-green-100 text-green-700" : "bg-rose-100 text-rose-700";
        return (
            <div className="flex items-center justify-center gap-1">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${badgeClass}`}>{status}</span>
                {canSignOff && (
                    <button type="button" onClick={() => handleRowStatusUpdate(index, "Pending")} title="Reset" className="text-gray-500 hover:text-gray-700 text-[9px] underline no-print">
                        Reset
                    </button>
                )}
            </div>
        );
    };

    const handleSave = async (sendEmail = false) => {
        if (!ojtId) {
            toast.error("OJT ID is missing");
            return;
        }
        try {
            const payload = {
                id: ojtId,
                data: {
                    ...trainingData,
                    trainingDate: trainingData.date, // Map to backend field name
                    sendEmail: sendEmail
                }
            };

            await updateOnJobTraining(payload).unwrap();
            toast.success(sendEmail ? "Training record submitted and email sent successfully!" : "Training record saved successfully!");
            refetch();
        } catch (error) {
            toast.error(error?.data?.message || "Failed to save training record");
        }
    };

    const handlePrint = () => {
        logAction({
            action: 'PRINT_ON_JOB_TRAINING_FORM',
            details: { ojtId, sheetType: "Record Sheet" }
        }).unwrap().catch((err) => console.error("Failed to log print:", err));
        window.print();
    };

    if (isLoading) return <div className="p-4 text-center">Loading training record...</div>;
    if (shareToken && shareError) return <div className="p-4 text-center text-rose-600 font-semibold">This shared link is invalid or has expired.</div>;

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
                <div className="flex flex-wrap gap-2">
                    {!readOnly && (
                        <>
                            {/* Save OJT (Standard Save) */}
                            {hasPermission("on_job_training:update") && (
                                <Button 
                                    onClick={() => handleSave(false)} 
                                    disabled={isSaving} 
                                    className="gap-2 bg-slate-600 hover:bg-slate-700 text-white font-semibold shadow-sm transition-all"
                                >
                                    <IconDeviceFloppy className="w-4 h-4" />
                                    {isSaving ? "Saving..." : "Save OJT"}
                                </Button>
                            )}

                            {/* Submit & Send Email */}
                            {hasPermission("on_job_training:update") && (
                                <Button 
                                    onClick={() => handleSave(true)} 
                                    disabled={isSaving} 
                                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-all"
                                >
                                    <IconSend className="w-4 h-4" />
                                    {isSaving ? "Submitting..." : "Submit & Send Email"}
                                </Button>
                            )}
                        </>
                    )}
                    <Button
                        variant="outline"
                        className="gap-2 border-green-600 text-green-600 hover:bg-green-50"
                        onClick={() => {
                            logAction({
                                action: 'EXPORT_ON_JOB_TRAINING_EXCEL',
                                details: { ojtId, sheetType: "Record Sheet" }
                            }).unwrap().catch((err) => console.error("Failed to log export:", err));
                            exportToExcel("On Job Training Record Sheet", { id: ojtId });
                        }}
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
                                        className="inline border-none h-auto p-0 ml-2 focus-visible:ring-0 text-blue-600 font-semibold flex-1 disabled:opacity-100 disabled:text-blue-900 disabled:font-bold"
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
                                        className="inline w-32 border-none h-auto p-0 focus-visible:ring-0 text-blue-600 font-semibold text-right disabled:opacity-100 disabled:text-blue-900 disabled:font-bold"
                                        value={trainingData.date}
                                        onChange={e => handleInputChange('date', e.target.value)}
                                        min={new Date().toLocaleDateString('en-CA')}
                                        max={new Date().toLocaleDateString('en-CA')}
                                    />
                                </div>
                            </div>

                            <div className="flex border-b border-black text-xs">
                                <div className="flex-1 p-1 pl-2 flex items-center">
                                    <span className="font-bold whitespace-nowrap">Training Given By :-</span>
                                    <Input
                                        disabled={readOnly}
                                        className="inline border-none h-auto p-0 ml-2 focus-visible:ring-0 text-blue-600 font-semibold flex-1 text-left disabled:opacity-100 disabled:text-blue-900 disabled:font-bold"
                                        value={trainingData.trainingGivenBy}
                                        onChange={e => handleInputChange('trainingGivenBy', e.target.value)}
                                        placeholder="Trainer Name"
                                    />
                                </div>
                            </div>

                            <div className="flex border-b border-black text-xs">
                                <div className="flex-1 p-1 pl-2 flex items-center">
                                    <span className="font-bold whitespace-nowrap">Training Topic :-</span>
                                    <Input
                                        disabled={readOnly}
                                        className="inline border-none h-auto p-0 ml-2 focus-visible:ring-0 text-blue-600 font-semibold flex-1 text-left disabled:opacity-100 disabled:text-blue-900 disabled:font-bold"
                                        value={trainingData.trainingTopic}
                                        onChange={e => handleInputChange('trainingTopic', e.target.value)}
                                        placeholder="Topic Name"
                                    />
                                </div>
                            </div>

                            <div className="flex border-b border-black text-xs">
                                <div className="flex-1 p-1 pl-2 flex items-center">
                                    <span className="font-bold whitespace-nowrap">Sheet Created Date :-</span>
                                    <span className="ml-2 text-blue-600 font-semibold">
                                        {ojtData?.data?.createdAt ? new Date(ojtData.data.createdAt).toLocaleDateString() : ""}
                                    </span>
                                </div>
                            </div>

                            <div className="flex border-b border-black text-xs">
                                <div className="flex-1 p-1 pl-2 border-r border-black flex items-center">
                                    <span className="font-bold whitespace-nowrap">Training Start Time :-</span>
                                    <Input
                                        disabled={readOnly}
                                        type="time"
                                        className="inline w-24 border-none h-auto p-0 ml-1 focus-visible:ring-0 text-blue-600 font-semibold disabled:opacity-100 disabled:text-blue-900 disabled:font-bold"
                                        value={trainingData.trainingStartTime}
                                        onChange={e => handleInputChange('trainingStartTime', e.target.value)}
                                    />
                                </div>
                                <div className="flex-1 p-1 pl-2 border-r border-black flex items-center">
                                    <span className="font-bold whitespace-nowrap">Training End Time :-</span>
                                    <Input
                                        disabled={readOnly}
                                        type="time"
                                        className="inline w-24 border-none h-auto p-0 ml-1 focus-visible:ring-0 text-blue-600 font-semibold disabled:opacity-100 disabled:text-blue-900 disabled:font-bold"
                                        value={trainingData.trainingEndTime}
                                        onChange={e => handleInputChange('trainingEndTime', e.target.value)}
                                    />
                                </div>
                                <div className="flex-1 p-1 pl-2 flex items-center">
                                    <span className="font-bold whitespace-nowrap">Training Duration :-</span>
                                    <span className="ml-2 text-blue-600 font-semibold">
                                        {(() => {
                                            if (trainingData.trainingStartTime && trainingData.trainingEndTime) {
                                                const startParts = trainingData.trainingStartTime.split(':');
                                                const endParts = trainingData.trainingEndTime.split(':');
                                                if (startParts.length >= 2 && endParts.length >= 2) {
                                                    const startMinutes = Number(startParts[0]) * 60 + Number(startParts[1]);
                                                    const endMinutes = Number(endParts[0]) * 60 + Number(endParts[1]);
                                                    let diff = endMinutes - startMinutes;
                                                    if (diff < 0) {
                                                        diff += 1440; // overnight training shift adjustment (24 hours)
                                                    }
                                                    if (diff === 0) return "0 min";
                                                    if (diff < 60) return `${diff} min`;
                                                    const hrs = Math.floor(diff / 60);
                                                    const mins = diff % 60;
                                                    return `${hrs} hr${hrs > 1 ? 's' : ''}${mins > 0 ? ` ${mins} min` : ''}`;
                                                }
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
                                                                                const newLog = trainingData.trainingLog.map((logItem, idx) => 
                                                                                    idx === index 
                                                                                        ? { ...logItem, image: reader.result } 
                                                                                        : logItem
                                                                                );
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
                                                                    const newLog = trainingData.trainingLog.map((logItem, idx) => 
                                                                        idx === index 
                                                                            ? { ...logItem, image: null } 
                                                                            : logItem
                                                                    );
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
                                                    className="w-full h-full min-h-[80px] border-none p-1 text-sm text-blue-600 resize-none focus-visible:ring-0 leading-relaxed bg-transparent flex-1 disabled:opacity-100 disabled:text-blue-900 disabled:font-bold"
                                                    placeholder={`${index + 1}. Enter description...`}
                                                    value={log.description}
                                                    onChange={(e) => {
                                                        const newLog = trainingData.trainingLog.map((logItem, idx) => 
                                                            idx === index 
                                                                ? { ...logItem, description: e.target.value } 
                                                                : logItem
                                                        );
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
                            <div className="relative flex items-center justify-center p-2 border-b border-black bg-gray-50 print:bg-transparent min-h-[32px]">
                                <span className="font-bold text-xs">Attendance</span>
                                {!readOnly && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1.5 no-print">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-5 px-2 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border-blue-200 text-[10px] flex items-center gap-1 font-medium transition-colors"
                                            onClick={() => {
                                                setTrainingData(prev => ({
                                                    ...prev,
                                                    attendanceRecords: [...prev.attendanceRecords, {}]
                                                }));
                                            }}
                                        >
                                            <IconPlus className="w-3.5 h-3.5" /> Add Row
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Attendance Table */}
                            <div className="border-b border-black">
                                <table className="w-full border-collapse text-[10px] table-fixed">
                                    <thead>
                                        <tr className="border-b border-black bg-gray-50 print:bg-transparent">
                                            <th className="border-r border-black p-1 w-[4%] text-center font-bold">S.No</th>
                                            <th className="border-r border-black p-1 w-[10%] text-center font-bold">Date</th>
                                            <th className="border-r border-black p-1 w-[20%] text-left pl-2 font-bold">Name</th>
                                            <th className="border-r border-black p-1 w-[8%] text-center font-bold">E.Code</th>
                                            <th className="border-r border-black p-1 w-[8%] text-center font-bold">Approval</th>

                                            <th className="border-r border-black p-1 w-[4%] text-center font-bold">S.No</th>
                                            <th className="border-r border-black p-1 w-[10%] text-center font-bold">Date</th>
                                            <th className="border-r border-black p-1 w-[20%] text-left pl-2 font-bold">Name</th>
                                            <th className="border-r border-black p-1 w-[8%] text-center font-bold">E.Code</th>
                                            <th className="p-1 w-[8%] text-center font-bold">Approval</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const N = trainingData.attendanceRecords.length;
                                            const half = Math.ceil(N / 2);
                                            return Array(half).fill(0).map((_, i) => {
                                                const leftIndex = i;
                                                const rightIndex = i + half;
                                                return (
                                                    <tr key={i} className="h-6 border-b border-black last:border-b-0">
                                                        {/* Left Side */}
                                                        <td className="border-r border-black text-center font-bold text-blue-600">{leftIndex + 1}</td>
                                                        <td className="border-r border-black p-0">
                                                            <Input disabled={readOnly} type="date" className="w-full h-full border-none p-0 text-[10px] text-center text-blue-600 focus-visible:ring-0 bg-transparent disabled:opacity-100 disabled:text-blue-900 disabled:font-bold"
                                                                value={trainingData.attendanceRecords[leftIndex]?.date || ""}
                                                                onChange={e => handleAttendanceChange(leftIndex, 'date', e.target.value)}
                                                                min={new Date().toLocaleDateString('en-CA')}
                                                                max={new Date().toLocaleDateString('en-CA')} />
                                                        </td>
                                                        <td className="border-r border-black p-0 overflow-visible relative">
                                                            <UserAutocomplete
                                                                compact
                                                                disabled={readOnly}
                                                                mode="all"
                                                                departmentId={ojtData?.data?.department?.id}
                                                                value={trainingData.attendanceRecords[leftIndex]?.name || ""}
                                                                onChange={(user) => {
                                                                    handleMultipleAttendanceChange(leftIndex, {
                                                                        name: user.fullName,
                                                                        ecode: user.empId || ""
                                                                    });
                                                                }}
                                                                onTextChange={(val) => handleAttendanceChange(leftIndex, 'name', val)}
                                                                placeholder="Search Name..."
                                                                inputClassName="w-full h-full border-none p-0 px-1 text-[10px] text-blue-600 focus-visible:ring-0 uppercase text-left bg-transparent rounded-none disabled:opacity-100 disabled:text-blue-900 disabled:font-bold"
                                                            />
                                                        </td>
                                                        <td className="border-r border-black p-0">
                                                            <Input disabled={readOnly} className="w-full h-full border-none p-0 text-[10px] text-center text-blue-600 focus-visible:ring-0 uppercase bg-transparent disabled:opacity-100 disabled:text-blue-900 disabled:font-bold"
                                                                value={trainingData.attendanceRecords[leftIndex]?.ecode || ""} onChange={e => handleAttendanceChange(leftIndex, 'ecode', e.target.value)} />
                                                        </td>
                                                        <td className="border-r border-black p-0.5">
                                                            {renderRowApproval(leftIndex)}
                                                        </td>

                                                        {/* Right Side */}
                                                        <td className="border-r border-black text-center font-bold text-blue-600">{rightIndex + 1}</td>
                                                        {rightIndex < N ? (
                                                            <>
                                                                <td className="border-r border-black p-0">
                                                                    <Input disabled={readOnly} type="date" className="w-full h-full border-none p-0 text-[10px] text-center text-blue-600 focus-visible:ring-0 bg-transparent disabled:opacity-100 disabled:text-blue-900 disabled:font-bold"
                                                                        value={trainingData.attendanceRecords[rightIndex]?.date || ""}
                                                                        onChange={e => handleAttendanceChange(rightIndex, 'date', e.target.value)}
                                                                        min={new Date().toLocaleDateString('en-CA')}
                                                                        max={new Date().toLocaleDateString('en-CA')} />
                                                                </td>
                                                                <td className="border-r border-black p-0 overflow-visible relative">
                                                                    <UserAutocomplete
                                                                        compact
                                                                        disabled={readOnly}
                                                                        mode="all"
                                                                        departmentId={ojtData?.data?.department?.id}
                                                                        value={trainingData.attendanceRecords[rightIndex]?.name || ""}
                                                                        onChange={(user) => {
                                                                            handleMultipleAttendanceChange(rightIndex, {
                                                                                name: user.fullName,
                                                                                ecode: user.empId || ""
                                                                            });
                                                                        }}
                                                                        onTextChange={(val) => handleAttendanceChange(rightIndex, 'name', val)}
                                                                        placeholder="Search Name..."
                                                                        inputClassName="w-full h-full border-none p-0 px-1 text-[10px] text-blue-600 focus-visible:ring-0 uppercase text-left bg-transparent rounded-none disabled:opacity-100 disabled:text-blue-900 disabled:font-bold"
                                                                    />
                                                                </td>
                                                                <td className="border-r border-black p-0">
                                                                    <Input disabled={readOnly} className="w-full h-full border-none p-0 text-[10px] text-center text-blue-600 focus-visible:ring-0 uppercase bg-transparent disabled:opacity-100 disabled:text-blue-900 disabled:font-bold"
                                                                        value={trainingData.attendanceRecords[rightIndex]?.ecode || ""} onChange={e => handleAttendanceChange(rightIndex, 'ecode', e.target.value)} />
                                                                </td>
                                                                <td className="p-0.5">
                                                                    {renderRowApproval(rightIndex)}
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td className="border-r border-black bg-gray-50/50"></td>
                                                                <td className="border-r border-black bg-gray-50/50"></td>
                                                                <td className="border-r border-black bg-gray-50/50"></td>
                                                                <td className="bg-gray-50/50"></td>
                                                            </>
                                                        )}
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer Section */}
                            <div className="grid grid-cols-2 text-xs border-b border-black">
                                <div className="border-r border-black p-1 flex items-center h-8 gap-2">
                                    <span className="font-bold">Prepared By :-</span>
                                    <span className="text-blue-900 font-bold uppercase">{ojtData?.data?.creatorName || trainingData.trainingGivenBy || "--"}</span>
                                </div>
                                <div className="p-1 flex items-center h-8 justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold">Checked By :-</span>
                                        {(() => {
                                            const sheetResult = ojtData?.data?.result || "Pending";
                                            const canSignOff = !readOnly && hasSignOffPermission();

                                            if (sheetResult === "Pending") {
                                                if (!canSignOff) return null;
                                                return (
                                                    <div className="flex items-center gap-1.5 no-print">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSheetStatusUpdate("Approved")}
                                                            title="Approve Sheet"
                                                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors duration-150"
                                                        >
                                                            <IconCheck className="w-3.5 h-3.5" /> Approve
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSheetStatusUpdate("Rejected")}
                                                            title="Reject Sheet"
                                                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors duration-150"
                                                        >
                                                            <IconX className="w-3.5 h-3.5" /> Reject
                                                        </button>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-blue-900 font-bold uppercase">
                                                        {sheetResult === "Approved"
                                                            ? (ojtData.data.approverName || "--")
                                                            : `Rejected By: ${ojtData.data.approverName || "--"}`}
                                                    </span>
                                                    {canSignOff && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSheetStatusUpdate("Pending")}
                                                            title="Reset"
                                                            className="text-gray-500 hover:text-gray-700 text-[9px] underline no-print"
                                                        >
                                                            Reset
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Document Validation Footer - Outside the main border to look like page footer */}
                        <div className="flex justify-between text-[10px] font-bold p-1 border border-black border-t-0 uppercase">
                            <div>{revisionInfo.docNo}</div>
                            <div className="flex gap-12">
                                <span>REV: {revisionInfo.revNo}</span>
                                <span>REV DATE: {revisionInfo.revDate}</span>
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
