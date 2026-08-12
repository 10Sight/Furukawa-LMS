import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    ComposedChart,
    Bar,
    Line,
    BarChart,
    LineChart,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    ReferenceLine,
    Cell,
} from 'recharts';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
    Users,
    TrendingDown,
    Filter,
    Calendar as CalendarIcon,
    RotateCw,
    Loader2,
    Clock,
    UserCheck,
    UserX,
    BarChart3,
    LineChart as LineChartIcon,
    Map,
    MapPin,
    Briefcase,
    Eye,
    EyeOff,
    ArrowLeft,
    GraduationCap,
    CalendarPlus,
    Trash2,
    Save,
} from 'lucide-react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import highcharts3d from 'highcharts/highcharts-3d';
import { useGetDashboardStatsQuery } from "@/Redux/AllApi/DashboardApi";
import axiosInstance from '../../Helper/axiosInstance';
import { useNavigate } from 'react-router-dom';

if (typeof highcharts3d === 'function') {
    highcharts3d(Highcharts);
}

const defaultFilter = {
    department: ["ALL"],
    section: ["ALL"],
    line: ["ALL"],
    dateRange: undefined,
    shift: "ALL",
};

const normalizeMultiValue = (value) => {
    if (Array.isArray(value)) {
        const clean = value.filter(Boolean).map(String);
        return clean.length ? clean : ["ALL"];
    }

    if (!value || value === "ALL") return ["ALL"];

    return String(value)
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
};

const serializeMultiValue = (value) => {
    const clean = normalizeMultiValue(value).filter(item => item !== "ALL");
    return clean.length ? clean.join(",") : "ALL";
};

const hasRealSelection = (value) => normalizeMultiValue(value).some(item => item !== "ALL");

// ✅ FIXED: handles both wrapped (res.data.data.key) and interceptor-unwrapped (res.data.key) axios responses
const extractApiList = (res, key) => {
    // If axiosInstance interceptor unwraps response.data automatically,
    // then res itself is { statuscode, data: { sections }, message, success }
    // and res.data = { sections: [...] }
    // If not intercepted, res.data = { statuscode, data: { sections }, ... }
    // and res.data.data = { sections: [...] }

    const level1 = res?.data?.data; // double-wrapped: res.data.data
    const level2 = res?.data;       // single-wrapped: res.data
    const level0 = res;             // fully unwrapped: res itself

    // Try res.data.data first (standard axios, no interceptor unwrapping)
    if (Array.isArray(level1)) return level1;
    if (level1 && Array.isArray(level1[key])) return level1[key];

    // Try res.data (interceptor unwrapped one level)
    if (Array.isArray(level2)) return level2;
    if (level2 && Array.isArray(level2[key])) return level2[key];

    // Try res directly (fully unwrapped interceptor)
    if (Array.isArray(level0)) return level0;
    if (level0 && Array.isArray(level0[key])) return level0[key];

    return [];
};

const normalizeOptionItem = (item, fallbackPrefix = "item") => {
    const id =
        item?.id ??
        item?._id ??
        item?.value ??
        item?.sectionId ??
        item?.lineId ??
        item?.departmentId ??
        item?.unicode ??
        item?.code;

    const name =
        item?.name ??
        item?.label ??
        item?.sectionName ??
        item?.lineName ??
        item?.departmentName ??
        item?.description ??
        item?.title ??
        item?.section ??
        item?.line ??
        String(id ?? "");

    return {
        ...item,
        id: String(id ?? `${fallbackPrefix}-${name}`),
        name: String(name || id || "Unnamed"),
    };
};

const normalizeApiOptions = (list = [], fallbackPrefix = "item") => {
    return (Array.isArray(list) ? list : [])
        .map((item, index) => normalizeOptionItem(item, `${fallbackPrefix}-${index}`))
        .filter(item => item.id && item.name);
};

const TENURE_BUCKETS = [
    { value: 'ALL', label: 'All joining buckets' },
    { value: '0-16d', label: '0–16 days' },
    { value: '17-30d', label: '17–30 days' },
    { value: '31-60d', label: '31–60 days' },
    { value: '61-90d', label: '61–90 days' },
    { value: '3m-6m', label: '3m–6m' },
    { value: '6m-9m', label: '6m–9m' },
    { value: '9m-1y', label: '9m–1y' },
    { value: '1y-2y', label: '1y–2y' },
    { value: '2y-3y', label: '2y–3y' },
    { value: '3y-others', label: '3y & others' },
    { value: 'CUSTOM', label: 'Custom days' },
];

const TOP_VISIBLE_DAYS = 15;
const TOP_DAY_MIN_WIDTH = 96;
const TOP_CHART_HEIGHT_CLASS = "h-[320px]";

const getTopChartInnerWidth = (dataLength = 0) => {
    const safeLength = Number(dataLength) || 0;
    return `${Math.max(safeLength, TOP_VISIBLE_DAYS) * TOP_DAY_MIN_WIDTH}px`;
};

