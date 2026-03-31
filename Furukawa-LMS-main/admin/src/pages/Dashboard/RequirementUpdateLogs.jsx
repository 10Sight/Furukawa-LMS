// frontend/components/RequirementUpdateLogs.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Search, Calendar as CalendarIcon, ArrowRight, Filter } from "lucide-react";
import { format } from "date-fns";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import axiosInstance from "@/Helper/axiosInstance";
import { toast } from "sonner";

const IGNORED_KEYS = new Set([
    "id",
    "_id",
    "log_id",
    "lineId",
    "line_id",
    "updatedAt",
    "createdAt",
    "created_at",
    "updated_at",
    "limit",
    "offset",
    "section_id",
    "subsection_id",
    "sectionId",
    "subSectionId",
    "requirement_id",
    "requirementId",
    "section",
    "sub_section",
    "sectionName",
    "subSectionName",
]);

const formatValue = (v) => {
    if (v === undefined || v === null) return "-";
    if (typeof v === "string") return v.trim() === "" ? "-" : v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    try {
        const s = JSON.stringify(v);
        return s.length > 60 ? s.slice(0, 60) + "…" : s;
    } catch {
        return String(v);
    }
};

const toDateSafe = (val) => {
    if (!val) return null;
    const d = val instanceof Date ? val : new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
};

