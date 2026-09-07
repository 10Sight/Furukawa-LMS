import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetLeftUsersReasonTrendQuery } from '@/Redux/AllApi/AdminHomeApi';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetAllSectionsQuery } from '@/Redux/AllApi/SectionApi';
import { useGetLinesQuery } from '@/Redux/AllApi/LineApi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { IconUserX, IconCalendar, IconRefresh, IconChevronDown, IconTrendingDown } from "@tabler/icons-react";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import useTranslate from "@/hooks/useTranslate";
import { useIsTablet, useIsMobile } from "@/hooks/useIsTablet";

// Formats a Date using local calendar fields, avoiding the UTC day-shift toISOString() causes in IST.
const formatDate = (date) => {
    if (!date || isNaN(date)) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const _now        = new Date();
const CURRENT_YEAR = _now.getFullYear();
const MONTH_END    = formatDate(new Date(_now.getFullYear(), _now.getMonth() + 1, 0));

// Default under-the-hood date range per timeframe, used when the visible inputs are left blank.
const getDefaultDates = (timeframe) => {
    const now = new Date();
    if (timeframe === 'daily') {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastOfMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
            rawStart: formatDate(firstOfMonth),
            rawEnd:   formatDate(lastOfMonth),
        };
    }
    if (timeframe === 'monthly') {
        const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        return {
            rawStart: `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}`,
            rawEnd:   `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        };
    }
    return {
        rawStart: String(now.getFullYear() - 4),
        rawEnd:   String(now.getFullYear()),
    };
};

// Convert raw filter inputs to ISO date strings for the API.
const toApiDates = (timeframe, rawStart, rawEnd) => {
    if (!rawStart || !rawEnd) {
        const defaults = getDefaultDates(timeframe);
        rawStart = rawStart || defaults.rawStart;
        rawEnd   = rawEnd   || defaults.rawEnd;
    }

    if (timeframe === 'monthly') {
        const [ey, em] = rawEnd.split('-').map(Number);
        const lastDay = new Date(ey, em, 0).getDate();
        return {
            startDate: `${rawStart}-01`,
            endDate: `${rawEnd}-${String(lastDay).padStart(2, '0')}`,
        };
    }
    if (timeframe === 'yearly') {
        return {
            startDate: `${rawStart}-01-01`,
            endDate: `${rawEnd}-12-31`,
        };
    }
    return { startDate: rawStart, endDate: rawEnd };
};

const localeMap = { en: 'en-US', hi: 'hi-IN', ja: 'ja-JP', zh: 'zh-CN', ru: 'ru-RU' };

const formatPeriodLabel = (period, groupBy, language = 'en') => {
    if (!period) return '';
    if (groupBy === 'yearly') return period;
    const locale = localeMap[language] || 'en-US';
    if (groupBy === 'daily') {
        return new Date(`${period}T00:00:00`).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
    }
    const [year, month] = period.split('-');
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(locale, { month: 'short', year: 'numeric' });
};

const INPUT_CONFIG = {
    daily:   { type: 'date',   min: '2020-01-01', max: MONTH_END,            placeholder: 'YYYY-MM-DD' },
    monthly: { type: 'month',  min: '2020-01',    max: `${CURRENT_YEAR}-12`, placeholder: 'YYYY-MM' },
    yearly:  { type: 'number', min: 2020,         max: CURRENT_YEAR, step: 1, placeholder: 'YYYY' },
};

// Accessible, distinct palette cycled across leaving reasons; "Not Specified" always renders grey.
const REASON_COLORS = ['#3b82f6', '#f97316', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#ef4444', '#6366f1', '#22c55e'];
const NOT_SPECIFIED_COLOR = '#94a3b8';
const colorForReason = (reason, idx) => reason === 'Not Specified' ? NOT_SPECIFIED_COLOR : REASON_COLORS[idx % REASON_COLORS.length];

const aboveBarLabels = {
    enabled: true,
    formatter() { return this.y > 0 ? this.y : ''; },
    rotation: 0,
    allowOverlap: true,
    style: { fontSize: '14px', fontWeight: '900', color: '#1e293b', textOutline: '2px white' },
    verticalAlign: 'top',
    align: 'center',
    y: -20,
};

const insideSegmentLabels = {
    enabled: true,
    formatter() { return this.y > 0 ? this.y : ''; },
    rotation: 0,
    allowOverlap: true,
    style: { fontSize: '12px', fontWeight: '900', color: '#ffffff', textOutline: 'none' },
    verticalAlign: 'middle',
    align: 'center',
    inside: true,
};

const stackLabelsAboveBar = {
    enabled: true,
    formatter() { return this.total > 0 ? this.total : ''; },
    allowOverlap: true,
    style: { fontSize: '14px', fontWeight: '900', color: '#1e293b', textOutline: '2px white' },
};

const wrapReasonLabel = (str, maxCharsPerLine = 12) => {
    if (!str) return '';
    const words = str.split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
        if (!cur) {
            cur = word;
        } else if ((cur + ' ' + word).length <= maxCharsPerLine) {
            cur += ' ' + word;
        } else {
            lines.push(cur);
            cur = word;
        }
    }
    if (cur) lines.push(cur);
    return lines
        .map(line => `<span style="color:#334155;font-weight:700;font-size:12px;line-height:1.25">${line}</span>`)
        .join('<br/>');
};

const basePlotOptions = {
    column: {
        borderRadius: 4,
        borderWidth: 0,
        groupPadding: 0.2,
        maxPointWidth: 36,
    },
};

const LeftUsersLeavingReasonChart = ({ departments: departmentsProp } = {}) => {
    const { t, language } = useTranslate();
    const isTablet = useIsTablet();
    const isMobile = useIsMobile();

    const [candidateType, setCandidateType] = useState('dojo');
    const [viewMode,      setViewMode]      = useState('reason');
    const [timeframe,     setTimeframe]     = useState('monthly');
    const [rawStart,      setRawStart]      = useState('');
    const [rawEnd,        setRawEnd]        = useState('');
    const [selectedDepts,    setSelectedDepts]    = useState([]);
    const [selectedSections, setSelectedSections] = useState([]);
    const [selectedLines,    setSelectedLines]    = useState([]);

    const { data: deptsData } = useGetAllDepartmentsQuery(undefined, { skip: !!departmentsProp });
    const departments = departmentsProp ?? (deptsData?.data?.departments || []);
    const { data: sectionsData } = useGetAllSectionsQuery();
    const allSections = useMemo(() => sectionsData?.data || [], [sectionsData]);
    const { data: linesData } = useGetLinesQuery();
    const allLines = useMemo(() => linesData?.data || [], [linesData]);

    // Cascading options: sections narrow to selected departments; lines narrow to selected sections
    // (or, absent a section pick, to any line under a selected department — lines carry their own
    // `department` column directly, same one line.controller.js filters on).
    const availableSections = useMemo(() => {
        if (selectedDepts.length === 0) return allSections;
        return allSections.filter(s => selectedDepts.includes(String(s.departmentId)));
    }, [allSections, selectedDepts]);

    const availableLines = useMemo(() => {
        if (selectedSections.length > 0) {
            return allLines.filter(l => selectedSections.includes(String(l.sectionId)));
        }
        if (selectedDepts.length > 0) {
            return allLines.filter(l => selectedDepts.includes(String(l.department)));
        }
        return allLines;
    }, [allLines, selectedSections, selectedDepts]);

    const { startDate, endDate } = useMemo(
        () => toApiDates(timeframe, rawStart, rawEnd),
        [timeframe, rawStart, rawEnd]
    );

    const { data, isLoading, error } = useGetLeftUsersReasonTrendQuery({
        groupBy: timeframe,
        startDate,
        endDate,
        candidateType,
        departmentId: selectedDepts.length > 0 ? selectedDepts.join(',') : '',
        sectionId: selectedSections.length > 0 ? selectedSections.join(',') : '',
        lineId: selectedLines.length > 0 ? selectedLines.join(',') : '',
    });

    const rawTrend   = useMemo(() => data?.data?.trend || [], [data]);
    const groupBy    = data?.data?.groupBy     || timeframe;
    const reasonsList = data?.data?.reasonsList || [];
    const summary    = data?.data?.summary     || {};

    const currentPeriodKey = useMemo(() => {
        const now = new Date();
        if (groupBy === 'daily') return formatDate(now);
        if (groupBy === 'monthly') return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return String(now.getFullYear());
    }, [groupBy]);

    const todaySlotIdx = rawTrend.findIndex(r => r.period === currentPeriodKey);

    const categories = useMemo(() => rawTrend.map(r => {
        const label = formatPeriodLabel(r.period, groupBy, language);
        const isToday = r.period === currentPeriodKey;
        return isToday
            ? `<span style="color:#2563eb;font-size:14px;font-weight:900;text-decoration:underline">${label}</span>`
            : `<span style="color:#64748b;font-size:14px;font-weight:800">${label}</span>`;
    }), [rawTrend, groupBy, language, currentPeriodKey]);

    const totalSeries = useMemo(() => rawTrend.map(r => Number(r.total) || 0), [rawTrend]);
    const grandTotal  = summary.totalLeft ?? totalSeries.reduce((a, b) => a + b, 0);

    const handleTimeframeChange = (tf) => {
        setTimeframe(tf);
        setRawStart('');
        setRawEnd('');
    };

    const handleReset = () => {
        setTimeframe('monthly');
        setRawStart('');
        setRawEnd('');
        setSelectedDepts([]);
        setSelectedSections([]);
        setSelectedLines([]);
        setViewMode('reason');
    };

    const toggleInArray = (setter) => (id, checked) =>
        setter(prev => checked ? [...prev, id] : prev.filter(x => x !== id));

    const toggleDept = toggleInArray(setSelectedDepts);
    const toggleSection = toggleInArray(setSelectedSections);
    const toggleLine = toggleInArray(setSelectedLines);

    // Picking a department drops any section/line selections that no longer belong to it;
    // picking a section drops any line selection that no longer belongs to it.
    const onDeptToggle = (id, checked) => {
        toggleDept(id, checked);
        if (!checked) {
            const deptSectionIds = allSections.filter(s => String(s.departmentId) === id).map(s => String(s.id));
            setSelectedSections(prev => prev.filter(sid => !deptSectionIds.includes(sid)));
        }
    };
    const onSectionToggle = (id, checked) => {
        toggleSection(id, checked);
        if (!checked) {
            setSelectedLines(prev => prev.filter(lid => {
                const line = allLines.find(l => String(l.id) === lid);
                return line ? String(line.sectionId) !== id : true;
            }));
        }
    };

    const deptLabel = selectedDepts.length === 0
        ? t('charts.allDepartments')
        : selectedDepts.length === 1
            ? (departments.find(d => String(d.id ?? d._id) === selectedDepts[0])?.name ?? '1 Dept')
            : `${selectedDepts.length} ${t('nav.departments')}`;

    const sectionLabel = selectedSections.length === 0
        ? t('charts.allSections')
        : selectedSections.length === 1
            ? (allSections.find(s => String(s.id) === selectedSections[0])?.name ?? '1 Section')
            : `${selectedSections.length} ${t('charts.sections')}`;

    const lineLabel = selectedLines.length === 0
        ? t('charts.allLines')
        : selectedLines.length === 1
            ? (allLines.find(l => String(l.id) === selectedLines[0])?.name ?? '1 Line')
            : `${selectedLines.length} ${t('charts.lines')}`;

    // ── Reason Breakdown Flattening ──────────────────────────────────────────
    // Each active reason on each period gets its own separate column slot.
    // Both the wrapped reason name and the date label are rendered in a shared flex container,
    // ensuring the date label always sits beneath the reason without overlapping.
    // Dashed vertical divider lines separate different dates/periods.
    const { flatCategories, flatData, dateGroups, reasonTodaySlotIdx } = useMemo(() => {
        if (!rawTrend.length) return { flatCategories: [], flatData: [], dateGroups: [], reasonTodaySlotIdx: -1 };

        const cats = [];
        const data = [];
        const groups = [];
        let idx = 0;
        let todayIdx = -1;

        rawTrend.forEach(r => {
            const dateLabel = formatPeriodLabel(r.period, groupBy, language);
            const isToday = r.period === currentPeriodKey;
            const start = idx;

            // Find reasons with count > 0 for this period
            const reasonsPresent = (reasonsList || []).filter(reason => (Number(r.reasons?.[reason]) || 0) > 0);

            if (reasonsPresent.length === 0) {
                if (isToday && todayIdx === -1) todayIdx = idx;
                const dateLine = isToday
                    ? `<span style="color:#2563eb;font-weight:900;font-size:13px;text-decoration:underline">${dateLabel}</span>`
                    : `<span style="color:#64748b;font-weight:800;font-size:13px">${dateLabel}</span>`;

                cats.push(
                    `<div style="display:flex;flex-direction:column;align-items:center;justify-content:space-between;min-height:85px">` +
                    `<div style="color:#94a3b8;font-size:12px;font-style:italic">—</div>` +
                    `<div style="margin-top:auto;padding-top:6px;text-align:center">${dateLine}</div>` +
                    `</div>`
                );
                data.push({
                    y: null,
                    custom: { reason: '', dateLabel, period: r.period },
                });
                groups.push({ period: r.period, dateLabel, isToday, start: idx, end: idx });
                idx += 1;
            } else {
                const N = reasonsPresent.length;
                const midIdx = Math.floor((N - 1) / 2);

                reasonsPresent.forEach((reason, rIdx) => {
                    if (isToday && todayIdx === -1) todayIdx = idx;
                    const y = Number(r.reasons?.[reason]) || 0;
                    const isDateSlot = rIdx === midIdx;

                    const topHtml = wrapReasonLabel(reason);
                    const dateLine = isDateSlot
                        ? (isToday
                            ? `<span style="color:#2563eb;font-size:13px;font-weight:900;display:inline-block;margin-top:8px;text-decoration:underline">${dateLabel}</span>`
                            : `<span style="color:#64748b;font-size:13px;font-weight:800;display:inline-block;margin-top:8px">${dateLabel}</span>`)
                        : `<span style="visibility:hidden;font-size:13px;display:inline-block;margin-top:8px">${dateLabel}</span>`;

                    cats.push(
                        `<div style="display:flex;flex-direction:column;align-items:center;justify-content:space-between;min-height:85px">` +
                        `<div style="text-align:center">${topHtml}</div>` +
                        `<div style="margin-top:auto;padding-top:6px;text-align:center">${dateLine}</div>` +
                        `</div>`
                    );

                    data.push({
                        y,
                        custom: { reason, dateLabel, period: r.period },
                    });
                    idx += 1;
                });
                groups.push({ period: r.period, dateLabel, isToday, start, end: idx - 1 });
            }
        });

        return { flatCategories: cats, flatData: data, dateGroups: groups, reasonTodaySlotIdx: todayIdx };
    }, [rawTrend, reasonsList, groupBy, language, currentPeriodKey]);

    // Dashed vertical lines separating different date groups
    const groupPlotLines = useMemo(() => dateGroups.slice(1).map(g => ({
        value: g.start - 0.5,
        color: '#cbd5e1',
        width: 1,
        dashStyle: 'Dash',
        zIndex: 3,
    })), [dateGroups]);

    // ── Highcharts options: By Reason ─────────────────────────────────────────
    const REASON_SLOT_WIDTH = 80;
    const reasonNeedsScroll = flatCategories.length * REASON_SLOT_WIDTH > 800;
    const reasonScrollMinWidth = reasonNeedsScroll ? flatCategories.length * REASON_SLOT_WIDTH : undefined;

    const reasonScrollPositionX = useMemo(() => {
        if (!reasonNeedsScroll || reasonTodaySlotIdx === -1) return 1;
        const viewportWidth = 800;
        const targetPx = reasonTodaySlotIdx * REASON_SLOT_WIDTH;
        const maxScrollPx = (flatCategories.length * REASON_SLOT_WIDTH) - viewportWidth;
        if (maxScrollPx <= 0) return 1;
        const centeredPx = targetPx - (viewportWidth / 2);
        return Math.max(0, Math.min(1, centeredPx / maxScrollPx));
    }, [reasonNeedsScroll, reasonTodaySlotIdx, flatCategories.length]);

    const reasonSeries = useMemo(() => [{
        type: 'column',
        name: t('charts.leftEmployees'),
        data: flatData,
        color: '#ef4444',
    }], [flatData, t]);

    const reasonOptions = useMemo(() => ({
        chart: {
            type: 'column',
            backgroundColor: 'transparent',
            height: 440,
            marginBottom: reasonNeedsScroll ? 140 : 115,
            marginTop: 40,
            style: { fontFamily: 'inherit' },
            animation: false,
            ...(reasonNeedsScroll && {
                scrollablePlotArea: {
                    minWidth: reasonScrollMinWidth,
                    scrollPositionX: reasonScrollPositionX,
                    opacity: 1,
                },
            }),
        },
        title: { text: '' },
        credits: { enabled: false },
        xAxis: {
            categories: flatCategories,
            crosshair: true,
            lineWidth: 1,
            lineColor: '#e2e8f0',
            labels: {
                useHTML: true,
                rotation: 0,
                align: 'center',
                y: 16,
                style: { textAlign: 'center' },
            },
            gridLineWidth: 0,
            plotLines: groupPlotLines,
        },
        yAxis: {
            min: 0,
            allowDecimals: false,
            title: { text: t('charts.leftEmployees'), style: { color: '#94a3b8', fontSize: '14px', fontWeight: 'bold' } },
            labels: { style: { fontSize: '13px', fontWeight: 'bold' } },
            gridLineColor: '#f1f5f9',
        },
        legend: { enabled: false },
        tooltip: {
            useHTML: true,
            style: { fontSize: '13px' },
            formatter() {
                const { reason, dateLabel } = this.point?.custom || {};
                if (this.y === null || this.y === undefined) {
                    return `<b>${dateLabel || ''}</b>: ${t('charts.noLeavingData') || 'No Leavers'}`;
                }
                return (
                    `<b style="font-size:14px;color:#0f172a">${reason || ''}</b><br/>` +
                    `<span style="color:#64748b">Date:</span> <b>${dateLabel || ''}</b><br/>` +
                    `<span style="color:#ef4444">●</span> ${t('charts.leftEmployees')}: <b>${this.y}</b>`
                );
            },
        },
        plotOptions: {
            column: {
                animation: false,
                borderRadius: 4,
                borderWidth: 0,
                pointPadding: 0.05,
                groupPadding: 0.15,
                maxPointWidth: 38,
                dataLabels: {
                    enabled: true,
                    formatter() { return (this.y === null || this.y === undefined || this.y === 0) ? '' : String(this.y); },
                    style: { fontSize: '13px', fontWeight: '900', color: '#1e293b', textOutline: '2px white' },
                    verticalAlign: 'top',
                    align: 'center',
                    y: -18,
                    allowOverlap: true,
                },
            },
        },
        responsive: {
            rules: [
                {
                    condition: { minWidth: 768, maxWidth: 1024 },
                    chartOptions: { chart: { height: 500 } },
                },
                {
                    condition: { maxWidth: 767 },
                    chartOptions: { chart: { height: 360 } },
                },
            ],
        },
        series: reasonSeries,
    }), [flatCategories, reasonSeries, groupPlotLines, reasonNeedsScroll, reasonScrollMinWidth, reasonScrollPositionX, t]);

    // ── Highcharts options: Total ─────────────────────────────────────────────
    const TOTAL_SLOT_WIDTH = 72;
    const totalNeedsScroll = categories.length * TOTAL_SLOT_WIDTH > 800;
    const totalScrollMinWidth = totalNeedsScroll ? categories.length * TOTAL_SLOT_WIDTH : undefined;

    const totalScrollPositionX = useMemo(() => {
        if (!totalNeedsScroll || todaySlotIdx === -1) return 1;
        const viewportWidth = 800;
        const targetPx = todaySlotIdx * TOTAL_SLOT_WIDTH;
        const maxScrollPx = (categories.length * TOTAL_SLOT_WIDTH) - viewportWidth;
        if (maxScrollPx <= 0) return 1;
        const centeredPx = targetPx - (viewportWidth / 2);
        return Math.max(0, Math.min(1, centeredPx / maxScrollPx));
    }, [totalNeedsScroll, todaySlotIdx, categories.length]);

    const totalPlotLines = useMemo(() => categories.slice(1).map((_, i) => ({
        value: i + 0.5,
        color: '#cbd5e1',
        width: 1,
        dashStyle: 'Dash',
        zIndex: 3,
    })), [categories]);

    const totalOptions = useMemo(() => ({
        chart: {
            backgroundColor: 'transparent',
            height: 380,
            style: { fontFamily: 'inherit' },
            animation: false,
            marginBottom: totalNeedsScroll ? 75 : 45,
            ...(totalNeedsScroll && {
                scrollablePlotArea: {
                    minWidth: totalScrollMinWidth,
                    scrollPositionX: totalScrollPositionX,
                },
            }),
        },
        title: { text: '' },
        credits: { enabled: false },
        xAxis: {
            categories,
            crosshair: true,
            plotLines: totalPlotLines,
            labels: {
                useHTML: true,
                style: { fontSize: '14px', fontWeight: 'bold', textAlign: 'center' },
                rotation: 0,
                align: 'center',
            },
        },
        yAxis: {
            min: 0,
            allowDecimals: false,
            title: { text: t('charts.leftEmployees'), style: { color: '#94a3b8', fontSize: '14px', fontWeight: 'bold' } },
            labels: { style: { fontSize: '13px', fontWeight: 'bold' } },
            gridLineColor: '#f1f5f9',
        },
        legend: { enabled: false },
        responsive: {
            rules: [
                {
                    condition: { minWidth: 768, maxWidth: 1024 },
                    chartOptions: { chart: { height: 500 } },
                },
                {
                    condition: { maxWidth: 767 },
                    chartOptions: { chart: { height: 320 } },
                },
            ],
        },
        plotOptions: {
            column: {
                ...basePlotOptions.column,
                dataLabels: aboveBarLabels,
            },
        },
        tooltip: {
            shared: true,
            useHTML: true,
            pointFormat: '<span style="color:{series.color}">●</span> {series.name}: <b>{point.y}</b>',
        },
        series: [{
            type: 'column',
            name: t('charts.leftEmployees'),
            data: totalSeries,
            color: '#ef4444',
        }],
    }), [categories, totalSeries, totalPlotLines, totalNeedsScroll, totalScrollMinWidth, totalScrollPositionX, t]);

    const cfg = INPUT_CONFIG[timeframe];
    const chartHeight = isTablet ? 500 : isMobile ? 360 : 440;

    return (
        <Card className="col-span-2">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <IconUserX className="h-5 w-5 text-red-600" />
                            {t('charts.leftUsersReasonTrend')}
                        </CardTitle>
                        <CardDescription>
                            {t('charts.leftUsersReasonTrendDesc')}
                        </CardDescription>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                        {/* Candidate type tabs */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant={candidateType === 'dojo' ? 'default' : 'outline'}
                                size="sm"
                                className="h-8 px-3 text-xs"
                                onClick={() => setCandidateType('dojo')}
                            >
                                {t('charts.dojoCandidates')}
                            </Button>
                            <Button
                                variant={candidateType === 'operator' ? 'default' : 'outline'}
                                size="sm"
                                className="h-8 px-3 text-xs"
                                onClick={() => setCandidateType('operator')}
                            >
                                {t('charts.operators')}
                            </Button>
                        </div>
                        {/* By Reason / Total toggle */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant={viewMode === 'reason' ? 'default' : 'outline'}
                                size="sm"
                                className="h-8 px-3 text-xs"
                                onClick={() => setViewMode('reason')}
                            >
                                {t('charts.byReason')}
                            </Button>
                            <Button
                                variant={viewMode === 'total' ? 'default' : 'outline'}
                                size="sm"
                                className="h-8 px-3 text-xs"
                                onClick={() => setViewMode('total')}
                            >
                                {t('charts.total')}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-end gap-4">

                    {/* Timeframe preset */}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {t('charts.timeframe')}
                        </Label>
                        <div className="flex gap-1">
                            {[
                                { key: 'daily',   label: t('charts.daily30d') },
                                { key: 'monthly', label: t('charts.monthly12m') },
                                { key: 'yearly',  label: t('charts.yearly5y') },
                            ].map(({ key, label }) => (
                                <Button
                                    key={key}
                                    variant={timeframe === key ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-8 px-3 text-xs"
                                    onClick={() => handleTimeframeChange(key)}
                                >
                                    {label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Custom From date */}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {t('charts.from')}
                        </Label>
                        <Input
                            type={cfg.type}
                            value={rawStart}
                            onChange={e => setRawStart(e.target.value)}
                            min={String(cfg.min)}
                            max={rawEnd || String(cfg.max)}
                            step={cfg.step}
                            placeholder={cfg.placeholder}
                            className="h-8 text-xs w-36"
                        />
                    </div>

                    {/* Custom To date */}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {t('charts.to')}
                        </Label>
                        <Input
                            type={cfg.type}
                            value={rawEnd}
                            onChange={e => setRawEnd(e.target.value)}
                            min={rawStart || String(cfg.min)}
                            max={String(cfg.max)}
                            step={cfg.step}
                            placeholder={cfg.placeholder}
                            className="h-8 text-xs w-36"
                        />
                    </div>

                    {/* Department */}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {t('nav.department')}
                        </Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 w-40 justify-between text-xs font-normal px-3">
                                    <span className="truncate">{deptLabel}</span>
                                    <IconChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-1" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2" align="start">
                                <div className="max-h-52 overflow-y-auto space-y-0.5">
                                    {departments.map(d => {
                                        const id = String(d.id ?? d._id);
                                        return (
                                            <label key={id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
                                                <Checkbox
                                                    checked={selectedDepts.includes(id)}
                                                    onCheckedChange={v => onDeptToggle(id, !!v)}
                                                    className="h-3.5 w-3.5"
                                                />
                                                <span className="text-xs truncate">{d.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {selectedDepts.length > 0 && (
                                    <button
                                        className="mt-2 w-full text-xs text-slate-400 hover:text-slate-700 text-center py-1 border-t border-slate-100"
                                        onClick={() => setSelectedDepts([])}
                                    >
                                        {t('charts.clearSelection')}
                                    </button>
                                )}
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Section */}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {t('charts.section')}
                        </Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 w-40 justify-between text-xs font-normal px-3">
                                    <span className="truncate">{sectionLabel}</span>
                                    <IconChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-1" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2" align="start">
                                <div className="max-h-52 overflow-y-auto space-y-0.5">
                                    {availableSections.length === 0 && (
                                        <p className="text-xs text-slate-400 px-2 py-1.5">{t('charts.noOptions')}</p>
                                    )}
                                    {availableSections.map(s => {
                                        const id = String(s.id);
                                        return (
                                            <label key={id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
                                                <Checkbox
                                                    checked={selectedSections.includes(id)}
                                                    onCheckedChange={v => onSectionToggle(id, !!v)}
                                                    className="h-3.5 w-3.5"
                                                />
                                                <span className="text-xs truncate">{s.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {selectedSections.length > 0 && (
                                    <button
                                        className="mt-2 w-full text-xs text-slate-400 hover:text-slate-700 text-center py-1 border-t border-slate-100"
                                        onClick={() => setSelectedSections([])}
                                    >
                                        {t('charts.clearSelection')}
                                    </button>
                                )}
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Line */}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {t('charts.line')}
                        </Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 w-40 justify-between text-xs font-normal px-3">
                                    <span className="truncate">{lineLabel}</span>
                                    <IconChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-1" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2" align="start">
                                <div className="max-h-52 overflow-y-auto space-y-0.5">
                                    {availableLines.length === 0 && (
                                        <p className="text-xs text-slate-400 px-2 py-1.5">{t('charts.noOptions')}</p>
                                    )}
                                    {availableLines.map(l => {
                                        const id = String(l.id);
                                        return (
                                            <label key={id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
                                                <Checkbox
                                                    checked={selectedLines.includes(id)}
                                                    onCheckedChange={v => toggleLine(id, !!v)}
                                                    className="h-3.5 w-3.5"
                                                />
                                                <span className="text-xs truncate">{l.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {selectedLines.length > 0 && (
                                    <button
                                        className="mt-2 w-full text-xs text-slate-400 hover:text-slate-700 text-center py-1 border-t border-slate-100"
                                        onClick={() => setSelectedLines([])}
                                    >
                                        {t('charts.clearSelection')}
                                    </button>
                                )}
                            </PopoverContent>
                        </Popover>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs text-slate-500 hover:text-slate-800 self-end"
                        onClick={handleReset}
                    >
                        <IconRefresh className="h-3.5 w-3.5 mr-1" />
                        {t('charts.reset')}
                    </Button>
                </div>
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <div style={{ height: chartHeight }} className="flex flex-col items-center justify-center gap-4">
                        <img src="/fme_transparent.png" alt="FME" className="w-20 h-20 object-contain animate-pulse" />
                        <p className="text-xs font-bold tracking-widest uppercase text-slate-400 animate-pulse">
                            {t('charts.loading')}
                        </p>
                    </div>
                ) : error ? (
                    <div style={{ height: chartHeight }} className="flex flex-col items-center justify-center text-red-500 gap-2">
                        <p className="text-sm font-semibold">{t('charts.failedToLoadLeavingTrend')}</p>
                    </div>
                ) : grandTotal === 0 ? (
                    <div style={{ height: chartHeight }} className="flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed gap-2">
                        <IconCalendar className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-medium">{t('charts.noLeavingData')}</p>
                        <p className="text-xs opacity-60">{t('charts.adjustFilters')}</p>
                    </div>
                ) : (
                    <>
                        <HighchartsReact
                            key={`${viewMode}-${candidateType}-${timeframe}-${startDate}-${endDate}-${selectedDepts.join(',')}-${selectedSections.join(',')}-${selectedLines.join(',')}`}
                            highcharts={Highcharts}
                            options={viewMode === 'total' ? totalOptions : reasonOptions}
                        />

                        {/* KPI Summary strip */}
                        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50">
                                <span className="text-xs font-bold text-red-700">{t('charts.totalLeft')}</span>
                                <span className="text-sm font-black text-red-900">{grandTotal}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                                <span className="text-xs font-bold text-slate-600 truncate mr-2">{t('charts.topReason')}</span>
                                <span className="text-sm font-black text-slate-800 text-right truncate">
                                    {summary.topReason ? `${summary.topReason.name} (${summary.topReason.percentage}%)` : '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-orange-50">
                                <span className="text-xs font-bold text-orange-700 flex items-center gap-1">
                                    <IconTrendingDown className="h-3.5 w-3.5" />
                                    {t('charts.highestAttritionPeriod')}
                                </span>
                                <span className="text-sm font-black text-orange-900">
                                    {summary.highestPeriod
                                        ? `${formatPeriodLabel(summary.highestPeriod.period, groupBy, language)} (${summary.highestPeriod.total})`
                                        : '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                                <span className="text-xs font-bold text-slate-500">
                                    {timeframe === 'daily' ? t('charts.daysTracked') : timeframe === 'monthly' ? t('charts.monthsTracked') : t('charts.yearsTracked')}
                                </span>
                                <span className="text-sm font-black text-slate-800">{summary.periodsTracked ?? rawTrend.length}</span>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default React.memo(LeftUsersLeavingReasonChart);