const ScrollableTopChart = ({ dataLength = 0, scrollToStart = false, children }) => {
    const scrollRef = useRef(null);

    useEffect(() => {
        const node = scrollRef.current;
        if (!node) return;

        window.requestAnimationFrame(() => {
            // Preserve old default behavior (latest date visible).
            // For a manually selected range, open from the starting date.
            node.scrollLeft = scrollToStart ? 0 : node.scrollWidth;
        });
    }, [dataLength, scrollToStart]);

    return (
        <div className={`w-full relative ${TOP_CHART_HEIGHT_CLASS}`}>
            <div
                ref={scrollRef}
                className="absolute inset-0 overflow-x-auto overflow-y-hidden pb-2 overscroll-x-contain"
            >
                <div
                    className="h-full relative"
                    style={{
                        width: getTopChartInnerWidth(dataLength),
                        minWidth: getTopChartInnerWidth(dataLength),
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
};

const MANPOWER_DAY_MIN_WIDTH = 180;

const getManpowerChartInnerWidth = (dataLength = 0) => {
    const safeLength = Number(dataLength) || 0;
    return `${Math.max(safeLength, TOP_VISIBLE_DAYS) * MANPOWER_DAY_MIN_WIDTH}px`;
};

const ScrollableManpowerChart = ({ dataLength = 0, scrollToStart = false, children }) => {
    const scrollRef = useRef(null);

    useEffect(() => {
        const node = scrollRef.current;
        if (!node) return;

        window.requestAnimationFrame(() => {
            // Preserve old default behavior (latest date visible).
            // For a manually selected range, open from the starting date.
            node.scrollLeft = scrollToStart ? 0 : node.scrollWidth;
        });
    }, [dataLength, scrollToStart]);

    return (
        <div className={`w-full relative ${TOP_CHART_HEIGHT_CLASS}`}>
            <div
                ref={scrollRef}
                className="absolute inset-0 overflow-x-auto overflow-y-hidden pb-2 overscroll-x-contain"
            >
                <div
                    className="h-full relative"
                    style={{
                        width: getManpowerChartInnerWidth(dataLength),
                        minWidth: getManpowerChartInnerWidth(dataLength),
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
};

const getCompactChartInnerWidth = (dataLength = 0) => {
    const safeLength = Number(dataLength) || 0;
    // Compact width for bottom employee master bar charts.
    // Few bars stay close; many bars get horizontal scrolling.
    return `${Math.max(640, safeLength * 128)}px`;
};

const ScrollableCompactChart = ({ dataLength = 0, children }) => {
    const scrollRef = useRef(null);

    useEffect(() => {
        const node = scrollRef.current;
        if (!node) return;

        window.requestAnimationFrame(() => {
            node.scrollLeft = 0;
        });
    }, [dataLength]);

    return (
        <div className="w-full relative h-[430px]">
            <div
                ref={scrollRef}
                className="absolute inset-0 overflow-x-auto overflow-y-hidden pb-2 overscroll-x-contain"
            >
                <div
                    className="h-full relative"
                    style={{
                        width: getCompactChartInnerWidth(dataLength),
                        minWidth: getCompactChartInnerWidth(dataLength),
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
};

const getTenureChartInnerWidth = (dataLength = 0) => {
    const safeLength = Number(dataLength) || 0;

    // For 1-4 buckets, keep chart full width.
    // For many tenure buckets, enable horizontal scroll so labels/values do not overlap.
    if (safeLength <= 4) return "100%";

    return `${Math.max(760, safeLength * 160)}px`;
};

const ScrollableTenureChart = ({ dataLength = 0, children }) => {
    const scrollRef = useRef(null);

    useEffect(() => {
        const node = scrollRef.current;
        if (!node) return;

        window.requestAnimationFrame(() => {
            node.scrollLeft = 0;
        });
    }, [dataLength]);

    return (
        <div className="w-full relative h-[370px]">
            <div
                ref={scrollRef}
                className="absolute inset-0 overflow-x-auto overflow-y-hidden pb-2 overscroll-x-contain"
            >
                <div
                    className="h-full relative"
                    style={{
                        width: getTenureChartInnerWidth(dataLength),
                        minWidth: getTenureChartInnerWidth(dataLength),
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
};

const getContractorChartInnerWidth = (dataLength = 0) => {
    const safeLength = Number(dataLength) || 0;
    // Set a generous spacing of 180px per contractor category to keep labels/bars well separated
    if (safeLength <= 3) return "100%";
    return `${Math.max(800, safeLength * 180)}px`;
};

const ScrollableContractorChart = ({ dataLength = 0, children }) => {
    const scrollRef = useRef(null);

    useEffect(() => {
        const node = scrollRef.current;
        if (!node) return;

        window.requestAnimationFrame(() => {
            node.scrollLeft = 0;
        });
    }, [dataLength]);

    return (
        <div className="w-full relative h-[320px]">
            <div
                ref={scrollRef}
                className="absolute inset-0 overflow-x-auto overflow-y-hidden pb-2 overscroll-x-contain"
            >
                <div
                    className="h-full relative"
                    style={{
                        width: getContractorChartInnerWidth(dataLength),
                        minWidth: getContractorChartInnerWidth(dataLength),
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
};

const renderContractorMultilineAxisTick = ({ x, y, payload }) => {
    const lines = String(payload?.value || "")
        .split(/[\s\/\\_-]+/)
        .map(word => word.trim())
        .filter(Boolean);

    return (
        <text
            x={x}
            y={y + 8}
            textAnchor="middle"
            fill="#475569"
            fontSize={13}
            fontWeight={900}
            stroke="#ffffff"
            strokeWidth={0.55}
            paintOrder="stroke"
            style={{ fontWeight: 900, fontFamily: "'Arial Black', Arial, sans-serif" }}
        >
            {lines.map((line, index) => (
                <tspan
                    key={`${line}-${index}`}
                    x={x}
                    dy={index === 0 ? 0 : 15}
                >
                    {line}
                </tspan>
            ))}
        </text>
    );
};

const formatDateLocal = (date) => {
    if (!date) return undefined;

    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = String(dateStr).split("-");
    if (!year || !month || !day) return String(dateStr);
    return `${day}-${month}-${year}`;
};

const ATTENDANCE_DATE_TEXT_COLOR = "#1e3a8a";

const getPreviousAttendanceDateLabel = (stats) => {
    const source = stats?.data || stats || {};
    const filters = source?.filters || {};

    const start =
        filters.masterStartDate ||
        filters.masterAttendanceDate ||
        filters.attendanceDate ||
        filters.startDate ||
        source.masterStartDate ||
        source.masterAttendanceDate ||
        source.attendanceDate ||
        source.previousAttendanceDate ||
        source.startDate;

    const end =
        filters.masterEndDate ||
        filters.masterAttendanceDate ||
        filters.attendanceDate ||
        filters.endDate ||
        source.masterEndDate ||
        source.masterAttendanceDate ||
        source.attendanceDate ||
        source.previousAttendanceDate ||
        source.endDate;

    if (!start && !end) return "Attendance date: Previous date";

    if (start && end && start !== end) {
        return `Attendance date: ${formatDisplayDate(start)} to ${formatDisplayDate(end)}`;
    }

    return `Attendance date: ${formatDisplayDate(start || end)}`;
};

const withAttendanceDateSubtitle = (text, stats) => {
    return `${text} · ${getPreviousAttendanceDateLabel(stats)}`;
};

const renderSubtitleText = (subtitle, className = "text-sm text-slate-500 mt-1") => {
    const text = String(subtitle ?? "");
    const marker = "Attendance date:";
    const index = text.indexOf(marker);

    if (index === -1) {
        return <p className={className}>{subtitle}</p>;
    }

    return (
        <p className={className}>
            {text.slice(0, index)}
            <span
                className="font-bold"
                style={{ color: ATTENDANCE_DATE_TEXT_COLOR }}
            >
                {text.slice(index)}
            </span>
        </p>
    );
};

const getQueryParams = (filter, extra = {}) => ({
    department: serializeMultiValue(filter.department),
    section: serializeMultiValue(filter.section),
    line: serializeMultiValue(filter.line),

    startDate: filter.dateRange?.from
        ? formatDateLocal(filter.dateRange.from)
        : undefined,

    endDate: filter.dateRange?.to
        ? formatDateLocal(filter.dateRange.to)
        : filter.dateRange?.from
            ? formatDateLocal(filter.dateRange.from)
            : undefined,

    shift: filter.shift || "ALL",
    ...extra,
});

// LOWER GRAPH DATE RANGE FILTER DISABLED.
// To restore date filtering on the graphs below the top three, replace
// getLowerGraphQueryParams(...) calls with getQueryParams(...), or restore
// the commented startDate/endDate fields below.
const getLowerGraphQueryParams = (filter, extra = {}) => ({
    department: serializeMultiValue(filter.department),
    section: serializeMultiValue(filter.section),
    line: serializeMultiValue(filter.line),

    /* RESTORE LOWER GRAPH DATE RANGE FILTER:
    startDate: filter.dateRange?.from
        ? formatDateLocal(filter.dateRange.from)
        : undefined,

    endDate: filter.dateRange?.to
        ? formatDateLocal(filter.dateRange.to)
        : filter.dateRange?.from
            ? formatDateLocal(filter.dateRange.from)
            : undefined,
    */

    shift: filter.shift || "ALL",
    ...extra,
});


// PERFORMANCE-ONLY request reuse key.
// masterAttendanceMode/scope/_holidayRevision do not change employee/data eligibility.
// This key is used only to decide whether a graph can reuse the already-loaded full
// dashboard response instead of firing another identical dashboard request.
const getDashboardReuseKey = (params = {}) => {
    const normalize = (value) => {
        if (value === undefined || value === null || value === "") return "ALL";
        const text = String(value).trim();
        if (!text || text.toUpperCase() === "ALL") return "ALL";
        return text;
    };

    return JSON.stringify({
        department: normalize(params.department),
        section: normalize(params.section),
        line: normalize(params.line),
        startDate: params.startDate || "",
        endDate: params.endDate || "",
        shift: normalize(params.shift),
        stateFilter: normalize(params.stateFilter),
        districtFilter: normalize(params.districtFilter),
    });
};

const ChartLoader = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-white/75 rounded-xl z-10">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
    </div>
);

const EmptyState = ({ text }) => (
    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
        {text}
    </div>
);

const renderBarValueLabel = (
    color = "#1d4ed8",
    suffix = "",
    fontSize = 13,
    options = {}
) => (props) => {
    const { x, y, width, value } = props;
    if (value === null || value === undefined || value === "") return null;

    const {
        offsetX = 0,
        offsetY = -6,
        textAnchor = "middle",
        showPrefix = "",
    } = options;

    const safeY = Math.max(fontSize + 2, y + offsetY);

    return (
        <text
            x={x + width / 2 + offsetX}
            y={safeY}
            textAnchor={textAnchor}
            fill={color}
            fontSize={fontSize}
            fontWeight={900}
            stroke="#ffffff"
            strokeWidth={2.2}
            paintOrder="stroke"
            style={{ fontWeight: 900, fontFamily: "'Arial Black', Arial, sans-serif" }}
        >
            {showPrefix}{value}{suffix}
        </text>
    );
};

// Separate label positions for comparison bars.
// This fixes overlap/conflict in Gender graph when Users Total % and Attendance % are almost same,
// for example 7.6% and 7.5% showing on top of each other.
const renderUsersTotalLabel = (suffix = "", fontSize = 12) =>
    renderBarValueLabel(USER_TOTAL_LABEL_COLOR, suffix, fontSize, {
        offsetX: 0,
        offsetY: -10,
        textAnchor: "middle",
    });

const renderAttendanceLabel = (color = DEFAULT_ATTENDANCE_BAR_COLOR, suffix = "", fontSize = 12) => (props) => {
    const holidayShortCode = String(
        props?.holidayShortCode ||
        props?.payload?.holidayShortCode ||
        ""
    ).trim();

    if (!holidayShortCode) {
        return renderBarValueLabel(color, suffix, fontSize, {
            offsetX: 0,
            offsetY: -10,
            textAnchor: "middle",
        })(props);
    }

    const x = Number(props?.x || 0);
    const y = Number(props?.y || 0);
    const width = Number(props?.width || 0);
    const safeY = Math.max(fontSize + 2, y - 10);
    const holidayName = String(
        props?.holidayName ||
        props?.payload?.holidayName ||
        "Holiday"
    );

    return (
        <text
            x={x + width / 2}
            y={safeY}
            textAnchor="middle"
            fill={color}
            fontSize={fontSize + 1}
            fontWeight={900}
            stroke="#ffffff"
            strokeWidth={2.2}
            paintOrder="stroke"
            style={{ fontWeight: 900, fontFamily: "'Arial Black', Arial, sans-serif" }}
        >
            <title>{holidayName}</title>
            {holidayShortCode}
        </text>
    );
};

const renderLineValueLabel = (color = "#1d4ed8", suffix = "", fontSize = 13) => (props) => {
    const { x, y, value } = props;
    if (value === null || value === undefined || value === "") return null;

    return (
        <text
            x={x}
            y={y - 10}
            textAnchor="middle"
            fill={color}
            fontSize={fontSize}
            fontWeight={900}
            stroke={color}
            strokeWidth={0.55}
            paintOrder="stroke"
            style={{ fontWeight: 900, fontFamily: "'Arial Black', Arial, sans-serif" }}
        >
            {value}{suffix}
        </text>
    );
};

const ChartTypeToggle = ({ value, onChange }) => (
    <div className="flex items-center gap-1 rounded-lg bg-slate-100 border border-slate-200 p-1">
        <Button
            type="button"
            size="sm"
            variant={value === "bar" ? "default" : "ghost"}
            className={`h-8 px-3 text-sm ${value === "bar"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-slate-600"
                }`}
            onClick={() => onChange("bar")}
        >
            <BarChart3 className="w-3.5 h-3.5 mr-1" />
            Bar
        </Button>

        <Button
            type="button"
            size="sm"
            variant={value === "line" ? "default" : "ghost"}
            className={`h-8 px-3 text-sm ${value === "line"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-slate-600"
                }`}
            onClick={() => onChange("line")}
        >
            <LineChartIcon className="w-3.5 h-3.5 mr-1" />
            Line
        </Button>
    </div>
);

const PieBarToggle = ({ value, onChange }) => (
    <div className="flex items-center gap-1 rounded-lg bg-slate-100 border border-slate-200 p-1">
        <Button
            type="button"
            size="sm"
            variant={value === "pie" ? "default" : "ghost"}
            className={`h-8 px-3 text-sm ${value === "pie"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-slate-600"
                }`}
            onClick={() => onChange("pie")}
        >
            Pie
        </Button>

        <Button
            type="button"
            size="sm"
            variant={value === "bar" ? "default" : "ghost"}
            className={`h-8 px-3 text-sm ${value === "bar"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-slate-600"
                }`}
            onClick={() => onChange("bar")}
        >
            <BarChart3 className="w-3.5 h-3.5 mr-1" />
            Bar
        </Button>
    </div>
);

const ValueModeToggle = ({ value, onChange }) => (
    <div className="flex items-center gap-1 rounded-lg bg-slate-100 border border-slate-200 p-1">
        <Button
            type="button"
            size="sm"
            variant={value === "percentage" ? "default" : "ghost"}
            className={`h-8 px-3 text-sm ${value === "percentage"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-slate-600"
                }`}
            onClick={() => onChange("percentage")}
        >
            %
        </Button>

        <Button
            type="button"
            size="sm"
            variant={value === "number" ? "default" : "ghost"}
            className={`h-8 px-3 text-sm ${value === "number"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-slate-600"
                }`}
            onClick={() => onChange("number")}
        >
            Nos.
        </Button>
    </div>
);

const convertToValueMode = (data = [], valueMode = "number", valueKey = "value") => {
    const safeList = Array.isArray(data) ? data : [];

    const backendDenominator = safeList.reduce((max, item) => {
        const itemDenominator = Number(item?.denominatorTotal ?? item?.totalEmployees ?? 0);
        return itemDenominator > max ? itemDenominator : max;
    }, 0);

    const fallbackTotal = safeList.reduce((sum, item) => {
        return sum + Number(item[valueKey] || 0);
    }, 0);

    // IMPORTANT:
    // Percentage denominator category total nahi hoga.
    // Agar backend totalEmployees/denominatorTotal bhej raha hai, wahi denominator use hoga.
    // Example: skill level me 21 employees available hain aur total 2900 employees hain,
    // to % = value / 2900 * 100 hoga, not value / 21 * 100.
    const total = backendDenominator > 0 ? backendDenominator : fallbackTotal;

    return safeList.map(item => {
        const rawValue = Number(item[valueKey] || 0);
        const backendPercentage = Number(item?.percentage);
        const percentage = Number.isFinite(backendPercentage)
            ? backendPercentage
            : total > 0
                ? Number(((rawValue / total) * 100).toFixed(1))
                : 0;

        return {
            ...item,
            rawValue,
            percentage,
            denominatorTotal: total,
            totalEmployees: Number(item?.totalEmployees ?? total),
            [valueKey]: valueMode === "percentage" ? percentage : rawValue,
        };
    });
};

// For comparison charts where each category has Attendance and Users Total bars.
// In percentage mode, both bars must be converted separately; otherwise the toggle appears not to work.
const convertComparisonToValueMode = (data = [], valueMode = "number") => {
    const safeList = Array.isArray(data) ? data : [];

    const attendanceTotal = safeList.reduce((sum, item) => {
        return sum + Number(item.attendanceValue ?? item.rawValue ?? item.value ?? 0);
    }, 0);

    const masterTotal = safeList.reduce((sum, item) => {
        return sum + Number(item.masterValue ?? item.totalValue ?? 0);
    }, 0);

    const backendDenominator = safeList.reduce((max, item) => {
        const itemDenominator = Number(item?.denominatorTotal ?? item?.totalEmployees ?? 0);
        return itemDenominator > max ? itemDenominator : max;
    }, 0);

    // IMPORTANT FIX:
    // Percentage denominator total employees se hoga, category ke count/sum se nahi.
    // Example: sirf 21 employees ka skill level filled hai aur total employees 2900 hain,
    // to L1/L2/L3/L4 ka total 100% nahi banega; denominator 2900 rahega.
    const commonTotal = backendDenominator > 0 ? backendDenominator : (masterTotal > 0 ? masterTotal : attendanceTotal);

    return safeList.map(item => {
        const attendanceCount = Number(item.attendanceValue ?? item.rawValue ?? item.value ?? 0);
        const masterCount = Number(item.masterValue ?? item.totalValue ?? 0);
        const backendAttendancePercentage = Number(item?.attendancePercentage ?? item?.percentage);
        const backendMasterPercentage = Number(item?.masterPercentage);
        const attendancePercentage = Number.isFinite(backendAttendancePercentage)
            ? backendAttendancePercentage
            : commonTotal > 0
                ? Number(((attendanceCount / commonTotal) * 100).toFixed(1))
                : 0;
        const masterPercentage = Number.isFinite(backendMasterPercentage)
            ? backendMasterPercentage
            : commonTotal > 0
                ? Number(((masterCount / commonTotal) * 100).toFixed(1))
                : 0;

        return {
            ...item,
            attendanceCount,
            masterCount,
            attendancePercentage,
            masterPercentage,
            denominatorTotal: commonTotal,
            totalEmployees: Number(item?.totalEmployees ?? commonTotal),
            rawValue: attendanceCount,
            percentage: attendancePercentage,
            value: valueMode === "percentage" ? attendancePercentage : attendanceCount,
            attendanceValue: valueMode === "percentage" ? attendancePercentage : attendanceCount,
            masterValue: valueMode === "percentage" ? masterPercentage : masterCount,
        };
    });
};

const SimpleLegend = ({ items = [] }) => (
    <div className="flex items-center justify-center gap-5 mt-3 flex-wrap">
        {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
                {item.type === "line" ? (
                    <svg width="24" height="10">
                        <line
                            x1="0"
                            y1="5"
                            x2="24"
                            y2="5"
                            stroke={item.color}
                            strokeWidth="2.5"
                            strokeDasharray={item.dashed ? "5 3" : "0"}
                        />
                    </svg>
                ) : (
                    <span
                        className="w-4 h-3.5 rounded-sm inline-block"
                        style={{ backgroundColor: item.color }}
                    />
                )}

                <span className="text-sm font-semibold text-slate-600">
                    {item.label}
                </span>
            </div>
        ))}
    </div>
);


const BLANK_CHART_LABEL = "Blank";
const USER_TOTAL_BAR_COLOR = "#e7ae12";
const USER_TOTAL_LABEL_COLOR = "#7c5a00";
const MALE_ATTENDANCE_BAR_COLOR = "#0ea5e9";
const FEMALE_ATTENDANCE_BAR_COLOR = "#ec4899";
const DEFAULT_ATTENDANCE_BAR_COLOR = "#2563eb";

const normalizeGenderLabel = (value) => {
    const text = String(value ?? "").trim();
    const upperText = text.toUpperCase();
    const compactText = upperText.replace(/[\s._-]+/g, "");

    // FEMALE must be checked first because it contains MALE.
    if (
        compactText === "FEMALE" ||
        compactText === "F" ||
        compactText.includes("FEMALE")
    ) {
        return "Female";
    }

    if (
        compactText === "MALE" ||
        compactText === "M" ||
        compactText.includes("MALE")
    ) {
        return "Male";
    }

    return null;
};

const isGenderLikeLabel = (value) => Boolean(normalizeGenderLabel(value));

const getGenderSortRank = (value) => {
    const label = normalizeGenderLabel(value) || cleanDisplayName(value);
    if (label === "Male") return 1;
    if (label === "Female") return 2;
    if (label === BLANK_CHART_LABEL) return 99;
    return 50;
};


const getGenderAttendanceColor = (name, fallbackColor = DEFAULT_ATTENDANCE_BAR_COLOR) => {
    const genderLabel = normalizeGenderLabel(name);

    if (genderLabel === "Female") return FEMALE_ATTENDANCE_BAR_COLOR;
    if (genderLabel === "Male") return MALE_ATTENDANCE_BAR_COLOR;

    return fallbackColor;
};

const cleanDisplayName = (value) => {
    const text = String(value ?? "").trim();
    const upperText = text.toUpperCase();

    if (
        !text ||
        upperText === "NOT PROVIDED" ||
        upperText === "UNKNOWN" ||
        upperText === "NULL" ||
        upperText === "UNDEFINED"
    ) {
        // Keep the label visually blank, but give the chart a real category.
        // Empty string labels can make the bar/pie value appear missing.
        return BLANK_CHART_LABEL;
    }

    // Gender values can come from DB in different casing/formats.
    // Recharts treats "Male" and "MALE" as different categories.
    // Normalize them before grouping.
    const genderLabel = normalizeGenderLabel(text);
    if (genderLabel) return genderLabel;

    return text;
};

const getChartGroupKey = (value) => {
    return String(cleanDisplayName(value) || BLANK_CHART_LABEL)
        .trim()
        .toUpperCase();
};

const mergeChartRowsByName = (list = []) => {
    const map = {};

    (Array.isArray(list) ? list : []).forEach((item) => {
        const displayName = cleanDisplayName(item?.name);
        const key = getChartGroupKey(displayName);

        if (!map[key]) {
            map[key] = {
                ...item,
                name: displayName,
                value: 0,
                rawValue: 0,
                attendanceValue: 0,
                masterValue: 0,
                attendanceCount: 0,
                masterCount: 0,
                totalEmployees: Number(item?.totalEmployees || item?.denominatorTotal || 0),
                denominatorTotal: Number(item?.denominatorTotal || item?.totalEmployees || 0),
            };
        } else {
            map[key].totalEmployees = Math.max(
                Number(map[key].totalEmployees || 0),
                Number(item?.totalEmployees || item?.denominatorTotal || 0)
            );
            map[key].denominatorTotal = Math.max(
                Number(map[key].denominatorTotal || 0),
                Number(item?.denominatorTotal || item?.totalEmployees || 0)
            );
        }

        map[key].value += Number(item?.value || 0);
        map[key].rawValue += Number(item?.rawValue ?? item?.attendanceCount ?? item?.attendanceValue ?? item?.value ?? 0);
        map[key].attendanceValue += Number(item?.attendanceValue ?? item?.rawValue ?? item?.value ?? 0);
        map[key].masterValue += Number(item?.masterValue ?? item?.totalValue ?? 0);
        map[key].attendanceCount += Number(item?.attendanceCount ?? item?.rawValue ?? item?.attendanceValue ?? item?.value ?? 0);
        map[key].masterCount += Number(item?.masterCount ?? item?.masterValue ?? item?.totalValue ?? 0);
    });

    return Object.values(map).map((item) => {
        const denominator = Number(item.denominatorTotal || item.totalEmployees || 0);
        const attendanceCount = Number(item.attendanceCount || item.attendanceValue || 0);
        const masterCount = Number(item.masterCount || item.masterValue || 0);

        return {
            ...item,
            // Keep these as RAW COUNTS. convertComparisonToValueMode() will convert to %
            // only when the user clicks the percentage button.
            value: attendanceCount,
            rawValue: attendanceCount,
            attendanceValue: attendanceCount,
            masterValue: masterCount,
            totalValue: masterCount,
            attendanceCount,
            masterCount,
            percentage: denominator > 0
                ? Number(((attendanceCount / denominator) * 100).toFixed(1))
                : Number(item.percentage || 0),
            attendancePercentage: denominator > 0
                ? Number(((attendanceCount / denominator) * 100).toFixed(1))
                : Number(item.attendancePercentage || item.percentage || 0),
            masterPercentage: denominator > 0
                ? Number(((masterCount / denominator) * 100).toFixed(1))
                : Number(item.masterPercentage || 0),
        };
    });
};


const extractSkillLevelLabel = (value) => {
    const text = String(value ?? "").trim();
    const upperText = text.toUpperCase();

    if (!text || upperText === "BLANK" || upperText === "NOT PROVIDED" || upperText === "{}" || upperText === "[]" || upperText === "NULL" || upperText === "UNDEFINED") {
        return BLANK_CHART_LABEL;
    }

    if (["L1", "L2", "L3", "L4"].includes(upperText)) {
        return upperText;
    }

    // Handles JSON-like values from currentSkill such as {"100":"L1"} or {"107":"L3","107locked":false}
    const match = upperText.match(/"L([1-4])"/) || upperText.match(/:\s*L([1-4])\b/) || upperText.match(/\bL([1-4])\b/);

    if (match) {
        return `L${match[1]}`;
    }

    return BLANK_CHART_LABEL;
};

const normalizeSkillLevelChartData = (list = []) => {
    const holidaySource = (Array.isArray(list) ? list : []).find(item => item?.isHoliday || item?.holidayShortCode) || null;

    const buckets = {
        L1: { name: "L1", value: 0, attendanceValue: 0, masterValue: 0, rawValue: 0, percentage: 0 },
        L2: { name: "L2", value: 0, attendanceValue: 0, masterValue: 0, rawValue: 0, percentage: 0 },
        L3: { name: "L3", value: 0, attendanceValue: 0, masterValue: 0, rawValue: 0, percentage: 0 },
        L4: { name: "L4", value: 0, attendanceValue: 0, masterValue: 0, rawValue: 0, percentage: 0 },
        [BLANK_CHART_LABEL]: { name: BLANK_CHART_LABEL, value: 0, attendanceValue: 0, masterValue: 0, rawValue: 0, percentage: 0 },
    };

    (Array.isArray(list) ? list : []).forEach(item => {
        const label = extractSkillLevelLabel(item?.name ?? item?.label ?? item?.value);
        if (!label || !buckets[label]) return;

        const attendance = Number(item?.attendanceValue ?? item?.rawValue ?? item?.value ?? 0);
        const master = Number(item?.masterValue ?? item?.totalValue ?? item?.totalEmployees ?? 0);

        buckets[label].attendanceValue += attendance;
        buckets[label].masterValue += master;
        buckets[label].value += attendance;
        buckets[label].rawValue += attendance;
    });

    const denominatorTotalFromApi = (Array.isArray(list) ? list : []).reduce((max, item) => {
        const itemDenominator = Number(item?.denominatorTotal ?? item?.totalEmployees ?? 0);
        return itemDenominator > max ? itemDenominator : max;
    }, 0);

    const fallbackMasterTotal = Object.values(buckets).reduce((sum, item) => sum + Number(item.masterValue || 0), 0);
    const denominatorTotal = denominatorTotalFromApi > 0 ? denominatorTotalFromApi : fallbackMasterTotal;

    return Object.values(buckets)
        .map(item => ({
            ...item,
            isHoliday: Boolean(holidaySource),
            holidayName: holidaySource?.holidayName || null,
            holidayShortCode: holidaySource?.holidayShortCode || null,
            holidayType: holidaySource?.holidayType || null,
            totalEmployees: denominatorTotal,
            denominatorTotal,
            percentage: denominatorTotal > 0 ? Number(((Number(item.attendanceValue || 0) / denominatorTotal) * 100).toFixed(1)) : 0,
            attendancePercentage: denominatorTotal > 0 ? Number(((Number(item.attendanceValue || 0) / denominatorTotal) * 100).toFixed(1)) : 0,
            masterPercentage: denominatorTotal > 0 ? Number(((Number(item.masterValue || 0) / denominatorTotal) * 100).toFixed(1)) : 0,
        }))
        .filter(item => Number(item.attendanceValue || 0) > 0 || Number(item.masterValue || 0) > 0);
};


const MultiSelectDropdown = ({
    label,
    value,
    options = [],
    onChange,
    disabled = false,
    loading = false,
    placeholder = "All",
    widthClass = "w-[170px]",
}) => {
    const selected = normalizeMultiValue(value);
    const selectedReal = selected.filter(item => item !== "ALL");

    const getLabel = () => {
        if (loading) return "Loading...";
        if (selectedReal.length === 0) return placeholder;
        if (selectedReal.length === 1) {
            return options.find(item => String(item.id) === String(selectedReal[0]))?.name || selectedReal[0];
        }
        return `${selectedReal.length} selected`;
    };

    const setAll = () => onChange(["ALL"]);

    const toggleItem = (id) => {
        const idStr = String(id);
        let next = selectedReal.includes(idStr)
            ? selectedReal.filter(item => item !== idStr)
            : [...selectedReal, idStr];

        if (next.length === 0) next = ["ALL"];
        onChange(next);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    disabled={disabled || loading}
                    className={`${widthClass} h-8 justify-between bg-transparent border-none focus:ring-0 shadow-none px-2 ${disabled || loading ? "opacity-40 cursor-not-allowed" : "text-slate-700"
                        }`}
                >
                    <span className="truncate text-xs">{getLabel()}</span>
                    {loading ? <Loader2 className="w-3 h-3 animate-spin ml-2" /> : null}
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-64 p-2" align="start">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 pb-2">
                    {label}
                </div>

                <button
                    type="button"
                    onClick={setAll}
                    className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-100 text-left"
                >
                    <input
                        type="checkbox"
                        readOnly
                        checked={selectedReal.length === 0}
                        className="h-4 w-4"
                    />
                    <span>All {label}</span>
                </button>

                <div className="max-h-64 overflow-y-auto pt-1">
                    {options.length === 0 ? (
                        <div className="px-2 py-3 text-xs text-slate-400">No options found</div>
                    ) : (
                        options.map(item => {
                            const idStr = String(item.id);
                            const checked = selectedReal.includes(idStr);

                            return (
                                <button
                                    type="button"
                                    key={idStr}
                                    onClick={() => toggleItem(idStr)}
                                    className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-100 text-left"
                                >
                                    <input
                                        type="checkbox"
                                        readOnly
                                        checked={checked}
                                        className="h-4 w-4"
                                    />
                                    <span className="truncate">{item.name}</span>
                                </button>
                            );
                        })
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
};

const GraphFilterBar = ({
    filter,
    setFilter,
    departments,
    showShift = true,
    showDateRange = true,
    showTenure = false,
    tenureBucket = "ALL",
    setTenureBucket,
    customTenureRange,
    setCustomTenureRange,
}) => {
    const [sections, setSections] = useState([]);
    const [filteredLines, setFilteredLines] = useState([]);
    const [sectionsLoading, setSectionsLoading] = useState(false);
    const [linesLoading, setLinesLoading] = useState(false);
    const [datePopoverOpen, setDatePopoverOpen] = useState(false);

    const isDepartmentSelected = hasRealSelection(filter.department);
    const isSectionSelected = hasRealSelection(filter.section);

    useEffect(() => {
        const deptIds = normalizeMultiValue(filter.department).filter(item => item !== "ALL");

        if (deptIds.length === 0) {
            setSections([]);
            setFilteredLines([]);
            return;
        }

        let cancelled = false;
        setSectionsLoading(true);

        Promise.all(
            deptIds.map(departmentId =>
                axiosInstance
                    .get(`/api/dashboard/sections?departmentId=${encodeURIComponent(departmentId)}`)
                    .then(res => {
                        // ✅ FIXED: use updated extractApiList that handles all wrapping levels
                        const list = extractApiList(res, "sections");
                        return list;
                    })
                    .catch((err) => {
                        console.error("[SECTION DEBUG] API failed:", err?.response?.data || err.message);
                        return [];
                    })
            )
        )
            .then(results => {
                if (cancelled) return;

                // ✅ FIXED: avoid new Map() — some bundler/lib overrides Map constructor
                const seen = {};
                const finalSections = [];

                results
                    .flat()
                    .map((item, index) => normalizeOptionItem(item, `section-${index}`))
                    .forEach(item => {
                        const key = String(item.id);
                        if (!seen[key]) {
                            seen[key] = true;
                            finalSections.push(item);
                        }
                    });

                setSections(finalSections);
            })
            .catch((err) => {
                console.error("[SECTION DEBUG] final error:", err);
                if (!cancelled) setSections([]);
            })
            .finally(() => {
                if (!cancelled) setSectionsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [serializeMultiValue(filter.department)]);

    useEffect(() => {
        const sectionIds = normalizeMultiValue(filter.section).filter(item => item !== "ALL");

        if (sectionIds.length === 0) {
            setFilteredLines([]);
            return;
        }

        let cancelled = false;
        setLinesLoading(true);

        Promise.all(
            sectionIds.map(sectionId =>
                axiosInstance
                    .get(`/api/dashboard/lines?sectionId=${encodeURIComponent(sectionId)}`)
                    .then(res => extractApiList(res, "lines"))
                    .catch(() => [])
            )
        )
            .then(results => {
                if (cancelled) return;

                // ✅ FIXED: avoid new Map() — some bundler/lib overrides Map constructor
                const seen = {};
                const finalLines = [];

                results
                    .flat()
                    .map((item, index) => normalizeOptionItem(item, `line-${index}`))
                    .forEach(item => {
                        const key = String(item.id);
                        if (!seen[key]) {
                            seen[key] = true;
                            finalLines.push(item);
                        }
                    });

                setFilteredLines(finalLines);
            })
            .catch(() => {
                if (!cancelled) setFilteredLines([]);
            })
            .finally(() => {
                if (!cancelled) setLinesLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [serializeMultiValue(filter.section)]);

    const handleFilterChange = (key, value) => {
        const nextValue = normalizeMultiValue(value);

        if (key === "department") {
            setFilter(prev => ({
                ...prev,
                department: nextValue,
                section: ["ALL"],
                line: ["ALL"],
            }));
        } else if (key === "section") {
            setFilter(prev => ({
                ...prev,
                section: nextValue,
                line: ["ALL"],
            }));
        } else {
            setFilter(prev => ({
                ...prev,
                [key]: key === "line" ? nextValue : value,
            }));
        }
    };

    const handleDateRangeSelect = (range) => {
        // Range mode stores only two values: from and to.
        // First click selects the start date; second click selects the end date
        // and closes the calendar. A new click after a completed range starts a new range.
        if (!range?.from) {
            handleFilterChange("dateRange", undefined);
            return;
        }

        handleFilterChange("dateRange", {
            from: range.from,
            to: range.to || undefined,
        });

        if (range.to) {
            setDatePopoverOpen(false);
        }
    };

    const handleReset = () => {
        setSections([]);
        setFilteredLines([]);

        setFilter({
            department: ["ALL"],
            section: ["ALL"],
            line: ["ALL"],
            dateRange: undefined,
            shift: "ALL",
        });

        if (setTenureBucket) {
            setTenureBucket("ALL");
        }

        if (setCustomTenureRange) {
            setCustomTenureRange({ from: 0, to: 0 });
        }
    };

    return (
        <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-200 flex-wrap">
            <span className="text-xs text-slate-500 pl-2 uppercase font-bold tracking-wider flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filters:
            </span>

            <MultiSelectDropdown
                label="Departments"
                value={filter.department}
                options={normalizeApiOptions(departments, "department")}
                onChange={(val) => handleFilterChange("department", val)}
                placeholder="All Departments"
                widthClass="w-[155px]"
            />

            <div className="h-4 w-px bg-slate-300" />

            <MultiSelectDropdown
                label="Sections"
                value={filter.section}
                options={sections}
                onChange={(val) => handleFilterChange("section", val)}
                disabled={!isDepartmentSelected || sectionsLoading}
                loading={sectionsLoading}
                placeholder={
                    !isDepartmentSelected
                        ? "Select Dept"
                        : sections.length > 0
                            ? "All Sections"
                            : "No Sections"
                }
                widthClass="w-[155px]"
            />

            <div className="h-4 w-px bg-slate-300" />

            <MultiSelectDropdown
                label="Lines"
                value={filter.line}
                options={filteredLines}
                onChange={(val) => handleFilterChange("line", val)}
                disabled={!isSectionSelected || linesLoading}
                loading={linesLoading}
                placeholder={isSectionSelected ? "All Lines" : "Select section first"}
                widthClass="w-[170px]"
            />

            {showShift && (
                <>
                    <div className="h-4 w-px bg-slate-300" />

                    <Select value={filter.shift || "ALL"} onValueChange={(val) => handleFilterChange("shift", val)}>
                        <SelectTrigger className="w-[110px] h-8 bg-transparent border-none text-slate-700 focus:ring-0 shadow-none px-2 text-xs font-semibold">
                            <SelectValue placeholder="All Shifts" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Shifts</SelectItem>
                            <SelectItem value="A">Shift A</SelectItem>
                            <SelectItem value="B">Shift B</SelectItem>
                            <SelectItem value="C">Shift C</SelectItem>
                            <SelectItem value="G">General Shift</SelectItem>
                        </SelectContent>
                    </Select>
                </>
            )}

            {showDateRange && (
                <>
                    <div className="h-4 w-px bg-slate-300" />

                    <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                className={`h-8 justify-start text-left font-normal px-2 ${!filter.dateRange?.from && "text-muted-foreground"}`}
                            >
                                <CalendarIcon className="mr-2 h-3 w-3" />

                                {filter.dateRange?.from ? (
                                    filter.dateRange.to ? (
                                        <span className="text-xs">
                                            {filter.dateRange.from.toLocaleDateString()} – {filter.dateRange.to.toLocaleDateString()}
                                        </span>
                                    ) : (
                                        <span className="text-xs">
                                            {filter.dateRange.from.toLocaleDateString()}
                                        </span>
                                    )
                                ) : (
                                    <span className="text-xs">Pick date range</span>
                                )}
                            </Button>
                        </PopoverTrigger>

                        <PopoverContent className="w-auto p-0" align="end">
                            <CalendarComponent
                                initialFocus
                                mode="range"
                                defaultMonth={filter.dateRange?.from}
                                selected={filter.dateRange}
                                onSelect={handleDateRangeSelect}
                                numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>
                </>
            )}

            {showTenure && (
                <>
                    <div className="h-4 w-px bg-slate-300" />

                    <Select value={tenureBucket} onValueChange={setTenureBucket}>
                        <SelectTrigger className="w-[165px] h-8 bg-transparent border-none text-slate-700 focus:ring-0 shadow-none">
                            <SelectValue placeholder="All tenure" />
                        </SelectTrigger>

                        <SelectContent>
                            {TENURE_BUCKETS.map(item => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {tenureBucket === "CUSTOM" && (
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 py-1">
                            <input
                                type="number"
                                min="0"
                                value={customTenureRange?.from ?? 0}
                                onChange={(e) => {
                                    const nextFrom = Math.max(0, Number(e.target.value || 0));
                                    setCustomTenureRange?.(prev => ({
                                        ...prev,
                                        from: nextFrom,
                                        to: Math.max(Number(prev?.to ?? 0), nextFrom),
                                    }));
                                }}
                                className="w-16 h-7 text-xs border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-blue-400"
                                placeholder="From"
                            />

                            <span className="text-xs text-slate-400">to</span>

                            <input
                                type="number"
                                min="0"
                                value={customTenureRange?.to ?? 0}
                                onChange={(e) => {
                                    const nextTo = Math.max(0, Number(e.target.value || 0));
                                    setCustomTenureRange?.(prev => ({
                                        ...prev,
                                        to: Math.max(nextTo, Number(prev?.from ?? 0)),
                                    }));
                                }}
                                className="w-16 h-7 text-xs border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-blue-400"
                                placeholder="To"
                            />

                            <span className="text-xs text-slate-500 whitespace-nowrap">days</span>
                        </div>
                    )}
                </>
            )}

            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-slate-700"
                onClick={handleReset}
                title="Reset this graph filters"
            >
                <RotateCw className="w-4 h-4" />
            </Button>
        </div>
    );
};



const DateRangeOnlyFilter = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);

    const handleSelect = (range) => {
        if (!range?.from) {
            onChange(undefined);
            return;
        }

        onChange({
            from: range.from,
            to: range.to || undefined,
        });

        if (range.to) {
            setOpen(false);
        }
    };

    return (
        <div className="flex items-center gap-1 rounded-lg bg-white border border-slate-200 p-1">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        className={`h-8 justify-start text-left font-normal px-2 ${!value?.from ? "text-muted-foreground" : "text-slate-700"}`}
                    >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {value?.from ? (
                            value.to ? (
                                <span className="text-xs">
                                    {value.from.toLocaleDateString()} – {value.to.toLocaleDateString()}
                                </span>
                            ) : (
                                <span className="text-xs">
                                    {value.from.toLocaleDateString()}
                                </span>
                            )
                        ) : (
                            <span className="text-xs">Date range</span>
                        )}
                    </Button>
                </PopoverTrigger>

                <PopoverContent className="w-auto p-0" align="end">
                    <CalendarComponent
                        initialFocus
                        mode="range"
                        defaultMonth={value?.from}
                        selected={value}
                        onSelect={handleSelect}
                        numberOfMonths={2}
                    />
                </PopoverContent>
            </Popover>

            {value?.from && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-slate-700"
                    onClick={() => onChange(undefined)}
                    title="Reset date range"
                >
                    <RotateCw className="w-4 h-4" />
                </Button>
            )}
        </div>
    );
};

const splitAxisLabelIntoLines = (value = "", maxCharsPerLine = 11, maxLines = 3) => {
    const words = String(value || "")
        .replace(/[\/\\_-]+/g, " ")
        .split(/\s+/)
        .map(word => word.trim())
        .filter(Boolean);

    if (words.length === 0) return [BLANK_CHART_LABEL];

    const lines = [];
    let currentLine = "";

    words.forEach(word => {
        if (!currentLine) {
            currentLine = word;
            return;
        }

        if (`${currentLine} ${word}`.length <= maxCharsPerLine) {
            currentLine = `${currentLine} ${word}`;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    });

    if (currentLine) lines.push(currentLine);

    if (lines.length > maxLines) {
        const visibleLines = lines.slice(0, maxLines);
        visibleLines[maxLines - 1] = `${visibleLines[maxLines - 1].slice(0, maxCharsPerLine - 1)}…`;
        return visibleLines;
    }

    return lines;
};

const renderMultilineAxisTick = ({ x, y, payload }) => {
    const lines = splitAxisLabelIntoLines(payload?.value, 11, 3);

    return (
        <text
            x={x}
            y={y + 8}
            textAnchor="middle"
            fill="#475569"
            fontSize={13}
            fontWeight={900}
            stroke="#ffffff"
            strokeWidth={0.55}
            paintOrder="stroke"
            style={{ fontWeight: 900, fontFamily: "'Arial Black', Arial, sans-serif" }}
        >
            {lines.map((line, index) => (
                <tspan
                    key={`${line}-${index}`}
                    x={x}
                    dy={index === 0 ? 0 : 15}
                >
                    {line}
                </tspan>
            ))}
        </text>
    );
};

const HighchartsPieCard = ({
    title,
    subtitle,
    data = [],
    colors = [],
    icon: Icon,
    filter,
    setFilter,
    departments,
    isLoading = false,
    extraFilters = null,
    valueMode = "number",
    onValueModeChange,
    useCustomPercentage = false,
    chartView = "pie",
    onChartViewChange,
    straightXAxisLabels = false,
    showBottomValues = true,
    bottomValuesToggleable = false,
}) => {
    const [bottomValuesOpen, setBottomValuesOpen] = useState(false);
    const shouldShowBottomValues = bottomValuesToggleable ? bottomValuesOpen : showBottomValues;
    const isGenderChart =
        String(title || "").toLowerCase().includes("gender") ||
        (Array.isArray(data) && data.some(item => isGenderLikeLabel(item?.name)));

    // IMPORTANT FIX:
    // Gender values like "Male" and "MALE" must be merged BEFORE percentage conversion.
    // If merging is done after clicking %, percentage values are treated like raw counts
    // and counts like 1600 can appear as 1600%.
    // This also fixes shift filter issue where Male/Female rows came in a different order.
    const rawChartInput = isGenderChart
        ? mergeChartRowsByName(data)
        : data;

    const hasComparisonInput = (Array.isArray(rawChartInput) ? rawChartInput : []).some(item => (
        item?.attendanceValue !== undefined ||
        item?.masterValue !== undefined ||
        item?.totalValue !== undefined ||
        item?.totalEmployees !== undefined
    ));

    const convertedData = hasComparisonInput
        ? convertComparisonToValueMode(rawChartInput, valueMode)
        : useCustomPercentage
            ? rawChartInput.map(item => {
                const rawValue = Number(item.value || 0);
                const customPercentage = Number(item.percentage || 0);

                return {
                    ...item,
                    rawValue,
                    percentage: customPercentage,
                    value: valueMode === "percentage" ? customPercentage : rawValue,
                };
            })
            : convertToValueMode(rawChartInput, valueMode, "value");

    const safeData = convertedData
        .filter(item => Number(item.value) > 0 || Number(item.masterValue) > 0 || Number(item.attendanceValue) > 0)
        .map(item => ({
            ...item,
            name: cleanDisplayName(item.name),
            value: Number(item.value || 0),
            rawValue: Number(item.rawValue ?? item.attendanceCount ?? item.attendanceValue ?? item.value ?? 0),
            percentage: Number(item.percentage || 0),
            totalEmployees: Number(item.totalEmployees || 0),
            attendanceValue: Number(item.attendanceValue ?? item.rawValue ?? item.value ?? 0),
            // IMPORTANT BLANK FIX:
            // totalEmployees/denominatorTotal is only the percentage denominator.
            // It must never become the yellow Users Total bar for Blank/State/District/Role rows.
            // Backend sends real category total in masterValue/totalValue.
            masterValue: Number(item.masterValue ?? item.totalValue ?? item.masterCount ?? 0),
            attendanceCount: Number(item.attendanceCount ?? item.rawValue ?? item.attendanceValue ?? item.value ?? 0),
            masterCount: Number(item.masterCount ?? item.masterValue ?? item.totalValue ?? 0),
            attendancePercentage: Number(item.attendancePercentage ?? item.percentage ?? 0),
            masterPercentage: Number(item.masterPercentage ?? 0),
        }))
        .sort((a, b) => {
            if (!isGenderChart) return 0;
            const rankDiff = getGenderSortRank(a.name) - getGenderSortRank(b.name);
            if (rankDiff !== 0) return rankDiff;
            return String(a.name || "").localeCompare(String(b.name || ""));
        });

    const valueSuffix = valueMode === "percentage" ? "%" : "";

    const finalSafeData = isGenderChart
        ? [
            ...["Male", "Female"]
                .map((genderName) => safeData.find(item => cleanDisplayName(item.name) === genderName))
                .filter(Boolean),
            ...safeData.filter(item => !["Male", "Female"].includes(cleanDisplayName(item.name))),
        ]
        : safeData;

    const hasMasterComparison = finalSafeData.some(item => Number(item.masterValue || 0) > 0);

    const getChartColor = (item, index) => {
        return getGenderAttendanceColor(item?.name, colors[index % colors.length] || DEFAULT_ATTENDANCE_BAR_COLOR);
    };

    const getAttendanceBarColor = (item) => {
        return getGenderAttendanceColor(item?.name, DEFAULT_ATTENDANCE_BAR_COLOR);
    };

    const chartData = finalSafeData.map((item, index) => ({
        name: item.name,
        y: item.value,
        rawValue: item.rawValue,
        percentageValue: item.percentage,
        color: getChartColor(item, index),
        sliced: false,
        selected: false,
    }));

    const options = useMemo(() => ({
        chart: {
            type: 'pie',
            options3d: {
                enabled: true,
                alpha: 0,
                beta: 0,
            },
            backgroundColor: 'transparent',
            height: 430,
            spacingTop: 10,
            spacingBottom: 10,
            spacingLeft: 5,
            spacingRight: 5,
        },
        title: {
            text: '',
        },
        accessibility: {
            point: {
                valueSuffix,
            },
        },
        tooltip: {
            useHTML: true,
            pointFormatter: function () {
                const displayValue = valueMode === "percentage"
                    ? `${this.y}%`
                    : `${this.rawValue} employees`;
                const shareLabel = useCustomPercentage
                    ? `${this.percentageValue}% of total employees`
                    : `${this.percentageValue}% share`;

                return `
                    <span style="font-size:13px;font-weight:900;font-family:'Arial Black', Arial, sans-serif;color:#334155">${this.series.name}</span><br/>
                    <b>${displayValue}</b><br/>
                    <b>${shareLabel}</b>
                `;
            },
        },
        plotOptions: {
            pie: {
                allowPointSelect: true,
                cursor: 'pointer',
                depth: 35,
                size: finalSafeData.length <= 4 ? '70%' : '62%',
                center: ['50%', '50%'],
                colors,
                dataLabels: {
                    enabled: true,
                    formatter: function () {
                        const name = String(this.point.name || "").trim();
                        const valueText = valueMode === "percentage"
                            ? `${Number(this.y).toFixed(useCustomPercentage ? 2 : 1)}%`
                            : `${this.y}`;

                        // If backend value is blank/null/NOT PROVIDED, show only value, not label text.
                        return name ? `${name}: ${valueText}` : valueText;
                    },
                    style: {
                        fontSize: '13px',
                        fontWeight: '900',
                        fontFamily: "'Arial Black', Arial, sans-serif",
                        color: '#475569',
                        textOutline: '0.8px #ffffff',
                    },
                    connectorColor: '#cbd5e1',
                    connectorWidth: 1,
                    distance: finalSafeData.length <= 4 ? 16 : 10,
                    crop: false,
                    overflow: 'allow',
                },
                point: {
                    events: {
                        mouseOver: function () {
                            this.slice(true, false, false);
                        },
                        mouseOut: function () {
                            this.slice(false, false, false);
                        },
                    },
                },
            },
        },
        series: [{
            type: 'pie',
            name: title,
            data: chartData,
        }],
        credits: {
            enabled: false,
        },
        legend: {
            enabled: false,
        },
    }), [chartData, colors, title, valueMode, valueSuffix, useCustomPercentage, finalSafeData.length]);

    return (
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col h-full min-w-0">
            <CardHeader className="pb-2 pt-4 px-5 space-y-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
                            {Icon && <Icon className="w-6 h-6 text-slate-500" />}
                            {title}
                        </CardTitle>
                        {subtitle && renderSubtitleText(subtitle, "text-sm text-slate-500 mt-1 font-semibold")}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* LOWER GRAPH DATE RANGE FILTER DISABLED.
                            Remove showDateRange={false} to restore the calendar. */}
                        <GraphFilterBar
                            filter={filter}
                            setFilter={setFilter}
                            departments={departments}
                            showDateRange={false}
                        />

                        {extraFilters}

                        {onChartViewChange && (
                            <PieBarToggle
                                value={chartView}
                                onChange={onChartViewChange}
                            />
                        )}

                        {onValueModeChange && (
                            <ValueModeToggle
                                value={valueMode}
                                onChange={onValueModeChange}
                            />
                        )}

                        {bottomValuesToggleable && chartData.length > 0 && (
                            <Button
                                type="button"
                                size="sm"
                                variant={bottomValuesOpen ? "default" : "outline"}
                                className={bottomValuesOpen
                                    ? "h-8 px-3 text-xs bg-blue-600 text-white hover:bg-blue-700"
                                    : "h-8 px-3 text-xs bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}
                                onClick={() => setBottomValuesOpen(prev => !prev)}
                            >
                                {bottomValuesOpen ? (
                                    <>
                                        <EyeOff className="w-3.5 h-3.5 mr-1" />
                                        Hide Values
                                    </>
                                ) : (
                                    <>
                                        <Eye className="w-3.5 h-3.5 mr-1" />
                                        Show Values
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pb-5 pt-0 px-5">
                <div className="h-[430px] w-full relative">
                    {isLoading && <ChartLoader />}

                    {!isLoading && chartData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                            No data found
                        </div>
                    ) : chartView === "bar" ? (
                        <ScrollableCompactChart dataLength={finalSafeData.length}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={finalSafeData}
                                    margin={{
                                        top: 64,
                                        right: 34,
                                        left: 8,
                                        bottom: straightXAxisLabels ? 86 : 84,
                                    }}
                                    barCategoryGap={isGenderChart ? "32%" : "18%"}
                                    barGap={isGenderChart ? 6 : 18}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={straightXAxisLabels ? renderMultilineAxisTick : { fontSize: 13, fill: '#475569', fontWeight: 900 }}
                                        interval={0}
                                        angle={straightXAxisLabels ? 0 : -35}
                                        textAnchor={straightXAxisLabels ? "middle" : "end"}
                                        height={straightXAxisLabels ? 82 : 78}
                                        tickMargin={12}
                                        tickFormatter={(value) => {
                                            const label = String(value || "");
                                            if (straightXAxisLabels) return label;

                                            const maxLength = 18;
                                            return label.length > maxLength ? `${label.slice(0, maxLength)}…` : label;
                                        }}
                                    />

                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 13, fill: '#475569', fontWeight: 900 }}
                                        allowDecimals={valueMode === "percentage"}
                                        width={40}
                                    />

                                    {hasMasterComparison ? (
                                        <>
                                            <Bar
                                                dataKey="masterValue"
                                                name="Users Total"
                                                fill={USER_TOTAL_BAR_COLOR}
                                                radius={[7, 7, 0, 0]}
                                                maxBarSize={28}
                                                label={renderUsersTotalLabel(valueSuffix, 12)}
                                            />
                                            <Bar
                                                dataKey="attendanceValue"
                                                name="Attendance"
                                                fill={DEFAULT_ATTENDANCE_BAR_COLOR}
                                                radius={[7, 7, 0, 0]}
                                                maxBarSize={28}
                                                label={(props) => {
                                                    const item = finalSafeData[props.index] || {};
                                                    return renderAttendanceLabel(getAttendanceBarColor(item), valueSuffix, 12)({
                                                        ...props,
                                                        holidayShortCode: item.holidayShortCode,
                                                        holidayName: item.holidayName,
                                                    });
                                                }}
                                            >
                                                {finalSafeData.map((entry, index) => (
                                                    <Cell
                                                        key={`attendance-cell-${entry.name}-${index}`}
                                                        fill={getAttendanceBarColor(entry)}
                                                    />
                                                ))}
                                            </Bar>
                                        </>
                                    ) : (
                                        <Bar
                                            dataKey="value"
                                            radius={[7, 7, 0, 0]}
                                            maxBarSize={34}
                                            label={(props) => {
                                                const item = finalSafeData[props.index] || {};
                                                return renderBarValueLabel(getChartColor(item, props.index), valueSuffix, 13)(props);
                                            }}
                                        >
                                            {finalSafeData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${entry.name}-${index}`}
                                                    fill={getChartColor(entry, index)}
                                                />
                                            ))}
                                        </Bar>
                                    )}
                                </BarChart>
                            </ResponsiveContainer>
                        </ScrollableCompactChart>
                    ) : (
                        <HighchartsReact
                            key={`${title}-${chartView}-${valueMode}-${chartData.length}`}
                            highcharts={Highcharts}
                            options={options}
                            containerProps={{ style: { width: '100%', height: '100%' } }}
                        />
                    )}
                </div>

                {shouldShowBottomValues && chartData.length > 0 && (
                    <div className="flex items-center justify-center gap-5 mt-3 flex-wrap">
                        {hasMasterComparison ? (
                            <>
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <span
                                        className="w-4 h-3.5 rounded-sm inline-block shadow-sm"
                                        style={{ backgroundColor: USER_TOTAL_BAR_COLOR }}
                                    />
                                    <span>Users Total</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <span
                                        className="w-4 h-3.5 rounded-sm inline-block shadow-sm"
                                        style={{ backgroundColor: DEFAULT_ATTENDANCE_BAR_COLOR }}
                                    />
                                    <span>Attendance</span>
                                </div>
                            </>
                        ) : (
                            finalSafeData.map((item, index) => (
                                <div key={`${item.name}-${index}`} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <span
                                        className="w-4 h-3.5 rounded-sm inline-block shadow-sm"
                                        style={{ backgroundColor: getChartColor(item, index) }}
                                    />
                                    <span className="truncate max-w-[140px]">{item.name}</span>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};


const MasterDropdownFilter = ({
    label,
    value,
    onChange,
    options = [],
    disabled = false,
}) => {
    const mappedOptions = (options || []).map(item => ({
        id: String(item),
        name: String(item),
    }));

    return (
        <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-200 flex-wrap">
            <span className="text-xs text-slate-500 pl-2 uppercase font-bold tracking-wider flex items-center gap-1">
                <Filter className="w-3 h-3" /> {label}:
            </span>

            <MultiSelectDropdown
                label={label}
                value={value}
                options={mappedOptions}
                onChange={(val) => onChange(normalizeMultiValue(val))}
                disabled={disabled}
                placeholder={`All ${label}`}
                widthClass="w-[180px]"
            />
        </div>
    );
};

const FullWidthToggleChartCard = ({
    title,
    subtitle,
    icon: Icon,
    data = [],
    dataKey = "actual",
    xKey = "day",
    color = "#3b82f6",
    gradientId = "chartGrad",
    suffix = "",
    chartType = "bar",
    onChartTypeChange,
    isLoading = false,
    emptyText = "No data found",
    referenceLine,
    filter,
    setFilter,
    departments,
    valueMode = "number",
    onValueModeChange,
    showShiftFilter = true,
}) => {
    const isEmpty = !data || data.length === 0;
    const valueSuffix = valueMode === "percentage" ? "%" : suffix;

    return (
        <Card className="border-slate-200 shadow-sm bg-white w-full">
            <CardHeader className="pb-2 pt-5 px-6 space-y-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
                            {Icon ? (
                                <Icon className="w-6 h-6" style={{ color }} />
                            ) : (
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                            )}
                            {title}
                        </CardTitle>

                        {renderSubtitleText(subtitle, "text-sm text-slate-500 mt-1")}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <GraphFilterBar
                            filter={filter}
                            setFilter={setFilter}
                            departments={departments}
                            showShift={showShiftFilter}
                        />

                        <ChartTypeToggle value={chartType} onChange={onChartTypeChange} />

                        {onValueModeChange && (
                            <ValueModeToggle
                                value={valueMode}
                                onChange={onValueModeChange}
                            />
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-2 pb-4 pt-2">
                <ScrollableTopChart
                    dataLength={data.length}
                    scrollToStart={Boolean(filter?.dateRange?.from)}
                >
                    {isLoading && <ChartLoader />}
                    {!isLoading && isEmpty && <EmptyState text={emptyText} />}

                    <ResponsiveContainer width="100%" height="100%">
                        {chartType === "line" ? (
                            <LineChart data={data} margin={{ top: 66, right: 48, left: 4, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                                <XAxis
                                    dataKey={xKey}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 13, fill: '#475569', fontWeight: 900 }}
                                    interval={0}
                                />

                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 13, fill: '#475569', fontWeight: 900 }}
                                    allowDecimals={valueMode === "percentage"}
                                    width={40}
                                />

                                {referenceLine && (
                                    <ReferenceLine
                                        y={referenceLine.y}
                                        stroke={referenceLine.color}
                                        strokeDasharray="5 3"
                                        label={{
                                            value: referenceLine.label,
                                            position: 'insideTopRight',
                                            fontSize: 13,
                                            fill: referenceLine.color,
                                            fontWeight: 900,
                                            offset: 4,
                                        }}
                                    />
                                )}

                                <Line
                                    type="monotone"
                                    dataKey={dataKey}
                                    stroke={color}
                                    strokeWidth={0.55}
                                    dot={{ r: 3, fill: color, strokeWidth: 0 }}
                                    activeDot={false}
                                    label={renderLineValueLabel(color, valueSuffix, 13)}
                                />
                            </LineChart>
                        ) : (
                            <BarChart data={data} margin={{ top: 66, right: 48, left: 4, bottom: 8 }} barCategoryGap="20%">
                                <defs>
                                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={color} stopOpacity={1} />
                                        <stop offset="100%" stopColor={color} stopOpacity={0.78} />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                                <XAxis
                                    dataKey={xKey}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 13, fill: '#475569', fontWeight: 900 }}
                                    interval={0}
                                />

                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 13, fill: '#475569', fontWeight: 900 }}
                                    allowDecimals={valueMode === "percentage"}
                                    width={40}
                                />

                                {referenceLine && (
                                    <ReferenceLine
                                        y={referenceLine.y}
                                        stroke={referenceLine.color}
                                        strokeDasharray="5 3"
                                        label={{
                                            value: referenceLine.label,
                                            position: 'insideTopRight',
                                            fontSize: 13,
                                            fill: referenceLine.color,
                                            fontWeight: 900,
                                            offset: 4,
                                        }}
                                    />
                                )}

                                <Bar
                                    dataKey={dataKey}
                                    fill={`url(#${gradientId})`}
                                    radius={[6, 6, 0, 0]}
                                    maxBarSize={20}
                                    label={renderBarValueLabel(color, valueSuffix, 13)}
                                />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </ScrollableTopChart>
            </CardContent>
        </Card>
    );
};


const getEducationChartInnerWidth = (dataLength = 0) => {
    const safeLength = Number(dataLength) || 0;
    if (safeLength <= 3) return "100%";
    return `${Math.max(800, safeLength * 180)}px`;
};

const ScrollableEducationChart = ({ dataLength = 0, children }) => {
    const scrollRef = useRef(null);

    useEffect(() => {
        const node = scrollRef.current;
        if (!node) return;

        window.requestAnimationFrame(() => {
            node.scrollLeft = 0;
        });
    }, [dataLength]);

    return (
        <div className="w-full relative h-[320px]">
            <div
                ref={scrollRef}
                className="absolute inset-0 overflow-x-auto overflow-y-hidden pb-2 overscroll-x-contain"
            >
                <div
                    className="h-full relative"
                    style={{
                        width: getEducationChartInnerWidth(dataLength),
                        minWidth: getEducationChartInnerWidth(dataLength),
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
};

const EducationChartCard = ({
    title,
    subtitle,
    data = [],
    isLoading = false,
    valueMode = "number",
    onValueModeChange,
    filter,
    setFilter,
    departments,
}) => {
    const chartData = convertComparisonToValueMode(data, valueMode).map(item => ({
        ...item,
        name: cleanDisplayName(item.name),
        attendanceValue: Number(item.attendanceValue || 0),
        masterValue: Number(item.masterValue || 0),
        attendanceCount: Number(item.attendanceCount || 0),
        masterCount: Number(item.masterCount || 0),
    }));
    const valueSuffix = valueMode === "percentage" ? "%" : "";
    const hasMasterComparison = chartData.some(item => Number(item.masterValue || 0) > 0);
    const isEmpty = !chartData || chartData.length === 0;

    return (
        <Card className="border-slate-200 shadow-sm bg-white w-full">
            <CardHeader className="pb-2 pt-5 px-6 space-y-2">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
                            <GraduationCap className="w-6 h-6 text-indigo-600" />
                            {title}
                        </CardTitle>

                        {renderSubtitleText(subtitle, "text-sm text-slate-500 mt-1")}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* LOWER GRAPH DATE RANGE FILTER DISABLED.
                            Remove showDateRange={false} to restore the calendar. */}
                        <GraphFilterBar
                            filter={filter}
                            setFilter={setFilter}
                            departments={departments}
                            showDateRange={false}
                        />

                        <ValueModeToggle
                            value={valueMode}
                            onChange={onValueModeChange}
                        />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-2 pb-4 pt-2">
                <ScrollableEducationChart dataLength={chartData.length}>
                    {isLoading && <ChartLoader />}

                    {!isLoading && isEmpty && (
                        <EmptyState text="No education data found" />
                    )}

                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            margin={{ top: 66, right: 48, left: 4, bottom: 36 }}
                            barCategoryGap="25%"
                            barGap={24}
                        >
                            <defs>
                                <linearGradient id="educationPrefixGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#4338ca" stopOpacity={0.82} />
                                </linearGradient>
                            </defs>

                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={renderContractorMultilineAxisTick}
                                interval={0}
                                height={55}
                            />

                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 13, fill: '#475569', fontWeight: 900 }}
                                allowDecimals={valueMode === "percentage"}
                                width={40}
                            />

                            {hasMasterComparison ? (
                                <>
                                    <Bar
                                        dataKey="masterValue"
                                        name="Users Total"
                                        fill={USER_TOTAL_BAR_COLOR}
                                        radius={[7, 7, 0, 0]}
                                        maxBarSize={34}
                                        label={renderUsersTotalLabel(valueSuffix, 12)}
                                    />
                                    <Bar
                                        dataKey="attendanceValue"
                                        name="Attendance"
                                        fill="#4f46e5"
                                        radius={[7, 7, 0, 0]}
                                        maxBarSize={34}
                                        label={(props) => {
                                            const item = chartData[props.index] || {};
                                            return renderAttendanceLabel("#4f46e5", valueSuffix, 12)({
                                                ...props,
                                                holidayShortCode: item.holidayShortCode,
                                                holidayName: item.holidayName,
                                            });
                                        }}
                                    />
                                </>
                            ) : (
                                <Bar
                                    dataKey="value"
                                    fill="url(#educationPrefixGrad)"
                                    radius={[7, 7, 0, 0]}
                                    maxBarSize={46}
                                    label={renderBarValueLabel("#4f46e5", valueSuffix, 13)}
                                />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                </ScrollableEducationChart>

                <SimpleLegend
                    items={[
                        ...(hasMasterComparison ? [{ color: USER_TOTAL_BAR_COLOR, label: 'Users Total' }] : []),
                        { color: '#4f46e5', label: 'Attendance' },
                    ]}
                />
            </CardContent>
        </Card>
    );
};


const ContractorPrefixChartCard = ({
    title,
    subtitle,
    data = [],
    isLoading = false,
    valueMode = "number",
    onValueModeChange,
    filter,
    setFilter,
    departments,
}) => {
    const chartData = convertComparisonToValueMode(data, valueMode).map(item => ({
        ...item,
        name: cleanDisplayName(item.name),
        value: Number(item.value || 0),
        rawValue: Number(item.rawValue ?? item.actualPresent ?? item.attendanceValue ?? 0),
        actualPresent: Number(item.actualPresent ?? item.attendanceValue ?? item.rawValue ?? item.value ?? 0),
        totalHeadcount: Number(item.totalHeadcount ?? item.masterValue ?? item.employeeCount ?? 0),
        attendanceValue: Number(item.attendanceValue ?? item.actualPresent ?? item.rawValue ?? item.value ?? 0),
        masterValue: Number(item.masterValue ?? item.totalHeadcount ?? item.employeeCount ?? 0),
        attendanceCount: Number(item.attendanceCount ?? item.actualPresent ?? item.attendanceValue ?? 0),
        masterCount: Number(item.masterCount ?? item.totalHeadcount ?? item.masterValue ?? 0),
    }));
    const valueSuffix = valueMode === "percentage" ? "%" : "";
    const hasMasterComparison = true;
    const isEmpty = !chartData || chartData.length === 0;

    return (
        <Card className="border-slate-200 shadow-sm bg-white w-full">
            <CardHeader className="pb-2 pt-5 px-6 space-y-2">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
                            <Briefcase className="w-6 h-6 text-violet-600" />
                            {title}
                        </CardTitle>

                        {renderSubtitleText(subtitle, "text-sm text-slate-500 mt-1")}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* LOWER GRAPH DATE RANGE FILTER DISABLED.
                            Remove showDateRange={false} to restore the calendar. */}
                        <GraphFilterBar
                            filter={filter}
                            setFilter={setFilter}
                            departments={departments}
                            showDateRange={false}
                        />

                        <ValueModeToggle
                            value={valueMode}
                            onChange={onValueModeChange}
                        />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-2 pb-4 pt-2">
                <ScrollableContractorChart dataLength={chartData.length}>
                    {isLoading && <ChartLoader />}

                    {!isLoading && isEmpty && (
                        <EmptyState text="No contractor data found" />
                    )}

                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            margin={{ top: 66, right: 48, left: 4, bottom: 36 }}
                            barCategoryGap="25%"
                            barGap={24}
                        >

                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={renderContractorMultilineAxisTick}
                                interval={0}
                                height={55}
                            />

                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 13, fill: '#475569', fontWeight: 900 }}
                                allowDecimals={valueMode === "percentage"}
                                width={40}
                            />

                            {hasMasterComparison ? (
                                <>
                                    <Bar
                                        dataKey="masterValue"
                                        name="Total Headcount"
                                        fill={USER_TOTAL_BAR_COLOR}
                                        radius={[7, 7, 0, 0]}
                                        maxBarSize={34}
                                        label={renderUsersTotalLabel(valueSuffix, 12)}
                                    />
                                    <Bar
                                        dataKey="attendanceValue"
                                        name="Actual Present"
                                        fill="#2563eb"
                                        radius={[7, 7, 0, 0]}
                                        maxBarSize={34}
                                        label={(props) => {
                                            const item = chartData[props.index] || {};
                                            return renderAttendanceLabel("#2563eb", valueSuffix, 12)({
                                                ...props,
                                                holidayShortCode: item.holidayShortCode,
                                                holidayName: item.holidayName,
                                            });
                                        }}
                                    />
                                </>
                            ) : (
                                <Bar
                                    dataKey="value"
                                    fill="url(#contractorPrefixGrad)"
                                    radius={[7, 7, 0, 0]}
                                    maxBarSize={46}
                                    label={renderBarValueLabel("#2563eb", valueSuffix, 13)}
                                />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                </ScrollableContractorChart>

                <SimpleLegend
                    items={hasMasterComparison
                        ? [
                            { color: USER_TOTAL_BAR_COLOR, label: 'Total Headcount' },
                            { color: '#2563eb', label: 'Actual Present' },
                        ]
                        : [
                            { color: '#2563eb', label: 'Actual Present' },
                        ]
                    }
                />
            </CardContent>
        </Card>
    );
};


const TenureFullWidthChart = ({
    title,
    subtitle,
    data = [],
    color,
    gradientId,
    icon: Icon,
    isLoading,
    chartType,
    onChartTypeChange,
    valueMode = "percentage",
    onValueModeChange,
    filter,
    setFilter,
    departments,
    tenureBucket,
    setTenureBucket,
    customTenureRange,
    setCustomTenureRange,
    showMasterComparison = true,
    showShiftFilter = true,
    holidayAware = false,
}) => {
    const hasHoliday = Boolean(holidayAware && data?.some(d => d?.isHoliday || d?.holidayShortCode));
    const isEmpty = !hasHoliday && (!data || data.every(d => Number(d.rawValue ?? d.value) === 0 && (!showMasterComparison || Number(d.masterValue || 0) === 0)));
    const valueSuffix = valueMode === "percentage" ? "%" : "";
    const hasMasterComparison = showMasterComparison && data?.some(d => Number(d.masterValue || 0) > 0);

    return (
        <Card className="border-slate-200 shadow-sm bg-white w-full">
            <CardHeader className="pb-2 pt-5 px-6 space-y-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
                            {Icon && <Icon className="w-6 h-6" style={{ color }} />}
                            {title}
                        </CardTitle>
                        {renderSubtitleText(subtitle, "text-sm text-slate-500 mt-1")}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        {/* LOWER TENURE DATE RANGE FILTER DISABLED.
                            Remove showDateRange={false} to restore the calendar. */}
                        <GraphFilterBar
                            filter={filter}
                            setFilter={setFilter}
                            departments={departments}
                            showTenure={true}
                            tenureBucket={tenureBucket}
                            setTenureBucket={setTenureBucket}
                            customTenureRange={customTenureRange}
                            setCustomTenureRange={setCustomTenureRange}
                            showShift={showShiftFilter}
                            showDateRange={false}
                        />

                        <ChartTypeToggle value={chartType} onChange={onChartTypeChange} />
                        <ValueModeToggle
                            value={valueMode}
                            onChange={onValueModeChange}
                        />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-2 pb-4 pt-2">
                <ScrollableTenureChart dataLength={data.length}>
                    {isLoading && <ChartLoader />}
                    {!isLoading && isEmpty && <EmptyState text="No tenure data available" />}

                    <ResponsiveContainer width="100%" height="100%">
                        {chartType === "line" ? (
                            <LineChart data={data} margin={{ top: 52, right: 48, left: 8, bottom: 18 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                                <XAxis
                                    dataKey="bucket"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 13, fill: '#475569', fontWeight: 900 }}
                                    interval={0}
                                    height={40}
                                    tickMargin={8}
                                />

                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 13, fill: '#475569', fontWeight: 900 }}
                                    allowDecimals={valueMode === "percentage"}
                                    width={40}
                                />

                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke={color}
                                    strokeWidth={3}
                                    dot={{ r: 5, fill: color, strokeWidth: 0 }}
                                    activeDot={false}
                                    label={(props) => {
                                        const item = data?.[props.index] || {};
                                        if (holidayAware && (item?.isHoliday || item?.holidayShortCode)) {
                                            return renderAttendanceLabel(color, valueSuffix, 13)({
                                                ...props,
                                                width: 0,
                                                holidayShortCode: item.holidayShortCode,
                                                holidayName: item.holidayName,
                                            });
                                        }
                                        return renderLineValueLabel(color, valueSuffix, 13)(props);
                                    }}
                                />
                            </LineChart>
                        ) : (
                            <BarChart data={data} margin={{ top: 52, right: 48, left: 8, bottom: 18 }} barCategoryGap="25%" barGap={18}>
                                <defs>
                                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={color} stopOpacity={1} />
                                        <stop offset="100%" stopColor={color} stopOpacity={0.78} />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                                <XAxis
                                    dataKey="bucket"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 13, fill: '#475569', fontWeight: 900 }}
                                    interval={0}
                                    height={40}
                                    tickMargin={8}
                                />

                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 13, fill: '#475569', fontWeight: 900 }}
                                    allowDecimals={valueMode === "percentage"}
                                    width={40}
                                />

                                {hasMasterComparison ? (
                                    <>
                                        <Bar
                                            dataKey="masterValue"
                                            name="Users Total"
                                            fill={USER_TOTAL_BAR_COLOR}
                                            radius={[7, 7, 0, 0]}
                                            maxBarSize={28}
                                            label={renderUsersTotalLabel(valueSuffix, 12)}
                                        />
                                        <Bar
                                            dataKey="value"
                                            name="Attendance/Actual"
                                            fill={`url(#${gradientId})`}
                                            radius={[7, 7, 0, 0]}
                                            maxBarSize={28}
                                            label={(props) => {
                                                const item = data?.[props.index] || {};
                                                if (holidayAware) {
                                                    return renderAttendanceLabel(color, valueSuffix, 12)({
                                                        ...props,
                                                        holidayShortCode: item.holidayShortCode,
                                                        holidayName: item.holidayName,
                                                    });
                                                }
                                                return renderBarValueLabel(color, valueSuffix, 12)(props);
                                            }}
                                        />
                                    </>
                                ) : (
                                    <Bar
                                        dataKey="value"
                                        fill={`url(#${gradientId})`}
                                        radius={[7, 7, 0, 0]}
                                        maxBarSize={36}
                                        label={renderBarValueLabel(color, valueSuffix, 13)}
                                    />
                                )}
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </ScrollableTenureChart>
            </CardContent>
        </Card>
    );
};

const useTenureStats = (filter, customTenureRange, shouldUseCustomTenureRange = false, holidayRevision = 0, enabled = true) => {
    const [tenureStats, setTenureStats] = useState(null);
    const [tenureLoading, setTenureLoading] = useState(false);

    useEffect(() => {
        // Avoid competing with the initial full dashboard request. The tenure request
        // starts immediately after the base dashboard request settles, so SQL Server
        // is not hit by both heavy endpoints at the same instant.
        if (!enabled) {
            setTenureLoading(false);
            return;
        }

        setTenureLoading(true);
        setTenureStats(null);

        const params = new URLSearchParams();
        params.append('_holidayRevision', String(holidayRevision));

        const departmentParam = serializeMultiValue(filter.department);
        const sectionParam = serializeMultiValue(filter.section);
        const lineParam = serializeMultiValue(filter.line);
        const shift = filter.shift || "ALL";

        if (departmentParam !== 'ALL') params.append('department', departmentParam);
        if (sectionParam !== 'ALL') params.append('section', sectionParam);
        if (lineParam !== 'ALL') params.append('line', lineParam);
        if (shift !== 'ALL') params.append('shift', shift);

        // LOWER TENURE GRAPH DATE RANGE FILTER DISABLED.
        // Restore this block when date filtering is needed again:
        /*
        if (filter.dateRange?.from) {
            params.append('startDate', formatDateLocal(filter.dateRange.from));
        }

        if (filter.dateRange?.to) {
            params.append('endDate', formatDateLocal(filter.dateRange.to));
        } else if (filter.dateRange?.from) {
            params.append('endDate', formatDateLocal(filter.dateRange.from));
        }
        */

        // ✅ Custom tenure range is sent only when any tenure graph has selected "Custom days".
        // This prevents hardcoded 0–67 from affecting normal buckets.
        if (shouldUseCustomTenureRange) {
            params.append('customTenureFrom', String(customTenureRange?.from ?? 0));
            params.append('customTenureTo', String(customTenureRange?.to ?? 0));
        }

        axiosInstance.get(`/api/dashboard/tenure-stats?${params.toString()}`)
            .then(res => {
                // ✅ FIXED: handle both wrapped and unwrapped responses
                const data = res?.data?.data ?? res?.data ?? res;
                setTenureStats(data || null);
            })
            .catch(() => setTenureStats(null))
            .finally(() => setTenureLoading(false));
    }, [
        serializeMultiValue(filter.department),
        serializeMultiValue(filter.section),
        serializeMultiValue(filter.line),
        // LOWER TENURE DATE DEPENDENCIES DISABLED. Restore with the date block above.
        // filter.dateRange?.from,
        // filter.dateRange?.to,
        shouldUseCustomTenureRange,
        customTenureRange?.from,
        customTenureRange?.to,
        filter.shift,
        holidayRevision,
        enabled,
    ]);

    return { tenureStats, tenureLoading };
};


const HOLIDAY_PRESETS = [
    { value: "SUNDAY", label: "Sunday", name: "Sunday", shortCode: "S" },
    { value: "WEEKLY_OFF", label: "Weekly Off", name: "Weekly Off", shortCode: "WO" },
    { value: "NATIONAL", label: "National Holiday", name: "National Holiday", shortCode: "NH" },
    { value: "FESTIVAL", label: "Festival Holiday", name: "Festival Holiday", shortCode: "FH" },
    { value: "COMPANY", label: "Company Holiday", name: "Company Holiday", shortCode: "CH" },
    { value: "CUSTOM", label: "Custom Holiday", name: "", shortCode: "H" },
];

const getLocalTodayForInput = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const makeDefaultHolidayForm = () => ({
    holidayDate: getLocalTodayForInput(),
    holidayType: "SUNDAY",
    holidayName: "Sunday",
    shortCode: "S",
    description: "",
});

const HolidayManagementDialog = ({ open, onOpenChange, onSaved }) => {
    const [form, setForm] = useState(makeDefaultHolidayForm);
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    const loadHolidays = async () => {
        setLoading(true);
        try {
            const response = await axiosInstance.get('/api/dashboard/holidays');
            setHolidays(extractApiList(response, "holidays"));
        } catch (error) {
            setMessage(error?.response?.data?.message || "Unable to load holidays");
            setHolidays([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!open) return;
        setMessage("");
        loadHolidays();
    }, [open]);

    const handlePresetChange = (holidayType) => {
        const preset = HOLIDAY_PRESETS.find(item => item.value === holidayType) || HOLIDAY_PRESETS[0];
        setForm(prev => ({
            ...prev,
            holidayType: preset.value,
            holidayName: preset.name,
            shortCode: preset.shortCode,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage("");

        if (!form.holidayDate || !form.holidayName.trim() || !form.shortCode.trim()) {
            setMessage("Date, holiday name and short code are required.");
            return;
        }

        setSaving(true);
        try {
            await axiosInstance.post('/api/dashboard/holidays', {
                ...form,
                holidayName: form.holidayName.trim(),
                shortCode: form.shortCode.trim().toUpperCase(),
            });
            setMessage("Holiday saved successfully.");
            setForm(makeDefaultHolidayForm());
            await loadHolidays();
            onSaved?.();
        } catch (error) {
            setMessage(error?.response?.data?.message || "Unable to save holiday");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (holiday) => {
        const confirmed = window.confirm(`Remove ${holiday.holidayName} from ${holiday.holidayDate}?`);
        if (!confirmed) return;

        setMessage("");
        try {
            await axiosInstance.delete(`/api/dashboard/holidays/${holiday.id}`);
            setMessage("Holiday removed successfully.");
            await loadHolidays();
            onSaved?.();
        } catch (error) {
            setMessage(error?.response?.data?.message || "Unable to remove holiday");
        }
    };

    const editHoliday = (holiday) => {
        setForm({
            holidayDate: holiday.holidayDate || getLocalTodayForInput(),
            holidayType: holiday.holidayType || "CUSTOM",
            holidayName: holiday.holidayName || "",
            shortCode: holiday.shortCode || "H",
            description: holiday.description || "",
        });
        setMessage("Selected holiday loaded for editing.");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarPlus className="w-5 h-5 text-blue-600" />
                        Manage Dashboard Holidays
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Holiday date</label>
                            <input
                                type="date"
                                value={form.holidayDate}
                                onChange={(e) => setForm(prev => ({ ...prev, holidayDate: e.target.value }))}
                                className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Holiday type</label>
                            <Select value={form.holidayType} onValueChange={handlePresetChange}>
                                <SelectTrigger className="w-full h-10">
                                    <SelectValue placeholder="Select holiday type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {HOLIDAY_PRESETS.map(item => (
                                        <SelectItem key={item.value} value={item.value}>
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Holiday name</label>
                            <input
                                type="text"
                                value={form.holidayName}
                                onChange={(e) => setForm(prev => ({ ...prev, holidayName: e.target.value }))}
                                className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                                placeholder="Example: Diwali"
                                maxLength={100}
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Short code</label>
                            <input
                                type="text"
                                value={form.shortCode}
                                onChange={(e) => setForm(prev => ({
                                    ...prev,
                                    shortCode: e.target.value.toUpperCase().slice(0, 10),
                                }))}
                                className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm uppercase outline-none focus:ring-2 focus:ring-blue-400"
                                placeholder="S / NH / FH"
                                maxLength={10}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">Description (optional)</label>
                        <textarea
                            value={form.description}
                            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder="Optional note"
                            maxLength={255}
                        />
                    </div>

                    {message && (
                        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
                            {message}
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Save Holiday
                        </Button>
                    </DialogFooter>
                </form>

                <div className="border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-slate-800">Declared holidays</h3>
                        {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {!loading && holidays.length === 0 && (
                            <div className="text-sm text-slate-400 py-4 text-center">No holidays declared</div>
                        )}

                        {holidays.map(holiday => (
                            <div
                                key={holiday.id}
                                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 bg-slate-50"
                            >
                                <button
                                    type="button"
                                    onClick={() => editHoliday(holiday)}
                                    className="min-w-0 flex-1 text-left"
                                >
                                    <div className="font-bold text-slate-800 truncate">
                                        {holiday.holidayName}
                                        <span className="ml-2 text-xs rounded bg-blue-100 text-blue-700 px-2 py-0.5">
                                            {holiday.shortCode}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        {formatDisplayDate(holiday.holidayDate)} · {holiday.holidayType}
                                    </div>
                                </button>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleDelete(holiday)}
                                    title="Remove holiday"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const DashboardHome = () => {
    const [departments, setDepartments] = useState([]);
    const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
    const [holidayRevision, setHolidayRevision] = useState(0);

    const getDashboardQueryParams = (filter, extra = {}) =>
        getQueryParams(filter, { ...extra, _holidayRevision: holidayRevision });

    const getLowerDashboardQueryParams = (filter, extra = {}) =>
        getLowerGraphQueryParams(filter, { ...extra, _holidayRevision: holidayRevision });

    const [tenureValueModes, setTenureValueModes] = useState({
        attendance: "percentage",
        attrition: "percentage",
        absenteeism: "percentage",
    });

    const setTenureValueMode = (key, value) => {
        setTenureValueModes(prev => ({ ...prev, [key]: value }));
    };

    const [graphValueModes, setGraphValueModes] = useState({
        attrition: "percentage",
        absenteeism: "percentage",
        contractorPrefix: "percentage",
        skill: "percentage",
        gender: "percentage",
        state: "percentage",
        district: "percentage",
        employeeGender: "percentage",
        education: "percentage",
    });

    const navigate = useNavigate();

    const setGraphValueMode = (key, value) => {
        setGraphValueModes(prev => ({ ...prev, [key]: value }));
    };

    const [pieChartViews, setPieChartViews] = useState({
        // Middle charts now also support Pie/Bar toggle.
        // Skill defaults to bar because pie becomes hard to read when categories are many.
        skill: "bar",
        gender: "bar",
        state: "bar",
        district: "bar",
        employeeGender: "bar",
    });

    const setPieChartView = (key, value) => {
        setPieChartViews(prev => ({ ...prev, [key]: value }));
    };

    const [manpowerFilter, setManpowerFilter] = useState(defaultFilter);
    const [attritionFilter, setAttritionFilter] = useState(defaultFilter);
    const [absenteeismFilter, setAbsenteeismFilter] = useState(defaultFilter);
    const [contractorPrefixFilter, setContractorPrefixFilter] = useState(defaultFilter);
    const [skillFilter, setSkillFilter] = useState(defaultFilter);
    const [genderFilter, setGenderFilter] = useState(defaultFilter);
    const [stateFilter, setStateFilter] = useState(defaultFilter);
    const [districtFilter, setDistrictFilter] = useState(defaultFilter);
    const [employeeGenderFilter, setEmployeeGenderFilter] = useState(defaultFilter);
    const [educationFilter, setEducationFilter] = useState(defaultFilter);
    const [showEmployeeMasterGraphs, setShowEmployeeMasterGraphs] = useState(true);
    const [showRejoiningTrend, setShowRejoiningTrend] = useState(false);
    const [rejoiningVisibleDays, setRejoiningVisibleDays] = useState(30);
    const [rejoiningDateRange, setRejoiningDateRange] = useState(undefined);
    const [handoverDateRange, setHandoverDateRange] = useState(undefined);

    const [selectedMasterState, setSelectedMasterState] = useState(["ALL"]);
    const [selectedMasterDistrict, setSelectedMasterDistrict] = useState(["ALL"]);

    useEffect(() => {
        setSelectedMasterDistrict(["ALL"]);
    }, [serializeMultiValue(selectedMasterState)]);

    // State Distribution graph filters are the base filters for the lower three graphs.
    // When State graph filter changes, District/Gender/Role filters automatically show the same selected filters.
    // After that, user can manually change any lower graph filter as needed.
    useEffect(() => {
        const nextStateFilter = {
            department: normalizeMultiValue(stateFilter.department),
            section: normalizeMultiValue(stateFilter.section),
            line: normalizeMultiValue(stateFilter.line),
            dateRange: stateFilter.dateRange,
            shift: stateFilter.shift || "ALL",
        };

        setDistrictFilter(nextStateFilter);
        setEmployeeGenderFilter(nextStateFilter);
    }, [
        serializeMultiValue(stateFilter.department),
        serializeMultiValue(stateFilter.section),
        serializeMultiValue(stateFilter.line),
        stateFilter.dateRange?.from,
        stateFilter.dateRange?.to,
        stateFilter.shift,
    ]);

    // State graph filters act as the base filters for the lower three employee master graphs.
    // If a lower graph has its own specific filter selected, that graph can still use it.
    // If its filter is ALL/empty, it automatically follows the State graph filter.
    const getStateLinkedFilter = (childFilter) => ({
        department: hasRealSelection(childFilter.department)
            ? childFilter.department
            : stateFilter.department,
        section: hasRealSelection(childFilter.section)
            ? childFilter.section
            : stateFilter.section,
        line: hasRealSelection(childFilter.line)
            ? childFilter.line
            : stateFilter.line,
        dateRange: childFilter.dateRange?.from
            ? childFilter.dateRange
            : stateFilter.dateRange,
        shift: childFilter.shift && childFilter.shift !== "ALL"
            ? childFilter.shift
            : stateFilter.shift || "ALL",
    });

    const [tenureFilter, setTenureFilter] = useState(defaultFilter);
    const [customTenureRange, setCustomTenureRange] = useState({
        from: 0,
        to: 0,
    });

    const [attendanceTenureBucket, setAttendanceTenureBucket] = useState("ALL");
    const [attritionTenureBucket, setAttritionTenureBucket] = useState("ALL");
    const [absenteeismTenureBucket, setAbsenteeismTenureBucket] = useState("ALL");

    const [chartTypes, setChartTypes] = useState({
        manpower: "bar",
        attrition: "bar",
        absenteeism: "bar",
        attendanceTenure: "bar",
        attritionTenure: "bar",
        absenteeismTenure: "bar",
    });

    const setChartType = (key, value) => {
        setChartTypes(prev => ({ ...prev, [key]: value }));
    };

    useEffect(() => {
        axiosInstance.get('/api/departments')
            .then(res => {
                // ✅ FIXED: handle both wrapped and unwrapped
                const list = extractApiList(res, "departments");
                setDepartments(normalizeApiOptions(list, "department"));
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        setAttritionFilter(manpowerFilter);
        setAbsenteeismFilter({
            ...manpowerFilter,
            shift: "ALL",
        });
    }, [manpowerFilter]);

    // INITIAL LOAD PERFORMANCE:
    // One full dashboard request supplies every graph while filters are equivalent.
    // A graph-specific request starts only after that graph's effective filters differ.
    // No graph condition is changed; only duplicate API calls are avoided.
    const baseDashboardParams = getDashboardQueryParams(manpowerFilter, {});
    const baseDashboardReuseKey = getDashboardReuseKey(baseDashboardParams);

    const {
        data: manpowerStats,
        isLoading: manpowerLoading,
        isFetching: manpowerFetching,
    } = useGetDashboardStatsQuery(baseDashboardParams);

    const rejoiningEffectiveFilter = {
        ...manpowerFilter,
        dateRange: rejoiningDateRange,
    };
    const rejoiningQueryParams = getDashboardQueryParams(rejoiningEffectiveFilter, {
        scope: "manpower",
    });
    const rejoiningUsesBase = getDashboardReuseKey(rejoiningQueryParams) === baseDashboardReuseKey;
    const {
        data: rejoiningScopedStats,
        isLoading: rejoiningScopedLoading,
        isFetching: rejoiningScopedFetching,
    } = useGetDashboardStatsQuery(rejoiningQueryParams, { skip: rejoiningUsesBase });
    const rejoiningStats = rejoiningUsesBase ? manpowerStats : rejoiningScopedStats;
    const rejoiningLoading = rejoiningUsesBase ? manpowerLoading : rejoiningScopedLoading;
    const rejoiningFetching = rejoiningUsesBase ? manpowerFetching : rejoiningScopedFetching;

    const handoverEffectiveFilter = {
        ...manpowerFilter,
        dateRange: handoverDateRange,
    };
    const handoverQueryParams = getDashboardQueryParams(handoverEffectiveFilter, {
        scope: "manpower",
    });
    const handoverUsesBase = getDashboardReuseKey(handoverQueryParams) === baseDashboardReuseKey;
    const {
        data: handoverScopedStats,
        isLoading: handoverScopedLoading,
        isFetching: handoverScopedFetching,
    } = useGetDashboardStatsQuery(handoverQueryParams, { skip: handoverUsesBase });
    const handoverStats = handoverUsesBase ? manpowerStats : handoverScopedStats;
    const handoverLoading = handoverUsesBase ? manpowerLoading : handoverScopedLoading;
    const handoverFetching = handoverUsesBase ? manpowerFetching : handoverScopedFetching;

    const attritionQueryParams = getDashboardQueryParams(attritionFilter, {
        shift: "ALL",
        scope: "attrition",
    });
    const attritionUsesBase = getDashboardReuseKey(attritionQueryParams) === baseDashboardReuseKey;
    const {
        data: attritionScopedStats,
        isLoading: attritionScopedLoading,
        isFetching: attritionScopedFetching,
    } = useGetDashboardStatsQuery(attritionQueryParams, { skip: attritionUsesBase });
    const attritionStats = attritionUsesBase ? manpowerStats : attritionScopedStats;
    const attritionLoading = attritionUsesBase ? manpowerLoading : attritionScopedLoading;
    const attritionFetching = attritionUsesBase ? manpowerFetching : attritionScopedFetching;

    const absenteeismQueryParams = getDashboardQueryParams(absenteeismFilter, {
        shift: "ALL",
        scope: "absenteeism",
    });
    const absenteeismUsesBase = getDashboardReuseKey(absenteeismQueryParams) === baseDashboardReuseKey;
    const {
        data: absenteeismScopedStats,
        isLoading: absenteeismScopedLoading,
        isFetching: absenteeismScopedFetching,
    } = useGetDashboardStatsQuery(absenteeismQueryParams, { skip: absenteeismUsesBase });
    const absenteeismStats = absenteeismUsesBase ? manpowerStats : absenteeismScopedStats;
    const absenteeismLoading = absenteeismUsesBase ? manpowerLoading : absenteeismScopedLoading;
    const absenteeismFetching = absenteeismUsesBase ? manpowerFetching : absenteeismScopedFetching;

    const contractorPrefixQueryParams = getLowerDashboardQueryParams(contractorPrefixFilter, {
        scope: "contractor",
    });
    const contractorPrefixUsesBase = getDashboardReuseKey(contractorPrefixQueryParams) === baseDashboardReuseKey;
    const {
        data: contractorPrefixScopedStats,
        isLoading: contractorPrefixScopedLoading,
        isFetching: contractorPrefixScopedFetching,
    } = useGetDashboardStatsQuery(contractorPrefixQueryParams, { skip: contractorPrefixUsesBase });
    const contractorPrefixStats = contractorPrefixUsesBase ? manpowerStats : contractorPrefixScopedStats;
    const contractorPrefixLoading = contractorPrefixUsesBase ? manpowerLoading : contractorPrefixScopedLoading;
    const contractorPrefixFetching = contractorPrefixUsesBase ? manpowerFetching : contractorPrefixScopedFetching;

    const educationQueryParams = getLowerDashboardQueryParams(educationFilter, {
        scope: "education",
    });
    const educationUsesBase = getDashboardReuseKey(educationQueryParams) === baseDashboardReuseKey;
    const {
        data: educationScopedStats,
        isLoading: educationScopedLoading,
        isFetching: educationScopedFetching,
    } = useGetDashboardStatsQuery(educationQueryParams, { skip: educationUsesBase });
    const educationStats = educationUsesBase ? manpowerStats : educationScopedStats;
    const educationLoading = educationUsesBase ? manpowerLoading : educationScopedLoading;
    const educationFetching = educationUsesBase ? manpowerFetching : educationScopedFetching;

    const skillQueryParams = getLowerDashboardQueryParams(skillFilter, {
        masterAttendanceMode: "YES",
        scope: "skill",
    });
    const skillUsesBase = getDashboardReuseKey(skillQueryParams) === baseDashboardReuseKey;
    const {
        data: skillScopedStats,
        isLoading: skillScopedLoading,
        isFetching: skillScopedFetching,
    } = useGetDashboardStatsQuery(skillQueryParams, { skip: skillUsesBase });
    const skillStats = skillUsesBase ? manpowerStats : skillScopedStats;
    const skillLoading = skillUsesBase ? manpowerLoading : skillScopedLoading;
    const skillFetching = skillUsesBase ? manpowerFetching : skillScopedFetching;

    const genderQueryParams = getLowerDashboardQueryParams(genderFilter, {
        masterAttendanceMode: "YES",
        scope: "gender",
    });
    const genderUsesBase = getDashboardReuseKey(genderQueryParams) === baseDashboardReuseKey;
    const {
        data: genderScopedStats,
        isLoading: genderScopedLoading,
        isFetching: genderScopedFetching,
    } = useGetDashboardStatsQuery(genderQueryParams, { skip: genderUsesBase });
    const genderStats = genderUsesBase ? manpowerStats : genderScopedStats;
    const genderLoading = genderUsesBase ? manpowerLoading : genderScopedLoading;
    const genderFetching = genderUsesBase ? manpowerFetching : genderScopedFetching;

    const stateQueryParams = getLowerDashboardQueryParams(stateFilter, {
        stateFilter: serializeMultiValue(selectedMasterState),
        masterAttendanceMode: "YES",
        scope: "state",
    });
    const stateUsesBase = getDashboardReuseKey(stateQueryParams) === baseDashboardReuseKey;
    const {
        data: stateScopedStats,
        isLoading: stateScopedLoading,
        isFetching: stateScopedFetching,
    } = useGetDashboardStatsQuery(
        stateQueryParams,
        { skip: !showEmployeeMasterGraphs || stateUsesBase }
    );
    const stateStats = stateUsesBase ? manpowerStats : stateScopedStats;
    const stateLoading = stateUsesBase ? manpowerLoading : stateScopedLoading;
    const stateFetching = stateUsesBase ? manpowerFetching : stateScopedFetching;

    const districtQueryParams = getLowerDashboardQueryParams(getStateLinkedFilter(districtFilter), {
        stateFilter: serializeMultiValue(selectedMasterState),
        districtFilter: serializeMultiValue(selectedMasterDistrict),
        masterAttendanceMode: "YES",
        scope: "district",
    });
    const districtUsesBase = getDashboardReuseKey(districtQueryParams) === baseDashboardReuseKey;
    const {
        data: districtScopedStats,
        isLoading: districtScopedLoading,
        isFetching: districtScopedFetching,
    } = useGetDashboardStatsQuery(
        districtQueryParams,
        { skip: !showEmployeeMasterGraphs || districtUsesBase }
    );
    const districtStats = districtUsesBase ? manpowerStats : districtScopedStats;
    const districtLoading = districtUsesBase ? manpowerLoading : districtScopedLoading;
    const districtFetching = districtUsesBase ? manpowerFetching : districtScopedFetching;

    const employeeGenderQueryParams = getLowerDashboardQueryParams(getStateLinkedFilter(employeeGenderFilter), {
        stateFilter: serializeMultiValue(selectedMasterState),
        districtFilter: serializeMultiValue(selectedMasterDistrict),
        masterAttendanceMode: "YES",
        scope: "employeegender",
    });
    const employeeGenderUsesBase = getDashboardReuseKey(employeeGenderQueryParams) === baseDashboardReuseKey;
    const {
        data: employeeGenderScopedStats,
        isLoading: employeeGenderScopedLoading,
        isFetching: employeeGenderScopedFetching,
    } = useGetDashboardStatsQuery(
        employeeGenderQueryParams,
        { skip: !showEmployeeMasterGraphs || employeeGenderUsesBase }
    );
    const employeeGenderStats = employeeGenderUsesBase ? manpowerStats : employeeGenderScopedStats;
    const employeeGenderLoading = employeeGenderUsesBase ? manpowerLoading : employeeGenderScopedLoading;
    const employeeGenderFetching = employeeGenderUsesBase ? manpowerFetching : employeeGenderScopedFetching;

    const shouldUseCustomTenureRange =
        attendanceTenureBucket === "CUSTOM" ||
        attritionTenureBucket === "CUSTOM" ||
        absenteeismTenureBucket === "CUSTOM";

    const { tenureStats, tenureLoading } = useTenureStats(
        tenureFilter,
        customTenureRange,
        shouldUseCustomTenureRange,
        holidayRevision,
        !manpowerLoading && !manpowerFetching
    );

    const normalizeTopGraphRange = (data = [], graphFilter = defaultFilter) => {
        if (!Array.isArray(data)) return [];

        // A manually selected range must remain complete and inclusive,
        // including both its starting and ending dates.
        if (graphFilter?.dateRange?.from) {
            return data;
        }

        // Keep the existing 30-day default only when no range is selected.
        return data.slice(-30);
    };

    const manpowerData = normalizeTopGraphRange(manpowerStats?.data?.manpowerData || [], manpowerFilter);
    const rejoiningSource =
        rejoiningStats?.data?.rejoiningData
        ?? rejoiningStats?.rejoiningData
        ?? rejoiningStats?.data?.data?.rejoiningData
        ?? [];
    const rejoiningData = normalizeTopGraphRange(rejoiningSource, rejoiningEffectiveFilter);
    const rejoiningChartData = rejoiningDateRange?.from
        ? rejoiningData
        : rejoiningData.slice(-rejoiningVisibleDays);
    const handoverSource =
        handoverStats?.data?.handoverData
        ?? handoverStats?.handoverData
        ?? handoverStats?.data?.data?.handoverData
        ?? [];
    const handoverData = normalizeTopGraphRange(handoverSource, handoverEffectiveFilter);
    const attritionData = normalizeTopGraphRange(attritionStats?.data?.attritionData || [], attritionFilter);
    const absenteeismData = normalizeTopGraphRange(absenteeismStats?.data?.absenteeismData || [], absenteeismFilter);

    const skillPieData = normalizeSkillLevelChartData(skillStats?.data?.pieCharts?.skillLevels || []);
    const genderPieData = genderStats?.data?.pieCharts?.gender || [];
    const contractorPrefixData =
        contractorPrefixStats?.data?.pieCharts?.contractorPrefix || [];
    const educationData = educationStats?.data?.pieCharts?.education || [];
    const statePieData = stateStats?.data?.pieCharts?.state || [];
    const districtPieData = districtStats?.data?.pieCharts?.district || [];
    const employeeGenderPieData = employeeGenderStats?.data?.pieCharts?.gender || [];

    const stateOptions = employeeGenderStats?.data?.pieCharts?.stateOptions
        || stateStats?.data?.pieCharts?.stateOptions
        || [];

    const districtOptions = districtStats?.data?.pieCharts?.districtOptions
        || employeeGenderStats?.data?.pieCharts?.districtOptions
        || [];

    const SKILL_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    const GENDER_COLORS = ['#0ea5e9', '#ec4899', '#64748b']; // Male = blue, Female = pink
    const STATE_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#64748b'];
    const DISTRICT_COLORS = ['#0f766e', '#7c3aed', '#dc2626', '#0284c7', '#ca8a04', '#059669', '#db2777', '#475569', '#f97316'];

    const buildTenureData = (
        stats,
        key,
        tenureBucket,
        valueMode = "percentage",
        customRange = { from: 0, to: 67 }
    ) => {
        const normalBuckets = TENURE_BUCKETS.filter(
            item => item.value !== "ALL" && item.value !== "CUSTOM"
        );

        const selectedBuckets =
            tenureBucket === "ALL"
                ? normalBuckets
                : tenureBucket === "CUSTOM"
                    ? [{
                        value: "CUSTOM",
                        label: `${customRange?.from ?? 0}–${customRange?.to ?? 67} days`,
                    }]
                    : TENURE_BUCKETS.filter(item => item.value === tenureBucket);

        const sourceObj = stats?.[key] || {};
        const masterObj = stats?.masterTenure || stats?.usersTotalByTenure || {};
        const holiday = key === "attendance" ? (stats?.filters?.holiday || null) : null;

        const denominatorBuckets = tenureBucket === "CUSTOM"
            ? [{ value: "CUSTOM" }]
            : normalBuckets;

        const total = denominatorBuckets.reduce((sum, item) => {
            return sum + Number(sourceObj?.[item.value] ?? 0);
        }, 0);

        const masterTotal = denominatorBuckets.reduce((sum, item) => {
            return sum + Number(masterObj?.[item.value] ?? 0);
        }, 0);

        return selectedBuckets.map(item => {
            const rawValue = Number(sourceObj?.[item.value] ?? 0);
            const masterValue = Number(masterObj?.[item.value] ?? 0);
            const commonTotal = masterTotal > 0 ? masterTotal : total;
            const denominator = key === "attrition" ? (masterValue > 0 ? masterValue : rawValue) : commonTotal;
            const percentage = denominator > 0 ? Number(((rawValue / denominator) * 100).toFixed(1)) : 0;
            const masterPercentage = commonTotal > 0 ? Number(((masterValue / commonTotal) * 100).toFixed(1)) : 0;

            return {
                bucket: item.label,
                value: valueMode === "percentage" ? percentage : rawValue,
                rawValue,
                percentage,
                masterValue: valueMode === "percentage" ? masterPercentage : masterValue,
                masterRawValue: masterValue,
                masterPercentage,
                isHoliday: Boolean(holiday),
                holidayName: holiday?.holidayName || null,
                holidayShortCode: holiday?.shortCode || null,
                holidayType: holiday?.holidayType || null,
            };
        });
    };

    const getTenureLabel = (bucket) => {
        if (bucket === "CUSTOM") {
            return `${customTenureRange.from}–${customTenureRange.to} days`;
        }

        return TENURE_BUCKETS.find(item => item.value === bucket)?.label || "All joining buckets";
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 space-y-6 w-full max-w-full overflow-x-hidden min-w-0">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <Button
                        onClick={() => navigate(-1)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Menu
                    </Button>
                    <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <Button
                        type="button"
                        onClick={() => setHolidayDialogOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                    >
                        <CalendarPlus className="w-4 h-4" />
                        Manage Holidays
                    </Button>

                    <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1 rounded-full font-semibold hidden md:inline-block">
                        Holiday code replaces attendance value on declared dates
                    </span>
                </div>
            </div>

            <HolidayManagementDialog
                open={holidayDialogOpen}
                onOpenChange={setHolidayDialogOpen}
                onSaved={() => setHolidayRevision(prev => prev + 1)}
            />

            <Card className="border-slate-200 shadow-sm bg-white w-full">
                <CardHeader className="pb-1 pt-5 px-6 space-y-3">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
                                <Users className="w-6 h-6 text-blue-600" />
                                Daily Manpower Trend
                                {(manpowerLoading || manpowerFetching) && (
                                    <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                                )}
                            </CardTitle>
                            <p className="text-sm text-slate-500 mt-1">
                                Requirement bar is orange and value is visible on every date
                            </p>
                          
                        </div>

                        <div className="flex items-center gap-4 flex-wrap">
                            <GraphFilterBar
                                filter={manpowerFilter}
                                setFilter={setManpowerFilter}
                                departments={departments}
                            />

                            <ChartTypeToggle
                                value={chartTypes.manpower}
                                onChange={(value) => setChartType("manpower", value)}
                            />
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="px-2 pb-4 pt-2">
                    <ScrollableManpowerChart
                        dataLength={manpowerData.length}
                        scrollToStart={Boolean(manpowerFilter?.dateRange?.from)}
                    >
                        {(manpowerLoading || manpowerFetching) && <ChartLoader />}
                        {!(manpowerLoading || manpowerFetching) && manpowerData.length === 0 && (
                            <EmptyState text="No data found for selected filters" />
                        )}

                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={manpowerData}
                                margin={{ top: 66, right: 48, left: 4, bottom: 8 }}
                                barCategoryGap="30%"
                                barGap={0}
                            >
                                <defs>
                                    <linearGradient id="headcountGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f0cf14" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#e7ae12" stopOpacity={0.85} />
                                    </linearGradient>

                                    <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#2563eb" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.85} />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#475569', fontSize: 13, fontWeight: 900 }}
                                    dy={8}
                                    interval={0}
                                />

                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#475569', fontSize: 13, fontWeight: 900 }}
                                    allowDecimals={false}
                                    width={36}
                                />

                                <Bar
                                    dataKey="required"
                                    name="Required"
                                    fill="#ea580c"
                                    radius={[4, 4, 0, 0]}
                                    barSize={42}
                                    label={renderBarValueLabel("#ea580c", "", 13)}
                                />

                                {chartTypes.manpower === "bar" ? (
                                    <>
                                        <Bar
                                            dataKey="present"
                                            name="Actual Present"
                                            fill="url(#presentGrad)"
                                            radius={[4, 4, 0, 0]}
                                            barSize={42}
                                            label={(props) => {
                                                const item = manpowerData[props.index] || {};
                                                return renderAttendanceLabel("#2563eb", "", 13)({
                                                    ...props,
                                                    holidayShortCode: item.holidayShortCode,
                                                    holidayName: item.holidayName,
                                                });
                                            }}
                                        />

                                        <Bar
                                            dataKey="current"
                                            name="Current Headcount"
                                            fill="url(#headcountGrad)"
                                            radius={[4, 4, 0, 0]}
                                            barSize={42}
                                            label={renderBarValueLabel("#7c5a00", "", 13)}
                                        />
                                    </>
                                ) : (
                                    <>
                                        <Line
                                            type="monotone"
                                            dataKey="current"
                                            name="Current Headcount"
                                            stroke="#e7ae12"
                                            strokeWidth={2.2}
                                            dot={{ r: 2.5, fill: "#e7ae12", strokeWidth: 0 }}
                                            activeDot={false}
                                            label={(props) => {
                                                const { x, y, value } = props;
                                                if (value === null || value === undefined || value === "") return null;

                                                return (
                                                    <text
                                                        x={x}
                                                        y={y - 10}
                                                        textAnchor="middle"
                                                        fill="#7c5a00"
                                                        fontSize={13}
                                                        fontWeight={900}
                                                        stroke="#7c5a00"
                                                        strokeWidth={0.55}
                                                        paintOrder="stroke"
                                                        style={{ fontWeight: 900, fontFamily: "'Arial Black', Arial, sans-serif" }}
                                                    >
                                                        {value}
                                                    </text>
                                                );
                                            }}
                                        />

                                        <Line
                                            type="monotone"
                                            dataKey="present"
                                            name="Actual Present"
                                            stroke="#2563eb"
                                            strokeWidth={2.2}
                                            dot={{ r: 2.5, fill: "#2563eb", strokeWidth: 0 }}
                                            activeDot={false}
                                            label={(props) => {
                                                const item = manpowerData[props.index] || {};
                                                if (item?.isHoliday || item?.holidayShortCode) {
                                                    return renderAttendanceLabel("#2563eb", "", 13)({
                                                        ...props,
                                                        width: 0,
                                                        holidayShortCode: item.holidayShortCode,
                                                        holidayName: item.holidayName,
                                                    });
                                                }

                                                const { x, y, value } = props;
                                                if (value === null || value === undefined || value === "") return null;

                                                return (
                                                    <text
                                                        x={x}
                                                        y={y + 16}
                                                        textAnchor="middle"
                                                        fill="#2563eb"
                                                        fontSize={13}
                                                        fontWeight={900}
                                                        stroke="#2563eb"
                                                        strokeWidth={0.55}
                                                        paintOrder="stroke"
                                                        style={{ fontWeight: 900, fontFamily: "'Arial Black', Arial, sans-serif" }}
                                                    >
                                                        {value}
                                                    </text>
                                                );
                                            }}
                                        />
                                    </>
                                )}

                            </ComposedChart>
                        </ResponsiveContainer>
                    </ScrollableManpowerChart>

                    <SimpleLegend
                        items={[
                            { color: '#ea580c', label: 'Required' },
                            { color: '#2563eb', label: 'Actual Present / Holiday Code' },
                            { color: '#e7ae12', label: 'Current Headcount' },
                        ]}
                    />

                    <div className="mt-4 border-t border-slate-200 pt-4 px-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowRejoiningTrend(prev => !prev)}
                            className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                            {showRejoiningTrend ? (
                                <EyeOff className="w-4 h-4" />
                            ) : (
                                <Eye className="w-4 h-4" />
                            )}
                            {showRejoiningTrend ? "Hide Rejoining & Handover Trends" : "Show Rejoining & Handover Trends"}
                        </Button>

                        {showRejoiningTrend && (
                            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-800">
                                            Daily Employee Rejoining Trend
                                        </h3>
                                        <p className="text-sm text-slate-500 mt-1">
                                            Only second and later joiningDate entries from statusHistory are counted as rejoining events
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        <DateRangeOnlyFilter
                                            value={rejoiningDateRange}
                                            onChange={setRejoiningDateRange}
                                        />

                                        <div className="flex items-center gap-1 rounded-lg bg-white border border-slate-200 p-1">
                                            {[10, 15, 30].map(days => (
                                                <Button
                                                    key={days}
                                                    type="button"
                                                    size="sm"
                                                    variant={!rejoiningDateRange?.from && rejoiningVisibleDays === days ? "default" : "ghost"}
                                                    className={`h-8 px-3 text-sm ${!rejoiningDateRange?.from && rejoiningVisibleDays === days
                                                        ? "bg-blue-600 text-white hover:bg-blue-700"
                                                        : "text-slate-600"
                                                    }`}
                                                    onClick={() => {
                                                        setRejoiningDateRange(undefined);
                                                        setRejoiningVisibleDays(days);
                                                    }}
                                                >
                                                    Last {days} Days
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <ScrollableTopChart
                                    dataLength={rejoiningChartData.length}
                                    scrollToStart={Boolean(rejoiningDateRange?.from)}
                                >
                                    {(rejoiningLoading || rejoiningFetching) && <ChartLoader />}
                                    {!(rejoiningLoading || rejoiningFetching) && rejoiningChartData.length === 0 && (
                                        <EmptyState text="No rejoining data found for selected filters" />
                                    )}

                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={rejoiningChartData}
                                            margin={{ top: 48, right: 30, left: 4, bottom: 8 }}
                                            barCategoryGap="35%"
                                        >
                                            <defs>
                                                <linearGradient id="rejoiningTrendGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#16a34a" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#15803d" stopOpacity={0.86} />
                                                </linearGradient>
                                            </defs>

                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                                            <XAxis
                                                dataKey="day"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#475569', fontSize: 13, fontWeight: 900 }}
                                                dy={8}
                                                interval={0}
                                            />

                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#475569', fontSize: 13, fontWeight: 900 }}
                                                allowDecimals={false}
                                                width={36}
                                            />

                                            <Bar
                                                dataKey="rejoinedCount"
                                                name="Employees Rejoined"
                                                fill="url(#rejoiningTrendGrad)"
                                                radius={[5, 5, 0, 0]}
                                                barSize={42}
                                                label={renderBarValueLabel("#166534", "", 13)}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ScrollableTopChart>

                                <SimpleLegend
                                    items={[
                                        { color: '#16a34a', label: 'Employees Rejoined' },
                                    ]}
                                />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {showRejoiningTrend && (
                <Card className="rounded-2xl border-slate-200 shadow-sm overflow-visible">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <UserCheck className="w-5 h-5 text-emerald-600" />
                                Daily Joining & Handover Trend
                                {(handoverLoading || handoverFetching) && (
                                    <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                                )}
                            </CardTitle>
                            <p className="text-sm text-slate-500 mt-1">
                                Joined = original statusHistory joiningDate · Handover Completed = handover sheet studentId match
                            </p>
                        </div>

                        <DateRangeOnlyFilter
                            value={handoverDateRange}
                            onChange={setHandoverDateRange}
                        />
                    </div>
                </CardHeader>

                <CardContent className="px-2 pb-4 pt-2">
                    <ScrollableTopChart
                        dataLength={handoverData.length}
                        scrollToStart={Boolean(handoverDateRange?.from)}
                    >
                        {(handoverLoading || handoverFetching) && <ChartLoader />}
                        {!(handoverLoading || handoverFetching) && handoverData.length === 0 && (
                            <EmptyState text="No joining or handover data found" />
                        )}

                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={handoverData}
                                margin={{ top: 48, right: 28, left: 4, bottom: 8 }}
                                barCategoryGap="28%"
                                barGap={2}
                            >
                                <defs>
                                    <linearGradient id="handoverJoinedGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#2563eb" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.85} />
                                    </linearGradient>
                                    <linearGradient id="handoverCompletedGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#16a34a" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#15803d" stopOpacity={0.85} />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

                                <XAxis
                                    dataKey="day"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#475569', fontSize: 13, fontWeight: 900 }}
                                    dy={8}
                                    interval={0}
                                />

                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#475569', fontSize: 13, fontWeight: 900 }}
                                    allowDecimals={false}
                                    width={36}
                                />

                                <Bar
                                    dataKey="joinedCount"
                                    name="Employees Joined"
                                    fill="url(#handoverJoinedGrad)"
                                    radius={[5, 5, 0, 0]}
                                    barSize={34}
                                    label={renderBarValueLabel("#1d4ed8", "", 13)}
                                />

                                <Bar
                                    dataKey="handoverCount"
                                    name="Handover Completed"
                                    fill="url(#handoverCompletedGrad)"
                                    radius={[5, 5, 0, 0]}
                                    barSize={34}
                                    label={renderBarValueLabel("#166534", "", 13)}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </ScrollableTopChart>

                    <SimpleLegend
                        items={[
                            { color: '#2563eb', label: 'Employees Joined' },
                            { color: '#16a34a', label: 'Handover Completed' },
                        ]}
                    />
                </CardContent>
            </Card>
            )}

            <FullWidthToggleChartCard
                title="Daily Attrition Rate"
                subtitle={`Daily attrition ${graphValueModes.attrition === "percentage" ? "percentage" : "left employee count"}`}
                data={attritionData.map(item => ({
                    ...item,
                    actual: graphValueModes.attrition === "percentage" ? item.actual : item.leftCount,
                }))}
                dataKey="actual"
                xKey="day"
                color="#2563eb"
                gradientId="attritionGrad"
                suffix={graphValueModes.attrition === "percentage" ? "%" : ""}
                chartType={chartTypes.attrition}
                onChartTypeChange={(value) => setChartType("attrition", value)}
                isLoading={attritionLoading || attritionFetching}
                emptyText="No attrition data found"
                filter={attritionFilter}
                setFilter={setAttritionFilter}
                departments={departments}
                valueMode={graphValueModes.attrition}
                onValueModeChange={(value) => setGraphValueMode("attrition", value)}
                showShiftFilter={false}
            />

            <FullWidthToggleChartCard
                title="Daily Absenteeism Rate"
                subtitle={`Daily absenteeism ${graphValueModes.absenteeism === "percentage" ? "percentage" : "absent employee count"}`}
                data={absenteeismData.map(item => ({
                    ...item,
                    actual: graphValueModes.absenteeism === "percentage" ? item.actual : item.absent,
                }))}
                dataKey="actual"
                xKey="day"
                color="#2563eb"
                gradientId="absenteeismGrad"
                suffix={graphValueModes.absenteeism === "percentage" ? "%" : ""}
                chartType={chartTypes.absenteeism}
                onChartTypeChange={(value) => setChartType("absenteeism", value)}
                isLoading={absenteeismLoading || absenteeismFetching}
                emptyText="No absenteeism data found"
                filter={absenteeismFilter}
                setFilter={setAbsenteeismFilter}
                departments={departments}
                valueMode={graphValueModes.absenteeism}
                onValueModeChange={(value) => setGraphValueMode("absenteeism", value)}
                showShiftFilter={false}
            />

            <EducationChartCard
                title="Education"
                subtitle={withAttendanceDateSubtitle(`Education ${graphValueModes.education === "percentage" ? "percentage" : "count"} grouped by education column`, educationStats)}
                data={educationData}
                isLoading={educationLoading || educationFetching}
                valueMode={graphValueModes.education}
                onValueModeChange={(value) => setGraphValueMode("education", value)}
                filter={educationFilter}
                setFilter={setEducationFilter}
                departments={departments}
            />

            <ContractorPrefixChartCard
                title="Contractor"
                subtitle={withAttendanceDateSubtitle(`Contractor total headcount vs actual present grouped by users contractor column`, contractorPrefixStats)}
                data={contractorPrefixData}
                isLoading={contractorPrefixLoading || contractorPrefixFetching}
                valueMode={graphValueModes.contractorPrefix}
                onValueModeChange={(value) => setGraphValueMode("contractorPrefix", value)}
                filter={contractorPrefixFilter}
                setFilter={setContractorPrefixFilter}
                departments={departments}
            />

            <div className="w-full overflow-x-auto pb-2">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch min-w-[960px]">
                    <HighchartsPieCard
                        title="Skill Level Distribution"
                        subtitle={getPreviousAttendanceDateLabel(skillStats)}
                        data={skillPieData}
                        colors={SKILL_COLORS}
                        icon={Users}
                        filter={skillFilter}
                        setFilter={setSkillFilter}
                        departments={departments}
                        isLoading={skillLoading || skillFetching}
                        valueMode={graphValueModes.skill}
                        onValueModeChange={(value) => setGraphValueMode("skill", value)}
                        chartView={pieChartViews.skill}
                        onChartViewChange={(value) => setPieChartView("skill", value)}
                        straightXAxisLabels={true}
                    />

                    <HighchartsPieCard
                        title="Gender Distribution"
                        subtitle={getPreviousAttendanceDateLabel(genderStats)}
                        data={genderPieData.map(item => ({ ...item, name: item.name, value: item.value, attendanceValue: item.attendanceValue ?? item.value, masterValue: item.masterValue }))}
                        colors={GENDER_COLORS}
                        icon={Users}
                        filter={genderFilter}
                        setFilter={setGenderFilter}
                        departments={departments}
                        isLoading={genderLoading || genderFetching}
                        valueMode={graphValueModes.gender}
                        onValueModeChange={(value) => setGraphValueMode("gender", value)}
                        chartView={pieChartViews.gender}
                        onChartViewChange={(value) => setPieChartView("gender", value)}
                        straightXAxisLabels={true}
                    />
                </div>
            </div>

            <div className="flex items-center gap-4 my-2">
                <div className="flex-1 h-px bg-slate-200" />

                <div className="flex items-center gap-2 bg-blue-600 text-white text-[11px] font-bold px-5 py-2 rounded-full shadow-lg tracking-widest whitespace-nowrap uppercase">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Employee Tenure Analytics
                </div>

                <div className="flex-1 h-px bg-slate-200" />
            </div>

            <TenureFullWidthChart
                title="Attendance by Joining Date / Tenure"
                subtitle={`Present employee ${tenureValueModes.attendance === "percentage" ? "percentage" : "count"} · ${getTenureLabel(attendanceTenureBucket)} · ${getPreviousAttendanceDateLabel(tenureStats)}`}
                data={buildTenureData(tenureStats, "attendance", attendanceTenureBucket, tenureValueModes.attendance, customTenureRange)}
                color="#3b82f6"
                gradientId="attendanceTenureGrad"
                icon={UserCheck}
                isLoading={tenureLoading}
                chartType={chartTypes.attendanceTenure}
                onChartTypeChange={(value) => setChartType("attendanceTenure", value)}
                valueMode={tenureValueModes.attendance}
                onValueModeChange={(value) => setTenureValueMode("attendance", value)}
                filter={tenureFilter}
                setFilter={setTenureFilter}
                departments={departments}
                tenureBucket={attendanceTenureBucket}
                setTenureBucket={setAttendanceTenureBucket}
                customTenureRange={customTenureRange}
                setCustomTenureRange={setCustomTenureRange}
                holidayAware={true}
            />

            <div className="grid grid-cols-1 gap-4 items-stretch">
                <TenureFullWidthChart
                    title="Attrition by Joining Date / Tenure"
                    subtitle={`Left employees ${tenureValueModes.attrition === "percentage" ? "percentage" : "count"} · ${getTenureLabel(attritionTenureBucket)} · ${getPreviousAttendanceDateLabel(tenureStats)}`}
                    data={buildTenureData(tenureStats, "attrition", attritionTenureBucket, tenureValueModes.attrition, customTenureRange)}
                    color="#2563eb"
                    gradientId="attritionTenureGrad"
                    icon={UserX}
                    isLoading={tenureLoading}
                    chartType={chartTypes.attritionTenure}
                    onChartTypeChange={(value) => setChartType("attritionTenure", value)}
                    valueMode={tenureValueModes.attrition}
                    onValueModeChange={(value) => setTenureValueMode("attrition", value)}
                    filter={tenureFilter}
                    setFilter={setTenureFilter}
                    departments={departments}
                    tenureBucket={attritionTenureBucket}
                    setTenureBucket={setAttritionTenureBucket}
                    customTenureRange={customTenureRange}
                    setCustomTenureRange={setCustomTenureRange}
                    showMasterComparison={false}
                    showShiftFilter={false}
                />

                <TenureFullWidthChart
                    title="Absenteeism by Joining Date / Tenure"
                    subtitle={`Absent employee ${tenureValueModes.absenteeism === "percentage" ? "percentage" : "count"} · ${getTenureLabel(absenteeismTenureBucket)} · ${getPreviousAttendanceDateLabel(tenureStats)}`}
                    data={buildTenureData(tenureStats, "absenteeism", absenteeismTenureBucket, tenureValueModes.absenteeism, customTenureRange)}
                    color="#2563eb"
                    gradientId="absenteeismTenureGrad"
                    icon={TrendingDown}
                    isLoading={tenureLoading}
                    chartType={chartTypes.absenteeismTenure}
                    onChartTypeChange={(value) => setChartType("absenteeismTenure", value)}
                    valueMode={tenureValueModes.absenteeism}
                    onValueModeChange={(value) => setTenureValueMode("absenteeism", value)}
                    filter={tenureFilter}
                    setFilter={setTenureFilter}
                    departments={departments}
                    tenureBucket={absenteeismTenureBucket}
                    setTenureBucket={setAbsenteeismTenureBucket}
                    customTenureRange={customTenureRange}
                    setCustomTenureRange={setCustomTenureRange}
                    showMasterComparison={false}
                    showShiftFilter={false}
                />
            </div>

            {/* Employee Master Graphs are always shown */}

            {showEmployeeMasterGraphs && (
                <div className="w-full space-y-4 pb-2">
                    <div className="grid grid-cols-1 gap-4 items-stretch w-full">
                        <HighchartsPieCard
                            title="State Distribution"
                            subtitle={getPreviousAttendanceDateLabel(stateStats)}
                            data={statePieData.map(item => ({ ...item, name: item.name, value: item.value, attendanceValue: item.attendanceValue ?? item.value, masterValue: item.masterValue }))}
                            colors={STATE_COLORS}
                            icon={Map}
                            filter={stateFilter}
                            setFilter={setStateFilter}
                            departments={departments}
                            isLoading={stateLoading || stateFetching}
                            extraFilters={
                                <MasterDropdownFilter
                                    label="State"
                                    value={selectedMasterState}
                                    onChange={(value) => {
                                        setSelectedMasterState(normalizeMultiValue(value));
                                        setSelectedMasterDistrict(["ALL"]);
                                    }}
                                    options={stateOptions}
                                />
                            }
                            valueMode={graphValueModes.state}
                            onValueModeChange={(value) => setGraphValueMode("state", value)}
                            chartView={pieChartViews.state}
                            onChartViewChange={(value) => setPieChartView("state", value)}
                            straightXAxisLabels={true}
                        />

                        <HighchartsPieCard
                            title="District Distribution"
                            subtitle={getPreviousAttendanceDateLabel(districtStats)}
                            data={districtPieData.map(item => ({ ...item, name: item.name, value: item.value, attendanceValue: item.attendanceValue ?? item.value, masterValue: item.masterValue }))}
                            colors={DISTRICT_COLORS}
                            icon={MapPin}
                            filter={districtFilter}
                            setFilter={setDistrictFilter}
                            departments={departments}
                            isLoading={districtLoading || districtFetching}
                            extraFilters={
                                <MasterDropdownFilter
                                    label="District"
                                    value={selectedMasterDistrict}
                                    onChange={(value) => setSelectedMasterDistrict(normalizeMultiValue(value))}
                                    options={districtOptions}
                                />
                            }
                            valueMode={graphValueModes.district}
                            onValueModeChange={(value) => setGraphValueMode("district", value)}
                            chartView={pieChartViews.district}
                            onChartViewChange={(value) => setPieChartView("district", value)}
                            straightXAxisLabels={true}
                        />

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch w-full">
                            <HighchartsPieCard
                                title="Male / Female Distribution"
                                subtitle={getPreviousAttendanceDateLabel(employeeGenderStats)}
                                data={employeeGenderPieData.map(item => ({ ...item, name: item.name, value: item.value, attendanceValue: item.attendanceValue ?? item.value, masterValue: item.masterValue }))}
                                colors={GENDER_COLORS}
                                icon={Users}
                                filter={employeeGenderFilter}
                                setFilter={setEmployeeGenderFilter}
                                departments={departments}
                                isLoading={employeeGenderLoading || employeeGenderFetching}
                                valueMode={graphValueModes.employeeGender}
                                onValueModeChange={(value) => setGraphValueMode("employeeGender", value)}
                                chartView={pieChartViews.employeeGender}
                                onChartViewChange={(value) => setPieChartView("employeeGender", value)}
                                straightXAxisLabels={true}
                            />
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
};

export default DashboardHome;