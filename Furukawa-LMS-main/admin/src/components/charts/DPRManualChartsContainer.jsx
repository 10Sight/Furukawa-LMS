import React, { useState, useEffect, useRef } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { toast } from 'sonner';
import {
    Activity as IconActivity,
    Save as IconSave,
    BarChart2 as IconChart,
    X as IconX,
    CalendarRange as IconRange,
    Check,
    ChevronDown,
} from 'lucide-react';
import {
    useGetDPRManualStatsQuery,
    useGetDPRFilledDatesQuery,
    useSaveDPRManualStatsMutation,
} from '@/Redux/AllApi/DailyProductionReportApi';
import DPRCalendar from './DPRCalendar';

// ─── Chart card metadata ────────────────────────────────────────────────────
const CHARTS = [
    {
        key: 'srcEff',
        title: 'SRC Efficiency Performance',
        badge: 'SRC Dept',
        dot: 'bg-blue-500',
        badgeCls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
        btnCls: 'bg-blue-600 hover:bg-blue-700',
        saveLabel: 'Save SRC Efficiency',
    },
    {
        key: 'srcDef',
        title: 'SRC Defect Summary',
        badge: 'SRC Quality',
        dot: 'bg-emerald-500',
        badgeCls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
        btnCls: 'bg-emerald-600 hover:bg-emerald-700',
        saveLabel: 'Save SRC Defects',
    },
    {
        key: 'qaDef',
        title: 'Quality Defect Summary',
        badge: 'Quality QA',
        dot: 'bg-purple-500',
        badgeCls: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
        btnCls: 'bg-purple-600 hover:bg-purple-700',
        saveLabel: 'Save QA Defects',
    },
    {
        key: 'qaEff',
        title: 'Quality Efficiency Performance',
        badge: 'Quality Dept',
        dot: 'bg-pink-500',
        badgeCls: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
        btnCls: 'bg-pink-600 hover:bg-pink-700',
        saveLabel: 'Save QA Efficiency',
    },
];

