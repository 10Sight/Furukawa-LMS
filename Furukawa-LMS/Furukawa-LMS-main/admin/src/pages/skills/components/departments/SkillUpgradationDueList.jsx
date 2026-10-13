import React, { useMemo, useState } from "react";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/common/ui/button.jsx";
import { Badge } from "@/components/common/ui/badge.jsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/common/ui/tabs.jsx";

const QUARTERS = [
    { key: "q1", label: "Jan-March" },
    { key: "q2", label: "April-June" },
    { key: "q3", label: "July-Sep" },
    { key: "q4", label: "Oct-Dec" },
];

const VIEWS = [
    { key: "year", label: "Year" },
    { key: "month", label: "Month" },
    { key: "day", label: "Day" },
];

const pad = (n) => String(n).padStart(2, "0");

// Plan dates are stored as plain "YYYY-MM-DD" strings, so a period is matched by its string
// prefix ("2026", "2026-10", "2026-10-13") — no Date parsing, no timezone shifts.
const periodPrefix = (view, anchor) => {
    const y = anchor.getFullYear();
    if (view === "year") return `${y}`;
    const ym = `${y}-${pad(anchor.getMonth() + 1)}`;
    return view === "month" ? ym : `${ym}-${pad(anchor.getDate())}`;
};

const periodLabel = (view, anchor) => {
    if (view === "year") return String(anchor.getFullYear());
    if (view === "month") return anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    return anchor.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const shiftAnchor = (view, anchor, delta) => {
    if (view === "year") return new Date(anchor.getFullYear() + delta, anchor.getMonth(), 1);
    if (view === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
    return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + delta);
};

const formatDate = (dateStr) => {
    const [y, m, d] = String(dateStr).split("-");
    return y && m && d ? `${d}-${m}-${y}` : dateStr;
};

const ACCENTS = {
    blue: { spinner: "border-blue-600", iconWrap: "bg-blue-50", icon: "text-blue-300" },
    amber: { spinner: "border-amber-500", iconWrap: "bg-amber-50", icon: "text-amber-300" },
};

// One entry per associate per quarter that still has a pending upgradation: a target skill
// level and a plan date are set, and it hasn't been completed yet. Works for both sheets:
// the Multi-Skilling sheet stores Model & Line / Station per quarter, the Skill Upgradation
// sheet stores them once per row.
const collectPendingUpgradations = (plans, lineName) => {
    const entries = [];
    (plans || []).forEach((plan) => {
        const tableData = plan?.tableData && typeof plan.tableData === "object" ? plan.tableData : {};
        const removedIds = new Set((tableData.__removedUserIds || []).map(String));
        Object.keys(tableData).forEach((userId) => {
            if (userId === "__removedUserIds" || removedIds.has(userId)) return;
            const data = tableData[userId] || {};
            QUARTERS.forEach(({ key, label }) => {
                const skill = data[`${key}Skill`];
                const planDate = data[`${key}Date`];
                const modelLine = data[`${key}ModelLine`] || data.modelLine || "";
                if (!skill || !planDate) return;
                if (lineName && modelLine !== lineName) return;
                if (data[`${key}DateActual`] || data[`${key}Status`] === "Completed") return;
                entries.push({
                    id: `${plan.id || plan.year}-${userId}-${key}`,
                    plan,
                    userName: data.userName || "",
                    cardNo: data.cardNo || "",
                    modelLine,
                    station: data[`${key}Station`] || data.station || "",
                    shift: data[`${key}Shift`] || data.shift || "",
                    quarter: label,
                    skill,
                    planDate: String(planDate).slice(0, 10),
                    status: data[`${key}Status`] || "Planned",
                });
            });
        });
    });
    return entries.sort((a, b) => a.planDate.localeCompare(b.planDate) || a.userName.localeCompare(b.userName));
};

const SkillUpgradationDueList = ({ plans = [], lineName = "", loading = false, onOpenPlan, accent = "blue" }) => {
    const accentClasses = ACCENTS[accent] || ACCENTS.blue;
    const [view, setView] = useState("year");
    const [anchor, setAnchor] = useState(() => new Date());

    const pending = useMemo(() => collectPendingUpgradations(plans, lineName), [plans, lineName]);
    const prefix = periodPrefix(view, anchor);
    const rows = useMemo(() => pending.filter(entry => entry.planDate.startsWith(prefix)), [pending, prefix]);
    const isCurrentPeriod = prefix === periodPrefix(view, new Date());

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Tabs value={view} onValueChange={setView}>
                    <TabsList className="flex gap-2 w-fit bg-gray-100 p-1 rounded-md h-auto">
                        {VIEWS.map(({ key, label }) => (
                            <TabsTrigger key={key} value={key} className="text-xs font-bold px-4 py-2">{label}</TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="h-9 px-3 text-xs font-bold text-slate-600 border-slate-200">
                        {rows.length} {rows.length === 1 ? "Associate" : "Associates"}
                    </Badge>
                    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1 h-9 shadow-sm">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAnchor(prev => shiftAnchor(view, prev, -1))} aria-label="Previous period">
                            <IconChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="min-w-[8.5rem] text-center text-sm font-bold text-slate-800 tabular-nums">{periodLabel(view, anchor)}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAnchor(prev => shiftAnchor(view, prev, 1))} aria-label="Next period">
                            <IconChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <Button variant="outline" onClick={() => setAnchor(new Date())} disabled={isCurrentPeriod} className="h-9 text-xs font-semibold border-slate-200">
                        {view === "day" ? "Today" : view === "month" ? "This Month" : "This Year"}
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <div className={`animate-spin rounded-full h-8 w-8 border-b-2 mb-4 ${accentClasses.spinner}`} />
                    <p className="text-sm text-slate-500">Loading upcoming upgradations...</p>
                </div>
            ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className={`p-4 rounded-full mb-4 ${accentClasses.iconWrap}`}>
                        <IconCalendar className={`w-10 h-10 ${accentClasses.icon}`} />
                    </div>
                    <h4 className="text-md font-bold text-slate-700">No Upgradations Planned</h4>
                    <p className="text-xs text-slate-500 max-w-xs mt-2">
                        No associate has a pending skill upgradation planned for {periodLabel(view, anchor)}.
                    </p>
                </div>
            ) : (
                <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full border-collapse text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-xs font-bold">
                            <tr>
                                <th className="p-3 pl-4">Sr. No</th>
                                <th className="p-3">Associate Name</th>
                                <th className="p-3">Card No</th>
                                <th className="p-3">Model & Line</th>
                                <th className="p-3">Station</th>
                                <th className="p-3">Shift</th>
                                <th className="p-3">Quarter</th>
                                <th className="p-3">Next Skill Level</th>
                                <th className="p-3">Plan Date</th>
                                <th className="p-3 pr-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {rows.map((entry, index) => (
                                <tr
                                    key={entry.id}
                                    onClick={() => onOpenPlan?.(entry.plan)}
                                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                                    title={`Open the ${entry.plan.year} plan`}
                                >
                                    <td className="p-3 pl-4 text-slate-500 font-medium">{index + 1}</td>
                                    <td className="p-3 font-semibold text-slate-900 uppercase">{entry.userName || "N/A"}</td>
                                    <td className="p-3 text-slate-600 font-mono text-xs">{entry.cardNo || "-"}</td>
                                    <td className="p-3 text-slate-600 font-medium">{entry.modelLine || "-"}</td>
                                    <td className="p-3 text-slate-600 font-medium">{entry.station || "-"}</td>
                                    <td className="p-3 text-slate-600">{entry.shift || "-"}</td>
                                    <td className="p-3 text-slate-600">{entry.quarter}</td>
                                    <td className="p-3 text-slate-700 font-bold">{entry.skill}</td>
                                    <td className="p-3 text-slate-700 font-bold whitespace-nowrap">{formatDate(entry.planDate)}</td>
                                    <td className="p-3 pr-4 text-slate-600">{entry.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SkillUpgradationDueList;
