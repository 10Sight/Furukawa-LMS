import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Cell, PieChart, Pie, Tooltip, Legend, ReferenceLine } from 'recharts';
import { useGetSkillMatrixEfficiencySummaryQuery } from '@/Redux/AllApi/SkillMatrixApi';
import { useGetSubSectionsQuery } from '@/Redux/AllApi/SubSectionApi';
import { Skeleton } from "@/components/ui/skeleton";
import { IconChartBar, IconChartPie, IconFilter, IconX, IconEye, IconEyeOff } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate";

// ─── Constants ────────────────────────────────────────────────────────────────
const SHIFT_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
const PRESENT_STATUSES = new Set(['Present', 'Late', 'Half Day']);
const ATTENDANCE_COLORS = { 'Present': 'blue', 'Absent': 'red', 'Late': '#f59e0b', 'Half Day': '#8b5cf6' };
const getAttendanceColor = (status, idx) => ATTENDANCE_COLORS[status] || SHIFT_COLORS[idx % SHIFT_COLORS.length];
const ATT_BAR_COLORS = { 'Total Efficiency': '#f59e0b', 'Present Efficiency': 'blue', 'Absent Efficiency': 'red', 'Min Efficiency': '#386641', 'Max Efficiency': '#a855f7' };
// Colors for bars
const getAttBarColor = (name) => {
    if (!name) return '#8b5cf6';
    if (name.includes('Min')) return '#386641';
    if (name.includes('Total')) return '#f59e0b';
    if (name.includes('Present')) return 'blue';
    if (name.includes('Absent')) return 'red';
    return '#8b5cf6';
};
// Frozen Legend
const FrozenLegend = ({ minEffVisible, allUsersColor = "#f59e0b", allUsersLabel, presentLabel, absentLabel }) => {
    const { t } = useTranslate();
    return (
        <div className="flex flex-wrap justify-center items-center gap-5 mt-4">
            {minEffVisible && (
                <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-500">
                    <span className="w-4 h-3 rounded-sm inline-block" style={{ backgroundColor: '#386641' }} /> {t('charts.minEff')}
                </span>
            )}
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-500">
                <span className="w-4 h-3 rounded-sm inline-block" style={{ backgroundColor: allUsersColor }} /> {allUsersLabel || t('charts.totalEff')}
            </span>
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-500">
                <span className="w-4 h-3 rounded-sm inline-block" style={{ backgroundColor: 'blue' }} /> {presentLabel || t('charts.presentEff')}
            </span>
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-500">
                <span className="w-4 h-3 rounded-sm inline-block" style={{ backgroundColor: 'red' }} /> {absentLabel || t('charts.absentEff')}
            </span>
        </div>
    );
};

