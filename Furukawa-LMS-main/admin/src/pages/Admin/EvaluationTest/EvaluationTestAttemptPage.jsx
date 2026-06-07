import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { 
    useGetEvaluationTestByIdQuery, 
    useCreateEvaluationTestAttemptMutation,
    useGetEvaluationTestAttemptByIdQuery,
    useUpdateEvaluationTestAttemptMutation
} from "@/Redux/AllApi/EvaluationTestApi";
import { useGetAllUsersQuery } from "@/Redux/AllApi/UserApi";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { 
    IconArrowLeft, 
    IconPrinter, 
    IconDeviceFloppy, 
    IconLoader2,
    IconClipboardCheck
} from "@tabler/icons-react";

const getDynamicPerformDateCount = (attemptDataObj, performDatesArr, baseCount) => {
    let lastEvaluatedColIdx = -1;
    // Scan up to 100 columns to be safe
    for (let colIdx = 0; colIdx < 100; colIdx++) {
        const hasDate = !!performDatesArr?.[colIdx];
        let hasGrade = false;
        Object.keys(attemptDataObj || {}).forEach(qId => {
            if (qId.startsWith("_")) return;
            const score = attemptDataObj[qId]?.results?.[colIdx];
            if (score && score !== "") {
                hasGrade = true;
            }
        });
        if (hasDate || hasGrade) {
            lastEvaluatedColIdx = colIdx;
        }
    }

    // Check if there is ANY failure ("X") in ANY of the evaluated columns
    let hasFailureAnywhere = false;
    if (lastEvaluatedColIdx !== -1) {
        for (let colIdx = 0; colIdx <= lastEvaluatedColIdx; colIdx++) {
            const hasFailureInCol = Object.keys(attemptDataObj || {}).some(qId => {
                if (qId.startsWith("_")) return false;
                return attemptDataObj[qId]?.results?.[colIdx] === "X";
            });
            if (hasFailureInCol) {
                hasFailureAnywhere = true;
                break;
            }
        }
    }

    if (hasFailureAnywhere) {
        // Always provide an extra column beyond either the base template count or the last evaluated column
        return Math.max(baseCount + 1, lastEvaluatedColIdx + 2);
    }

    return Math.max(baseCount, lastEvaluatedColIdx + 1);
};

const normalizeContentStructure = (structure, fallbackTitle) => {
    if (!Array.isArray(structure) || structure.length === 0) {
        return [
            {
                id: `mt-${Date.now()}`,
                title: fallbackTitle || "1. Main Title Section",
                contentSections: []
            }
        ];
    }
    
    const isNewFormat = structure.every(item => item && Array.isArray(item.contentSections));
    
    if (isNewFormat) {
        return structure.map(block => ({
            id: block.id || `mt-${Date.now()}-${Math.random()}`,
            title: block.title || "Main Title Section",
            contentSections: Array.isArray(block.contentSections) ? block.contentSections : []
        }));
    }
    
    return [
        {
            id: "mt-auto-generated",
            title: fallbackTitle || "1. Main Title Section",
            contentSections: structure
        }
    ];
};

