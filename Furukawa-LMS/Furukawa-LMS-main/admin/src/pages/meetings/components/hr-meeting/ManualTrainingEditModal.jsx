import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IconLoader2 } from "@tabler/icons-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/common/ui/dialog.jsx";
import { Button } from "@/components/common/ui/button.jsx";
import { Input } from "@/components/forms/primitives/input.jsx";
import { cn } from "@/utils/classNames.js";
import { formatReportDate } from "@/utils/dailyManpowerExcelExport.js";
import { useGetTrainingInputsQuery, useSaveTrainingInputsMutation } from "@/services/api/DailyHrMeetingApi.js";

// Manual Training row: required headcount for Indent 01 / Indent 16, and Present / OT hours per day.
// Mandays (ROUND(OT / 8)) and Gap (Present - Required) are previewed exactly as the sheet computes them.

const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

export default function ManualTrainingEditModal({ open, onOpenChange, year, month, darkMode }) {
    const { data, isFetching } = useGetTrainingInputsQuery({ year, month }, { skip: !open });
    const [saveTraining, { isLoading: saving }] = useSaveTrainingInputsMutation();

    const [fn01, setFn01] = useState("0");
    const [fn02, setFn02] = useState("0");
    const [entries, setEntries] = useState([]);
    const [initial, setInitial] = useState(null);

    useEffect(() => {
        const d = data?.data;
        if (!d) return;
        const rows = d.entries.map((e) => ({ date: e.date, presentCount: String(e.presentCount ?? 0), otHrs: String(e.otHrs ?? 0) }));
        setFn01(String(d.requiredFN01 ?? 0));
        setFn02(String(d.requiredFN02 ?? 0));
        setEntries(rows);
        setInitial(JSON.stringify(rows));
    }, [data]);

    const invalid = useMemo(() => {
        const bad = (v, integer) => v === "" || !Number.isFinite(Number(v)) || Number(v) < 0 || (integer && !Number.isInteger(Number(v)));
        return bad(fn01, true) || bad(fn02, true) || entries.some((e) => bad(e.presentCount, true) || bad(e.otHrs, false));
    }, [fn01, fn02, entries]);

    const setEntry = (date, patch) => setEntries((prev) => prev.map((e) => (e.date === date ? { ...e, ...patch } : e)));

    const handleSave = async () => {
        // Send only the days that changed (plus the month's required headcount).
        const before = new Map((initial ? JSON.parse(initial) : []).map((e) => [e.date, e]));
        const changed = entries.filter((e) => {
            const b = before.get(e.date);
            return !b || toNumber(b.presentCount) !== toNumber(e.presentCount) || toNumber(b.otHrs) !== toNumber(e.otHrs);
        });
        try {
            await saveTraining({
                year,
                month,
                requiredFN01: toNumber(fn01),
                requiredFN02: toNumber(fn02),
                entries: changed.map((e) => ({ date: e.date, presentCount: toNumber(e.presentCount), otHrs: toNumber(e.otHrs) })),
            }).unwrap();
            toast.success("Training inputs saved");
            onOpenChange(false);
        } catch (error) {
            toast.error(error?.message || "Could not save Training inputs");
        }
    };

    const muted = darkMode ? "text-slate-400" : "text-slate-500";
    const rowBorder = darkMode ? "border-slate-800" : "border-slate-200";

    return (
        <Dialog open={open} onOpenChange={onOpenChange} className={cn("max-w-2xl", darkMode && "bg-slate-950 text-slate-100")}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className={darkMode ? "text-slate-100" : undefined}>Training inputs</DialogTitle>
                    <DialogDescription className={darkMode ? "text-slate-400" : undefined}>
                        Entered by hand. Days 1–15 are measured against Indent 01, days 16 onward against Indent 16.
                    </DialogDescription>
                </DialogHeader>

                {isFetching && !entries.length ? (
                    <div className="flex justify-center py-10"><IconLoader2 className="animate-spin" /></div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <label className="text-sm">
                                <span className={cn("block text-xs mb-1", muted)}>Required — Indent 01</span>
                                <Input type="number" min={0} step={1} value={fn01} onChange={(e) => setFn01(e.target.value)} />
                            </label>
                            <label className="text-sm">
                                <span className={cn("block text-xs mb-1", muted)}>Required — Indent 16</span>
                                <Input type="number" min={0} step={1} value={fn02} onChange={(e) => setFn02(e.target.value)} />
                            </label>
                        </div>

                        <div className="max-h-[50vh] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className={cn("sticky top-0 text-xs", darkMode ? "bg-slate-950" : "bg-white", muted)}>
                                    <tr>
                                        <th className="py-1 text-left font-medium">Date</th>
                                        <th className="py-1 text-left font-medium">Present</th>
                                        <th className="py-1 text-left font-medium">OT hours</th>
                                        <th className="py-1 text-center font-medium">Mandays</th>
                                        <th className="py-1 text-center font-medium">Gap</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((e) => {
                                        const day = Number(e.date.slice(8, 10));
                                        const required = day <= 15 ? toNumber(fn01) : toNumber(fn02);
                                        const gap = toNumber(e.presentCount) - required;
                                        return (
                                            <tr key={e.date} className={cn("border-t", rowBorder)}>
                                                <td className="py-1 pr-2 whitespace-nowrap tabular-nums">{formatReportDate(e.date)}</td>
                                                <td className="py-1 pr-2">
                                                    <Input type="number" min={0} step={1} value={e.presentCount} className="h-8 w-24"
                                                        aria-label={`Present on ${formatReportDate(e.date)}`}
                                                        onChange={(ev) => setEntry(e.date, { presentCount: ev.target.value })} />
                                                </td>
                                                <td className="py-1 pr-2">
                                                    <Input type="number" min={0} step={0.5} value={e.otHrs} className="h-8 w-24"
                                                        aria-label={`OT hours on ${formatReportDate(e.date)}`}
                                                        onChange={(ev) => setEntry(e.date, { otHrs: ev.target.value })} />
                                                </td>
                                                <td className="py-1 text-center tabular-nums">{Math.round(toNumber(e.otHrs) / 8)}</td>
                                                <td className={cn("py-1 text-center tabular-nums", gap < 0 && "text-red-600 dark:text-red-400")}>{gap}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving || invalid || !entries.length}>
                        {saving && <IconLoader2 className="animate-spin" />} Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