const GRAD = {
    dept: ['#6366f1', '#4f46e5'],
    section: ['#10b981', '#059669'],
    line: ['#f59e0b', '#d97706'],
    subsection: ['#f43f5e', '#e11d48'],
    attendance: ['#8b5cf6', '#7c3aed'],
    operator: ['#0ea5e9', '#0284c7'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const calculateUserEfficiency = (op) => {
    if (!op) return 0;
    if (op.currentEffeciency != null) return parseFloat(op.currentEffeciency) || 0;
    const evalData = op.evalData;
    if (!evalData) return 0;
    let parsed = evalData;
    if (typeof evalData === 'string') { try { parsed = JSON.parse(evalData); } catch { return 0; } }
    // L4: '3-5', L3: '2-0', L2: '1-2', L1: '0-2'
    for (const key of ['3-5', '2-0', '1-2', '0-2']) {
        const d = parsed[key];
        if (d?.standard === 'OK') return parseFloat(d.okVal) || 0;
    }
    return 0;
};

const getAvg = (arr) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : 0;
const getSum = (arr) => arr.reduce((a, b) => a + b, 0);
const getOpDate = (op) => op.attendanceDate || op.date || op.logDate || '';
const getDateText = (f, t) => {
    const today = new Date().toLocaleDateString('en-CA');
    const from = f.dateFrom || today;
    const to = f.dateTo || today;
    if (from === to) return `${t('charts.date')}: ${from}`;
    return `${t('charts.date')}: ${from} ${t('charts.to').toLowerCase()} ${to}`;
};

// Bar label renderer: always outside and above the bar with the respective outsideColor.
const barLabel = (staggerPx, outsideColor) => ({ x, y, width, height, value }) => {
    if (value == null) return null;
    return <text x={x + width / 2} y={y - 6} textAnchor="middle" fill={outsideColor} fontSize={13} fontWeight={900}>{Math.round(value)}%</text>;
};

const isTemporaryUser = (op) => op.isTemporary === 1 || op.isTemporary === true || op.isTemporary === '1';

const applyFilters = (ops, f) => {
    let r = ops || [];
    // Condition 1: If user status is LEFT, exclude them
    r = r.filter(op => op.status !== 'LEFT' && op.userStatus !== 'LEFT');
    // Exclude temporary (Dojo candidate) users
    r = r.filter(op => !isTemporaryUser(op));

    if (f.deptIds?.length) r = r.filter(op => f.deptIds.includes(String(op.departmentId || op.departmentName)));
    if (f.sectionIds?.length) r = r.filter(op => f.sectionIds.includes(String(op.sectionId || op.sectionName)));
    if (f.lineIds?.length) r = r.filter(op => f.lineIds.includes(String(op.lineId || op.lineName)));
    if (f.subSectionIds?.length) r = r.filter(op => f.subSectionIds.includes(String(op.subSectionId || op.subSectionName)));
    if (f.shifts?.length) r = r.filter(op => f.shifts.includes(String(op.shift || op.shiftName || 'General')));

    // Condition 2: Default under-the-hood date range to current date
    const today = new Date().toLocaleDateString('en-CA');
    const dateFrom = f.dateFrom || today;
    const dateTo = f.dateTo || today;

    r = r.filter(op => {
        const opDate = getOpDate(op);
        return opDate >= dateFrom && opDate <= dateTo;
    });
    return r;
};

const applyFiltersNoDate = (ops, f) => {
    let r = ops || [];
    // Condition 1: If user status is LEFT, exclude them
    r = r.filter(op => op.status !== 'LEFT' && op.userStatus !== 'LEFT');
    // Exclude temporary (Dojo candidate) users
    r = r.filter(op => !isTemporaryUser(op));

    if (f.deptIds?.length) r = r.filter(op => f.deptIds.includes(String(op.departmentId || op.departmentName)));
    if (f.sectionIds?.length) r = r.filter(op => f.sectionIds.includes(String(op.sectionId || op.sectionName)));
    if (f.lineIds?.length) r = r.filter(op => f.lineIds.includes(String(op.lineId || op.lineName)));
    if (f.subSectionIds?.length) r = r.filter(op => f.subSectionIds.includes(String(op.subSectionId || op.subSectionName)));
    if (f.shifts?.length) r = r.filter(op => f.shifts.includes(String(op.shift || op.shiftName || 'General')));
    return r;
};

// Shapes a rollup row into the flat item contract consumed by the charts/summary capsules.
const shapeGroupRow = (row) => {
    const allEff = row.allEfficiency ?? 0;
    const presEff = row.presEfficiency ?? 0;
    const absEff = row.absEfficiency ?? 0;
    return {
        id: row.id, name: row.name, displayName: row.name,
        allEfficiency: allEff, presEfficiency: presEff, absEfficiency: absEff,
        allTotal: allEff, presTotal: presEff, absTotal: absEff,
    };
};

// Ensures every filter-selected group key is represented (as 0%) even when it has no active children.
const withAllGroupKeys = (rows, allGroupKeys) => {
    const map = {};
    rows.forEach(r => { map[r.id] = r; });
    (allGroupKeys || []).forEach(gk => {
        if (gk.id && gk.name && !map[gk.id]) {
            map[gk.id] = { id: gk.id, name: gk.name, allEfficiency: 0, presEfficiency: 0, absEfficiency: 0 };
        }
    });
    return Object.values(map).map(shapeGroupRow).sort((a, b) => b.allEfficiency - a.allEfficiency);
};

// Averages a list of child rows' three efficiency metrics into a parent row, keyed by parent id/name.
const rollUp = (childRows, getParentId, getParentName) => {
    const map = {};
    childRows.forEach(child => {
        const pId = getParentId(child);
        if (!pId) return;
        if (!map[pId]) map[pId] = { id: pId, name: getParentName(child), allArr: [], presArr: [], absArr: [] };
        map[pId].allArr.push(child.allEfficiency);
        map[pId].presArr.push(child.presEfficiency);
        map[pId].absArr.push(child.absEfficiency);
    });
    return Object.values(map).map(row => ({
        ...row,
        allEfficiency: getAvg(row.allArr),
        presEfficiency: getAvg(row.presArr),
        absEfficiency: getAvg(row.absArr),
        headcount: row.allArr.length,
    }));
};

// Hierarchical rollup: Sub-Section = avg of its users; Line = avg of its active sub-sections;
// Section = avg of its active lines; Department = avg of its active sections.
const buildHierarchicalData = (opsAll, opsAtt, level, allGroupKeys = []) => {
    const ssMap = {};
    const ensureSS = (op) => {
        const ssId = String(op.subSectionId || op.subSectionName || '');
        if (!ssId) return null;
        if (!ssMap[ssId]) {
            ssMap[ssId] = {
                id: ssId, name: op.subSectionName,
                lineId: String(op.lineId || op.lineName || ''), lineName: op.lineName,
                sectionId: String(op.sectionId || op.sectionName || ''),
                sectionName: op.sectionCategory ? `${op.sectionName} (${op.sectionCategory})` : op.sectionName,
                deptId: String(op.departmentId || op.departmentName || ''), deptName: op.departmentName,
                allArr: [], presArr: [], absArr: [],
            };
        }
        return ssMap[ssId];
    };

    // Base: Total Efficiency per sub-section using opsAll (unfiltered by date)
    opsAll.forEach(op => {
        const row = ensureSS(op);
        if (!row) return;
        row.allArr.push(calculateUserEfficiency(op));
    });

    // Base: Attendance-based metrics per sub-section using opsAtt (filtered by date)
    opsAtt.forEach(op => {
        const row = ensureSS(op);
        if (!row) return;
        const eff = calculateUserEfficiency(op);
        const hasLogStatus = op.logStatus != null && op.logStatus !== '';
        const isPres = hasLogStatus && PRESENT_STATUSES.has(op.logStatus);
        const isAbs = hasLogStatus && !PRESENT_STATUSES.has(op.logStatus);
        if (isPres) row.presArr.push(eff);
        if (isAbs) row.absArr.push(eff);
    });

    const ssRows = Object.values(ssMap).map(row => {
        const total = row.allArr.length;
        return {
            ...row,
            allEfficiency: getAvg(row.allArr),
            presEfficiency: total ? Math.round((getSum(row.presArr) / total) * 100) / 100 : 0,
            absEfficiency: total ? Math.round((getSum(row.absArr) / total) * 100) / 100 : 0,
            headcount: total,
        };
    });

    if (level === 'subsection') return withAllGroupKeys(ssRows, allGroupKeys);

    const lineRows = rollUp(ssRows.filter(r => r.headcount > 0), r => r.lineId, r => r.lineName);
    if (level === 'line') return withAllGroupKeys(lineRows, allGroupKeys);

    // Line rows carry sectionId/sectionName/deptId/deptName from their active sub-sections
    const lineToParent = {};
    ssRows.forEach(r => { if (r.lineId && !lineToParent[r.lineId]) lineToParent[r.lineId] = r; });
    const sectionRows = rollUp(
        lineRows.filter(r => r.headcount > 0),
        r => lineToParent[r.id]?.sectionId,
        r => lineToParent[r.id]?.sectionName
    );
    if (level === 'section') return withAllGroupKeys(sectionRows, allGroupKeys);

    const sectionToParent = {};
    ssRows.forEach(r => { if (r.sectionId && !sectionToParent[r.sectionId]) sectionToParent[r.sectionId] = r; });
    const deptRows = rollUp(
        sectionRows.filter(r => r.headcount > 0),
        r => sectionToParent[r.id]?.deptId,
        r => sectionToParent[r.id]?.deptName
    );
    return withAllGroupKeys(deptRows, allGroupKeys);
};

// ─── MultiSelectDropdown ──────────────────────────────────────────────────────
const MultiSelectDropdown = ({ label, options, value = [], onChange }) => {
    const { t } = useTranslate();
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
        ? t('charts.all')
        : value.length === 1
            ? (options.find(o => o.value === value[0])?.label ?? value[0])
            : `${t('charts.selected')}: ${value.length}`;

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
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
                </svg>
            </button>
            {open && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[200px] max-h-[260px] overflow-y-auto z-50">
                    {/* All option */}
                    <label className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100">
                        <input type="checkbox" checked={value.length === 0} onChange={clearAll}
                            className="accent-indigo-600 w-4 h-4 flex-shrink-0" />
                        <span className="text-[13px] font-bold text-slate-700">{t('charts.all')}</span>
                    </label>
                    {options.map(opt => (
                        <label key={opt.value} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={value.includes(opt.value)} onChange={() => toggle(opt.value)}
                                className="accent-indigo-600 w-4 h-4 flex-shrink-0" />
                            {opt.color && (
                                <span className="w-3.5 h-3 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: opt.color }} />
                            )}
                            <span className="text-[13px] font-semibold text-slate-700 truncate">{opt.label}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── ChartFilter ──────────────────────────────────────────────────────────────
const initF = () => {
    return { deptIds: [], sectionIds: [], lineIds: [], subSectionIds: [], shifts: [], dateFrom: "", dateTo: "" };
};

const ChartFilter = ({ filter, setFilter, deptOpts, sectionOpts, lineOpts, subSectionOpts, shiftOpts, showDept, showSection, showLine, showSubSection = false, hideLegend = false, hideShift = false }) => {
    const { t } = useTranslate();
    const hasFilter = filter.deptIds?.length || filter.sectionIds?.length || filter.lineIds?.length || filter.subSectionIds?.length || filter.shifts?.length || filter.dateFrom || filter.dateTo;
    return (
        <div className="flex flex-wrap gap-2.5 items-center mt-4 pt-4 border-t border-slate-100">
            {showDept && (
                <MultiSelectDropdown label={t('nav.department')}
                    options={deptOpts}
                    value={filter.deptIds}
                    onChange={v => setFilter(f => ({ ...f, deptIds: v, sectionIds: [], lineIds: [], subSectionIds: [] }))} />
            )}
            {showSection && sectionOpts.length > 0 && (
                <MultiSelectDropdown label={t('charts.section')}
                    options={sectionOpts}
                    value={filter.sectionIds}
                    onChange={v => setFilter(f => ({ ...f, sectionIds: v, lineIds: [], subSectionIds: [] }))} />
            )}
            {showLine && lineOpts.length > 0 && (
                <MultiSelectDropdown label={t('charts.lineLevel')}
                    options={lineOpts}
                    value={filter.lineIds}
                    onChange={v => setFilter(f => ({ ...f, lineIds: v, subSectionIds: [] }))} />
            )}
            {showSubSection && subSectionOpts?.length > 0 && (
                <MultiSelectDropdown label={t('charts.subsection')}
                    options={subSectionOpts}
                    value={filter.subSectionIds}
                    onChange={v => setFilter(f => ({ ...f, subSectionIds: v }))} />
            )}
            {!hideShift && (
                <MultiSelectDropdown label={t('charts.shift')}
                    options={shiftOpts.map((s, idx) => ({
                        value: s,
                        label: `${t('charts.shift')} ${s}`,
                        color: SHIFT_COLORS[idx % SHIFT_COLORS.length]
                    }))}
                    value={filter.shifts}
                    onChange={v => setFilter(f => ({ ...f, shifts: v }))} />
            )}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">{t('charts.from')}</span>
                <input type="date" value={filter.dateFrom}
                    onChange={e => setFilter(f => ({ ...f, dateFrom: e.target.value }))}
                    className="text-[13px] text-slate-600 bg-transparent outline-none cursor-pointer w-32" />
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">{t('charts.to')}</span>
                <input type="date" value={filter.dateTo}
                    onChange={e => setFilter(f => ({ ...f, dateTo: e.target.value }))}
                    className="text-[13px] text-slate-600 bg-transparent outline-none cursor-pointer w-32" />
            </div>
            {hasFilter && (
                <button onClick={() => setFilter(initF())}
                    className="flex items-center gap-1.5 text-[13px] font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-lg transition-all">
                    <IconX className="h-4 w-4" /> {t('charts.clear')}
                </button>
            )}
        </div>
    );
};

// ─── Shift Legend (for stacked mode) ─────────────────────────────────────────
const ShiftLegend = ({ shifts }) => {
    const { t } = useTranslate();
    if (shifts.length <= 1) return null;
    return (
        <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-slate-50">
            <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider self-center">{t('charts.shifts')}:</span>
            {shifts.map((s, i) => (
                <span key={s} className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600">
                    <span className="w-4 h-3 rounded-sm inline-block" style={{ backgroundColor: SHIFT_COLORS[i % SHIFT_COLORS.length] }} />
                    {t('charts.shift')} {s}
                </span>
            ))}
        </div>
    );
};

// ─── Summary capsules below each chart ────────────────────────────────────────
const SummaryCapsules = ({ data, dotColor = "#f59e0b", label }) => {
    const { t } = useTranslate();
    if (!data.length) return null;
    const overallAll = getAvg(data.map(d => d.allEfficiency));
    const overallPres = getAvg(data.map(d => d.presEfficiency));
    const overallAbs = getAvg(data.map(d => d.absEfficiency));
    return (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-5 border-t border-slate-100">
            {data.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-center gap-2 truncate">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                        <span className="text-[13px] font-semibold text-slate-600 truncate max-w-[90px]" title={item.displayName || item.name}>{item.displayName || item.name}</span>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0 ml-2">
                        <span className="text-[13px] font-bold text-slate-800">{item.allEfficiency}%</span>
                        <span className="text-[12px] text-emerald-600">{t('charts.present')[0]}: {item.presEfficiency}%</span>
                        <span className="text-[11px] text-rose-500">{t('charts.absent')[0]}: {item.absEfficiency}%</span>
                    </div>
                </div>
            ))}
            <div className="col-span-2 sm:col-span-3 lg:col-span-4 flex items-center justify-between p-3.5 rounded-xl mt-1"
                style={{ backgroundColor: `${dotColor}15`, border: `1px solid ${dotColor}30` }}>
                <span className="text-sm font-bold" style={{ color: dotColor }}>{label} — {t('charts.total')}: {overallAll}% | {t('charts.present')}: {overallPres}% | {t('charts.absent')}: {overallAbs}%</span>
            </div>
        </div>
    );
};

// ─── Chart Section Wrapper ────────────────────────────────────────────────────
const ChartSection = ({ badge, title, dateText, tag, statsVisible, onToggleStats, children }) => {
    const { t } = useTranslate();
    return (
        <div className="space-y-3 p-7 border border-slate-100 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between border-b pb-4 border-slate-100">
                <div className="flex flex-col">
                    <h4 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                        {badge}
                        {title}
                    </h4>
                    {dateText && <span className="text-[12px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{dateText}</span>}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggleStats}
                        className="flex items-center gap-1.5 text-[13px] font-bold px-3 py-1.5 rounded-lg border transition-all duration-200
                            bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    >
                        {statsVisible
                            ? <><IconEyeOff className="h-4 w-4" /> {t('charts.hideStats')}</>
                            : <><IconEye className="h-4 w-4" /> {t('charts.showStats')}</>
                        }
                    </button>
                    {tag}
                </div>
            </div>
            {children}
        </div>
    );
};

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
            <text textAnchor="middle" fill="#334155" fontSize={14} fontWeight={700}>
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
    const { t } = useTranslate();
    const [f1, setF1] = useState(initF());
    const [f2, setF2] = useState(initF());
    const [f3, setF3] = useState(initF());
    const [f4, setF4] = useState(initF());
    const [f5, setF5] = useState(initF());
    const [f6, setF6] = useState(initF());

    const [statVis, setStatVis] = useState({ c1: false, c2: false, c3: false, c4: false, c5: false, c6: false });
    const toggleStat = (key) => setStatVis(prev => ({ ...prev, [key]: !prev[key] }));
    const [attendanceView, setAttendanceView] = useState('bar');

    const translateStatus = (name) => {
        if (name === 'Min Efficiency') return t('charts.minEff');
        if (name === 'Total Efficiency') return t('charts.totalEff');
        if (name === 'Present Efficiency') return t('charts.presentEff');
        if (name === 'Absent Efficiency') return t('charts.absentEff');
        if (name === 'Present') return t('charts.present');
        if (name === 'Absent') return t('charts.absent');
        return name;
    };

    const { data: summaryData, isLoading, error } = useGetSkillMatrixEfficiencySummaryQuery();
    const rawOps = useMemo(() => summaryData?.data || [], [summaryData]);

    // Defaulting to the current date (today) as per user request. useEffect that used mostRecentDateWithAttendance is removed since today's date is initialized in initF.

    const { data: subSectionsRaw } = useGetSubSectionsQuery({});
    const subSections = useMemo(() => subSectionsRaw?.data || [], [subSectionsRaw]);

    // Global average min/max efficiency across sub-sections that have values set — used as Chart 1 reference lines
    const globalEffTarget = useMemo(() => {
        const withMin = subSections.filter(s => s.minEfficiency != null);
        const withMax = subSections.filter(s => s.maxEfficiency != null);
        const avg = (arr, key) => arr.length
            ? Math.round(arr.reduce((a, s) => a + parseFloat(s[key]), 0) / arr.length * 100) / 100
            : null;
        return { min: avg(withMin, 'minEfficiency'), max: avg(withMax, 'maxEfficiency') };
    }, [subSections]);

    // lineId → sectionId / departmentId, sectionId → departmentId (built from rawOps — no extra API call)
    const hierarchyMap = useMemo(() => {
        const lineToSection = {};
        const lineToDept = {};
        const sectionToDept = {};
        rawOps.forEach(op => {
            const lid = String(op.lineId || '');
            const sid = String(op.sectionId || '');
            const did = String(op.departmentId || op.departmentName || '');

            if (lid) {
                if (sid) lineToSection[lid] = sid;
                if (did) lineToDept[lid] = did;
            }
            if (sid && did) {
                sectionToDept[sid] = did;
            }
        });
        return { lineToSection, lineToDept, sectionToDept };
    }, [rawOps]);

    // Sub-section min/max targets aggregated per line / section / department
    // Line Target: Average of sub-section targets under each line (rounded to nearest integer)
    const targetsByLine = useMemo(() => {
        const map = {};
        subSections.forEach(ss => {
            const lid = String(ss.lineId || '');
            if (!lid) return;
            if (!map[lid]) map[lid] = { minArr: [], maxArr: [] };
            map[lid].minArr.push(parseFloat(ss.minEfficiency) || 0);
            map[lid].maxArr.push(parseFloat(ss.maxEfficiency) || 0);
        });

        const averages = {};
        const roundedAvg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

        Object.entries(map).forEach(([lid, val]) => {
            averages[lid] = {
                min: roundedAvg(val.minArr),
                max: roundedAvg(val.maxArr)
            };
        });
        return averages;
    }, [subSections]);

    // Section Target: Average of Line targets under each section (rounded to nearest integer)
    const targetsBySection = useMemo(() => {
        const sectionLinesMap = {};
        Object.entries(hierarchyMap.lineToSection).forEach(([lid, sid]) => {
            if (!sectionLinesMap[sid]) sectionLinesMap[sid] = [];
            sectionLinesMap[sid].push(lid);
        });

        const averages = {};
        const roundedAvg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

        Object.entries(sectionLinesMap).forEach(([sid, lineIds]) => {
            if (!lineIds.length) return;
            const minVals = lineIds.map(lid => targetsByLine[lid]?.min ?? 0);
            const maxVals = lineIds.map(lid => targetsByLine[lid]?.max ?? 0);
            averages[sid] = {
                min: roundedAvg(minVals),
                max: roundedAvg(maxVals)
            };
        });
        return averages;
    }, [hierarchyMap.lineToSection, targetsByLine]);

    // Department Target: Average of Section targets under each department (rounded to nearest integer)
    const targetsByDept = useMemo(() => {
        const deptSectionsMap = {};
        Object.entries(hierarchyMap.sectionToDept).forEach(([sid, did]) => {
            if (!deptSectionsMap[did]) deptSectionsMap[did] = [];
            deptSectionsMap[did].push(sid);
        });

        const averages = {};
        const roundedAvg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

        Object.entries(deptSectionsMap).forEach(([did, sectionIds]) => {
            if (!sectionIds.length) return;
            const minVals = sectionIds.map(sid => targetsBySection[sid]?.min ?? 0);
            const maxVals = sectionIds.map(sid => targetsBySection[sid]?.max ?? 0);
            averages[did] = {
                min: roundedAvg(minVals),
                max: roundedAvg(maxVals)
            };
        });
        return averages;
    }, [hierarchyMap.sectionToDept, targetsBySection]);

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
            if (id && op.sectionName) {
                m[id] = op.sectionCategory ? `${op.sectionName} (${op.sectionCategory})` : op.sectionName;
            }
        });
        return Object.entries(m).map(([value, label]) => ({ value, label }));
    };

    const getLineOpts = (deptIds, sectionIds) => {
        const m = {};
        rawOps.forEach(op => {
            if (deptIds?.length && !deptIds.includes(String(op.departmentId || op.departmentName))) return;
            if (sectionIds?.length && !sectionIds.includes(String(op.sectionId || op.sectionName))) return;
            const id = String(op.lineId || op.lineName || '');
            if (id && op.lineName) m[id] = op.lineName;
        });
        return Object.entries(m).map(([value, label]) => ({ value, label }));
    };

    const getSubSectionOpts = (deptIds, sectionIds, lineIds) => {
        const m = {};
        rawOps.forEach(op => {
            if (deptIds?.length && !deptIds.includes(String(op.departmentId || op.departmentName))) return;
            if (sectionIds?.length && !sectionIds.includes(String(op.sectionId || op.sectionName))) return;
            if (lineIds?.length && !lineIds.includes(String(op.lineId || op.lineName))) return;
            const id = String(op.subSectionId || op.subSectionName || '');
            if (id && op.subSectionName) m[id] = op.subSectionName;
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
    const ss6Opts = useMemo(() => getSubSectionOpts(f6.deptIds, f6.sectionIds, f6.lineIds), [rawOps, f6.deptIds, f6.sectionIds, f6.lineIds]);

    // Unique operators list representing the overall software user database (latest record per userId):
    const uniqueOps = useMemo(() => {
        const map = {};
        rawOps.forEach(op => {
            const uid = op.userId;
            if (!uid) return;
            const d = getOpDate(op);
            if (!map[uid] || d > map[uid].date) {
                map[uid] = { op, date: d };
            }
        });
        return Object.values(map).map(item => item.op);
    }, [rawOps]);

    // Filtered ops per chart (All unique database operators vs date-based attendance logs)
    const opsAll1 = useMemo(() => applyFiltersNoDate(uniqueOps, f1), [uniqueOps, f1]);
    const opsAll2 = useMemo(() => applyFiltersNoDate(uniqueOps, f2), [uniqueOps, f2]);
    const opsAll3 = useMemo(() => applyFiltersNoDate(uniqueOps, f3), [uniqueOps, f3]);
    const opsAll4 = useMemo(() => applyFiltersNoDate(uniqueOps, f4), [uniqueOps, f4]);
    const opsAll5 = useMemo(() => applyFiltersNoDate(uniqueOps, f5), [uniqueOps, f5]);
    const opsAll6 = useMemo(() => applyFiltersNoDate(uniqueOps, f6), [uniqueOps, f6]);

    const opsAtt1 = useMemo(() => applyFilters(rawOps, f1), [rawOps, f1]);
    const opsAtt2 = useMemo(() => applyFilters(rawOps, f2), [rawOps, f2]);
    const opsAtt3 = useMemo(() => applyFilters(rawOps, f3), [rawOps, f3]);
    const opsAtt4 = useMemo(() => applyFilters(rawOps, f4), [rawOps, f4]);
    const opsAtt5 = useMemo(() => applyFilters(rawOps, f5), [rawOps, f5]);
    const opsAtt6 = useMemo(() => applyFilters(rawOps, f6), [rawOps, f6]);

    // Effective shifts per filtered set (based on all database operators)
    const effShifts = (ops, filterShifts) => {
        if (filterShifts?.length) return filterShifts;
        const s = new Set();
        ops.forEach(op => { const sh = op.shift || op.shiftName; if (sh) s.add(String(sh)); });
        return [...s].sort();
    };

    const sh5 = useMemo(() => effShifts(opsAll5, f5.shifts), [opsAll5, f5.shifts]);

    // Master lists ignoring date filters but keeping other dropdown selectors:
    const allDepts = useMemo(() => {
        const m = {};
        uniqueOps.forEach(op => {
            const id = String(op.departmentId || op.departmentName || '');
            if (id && op.departmentName) m[id] = op.departmentName;
        });
        let list = Object.entries(m).map(([id, name]) => ({ id, name }));
        if (f1.deptIds?.length) {
            list = list.filter(item => f1.deptIds.includes(item.id));
        }
        return list;
    }, [uniqueOps, f1.deptIds]);

    const allSections = useMemo(() => {
        const m = {};
        uniqueOps.forEach(op => {
            if (f2.deptIds?.length && !f2.deptIds.includes(String(op.departmentId || op.departmentName))) return;
            const id = String(op.sectionId || op.sectionName || '');
            if (id && op.sectionName) {
                m[id] = op.sectionCategory ? `${op.sectionName} (${op.sectionCategory})` : op.sectionName;
            }
        });
        let list = Object.entries(m).map(([id, name]) => ({ id, name }));
        if (f2.sectionIds?.length) {
            list = list.filter(item => f2.sectionIds.includes(item.id));
        }
        return list;
    }, [uniqueOps, f2.deptIds, f2.sectionIds]);

    const allLines = useMemo(() => {
        const m = {};
        uniqueOps.forEach(op => {
            if (f3.deptIds?.length && !f3.deptIds.includes(String(op.departmentId || op.departmentName))) return;
            if (f3.sectionIds?.length && !f3.sectionIds.includes(String(op.sectionId || op.sectionName))) return;
            const id = String(op.lineId || op.lineName || '');
            if (id && op.lineName) m[id] = op.lineName;
        });
        let list = Object.entries(m).map(([id, name]) => ({ id, name }));
        if (f3.lineIds?.length) {
            list = list.filter(item => f3.lineIds.includes(item.id));
        }
        return list;
    }, [uniqueOps, f3.deptIds, f3.sectionIds, f3.lineIds]);

    const allSubSections = useMemo(() => {
        const m = {};
        uniqueOps.forEach(op => {
            if (f4.deptIds?.length && !f4.deptIds.includes(String(op.departmentId || op.departmentName))) return;
            if (f4.sectionIds?.length && !f4.sectionIds.includes(String(op.sectionId || op.sectionName))) return;
            if (f4.lineIds?.length && !f4.lineIds.includes(String(op.lineId || op.lineName))) return;
            const id = String(op.subSectionId || op.subSectionName || '');
            if (id && op.subSectionName) m[id] = op.subSectionName;
        });
        let list = Object.entries(m).map(([id, name]) => ({ id, name }));
        return list;
    }, [uniqueOps, f4.deptIds, f4.sectionIds, f4.lineIds]);

    const allOperators = useMemo(() => {
        const m = {};
        uniqueOps.forEach(op => {
            if (f6.deptIds?.length && !f6.deptIds.includes(String(op.departmentId || op.departmentName))) return;
            if (f6.sectionIds?.length && !f6.sectionIds.includes(String(op.sectionId || op.sectionName))) return;
            if (f6.lineIds?.length && !f6.lineIds.includes(String(op.lineId || op.lineName))) return;
            if (f6.subSectionIds?.length && !f6.subSectionIds.includes(String(op.subSectionId || op.subSectionName))) return;
            const uid = op.userId;
            if (uid) {
                m[uid] = {
                    id: uid,
                    name: op.fullName || 'Unknown',
                    empId: op.empId || 'N/A',
                    efficiency: calculateUserEfficiency(op),
                    status: 'Absent'
                };
            }
        });
        return Object.values(m);
    }, [uniqueOps, f6.deptIds, f6.sectionIds, f6.lineIds, f6.subSectionIds]);

    // Chart data — hierarchical rollups (Sub-Section ← users; Line ← sub-sections; Section ← lines; Department ← sections)
    const d1 = useMemo(() => {
        const base = buildHierarchicalData(opsAll1, opsAtt1, 'department', allDepts);
        return base.map(item => {
            const tgt = targetsByDept[item.id] || {};
            return { ...item, minEffTarget: tgt.min ?? null, maxEffTarget: tgt.max ?? null };
        });
    }, [opsAll1, opsAtt1, targetsByDept, allDepts]);

    const d2 = useMemo(() => {
        const base = buildHierarchicalData(opsAll2, opsAtt2, 'section', allSections);
        return base.map(item => {
            const tgt = targetsBySection[item.id] || {};
            return { ...item, minEffTarget: tgt.min ?? null, maxEffTarget: tgt.max ?? null };
        });
    }, [opsAll2, opsAtt2, targetsBySection, allSections]);

    const d3 = useMemo(() => {
        const base = buildHierarchicalData(opsAll3, opsAtt3, 'line', allLines);
        return base.map(item => {
            const tgt = targetsByLine[item.id] || {};
            return { ...item, minEffTarget: tgt.min ?? null, maxEffTarget: tgt.max ?? null };
        });
    }, [opsAll3, opsAtt3, targetsByLine, allLines]);

    const d4 = useMemo(() => {
        const base = buildHierarchicalData(opsAll4, opsAtt4, 'subsection', allSubSections);
        return base.map(item => {
            const ss = subSections.find(s => String(s.id) === String(item.id));
            return {
                ...item,
                minEffTarget: ss?.minEfficiency != null ? Math.round(parseFloat(ss.minEfficiency)) : null,
                maxEffTarget: ss?.maxEfficiency != null ? Math.round(parseFloat(ss.maxEfficiency)) : null,
            };
        });
    }, [opsAll4, opsAtt4, subSections, allSubSections]);

    // Helper to calculate dynamic target based on hierarchy filters
    const getFilteredMinTarget = (filter) => {
        const roundedAvg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

        if (filter.lineIds?.length) {
            const mins = filter.lineIds.map(id => targetsByLine[id]?.min ?? 0);
            if (mins.length) return roundedAvg(mins);
        }
        if (filter.sectionIds?.length) {
            const mins = filter.sectionIds.map(id => targetsBySection[id]?.min ?? 0);
            if (mins.length) return roundedAvg(mins);
        }
        if (filter.deptIds?.length) {
            const mins = filter.deptIds.map(id => targetsByDept[id]?.min ?? 0);
            if (mins.length) return roundedAvg(mins);
        }

        // Fallback: Average of all departments in the system, treating unconfigured ones as 0
        if (allDeptOpts.length) {
            const mins = allDeptOpts.map(d => targetsByDept[d.value]?.min ?? 0);
            return roundedAvg(mins);
        }

        return globalEffTarget.min != null ? Math.round(globalEffTarget.min) : null;
    };

    // Chart 1: Attendance-wise — fixed buckets: Min (if configured), Total, Present, Absent
    const d5 = useMemo(() => {
        const presOps = opsAtt5.filter(op => PRESENT_STATUSES.has(op.logStatus));
        const absOps = opsAtt5.filter(op => op.logStatus && !PRESENT_STATUSES.has(op.logStatus));

        const allEffs = opsAll5.map(calculateUserEfficiency);
        const presEffs = presOps.map(calculateUserEfficiency);
        const absEffs = absOps.map(calculateUserEfficiency);

        const items = [];
        const tMin = getFilteredMinTarget(f5);
        const totalCount = opsAll5.length;
        const tAll = totalCount ? getAvg(allEffs) : 0;
        const tPres = totalCount ? Math.round((getSum(presEffs) / totalCount) * 100) / 100 : 0;
        const tAbs = totalCount ? Math.round((getSum(absEffs) / totalCount) * 100) / 100 : 0;

        if (tMin != null) {
            items.push({
                name: 'Min Efficiency',
                displayName: 'Min Efficiency',
                efficiency: tMin,
                isTarget: true,
                count: 0,
                evaluated: 0
            });
        }

        items.push(
            { name: 'Total Efficiency', displayName: 'Total Efficiency', efficiency: tAll, count: opsAll5.length, evaluated: opsAll5.filter(op => op.currentEffeciency != null || op.evalData != null).length },
            { name: 'Present Efficiency', displayName: 'Present Efficiency', efficiency: tPres, count: presOps.length, evaluated: presOps.filter(op => op.currentEffeciency != null || op.evalData != null).length },
            { name: 'Absent Efficiency', displayName: 'Absent Efficiency', efficiency: tAbs, count: absOps.length, evaluated: absOps.filter(op => op.currentEffeciency != null || op.evalData != null).length },
        );
        return items;
    }, [opsAll5, opsAtt5, f5, targetsByLine, targetsBySection, targetsByDept, globalEffTarget]);

    const d5Mapped = useMemo(() => d5.map(item => ({ ...item, displayName: translateStatus(item.name) })), [d5, t]);

    // Chart 6: Operator-wise (single bar — overall efficiency, color-coded by attendance)
    const d6 = useMemo(() => {
        const statusMap = {};
        opsAtt6.forEach(op => {
            if (op.userId) {
                statusMap[op.userId] = op.logStatus || 'Absent';
            }
        });
        return allOperators.map(op => {
            return {
                ...op,
                status: statusMap[op.id] || 'Absent'
            };
        }).sort((a, b) => b.efficiency - a.efficiency);
    }, [allOperators, opsAtt6]);

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
                {t('charts.failedToLoadEff')}
            </CardContent>
        </Card>
    );

    const commonMargin = { top: 42, right: 24, left: -10, bottom: 56 };
    const axisTick = { fill: '#334155', fontSize: 14, fontWeight: 700 };

    const ChartWrapper = ({ data, minW = 110, children }) => (
        <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 pb-2 mt-4">
            <div style={{ width: '100%', minWidth: `${Math.max(480, data.length * minW)}px` }} className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                    {children}
                </ResponsiveContainer>
            </div>
        </div>
    );

    return (
        <Card className="col-span-1 lg:col-span-2 border border-slate-100 shadow-sm rounded-3xl overflow-hidden bg-white text-black font-sans">
            {/* <CardHeader className="pb-5 border-b border-slate-50">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-slate-800 text-xl font-bold">
                        <IconChartBar className="h-6 w-6 text-indigo-600 animate-pulse" />
                        Hierarchical Efficiency Dashboard
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-sm mt-1">
                        Each chart has independent filters · Two bars per group: Total Efficiency vs Present Users · Default Date: Current Date ({new Date().toLocaleDateString('en-CA')})
                    </CardDescription>
                </div>
            </CardHeader> */}

            <CardContent className="p-6">
                <div className="grid grid-cols-1 gap-10">

                    {/* ── CHART 1: Attendance-Wise Efficiency ── */}
                    <ChartSection
                        badge={<span className="text-violet-600">{t('charts.chart1')}</span>}
                        title={t('charts.attendanceWiseEff')}
                        dateText={getDateText(f5, t)}
                        tag={<span className="bg-violet-50 text-violet-700 text-[12px] font-extrabold py-1 px-2.5 rounded uppercase tracking-wider">{t('charts.byStatus')}</span>}
                        statsVisible={statVis.c5} onToggleStats={() => toggleStat('c5')}
                    >
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                            <ViewToggle view={attendanceView} onChange={setAttendanceView} />
                        </div>
                        <ChartFilter filter={f5} setFilter={setF5}
                            deptOpts={allDeptOpts} sectionOpts={s5Opts} lineOpts={l5Opts}
                            shiftOpts={allShifts}
                            showDept={true} showSection={true} showLine={true} hideLegend={true} />
                        {(globalEffTarget.min != null) && (
                            <div className="flex flex-wrap items-center gap-4 mt-3">
                                <span className="text-[12px] text-slate-400 italic">{t('charts.minEffTargetAvgAll')}</span>
                            </div>
                        )}
                        {d5Mapped.length > 0 ? (
                            <>
                                {attendanceView === 'bar' ? (
                                    <>
                                        <ChartWrapper data={d5Mapped} minW={160}>
                                            <BarChart data={d5Mapped} margin={commonMargin} barCategoryGap="35%">
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" strokeWidth={1} vertical={false} />
                                                <XAxis dataKey="displayName" tick={<CustomXAxisTick />} tickLine={false} axisLine={false} interval={0} />
                                                <YAxis domain={[0, dataMax => Math.max(100, Math.ceil(dataMax / 10) * 10)]} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                                                <Bar dataKey="efficiency" radius={[10, 10, 0, 0]} maxBarSize={52}>
                                                    {d5Mapped.map((entry, i) => (
                                                        <Cell key={i} fill={getAttBarColor(entry.name)} opacity={entry.isTarget ? 0.65 : 1} />
                                                    ))}
                                                    <LabelList dataKey="efficiency" content={barLabel(0, '#1e293b')} />
                                                </Bar>
                                            </BarChart>
                                        </ChartWrapper>
                                        <div className="flex flex-wrap justify-center items-center gap-5 mt-4">
                                            {d5Mapped.some(item => item.isTarget) && (
                                                <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-500">
                                                    <span className="w-4 h-3 rounded-sm inline-block" style={{ backgroundColor: '#386641' }} /> {t('charts.minEff')}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-500">
                                                <span className="w-4 h-3 rounded-sm inline-block" style={{ backgroundColor: '#f59e0b' }} /> {t('charts.totalEff')}
                                            </span>
                                            <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-500">
                                                <span className="w-4 h-3 rounded-sm inline-block" style={{ backgroundColor: 'blue' }} /> {t('charts.presentEff')}
                                            </span>
                                            <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-500">
                                                <span className="w-4 h-3 rounded-sm inline-block" style={{ backgroundColor: 'red' }} /> {t('charts.absentEff')}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full mt-4 h-[360px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={d5Mapped.filter(item => !item.isTarget)}
                                                    dataKey="efficiency"
                                                    nameKey="displayName"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={130}
                                                    label={({ name, value }) => `${name}: ${value}%`}
                                                    labelLine
                                                >
                                                    {d5Mapped.filter(item => !item.isTarget).map((entry, idx) => (
                                                        <Cell key={`att-${idx}`} fill={getAttBarColor(entry.name)} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(v) => `${v}%`} />
                                                <Legend verticalAlign="bottom" align="center" iconType="rect" iconSize={14} wrapperStyle={{ paddingTop: '20px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                                {statVis.c5 && (
                                    <div className="mt-5 grid grid-cols-3 gap-3 pt-5 border-t border-slate-100">
                                        {d5Mapped.filter(item => !item.isTarget).map(item => (
                                            <div key={item.name}
                                                className="flex flex-col gap-1 p-3.5 rounded-xl border"
                                                style={{ backgroundColor: `${getAttBarColor(item.name)}15`, borderColor: `${getAttBarColor(item.name)}30` }}>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm font-bold" style={{ color: getAttBarColor(item.name) }}>{item.displayName}</p>
                                                    <span className="text-lg font-black text-slate-800">{item.efficiency}%</span>
                                                </div>
                                                <p className="text-[12px] text-slate-500">
                                                    {item.evaluated} {t('charts.evaluatedOf')} {item.count} {t('charts.totalLower')}
                                                </p>
                                                {item.count > item.evaluated && (
                                                    <p className="text-[11px] font-semibold text-amber-500">
                                                        {item.count - item.evaluated} {t('charts.notYetEvaluated')}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : <EmptyState msg={t('charts.noAttendanceData')} sub={t('charts.adjustFiltersData')} />}
                    </ChartSection>

                    {/* ── CHART 2: Department Averages ── */}
                    <ChartSection
                        badge={<span className="text-indigo-600">{t('charts.chart2')}</span>}
                        title={t('charts.deptWiseEff')}
                        dateText={getDateText(f1, t)}
                        tag={<span className="bg-indigo-50 text-indigo-700 text-[12px] font-extrabold py-1 px-2.5 rounded uppercase tracking-wider">{t('charts.deptLevel')}</span>}
                        statsVisible={statVis.c1} onToggleStats={() => toggleStat('c1')}
                    >
                        <ChartFilter filter={f1} setFilter={setF1}
                            deptOpts={allDeptOpts} sectionOpts={[]} lineOpts={[]}
                            shiftOpts={allShifts}
                            showDept={true} showSection={false} showLine={false} hideShift={false} />
                        <div className="flex flex-wrap items-center gap-4 mt-3">
                            <span className="text-[12px] text-slate-400 italic">{t('charts.minEffTargetAvgDept')}</span>
                        </div>
                        {d1.length > 0 ? (
                            <>
                                <ChartWrapper data={d1} minW={300}>
                                    <BarChart data={d1} margin={commonMargin} barCategoryGap="25%" barGap={10}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" strokeWidth={1} vertical={false} />
                                        <XAxis dataKey="name" tick={<CustomXAxisTick />} tickLine={false} axisLine={false} interval={0} />
                                        <YAxis domain={[0, dataMax => Math.max(100, Math.ceil(dataMax / 10) * 10)]} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                                        <Bar dataKey="minEffTarget" name={t('charts.minEff')} fill="#386641" radius={[10, 10, 0, 0]} maxBarSize={56} minPointSize={3}>
                                            <LabelList dataKey="minEffTarget" content={barLabel(6, '#386641')} />
                                        </Bar>
                                        <Bar dataKey="allEfficiency" name={t('charts.totalEff')} fill="#f59e0b" radius={[10, 10, 0, 0]} maxBarSize={56} minPointSize={3}>
                                            <LabelList dataKey="allEfficiency" content={barLabel(22, '#1e293b')} />
                                        </Bar>
                                        <Bar dataKey="presEfficiency" name={t('charts.presentEff')} fill="blue" radius={[10, 10, 0, 0]} maxBarSize={56} minPointSize={3}>
                                            <LabelList dataKey="presEfficiency" content={barLabel(38, 'blue')} />
                                        </Bar>
                                        <Bar dataKey="absEfficiency" name={t('charts.absentEff')} fill="red" radius={[10, 10, 0, 0]} maxBarSize={56} minPointSize={3}>
                                            <LabelList dataKey="absEfficiency" content={barLabel(54, 'red')} />
                                        </Bar>
                                    </BarChart>
                                </ChartWrapper>
                                <FrozenLegend minEffVisible={true} allUsersColor="#f59e0b" />
                                {statVis.c1 && <SummaryCapsules data={d1} dotColor="#f59e0b" label={t('charts.deptEfficiency')} />}
                            </>
                        ) : <EmptyState msg={t('charts.noDeptData')} />}
                    </ChartSection>

                    {/* ── CHART 3: Section Averages ── */}
                    <ChartSection
                        badge={<span className="text-emerald-600">{t('charts.chart3')}</span>}
                        title={t('charts.sectionWiseEff')}
                        dateText={getDateText(f2, t)}
                        tag={<span className="bg-emerald-50 text-emerald-700 text-[12px] font-extrabold py-1 px-2.5 rounded uppercase tracking-wider">{t('charts.sectionLevel')}</span>}
                        statsVisible={statVis.c2} onToggleStats={() => toggleStat('c2')}
                    >
                        <ChartFilter filter={f2} setFilter={setF2}
                            deptOpts={allDeptOpts} sectionOpts={s2Opts} lineOpts={[]}
                            shiftOpts={allShifts}
                            showDept={true} showSection={false} showLine={false} hideShift={false} />
                        <div className="flex flex-wrap items-center gap-4 mt-3">
                            <span className="text-[12px] text-slate-400 italic">{t('charts.minEffTargetAvgSection')}</span>
                        </div>
                        {d2.length > 0 ? (
                            <>
                                <ChartWrapper data={d2} minW={300}>
                                    <BarChart data={d2} margin={commonMargin} barCategoryGap="25%" barGap={10}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" strokeWidth={1} vertical={false} />
                                        <XAxis dataKey="name" tick={<CustomXAxisTick />} tickLine={false} axisLine={false} interval={0} />
                                        <YAxis domain={[0, dataMax => Math.max(100, Math.ceil(dataMax / 10) * 10)]} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                                        <Bar dataKey="minEffTarget" name={t('charts.minEff')} fill="#386641" radius={[10, 10, 0, 0]} maxBarSize={56} minPointSize={3}>
                                            <LabelList dataKey="minEffTarget" content={barLabel(6, '#386641')} />
                                        </Bar>
                                        <Bar dataKey="allEfficiency" name={t('charts.totalEff')} fill="#f59e0b" radius={[10, 10, 0, 0]} maxBarSize={56} minPointSize={3}>
                                            <LabelList dataKey="allEfficiency" content={barLabel(22, '#1e293b')} />
                                        </Bar>
                                        <Bar dataKey="presEfficiency" name={t('charts.presentEff')} fill="blue" radius={[10, 10, 0, 0]} maxBarSize={56} minPointSize={3}>
                                            <LabelList dataKey="presEfficiency" content={barLabel(38, 'blue')} />
                                        </Bar>
                                        <Bar dataKey="absEfficiency" name={t('charts.absentEff')} fill="red" radius={[10, 10, 0, 0]} maxBarSize={56} minPointSize={3}>
                                            <LabelList dataKey="absEfficiency" content={barLabel(54, 'red')} />
                                        </Bar>
                                    </BarChart>
                                </ChartWrapper>
                                <FrozenLegend minEffVisible={true} allUsersColor="#f59e0b" />
                                {statVis.c2 && <SummaryCapsules data={d2} dotColor="#f59e0b" label={t('charts.sectionEfficiency')} />}
                            </>
                        ) : <EmptyState msg={t('charts.noSectionData')} sub={t('charts.selectDeptSections')} />}
                    </ChartSection>

                    {/* ── CHART 4: Line Averages ── */}
                    <ChartSection
                        badge={<span className="text-amber-600">{t('charts.chart4')}</span>}
                        title={t('charts.lineWiseEff')}
                        dateText={getDateText(f3, t)}
                        tag={<span className="bg-amber-50 text-amber-700 text-[12px] font-extrabold py-1 px-2.5 rounded uppercase tracking-wider">{t('charts.lineLevel')}</span>}
                        statsVisible={statVis.c3} onToggleStats={() => toggleStat('c3')}
                    >
                        <ChartFilter filter={f3} setFilter={setF3}
                            deptOpts={allDeptOpts} sectionOpts={s3Opts} lineOpts={l3Opts}
                            shiftOpts={allShifts}
                            showDept={true} showSection={true} showLine={false} hideShift={false} />
                        <div className="flex flex-wrap items-center gap-4 mt-3">
                            <span className="text-[12px] text-slate-400 italic">{t('charts.minEffTargetAvgLine')}</span>
                        </div>
                        {d3.length > 0 ? (
                            <>
                                <ChartWrapper data={d3} minW={300}>
                                    <BarChart data={d3} margin={commonMargin} barCategoryGap="25%" barGap={10}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" strokeWidth={1} vertical={false} />
                                        <XAxis dataKey="name" tick={<CustomXAxisTick />} tickLine={false} axisLine={false} interval={0} />
                                        <YAxis domain={[0, dataMax => Math.max(100, Math.ceil(dataMax / 10) * 10)]} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                                        <Bar dataKey="minEffTarget" name={t('charts.minEff')} fill="#386641" radius={[10, 10, 0, 0]} maxBarSize={56} minPointSize={3}>
                                            <LabelList dataKey="minEffTarget" content={barLabel(6, '#386641')} />
                                        </Bar>
                                        <Bar dataKey="allEfficiency" name={t('charts.totalEff')} fill="#f59e0b" radius={[10, 10, 0, 0]} maxBarSize={56} minPointSize={3}>
                                            <LabelList dataKey="allEfficiency" content={barLabel(22, '#1e293b')} />
                                        </Bar>
                                        <Bar dataKey="presEfficiency" name={t('charts.presentEff')} fill="blue" radius={[10, 10, 0, 0]} maxBarSize={56} minPointSize={3}>
                                            <LabelList dataKey="presEfficiency" content={barLabel(38, 'blue')} />
                                        </Bar>
                                        <Bar dataKey="absEfficiency" name={t('charts.absentEff')} fill="red" radius={[10, 10, 0, 0]} maxBarSize={56} minPointSize={3}>
                                            <LabelList dataKey="absEfficiency" content={barLabel(54, 'red')} />
                                        </Bar>
                                    </BarChart>
                                </ChartWrapper>
                                <FrozenLegend minEffVisible={true} allUsersColor="#f59e0b" />
                                {statVis.c3 && <SummaryCapsules data={d3} dotColor="#f59e0b" label={t('charts.lineEfficiency')} />}
                            </>
                        ) : <EmptyState msg={t('charts.noLineData')} sub={t('charts.selectSectionLines')} />}
                    </ChartSection>

                    {/* ── CHART 5: Sub-section Averages ── */}
                    <ChartSection
                        badge={<span className="text-amber-600">{t('charts.chart5')}</span>}
                        title={t('charts.subsectionWiseEff')}
                        dateText={getDateText(f4, t)}
                        tag={<span className="bg-amber-50 text-amber-700 text-[12px] font-extrabold py-1 px-2.5 rounded uppercase tracking-wider">{t('charts.subsection')}</span>}
                        statsVisible={statVis.c4} onToggleStats={() => toggleStat('c4')}
                    >
                        <ChartFilter filter={f4} setFilter={setF4}
                            deptOpts={allDeptOpts} sectionOpts={s4Opts} lineOpts={l4Opts}
                            shiftOpts={allShifts}
                            showDept={true} showSection={true} showLine={true} hideShift={false} />
                        <div className="flex flex-wrap items-center gap-4 mt-3">
                            <span className="text-[12px] text-slate-400 italic">{t('charts.minEffTargetShownOnly')}</span>
                        </div>
                        {d4.length > 0 ? (
                            <>
                                <ChartWrapper data={d4} minW={300}>
                                    <BarChart data={d4} margin={commonMargin} barCategoryGap="25%" barGap={10}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" strokeWidth={1} vertical={false} />
                                        <XAxis dataKey="name" tick={<CustomXAxisTick />} tickLine={false} axisLine={false} interval={0} />
                                        <YAxis domain={[0, dataMax => Math.max(100, Math.ceil(dataMax / 10) * 10)]} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                                        <Bar dataKey="minEffTarget" name={t('charts.minEff')} fill="#386641" radius={[10, 10, 0, 0]} maxBarSize={56} minPointSize={3}>
                                            <LabelList dataKey="minEffTarget" content={barLabel(6, '#386641')} />
                                        </Bar>
                                        <Bar dataKey="allEfficiency" name={t('charts.totalEff')} fill="#f59e0b" radius={[10, 10, 0, 0]} maxBarSize={56} minPointSize={3}>
                                            <LabelList dataKey="allEfficiency" content={barLabel(22, '#1e293b')} />
                                        </Bar>
                                        <Bar dataKey="presEfficiency" name={t('charts.presentEff')} fill="blue" radius={[10, 10, 0, 0]} maxBarSize={56} minPointSize={3}>
                                            <LabelList dataKey="presEfficiency" content={barLabel(38, 'blue')} />
                                        </Bar>
                                        <Bar dataKey="absEfficiency" name={t('charts.absentEff')} fill="red" radius={[10, 10, 0, 0]} maxBarSize={56} minPointSize={3}>
                                            <LabelList dataKey="absEfficiency" content={barLabel(54, 'red')} />
                                        </Bar>
                                    </BarChart>
                                </ChartWrapper>
                                <FrozenLegend minEffVisible={true} allUsersColor="#f59e0b" />
                                {statVis.c4 && <SummaryCapsules data={d4} dotColor="#f59e0b" label={t('charts.subsectionEfficiency')} />}
                            </>
                        ) : <EmptyState msg={t('charts.noSubsectionData')} sub={t('charts.selectLineSubsections')} />}
                    </ChartSection>

                    {/* ── CHART 6: Operator-Wise Efficiency ── */}
                    <ChartSection
                        badge={<span className="text-sky-600">{t('charts.chart6')}</span>}
                        title={t('charts.operatorWiseEff')}
                        dateText={getDateText(f6, t)}
                        tag={<span className="bg-sky-50 text-sky-700 text-[12px] font-extrabold py-1 px-2.5 rounded uppercase tracking-wider">{t('charts.individual')}</span>}
                        statsVisible={statVis.c6} onToggleStats={() => toggleStat('c6')}
                    >
                        <ChartFilter filter={f6} setFilter={setF6}
                            deptOpts={allDeptOpts} sectionOpts={s6Opts} lineOpts={l6Opts} subSectionOpts={ss6Opts}
                            shiftOpts={allShifts}
                            showDept={true} showSection={true} showLine={true} showSubSection={true} hideLegend={true} />
                        {d6.length > 0 ? (
                            <>
                                <ChartWrapper data={d6} minW={80}>
                                    <BarChart data={d6} margin={commonMargin} barCategoryGap="40%">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" strokeWidth={1} vertical={false} />
                                        <XAxis
                                            dataKey="name"
                                            interval={0}
                                            tick={<CustomXAxisTick />}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis domain={[0, dataMax => Math.max(100, Math.ceil(dataMax / 10) * 10)]} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                                        <Bar dataKey="efficiency" radius={[10, 10, 0, 0]} maxBarSize={52}>
                                            {d6.map((entry, index) => (
                                                <Cell key={`op-${index}`}
                                                    fill={PRESENT_STATUSES.has(entry.status) ? 'blue' : 'red'} />
                                            ))}
                                            <LabelList dataKey="efficiency" content={barLabel(0, '#1e293b')} />
                                        </Bar>
                                    </BarChart>
                                </ChartWrapper>
                                {/* Legend for Chart 6 only at bottom center */}
                                <div className="flex justify-center items-center gap-5 mt-4">
                                    <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-500">
                                        <span className="w-4 h-3 rounded-sm inline-block" style={{ backgroundColor: 'blue' }} /> {t('charts.present')}
                                    </span>
                                    <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-500">
                                        <span className="w-4 h-3 rounded-sm inline-block" style={{ backgroundColor: 'red' }} /> {t('charts.absent')}
                                    </span>
                                </div>
                                {statVis.c6 && (
                                    <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-slate-100">
                                        <div className="col-span-2 flex items-center justify-between p-3.5 rounded-xl bg-sky-50 border border-sky-100">
                                            <span className="text-sm font-bold text-sky-700">{t('charts.overallAvgEfficiency')}</span>
                                            <span className="text-sm font-black text-sky-900">
                                                {d6.length > 0 ? getAvg(d6.map(op => op.efficiency)) : 0}%
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 border border-emerald-100">
                                            <span className="text-sm font-bold text-emerald-700">{t('charts.present')}</span>
                                            <span className="text-sm font-black text-emerald-900">{d6.filter(op => PRESENT_STATUSES.has(op.status)).length}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-rose-50 border border-rose-100">
                                            <span className="text-sm font-bold text-rose-700">{t('charts.absent')}</span>
                                            <span className="text-sm font-black text-rose-900">{d6.filter(op => !PRESENT_STATUSES.has(op.status)).length}</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : <EmptyState msg={t('charts.noOperatorData')} sub={t('charts.adjustFiltersOperators')} />}
                    </ChartSection>

                </div>
            </CardContent>
        </Card>
    );
};

export default EfficiencyChart;