const EvaluationTestAttemptPage = ({ isViewMode = false }) => {
    const { id, attemptId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isPrintModeUrl = searchParams.get("mode") === "print";

    const { user } = useSelector((state) => state.auth);

    const hasPermission = (permission) => {
        if (user?.role === "SUPERADMIN" || user?.role === "ADMIN") return true;
        return user?.customRole?.permissions?.includes(permission);
    };

    const canApprove = hasPermission("dojo_evaluation_test:approve");
    const canConfirm = hasPermission("dojo_evaluation_test:confirm");

    const isView = isViewMode || !!attemptId;
    const editAttemptId = searchParams.get("attemptId") || "";
    const isEdit = !isView && !!editAttemptId;

    const queryTrainee = searchParams.get("trainee") || "";
    const queryEmpId = searchParams.get("empId") || "";

    const isStudent = user?.isEmployee || user?.role === 'STUDENT';
    const defaultTrainee = queryTrainee || (isStudent ? (user?.fullName || "") : "");
    const defaultEmpId = queryEmpId || (isStudent ? (user?.empId || "") : "");
    const defaultEducator = !isStudent ? (user?.fullName || user?.userName || "") : "";

    // Student attempt metadata states
    const [traineeName, setTraineeName] = useState(defaultTrainee);
    const [employeeNo, setEmployeeNo] = useState(defaultEmpId);
    const [educatorName, setEducatorName] = useState(defaultEducator);
    const [attemptData, setAttemptData] = useState({}); // qId -> { results: ["", ...], comment: "" }
    const [isPrintMode, setIsPrintMode] = useState(isPrintModeUrl);

    // Operator lookup states
    const [traineeSearch, setTraineeSearch] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);

    // Asynchronously synchronize details once the logged-in user finishes loading from Redux
    useEffect(() => {
        if (!isView && !isEdit && user) {
            const isUserStudent = user?.isEmployee || user?.role === 'STUDENT';
            if (!traineeName && isUserStudent) {
                setTraineeName(user.fullName || "");
            }
            if (!employeeNo && isUserStudent) {
                setEmployeeNo(user.empId || "");
            }
            if (!educatorName && !isUserStudent) {
                setEducatorName(user.fullName || user.userName || "");
            }
        }
    }, [user, isView, isEdit]);

    // RTK Query API Hooks
    // 1. Fetch template detail (if in grading mode)
    const { data: templateResponse, isLoading: isLoadingTemplate } = useGetEvaluationTestByIdQuery(id, { skip: isView || isEdit });
    // 2. Fetch saved student attempt detail (if in view mode or edit mode)
    const { data: attemptResponse, isLoading: isLoadingAttempt } = useGetEvaluationTestAttemptByIdQuery(attemptId || editAttemptId, { skip: !isView && !isEdit });
    // 3. Submit attempt mutation
    const [createAttempt, { isLoading: isSubmitting }] = useCreateEvaluationTestAttemptMutation();
    // 3b. Update attempt mutation (for approvals and incremental updates)
    const [updateAttempt] = useUpdateEvaluationTestAttemptMutation();

    // 4. Fetch users for matching trainee name / employee ID
    const { data: usersResponse } = useGetAllUsersQuery(
        { search: traineeSearch, limit: 30 },
        { skip: isView || isEdit }
    );
    const matchingUsers = usersResponse?.users || usersResponse?.data?.users || [];

    const activeTemplate = (isView || isEdit) ? attemptResponse?.data : templateResponse?.data;
    const testTitle = activeTemplate?.title || activeTemplate?.testTitle || "Evaluation Test";
    const contentStructure = React.useMemo(() => {
        return normalizeContentStructure(activeTemplate?.contentStructure || [], testTitle);
    }, [activeTemplate, testTitle]);

    // Dynamic perform date count state
    const [performDateCount, setPerformDateCount] = useState(4);

    useEffect(() => {
        if (activeTemplate?.performDateCount) {
            if (isView || isEdit) {
                const rawAttemptData = attemptResponse?.data?.attemptData || {};
                const rawPerformDates = rawAttemptData._performDates || [];
                const baseCount = activeTemplate.performDateCount || 4;
                const dynamicCount = getDynamicPerformDateCount(rawAttemptData, rawPerformDates, baseCount);
                setPerformDateCount(dynamicCount);
            } else {
                setPerformDateCount(activeTemplate.performDateCount);
            }
        }
    }, [activeTemplate, isView, isEdit, attemptResponse]);

    // Dynamic perform dates state
    const [performDates, setPerformDates] = useState([]);

    // Tracks which columns have been pre-filled in previous days to prevent editing
    const [preFilledColumns, setPreFilledColumns] = useState([]);

    // Populate data in View Mode or Edit Mode from database attempt record
    useEffect(() => {
        if ((isView || isEdit) && attemptResponse?.data) {
            const data = attemptResponse.data;
            setTraineeName(data.traineeName || "");
            setEmployeeNo(data.employeeNo || "");
            setEducatorName(data.educatorName || "");
            
            const rawAttemptData = data.attemptData || {};
            
            // Pad attemptData question results arrays to performDateCount elements
            const paddedAttemptData = { ...rawAttemptData };
            (contentStructure || []).forEach(block => {
                (block.contentSections || []).forEach(content => {
                    (content.categories || []).forEach(cat => {
                        (cat.questions || []).forEach(q => {
                            const qId = q.id;
                            const current = paddedAttemptData[qId] || { results: [], comment: "" };
                            const results = [...(current.results || [])];
                            while (results.length < performDateCount) {
                                results.push("");
                            }
                            paddedAttemptData[qId] = { ...current, results };
                        });
                    });
                });
            });
            setAttemptData(paddedAttemptData);
            
            if (rawAttemptData._performDates) {
                const rawDates = rawAttemptData._performDates || [];
                const paddedDates = [...rawDates];
                while (paddedDates.length < performDateCount) {
                    paddedDates.push("");
                }
                setPerformDates(paddedDates);
            } else {
                setPerformDates(Array.from({ length: performDateCount }).map(() => ""));
            }

            // Lock columns already filled in previous submissions
            const colsFilled = Array.from({ length: performDateCount }).map((_, colIdx) => {
                const hasDate = !!rawAttemptData._performDates?.[colIdx];
                let hasGrade = false;
                Object.keys(rawAttemptData).forEach((qId) => {
                    if (qId.startsWith("_")) return;
                    const score = rawAttemptData[qId]?.results?.[colIdx];
                    if (score && score !== "") {
                        hasGrade = true;
                    }
                });
                return hasDate || hasGrade;
            });
            setPreFilledColumns(colsFilled);
        }
    }, [isView, isEdit, attemptResponse, performDateCount, contentStructure]);

    // Keep search query synced with manual edits / selections of traineeName
    useEffect(() => {
        if (traineeName) {
            setTraineeSearch(traineeName);
        } else {
            setTraineeSearch("");
        }
    }, [traineeName]);

    // Setup empty structures for dynamic input bindings on load in Attempt Mode
    useEffect(() => {
        if (!isView && !isEdit && contentStructure.length > 0) {
            const initialData = {};
            (contentStructure || []).forEach(block => {
                (block.contentSections || []).forEach(content => {
                    (content.categories || []).forEach(cat => {
                        (cat.questions || []).forEach(q => {
                            initialData[q.id] = {
                                results: Array.from({ length: performDateCount }).map(() => ""),
                                comment: ""
                            };
                        });
                    });
                });
            });
            setAttemptData(initialData);
            setPerformDates(Array.from({ length: performDateCount }).map(() => ""));
        }
    }, [isView, contentStructure, performDateCount]);

    // Handle ESC key in print preview
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && isPrintMode && !isPrintModeUrl) {
                setIsPrintMode(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isPrintMode, isPrintModeUrl]);

    // Form inputs state mutators
    const updateGrade = (qId, colIdx, value) => {
        const current = { ...attemptData[qId] } || { results: [], comment: "" };
        const results = [...(current.results || [])];
        results[colIdx] = value;
        setAttemptData({
            ...attemptData,
            [qId]: { ...current, results }
        });
    };

    const updateComment = (qId, value) => {
        const current = { ...attemptData[qId] } || { results: [], comment: "" };
        setAttemptData({
            ...attemptData,
            [qId]: { ...current, comment: value }
        });
    };

    const handleSubmit = async () => {
        if (!traineeName.trim()) {
            alert("Please enter the Trainee Name.");
            return;
        }
        if (!employeeNo.trim()) {
            alert("Please enter the Employee Number.");
            return;
        }

        const payload = {
            testId: id,
            traineeName,
            employeeNo,
            educatorName,
            attemptData: {
                ...attemptData,
                _performDates: performDates
            }
        };

        try {
            if (isEdit) {
                await updateAttempt({
                    id: editAttemptId,
                    traineeName,
                    employeeNo,
                    educatorName,
                    attemptData: {
                        ...attemptData,
                        _performDates: performDates
                    }
                }).unwrap();
                alert("Student practical evaluation sheet updated successfully!");
            } else {
                await createAttempt(payload).unwrap();
                alert("Student practical evaluation sheet saved successfully!");
            }
            navigate(`/admin/evaluation-test/${activeTemplate?.testId || id}/operators`);
        } catch (error) {
            console.error("Failed to submit student evaluation", error);
            alert(`Error ${isEdit ? "updating" : "submitting"} student evaluation sheet.`);
        }
    };

    const handleApprovalClick = async (type, status) => {
        if (!attemptId) return;

        const userName = user?.fullName || user?.userName || "Manager";
        
        let updatedAttemptData = { ...attemptData };
        if (type === "approved") {
            updatedAttemptData._approvedStatus = status;
            updatedAttemptData._approvedBy = userName;
        } else if (type === "confirmed") {
            updatedAttemptData._confirmedStatus = status;
            updatedAttemptData._confirmedBy = userName;
        }

        try {
            await updateAttempt({
                id: attemptId,
                attemptData: updatedAttemptData
            }).unwrap();
            
            setAttemptData(updatedAttemptData);
            alert(`Evaluation attempt sheet ${status === "APPROVED" ? "approved" : "rejected"} successfully by ${userName}!`);
        } catch (error) {
            console.error("Failed to update approval status", error);
            alert("Error updating sheet approval status.");
        }
    };

    // Auto-calculate spans for perfect cell merging per Main Title block
    const getRowSpanCalculationsForBlock = (contentSections, startIdx = 1) => {
        let globalIndex = startIdx - 1;
        const rowStructure = [];

        (contentSections || []).forEach((content) => {
            let contentQCount = 0;
            const contentRows = [];

            (content.categories || []).forEach((cat) => {
                const catQCount = (cat.questions || []).length;
                contentQCount += catQCount;

                (cat.questions || []).forEach((q, qIdx) => {
                    globalIndex++;
                    contentRows.push({
                        qId: q.id,
                        qText: q.text,
                        qIndex: globalIndex,
                        catId: cat.id,
                        catTitle: cat.title,
                        catSpan: qIdx === 0 ? catQCount : 0,
                        isFirstInCat: qIdx === 0,
                        contentId: content.id,
                        contentTitle: content.title,
                        isFirstInContent: false
                    });
                });
            });

            if (contentRows.length > 0) {
                contentRows[0].isFirstInContent = true;
                contentRows[0].contentSpan = contentQCount;
            }

            rowStructure.push(...contentRows);
        });

        return { rowStructure, nextIdx: globalIndex + 1 };
    };

    const precomputedBlocks = React.useMemo(() => {
        return (contentStructure || []).map((block) => {
            const { rowStructure } = getRowSpanCalculationsForBlock(block.contentSections || [], 1);
            return {
                ...block,
                rows: rowStructure
            };
        });
    }, [contentStructure]);

    const handlePrint = () => {
        window.print();
    };

    if (isLoadingTemplate || isLoadingAttempt) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-gray-500">
                <IconLoader2 className="animate-spin text-blue-600 h-10 w-10" />
                <span className="text-sm font-medium">Loading evaluation sheet details...</span>
            </div>
        );
    }

    // High-Fidelity Spreadsheet Sheet Layout JSX
    const renderSpreadsheetTable = () => {
        return (
            <div className="bg-white text-black p-6 font-sans border-2 border-black rounded-lg shadow-sm print:border-0 print:p-0 print:shadow-none w-full overflow-x-auto select-none">
                {/* Print Styles overrides to ensure perfect paper fit */}
                <style dangerouslySetInnerHTML={{ __html: `
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        .print-sheet-area, .print-sheet-area * {
                            visibility: visible;
                        }
                        .print-sheet-area {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100% !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            border: 0 !important;
                        }
                        table {
                            width: 100% !important;
                            border-collapse: collapse !important;
                        }
                        th, td {
                            border: 1px solid black !important;
                            padding: 4px 6px !important;
                            font-size: 10px !important;
                        }
                        input {
                            border: 0 !important;
                            padding: 0 !important;
                            background: transparent !important;
                            width: 100% !important;
                            font-weight: bold !important;
                        }
                    }
                `}} />

                <div className="print-sheet-area w-full max-w-full space-y-4">
                    {/* Top metadata tags */}
                    <div className="flex justify-between items-start text-xs border-b border-black pb-2">
                        <div className="font-semibold text-[10px] sm:text-xs">FURUKAWA ELECTRICAL INDIA PVT. LTD.</div>
                        <div className="text-right text-[10px] sm:text-xs leading-tight font-mono">
                            <div>ST-S16-01 FORMAT 4 -E</div>
                            <div>Revision No. 01</div>
                            <div>Revision Date : 28.02.2025</div>
                            <div>Issue date : 17.01.2024</div>
                        </div>
                    </div>

                    {/* Sheet Main Header */}
                    <div className="flex flex-col md:flex-row justify-between gap-4 border border-black p-4 bg-gray-50/50">
                        <div className="flex-1 flex items-center">
                            <h2 className="text-sm sm:text-lg font-bold uppercase tracking-tight text-gray-800 leading-tight">
                                DOJO Evaluation test of practical education 【Former process】
                            </h2>
                        </div>
                        <div className="grid grid-cols-3 border border-black text-center text-[10px] sm:text-xs w-full md:w-[320px] min-w-[280px] h-14 font-semibold">
                            {/* Approved Signature Cell */}
                            <div className="border-r border-black flex flex-col justify-between">
                                <span className="border-b border-black py-0.5 bg-gray-100 text-[9px] uppercase">Approved</span>
                                <div className="flex-1 flex flex-col items-center justify-center p-1 bg-white">
                                    {isView ? (
                                        attemptData._approvedStatus === "APPROVED" ? (
                                            <span className="text-[8.5px] text-green-600 font-extrabold uppercase leading-none">
                                                Approved by:<br/>
                                                <span className="text-gray-800 font-bold block truncate max-w-[90px] mt-0.5">{attemptData._approvedBy}</span>
                                            </span>
                                        ) : attemptData._approvedStatus === "REJECTED" ? (
                                            <span className="text-[8.5px] text-red-600 font-extrabold uppercase leading-none">
                                                Rejected by:<br/>
                                                <span className="text-gray-800 font-bold block truncate max-w-[90px] mt-0.5">{attemptData._approvedBy}</span>
                                            </span>
                                        ) : canApprove ? (
                                            <div className="flex gap-1 print:hidden">
                                                <button 
                                                    type="button"
                                                    onClick={() => handleApprovalClick("approved", "APPROVED")}
                                                    className="bg-green-600 hover:bg-green-700 text-white text-[8px] font-extrabold px-1 py-0.5 rounded shadow-sm transition-colors border-0 cursor-pointer"
                                                >
                                                    Approve
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleApprovalClick("approved", "REJECTED")}
                                                    className="bg-red-600 hover:bg-red-700 text-white text-[8px] font-extrabold px-1 py-0.5 rounded shadow-sm transition-colors border-0 cursor-pointer"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-gray-450 font-medium italic">Pending</span>
                                        )
                                    ) : (
                                        <span className="text-gray-300 text-[9px] italic font-normal">-</span>
                                    )}
                                </div>
                            </div>

                            {/* Confirmed Signature Cell */}
                            <div className="border-r border-black flex flex-col justify-between">
                                <span className="border-b border-black py-0.5 bg-gray-100 text-[9px] uppercase">Confirmed</span>
                                <div className="flex-1 flex flex-col items-center justify-center p-1 bg-white">
                                    {isView ? (
                                        attemptData._confirmedStatus === "APPROVED" ? (
                                            <span className="text-[8.5px] text-green-600 font-extrabold uppercase leading-none">
                                                Approved by:<br/>
                                                <span className="text-gray-800 font-bold block truncate max-w-[90px] mt-0.5">{attemptData._confirmedBy}</span>
                                            </span>
                                        ) : attemptData._confirmedStatus === "REJECTED" ? (
                                            <span className="text-[8.5px] text-red-600 font-extrabold uppercase leading-none">
                                                Rejected by:<br/>
                                                <span className="text-gray-800 font-bold block truncate max-w-[90px] mt-0.5">{attemptData._confirmedBy}</span>
                                            </span>
                                        ) : canConfirm ? (
                                            <div className="flex gap-1 print:hidden">
                                                <button 
                                                    type="button"
                                                    onClick={() => handleApprovalClick("confirmed", "APPROVED")}
                                                    className="bg-green-600 hover:bg-green-700 text-white text-[8px] font-extrabold px-1 py-0.5 rounded shadow-sm transition-colors border-0 cursor-pointer"
                                                >
                                                    Approve
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleApprovalClick("confirmed", "REJECTED")}
                                                    className="bg-red-600 hover:bg-red-700 text-white text-[8px] font-extrabold px-1 py-0.5 rounded shadow-sm transition-colors border-0 cursor-pointer"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-gray-450 font-medium italic">Pending</span>
                                        )
                                    ) : (
                                        <span className="text-gray-300 text-[9px] italic font-normal">-</span>
                                    )}
                                </div>
                            </div>

                            {/* Planned Signature Cell */}
                            <div className="flex flex-col justify-between">
                                <span className="border-b border-black py-0.5 bg-gray-100 text-[9px] uppercase">Planned</span>
                                <div className="flex-1 flex items-center justify-center bg-white font-extrabold text-blue-700 text-[10px] p-1 truncate">
                                    {isView ? (
                                        attemptResponse?.data?.createdBy || "Admin"
                                    ) : (
                                        user?.fullName || user?.userName || "Admin"
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* High-Fidelity Table Grid */}
                    <table className="w-full text-left text-xs border border-black border-collapse">
                        <thead>
                            {/* Unified Trainee Details Box inside the Table Grid for absolute pixel-perfect column alignment */}
                            <tr className="border-x border-b border-black text-xs font-semibold text-left">
                                <td className="border border-black bg-gray-100 p-2 text-[10px] uppercase font-bold align-middle" colSpan={1}>Trainee</td>
                                <td className="border border-black p-2 bg-white relative" colSpan={3}>
                                    {(isView || isEdit) ? (
                                        <span className="font-semibold px-1 text-gray-800">{traineeName || "-"}</span>
                                    ) : (
                                        <div className="relative w-full">
                                            <input 
                                                type="text"
                                                placeholder="Search Trainee by Name or Emp ID..."
                                                value={traineeSearch}
                                                onChange={(e) => {
                                                    setTraineeSearch(e.target.value);
                                                    setTraineeName(e.target.value);
                                                    setShowDropdown(true);
                                                }}
                                                onFocus={() => setShowDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowDropdown(false), 250)}
                                                className="w-full px-1 border-0 focus:ring-0 focus:outline-none bg-transparent font-semibold text-gray-800 text-xs"
                                            />
                                            {/* Live Search Operator Suggestions */}
                                            {showDropdown && (matchingUsers.length > 0 || traineeSearch) && (
                                                <div className="absolute left-0 top-full mt-2 w-[340px] max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl z-50 divide-y divide-gray-100 scrollbar-thin">
                                                    {matchingUsers.length === 0 ? (
                                                        <div className="p-3 text-xs text-gray-400 italic text-center">
                                                            No users found
                                                        </div>
                                                    ) : (
                                                        matchingUsers.map((u) => (
                                                            <button
                                                                key={u._id || u.id}
                                                                type="button"
                                                                onMouseDown={() => {
                                                                    setTraineeName(u.fullName || "");
                                                                    setTraineeSearch(u.fullName || "");
                                                                    setEmployeeNo(u.empId || "");
                                                                    setShowDropdown(false);
                                                                }}
                                                                className="w-full text-left p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors border-0 outline-none"
                                                            >
                                                                <div className="flex flex-col items-start">
                                                                    <span className="text-xs font-bold text-gray-900 leading-normal">{u.fullName}</span>
                                                                    <span className="text-[10px] text-gray-500 leading-tight">@{u.userName || u.email?.split('@')[0]}</span>
                                                                </div>
                                                                {u.empId && (
                                                                    <span className="px-2 py-0.5 text-[9px] font-extrabold text-blue-700 bg-blue-50 border border-blue-100 rounded-full font-mono uppercase tracking-wider">
                                                                        ID: {u.empId}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td className="border border-black p-2 bg-white" colSpan={performDateCount + 1}></td>
                            </tr>
                            <tr className="border-x border-b border-black text-xs font-semibold text-left">
                                <td className="border border-black bg-gray-100 p-2 text-[10px] uppercase font-bold align-middle" colSpan={1}>Employee No.</td>
                                <td className="border border-black p-2 bg-white" colSpan={3}>
                                    {(isView || isEdit) ? (
                                        <span className="font-semibold px-1 text-gray-800">{employeeNo || "-"}</span>
                                    ) : (
                                        <input 
                                            type="text"
                                            placeholder="Enter Employee Number..."
                                            value={employeeNo}
                                            onChange={(e) => setEmployeeNo(e.target.value)}
                                            className="w-full px-1 border-0 focus:ring-0 focus:outline-none bg-transparent font-semibold text-gray-800 text-xs"
                                        />
                                    )}
                                </td>
                                <td className="border border-black p-2 bg-white" colSpan={performDateCount + 1}></td>
                            </tr>
                            <tr className="border-x border-b border-black text-xs font-semibold text-left">
                                <td className="border border-black bg-gray-100 p-2 text-[10px] uppercase font-bold leading-tight align-middle" colSpan={1}>Education giving person</td>
                                <td className="border border-black p-2 bg-white" colSpan={3}>
                                    {isView ? (
                                        <span className="font-semibold px-1 text-gray-800">{educatorName || "-"}</span>
                                    ) : (
                                        <input 
                                            type="text"
                                            placeholder="Enter Educator Name..."
                                            value={educatorName}
                                            onChange={(e) => setEducatorName(e.target.value)}
                                            className="w-full px-1 border-0 focus:ring-0 focus:outline-none bg-transparent font-semibold text-gray-800 text-xs"
                                        />
                                    )}
                                </td>
                                <td className="border border-black p-2 bg-white" colSpan={performDateCount + 1}></td>
                            </tr>
                        </thead>
                        <tbody>

                            {/* Dynamic Title Indicator row (Replaces "Auto Crimping Operation") */}
                            {precomputedBlocks.length === 0 ? (
                                <tr>
                                    <td colSpan={5 + performDateCount} className="p-8 text-center text-gray-400 italic">
                                        No checking items found in this evaluation sheet structure.
                                    </td>
                                </tr>
                            ) : (
                                precomputedBlocks.map((block, blockIdx) => (
                                    <React.Fragment key={block.id}>
                                        {/* Dynamic Title Indicator row */}
                                        <tr className="bg-blue-50/20 font-bold border border-black text-xs sm:text-sm uppercase text-left">
                                            <td className="p-3 border border-black font-extrabold text-blue-700 text-center" colSpan={1}>
                                                {blockIdx + 1}.
                                            </td>
                                            <td className="p-3 border border-black bg-white" colSpan={performDateCount + 4}>
                                                {block.title || "Dynamic Title Section"}
                                            </td>
                                        </tr>

                                        {/* Row 1: Content, Checking items, Process Spec/Intro columns, Comment */}
                                        <tr className="bg-gray-100 border-b border-black font-bold text-center text-[10px] sm:text-xs">
                                            <th className="border-r border-black p-2 w-[12%] text-center align-middle" rowSpan={3}>Content</th>
                                            <th className="border-r border-black p-2 w-[42%] text-center align-middle" colSpan={3} rowSpan={3}>Checking items</th>
                                            {Array.from({ length: performDateCount }).map((_, idx) => (
                                                <th
                                                    key={idx}
                                                    className="border-r border-black p-1 text-[8.5px] font-bold text-center leading-normal align-middle bg-white w-12 font-sans text-black"
                                                    rowSpan={1}
                                                >
                                                    {idx === 0 ? "Process introduction & Process Specific" : "Process Specific"}
                                                </th>
                                            ))}
                                            <th className="p-2 w-[15%] text-center uppercase tracking-wider align-middle" rowSpan={3}>Comment</th>
                                        </tr>
                                        {/* Row 2: Evaluation result spanning all evaluation columns */}
                                        <tr className="bg-gray-100 border-b border-black font-bold text-center text-[10px] sm:text-xs">
                                            <th className="border-r border-black p-2 text-center align-middle font-bold uppercase tracking-wider text-[11px]" colSpan={performDateCount} rowSpan={1}>
                                                Evaluation result
                                            </th>
                                        </tr>
                                        {/* Row 3: Perform date indicators with inputs */}
                                        <tr className="bg-gray-50/50 border-b border-black font-semibold text-[9px] text-center">
                                            {Array.from({ length: performDateCount }).map((_, idx) => (
                                                <th key={idx} className="border-r border-black p-1 text-[8.5px] font-bold whitespace-nowrap leading-tight align-middle w-24">
                                                    <div className="border-b border-gray-300 pb-0.5 mb-0.5">{idx + 1}</div>
                                                    <div className="flex flex-col items-center gap-1 mt-0.5">
                                                        <span className="text-[7.5px] uppercase tracking-wider text-gray-500 font-bold block">Perform Date</span>
                                                        {isView || isPrintMode || (isEdit && preFilledColumns[idx]) ? (
                                                            <span className="text-[9px] text-gray-800 font-bold font-mono px-1">
                                                                {performDates[idx] ? new Date(performDates[idx]).toLocaleDateString("en-IN", {
                                                                    day: "2-digit",
                                                                    month: "short",
                                                                    year: "numeric"
                                                                }) : "-"}
                                                            </span>
                                                        ) : (
                                                            <input 
                                                                type="date"
                                                                value={performDates[idx] || ""}
                                                                onChange={(e) => {
                                                                    const newDates = [...performDates];
                                                                    newDates[idx] = e.target.value;
                                                                    setPerformDates(newDates);
                                                                }}
                                                                className="w-full text-center border border-gray-200 rounded px-1 py-0.5 font-bold font-mono text-[9px] bg-white focus:ring-1 focus:ring-blue-100 focus:outline-none"
                                                            />
                                                        )}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>

                                        {/* Question Rows */}
                                        {block.rows.length === 0 ? (
                                            <tr>
                                                <td colSpan={5 + performDateCount} className="p-6 text-center text-gray-400 italic">
                                                    No checking items found under this title section.
                                                </td>
                                            </tr>
                                        ) : (
                                            block.rows.map((row, idx) => (
                                                <tr key={row.qId} className="border-b border-black hover:bg-gray-50/40 transition-colors">
                                                    {/* Content Column Cell (Merged) */}
                                                    {row.isFirstInContent && (
                                                        <td 
                                                            rowSpan={row.contentSpan} 
                                                            className="border-r border-black p-2 font-bold text-center align-middle uppercase text-gray-800 bg-gray-50/20 text-[10px] break-words whitespace-normal leading-normal"
                                                        >
                                                            {row.contentTitle}
                                                        </td>
                                                    )}

                                                    {/* Category Column Cell (Merged) - Omitted if category title is blank */}
                                                    {row.isFirstInCat && row.catTitle?.trim() && (
                                                        <td 
                                                            rowSpan={row.catSpan} 
                                                            className="border-r border-black p-2 font-semibold text-center align-middle text-gray-700 text-[10px] break-words whitespace-normal leading-normal bg-gray-50/10"
                                                        >
                                                            {row.catTitle}
                                                        </td>
                                                    )}

                                                    {/* Checking Question Number Cell */}
                                                    <td className="border-r border-black p-2 text-center align-middle font-bold text-blue-700 bg-gray-50/5 text-[10.5px] w-8 shrink-0">
                                                        {row.qIndex}
                                                    </td>

                                                    {/* Checking Question Description Cell - Spans 2 columns if category is blank */}
                                                    <td 
                                                        colSpan={!row.catTitle?.trim() ? 2 : 1}
                                                        className="border-r border-black p-2.5 align-middle leading-relaxed text-[10.5px] text-gray-900 font-medium whitespace-pre-line"
                                                    >
                                                        {row.qText}
                                                    </td>

                                                    {/* Evaluation Columns Cells (ACTIVE GRADING INPUTS OR STATIC VIEWS) */}
                                                    {Array.from({ length: performDateCount }).map((_, colIdx) => {
                                                        const cellVal = attemptData[row.qId]?.results?.[colIdx] || "";
                                                        const cellColorClass = cellVal === "✓" 
                                                            ? "text-green-600 font-extrabold text-[14px]" 
                                                            : cellVal === "X" 
                                                                ? "text-red-600 font-extrabold text-[14px]" 
                                                                : "text-gray-400";

                                                        return (
                                                            <td key={colIdx} className="border-r border-black p-0 text-center align-middle w-16 h-10 bg-white">
                                                                {(isView || (isEdit && preFilledColumns[colIdx])) ? (
                                                                    <span className={`font-bold whitespace-nowrap ${cellColorClass}`}>
                                                                        {cellVal || "-"}
                                                                    </span>
                                                                ) : (
                                                                    <select
                                                                        value={cellVal}
                                                                        onChange={(e) => updateGrade(row.qId, colIdx, e.target.value)}
                                                                        className={`w-full h-full text-center border-0 focus:ring-1 focus:ring-blue-200 focus:outline-none bg-transparent font-bold cursor-pointer appearance-none px-1 ${cellColorClass}`}
                                                                    >
                                                                        <option value="" className="text-gray-400 font-normal">-</option>
                                                                        <option value="✓" className="font-extrabold text-green-600 text-[14px]">✓</option>
                                                                        <option value="X" className="font-extrabold text-red-600 text-[14px]">X</option>
                                                                    </select>
                                                                )}
                                                            </td>
                                                        );
                                                    })}

                                                    {/* Comment Column Cell (ACTIVE GRADING INPUT OR STATIC VIEW) */}
                                                    <td className="p-0 align-middle text-left bg-white w-[15%]">
                                                        {isView ? (
                                                            <p className="text-[10px] text-gray-800 px-2 leading-tight">
                                                                {attemptData[row.qId]?.comment || ""}
                                                            </p>
                                                        ) : (
                                                            <input 
                                                                type="text"
                                                                placeholder="Write comment..."
                                                                value={attemptData[row.qId]?.comment || ""}
                                                                onChange={(e) => updateComment(row.qId, e.target.value)}
                                                                className="w-full h-full border-0 focus:ring-1 focus:ring-blue-100 focus:outline-none bg-transparent px-2 text-[10px] text-gray-800"
                                                            />
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}

                                        {/* Evaluation footer statement for this Block */}
                                        <tr className="border-t border-b-2 border-black font-semibold text-xs bg-gray-50/50">
                                            <td colSpan={3} className="border-r border-black p-3 font-bold text-center uppercase tracking-wider align-middle bg-gray-100">
                                                Evaluation
                                            </td>
                                            <td colSpan={2 + performDateCount} className="p-3 text-orange-600 font-bold text-center tracking-normal leading-relaxed text-[11px] sm:text-xs">
                                                30 minutes daily session discussion (Question / Answer) hearing from employee
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // Render Print-Only full width view
    if (isPrintMode) {
        return (
            <div className="space-y-6 w-full max-w-full print:p-0">
                {/* Print Controls overlay */}
                <div className="flex justify-between items-center gap-4 bg-gray-900 text-white p-4 rounded-xl shadow-lg border border-gray-800 print:hidden">
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                                if (isPrintModeUrl) navigate("/admin/evaluation-test");
                                else setIsPrintMode(false);
                            }}
                            className="hover:bg-gray-800 text-white hover:text-white"
                        >
                            <IconArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <span className="font-bold text-sm sm:text-base">{isView ? "Saved Evaluation Print View" : "Evaluation Grading Print View"}</span>
                            <p className="text-gray-400 text-xs hidden sm:block">Press ESC or click the back arrow to return to interactive screen</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            onClick={handlePrint}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 font-medium"
                        >
                            <IconPrinter className="h-4.5 w-4.5" />
                            Print Sheet (Ctrl+P)
                        </Button>
                        {!isPrintModeUrl && (
                            <Button 
                                variant="outline" 
                                onClick={() => setIsPrintMode(false)}
                                className="border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white"
                            >
                                Back to Form
                            </Button>
                        )}
                    </div>
                </div>

                <div className="w-full">
                    {renderSpreadsheetTable()}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
                <div className="flex items-start gap-3">
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => navigate("/admin/evaluation-test")}
                        className="h-9 w-9 border-gray-200 text-gray-600 hover:text-gray-800"
                    >
                        <IconArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                            <IconClipboardCheck className="text-blue-600 h-7 w-7" />
                            {isView ? "View DOJO Evaluation Sheet" : "Trainee Practical DOJO Evaluation"}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            {isView 
                                ? "Inspect completed practical DOJO evaluation sheet scores, dates, and educator sign-offs." 
                                : "Fill out trainee details and record performance grades in real-time on the dynamic Excel sheet."
                            }
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button 
                        variant="outline"
                        onClick={() => setIsPrintMode(true)}
                        className="border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-semibold shadow-sm"
                    >
                        <IconPrinter className="h-4 w-4" />
                        Print Preview / PDF
                    </Button>
                    {!isView && (
                        <Button 
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 font-semibold shadow-md shadow-blue-200"
                        >
                            {isSubmitting ? (
                                <IconLoader2 className="h-4.5 w-4.5 animate-spin" />
                            ) : (
                                <IconDeviceFloppy className="h-4.5 w-4.5" />
                            )}
                            Submit DOJO Evaluation
                        </Button>
                    )}
                </div>
            </div>

            {/* Interactive evaluation sheet */}
            <Card className="border border-gray-150 shadow-sm rounded-xl">
                <CardHeader className="bg-gray-50/60 rounded-t-xl border-b border-gray-100">
                    <CardTitle className="text-base font-semibold text-gray-800">
                        {isView ? "Completed Practical DOJO Sheet" : "Active Practical DOJO Grading Sheet"}
                    </CardTitle>
                    <CardDescription>
                        {isView 
                            ? "Below is the submitted DOJO evaluation sheet. Click Print to export a physical copy."
                            : "Record the evaluation dates, passed (O) or failed (X) status in the perform columns below."
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-5 overflow-x-auto">
                    <div className="min-w-[1150px]">
                        {renderSpreadsheetTable()}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default EvaluationTestAttemptPage;
