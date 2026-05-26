import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Cell, PieChart, Pie, Tooltip, Legend } from 'recharts';
import { useGetSkillMatrixEfficiencySummaryQuery } from '@/Redux/AllApi/SkillMatrixApi';
import { Skeleton } from "@/components/ui/skeleton";
import { IconChartBar, IconChartPie, IconFilter, IconX, IconEye, IconEyeOff } from "@tabler/icons-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const SHIFT_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899'];
const PRESENT_STATUSES = new Set(['Present','Late','Half Day']);
const ATTENDANCE_COLORS = { 'Present':'#10b981', 'Absent':'#ef4444', 'Late':'#f59e0b', 'Half Day':'#8b5cf6' };
const getAttendanceColor = (status, idx) => ATTENDANCE_COLORS[status] || SHIFT_COLORS[idx % SHIFT_COLORS.length];
const ATT_BAR_COLORS = { Total: '#8b5cf6', Present: '#10b981', Absent: '#ef4444' };

const GRAD = {
    dept:       ['#6366f1','#4f46e5'],
    section:    ['#10b981','#059669'],
    line:       ['#f59e0b','#d97706'],
    subsection: ['#f43f5e','#e11d48'],
    attendance: ['#8b5cf6','#7c3aed'],
    operator:   ['#0ea5e9','#0284c7'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const calculateUserEfficiency = (op) => {
    if (!op) return 0;
    if (op.currentEffeciency != null) return Math.min(parseFloat(op.currentEffeciency) || 0, 100);
    const evalData = op.evalData;
    if (!evalData) return 0;
    let parsed = evalData;
    if (typeof evalData === 'string') { try { parsed = JSON.parse(evalData); } catch { return 0; } }
    const l4Keys = ['3-0','3-1','3-2','3-3','3-4'];
    if (l4Keys.every(k => parsed[k]?.standard === 'OK')) return 100;
    for (const key of ['2-0','1-1','0-2']) {
        const d = parsed[key];
        if (d?.standard === 'OK') return Math.min(parseFloat(d.okVal) || 0, 100);
    }
    return 0;
};

const getAvg = (arr) => arr.length ? Math.round((arr.reduce((a,b)=>a+b,0)/arr.length)*100)/100 : 0;
const getOpDate = (op) => op.attendanceDate || op.date || op.logDate || '';

const applyFilters = (ops, f) => {
    let r = ops || [];
    if (f.deptIds?.length)    r = r.filter(op => f.deptIds.includes(String(op.departmentId || op.departmentName)));
    if (f.sectionIds?.length) r = r.filter(op => f.sectionIds.includes(String(op.sectionId || op.sectionName)));
    if (f.lineIds?.length)    r = r.filter(op => f.lineIds.includes(String(op.lineId || op.lineName)));
    if (f.shifts?.length)     r = r.filter(op => f.shifts.includes(String(op.shift || op.shiftName || 'General')));
    if (f.dateFrom)           r = r.filter(op => getOpDate(op) >= f.dateFrom);
    if (f.dateTo)             r = r.filter(op => getOpDate(op) <= f.dateTo);
    return r;
};

const buildGroupData = (ops, getIdFn, getNameFn, effectiveShifts) => {
    const isMulti = effectiveShifts.length > 1;
    const map = {};
    ops.forEach(op => {
        const gId   = getIdFn(op);
        const gName = getNameFn(op);
        if (!gId || !gName) return;
        const eff   = calculateUserEfficiency(op);
        const isPres = PRESENT_STATUSES.has(op.logStatus);
        const shift  = String(op.shift || op.shiftName || 'General');
        if (!map[gId]) map[gId] = { id: gId, name: gName, allArr: [], presArr: [], shiftData: {} };
        map[gId].allArr.push(eff);
        if (isPres) map[gId].presArr.push(eff);
        if (isMulti) {
            if (!map[gId].shiftData[shift]) map[gId].shiftData[shift] = { allArr: [], presArr: [] };
            map[gId].shiftData[shift].allArr.push(eff);
            if (isPres) map[gId].shiftData[shift].presArr.push(eff);
        }
    });
    return Object.values(map).map(g => {
        const allAvg  = getAvg(g.allArr);
        const presAvg = getAvg(g.presArr);
        const tAll    = g.allArr.length;
        const tPres   = g.presArr.length;
        const item    = { id: g.id, name: g.name, allEfficiency: allAvg, presEfficiency: presAvg, allTotal: allAvg, presTotal: presAvg };
        if (isMulti) {
            effectiveShifts.forEach(s => {
                const sd = g.shiftData[s] || { allArr: [], presArr: [] };
                const sA = getAvg(sd.allArr);
                const sP = getAvg(sd.presArr);
                item[`all_${s}`]      = tAll  > 0 ? (sd.allArr.length  / tAll)  * sA : 0;
                item[`pres_${s}`]     = tPres > 0 ? (sd.presArr.length / tPres) * sP : 0;
                item[`allLabel_${s}`] = sA;
                item[`presLabel_${s}`]= sP;
            });
        }
        return item;
    }).sort((a,b) => b.allEfficiency - a.allEfficiency);
};

// ─── MultiSelectDropdown ──────────────────────────────────────────────────────
const MultiSelectDropdown = ({ label, options, value = [], onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const toggle = (v) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
    const clearAll = () => onChange([]);

    const buttonLabel = value.length === 0
        ? 'All'
        : value.length === 1
            ? (options.find(o => o.value === value[0])?.label ?? value[0])
            : `${value.length} selected`;

    return (
        <div ref={ref} className="relative z-20">
            <button onClick={() => setOpen(p => !p)}
                className="flex items-center gap-2 text-[13px] font-bold bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-700 px-3 py-2 rounded-lg transition-all shadow-sm whitespace-nowrap">
                <span className="text-slate-400 font-semibold">{label}:</span>
                <span className="max-w-[110px] truncate">{buttonLabel}</span>
                {value.length > 0 && (
                    <span className="bg-indigo-500 text-white text-[10px] font-black rounded-full px-2 py-0.5 leading-none">
                        {value.length}
                    </span>
                )}
                <svg className={`h-4 w-4 text-slate-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"/>
                </svg>
            </button>
            {open && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[200px] max-h-[260px] overflow-y-auto z-50">
                    {/* All option */}
                    <label className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100">
                        <input type="checkbox" checked={value.length === 0} onChange={clearAll}
                            className="accent-indigo-600 w-4 h-4 flex-shrink-0" />
                        <span className="text-[13px] font-bold text-slate-700">All</span>
                    </label>
                    {options.map(opt => (
                        <label key={opt.value} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={value.includes(opt.value)} onChange={() => toggle(opt.value)}
                                className="accent-indigo-600 w-4 h-4 flex-shrink-0" />
                            <span className="text-[13px] font-semibold text-slate-700 truncate">{opt.label}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── ChartFilter ──────────────────────────────────────────────────────────────
const initF = () => ({ deptIds:[], sectionIds:[], lineIds:[], shifts:[], dateFrom:'', dateTo:'' });

const ChartFilter = ({ filter, setFilter, deptOpts, sectionOpts, lineOpts, shiftOpts, showDept, showSection, showLine, hideLegend = false }) => {
    const hasFilter = filter.deptIds?.length || filter.sectionIds?.length || filter.lineIds?.length || filter.shifts?.length || filter.dateFrom || filter.dateTo;
    return (
        <div className="flex flex-wrap gap-2.5 items-center mt-4 pt-4 border-t border-slate-100">
            {showDept && (
                <MultiSelectDropdown label="Dept"
                    options={deptOpts}
                    value={filter.deptIds}
                    onChange={v => setFilter(f => ({...f, deptIds:v, sectionIds:[], lineIds:[]}))} />
            )}
            {showSection && sectionOpts.length > 0 && (
                <MultiSelectDropdown label="Section"
                    options={sectionOpts}
                    value={filter.sectionIds}
                    onChange={v => setFilter(f => ({...f, sectionIds:v, lineIds:[]}))} />
            )}
            {showLine && lineOpts.length > 0 && (
                <MultiSelectDropdown label="Line"
                    options={lineOpts}
                    value={filter.lineIds}
                    onChange={v => setFilter(f => ({...f, lineIds:v}))} />
            )}
            <MultiSelectDropdown label="Shift"
                options={shiftOpts.map(s => ({value:s, label:`Shift ${s}`}))}
                value={filter.shifts}
                onChange={v => setFilter(f => ({...f, shifts:v}))} />
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">From</span>
                <input type="date" value={filter.dateFrom}
                    onChange={e => setFilter(f => ({...f, dateFrom:e.target.value}))}
                    className="text-[13px] text-slate-600 bg-transparent outline-none cursor-pointer w-32" />
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">To</span>
                <input type="date" value={filter.dateTo}
                    onChange={e => setFilter(f => ({...f, dateTo:e.target.value}))}
                    className="text-[13px] text-slate-600 bg-transparent outline-none cursor-pointer w-32" />
            </div>
            {hasFilter && (
                <button onClick={() => setFilter(initF())}
                    className="flex items-center gap-1.5 text-[13px] font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-lg transition-all">
                    <IconX className="h-4 w-4" /> Clear
                </button>
            )}
            {!hideLegend && (
                <div className="ml-auto flex items-center gap-4 flex-shrink-0">
                    <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-500">
                        <span className="w-4 h-3 rounded-sm bg-indigo-500 inline-block" /> All Users
                    </span>
                    <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-500">
                        <span className="w-4 h-3 rounded-sm bg-emerald-500 inline-block" /> Present Only
                    </span>
                </div>
            )}
        </div>
    );
};



// ─── Shift Legend (for stacked mode) ─────────────────────────────────────────
const ShiftLegend = ({ shifts }) => {
    if (shifts.length <= 1) return null;
    return (
        <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-slate-50">
            <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider self-center">Shifts:</span>
            {shifts.map((s, i) => (
                <span key={s} className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600">
                    <span className="w-4 h-3 rounded-sm inline-block" style={{backgroundColor: SHIFT_COLORS[i % SHIFT_COLORS.length]}} />
                    Shift {s}
                </span>
            ))}
        </div>
    );
};


// ─── Summary capsules below each chart ────────────────────────────────────────
const SummaryCapsules = ({ data, dotColor, label }) => {
    if (!data.length) return null;
    const overallAll  = getAvg(data.map(d=>d.allEfficiency));
    const overallPres = getAvg(data.map(d=>d.presEfficiency));
    return (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-5 border-t border-slate-100">
            {data.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-center gap-2 truncate">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor: dotColor}} />
                        <span className="text-[13px] font-semibold text-slate-600 truncate max-w-[90px]" title={item.name}>{item.name}</span>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0 ml-2">
                        <span className="text-[13px] font-bold text-slate-800">{item.allEfficiency}%</span>
                        <span className="text-[12px] font-semibold text-emerald-600">{item.presEfficiency}%</span>
                    </div>
                </div>
            ))}
            <div className="col-span-2 sm:col-span-3 lg:col-span-4 flex items-center justify-between p-3.5 rounded-xl mt-1"
                style={{backgroundColor:`${dotColor}15`, border:`1px solid ${dotColor}30`}}>
                <span className="text-sm font-bold" style={{color: dotColor}}>{label} — All: {overallAll}% | Present: {overallPres}%</span>
            </div>
        </div>
    );
};

// ─── Chart Section Wrapper ────────────────────────────────────────────────────
const ChartSection = ({ badge, title, tag, statsVisible, onToggleStats, children }) => (
    <div className="space-y-3 p-7 border border-slate-100 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between border-b pb-4 border-slate-100">
            <h4 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                {badge}
                {title}
            </h4>
            <div className="flex items-center gap-2">
                <button
                    onClick={onToggleStats}
                    className="flex items-center gap-1.5 text-[13px] font-bold px-3 py-1.5 rounded-lg border transition-all duration-200
                        bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                    {statsVisible
                        ? <><IconEyeOff className="h-4 w-4" /> Hide Stats</>
                        : <><IconEye    className="h-4 w-4" /> Show Stats</>
                    }
                </button>
                {tag}
            </div>
        </div>
        {children}
    </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = ({ msg = 'No data found', sub }) => (
    <div className="h-[280px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
        <IconFilter className="h-10 w-10 text-slate-400 mb-3" />
        <p className="text-slate-500 font-bold text-sm">{msg}</p>
        {sub && <p className="text-slate-400 text-[13px] mt-1">{sub}</p>}
    </div>
);

// ─── Custom X-Axis Tick (horizontal, word-wrapped) ───────────────────────────
const CustomXAxisTick = ({ x, y, payload }) => {
    const words = (payload.value || '').split(' ');
    const lineH = 15;
    return (
        <g transform={`translate(${x},${y})`}>
            <text textAnchor="middle" fill="#334155" fontSize={13} fontWeight={700}>
                {words.map((word, i) => (
                    <tspan key={i} x={0} dy={i === 0 ? 14 : lineH}>
                        {word}
                    </tspan>
                ))}
            </text>
        </g>
    );
};

// ─── View Toggle (Bar / Pie) ──────────────────────────────────────────────────
const ViewToggle = ({ view, onChange }) => (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {[['bar', 'Bar', <IconChartBar className="h-4 w-4" />], ['pie', 'Pie', <IconChartPie className="h-4 w-4" />]].map(([v, label, icon]) => (
            <button key={v} onClick={() => onChange(v)}
                className={`flex items-center gap-1.5 text-[13px] font-bold px-3 py-1.5 rounded-md transition-all
                    ${view === v ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {icon}{label}
            </button>
        ))}
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const EfficiencyChart = () => {
    const [f1, setF1] = useState(initF());
    const [f2, setF2] = useState(initF());
    const [f3, setF3] = useState(initF());
    const [f4, setF4] = useState(initF());
    const [f5, setF5] = useState(initF());
    const [f6, setF6] = useState(initF());

    const [statVis, setStatVis] = useState({ c1:false, c2:false, c3:false, c4:false, c5:false, c6:false });
    const toggleStat = (key) => setStatVis(prev => ({ ...prev, [key]: !prev[key] }));
    const [attendanceView, setAttendanceView] = useState('bar');

    const { data: summaryData, isLoading, error } = useGetSkillMatrixEfficiencySummaryQuery();
    const rawOps = useMemo(() => summaryData?.data || [], [summaryData]);

    // All unique shifts
    const allShifts = useMemo(() => {
        const s = new Set();
        rawOps.forEach(op => { const sh = op.shift || op.shiftName; if (sh) s.add(String(sh)); });
        return [...s].sort();
    }, [rawOps]);

    // Option builders
    const allDeptOpts = useMemo(() => {
        const m = {};
        rawOps.forEach(op => {
            const id = String(op.departmentId || op.departmentName || '');
            if (id && op.departmentName) m[id] = op.departmentName;
        });
        return Object.entries(m).map(([value, label]) => ({ value, label }));
    }, [rawOps]);

    const getSectionOpts = (deptIds) => {
        const m = {};
        rawOps.forEach(op => {
            if (deptIds?.length && !deptIds.includes(String(op.departmentId || op.departmentName))) return;
            const id = String(op.sectionId || op.sectionName || '');
            if (id && op.sectionName) m[id] = op.sectionName;
        });
        return Object.entries(m).map(([value, label]) => ({ value, label }));
    };

    const getLineOpts = (deptIds, sectionIds) => {
        const m = {};
        rawOps.forEach(op => {
            if (deptIds?.length    && !deptIds.includes(String(op.departmentId || op.departmentName))) return;
            if (sectionIds?.length && !sectionIds.includes(String(op.sectionId || op.sectionName)))   return;
            const id = String(op.lineId || op.lineName || '');
            if (id && op.lineName) m[id] = op.lineName;
        });
        return Object.entries(m).map(([value, label]) => ({ value, label }));
    };

    // Memoised option lists per chart (deps use JSON key to avoid stale array refs)
    const s2Opts = useMemo(() => getSectionOpts(f2.deptIds), [rawOps, f2.deptIds]);
    const s3Opts = useMemo(() => getSectionOpts(f3.deptIds), [rawOps, f3.deptIds]);
    const l3Opts = useMemo(() => getLineOpts(f3.deptIds, f3.sectionIds), [rawOps, f3.deptIds, f3.sectionIds]);
    const s4Opts = useMemo(() => getSectionOpts(f4.deptIds), [rawOps, f4.deptIds]);
    const l4Opts = useMemo(() => getLineOpts(f4.deptIds, f4.sectionIds), [rawOps, f4.deptIds, f4.sectionIds]);
    const s5Opts = useMemo(() => getSectionOpts(f5.deptIds), [rawOps, f5.deptIds]);
    const l5Opts = useMemo(() => getLineOpts(f5.deptIds, f5.sectionIds), [rawOps, f5.deptIds, f5.sectionIds]);
    const s6Opts = useMemo(() => getSectionOpts(f6.deptIds), [rawOps, f6.deptIds]);
    const l6Opts = useMemo(() => getLineOpts(f6.deptIds, f6.sectionIds), [rawOps, f6.deptIds, f6.sectionIds]);

    // Filtered ops per chart
    const ops1 = useMemo(() => applyFilters(rawOps, {shifts:f1.shifts, dateFrom:f1.dateFrom, dateTo:f1.dateTo}), [rawOps, f1]);
    const ops2 = useMemo(() => applyFilters(rawOps, f2), [rawOps, f2]);
    const ops3 = useMemo(() => applyFilters(rawOps, f3), [rawOps, f3]);
    const ops4 = useMemo(() => applyFilters(rawOps, f4), [rawOps, f4]);
    const ops5 = useMemo(() => applyFilters(rawOps, f5), [rawOps, f5]);
    const ops6 = useMemo(() => applyFilters(rawOps, f6), [rawOps, f6]);

    // Effective shifts per filtered set
    // filterShifts=[] means all; non-empty means only those selected shifts
    const effShifts = (ops, filterShifts) => {
        if (filterShifts?.length) return filterShifts;
        const s = new Set();
        ops.forEach(op => { const sh = op.shift || op.shiftName; if (sh) s.add(String(sh)); });
        return [...s].sort();
    };

    const sh1 = useMemo(() => effShifts(ops1, f1.shifts), [ops1, f1.shifts]);
    const sh2 = useMemo(() => effShifts(ops2, f2.shifts), [ops2, f2.shifts]);
    const sh3 = useMemo(() => effShifts(ops3, f3.shifts), [ops3, f3.shifts]);
    const sh4 = useMemo(() => effShifts(ops4, f4.shifts), [ops4, f4.shifts]);
    const sh5 = useMemo(() => effShifts(ops5, f5.shifts), [ops5, f5.shifts]);

    // Chart data
    const d1 = useMemo(() => buildGroupData(ops1, op=>String(op.departmentId||op.departmentName||''), op=>op.departmentName,  sh1), [ops1,sh1]);
    const d2 = useMemo(() => buildGroupData(ops2, op=>String(op.sectionId   ||op.sectionName   ||''), op=>op.sectionName,    sh2), [ops2,sh2]);
    const d3 = useMemo(() => buildGroupData(ops3, op=>String(op.lineId      ||op.lineName      ||''), op=>op.lineName,       sh3), [ops3,sh3]);
    const d4 = useMemo(() => buildGroupData(ops4, op=>String(op.subSectionId||op.subSectionName||''), op=>op.subSectionName, sh4), [ops4,sh4]);

    // Chart 1: Attendance-wise — fixed 3 buckets: Total, Present, Absent
    const d5 = useMemo(() => {
        if (!ops5.length) return [];
        const allEffs  = ops5.map(calculateUserEfficiency);
        const presEffs = ops5.filter(op =>  PRESENT_STATUSES.has(op.logStatus)).map(calculateUserEfficiency);
        const absEffs  = ops5.filter(op => !PRESENT_STATUSES.has(op.logStatus)).map(calculateUserEfficiency);
        return [
            { name: 'Total',   efficiency: getAvg(allEffs),  count: allEffs.length  },
            { name: 'Present', efficiency: getAvg(presEffs), count: presEffs.length },
            { name: 'Absent',  efficiency: getAvg(absEffs),  count: absEffs.length  },
        ];
    }, [ops5]);

    // Chart 6: Operator-wise (single bar — overall efficiency, color-coded by attendance)
    const d6 = useMemo(() => ops6.map(op => ({
        id:         op.userId,
        name:       op.fullName || 'Unknown',
        empId:      op.empId || 'N/A',
        efficiency: calculateUserEfficiency(op),
        status:     op.logStatus || 'Absent',
    })).sort((a,b) => b.efficiency - a.efficiency), [ops6]);

    if (isLoading) return (
        <Card className="col-span-1 lg:col-span-2 border border-slate-100 shadow-sm rounded-3xl bg-white p-6">
            <CardHeader className="pb-6 border-b border-slate-50">
                <Skeleton className="h-6 w-48 rounded-lg" />
                <Skeleton className="h-4 w-32 rounded-lg mt-2" />
            </CardHeader>
            <CardContent className="p-6">
                <Skeleton className="h-[300px] w-full rounded-2xl" />
            </CardContent>
        </Card>
    );

    if (error) return (
        <Card className="col-span-1 lg:col-span-2 border border-red-200 shadow-sm rounded-3xl bg-red-50/10">
            <CardContent className="p-6 text-center text-red-500 font-medium">
                Failed to load efficiency charts. Please refresh the page.
            </CardContent>
        </Card>
    );

    const commonMargin = { top: 42, right: 24, left: -10, bottom: 56 };
    const axisTick = { fill:'#334155', fontSize:14, fontWeight:700 };

    const ChartWrapper = ({ data, minW = 110, children }) => (
        <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 pb-2 mt-4">
            <div style={{ width:'100%', minWidth:`${Math.max(480, data.length * minW)}px` }} className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                    {children}
                </ResponsiveContainer>
            </div>
        </div>
    );

    return (
        <Card className="col-span-1 lg:col-span-2 border border-slate-100 shadow-sm rounded-3xl overflow-hidden bg-white text-black font-sans">
            <CardHeader className="pb-5 border-b border-slate-50">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-slate-800 text-xl font-bold">
                        <IconChartBar className="h-6 w-6 text-indigo-600 animate-pulse" />
                        Hierarchical Efficiency Dashboard
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-sm mt-1">
                        Each chart has independent filters · Two bars per group: All Users vs Present Users · All Shifts shows stacked breakdown
                    </CardDescription>
                </div>
            </CardHeader>

            <CardContent className="p-6">
                <div className="grid grid-cols-1 gap-10">

                    {/* ── CHART 1: Attendance-Wise Efficiency ── */}
                    <ChartSection
                        badge={<span className="text-violet-600">Chart 1:</span>}
                        title="Attendance-Wise Efficiency"
                        tag={<span className="bg-violet-50 text-violet-700 text-[12px] font-extrabold py-1 px-2.5 rounded uppercase tracking-wider">By Status</span>}
                        statsVisible={statVis.c5} onToggleStats={() => toggleStat('c5')}
                    >
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                            <ViewToggle view={attendanceView} onChange={setAttendanceView} />
                        </div>
                        <ChartFilter filter={f5} setFilter={setF5}
                            deptOpts={allDeptOpts} sectionOpts={s5Opts} lineOpts={l5Opts}
                            shiftOpts={allShifts}
                            showDept={true} showSection={true} showLine={true} hideLegend={true} />
                        {d5.length > 0 ? (
                            <>
                                {attendanceView === 'bar' ? (
                                    <ChartWrapper data={d5} minW={160}>
                                        <BarChart data={d5} margin={commonMargin} barCategoryGap="40%">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" strokeWidth={1} vertical={false} />
                                            <XAxis dataKey="name" tick={<CustomXAxisTick />} tickLine={false} axisLine={false} interval={0} />
                                            <YAxis domain={[0,100]} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} />
                                            <Bar dataKey="efficiency" radius={[10,10,0,0]} maxBarSize={80}>
                                                {d5.map((entry, i) => (
                                                    <Cell key={i} fill={ATT_BAR_COLORS[entry.name] || '#8b5cf6'} />
                                                ))}
                                                <LabelList dataKey="efficiency" position="top" fill="#1e293b" fontSize={14} fontWeight={900} formatter={v=>`${v}%`} />
                                            </Bar>
                                        </BarChart>
                                    </ChartWrapper>
                                ) : (
                                    <div className="w-full mt-4 h-[360px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={d5}
                                                    dataKey="efficiency"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={130}
                                                    label={({ name, value }) => `${name}: ${value}%`}
                                                    labelLine
                                                >
                                                    {d5.map((entry, idx) => (
                                                        <Cell key={`att-${idx}`} fill={ATT_BAR_COLORS[entry.name] || SHIFT_COLORS[idx]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(v) => `${v}%`} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                                {statVis.c5 && (
                                    <div className="mt-5 grid grid-cols-3 gap-3 pt-5 border-t border-slate-100">
                                        {d5.map(item => (
                                            <div key={item.name}
                                                className="flex items-center justify-between p-3.5 rounded-xl border"
                                                style={{ backgroundColor: `${ATT_BAR_COLORS[item.name]}15`, borderColor: `${ATT_BAR_COLORS[item.name]}30` }}>
                                                <div>
                                                    <p className="text-sm font-bold" style={{ color: ATT_BAR_COLORS[item.name] }}>{item.name}</p>
                                                    <p className="text-[12px] text-slate-500">{item.count} operators</p>
                                                </div>
                                                <span className="text-lg font-black text-slate-800">{item.efficiency}%</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : <EmptyState msg="No Attendance Data" sub="Adjust filters to see data." />}
                    </ChartSection>

                    {/* ── CHART 2: Department Averages ── */}
                    <ChartSection
                        badge={<span className="text-indigo-600">Chart 2:</span>}
                        title="Department Average"
                        tag={<span className="bg-indigo-50 text-indigo-700 text-[12px] font-extrabold py-1 px-2.5 rounded uppercase tracking-wider">Dept Level</span>}
                        statsVisible={statVis.c1} onToggleStats={() => toggleStat('c1')}
                    >
                        <ChartFilter filter={f1} setFilter={setF1}
                            deptOpts={allDeptOpts} sectionOpts={[]} lineOpts={[]}
                            shiftOpts={allShifts}
                            showDept={false} showSection={false} showLine={false} />
                        <ShiftLegend shifts={sh1} />
                        {d1.length > 0 ? (
                            <>
                                <ChartWrapper data={d1}>
                                    <BarChart data={d1} margin={commonMargin} barCategoryGap="32%" barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" strokeWidth={1} vertical={false} />
                                        <XAxis dataKey="name" tick={<CustomXAxisTick />} tickLine={false} axisLine={false} interval={0} />
                                        <YAxis domain={[0,100]} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} />
                                        <Bar dataKey="allEfficiency" name="All Users" fill="#6366f1" radius={[10,10,0,0]} maxBarSize={56}>
                                            <LabelList dataKey="allEfficiency" position="top" fill="#1e293b" fontSize={14} fontWeight={900} formatter={v=>`${v}%`} />
                                        </Bar>
                                        <Bar dataKey="presEfficiency" name="Present Only" fill="#10b981" radius={[10,10,0,0]} maxBarSize={56}>
                                            <LabelList dataKey="presEfficiency" position="top" fill="#065f46" fontSize={14} fontWeight={900} formatter={v=>`${v}%`} />
                                        </Bar>
                                    </BarChart>
                                </ChartWrapper>
                                {statVis.c1 && <SummaryCapsules data={d1} dotColor="#6366f1" label="Department Average" />}
                            </>
                        ) : <EmptyState msg="No Department Data" />}
                    </ChartSection>

                    {/* ── CHART 3: Section Averages ── */}
                    <ChartSection
                        badge={<span className="text-emerald-600">Chart 3:</span>}
                        title="Section Average"
                        tag={<span className="bg-emerald-50 text-emerald-700 text-[12px] font-extrabold py-1 px-2.5 rounded uppercase tracking-wider">Section Level</span>}
                        statsVisible={statVis.c2} onToggleStats={() => toggleStat('c2')}
                    >
                        <ChartFilter filter={f2} setFilter={setF2}
                            deptOpts={allDeptOpts} sectionOpts={s2Opts} lineOpts={[]}
                            shiftOpts={allShifts}
                            showDept={true} showSection={false} showLine={false} />
                        <ShiftLegend shifts={sh2} />
                        {d2.length > 0 ? (
                            <>
                                <ChartWrapper data={d2}>
                                    <BarChart data={d2} margin={commonMargin} barCategoryGap="32%" barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" strokeWidth={1} vertical={false} />
                                        <XAxis dataKey="name" tick={<CustomXAxisTick />} tickLine={false} axisLine={false} interval={0} />
                                        <YAxis domain={[0,100]} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} />
                                        <Bar dataKey="allEfficiency" name="All Users" fill="#10b981" radius={[10,10,0,0]} maxBarSize={56}>
                                            <LabelList dataKey="allEfficiency" position="top" fill="#1e293b" fontSize={14} fontWeight={900} formatter={v=>`${v}%`} />
                                        </Bar>
                                        <Bar dataKey="presEfficiency" name="Present Only" fill="#34d399" radius={[10,10,0,0]} maxBarSize={56}>
                                            <LabelList dataKey="presEfficiency" position="top" fill="#065f46" fontSize={14} fontWeight={900} formatter={v=>`${v}%`} />
                                        </Bar>
                                    </BarChart>
                                </ChartWrapper>
                                {statVis.c2 && <SummaryCapsules data={d2} dotColor="#10b981" label="Section Average" />}
                            </>
                        ) : <EmptyState msg="No Section Data" sub="Select a department to narrow sections." />}
                    </ChartSection>

                    {/* ── CHART 4: Line Averages ── */}
                    <ChartSection
                        badge={<span className="text-amber-600">Chart 4:</span>}
                        title="Line Average"
                        tag={<span className="bg-amber-50 text-amber-700 text-[12px] font-extrabold py-1 px-2.5 rounded uppercase tracking-wider">Line Level</span>}
                        statsVisible={statVis.c3} onToggleStats={() => toggleStat('c3')}
                    >
                        <ChartFilter filter={f3} setFilter={setF3}
                            deptOpts={allDeptOpts} sectionOpts={s3Opts} lineOpts={l3Opts}
                            shiftOpts={allShifts}
                            showDept={true} showSection={true} showLine={false} />
                        <ShiftLegend shifts={sh3} />
                        {d3.length > 0 ? (
                            <>
                                <ChartWrapper data={d3}>
                                    <BarChart data={d3} margin={commonMargin} barCategoryGap="32%" barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" strokeWidth={1} vertical={false} />
                                        <XAxis dataKey="name" tick={<CustomXAxisTick />} tickLine={false} axisLine={false} interval={0} />
                                        <YAxis domain={[0,100]} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} />
                                        <Bar dataKey="allEfficiency" name="All Users" fill="#f59e0b" radius={[10,10,0,0]} maxBarSize={56}>
                                            <LabelList dataKey="allEfficiency" position="top" fill="#1e293b" fontSize={14} fontWeight={900} formatter={v=>`${v}%`} />
                                        </Bar>
                                        <Bar dataKey="presEfficiency" name="Present Only" fill="#fcd34d" radius={[10,10,0,0]} maxBarSize={56}>
                                            <LabelList dataKey="presEfficiency" position="top" fill="#92400e" fontSize={14} fontWeight={900} formatter={v=>`${v}%`} />
                                        </Bar>
                                    </BarChart>
                                </ChartWrapper>
                                {statVis.c3 && <SummaryCapsules data={d3} dotColor="#f59e0b" label="Line Average" />}
                            </>
                        ) : <EmptyState msg="No Line Data" sub="Select a section to see lines." />}
                    </ChartSection>

                    {/* ── CHART 5: Sub-section Averages ── */}
                    <ChartSection
                        badge={<span className="text-rose-600">Chart 5:</span>}
                        title="Sub-section Average"
                        tag={<span className="bg-rose-50 text-rose-700 text-[12px] font-extrabold py-1 px-2.5 rounded uppercase tracking-wider">Sub-section</span>}
                        statsVisible={statVis.c4} onToggleStats={() => toggleStat('c4')}
                    >
                        <ChartFilter filter={f4} setFilter={setF4}
                            deptOpts={allDeptOpts} sectionOpts={s4Opts} lineOpts={l4Opts}
                            shiftOpts={allShifts}
                            showDept={true} showSection={true} showLine={true} />
                        <ShiftLegend shifts={sh4} />
                        {d4.length > 0 ? (
                            <>
                                <ChartWrapper data={d4}>
                                    <BarChart data={d4} margin={commonMargin} barCategoryGap="32%" barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" strokeWidth={1} vertical={false} />
                                        <XAxis dataKey="name" tick={<CustomXAxisTick />} tickLine={false} axisLine={false} interval={0} />
                                        <YAxis domain={[0,100]} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} />
                                        <Bar dataKey="allEfficiency" name="All Users" fill="#f43f5e" radius={[10,10,0,0]} maxBarSize={56}>
                                            <LabelList dataKey="allEfficiency" position="top" fill="#1e293b" fontSize={14} fontWeight={900} formatter={v=>`${v}%`} />
                                        </Bar>
                                        <Bar dataKey="presEfficiency" name="Present Only" fill="#fb7185" radius={[10,10,0,0]} maxBarSize={56}>
                                            <LabelList dataKey="presEfficiency" position="top" fill="#9f1239" fontSize={14} fontWeight={900} formatter={v=>`${v}%`} />
                                        </Bar>
                                    </BarChart>
                                </ChartWrapper>
                                {statVis.c4 && <SummaryCapsules data={d4} dotColor="#f43f5e" label="Sub-section Average" />}
                            </>
                        ) : <EmptyState msg="No Sub-section Data" sub="Select a line to see sub-sections." />}
                    </ChartSection>

                    {/* ── CHART 6: Operator-Wise Efficiency ── */}
                    <ChartSection
                        badge={<span className="text-sky-600">Chart 6:</span>}
                        title="Operator-Wise Efficiency"
                        tag={<span className="bg-sky-50 text-sky-700 text-[12px] font-extrabold py-1 px-2.5 rounded uppercase tracking-wider">Individual</span>}
                        statsVisible={statVis.c6} onToggleStats={() => toggleStat('c6')}
                    >
                        <ChartFilter filter={f6} setFilter={setF6}
                            deptOpts={allDeptOpts} sectionOpts={s6Opts} lineOpts={l6Opts}
                            shiftOpts={allShifts}
                            showDept={true} showSection={true} showLine={true} hideLegend={true} />
                        {/* Legend for Chart 6 only */}
                        <div className="flex items-center gap-5 mt-3">
                            <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-500">
                                <span className="w-4 h-3 rounded-sm inline-block bg-sky-500" /> Present
                            </span>
                            <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-500">
                                <span className="w-4 h-3 rounded-sm inline-block bg-slate-300" /> Absent
                            </span>
                        </div>
                        {d6.length > 0 ? (
                            <>
                                <ChartWrapper data={d6} minW={80}>
                                    <BarChart data={d6} margin={{ top: 32, right: 24, left: -10, bottom: 56 }} barCategoryGap="40%">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" strokeWidth={1} vertical={false} />
                                        <XAxis
                                            dataKey="name"
                                            interval={0}
                                            tick={<CustomXAxisTick />}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis domain={[0,100]} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} />
                                        <Bar dataKey="efficiency" radius={[10,10,0,0]} maxBarSize={52}>
                                            {d6.map((entry, index) => (
                                                <Cell key={`op-${index}`}
                                                    fill={PRESENT_STATUSES.has(entry.status) ? '#0ea5e9' : '#cbd5e1'} />
                                            ))}
                                            <LabelList content={(props) => {
                                                const { x, y, width, value } = props;
                                                if (value == null) return null;
                                                return (
                                                    <text x={x + width / 2} y={y - 10}
                                                        textAnchor="middle" fill="#1e293b" fontSize={14} fontWeight={900}>
                                                        {value}%
                                                    </text>
                                                );
                                            }} />
                                        </Bar>
                                    </BarChart>
                                </ChartWrapper>
                                {statVis.c6 && (
                                    <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-slate-100">
                                        <div className="col-span-2 flex items-center justify-between p-3.5 rounded-xl bg-sky-50 border border-sky-100">
                                            <span className="text-sm font-bold text-sky-700">Overall Avg Efficiency</span>
                                            <span className="text-sm font-black text-sky-900">
                                                {d6.length > 0 ? getAvg(d6.map(op => op.efficiency)) : 0}%
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 border border-emerald-100">
                                            <span className="text-sm font-bold text-emerald-700">Present</span>
                                            <span className="text-sm font-black text-emerald-900">{d6.filter(op=>PRESENT_STATUSES.has(op.status)).length}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-rose-50 border border-rose-100">
                                            <span className="text-sm font-bold text-rose-700">Absent</span>
                                            <span className="text-sm font-black text-rose-900">{d6.filter(op=>!PRESENT_STATUSES.has(op.status)).length}</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : <EmptyState msg="No Operator Data" sub="Adjust filters to see operators." />}
                    </ChartSection>

                </div>
            </CardContent>
        </Card>
    );
};

export default EfficiencyChart;