const RequirementUpdateLogs = ({ requirementId = null }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [date, setDate] = useState({ from: undefined, to: undefined });
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        try {
            setLoading(true);

            const url = requirementId
                ? `/api/requirements/logs/${requirementId}`
                : `/api/requirements/logs`;

            const response = await axiosInstance.get(url, {
                params: { limit: 500 },
            });

            const raw = response?.data?.data;
            const apiLogs = Array.isArray(raw) ? raw : Array.isArray(raw?.logs) ? raw.logs : [];

            const processed = processLogs(apiLogs);
            setLogs(processed);
        } catch (error) {
            const msg =
                error?.response?.data?.message ||
                error?.response?.data?.error ||
                error?.message ||
                "Failed to fetch logs";
            toast.error(msg);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requirementId]);

    const formatSixMonthCounts = (counts) => {
        if (!Array.isArray(counts) || counts.length === 0) return "No data";
        const parts = counts.map((c) => {
            const d = new Date(c.year, (c.month || 1) - 1, 1);
            const label = format(d, "MMM yyyy");
            return `${label}: ${c.count ?? 0}`;
        });
        return parts.join(", ");
    };

    const processLogs = (apiLogs) => {
        const flattened = [];

        apiLogs.forEach((log) => {
            const oldVals = typeof log.old_values === "string" ? safeParse(log.old_values) : (log.old_values || {});
            const newVals = typeof log.new_values === "string" ? safeParse(log.new_values) : (log.new_values || {});

            const allKeys = new Set([...Object.keys(oldVals || {}), ...Object.keys(newVals || {})]);

            const createdAt = log.created_at || log.createdAt || log.timestamp || log.time;
            const createdDate = toDateSafe(createdAt) || new Date();

            const userName = log.user_name || log.employee_name || log.name || "Unknown";
            const userAvatar = log.user_avatar || log.avatar || null;
            const userRole = log.employee_role || log.role || "User";

            const sectionName =
                log.section_name ||
                newVals.sectionName ||
                oldVals.sectionName ||
                newVals.section_name ||
                oldVals.section_name ||
                "N/A";

            const subSectionName =
                log.subsection_name ||
                newVals.subSectionName ||
                oldVals.subSectionName ||
                newVals.subsection_name ||
                oldVals.subsection_name ||
                "N/A";

            const refMonth = (newVals.month && newVals.year)
                ? toDateSafe(`${newVals.month} 1, ${newVals.year}`)
                : (oldVals.month && oldVals.year)
                    ? toDateSafe(`${oldVals.month} 1, ${oldVals.year}`)
                    : (log.referenceMonth || createdDate);

            let pushedAny = false;

            allKeys.forEach((key) => {
                if (IGNORED_KEYS.has(key)) return;

                const oldV = oldVals?.[key];
                const newV = newVals?.[key];

                // eslint-disable-next-line eqeqeq
                const changed = oldV != newV && JSON.stringify(oldV) !== JSON.stringify(newV);
                if (!changed) return;

                const isMentorOrSupervisor =
                    key === "mentor" ||
                    key === "supervisorName" ||
                    key === "supervisor_name" ||
                    key === "mentorName";

                // Allow tracking of ALL changed keys, instead of restricting it to just plan counts or line ids
                let displayField = key;
                if (key === "salesPlan") displayField = "Sales Plan";
                else if (key === "prodPlan") displayField = "Production Plan";
                else if (key === "count") displayField = "Count";
                else if (key === "lineArea" || key === "lineId" || key === "line_area" || key === "lineName") displayField = "Line / Area";
                else if (isMentorOrSupervisor) displayField = (key === "mentor" || key === "mentorName") ? "Mentor" : "Supervisor";
                else displayField = String(key).replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()); // Format nice string like MentorName -> Mentor Name

                const sixMonthSummary = isMentorOrSupervisor
                    ? formatSixMonthCounts(log.six_month_counts)
                    : null;

                pushedAny = true;

                flattened.push({
                    id: `${log.log_id || log.id || createdDate.getTime()}-${key}`,
                    originalLogId: log.log_id || log.id || null,
                    user: { name: userName, avatar: userAvatar, role: userRole },
                    target: { section: String(sectionName), subSection: String(subSectionName) },
                    referenceMonth: refMonth || createdDate,
                    action: {
                        field: displayField,
                        oldValue: isMentorOrSupervisor && !oldV ? "-" : formatValue(oldV),
                        newValue: formatValue(newV) + (sixMonthSummary && sixMonthSummary.trim() !== "" ? ` (6-Mo: ${sixMonthSummary})` : ""),
                    },
                    timestamp: createdDate,
                });
            });

            // If backend stored log but old/new are empty or identical, still show a generic row
            if (!pushedAny) {
                flattened.push({
                    id: `${log.log_id || log.id || createdDate.getTime()}-generic`,
                    originalLogId: log.log_id || log.id || null,
                    user: { name: userName, avatar: userAvatar, role: userRole },
                    target: { section: String(sectionName), subSection: String(subSectionName) },
                    referenceMonth: refMonth || createdDate,
                    action: { field: "Count", oldValue: "-", newValue: "-" },
                    timestamp: createdDate,
                });
            }
        });

        return flattened;
    };

    const safeParse = (s) => {
        try {
            return JSON.parse(s);
        } catch {
            return {};
        }
    };

    const filteredLogs = useMemo(() => {
        const st = searchTerm.trim().toLowerCase();

        return logs.filter((log) => {
            const matchesSearch =
                !st ||
                (log.user?.name || "").toLowerCase().includes(st) ||
                (log.target?.section || "").toLowerCase().includes(st) ||
                (log.target?.subSection || "").toLowerCase().includes(st) ||
                (log.action?.field || "").toLowerCase().includes(st);

            let matchesDate = true;
            if (date?.from && date?.to) {
                const from = new Date(date.from);
                const to = new Date(date.to);
                to.setHours(23, 59, 59, 999);
                const logDate = new Date(log.timestamp);
                matchesDate = logDate >= from && logDate <= to;
            }

            return matchesSearch && matchesDate;
        });
    }, [logs, searchTerm, date]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">
                        Requirement Update Logs
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Track and monitor changes to system requirements and allocations.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchLogs}>
                        <Filter className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-medium">Filters</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by user / section / field..."
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-[280px] justify-start text-left font-normal",
                                            !date?.from && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date?.from ? (
                                            date.to ? (
                                                <>
                                                    {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                                                </>
                                            ) : (
                                                format(date.from, "LLL dd, y")
                                            )
                                        ) : (
                                            <span>Pick a date range</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>

                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={date?.from}
                                        selected={date}
                                        onSelect={setDate}
                                        numberOfMonths={2}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden">
                    <CardHeader className="border-b pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl">Change History</CardTitle>
                                <CardDescription>Showing {filteredLogs.length} updates</CardDescription>
                            </div>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                Live Updates
                            </Badge>
                        </div>
                    </CardHeader>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                <TableRow>
                                    <TableHead className="w-[250px]">User Details</TableHead>
                                    <TableHead>Target Section</TableHead>
                                    <TableHead>Reference Month</TableHead>
                                    <TableHead className="w-[300px]">Action Details</TableHead>
                                    <TableHead className="text-right">Timestamp</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                                            Loading history...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLogs.length > 0 ? (
                                    filteredLogs.map((log) => {
                                        const initials = (log.user?.name || "U")
                                            .split(" ")
                                            .filter(Boolean)
                                            .slice(0, 2)
                                            .map((n) => n[0]?.toUpperCase())
                                            .join("");

                                        return (
                                            <TableRow key={log.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9 border">
                                                            <AvatarImage src={log.user?.avatar || ""} alt={log.user?.name || "User"} />
                                                            <AvatarFallback>{initials || "U"}</AvatarFallback>
                                                        </Avatar>

                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-slate-900 dark:text-slate-100">
                                                                {log.user?.name || "Unknown"}
                                                            </span>

                                                            <Badge
                                                                variant="secondary"
                                                                className={cn(
                                                                    "w-fit text-[10px] px-1.5 py-0 h-4 mt-1",
                                                                    log.user?.role === "Admin"
                                                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                                                                        : log.user?.role === "Manager"
                                                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                                                                            : "bg-slate-100 text-slate-700"
                                                                )}
                                                            >
                                                                {log.user?.role || "User"}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-slate-900 dark:text-slate-100">
                                                            {log.target?.section || "N/A"}
                                                        </span>
                                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                            {log.target?.subSection || "N/A"}
                                                        </span>
                                                    </div>
                                                </TableCell>

                                                <TableCell>
                                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                                        <CalendarIcon className="h-3 w-3 text-slate-400" />
                                                        {format(new Date(log.referenceMonth), "MMM yyyy")}
                                                    </div>
                                                </TableCell>

                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                            {log.action?.field || "Updated"}
                                                        </span>
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <span className="text-rose-600 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-950/30 px-1.5 rounded border border-rose-100 dark:border-rose-900/50">
                                                                {log.action?.oldValue ?? "-"}
                                                            </span>
                                                            <ArrowRight className="h-3 w-3 text-slate-400" />
                                                            <span className="text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/30 px-1.5 rounded border border-emerald-100 dark:border-emerald-900/50">
                                                                {log.action?.newValue ?? "-"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="text-right">
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                                                            {format(new Date(log.timestamp), "MMM dd, yyyy")}
                                                        </span>
                                                        <span className="text-xs text-slate-500">
                                                            {format(new Date(log.timestamp), "hh:mm a")}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                                            No logs found matching your criteria.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default RequirementUpdateLogs;
