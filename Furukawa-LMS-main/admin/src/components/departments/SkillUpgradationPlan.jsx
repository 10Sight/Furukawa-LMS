import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSelector } from "react-redux";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGetLinesByDepartmentQuery, useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
import { useGetSubSectionsQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetActiveConfigQuery } from "@/Redux/AllApi/CourseLevelConfigApi";
import axiosInstance from "@/Helper/axiosInstance";
import useRevisionInfo from "@/hooks/useRevisionInfo";
import { useLogActionMutation } from "@/Redux/AllApi/AuditApi";
import { toast } from "sonner";
import { IconDeviceFloppy, IconPrinter, IconTrash, IconPlus, IconSend, IconLoader, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
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

const QUARTER_INDEX = { q1: 1, q2: 2, q3: 3, q4: 4 };
const QUARTER_START_MONTH_DAY = { q1: "01-01", q2: "04-01", q3: "07-01", q4: "10-01" };
const QUARTER_END_MONTH_DAY = { q1: "03-31", q2: "06-30", q3: "09-30", q4: "12-31" };

// Bounds for the native <input type="date"> min/max attrs, so the picker itself can't
// offer a date outside the column's own quarter.
const getQuarterDateBounds = (quarterKey, year) => {
    if (!year || !QUARTER_START_MONTH_DAY[quarterKey]) return { min: undefined, max: undefined };
    return {
        min: `${year}-${QUARTER_START_MONTH_DAY[quarterKey]}`,
        max: `${year}-${QUARTER_END_MONTH_DAY[quarterKey]}`,
    };
};

// The Skill Level the associate just reached in this quarter — determines how
// many days until the next quarter's plan date (see resolveDayCountForLevel).
const SKILL_FIELD_FOR_ACTUAL = {
    q1DateActual: "q1Skill",
    q2DateActual: "q2Skill",
    q3DateActual: "q3Skill",
};

// Confirms a manually entered date actually falls within the quarter/year column
// it was typed into, since the table's quarter columns are otherwise unenforced.
const validateDateForQuarter = (dateStr, quarterKey, year) => {
    if (!dateStr) return { valid: true };
    const [y, m] = dateStr.split("-").map(Number);
    if (!y || !m) return { valid: false, reason: "Invalid date format" };

    if (year && y !== parseInt(year)) {
        return { valid: false, reason: `Year must be ${year}` };
    }

    if (quarterKey === "q1" && (m < 1 || m > 3)) {
        return { valid: false, reason: "Date must be in Jan-March (Q1)" };
    }
    if (quarterKey === "q2" && (m < 4 || m > 6)) {
        return { valid: false, reason: "Date must be in April-June (Q2)" };
    }
    if (quarterKey === "q3" && (m < 7 || m > 9)) {
        return { valid: false, reason: "Date must be in July-Sep (Q3)" };
    }
    if (quarterKey === "q4" && (m < 10 || m > 12)) {
        return { valid: false, reason: "Date must be in Oct-Dec (Q4)" };
    }

    return { valid: true };
};

const QUARTERS = [
    { key: "q1", label: "Jan-March", headerBg: "bg-amber-50 text-amber-800", cellBg: "bg-amber-50/20", badgeColor: "text-amber-700" },
    { key: "q2", label: "April-June", headerBg: "bg-blue-50 text-blue-800", cellBg: "bg-blue-50/20", badgeColor: "text-blue-700" },
    { key: "q3", label: "July-Sep", headerBg: "bg-green-50 text-green-800", cellBg: "bg-green-50/20", badgeColor: "text-green-700" },
    { key: "q4", label: "Oct-Dec", headerBg: "bg-purple-50 text-purple-800", cellBg: "bg-purple-50/20", badgeColor: "text-purple-700" },
];

// Builds a row for an eligible student, overlaying any previously-saved quarter data for
// them. Shared by the initial row-population effect and the later "newly eligible student
// showed up" effect, so both produce identical row shapes.
const buildRowForStudent = (student, data = {}) => {
    const userId = String(student._id || student.id);
    return {
        rowId: userId,
        userId,
        userName: student.fullName || student.name || data.userName || "",
        cardNo: student.cardNo || student.username || student.empId || data.cardNo || "",
        modelLine: data.modelLine || student.lineName || "",
        station: data.station || student.subSectionName || "",
        q1Skill: data.q1Skill || "", q1Date: data.q1Date || "", q1DateActual: data.q1DateActual || "", q1Status: data.q1Status || "", q1Shift: data.q1Shift || data.shift || student.shift || "",
        q2Skill: data.q2Skill || "", q2Date: data.q2Date || "", q2DateActual: data.q2DateActual || "", q2Status: data.q2Status || "", q2Shift: data.q2Shift || data.shift || student.shift || "",
        q3Skill: data.q3Skill || "", q3Date: data.q3Date || "", q3DateActual: data.q3DateActual || "", q3Status: data.q3Status || "", q3Shift: data.q3Shift || data.shift || student.shift || "",
        q4Skill: data.q4Skill || "", q4Date: data.q4Date || "", q4DateActual: data.q4DateActual || "", q4Status: data.q4Status || "", q4Shift: data.q4Shift || data.shift || student.shift || "",
    };
};

// Builds a compact page-number list around the current page, e.g. [1, "...", 4, 5, 6, "...", 20].
const getPageNumbers = (current, total) => {
    const WINDOW = 1;
    const pages = [];
    const add = (p) => pages.push(p);
    add(1);
    if (current - WINDOW > 2) add("...");
    for (let p = Math.max(2, current - WINDOW); p <= Math.min(total - 1, current + WINDOW); p++) add(p);
    if (current + WINDOW < total - 1) add("...");
    if (total > 1) add(total);
    return pages;
};

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;
// Shared across every UserCellSelector instance (one per row) so the same search
// term/department/section/line combo is fetched once per sheet session, not once per row.
const userSearchCache = new Map();

const UserCellSelector = React.memo(({ value, onChange, rowId, handleRowFieldChange, disabled, departmentId, sectionId, lineId }) => {
    const [searchTerm, setSearchTerm] = useState(value || "");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [menuStyle, setMenuStyle] = useState(null);
    // Once a name is selected, show it as static (word-wrapped) text instead of
    // the search input, so the row isn't stuck showing an editable field forever.
    // Clicking the text (or clearing it) drops back into edit mode.
    const [isEditing, setIsEditing] = useState(!value);
    const wrapperRef = useRef(null);

    useEffect(() => {
        setSearchTerm(value || "");
        setIsEditing(!value);
    }, [value]);

    useEffect(() => {
        const trimmed = searchTerm.trim();
        if (trimmed.length < MIN_SEARCH_LENGTH) {
            setSuggestions([]);
            setIsSearching(false);
            return;
        }
        const cacheKey = `${trimmed.toLowerCase()}|${departmentId || ""}|${sectionId || ""}|${lineId || ""}`;
        const cached = userSearchCache.get(cacheKey);
        if (cached) {
            setSuggestions(cached);
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
                    includeTemporary: "false",
                    sixteenDayApprovedOnly: "true",
                    limit: 10,
                },
            }).then((response) => {
                if (cancelled) return;
                const users = response?.data?.data?.users || [];
                userSearchCache.set(cacheKey, users);
                setSuggestions(users);
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

    // Table cells that host this selector sit inside a scrollable/overflow-clipped
    // container with sticky columns, so an absolutely-positioned dropdown gets cut
    // off or covered depending on row position. Portal it to <body> and track the
    // input's live position instead, so it always renders on top, fully visible.
    const shouldShowMenu = showSuggestions && !disabled && searchTerm.trim().length >= MIN_SEARCH_LENGTH;

    useEffect(() => {
        if (!shouldShowMenu) return;
        const updatePosition = () => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return;
            setMenuStyle({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        };
        updatePosition();
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);
        return () => {
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("resize", updatePosition);
        };
    }, [shouldShowMenu]);

    if (!isEditing && value) {
        const words = value.trim().split(/\s+/).filter(Boolean);
        return (
            <div className="flex items-start justify-between gap-1 w-full">
                <div
                    className={`min-w-0 flex-1 leading-tight ${disabled ? "" : "cursor-pointer"}`}
                    onClick={() => !disabled && setIsEditing(true)}
                    title={disabled ? undefined : "Click to change"}
                >
                    {words.map((word, i) => (
                        <div key={i} className="break-words">{word}</div>
                    ))}
                </div>
                {!disabled && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange("", "");
                            handleRowFieldChange(rowId, "cardNo", "");
                        }}
                        className="shrink-0 text-slate-400 hover:text-red-500 leading-none text-sm font-normal normal-case px-0.5"
                        title="Clear selection"
                    >
                        ×
                    </button>
                )}
            </div>
        );
    }

    return (
        <div ref={wrapperRef} className="relative w-full">
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
                onBlur={() => setTimeout(() => {
                    setShowSuggestions(false);
                    if (value) setIsEditing(false);
                }, 200)}
                placeholder="Search user..."
                disabled={disabled}
                className="h-8 w-full min-w-0 text-xs shadow-none border-slate-200 bg-white"
            />
            {shouldShowMenu && menuStyle && createPortal(
                <ul
                    style={{ position: "fixed", top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
                    className="bg-white border border-slate-200 rounded shadow-lg max-h-40 overflow-y-auto z-[9999] py-1 normal-case font-normal text-left"
                >
                    {isSearching ? (
                        <li className="px-2 py-1.5 text-xs text-slate-400 flex items-center gap-1.5">
                            <IconLoader className="h-3 w-3 animate-spin" /> Searching...
                        </li>
                    ) : suggestions.length > 0 ? (
                        suggestions.map((s) => (
                            <li
                                key={s._id || s.id}
                                onMouseDown={() => {
                                    onChange(s._id || s.id, s.fullName || s.name, s.lineName, s.subSectionName);
                                    handleRowFieldChange(rowId, "cardNo", s.cardNo || s.username || s.empId || "-");
                                    setShowSuggestions(false);
                                }}
                                className="px-2 py-1 text-xs hover:bg-blue-50 cursor-pointer flex flex-col"
                            >
                                <span className="font-semibold text-slate-700">{s.fullName || s.name}</span>
                                <span className="text-[10px] text-slate-500 font-mono">Card: {s.cardNo || s.username || s.empId || "—"}</span>
                            </li>
                        ))
                    ) : (
                        <li className="px-2 py-1.5 text-xs text-slate-400">No matches found</li>
                    )}
                </ul>,
                document.body
            )}
        </div>
    );
});
UserCellSelector.displayName = "UserCellSelector";

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

const SkillUpgradationRow = React.memo(function SkillUpgradationRow({
    row,
    index,
    departmentId,
    sectionId,
    lineId,
    year,
    lines,
    subSections,
    levels,
    canManage,
    canOverrideDates,
    onFieldChange,
    onUserSelect,
    onRemove,
    formatDayCountBadge,
    stickyFrozenCell,
}) {
    const rowId = row.rowId;
    const rowSubSections = row.modelLine
        ? subSections.filter(ss => ss.lineName === row.modelLine)
        : subSections;

    return (
        <tr className="group hover:bg-slate-50/50 transition-colors [&>td]:border-b [&>td]:border-slate-200">
            <td className={`${stickyFrozenCell} w-[70px] min-w-[70px] border-r border-slate-200 p-2 text-center text-slate-500 font-medium whitespace-nowrap`} style={{ left: 0 }}>{index + 1}</td>
            <td className={`${stickyFrozenCell} w-[110px] min-w-[110px] border-r border-slate-200 p-2 font-bold text-slate-800 uppercase whitespace-normal break-words`} style={{ left: '70px' }}>
                <UserCellSelector
                    value={row.userName}
                    onChange={(userId, userName, lineName, subSectionName) => {
                        onUserSelect(rowId, userId, userName, lineName, subSectionName);
                    }}
                    departmentId={departmentId}
                    sectionId={sectionId}
                    lineId={lineId}
                    rowId={rowId}
                    handleRowFieldChange={onFieldChange}
                    disabled={!canManage}
                />
            </td>
            <td className={`${stickyFrozenCell} w-[120px] min-w-[120px] border-r border-slate-200 p-2 text-center font-bold text-slate-800 whitespace-nowrap`} style={{ left: '180px' }}>
                <Input
                    value={row.cardNo || ""}
                    disabled={true}
                    className="h-8 w-full min-w-[90px] text-xs shadow-none bg-slate-50 border-slate-200 text-center font-bold"
                    placeholder="Card No"
                    readOnly
                />
            </td>
            {/* Model & Line */}
            <td className={`${stickyFrozenCell} w-[170px] min-w-[170px] border-r border-slate-200 p-1 whitespace-nowrap`} style={{ left: '300px' }}>
                <Select
                    value={row.modelLine || ""}
                    onValueChange={(val) => {
                        onFieldChange(rowId, "modelLine", val);
                        onFieldChange(rowId, "station", ""); // Reset station when line changes
                    }}
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
            <td className={`${stickyFrozenCell} w-[170px] min-w-[170px] border-r border-slate-200 p-1 whitespace-nowrap shadow-[4px_0_8px_-6px_rgba(15,23,42,0.35)]`} style={{ left: '470px' }}>
                <Select
                    value={row.station || ""}
                    onValueChange={(val) => onFieldChange(rowId, "station", val)}
                    disabled={!canManage}
                >
                    <SelectTrigger className="h-8 w-full min-w-[150px] bg-white border-slate-200 text-xs shadow-none">
                        <SelectValue placeholder="Select Station" />
                    </SelectTrigger>
                    <SelectContent>
                        {rowSubSections.map((ss) => (
                            <SelectItem key={ss.id || ss._id} value={ss.name}>
                                {ss.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </td>
            {QUARTERS.map(({ key, cellBg, badgeColor }) => {
                const shiftField = `${key}Shift`;
                const skillField = `${key}Skill`;
                const dateField = `${key}Date`;
                const dateActualField = `${key}DateActual`;
                const statusField = `${key}Status`;
                const quarterBounds = getQuarterDateBounds(key, year);
                const todayISO = new Date().toLocaleDateString('en-CA');
                const dateMin = canOverrideDates
                    ? quarterBounds.min
                    : (quarterBounds.min && quarterBounds.min > todayISO ? quarterBounds.min : todayISO);

                return (
                    <React.Fragment key={key}>
                        {/* Shift */}
                        <td className={`border-r border-slate-200 p-1 ${cellBg} text-center whitespace-nowrap`}>
                            <Select
                                value={row[shiftField] || ""}
                                onValueChange={(val) => onFieldChange(rowId, shiftField, val)}
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
                        {/* Skill Level */}
                        <td className={`border-r border-slate-200 p-1 ${cellBg} whitespace-nowrap`}>
                            <Select
                                value={row[skillField] || ""}
                                onValueChange={(val) => onFieldChange(rowId, skillField, val)}
                                disabled={!canManage}
                            >
                                <SelectTrigger className="h-8 w-full min-w-[70px] bg-white border-slate-200 text-xs shadow-none">
                                    <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(levels || []).map((l, idx) => (
                                        <SelectItem key={`${l.name}-${idx}`} value={l.name}>
                                            {l.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {row[skillField] && (
                                <div className={`text-[9px] ${badgeColor} font-semibold text-center mt-0.5`} title="Days until next plan date, based on this skill level">
                                    {formatDayCountBadge(row[skillField])}
                                </div>
                            )}
                        </td>
                        {/* Date */}
                        <td className={`border-r border-slate-200 p-1 ${cellBg} text-center whitespace-nowrap`}>
                            <input
                                type="date"
                                value={row[dateField] || ""}
                                min={dateMin}
                                max={quarterBounds.max}
                                onChange={(e) => onFieldChange(rowId, dateField, e.target.value)}
                                disabled={!canManage}
                                className="h-8 border border-slate-200 rounded-md px-1 text-xs w-full min-w-[130px] text-center bg-white focus-visible:outline-none"
                            />
                        </td>
                        {/* Date Actual */}
                        <td className={`border-r border-slate-200 p-1 ${cellBg} text-center whitespace-nowrap`}>
                            <input
                                type="date"
                                value={row[dateActualField] || ""}
                                min={dateMin}
                                max={quarterBounds.max}
                                onChange={(e) => onFieldChange(rowId, dateActualField, e.target.value)}
                                disabled={!canManage}
                                className="h-8 border border-slate-200 rounded-md px-1 text-xs w-full min-w-[130px] text-center bg-white focus-visible:outline-none"
                            />
                        </td>
                        {/* Status */}
                        <td className={`border-r border-slate-200 p-1 ${cellBg} whitespace-nowrap`}>
                            <Select
                                value={row[statusField] || ""}
                                onValueChange={(val) => onFieldChange(rowId, statusField, val)}
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
                        onClick={() => onRemove(rowId, row.userId)}
                        className="text-red-500 hover:text-red-700 p-1 h-auto"
                        title="Remove Row"
                    >
                        <IconTrash className="w-4 h-4 text-red-500 hover:text-red-700" />
                    </Button>
                )}
            </td>
        </tr>
    );
});
SkillUpgradationRow.displayName = "SkillUpgradationRow";

const SkillUpgradationPlan = ({
    students = [],
    isLoadingStudents = false,
    departmentId,
    sectionId,
    lineId,
    year,
    isReadOnly = false,
    page = 1,
    setPage = () => {},
    limit = 50,
    setLimit = () => {},
    search = "",
    setSearch = () => {},
    totalUsers = 0,
    totalPages = 1,
}) => {
    const liveRevisionInfo = useRevisionInfo("skill-upgradation-plan", { docNo: "FRM-WH-QA-236" }, { departmentId, sectionId });
    const [savedRevisionInfo, setSavedRevisionInfo] = useState(null);
    // A saved plan keeps whatever docNo/revNo/revDate was frozen into it at
    // creation; only a brand-new (never-saved) plan shows the live value.
    const revisionInfo = savedRevisionInfo?.docNo ? savedRevisionInfo : liveRevisionInfo;
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN' || authUser?.role === 'INSTRUCTOR' || authUser?.isTrainer;

    const { canManage, canOverrideDates } = useMemo(() => {
        if (isReadOnly) return { canManage: false, canOverrideDates: false };
        const permissions = authUser?.customRole?.permissions || [];
        // Narrower than canManage's `isAdmin` bypass on purpose: `isAdmin` here also covers
        // every plain Instructor/Trainer, and reusing it would silently hand unrestricted
        // dates to all of them instead of only whoever's been granted the permission.
        const isSystemAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';
        return {
            canManage: permissions.includes('skill_upgradation:manage') || permissions.includes('skill_upgradation:update') || isAdmin,
            canOverrideDates: isSystemAdmin || permissions.includes('skill_upgradation:manage') || permissions.includes('skill_upgradation:override_dates'),
        };
    }, [authUser, isAdmin, isReadOnly]);

    const [logAction] = useLogActionMutation();
    const [searchInput, setSearchInput] = useState(search || "");
    const [rows, setRows] = useState([]);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [removedUserIds, setRemovedUserIds] = useState(new Set());

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
    const skillUpgradationDayCount = currentSection?.skillUpgradationDayCount ?? null;
    const skillUpgradationDayCounts = currentSection?.skillUpgradationDayCounts;

    const { data: activeConfigData } = useGetActiveConfigQuery();
    const activeConfig = activeConfigData?.data;
    const levels = useMemo(
        () => [...(activeConfig?.levels || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        [activeConfig]
    );
    const maxLevelOrder = useMemo(() => {
        if (!levels.length) return null;
        return levels.reduce((max, l) => (typeof l.order === "number" && l.order > max ? l.order : max), -Infinity);
    }, [levels]);
    // Mirrors syncToSkillUpgradationPlan's case-insensitive level lookup in
    // server/utils/skillMatrix.util.js. Returns false whenever config hasn't loaded yet or the
    // name doesn't match a configured level — callers must treat false as "not confirmed last,
    // keep existing behavior", never as "definitely not last".
    const isMaxLevelName = useCallback((levelName) => {
        if (!levelName || maxLevelOrder === null || !Number.isFinite(maxLevelOrder)) return false;
        const match = levels.find(l => l.name?.toUpperCase() === String(levelName).toUpperCase());
        return !!match && typeof match.order === "number" && match.order === maxLevelOrder;
    }, [levels, maxLevelOrder]);

    // Resolves the day count to apply once an associate reaches `level`:
    // per-level override -> section default -> null (caller falls back to 3 months).
    const resolveDayCountForLevel = useCallback((level) => {
        if (level && skillUpgradationDayCounts?.[level]) return skillUpgradationDayCounts[level];
        return skillUpgradationDayCount || null;
    }, [skillUpgradationDayCounts, skillUpgradationDayCount]);
    const formatDayCountBadge = useCallback((level) => {
        const count = resolveDayCountForLevel(level);
        return count ? `+${count}d` : "+3mo";
    }, [resolveDayCountForLevel]);

    const [tableData, setTableData] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingPlan, setIsLoadingPlan] = useState(true);

    // Merges the current page's in-memory row edits into tableData (keyed by userId) so
    // they survive a page/search/limit change — rows gets rebuilt from tableData + the new
    // page's students, and without this any unsaved edits on the page being left would
    // silently vanish.
    const syncRowsToTableData = useCallback(() => {
        const currentPageData = {};
        rows.forEach(row => {
            if (!row.userId) return;
            currentPageData[row.userId] = {
                userName: row.userName || "",
                cardNo: row.cardNo || "",
                modelLine: row.modelLine || "",
                station: row.station || "",
                q1Skill: row.q1Skill, q1Date: row.q1Date, q1DateActual: row.q1DateActual, q1Status: row.q1Status, q1Shift: row.q1Shift,
                q2Skill: row.q2Skill, q2Date: row.q2Date, q2DateActual: row.q2DateActual, q2Status: row.q2Status, q2Shift: row.q2Shift,
                q3Skill: row.q3Skill, q3Date: row.q3Date, q3DateActual: row.q3DateActual, q3Status: row.q3Status, q3Shift: row.q3Shift,
                q4Skill: row.q4Skill, q4Date: row.q4Date, q4DateActual: row.q4DateActual, q4Status: row.q4Status, q4Shift: row.q4Shift,
            };
        });
        setTableData(prev => ({ ...prev, ...currentPageData }));
    }, [rows]);

    // Reset state when department/section/line/year changes
    useEffect(() => {
        setHasLoaded(false);
        setRows([]);
        setRemovedUserIds(new Set());
        setIsLoadingPlan(true);
    }, [departmentId, sectionId, lineId, year]);

    // Initialize rows when both students and plan data are ready. isLoadingStudents is part of
    // the guard so a page/search/limit change (which flips it true while the new page fetches)
    // doesn't rebuild rows from the still-stale `students` value in between.
    useEffect(() => {
        if (isLoadingPlan || isLoadingStudents || hasLoaded) return;

        const savedRemovedIds = new Set(tableData.__removedUserIds || []);
        const finalRows = [];

        // 1. Auto-populate all currently eligible students (skip removed ones)
        students.forEach((student) => {
            const userId = String(student._id || student.id);
            if (savedRemovedIds.has(userId)) return;
            finalRows.push(buildRowForStudent(student, tableData[userId] || {}));
        });

        // Users already saved in tableData but no longer in the current eligible
        // list (e.g. their 16-Day sheet approval lapsed, or they moved sections)
        // are intentionally left out of finalRows — hidden from view, but their
        // data in tableData is untouched (handleSave only overwrites userIds that
        // are currently visible/eligible) and reappears automatically if they
        // become eligible again.

        // 2. Always append 10 blank rows at the bottom for manual entry
        const BLANK_PADDING = 10;
        const baseCount = finalRows.length;
        for (let i = 0; i < BLANK_PADDING; i++) {
            finalRows.push({
                rowId: `temp-${baseCount + i}-${Math.random()}`,
                userId: "", userName: "", cardNo: "", modelLine: "", station: "",
                q1Skill: "", q1Date: "", q1DateActual: "", q1Status: "", q1Shift: "",
                q2Skill: "", q2Date: "", q2DateActual: "", q2Status: "", q2Shift: "",
                q3Skill: "", q3Date: "", q3DateActual: "", q3Status: "", q3Shift: "",
                q4Skill: "", q4Date: "", q4DateActual: "", q4Status: "", q4Shift: "",
            });
        }

        setRemovedUserIds(savedRemovedIds);
        setRows(finalRows);
        setHasLoaded(true);
    }, [tableData, students, isLoadingPlan, isLoadingStudents, hasLoaded]);

    // Safeguard: (1) refreshes row metadata (names, card numbers, line, etc.) if the students
    // list finishes loading after rows are initialized, and (2) inserts a row — at the very
    // top — for anyone who becomes newly eligible after the sheet's initial load (e.g. their
    // 16-Day sheet gets approved while this page is already open). The one-time init effect
    // above only runs once per department/section/year selection, so without this, a newly
    // eligible associate would silently never appear until the admin reselects the section.
    useEffect(() => {
        if (students.length === 0 || !hasLoaded) return;

        setRows(prev => {
            const existingUserIds = new Set(prev.map(r => r.userId).filter(Boolean));

            const refreshedPrev = prev.map(row => {
                if (!row.userId) return row;
                const student = students.find(s => String(s._id || s.id) === String(row.userId));
                if (student) {
                    return {
                        ...row,
                        userName: student.fullName || student.name || row.userName,
                        cardNo: student.cardNo || student.username || student.empId || row.cardNo,
                        modelLine: row.modelLine || student.lineName || "",
                        station: row.station || student.subSectionName || "",
                    };
                }
                return row;
            });

            const newRows = [];
            students.forEach((student) => {
                const userId = String(student._id || student.id);
                if (existingUserIds.has(userId) || removedUserIds.has(userId)) return;
                newRows.push(buildRowForStudent(student, tableData[userId] || {}));
            });

            return newRows.length > 0 ? [...newRows, ...refreshedPrev] : refreshedPrev;
        });
    }, [students, hasLoaded, tableData, removedUserIds]);

    useEffect(() => {
        if (!departmentId) return;
        let cancelled = false;

        const loadSavedPlan = async () => {
            try {
                setIsLoadingPlan(true);
                setTableData({});
                const response = await axiosInstance.get(`/api/skill-upgradation-plan/department/${departmentId}`, {
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
                    toast.error("Failed to load skill upgradation plan");
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

    const handleAddRow = useCallback(() => {
        setRows(prev => [
            ...prev,
            {
                rowId: `temp-add-${prev.length}-${Date.now()}`,
                userId: "",
                userName: "",
                cardNo: "",
                modelLine: "",
                station: "",
                q1Skill: "", q1Date: "", q1DateActual: "", q1Status: "", q1Shift: "",
                q2Skill: "", q2Date: "", q2DateActual: "", q2Status: "", q2Shift: "",
                q3Skill: "", q3Date: "", q3DateActual: "", q3Status: "", q3Shift: "",
                q4Skill: "", q4Date: "", q4DateActual: "", q4Status: "", q4Shift: ""
            }
        ]);
    }, []);

    const handleRemoveEmployee = useCallback((rowId, userId) => {
        setRows(prev => prev.filter(row => row.rowId !== rowId));
        if (userId) {
            setRemovedUserIds(prev => new Set([...prev, String(userId)]));
        }
        toast.success("Row removed from sheet");
    }, []);

    const handleRowFieldChange = useCallback((rowId, field, value) => {
        const dateMatch = field.match(/^(q1|q2|q3|q4)(Date|DateActual)$/);
        if (dateMatch && value) {
            const quarterKey = dateMatch[1];
            const validation = validateDateForQuarter(value, quarterKey, year);
            if (!validation.valid) {
                toast.error(`Invalid date: ${validation.reason}`);
                return;
            }
        }

        setRows(prev => prev.map(row => {
            if (row.rowId !== rowId) return row;
            const updated = { ...row, [field]: value };

            // If actual date is updated, calculate and place the next plan date in
            // whichever quarter it actually falls into (skill level can push it past
            // the immediately-following quarter, e.g. a Q1 actual + long day-count
            // lands the next plan date in Q3, not Q2).
            const actualDateMatch = field.match(/^(q1|q2|q3|q4)DateActual$/);
            if (actualDateMatch && value) {
                const currentQuarterKey = actualDateMatch[1];
                const levelField = SKILL_FIELD_FOR_ACTUAL[field];
                const currentLevel = levelField ? row[levelField] : null;
                let futureDate = calculateFutureDate(value, resolveDayCountForLevel(currentLevel));

                if (futureDate) {
                    const [, fMonth] = futureDate.split("-").map(Number);
                    let targetQuarterKey = "";
                    if (fMonth >= 1 && fMonth <= 3) targetQuarterKey = "q1";
                    else if (fMonth >= 4 && fMonth <= 6) targetQuarterKey = "q2";
                    else if (fMonth >= 7 && fMonth <= 9) targetQuarterKey = "q3";
                    else if (fMonth >= 10 && fMonth <= 12) targetQuarterKey = "q4";

                    // A short day-count (or one that rolls into the following year, which
                    // resolves to an earlier-looking month) can land the calculated date back
                    // in the same quarter as the completion, or an earlier one. That would
                    // overwrite the wrong column, so push it out to the start of the next
                    // quarter instead — unless the completion was already in Q4, which has no
                    // "next quarter" within this year to push into.
                    if (
                        targetQuarterKey &&
                        QUARTER_INDEX[targetQuarterKey] <= QUARTER_INDEX[currentQuarterKey] &&
                        QUARTER_INDEX[currentQuarterKey] < 4
                    ) {
                        targetQuarterKey = `q${QUARTER_INDEX[currentQuarterKey] + 1}`;
                        futureDate = `${year}-${QUARTER_START_MONTH_DAY[targetQuarterKey]}`;
                    }

                    if (targetQuarterKey) {
                        const targetPlanField = `${targetQuarterKey}Date`;
                        const oldTargetField = ACTUAL_TO_PLAN[field];
                        if (oldTargetField && oldTargetField !== targetPlanField) {
                            updated[oldTargetField] = "";
                        }
                        updated[targetPlanField] = futureDate;

                        // The last (max-order) configured level has no "next level" for the
                        // target quarter's Skill dropdown to advance to, so carry the same
                        // level forward instead of leaving it blank — the plan keeps recurring
                        // at the max level (with a fresh plan date each quarter) rather than
                        // appearing to stop once it's reached.
                        if (isMaxLevelName(currentLevel)) {
                            updated[`${targetQuarterKey}Skill`] = currentLevel;
                            updated[`${targetQuarterKey}Status`] = "Planned";
                        }
                    }
                }
            }
            return updated;
        }));
    }, [resolveDayCountForLevel, year, isMaxLevelName]);

    const handleUserSelect = useCallback((rowId, userId, userName, lineName, subSectionName) => {
        setRows(prev => prev.map(row => {
            if (row.rowId !== rowId) return row;
            return {
                ...row,
                userId,
                userName,
                modelLine: lineName || "",
                station: subSectionName || "",
            };
        }));
    }, []);

    // The backend already filters `students` by `search`, so rows built from it are already
    // matched — this just hides the always-appended blank manual-entry rows while a search is
    // active, matching the old client-side-filter UX.
    const filteredRows = useMemo(() => {
        if (!search.trim()) return rows;
        return rows.filter(row => row.userId);
    }, [rows, search]);

    // Debounces the search input into the parent's `search` query state (which drives the
    // backend-paginated student fetch), syncing any unsaved edits on the current page first
    // and resetting to page 1 so the new results start from the top.
    useEffect(() => {
        if (searchInput === search) return;
        const timer = setTimeout(() => {
            syncRowsToTableData();
            setHasLoaded(false);
            setPage(1);
            setSearch(searchInput);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput]);

    // Keeps the input in sync when the parent resets `search` itself (e.g. switching dept/section/line).
    useEffect(() => {
        setSearchInput(search || "");
    }, [search]);

    const handlePageChange = useCallback((newPage) => {
        if (newPage < 1 || newPage > (totalPages || 1) || newPage === page) return;
        syncRowsToTableData();
        setHasLoaded(false);
        setPage(newPage);
    }, [syncRowsToTableData, setPage, page, totalPages]);

    const handleLimitChange = useCallback((newLimit) => {
        syncRowsToTableData();
        setHasLoaded(false);
        setPage(1);
        setLimit(Number(newLimit));
    }, [syncRowsToTableData, setPage, setLimit]);

    const handleSave = useCallback(async (sendEmail = false) => {
        if (!departmentId) return;

        // Convert this line's rows to tableData format
        const currentLineData = {};
        rows.forEach(row => {
            if (row.userId) {
                currentLineData[row.userId] = {
                    userName: row.userName || "",
                    cardNo: row.cardNo || "",
                    modelLine: row.modelLine || "",
                    station: row.station || "",
                    q1Skill: row.q1Skill,
                    q1Date: row.q1Date,
                    q1DateActual: row.q1DateActual,
                    q1Status: row.q1Status,
                    q1Shift: row.q1Shift,
                    q2Skill: row.q2Skill,
                    q2Date: row.q2Date,
                    q2DateActual: row.q2DateActual,
                    q2Status: row.q2Status,
                    q2Shift: row.q2Shift,
                    q3Skill: row.q3Skill,
                    q3Date: row.q3Date,
                    q3DateActual: row.q3DateActual,
                    q3Status: row.q3Status,
                    q3Shift: row.q3Shift,
                    q4Skill: row.q4Skill,
                    q4Date: row.q4Date,
                    q4DateActual: row.q4DateActual,
                    q4Status: row.q4Status,
                    q4Shift: row.q4Shift
                };
            }
        });

        // Merge this line's rows back into the full section-wide tableData so
        // other lines' saved data (which this component never loaded into `rows`) isn't lost.
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
            const response = await axiosInstance.post(`/api/skill-upgradation-plan/department/${departmentId}`, {
                sectionId,
                year,
                selectedLines: [],
                tableData: mergedTableData,
                sendEmail,
            });
            setTableData(mergedTableData);
            setRemovedUserIds(combinedRemovedIds);
            toast.success(response?.data?.message || "Skill upgradation plan saved successfully");
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to save skill upgradation plan");
        } finally {
            setIsSaving(false);
        }
    }, [departmentId, sectionId, year, rows, tableData, removedUserIds]);

    const handlePrint = () => {
        logAction({
            action: "PRINT_SKILL_UPGRADATION_PLAN",
            details: { departmentId, sectionId, year }
        }).catch(() => { });
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
                        Plan for Skill Upgradation
                    </h2>
                    <div className="flex items-center gap-2">
                        {canManage && (
                            <Button variant="outline" onClick={handleAddRow} className="border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold shadow-sm">
                                <IconPlus className="h-4 w-4 mr-2" />
                                Add Row
                            </Button>
                        )}
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
                            <Button onClick={() => handleSave(true)} disabled={isSaving || isLoadingPlan} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm">
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
                            Plan for Skill Upgradation
                        </h2>
                        <span className="print:hidden text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Interactive Skill Upgradation Plan (Year: {year})
                        </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 border border-slate-950 bg-slate-50 px-3 py-1 rounded shadow-sm print:shadow-none print:bg-white print:rounded-none whitespace-nowrap">
                        Document No: {revisionInfo.docNo}
                    </div>
                </div>
                <div className="no-print flex flex-col sm:flex-row items-end gap-4 mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="w-full sm:w-72">
                        <Label className="text-xs font-bold text-slate-700 mb-1 block">Search Associates</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="Search by name or card no..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="h-9 bg-white text-sm"
                            />
                            {searchInput && (
                                <Button variant="ghost" size="sm" onClick={() => setSearchInput("")} className="h-9 px-2 text-xs">
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
                    <table className="w-full min-w-[2900px] border-separate border-spacing-0 text-sm table-auto">
                        <thead className="bg-slate-100 text-slate-700">
                            {/* Group headers row */}
                            <tr className="h-12 [&>th]:border-b [&>th]:border-slate-300">
                                <th rowSpan="2" className={`${stickyFrozenHeader} w-[70px] min-w-[70px] border-r border-slate-300 bg-slate-100 p-2 text-center font-bold align-middle whitespace-nowrap`} style={{ left: 0 }}>Sr. No</th>
                                <th rowSpan="2" className={`${stickyFrozenHeader} w-[110px] min-w-[110px] border-r border-slate-300 bg-slate-100 p-2 text-center align-middle whitespace-normal break-words`} style={{ left: '70px' }}>
                                    <div className="leading-tight">
                                        <div>Associates</div>
                                        <div>Name</div>
                                    </div>
                                </th>
                                <th rowSpan="2" className={`${stickyFrozenHeader} w-[120px] min-w-[120px] border-r border-slate-300 bg-slate-100 p-2 text-center font-bold align-middle whitespace-nowrap`} style={{ left: '180px' }}>Card No</th>
                                <th rowSpan="2" className={`${stickyFrozenHeader} w-[170px] min-w-[170px] border-r border-slate-300 bg-slate-100 text-center font-bold align-middle whitespace-nowrap`} style={{ left: '300px' }}>Model & Line</th>
                                <th rowSpan="2" className={`${stickyFrozenHeader} w-[170px] min-w-[170px] border-r border-slate-300 bg-slate-100 p-2 text-center font-bold align-middle whitespace-nowrap shadow-[4px_0_8px_-6px_rgba(15,23,42,0.45)]`} style={{ left: '470px' }}>Station</th>
                                {QUARTERS.map(({ key, label, headerBg }) => (
                                    <th key={key} colSpan="5" className={`${stickyHeader} border-r border-slate-300 p-2 text-center font-bold ${headerBg} whitespace-nowrap`}>{label}</th>
                                ))}
                                <th rowSpan="2" className={`${stickyHeader} border-r border-slate-300 bg-slate-100 p-2 text-left font-bold align-middle whitespace-nowrap`}>Action</th>
                            </tr>
                            <tr className="bg-slate-50 [&>th]:border-b [&>th]:border-slate-300">
                                {QUARTERS.map(({ key, headerBg }) => (
                                    <React.Fragment key={key}>
                                        <th className={`${stickySubHeader} border-r border-slate-300 ${headerBg} p-1 text-center text-xs font-semibold whitespace-nowrap`}>Shift</th>
                                        <th className={`${stickySubHeader} border-r border-slate-300 ${headerBg} p-1 text-center text-xs font-semibold whitespace-nowrap`}>Skill Level</th>
                                        <th className={`${stickySubHeader} border-r border-slate-300 ${headerBg} p-1 text-center text-xs font-semibold whitespace-nowrap`}>Updation Date (Plan)</th>
                                        <th className={`${stickySubHeader} border-r border-slate-300 ${headerBg} p-1 text-center text-xs font-semibold whitespace-nowrap`}>Updation Date (Actual)</th>
                                        <th className={`${stickySubHeader} border-r border-slate-300 ${headerBg} p-1 text-center text-xs font-semibold whitespace-nowrap`}>Status</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="bg-white">
                            {filteredRows.map((row, index) => (
                                <SkillUpgradationRow
                                    key={row.rowId}
                                    row={row}
                                    index={index}
                                    departmentId={departmentId}
                                    sectionId={sectionId}
                                    lineId={lineId}
                                    year={year}
                                    lines={lines}
                                    levels={levels}
                                    subSections={subSections}
                                    canManage={canManage}
                                    canOverrideDates={canOverrideDates}
                                    onFieldChange={handleRowFieldChange}
                                    onUserSelect={handleUserSelect}
                                    onRemove={handleRemoveEmployee}
                                    formatDayCountBadge={formatDayCountBadge}
                                    stickyFrozenCell={stickyFrozenCell}
                                />
                            ))}
                            {filteredRows.length === 0 && (
                                <tr>
                                    <td colSpan="26" className="border border-slate-300 p-8 text-center text-muted-foreground bg-slate-50">
                                        No rows match the search filter.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="no-print flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                        <span>
                            {totalUsers === 0
                                ? "No associates found"
                                : `Showing ${(page - 1) * limit + 1}-${Math.min(page * limit, totalUsers)} of ${totalUsers} associates`}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span>Rows per page</span>
                            <Select value={String(limit)} onValueChange={handleLimitChange}>
                                <SelectTrigger className="h-8 w-[70px] bg-white border-slate-200 text-xs shadow-none">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="20">20</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center gap-1.5">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1 || isLoadingStudents}
                                className="h-8 px-2.5 text-xs"
                            >
                                <IconChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            {getPageNumbers(page, totalPages).map((p, idx) =>
                                p === "..." ? (
                                    <span key={`ellipsis-${idx}`} className="px-1 text-xs text-slate-400">…</span>
                                ) : (
                                    <Button
                                        key={p}
                                        variant={p === page ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => handlePageChange(p)}
                                        disabled={isLoadingStudents}
                                        className={`h-8 w-8 p-0 text-xs ${p === page ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                                    >
                                        {p}
                                    </Button>
                                )
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page === totalPages || isLoadingStudents}
                                className="h-8 px-2.5 text-xs"
                            >
                                <IconChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default SkillUpgradationPlan;
