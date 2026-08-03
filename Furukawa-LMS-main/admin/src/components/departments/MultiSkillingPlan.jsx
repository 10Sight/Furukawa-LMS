import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGetLinesByDepartmentQuery, useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
import { useGetSubSectionsQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import axiosInstance from "@/Helper/axiosInstance";
import useRevisionInfo from "@/hooks/useRevisionInfo";
import { toast } from "sonner";
import { IconDeviceFloppy, IconPrinter, IconTrash, IconPlus, IconSend, IconLoader } from "@tabler/icons-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const addThreeMonths = (dateStr) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return "";
    const date = new Date(y, m - 1 + 3, d);
    if (date.getDate() !== d) date.setDate(0);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

const calculateFutureDate = (dateStr, dayCount) => {
    if (!dateStr) return "";
    const count = parseInt(dayCount);
    if (!Number.isFinite(count) || count <= 0) return addThreeMonths(dateStr);
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return "";
    const date = new Date(y, m - 1, d + count);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

const ACTUAL_TO_PLAN = {
    q1DateActual: "q2Date",
    q2DateActual: "q3Date",
    q3DateActual: "q4Date",
};

const QUARTERS = [
    { key: "q1", label: "Jan-March", headerBg: "bg-amber-50 text-amber-800", cellBg: "bg-amber-50/20" },
    { key: "q2", label: "April-June", headerBg: "bg-blue-50 text-blue-800", cellBg: "bg-blue-50/20" },
    { key: "q3", label: "July-Sep", headerBg: "bg-green-50 text-green-800", cellBg: "bg-green-50/20" },
    { key: "q4", label: "Oct-Dec", headerBg: "bg-purple-50 text-purple-800", cellBg: "bg-purple-50/20" },
];

const emptyQuarterFields = (obj = {}) => {
    QUARTERS.forEach(({ key }) => {
        obj[`${key}ModelLine`] = obj[`${key}ModelLine`] || "";
        obj[`${key}Station`] = obj[`${key}Station`] || "";
        obj[`${key}Skill`] = obj[`${key}Skill`] || "";
        obj[`${key}Date`] = obj[`${key}Date`] || "";
        obj[`${key}DateActual`] = obj[`${key}DateActual`] || "";
        obj[`${key}Status`] = obj[`${key}Status`] || "";
    });
    return obj;
};

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;

const UserCellSelector = ({ value, onChange, rowId, handleRowFieldChange, disabled, departmentId, sectionId, lineId }) => {
    const [searchTerm, setSearchTerm] = useState(value || "");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        setSearchTerm(value || "");
    }, [value]);

    useEffect(() => {
        const trimmed = searchTerm.trim();
        if (trimmed.length < MIN_SEARCH_LENGTH) {
            setSuggestions([]);
            setIsSearching(false);
            return;
        }
        let cancelled = false;
        setIsSearching(true);
        const timer = setTimeout(() => {
            axiosInstance.get('/api/users/students', {
                params: {
                    search: trimmed,
                    departmentId: departmentId || undefined,
                    sectionId: sectionId || undefined,
                    lineId: lineId || undefined,
                    filterMultiSkillingLevels: "true",
                    includeTemporary: "true",
                    limit: 10,
                },
            }).then((response) => {
                if (cancelled) return;
                setSuggestions(response?.data?.data?.users || []);
            }).catch(() => {
                if (!cancelled) setSuggestions([]);
            }).finally(() => {
                if (!cancelled) setIsSearching(false);
            });
        }, SEARCH_DEBOUNCE_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [searchTerm, departmentId, sectionId, lineId]);

    return (
        <div className="relative w-full">
            <Input
                value={searchTerm}
                onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSuggestions(true);
                    if (e.target.value === "") {
                        onChange("", "");
                        handleRowFieldChange(rowId, "cardNo", "");
                    }
                }}
                onFocus={() => !disabled && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Search user..."
                disabled={disabled}
                className="h-8 w-full min-w-[180px] text-xs shadow-none border-slate-200 bg-white"
            />
            {showSuggestions && !disabled && searchTerm.trim().length >= MIN_SEARCH_LENGTH && (
                <ul className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg max-h-40 overflow-y-auto z-50 py-1 normal-case font-normal text-left">
                    {isSearching ? (
                        <li className="px-2 py-1.5 text-xs text-slate-400 flex items-center gap-1.5">
                            <IconLoader className="h-3 w-3 animate-spin" /> Searching...
                        </li>
                    ) : suggestions.length > 0 ? (
                        suggestions.map((s) => (
                            <li
                                key={s._id || s.id}
                                onMouseDown={() => {
                                    onChange(s._id || s.id, s.fullName || s.name);
                                    handleRowFieldChange(rowId, "cardNo", s.cardNo || s.username || s.empId || "-");
                                    setShowSuggestions(false);
                                }}
                                className="px-2 py-1 text-xs hover:bg-amber-50 cursor-pointer flex flex-col"
                            >
                                <span className="font-semibold text-slate-700">{s.fullName || s.name}</span>
                                <span className="text-[10px] text-slate-500 font-mono">Card: {s.cardNo || s.username || s.empId || "—"}</span>
                            </li>
                        ))
                    ) : (
                        <li className="px-2 py-1.5 text-xs text-slate-400">No matches found</li>
                    )}
                </ul>
            )}
        </div>
    );
};

const HorizontalScrollbar = React.memo(({ containerRef }) => {
    const trackRef = useRef(null);
    const dragState = useRef(null);
    const rafRef = useRef(null);
    const [thumb, setThumb] = useState({ width: 0, left: 0, visible: false });

    const recomputeThumb = () => {
        const el = containerRef.current;
        const track = trackRef.current;
        if (!el || !track) return;
        const trackWidth = track.clientWidth;
        const clientWidth = el.clientWidth;
        const scrollWidth = el.scrollWidth;
        if (scrollWidth <= clientWidth) {
            setThumb(prev => (prev.visible ? { width: 0, left: 0, visible: false } : prev));
            return;
        }
        const thumbWidth = Math.max(30, (clientWidth / scrollWidth) * trackWidth);
        const maxScroll = scrollWidth - clientWidth;
        const maxThumbLeft = trackWidth - thumbWidth;
        const left = maxScroll > 0 ? (el.scrollLeft / maxScroll) * maxThumbLeft : 0;
        setThumb({ width: thumbWidth, left, visible: true });
    };

    const scheduleRecompute = () => {
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            recomputeThumb();
        });
    };

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        recomputeThumb();
        el.addEventListener("scroll", scheduleRecompute, { passive: true });
        window.addEventListener("resize", scheduleRecompute);
        const observer = new ResizeObserver(scheduleRecompute);
        if (el.firstElementChild) observer.observe(el.firstElementChild);
        return () => {
            el.removeEventListener("scroll", scheduleRecompute);
            window.removeEventListener("resize", scheduleRecompute);
            observer.disconnect();
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const scrollByThumbDelta = (deltaPx) => {
        const el = containerRef.current;
        const track = trackRef.current;
        if (!el || !track) return;
        const trackWidth = track.clientWidth;
        const clientWidth = el.clientWidth;
        const scrollWidth = el.scrollWidth;
        const maxScroll = scrollWidth - clientWidth;
        const thumbWidth = Math.max(30, (clientWidth / scrollWidth) * trackWidth);
        const maxThumbLeft = trackWidth - thumbWidth;
        if (maxThumbLeft <= 0) return;
        const deltaScroll = (deltaPx / maxThumbLeft) * maxScroll;
        el.scrollLeft = Math.min(maxScroll, Math.max(0, el.scrollLeft + deltaScroll));
    };

    const handleThumbMouseDown = (e) => {
        e.preventDefault();
        dragState.current = { startX: e.clientX };
        const onMouseMove = (moveEvent) => {
            if (!dragState.current) return;
            const deltaX = moveEvent.clientX - dragState.current.startX;
            dragState.current.startX = moveEvent.clientX;
            scrollByThumbDelta(deltaX);
        };
        const onMouseUp = () => {
            dragState.current = null;
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    };

    const handleTrackClick = (e) => {
        if (e.target !== trackRef.current) return;
        const track = trackRef.current;
        const rect = track.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const el = containerRef.current;
        if (!el) return;
        const clientWidth = el.clientWidth;
        const scrollWidth = el.scrollWidth;
        const maxScroll = scrollWidth - clientWidth;
        const thumbWidth = Math.max(30, (clientWidth / scrollWidth) * rect.width);
        const targetLeft = Math.min(rect.width - thumbWidth, Math.max(0, clickX - thumbWidth / 2));
        const maxThumbLeft = rect.width - thumbWidth;
        el.scrollLeft = maxThumbLeft > 0 ? (targetLeft / maxThumbLeft) * maxScroll : 0;
    };

    return (
        <div
            ref={trackRef}
            onMouseDown={handleTrackClick}
            className={`no-print relative w-full h-3 rounded-full bg-slate-200 mb-2 ${thumb.visible ? "" : "invisible"}`}
        >
            <div
                onMouseDown={handleThumbMouseDown}
                className="absolute top-0 h-full rounded-full bg-slate-400 hover:bg-slate-500 active:bg-slate-600 cursor-grab active:cursor-grabbing transition-colors"
                style={{ width: `${thumb.width}px`, left: `${thumb.left}px` }}
            />
        </div>
    );
});
HorizontalScrollbar.displayName = "HorizontalScrollbar";

const MultiSkillingPlan = ({ departmentId, sectionId, lineId, lineName = "", year }) => {
    const liveRevisionInfo = useRevisionInfo("multi-skilling-plan", { docNo: "FRM-WH-QA-236" }, { departmentId, sectionId });
    const [savedRevisionInfo, setSavedRevisionInfo] = useState(null);
    // A saved plan keeps whatever docNo/revNo/revDate was frozen into it at
    // creation; only a brand-new (never-saved) plan shows the live value.
    const revisionInfo = savedRevisionInfo?.docNo ? savedRevisionInfo : liveRevisionInfo;
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN' || authUser?.role === 'INSTRUCTOR' || authUser?.isTrainer;

    const { canManage } = useMemo(() => {
        const permissions = authUser?.customRole?.permissions || [];
        return {
            canManage: permissions.includes('multi_skilling:manage') || isAdmin,
        };
    }, [authUser, isAdmin]);

    const [searchText, setSearchText] = useState("");
    const [rows, setRows] = useState([]);
    const [hasLoaded, setHasLoaded] = useState(false);

    // Fetch lines for model & line selection helper
    const { data: deptLines } = useGetLinesByDepartmentQuery(departmentId, {
        skip: !departmentId || !!sectionId,
    });
    const { data: sectLines } = useGetLinesBySectionQuery(sectionId, {
        skip: !sectionId,
    });
    const lines = (sectionId ? sectLines?.data : deptLines?.data) || [];

    const { data: subSectionsData } = useGetSubSectionsQuery({
        departmentId,
        sectionId,
    }, {
        skip: !departmentId,
    });
    const subSections = subSectionsData?.data || [];

    const { data: sectionsData } = useGetSectionsByDepartmentQuery(departmentId, {
        skip: !departmentId,
    });
    const currentSection = useMemo(() => {
        if (!sectionId) return null;
        return (sectionsData?.data || []).find(s => String(s.id || s._id) === String(sectionId)) || null;
    }, [sectionsData, sectionId]);
    const multiSkillingDayCount = currentSection?.multiSkillingDayCount ?? null;

    const getQuarterSubSections = (modelLine) => (modelLine ? subSections.filter(ss => ss.lineName === modelLine) : subSections);

    const [tableData, setTableData] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingPlan, setIsLoadingPlan] = useState(true);
    const [removedUserIds, setRemovedUserIds] = useState(new Set());

    // Reset loading state when department/section/line/year changes
    useEffect(() => {
        setHasLoaded(false);
        setRows([]);
        setRemovedUserIds(new Set());
        setIsLoadingPlan(true);
    }, [departmentId, sectionId, lineId, year]);

    // Initialize rows from the saved plan once it has loaded (no auto-population of eligible
    // students — rows are added manually via "Add Row" + searching for the associate).
    useEffect(() => {
        if (isLoadingPlan || hasLoaded) return;

        const savedRows = [];
        const savedRemovedIds = new Set(tableData.__removedUserIds || []);
        const savedUserIds = Object.keys(tableData || {}).filter(k => k !== "__removedUserIds");

        savedUserIds.forEach((userId) => {
            const data = tableData[userId] || {};

            // tableData spans every line in the section, so only keep rows whose saved
            // per-quarter line matches the line currently selected.
            if (lineName) {
                const belongsToLine = QUARTERS.some(({ key }) => data[`${key}ModelLine`] === lineName);
                if (!belongsToLine) return;
            }

            const quarterFields = {};
            QUARTERS.forEach(({ key }) => {
                // Backward compatibility: older saved plans stored a single row-level
                // modelLine/station instead of per-quarter values — fall back to those.
                quarterFields[`${key}ModelLine`] = data[`${key}ModelLine`] || data.modelLine || "";
                quarterFields[`${key}Station`] = data[`${key}Station`] || data.station || "";
                quarterFields[`${key}Skill`] = data[`${key}Skill`] || "";
                quarterFields[`${key}Date`] = data[`${key}Date`] || "";
                quarterFields[`${key}DateActual`] = data[`${key}DateActual`] || "";
                quarterFields[`${key}Status`] = data[`${key}Status`] || "";
            });
            savedRows.push({
                rowId: userId,
                userId: userId,
                userName: data.userName || "",
                cardNo: data.cardNo || "",
                shift: data.shift || "",
                ...quarterFields,
            });
        });

        // Pad to 25 rows
        const totalRowsNeeded = 25;
        const currentCount = savedRows.length;
        if (currentCount < totalRowsNeeded) {
            for (let i = currentCount; i < totalRowsNeeded; i++) {
                savedRows.push({
                    rowId: `temp-${i}-${Date.now()}`,
                    userId: "",
                    userName: "",
                    cardNo: "",
                    shift: "",
                    ...emptyQuarterFields(),
                });
            }
        }

        setRemovedUserIds(savedRemovedIds);
        setRows(savedRows);
        setHasLoaded(true);
    }, [tableData, isLoadingPlan, hasLoaded, lineName]);

    useEffect(() => {
        if (!departmentId) {
            setIsLoadingPlan(false);
            return;
        }
        let cancelled = false;

        const loadSavedPlan = async () => {
            try {
                setIsLoadingPlan(true);
                setTableData({});
                const response = await axiosInstance.get(`/api/multi-skilling-plan/department/${departmentId}`, {
                    params: { sectionId, year }
                });
                const data = response?.data?.data;
                if (!cancelled && data) {
                    if (data.tableData && typeof data.tableData === "object") {
                        setTableData(data.tableData);
                    }
                    setSavedRevisionInfo(data.isNew ? null : { docNo: data.docNo, revNo: data.revNo, revDate: data.revDate });
                }
            } catch (error) {
                if (!cancelled) {
                    toast.error("Failed to load multi-skilling plan");
                }
            } finally {
                if (!cancelled) setIsLoadingPlan(false);
            }
        };

        loadSavedPlan();
        return () => {
            cancelled = true;
        };
    }, [departmentId, sectionId, year]);

    const handleAddRow = () => {
        setRows(prev => [
            ...prev,
            {
                rowId: `temp-add-${prev.length}-${Date.now()}`,
                userId: "",
                userName: "",
                cardNo: "",
                shift: "",
                ...emptyQuarterFields(),
            }
        ]);
    };

    const handleRemoveEmployee = (rowId, userId) => {
        setRows(prev => prev.filter(row => row.rowId !== rowId));
        if (userId) {
            setRemovedUserIds(prev => new Set([...prev, String(userId)]));
        }
        toast.success("Row removed from sheet");
    };

    const handleRowFieldChange = (rowId, field, value) => {
        setRows(prev => prev.map(row => {
            if (row.rowId !== rowId) return row;
            const updated = { ...row, [field]: value };
            const targetField = ACTUAL_TO_PLAN[field];
            if (targetField && value && !row[targetField]) {
                updated[targetField] = calculateFutureDate(value, multiSkillingDayCount);
            }
            return updated;
        }));
    };

    const handleUserSelect = (rowId, userId, userName) => {
        handleRowFieldChange(rowId, "userId", userId);
        handleRowFieldChange(rowId, "userName", userName);
        QUARTERS.forEach(({ key }) => {
            handleRowFieldChange(rowId, `${key}ModelLine`, "");
            handleRowFieldChange(rowId, `${key}Station`, "");
            handleRowFieldChange(rowId, `${key}Skill`, "");
        });
    };

    const handleQuarterLineChange = (rowId, quarterKey, val) => {
        handleRowFieldChange(rowId, `${quarterKey}ModelLine`, val);
        handleRowFieldChange(rowId, `${quarterKey}Station`, ""); // Reset station when line changes
    };

    const filteredRows = useMemo(() => {
        if (!searchText.trim()) return rows;
        const lower = searchText.toLowerCase();
        return rows.filter(row =>
            (row.userName || "").toLowerCase().includes(lower) ||
            (row.cardNo || "").toLowerCase().includes(lower)
        );
    }, [rows, searchText]);

    const handleSave = async (sendEmail = false) => {
        if (!departmentId) return;

        // Convert this line's rows to tableData format
        const currentLineData = {};
        rows.forEach(row => {
            if (row.userId) {
                const quarterFields = {};
                QUARTERS.forEach(({ key }) => {
                    quarterFields[`${key}ModelLine`] = row[`${key}ModelLine`];
                    quarterFields[`${key}Station`] = row[`${key}Station`];
                    quarterFields[`${key}Skill`] = row[`${key}Skill`];
                    quarterFields[`${key}Date`] = row[`${key}Date`];
                    quarterFields[`${key}DateActual`] = row[`${key}DateActual`];
                    quarterFields[`${key}Status`] = row[`${key}Status`];
                });
                currentLineData[row.userId] = {
                    userName: row.userName || "",
                    cardNo: row.cardNo || "",
                    shift: row.shift,
                    ...quarterFields,
                };
            }
        });

        // Merge this line's rows back into the full section-wide tableData so other lines'
        // saved data (which this component never loaded into `rows`) isn't lost. Users removed
        // via the trash icon this session are dropped from the merged record and tracked in
        // __removedUserIds so they aren't auto-added back on the next load.
        const mergedTableData = { ...tableData };
        delete mergedTableData.__removedUserIds;
        removedUserIds.forEach(userId => { delete mergedTableData[userId]; });
        Object.assign(mergedTableData, currentLineData);

        const combinedRemovedIds = new Set(removedUserIds);
        Object.keys(currentLineData).forEach(userId => combinedRemovedIds.delete(userId));
        if (combinedRemovedIds.size > 0) {
            mergedTableData.__removedUserIds = [...combinedRemovedIds];
        }

        try {
            setIsSaving(true);
            const response = await axiosInstance.post(`/api/multi-skilling-plan/department/${departmentId}`, {
                sectionId,
                year,
                selectedLines: [],
                tableData: mergedTableData,
                sendEmail,
            });
            setTableData(mergedTableData);
            setRemovedUserIds(combinedRemovedIds);
            toast.success(response?.data?.message || "Multi-skilling plan saved successfully");
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to save multi-skilling plan");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const tableContainerRef = useRef(null);

    const stickyHeader = "sticky top-0 z-40 print:static";
    const stickySubHeader = "sticky top-12 z-40 print:static";
    const stickyFrozenHeader = "sticky top-0 z-50 print:static";
    const stickyFrozenCell = "sticky z-30 bg-white group-hover:bg-slate-50 transition-colors print:static";

    return (
        <Card className="max-w-full overflow-visible bg-white">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 print:hidden">
                    <div />
                    <h2 className="text-xl font-bold uppercase tracking-wide border-b-2 border-transparent inline-block pb-1">
                        Training plan for multi skilling
                    </h2>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleAddRow} className="border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold shadow-sm">
                            <IconPlus className="h-4 w-4 mr-2" />
                            Add Row
                        </Button>
                        <Button variant="outline" onClick={handlePrint}>
                            <IconPrinter className="h-4 w-4 mr-2" />
                            Print
                        </Button>
                        {canManage && (
                            <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving || isLoadingPlan} className="border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold shadow-sm">
                                <IconDeviceFloppy className="h-4 w-4 mr-2" />
                                {isSaving ? "Saving..." : "Save"}
                            </Button>
                        )}
                        {canManage && (
                            <Button onClick={() => handleSave(true)} disabled={isSaving || isLoadingPlan} className="bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-sm">
                                <IconSend className="h-4 w-4 mr-2" />
                                {isSaving ? "Saving..." : "Submit & Mail"}
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="w-full overflow-visible">
                {/* Sheet Metadata Header Block - Visible in screen & print */}
                <div className="flex justify-between items-center w-full mb-4 pb-2 border-b border-slate-200 print:border-black">
                    <div>
                        <h2 className="text-lg font-bold uppercase tracking-wide text-slate-800 print:text-black hidden print:block">
                            Training Plan for Multi Skilling
                        </h2>
                        <span className="print:hidden text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Interactive Multi-Skilling Sheet (Year: {year})
                        </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 border border-slate-950 bg-slate-50 px-3 py-1 rounded shadow-sm print:shadow-none print:bg-white print:rounded-none whitespace-nowrap">
                        Document No: {revisionInfo.docNo}
                    </div>
                </div>
                <div className="no-print flex flex-col sm:flex-row items-end gap-4 mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="w-full sm:w-72">
                        <Label className="text-xs font-bold text-slate-700 mb-1 block">Filter Table Rows</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="Filter active associates..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="h-9 bg-white text-sm"
                            />
                            {searchText && (
                                <Button variant="ghost" size="sm" onClick={() => setSearchText("")} className="h-9 px-2 text-xs">
                                    Clear
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <HorizontalScrollbar containerRef={tableContainerRef} />

                <div
                    ref={tableContainerRef}
                    className="w-full max-w-full max-h-[calc(100vh-340px)] overflow-x-auto overflow-y-auto border border-slate-200 rounded-lg themed-scrollbar overscroll-contain"
                    style={{ WebkitOverflowScrolling: "touch" }}
                >
                    <table className="w-full min-w-[3800px] border-separate border-spacing-0 text-sm table-auto">
                        <thead className="bg-slate-100 text-slate-700">
                            {/* Group headers row */}
                            <tr className="h-12 [&>th]:border-b [&>th]:border-slate-300">
                                <th rowSpan="2" className={`${stickyFrozenHeader} left-0 w-[70px] min-w-[70px] border-r border-slate-300 bg-slate-100 p-2 text-center font-bold align-middle whitespace-nowrap`}>Sr. No</th>
                                <th rowSpan="2" className={`${stickyFrozenHeader} left-[70px] w-[220px] min-w-[220px] border-r border-slate-300 bg-slate-100 p-2 text-left font-bold align-middle whitespace-nowrap`}>Associates Name</th>
                                <th rowSpan="2" className={`${stickyFrozenHeader} left-[290px] w-[120px] min-w-[120px] border-r border-slate-300 bg-slate-100 p-2 text-center font-bold align-middle whitespace-nowrap shadow-[4px_0_8px_-6px_rgba(15,23,42,0.45)]`}>Card No</th>
                                <th rowSpan="2" className={`${stickyHeader} border-r border-slate-300 bg-slate-100 p-2 text-center font-bold align-middle whitespace-nowrap`}>Shift</th>
                                {QUARTERS.map(({ key, label, headerBg }) => (
                                    <th key={key} colSpan="6" className={`${stickyHeader} border-r border-slate-300 p-2 text-center font-bold ${headerBg} whitespace-nowrap`}>{label}</th>
                                ))}
                                <th rowSpan="2" className={`${stickyHeader} p-2 text-center font-bold align-middle no-print whitespace-nowrap`}>Action</th>
                            </tr>
                            <tr className="bg-slate-50 [&>th]:border-b [&>th]:border-slate-300">
                                {QUARTERS.map(({ key, headerBg }) => (
                                    <React.Fragment key={key}>
                                        <th className={`${stickySubHeader} border-r border-slate-300 ${headerBg} p-1 text-center text-xs font-semibold whitespace-nowrap`}>Model &amp; Line</th>
                                        <th className={`${stickySubHeader} border-r border-slate-300 ${headerBg} p-1 text-center text-xs font-semibold whitespace-nowrap`}>Station</th>
                                        <th className={`${stickySubHeader} border-r border-slate-300 ${headerBg} p-1 text-center text-xs font-semibold whitespace-nowrap`}>Skill Level</th>
                                        <th className={`${stickySubHeader} border-r border-slate-300 ${headerBg} p-1 text-center text-xs font-semibold whitespace-nowrap`}>Updation Date (Plan)</th>
                                        <th className={`${stickySubHeader} border-r border-slate-300 ${headerBg} p-1 text-center text-xs font-semibold whitespace-nowrap`}>Updation Date (Actual)</th>
                                        <th className={`${stickySubHeader} border-r border-slate-300 ${headerBg} p-1 text-center text-xs font-semibold whitespace-nowrap`}>Status</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="bg-white">
                            {filteredRows.map((row, index) => {
                                const rowId = row.rowId;

                                return (
                                    <tr key={rowId} className="group hover:bg-slate-50/50 transition-colors [&>td]:border-b [&>td]:border-slate-200">
                                        <td className={`${stickyFrozenCell} left-0 w-[70px] min-w-[70px] border-r border-slate-200 p-2 text-center text-slate-500 font-medium whitespace-nowrap`}>{index + 1}</td>
                                        <td className={`${stickyFrozenCell} left-[70px] w-[220px] min-w-[220px] border-r border-slate-200 p-2 font-bold text-slate-800 uppercase whitespace-nowrap`}>
                                            <UserCellSelector
                                                value={row.userName}
                                                onChange={(userId, userName) => handleUserSelect(rowId, userId, userName)}
                                                departmentId={departmentId}
                                                sectionId={sectionId}
                                                lineId={lineId}
                                                rowId={rowId}
                                                handleRowFieldChange={handleRowFieldChange}
                                                disabled={!canManage}
                                            />
                                        </td>
                                        <td className={`${stickyFrozenCell} left-[290px] w-[120px] min-w-[120px] border-r border-slate-200 p-2 text-center font-mono text-slate-700 whitespace-nowrap shadow-[4px_0_8px_-6px_rgba(15,23,42,0.35)]`}>
                                            <Input
                                                value={row.cardNo || ""}
                                                disabled={true}
                                                className="h-8 w-full min-w-[90px] text-xs shadow-none bg-slate-50 border-slate-200 text-center font-bold"
                                                placeholder="Card No"
                                                readOnly
                                            />
                                        </td>
                                        {/* Shift */}
                                        <td className="border-r border-slate-200 p-1 text-center whitespace-nowrap">
                                            <Select
                                                value={row.shift || ""}
                                                onValueChange={(val) => handleRowFieldChange(rowId, "shift", val)}
                                                disabled={!canManage}
                                            >
                                                <SelectTrigger className="h-8 w-full min-w-[70px] bg-white border-slate-200 text-xs shadow-none mx-auto">
                                                    <SelectValue placeholder="-" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="A">A</SelectItem>
                                                    <SelectItem value="B">B</SelectItem>
                                                    <SelectItem value="C">C</SelectItem>
                                                    <SelectItem value="G">G</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>

                                        {QUARTERS.map(({ key, cellBg }) => {
                                            const modelLineField = `${key}ModelLine`;
                                            const stationField = `${key}Station`;
                                            const skillField = `${key}Skill`;
                                            const dateField = `${key}Date`;
                                            const dateActualField = `${key}DateActual`;
                                            const statusField = `${key}Status`;
                                            const quarterSubSections = getQuarterSubSections(row[modelLineField]);

                                            return (
                                                <React.Fragment key={key}>
                                                    {/* Model & Line */}
                                                    <td className={`border-r border-slate-200 p-1 ${cellBg} whitespace-nowrap`}>
                                                        <Select
                                                            value={row[modelLineField] || ""}
                                                            onValueChange={(val) => handleQuarterLineChange(rowId, key, val)}
                                                            disabled={!canManage}
                                                        >
                                                            <SelectTrigger className="h-8 w-full min-w-[150px] bg-white border-slate-200 text-xs shadow-none">
                                                                <SelectValue placeholder="Select Model/Line" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {lines.map((l) => (
                                                                    <SelectItem key={l.id || l._id} value={l.name}>
                                                                        {l.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </td>
                                                    {/* Station */}
                                                    <td className={`border-r border-slate-200 p-1 ${cellBg} whitespace-nowrap`}>
                                                        <Select
                                                            value={row[stationField] || ""}
                                                            onValueChange={(val) => handleRowFieldChange(rowId, stationField, val)}
                                                            disabled={!canManage}
                                                        >
                                                            <SelectTrigger className="h-8 w-full min-w-[150px] bg-white border-slate-200 text-xs shadow-none">
                                                                <SelectValue placeholder="Select Station" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {quarterSubSections.map((ss) => (
                                                                    <SelectItem key={ss.id || ss._id} value={ss.name}>
                                                                        {ss.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </td>
                                                    {/* Skill Level */}
                                                    <td className={`border-r border-slate-200 p-1 ${cellBg} whitespace-nowrap`}>
                                                        <Select
                                                            value={row[skillField] || ""}
                                                            onValueChange={(val) => handleRowFieldChange(rowId, skillField, val)}
                                                            disabled={!canManage}
                                                        >
                                                            <SelectTrigger className="h-8 w-full min-w-[70px] bg-white border-slate-200 text-xs shadow-none">
                                                                <SelectValue placeholder="-" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="L1">L1</SelectItem>
                                                                <SelectItem value="L2">L2</SelectItem>
                                                                <SelectItem value="L3">L3</SelectItem>
                                                                <SelectItem value="L4">L4</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </td>
                                                    {/* Date */}
                                                    <td className={`border-r border-slate-200 p-1 ${cellBg} text-center whitespace-nowrap`}>
                                                        <input
                                                            type="date"
                                                            value={row[dateField] || ""}
                                                            min={new Date().toLocaleDateString('en-CA')}
                                                            onChange={(e) => handleRowFieldChange(rowId, dateField, e.target.value)}
                                                            disabled={!canManage}
                                                            className="h-8 border border-slate-200 rounded-md px-1 text-xs w-full min-w-[130px] text-center bg-white focus-visible:outline-none"
                                                        />
                                                    </td>
                                                    {/* Date Actual */}
                                                    <td className={`border-r border-slate-200 p-1 ${cellBg} text-center whitespace-nowrap`}>
                                                        <input
                                                            type="date"
                                                            value={row[dateActualField] || ""}
                                                            min={new Date().toLocaleDateString('en-CA')}
                                                            onChange={(e) => handleRowFieldChange(rowId, dateActualField, e.target.value)}
                                                            disabled={!canManage}
                                                            className="h-8 border border-slate-200 rounded-md px-1 text-xs w-full min-w-[130px] text-center bg-white focus-visible:outline-none"
                                                        />
                                                    </td>
                                                    {/* Status */}
                                                    <td className={`border-r border-slate-200 p-1 ${cellBg} whitespace-nowrap`}>
                                                        <Select
                                                            value={row[statusField] || ""}
                                                            onValueChange={(val) => handleRowFieldChange(rowId, statusField, val)}
                                                            disabled={!canManage}
                                                        >
                                                            <SelectTrigger className="h-8 w-full min-w-[110px] bg-white border-slate-200 text-xs shadow-none">
                                                                <SelectValue placeholder="Status" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Planned">Planned</SelectItem>
                                                                <SelectItem value="Ongoing">Ongoing</SelectItem>
                                                                <SelectItem value="Completed">Completed</SelectItem>
                                                                <SelectItem value="N/A">N/A</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </td>
                                                </React.Fragment>
                                            );
                                        })}

                                        {/* Action */}
                                        <td className="p-2 text-center no-print whitespace-nowrap">
                                            {canManage && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRemoveEmployee(rowId, row.userId)}
                                                    className="text-red-500 hover:text-red-700 p-1 h-auto"
                                                    title="Remove Row"
                                                >
                                                    <IconTrash className="w-4 h-4 text-red-500 hover:text-red-700" />
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredRows.length === 0 && (
                                <tr>
                                    <td colSpan="29" className="border border-slate-300 p-8 text-center text-muted-foreground bg-slate-50">
                                        No rows match the search filter.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};

export default MultiSkillingPlan;