// Formats a Date using local calendar fields, avoiding the UTC day-shift toISOString() causes in IST.
const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// ─── Main component ──────────────────────────────────────────────────────────
const DPRManualChartsContainer = ({ dashboardDate, theme }) => {
    const today = formatDate(new Date());

    const [selectedDate, setSelectedDate] = useState(dashboardDate || today);
    const [activeChart, setActiveChart] = useState(null);

    // Series visibility per chart
    const [selectedBars, setSelectedBars] = useState({
        srcEff: ['Actual Qty', 'Actual Defect', 'Target %'],
        srcDef: ['Defect PPM', 'Target PPM'],
        qaDef: ['Defect PPM', 'Target PPM'],
        qaEff: ['Actual Qty', 'Actual Defect', 'Target %'],
    });
    const [activeDropdown, setActiveDropdown] = useState(null);
    const dropdownRefs = useRef({});

    // Calendar view month/year (can differ from selectedDate's month)
    const [viewMonth, setViewMonth] = useState(() => new Date(dashboardDate || today).getMonth());
    const [viewYear, setViewYear] = useState(() => new Date(dashboardDate || today).getFullYear());

    // Date range filter
    const [filterMode, setFilterMode] = useState('7day'); // '7day' | 'custom'
    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');
    const [appliedFilter, setAppliedFilter] = useState(null); // null = 7day, else { start, end }

    // Sync with parent dashboard date
    useEffect(() => {
        if (dashboardDate) {
            setSelectedDate(dashboardDate);
            const d = new Date(dashboardDate);
            setViewMonth(d.getMonth());
            setViewYear(d.getFullYear());
        }
    }, [dashboardDate]);

    // Close active dropdown when clicking outside
    useEffect(() => {
        if (!activeDropdown) return;
        const handleClick = (e) => {
            const ref = dropdownRefs.current[activeDropdown];
            if (ref && !ref.contains(e.target)) setActiveDropdown(null);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [activeDropdown]);

    // Fetch trend + selected-date record — uses custom range when applied, else 7-day default
    const queryParams = appliedFilter
        ? { startDate: appliedFilter.start, endDate: appliedFilter.end }
        : { date: selectedDate };
    const { data: statsResp, isLoading, isFetching } = useGetDPRManualStatsQuery(
        queryParams,
        { skip: !selectedDate }
    );

    // Fetch filled dates for the current calendar month (only when a panel is open)
    const calendarMonthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    const { data: filledDatesResp } = useGetDPRFilledDatesQuery(
        { month: calendarMonthKey },
        { skip: !activeChart }
    );
    const filledDates = filledDatesResp?.data?.filledDates || [];

    const [saveManualStats, { isLoading: isSaving }] = useSaveDPRManualStatsMutation();

    // Form values (shared — one record per date covers all 4 charts)
    const [formValues, setFormValues] = useState({
        date: selectedDate,
        srcEffPlan: 0, srcEffActual: 0, srcEffTarget: 95.0,
        srcDefAuto: 0, srcDefManual: 0, srcDefJoint: 0, srcDefProduction: 0, srcDefTarget: 5.9,
        qaDefAuto: 0, qaDefManual: 0, qaDefJoint: 0, qaDefProduction: 0, qaDefTarget: 5.9,
        qaEffPlan: 0, qaEffActual: 0, qaEffTarget: 95.0,
    });

    // Populate form when API response arrives or date changes
    useEffect(() => {
        if (statsResp?.data?.selectedRecord) {
            const rec = statsResp.data.selectedRecord;
            setFormValues({
                date: selectedDate,
                srcEffPlan: rec.srcEffPlan ?? 0,
                srcEffActual: rec.srcEffActual ?? 0,
                srcEffTarget: rec.srcEffTarget ?? 95.0,
                srcDefAuto: rec.srcDefAuto ?? 0,
                srcDefManual: rec.srcDefManual ?? 0,
                srcDefJoint: rec.srcDefJoint ?? 0,
                srcDefProduction: rec.srcDefProduction ?? 0,
                srcDefTarget: rec.srcDefTarget ?? 5.9,
                qaDefAuto: rec.qaDefAuto ?? 0,
                qaDefManual: rec.qaDefManual ?? 0,
                qaDefJoint: rec.qaDefJoint ?? 0,
                qaDefProduction: rec.qaDefProduction ?? 0,
                qaDefTarget: rec.qaDefTarget ?? 5.9,
                qaEffPlan: rec.qaEffPlan ?? 0,
                qaEffActual: rec.qaEffActual ?? 0,
                qaEffTarget: rec.qaEffTarget ?? 95.0,
            });
        } else if (!statsResp?.data?.selectedRecord && !isLoading && !isFetching) {
            // No record for this date — reset to blanks
            setFormValues(prev => ({
                ...prev,
                date: selectedDate,
                srcEffPlan: 0, srcEffActual: 0, srcEffTarget: 95.0,
                srcDefAuto: 0, srcDefManual: 0, srcDefJoint: 0, srcDefProduction: 0, srcDefTarget: 5.9,
                qaDefAuto: 0, qaDefManual: 0, qaDefJoint: 0, qaDefProduction: 0, qaDefTarget: 5.9,
                qaEffPlan: 0, qaEffActual: 0, qaEffTarget: 95.0,
            }));
        }
    }, [statsResp, selectedDate]);

    const handleInput = (field, value) =>
        setFormValues(prev => ({ ...prev, [field]: value }));

    const handleSave = async () => {
        try {
            const res = await saveManualStats({ ...formValues, date: selectedDate }).unwrap();
            if (res?.success) toast.success('Statistics saved successfully!');
            else toast.error('Failed to save statistics.');
        } catch (err) {
            toast.error(err?.data?.message || 'Error saving statistics.');
        }
    };

    const handleDateSelect = (date) => {
        setSelectedDate(date);
        const d = new Date(date);
        setViewMonth(d.getMonth());
        setViewYear(d.getFullYear());
    };

    const handleMonthChange = (month, year) => {
        setViewMonth(month);
        setViewYear(year);
    };

    const toggleChart = (key) => {
        setActiveChart(prev => (prev === key ? null : key));
    };

    const toggleBar = (chartKey, name) => {
        setSelectedBars(prev => {
            const current = prev[chartKey];
            return {
                ...prev,
                [chartKey]: current.includes(name)
                    ? current.filter(n => n !== name)
                    : [...current, name],
            };
        });
    };

    const handleApplyRange = () => {
        if (!rangeStart || !rangeEnd) {
            toast.error('Please select both start and end dates.');
            return;
        }
        if (new Date(rangeStart) > new Date(rangeEnd)) {
            toast.error('Start date must be before end date.');
            return;
        }
        setAppliedFilter({ start: rangeStart, end: rangeEnd });
        // Move selected date to range end so form shows correct record
        setSelectedDate(rangeEnd);
        const d = new Date(rangeEnd);
        setViewMonth(d.getMonth());
        setViewYear(d.getFullYear());
    };

    const handleClearRange = () => {
        setAppliedFilter(null);
        setFilterMode('7day');
        setRangeStart('');
        setRangeEnd('');
    };

    // ── Calculated KPIs ────────────────────────────────────────────────────
    const srcCalculatedEff = formValues.srcEffPlan > 0
        ? Math.round((formValues.srcEffActual / formValues.srcEffPlan) * 1000) / 10 : 0;
    const srcTotalDefects = Number(formValues.srcDefAuto) + Number(formValues.srcDefManual) + Number(formValues.srcDefJoint);
    const srcPPM = formValues.srcDefProduction > 0
        ? Math.round((srcTotalDefects / formValues.srcDefProduction) * 10000000) / 10 : 0;
    const qaTotalDefects = Number(formValues.qaDefAuto) + Number(formValues.qaDefManual) + Number(formValues.qaDefJoint);
    const qaPPM = formValues.qaDefProduction > 0
        ? Math.round((qaTotalDefects / formValues.qaDefProduction) * 10000000) / 10 : 0;
    const qaCalculatedEff = formValues.qaEffPlan > 0
        ? Math.round((formValues.qaEffActual / formValues.qaEffPlan) * 1000) / 10 : 0;

    // ── Chart trend data ───────────────────────────────────────────────────
    const trend = statsResp?.data?.trend || [];
    const trendDates = trend.map(t => {
        const d = new Date(t.date);
        return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    });

    const chartTheme = {
        bg: 'transparent',
        text: theme?.text?.includes('dark') ? '#f1f5f9' : '#1e293b',
        grid: theme?.text?.includes('dark') ? '#334155' : '#e2e8f0',
    };

    const baseChart = (extra = {}) => ({
        chart: { backgroundColor: chartTheme.bg, height: 320, ...extra },
        title: { text: null },
        credits: { enabled: false },
        legend: { itemStyle: { color: chartTheme.text, fontSize: '12px' }, itemHoverStyle: { color: chartTheme.text } },
        xAxis: {
            categories: trendDates,
            labels: { style: { color: chartTheme.text, fontWeight: 'bold', fontSize: '12px' } },
            gridLineWidth: 0,
        },
        tooltip: { shared: true },
        plotOptions: {
            series: { marker: { enabled: false, states: { hover: { enabled: false } } } },
        },
    });

    const srcEffOptions = {
        ...baseChart({ type: 'column' }),
        yAxis: [
            { title: { text: 'Qty', style: { color: chartTheme.text, fontSize: '12px' } }, labels: { style: { color: chartTheme.text, fontSize: '12px' } }, gridLineColor: chartTheme.grid, min: 0 },
            { title: { text: 'Efficiency (%)', style: { color: chartTheme.text, fontSize: '12px' } }, labels: { style: { color: chartTheme.text, fontSize: '12px' } }, opposite: true, min: 0, max: 100, gridLineWidth: 0 },
        ],
        series: [
            { name: 'Planned Qty', type: 'column', data: trend.map(t => t.srcEffPlan), color: '#94a3b8', dataLabels: { enabled: true, format: '{y}', style: { fontSize: '11px' } } },
            { name: 'Actual Qty', type: 'column', data: trend.map(t => t.srcEffActual), color: '#3b82f6', dataLabels: { enabled: true, format: '{y}', style: { fontSize: '11px' } } },
            { name: 'Actual Defect', type: 'spline', yAxis: 1, data: trend.map(t => t.srcEffPlan > 0 ? Math.round((t.srcEffActual / t.srcEffPlan) * 1000) / 10 : 0), color: '#10b981', tooltip: { valueSuffix: '%' } },
            { name: 'Target %', type: 'spline', yAxis: 1, data: trend.map(t => t.srcEffTarget), color: '#ef4444', dashStyle: 'ShortDash', tooltip: { valueSuffix: '%' } },
        ],
    };

    const srcDefOptions = {
        ...baseChart(),
        yAxis: [
            { title: { text: 'Defect Qty', style: { color: chartTheme.text, fontSize: '12px' } }, labels: { style: { color: chartTheme.text, fontSize: '12px' } }, gridLineColor: chartTheme.grid, min: 0 },
            { title: { text: 'PPM', style: { color: '#f59e0b', fontSize: '12px' } }, labels: { style: { color: chartTheme.text, fontSize: '12px' } }, opposite: true, min: 0, gridLineWidth: 0 },
        ],
        series: [
            { name: 'Defect Auto', type: 'column', data: trend.map(t => t.srcDefAuto), color: '#f59e0b', dataLabels: { enabled: true, format: '{y}', style: { fontSize: '11px' } } },
            { name: 'Defect Manual', type: 'column', data: trend.map(t => t.srcDefManual), color: '#3b82f6', dataLabels: { enabled: true, format: '{y}', style: { fontSize: '11px' } } },
            { name: 'Defect Joint', type: 'column', data: trend.map(t => t.srcDefJoint), color: '#10b981', dataLabels: { enabled: true, format: '{y}', style: { fontSize: '11px' } } },
            { name: 'Defect PPM', type: 'spline', yAxis: 1, data: trend.map(t => { const td = Number(t.srcDefAuto || 0) + Number(t.srcDefManual || 0) + Number(t.srcDefJoint || 0); return t.srcDefProduction > 0 ? Math.round((td / t.srcDefProduction) * 1000000) : 0; }), color: '#8b5cf6', tooltip: { valueSuffix: ' PPM' } },
            { name: 'Target PPM', type: 'spline', yAxis: 1, data: trend.map(t => t.srcDefTarget), color: '#ef4444', dashStyle: 'ShortDash', tooltip: { valueSuffix: ' PPM' } },
        ],
    };

    const qaDefOptions = {
        ...baseChart(),
        yAxis: [
            { title: { text: 'Defect Qty', style: { color: chartTheme.text, fontSize: '12px' } }, labels: { style: { color: chartTheme.text, fontSize: '12px' } }, gridLineColor: chartTheme.grid, min: 0 },
            { title: { text: 'PPM', style: { color: '#f59e0b', fontSize: '12px' } }, labels: { style: { color: chartTheme.text, fontSize: '12px' } }, opposite: true, min: 0, gridLineWidth: 0 },
        ],
        series: [
            { name: 'Defect Auto', type: 'column', data: trend.map(t => t.qaDefAuto), color: '#f59e0b', dataLabels: { enabled: true, format: '{y}', style: { fontSize: '11px' } } },
            { name: 'Defect Manual', type: 'column', data: trend.map(t => t.qaDefManual), color: '#3b82f6', dataLabels: { enabled: true, format: '{y}', style: { fontSize: '11px' } } },
            { name: 'Defect Joint', type: 'column', data: trend.map(t => t.qaDefJoint), color: '#10b981', dataLabels: { enabled: true, format: '{y}', style: { fontSize: '11px' } } },
            { name: 'Defect PPM', type: 'spline', yAxis: 1, data: trend.map(t => { const td = Number(t.qaDefAuto || 0) + Number(t.qaDefManual || 0) + Number(t.qaDefJoint || 0); return t.qaDefProduction > 0 ? Math.round((td / t.qaDefProduction) * 1000000) : 0; }), color: '#8b5cf6', tooltip: { valueSuffix: ' PPM' } },
            { name: 'Target PPM', type: 'spline', yAxis: 1, data: trend.map(t => t.qaDefTarget), color: '#ef4444', dashStyle: 'ShortDash', tooltip: { valueSuffix: ' PPM' } },
        ],
    };

    const qaEffOptions = {
        ...baseChart({ type: 'column' }),
        yAxis: [
            { title: { text: 'Qty', style: { color: chartTheme.text, fontSize: '12px' } }, labels: { style: { color: chartTheme.text, fontSize: '12px' } }, gridLineColor: chartTheme.grid, min: 0 },
            { title: { text: 'Efficiency (%)', style: { color: chartTheme.text, fontSize: '12px' } }, labels: { style: { color: chartTheme.text, fontSize: '12px' } }, opposite: true, min: 0, max: 100, gridLineWidth: 0 },
        ],
        series: [
            { name: 'Planned Qty', type: 'column', data: trend.map(t => t.qaEffPlan), color: '#94a3b8', dataLabels: { enabled: true, format: '{y}', style: { fontSize: '11px' } } },
            { name: 'Actual Qty', type: 'column', data: trend.map(t => t.qaEffActual), color: '#ec4899', dataLabels: { enabled: true, format: '{y}', style: { fontSize: '11px' } } },
            { name: 'Actual Defect', type: 'spline', yAxis: 1, data: trend.map(t => t.qaEffPlan > 0 ? Math.round((t.qaEffActual / t.qaEffPlan) * 1000) / 10 : 0), color: '#8b5cf6', tooltip: { valueSuffix: '%' } },
            { name: 'Target %', type: 'spline', yAxis: 1, data: trend.map(t => t.qaEffTarget), color: '#ef4444', dashStyle: 'ShortDash', tooltip: { valueSuffix: '%' } },
        ],
    };

    const ALL_SERIES = {
        srcEff: ['Planned Qty', 'Actual Qty', 'Actual Defect', 'Target %'],
        srcDef: ['Defect Auto', 'Defect Manual', 'Defect Joint', 'Defect PPM', 'Target PPM'],
        qaDef: ['Defect Auto', 'Defect Manual', 'Defect Joint', 'Defect PPM', 'Target PPM'],
        qaEff: ['Planned Qty', 'Actual Qty', 'Actual Defect', 'Target %'],
    };

    const filterSeries = (series, key) =>
        series.filter(s => selectedBars[key].includes(s.name));

    const chartOptions = {
        srcEff: { ...srcEffOptions, series: filterSeries(srcEffOptions.series, 'srcEff') },
        srcDef: { ...srcDefOptions, series: filterSeries(srcDefOptions.series, 'srcDef') },
        qaDef: { ...qaDefOptions, series: filterSeries(qaDefOptions.series, 'qaDef') },
        qaEff: { ...qaEffOptions, series: filterSeries(qaEffOptions.series, 'qaEff') },
    };

    // ── Per-chart form fields ──────────────────────────────────────────────
    const renderForm = (chartKey) => {
        const inputCls = 'w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500';
        const readCls = 'w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold text-center';
        const labelCls = 'block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1';

        if (chartKey === 'srcEff') return (
            <div className="space-y-2">
                <div>
                    <label className={labelCls}>Plan Qty</label>
                    <input type="number" className={inputCls} value={formValues.srcEffPlan}
                        onChange={e => handleInput('srcEffPlan', parseInt(e.target.value) || 0)} />
                </div>
                <div>
                    <label className={labelCls}>Actual Qty</label>
                    <input type="number" className={inputCls} value={formValues.srcEffActual}
                        onChange={e => handleInput('srcEffActual', parseInt(e.target.value) || 0)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={labelCls}>Target (%)</label>
                        <input type="number" step="0.1" className={inputCls} value={formValues.srcEffTarget}
                            onChange={e => handleInput('srcEffTarget', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label className={labelCls}>Calculated (%)</label>
                        <div className={`${readCls} text-blue-600 dark:text-blue-400`}>{srcCalculatedEff}%</div>
                    </div>
                </div>
            </div>
        );

        if (chartKey === 'srcDef') return (
            <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1">
                    <div>
                        <label className={labelCls}>Auto</label>
                        <input type="number" className={inputCls} value={formValues.srcDefAuto}
                            onChange={e => handleInput('srcDefAuto', parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label className={labelCls}>Manual</label>
                        <input type="number" className={inputCls} value={formValues.srcDefManual}
                            onChange={e => handleInput('srcDefManual', parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label className={labelCls}>Joint</label>
                        <input type="number" className={inputCls} value={formValues.srcDefJoint}
                            onChange={e => handleInput('srcDefJoint', parseInt(e.target.value) || 0)} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={labelCls}>Total Defect</label>
                        <div className={`${readCls} text-slate-700 dark:text-slate-200`}>{srcTotalDefects}</div>
                    </div>
                    <div>
                        <label className={labelCls}>Production Qty</label>
                        <input type="number" className={inputCls} value={formValues.srcDefProduction}
                            onChange={e => handleInput('srcDefProduction', parseInt(e.target.value) || 0)} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={labelCls}>Target PPM</label>
                        <input type="number" step="0.1" className={inputCls} value={formValues.srcDefTarget}
                            onChange={e => handleInput('srcDefTarget', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label className={labelCls}>Defect PPM</label>
                        <div className={`${readCls} text-emerald-600 dark:text-emerald-400`}>{srcPPM}</div>
                    </div>
                </div>
            </div>
        );

        if (chartKey === 'qaDef') return (
            <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1">
                    <div>
                        <label className={labelCls}>Auto</label>
                        <input type="number" className={inputCls} value={formValues.qaDefAuto}
                            onChange={e => handleInput('qaDefAuto', parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label className={labelCls}>Manual</label>
                        <input type="number" className={inputCls} value={formValues.qaDefManual}
                            onChange={e => handleInput('qaDefManual', parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label className={labelCls}>Joint</label>
                        <input type="number" className={inputCls} value={formValues.qaDefJoint}
                            onChange={e => handleInput('qaDefJoint', parseInt(e.target.value) || 0)} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={labelCls}>Total Defect</label>
                        <div className={`${readCls} text-slate-700 dark:text-slate-200`}>{qaTotalDefects}</div>
                    </div>
                    <div>
                        <label className={labelCls}>Production Qty</label>
                        <input type="number" className={inputCls} value={formValues.qaDefProduction}
                            onChange={e => handleInput('qaDefProduction', parseInt(e.target.value) || 0)} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={labelCls}>Target PPM</label>
                        <input type="number" step="0.1" className={inputCls} value={formValues.qaDefTarget}
                            onChange={e => handleInput('qaDefTarget', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label className={labelCls}>Defect PPM</label>
                        <div className={`${readCls} text-purple-600 dark:text-purple-400`}>{qaPPM}</div>
                    </div>
                </div>
            </div>
        );

        // qaEff
        return (
            <div className="space-y-2">
                <div>
                    <label className={labelCls}>Plan Qty</label>
                    <input type="number" className={inputCls} value={formValues.qaEffPlan}
                        onChange={e => handleInput('qaEffPlan', parseInt(e.target.value) || 0)} />
                </div>
                <div>
                    <label className={labelCls}>Actual Qty</label>
                    <input type="number" className={inputCls} value={formValues.qaEffActual}
                        onChange={e => handleInput('qaEffActual', parseInt(e.target.value) || 0)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={labelCls}>Target (%)</label>
                        <input type="number" step="0.1" className={inputCls} value={formValues.qaEffTarget}
                            onChange={e => handleInput('qaEffTarget', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label className={labelCls}>Calculated (%)</label>
                        <div className={`${readCls} text-pink-600 dark:text-pink-400`}>{qaCalculatedEff}%</div>
                    </div>
                </div>
            </div>
        );
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="space-y-3 mt-8">
            {/* Section heading */}
            <div className="flex items-center gap-2 px-1">
                <IconActivity className="w-5 h-5 text-blue-500" />
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Manual Performance &amp; Quality KPI Charts
                </h2>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                    — click Enter Data to select a date and fill values
                </span>
            </div>

            {/* Date range filter bar */}
            <div className="flex flex-wrap items-center gap-3 px-1">
                {/* Mode toggle pills */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
                    <button
                        onClick={handleClearRange}
                        className={[
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                            filterMode === '7day'
                                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
                        ].join(' ')}
                    >
                        Last 7 Days
                    </button>
                    <button
                        onClick={() => setFilterMode('custom')}
                        className={[
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                            filterMode === 'custom'
                                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
                        ].join(' ')}
                    >
                        <IconRange className="w-3.5 h-3.5" />
                        Custom Range
                    </button>
                </div>

                {/* Custom date inputs (shown only when custom mode is active) */}
                {filterMode === 'custom' && (
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase">From</span>
                            <input
                                type="date"
                                value={rangeStart}
                                max={rangeEnd || today}
                                onChange={e => setRangeStart(e.target.value)}
                                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
                            />
                        </div>
                        <span className="text-xs text-slate-400">→</span>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase">To</span>
                            <input
                                type="date"
                                value={rangeEnd}
                                min={rangeStart}
                                max={today}
                                onChange={e => setRangeEnd(e.target.value)}
                                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
                            />
                        </div>
                        <button
                            onClick={handleApplyRange}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
                        >
                            Apply
                        </button>
                        {appliedFilter && (
                            <button
                                onClick={handleClearRange}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold transition-all"
                            >
                                <IconX className="w-3 h-3" /> Clear
                            </button>
                        )}
                    </div>
                )}

                {/* Applied range badge */}
                {appliedFilter && (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-full">
                        <IconRange className="w-3 h-3" />
                        {appliedFilter.start} → {appliedFilter.end}
                    </span>
                )}
            </div>

            {CHARTS.map((cfg) => {
                const isOpen = activeChart === cfg.key;

                return (
                    <div
                        key={cfg.key}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
                    >
                        {/* ── Header row (always visible) ── */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
                            <div className="flex items-center gap-3">
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                    {cfg.title}
                                </h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badgeCls}`}>
                                    {cfg.badge}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {isFetching && isOpen && (
                                    <div className="flex items-center gap-1.5">
                                        <div className="animate-spin w-3 h-3 rounded-full border-b-2 border-blue-500" />
                                        <span className="text-[10px] text-blue-500">Refreshing…</span>
                                    </div>
                                )}

                                {/* Series show/hide dropdown */}
                                <div
                                    className="relative"
                                    ref={el => dropdownRefs.current[cfg.key] = el}
                                >
                                    <button
                                        onClick={() => setActiveDropdown(prev => prev === cfg.key ? null : cfg.key)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                                    >
                                        <IconChart className="w-3.5 h-3.5" />
                                        Show/Hide Bars
                                        <ChevronDown className={`w-3 h-3 transition-transform ${activeDropdown === cfg.key ? 'rotate-180' : ''}`} />
                                    </button>

                                    {activeDropdown === cfg.key && (
                                        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[170px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1.5">
                                            {ALL_SERIES[cfg.key].map(name => {
                                                const checked = selectedBars[cfg.key].includes(name);
                                                return (
                                                    <button
                                                        key={name}
                                                        onClick={() => toggleBar(cfg.key, name)}
                                                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                    >
                                                        <span className={`flex items-center justify-center w-4 h-4 rounded border flex-shrink-0 transition-colors ${checked ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                                            {checked && <Check className="w-3 h-3 text-white" />}
                                                        </span>
                                                        {name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => toggleChart(cfg.key)}
                                    className={[
                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                                        isOpen
                                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                                            : 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-800 hover:bg-slate-700 dark:hover:bg-slate-200',
                                    ].join(' ')}
                                >
                                    {isOpen ? (
                                        <><IconX className="w-3.5 h-3.5" /> Close</>
                                    ) : (
                                        <><IconChart className="w-3.5 h-3.5" /> Enter Data</>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* ── Body: always split or full depending on state ── */}
                        {isLoading ? (
                            <div className="flex items-center justify-center h-48">
                                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-500" />
                            </div>
                        ) : (
                            <div className={`grid gap-0 ${isOpen ? 'grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800' : 'grid-cols-1'}`}>

                                {/* ── Chart (always shown, full-width when closed, half-width when open) ── */}
                                <div className="p-5">
                                    <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                        7-Day Trend
                                    </div>
                                    <HighchartsReact highcharts={Highcharts} options={chartOptions[cfg.key]} />
                                </div>

                                {/* ── Right panel: Calendar + Manual Entry (only when open) ── */}
                                {isOpen && (
                                    <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">

                                        {/* Calendar */}
                                        <div className="p-5">
                                            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                                                Select Date
                                            </div>
                                            <DPRCalendar
                                                selectedDate={selectedDate}
                                                onDateSelect={handleDateSelect}
                                                filledDates={filledDates}
                                                viewMonth={viewMonth}
                                                viewYear={viewYear}
                                                onMonthChange={handleMonthChange}
                                            />
                                            <div className="mt-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-center">
                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold mb-0.5">Viewing data for</div>
                                                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Manual Entry Form */}
                                        <div className="p-5 flex flex-col gap-4">
                                            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                Manual Entry
                                            </div>
                                            {renderForm(cfg.key)}
                                            <button
                                                onClick={handleSave}
                                                disabled={isSaving}
                                                className={`w-full flex items-center justify-center gap-2 text-white rounded-xl p-2.5 text-xs font-semibold transition-all shadow-sm disabled:opacity-50 ${cfg.btnCls}`}
                                            >
                                                <IconSave className="w-3.5 h-3.5" />
                                                {isSaving ? 'Saving…' : cfg.saveLabel}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default DPRManualChartsContainer;
