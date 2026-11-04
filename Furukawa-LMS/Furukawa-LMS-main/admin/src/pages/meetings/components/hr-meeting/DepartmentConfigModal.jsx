import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IconArrowDown, IconArrowUp, IconLoader2 } from "@tabler/icons-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/common/ui/dialog.jsx";
import { Button } from "@/components/common/ui/button.jsx";
import { Input } from "@/components/forms/primitives/input.jsx";
import { Switch } from "@/components/forms/primitives/switch.jsx";
import { cn } from "@/utils/classNames.js";
import {
    useGetDailyManpowerConfigQuery,
    useSaveDailyManpowerConfigMutation,
    useGetAttendanceDeptMapQuery,
    useSaveAttendanceDeptMapMutation,
} from "@/services/api/DailyHrMeetingApi.js";

// Configure Sections: per department alias, "Other" roll-up, group (e.g. MAIN / SRC), visibility and
// order; plus the attendance-department mapping that places each day's punches under a department.

const DEFAULT_GROUP = "MAIN";

const byGroupThenOrder = (groupOrder) => (a, b) =>
    (groupOrder.indexOf(a.groupName) - groupOrder.indexOf(b.groupName)) || (a._order - b._order);

function SectionsTab({ darkMode, onSaved }) {
    const { data, isFetching } = useGetDailyManpowerConfigQuery();
    const [saveConfig, { isLoading: saving }] = useSaveDailyManpowerConfigMutation();
    const [rows, setRows] = useState([]);
    const [groupOrder, setGroupOrder] = useState([DEFAULT_GROUP]);

    useEffect(() => {
        const departments = data?.data?.departments || [];
        const initial = departments.map((d, i) => ({ ...d, displayName: d.displayName || "", _order: d.sortOrder ?? 10000 + i }));
        const groups = [...new Map(
            [...initial].sort((a, b) => a.groupSortOrder - b.groupSortOrder).map((d) => [d.groupName, true])
        ).keys()];
        const order = groups.includes(DEFAULT_GROUP) ? groups : [DEFAULT_GROUP, ...groups];
        setGroupOrder(order);
        setRows(initial.sort(byGroupThenOrder(order)).map((r, i) => ({ ...r, _order: i })));
    }, [data]);

    const update = (departmentId, patch) => setRows((prev) => prev.map((r) => (r.departmentId === departmentId ? { ...r, ...patch } : r)));

    const setGroup = (departmentId, value) => {
        const groupName = value.trim().toUpperCase() || DEFAULT_GROUP;
        if (!groupOrder.includes(groupName)) setGroupOrder((prev) => [...prev, groupName]);
        setRows((prev) => prev.map((r) => (r.departmentId === departmentId ? { ...r, groupName, _order: prev.length + 1 } : r)));
    };

    const sorted = useMemo(() => [...rows].sort(byGroupThenOrder(groupOrder)), [rows, groupOrder]);
    const usedGroups = groupOrder.filter((g) => rows.some((r) => r.groupName === g));

    const move = (departmentId, delta) => {
        const inGroup = sorted.filter((r) => r.groupName === sorted.find((x) => x.departmentId === departmentId).groupName);
        const idx = inGroup.findIndex((r) => r.departmentId === departmentId);
        const swap = inGroup[idx + delta];
        if (!swap) return;
        const a = inGroup[idx]._order;
        const b = swap._order;
        setRows((prev) => prev.map((r) => {
            if (r.departmentId === departmentId) return { ...r, _order: b };
            if (r.departmentId === swap.departmentId) return { ...r, _order: a };
            return r;
        }));
    };

    const moveGroup = (name, delta) => {
        const visible = usedGroups;
        const idx = visible.indexOf(name);
        const target = visible[idx + delta];
        if (!target) return;
        setGroupOrder((prev) => {
            const next = [...prev];
            const i = next.indexOf(name);
            const j = next.indexOf(target);
            [next[i], next[j]] = [next[j], next[i]];
            return next;
        });
    };

    const handleSave = async () => {
        const payload = sorted.map((r, index) => ({
            departmentId: r.departmentId,
            displayName: r.displayName.trim() || null,
            isOther: r.isOther,
            groupName: r.groupName,
            groupSortOrder: Math.max(0, groupOrder.indexOf(r.groupName)),
            sortOrder: index,
            isHidden: r.isHidden,
        }));
        try {
            await saveConfig(payload).unwrap();
            toast.success("Sections saved");
            onSaved?.();
        } catch (error) {
            toast.error(error?.message || "Could not save sections");
        }
    };

    const muted = darkMode ? "text-slate-400" : "text-slate-500";
    const rowBorder = darkMode ? "border-slate-800" : "border-slate-200";

    if (isFetching && !rows.length) {
        return <div className="flex justify-center py-10"><IconLoader2 className="animate-spin" /></div>;
    }

    return (
        <div className="space-y-4">
            <div>
                <div className={cn("text-xs font-semibold uppercase tracking-wide mb-1", muted)}>Group order</div>
                <div className="flex flex-wrap gap-2">
                    {usedGroups.map((g, i) => (
                        <span key={g} className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs", rowBorder)}>
                            {i + 1}. {g}
                            <button type="button" aria-label={`Move ${g} up`} disabled={i === 0} onClick={() => moveGroup(g, -1)} className="disabled:opacity-30"><IconArrowUp size={12} /></button>
                            <button type="button" aria-label={`Move ${g} down`} disabled={i === usedGroups.length - 1} onClick={() => moveGroup(g, 1)} className="disabled:opacity-30"><IconArrowDown size={12} /></button>
                        </span>
                    ))}
                </div>
                <p className={cn("text-xs mt-1", muted)}>Each group gets its own Total row. Type a new group name (e.g. SRC) on a department to create one.</p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className={cn("text-left text-xs", muted)}>
                            <th className="py-1 pr-2 font-medium">Department</th>
                            <th className="py-1 pr-2 font-medium">Show as</th>
                            <th className="py-1 pr-2 font-medium">Group</th>
                            <th className="py-1 pr-2 font-medium text-center">Move to Other</th>
                            <th className="py-1 pr-2 font-medium text-center">Hide</th>
                            <th className="py-1 font-medium text-center">Order</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((r, i) => {
                            const prev = sorted[i - 1];
                            const next = sorted[i + 1];
                            return (
                                <React.Fragment key={r.departmentId}>
                                    {(!prev || prev.groupName !== r.groupName) && (
                                        <tr><td colSpan={6} className="pt-3 pb-1 text-xs font-bold">{r.groupName}</td></tr>
                                    )}
                                    <tr className={cn("border-t", rowBorder, r.isHidden && "opacity-50")}>
                                        <td className="py-1.5 pr-2">
                                            {r.departmentName}
                                            {!r.isConfigured && <span className="ml-1 text-[10px] text-blue-500">new</span>}
                                        </td>
                                        <td className="py-1.5 pr-2">
                                            <Input value={r.displayName} placeholder={r.departmentName} maxLength={255}
                                                onChange={(e) => update(r.departmentId, { displayName: e.target.value })} className="h-8" />
                                        </td>
                                        <td className="py-1.5 pr-2">
                                            <Input defaultValue={r.groupName} list="dhrm-groups" maxLength={100}
                                                onBlur={(e) => setGroup(r.departmentId, e.target.value)} className="h-8 w-28 uppercase" />
                                        </td>
                                        <td className="py-1.5 pr-2 text-center">
                                            <Switch checked={r.isOther} onCheckedChange={(v) => update(r.departmentId, { isOther: v })} aria-label={`Move ${r.departmentName} to Other`} />
                                        </td>
                                        <td className="py-1.5 pr-2 text-center">
                                            <Switch checked={r.isHidden} onCheckedChange={(v) => update(r.departmentId, { isHidden: v })} aria-label={`Hide ${r.departmentName}`} />
                                        </td>
                                        <td className="py-1.5 text-center whitespace-nowrap">
                                            <button type="button" aria-label="Move up" disabled={!prev || prev.groupName !== r.groupName} onClick={() => move(r.departmentId, -1)} className="p-1 disabled:opacity-30"><IconArrowUp size={14} /></button>
                                            <button type="button" aria-label="Move down" disabled={!next || next.groupName !== r.groupName} onClick={() => move(r.departmentId, 1)} className="p-1 disabled:opacity-30"><IconArrowDown size={14} /></button>
                                        </td>
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
                <datalist id="dhrm-groups">{groupOrder.map((g) => <option key={g} value={g} />)}</datalist>
            </div>

            <DialogFooter>
                <Button onClick={handleSave} disabled={saving}>
                    {saving && <IconLoader2 className="animate-spin" />} Save sections
                </Button>
            </DialogFooter>
        </div>
    );
}

function AttendanceMappingTab({ year, month, darkMode, onSaved }) {
    const { data, isFetching } = useGetAttendanceDeptMapQuery({ year, month });
    const { data: configData } = useGetDailyManpowerConfigQuery();
    const [saveMap, { isLoading: saving }] = useSaveAttendanceDeptMapMutation();
    const [draft, setDraft] = useState({});

    const departments = configData?.data?.departments || [];
    const mappings = data?.data?.mappings || [];
    const seen = data?.data?.seen || [];

    useEffect(() => {
        setDraft(Object.fromEntries(mappings.map((m) => [m.attendanceDepartment, m.departmentId])));
    }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

    const names = useMemo(() => {
        const counts = new Map(seen.map((s) => [s.attendanceDepartment, s.rowCount]));
        const all = new Set([...seen.map((s) => s.attendanceDepartment), ...mappings.map((m) => m.attendanceDepartment)]);
        return [...all].map((name) => ({ name, rowCount: counts.get(name) || 0 }))
            .sort((a, b) => (Number(Boolean(draft[a.name])) - Number(Boolean(draft[b.name]))) || (b.rowCount - a.rowCount));
    }, [seen, mappings]); // eslint-disable-line react-hooks/exhaustive-deps

    const original = Object.fromEntries(mappings.map((m) => [m.attendanceDepartment, m.departmentId]));
    const changes = names
        .filter(({ name }) => (Number(draft[name]) || 0) !== (Number(original[name]) || 0))
        .map(({ name }) => ({ attendanceDepartment: name, departmentId: Number(draft[name]) || 0 }));

    const handleSave = async () => {
        try {
            const res = await saveMap({ year, month, mappings: changes }).unwrap();
            const n = res?.data?.recomputedDates || 0;
            toast.success(n ? `Mapping saved — ${n} day(s) recalculated` : "Mapping saved");
            onSaved?.();
        } catch (error) {
            toast.error(error?.message || "Could not save mapping");
        }
    };

    const muted = darkMode ? "text-slate-400" : "text-slate-500";
    const rowBorder = darkMode ? "border-slate-800" : "border-slate-200";
    const selectClass = cn("h-8 w-full rounded-md border px-2 text-sm", darkMode ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300");

    if (isFetching && !names.length) {
        return <div className="flex justify-center py-10"><IconLoader2 className="animate-spin" /></div>;
    }

    return (
        <div className="space-y-3">
            <p className={cn("text-xs", muted)}>
                Each attendance row carries the department from the attendance file for that day. Map every spelling to a
                department so people are counted where they were on that date. Unmapped spellings fall back to the
                person's current department. Saving recalculates the affected days of this month.
            </p>
            {!names.length && <p className={cn("text-sm py-6 text-center", muted)}>No attendance departments found for this month.</p>}
            <table className="w-full text-sm">
                <tbody>
                    {names.map(({ name, rowCount }) => (
                        <tr key={name} className={cn("border-t", rowBorder)}>
                            <td className="py-1.5 pr-2 font-mono text-xs">
                                {name}
                                {!draft[name] && <span className="ml-2 rounded bg-amber-100 px-1 text-[10px] font-sans text-amber-800">unmapped</span>}
                            </td>
                            <td className={cn("py-1.5 pr-2 text-xs whitespace-nowrap", muted)}>{rowCount} rows</td>
                            <td className="py-1.5 w-1/2">
                                <select
                                    className={selectClass}
                                    value={draft[name] || ""}
                                    aria-label={`Department for ${name}`}
                                    onChange={(e) => setDraft((prev) => ({ ...prev, [name]: Number(e.target.value) || 0 }))}
                                >
                                    <option value="">— Not mapped —</option>
                                    {departments.map((d) => <option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>)}
                                </select>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <DialogFooter>
                <Button onClick={handleSave} disabled={saving || !changes.length}>
                    {saving && <IconLoader2 className="animate-spin" />} Save mapping{changes.length ? ` (${changes.length})` : ""}
                </Button>
            </DialogFooter>
        </div>
    );
}

export default function DepartmentConfigModal({ open, onOpenChange, year, month, darkMode, initialTab = "sections" }) {
    const [tab, setTab] = useState(initialTab);
    useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

    const tabClass = (active) => cn(
        "px-3 py-1.5 text-sm rounded-md",
        active
            ? (darkMode ? "bg-slate-700 text-white" : "bg-slate-900 text-white")
            : (darkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"),
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange} className={cn("max-w-4xl", darkMode && "bg-slate-950 text-slate-100")}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className={darkMode ? "text-slate-100" : undefined}>Configure sections</DialogTitle>
                    <DialogDescription className={darkMode ? "text-slate-400" : undefined}>
                        Changes apply to every month of the report.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex gap-1 mb-4">
                    <button type="button" className={tabClass(tab === "sections")} onClick={() => setTab("sections")}>Sections</button>
                    <button type="button" className={tabClass(tab === "mapping")} onClick={() => setTab("mapping")}>Attendance mapping</button>
                </div>
                {tab === "sections"
                    ? <SectionsTab darkMode={darkMode} onSaved={() => onOpenChange(false)} />
                    : <AttendanceMappingTab year={year} month={month} darkMode={darkMode} onSaved={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    );
}
