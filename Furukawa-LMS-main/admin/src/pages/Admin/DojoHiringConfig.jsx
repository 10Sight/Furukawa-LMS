import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import {
    useGetDojoHiringConfigsQuery,
    useSaveDojoHiringConfigMutation,
} from "@/Redux/AllApi/DepartmentApi";
import { useLazyGetAllQuizzesQuery } from "@/Redux/AllApi/QuizApi";
import { useLazyGetEvaluationTestsQuery } from "@/Redux/AllApi/EvaluationTestApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import ServerSearchMultiSelect from "@/components/common/ServerSearchMultiSelect";
import {
    IconSettings,
    IconDeviceFloppy,
    IconLoader,
    IconSearch,
    IconCheck,
    IconArrowBackUp,
    IconFileText,
    IconClipboardCheck,
    IconUserStar,
    IconMoodEmpty,
    IconLock,
    IconCircleCheck,
    IconAlertCircle,
} from "@tabler/icons-react";

const ARRAY_FIELDS = [
    "dojoMandatoryQuizId", "dojoHandoverQuizId", "dojoInterviewQuizId",
    "dojoEligibilityEvaluationId", "dojoInterviewEvaluationId",
];

const toIdArray = (val) => (Array.isArray(val) ? val.map(String) : []);

const toRowState = (dept) => ({
    dojoMandatoryQuizId: toIdArray(dept.dojoMandatoryQuizId),
    dojoHandoverQuizId: toIdArray(dept.dojoHandoverQuizId),
    dojoInterviewQuizId: toIdArray(dept.dojoInterviewQuizId),
    dojoEligibilityEvaluationId: toIdArray(dept.dojoEligibilityEvaluationId),
    dojoInterviewEvaluationId: toIdArray(dept.dojoInterviewEvaluationId),
    isDojoSpecificDept: !!dept.isDojoSpecificDept,
});

const sortedJoin = (arr) => [...(arr || [])].sort().join(",");

const rowsEqual = (a, b) => {
    if (!a || !b) return a === b;
    return (
        ARRAY_FIELDS.every((f) => sortedJoin(a[f]) === sortedJoin(b[f])) &&
        a.isDojoSpecificDept === b.isDojoSpecificDept
    );
};

const isConfigured = (dept) =>
    toIdArray(dept.dojoHandoverQuizId).length > 0 || toIdArray(dept.dojoEligibilityEvaluationId).length > 0;

const unwrapQuizzes = (data) => data?.data?.quizzes || [];
const unwrapEvaluations = (data) => data?.data || [];

const DojoHiringConfig = () => {
    const currentUser = useSelector((state) => state.auth.user);
    const hasPermission = (permission) => {
        if (currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") return true;
        return currentUser?.customRole?.permissions?.includes(permission);
    };
    const canUpdate = hasPermission("dojo_hiring:update");

    const { data: configsResponse, isLoading: isLoadingConfigs, refetch } = useGetDojoHiringConfigsQuery();
    const [saveDojoHiringConfig] = useSaveDojoHiringConfigMutation();

    const departments = useMemo(() => configsResponse?.data || [], [configsResponse]);

    const [rows, setRows] = useState({});
    // Last known-good saved values per department. Used (instead of the raw query
    // data) to decide whether a row is "dirty" — the query data only reflects a save
    // once refetch() resolves, which would otherwise leave the row looking unsaved
    // for a moment right after a successful save.
    const [savedBaseline, setSavedBaseline] = useState({});
    const [savingId, setSavingId] = useState(null);
    const [justSavedId, setJustSavedId] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (!departments.length) return;
        setRows((prev) => {
            const next = { ...prev };
            departments.forEach((dept) => {
                if (next[dept.id]) return;
                next[dept.id] = toRowState(dept);
            });
            return next;
        });
        setSavedBaseline((prev) => {
            const next = { ...prev };
            departments.forEach((dept) => {
                if (next[dept.id]) return;
                next[dept.id] = toRowState(dept);
            });
            return next;
        });
    }, [departments]);

    const updateRow = (deptId, field, value) => {
        setRows((prev) => ({
            ...prev,
            [deptId]: { ...prev[deptId], [field]: value },
        }));
    };

    const resetRow = (dept) => {
        setRows((prev) => ({ ...prev, [dept.id]: savedBaseline[dept.id] || toRowState(dept) }));
    };

    const isRowDirty = (dept) => !rowsEqual(rows[dept.id], savedBaseline[dept.id] || toRowState(dept));

    const handleSave = async (deptId) => {
        const row = rows[deptId];
        if (!row) return;
        setSavingId(deptId);
        try {
            await saveDojoHiringConfig({
                departmentId: deptId,
                dojoMandatoryQuizId: row.dojoMandatoryQuizId,
                dojoHandoverQuizId: row.dojoHandoverQuizId,
                dojoInterviewQuizId: row.dojoInterviewQuizId,
                dojoEligibilityEvaluationId: row.dojoEligibilityEvaluationId,
                dojoInterviewEvaluationId: row.dojoInterviewEvaluationId,
                isDojoSpecificDept: row.isDojoSpecificDept,
            }).unwrap();
            toast.success("Dojo hiring config saved");
            setSavedBaseline((prev) => ({ ...prev, [deptId]: { ...row } }));
            setJustSavedId(deptId);
            setTimeout(() => setJustSavedId((id) => (id === deptId ? null : id)), 2500);
            refetch();
        } catch (error) {
            toast.error(error?.data?.message || "Failed to save config");
        } finally {
            setSavingId(null);
        }
    };

    const filteredDepartments = useMemo(() => {
        if (!searchTerm.trim()) return departments;
        const t = searchTerm.trim().toLowerCase();
        return departments.filter((d) => d.name?.toLowerCase().includes(t));
    }, [departments, searchTerm]);

    const configuredCount = useMemo(() => departments.filter(isConfigured).length, [departments]);

    const NotRequiredPill = () => (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            <IconLock className="w-3 h-3" /> Not Required
        </span>
    );

    const RowActions = ({ dept, dirty }) => {
        const justSaved = justSavedId === dept.id;
        return (
            <div className="flex items-center gap-1.5">
                {dirty && canUpdate && (
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-slate-400 hover:text-slate-700 cursor-pointer"
                        onClick={() => resetRow(dept)}
                        title="Discard changes"
                    >
                        <IconArrowBackUp className="w-4 h-4" />
                    </Button>
                )}
                <Button
                    size="sm"
                    disabled={!canUpdate || savingId === dept.id || !dirty}
                    onClick={() => handleSave(dept.id)}
                    className={`h-9 px-3 gap-1.5 font-bold transition-colors cursor-pointer disabled:cursor-not-allowed ${justSaved
                        ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-200 disabled:text-slate-400"
                        }`}
                >
                    {savingId === dept.id ? (
                        <IconLoader className="w-4 h-4 animate-spin" />
                    ) : justSaved ? (
                        <IconCheck className="w-4 h-4" />
                    ) : (
                        <IconDeviceFloppy className="w-4 h-4" />
                    )}
                    <span className="hidden lg:inline">
                        {justSaved ? "Saved" : "Save"}
                    </span>
                </Button>
            </div>
        );
    };

    const isEmpty = !isLoadingConfigs && filteredDepartments.length === 0;

    return (
        <Card className="border-none shadow-sm bg-white overflow-hidden rounded-2xl">
            <CardHeader className="p-6 border-b border-slate-100 space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50">
                                <IconSettings className="w-5 h-5 text-blue-600" />
                            </span>
                            Dojo Hiring Configuration
                        </CardTitle>
                        <p className="text-sm text-slate-500 font-medium mt-1.5 max-w-2xl">
                            Map each department to the test papers and evaluation tests that govern mandatory training, handover marks and interviews. A candidate is eligible once they pass any one of the papers selected for a field.
                        </p>
                    </div>
                    <Badge
                        variant={configuredCount === departments.length && departments.length > 0 ? "success" : "warning"}
                        className="w-fit gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap"
                    >
                        <IconCircleCheck className="w-3.5 h-3.5" />
                        {configuredCount} of {departments.length} departments configured
                    </Badge>
                </div>
                <div className="relative w-full sm:max-w-xs">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search department..."
                        className="pl-9 h-10 rounded-xl bg-slate-50 border-slate-200"
                    />
                </div>
            </CardHeader>

            <CardContent className="p-0">
                {/* Mobile / Tablet Card View */}
                <div className="block lg:hidden p-4 space-y-4">
                    {isLoadingConfigs && (
                        [...Array(3)].map((_, i) => (
                            <div key={i} className="rounded-xl border border-slate-100 p-4 space-y-3">
                                <Skeleton className="h-5 w-1/2" />
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-9 w-full" />
                            </div>
                        ))
                    )}
                    {isEmpty && (
                        <div className="text-center py-10">
                            <IconMoodEmpty className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-600">No departments found</p>
                            <p className="text-xs text-slate-400">Try a different search term.</p>
                        </div>
                    )}
                    {!isLoadingConfigs && filteredDepartments.map((dept) => {
                        const row = rows[dept.id];
                        if (!row) return null;
                        const dirty = isRowDirty(dept);
                        const justSaved = justSavedId === dept.id;
                        const isSpecific = row.isDojoSpecificDept;
                        return (
                            <div
                                key={dept.id}
                                className={`rounded-xl border p-4 space-y-4 transition-colors duration-500 ${justSaved
                                    ? "border-emerald-300 bg-emerald-50/50"
                                    : dirty
                                        ? "border-amber-300 bg-amber-50/40"
                                        : "border-slate-100 bg-slate-50/60"
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-slate-800">{dept.name}</span>
                                        {justSaved ? (
                                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-600">
                                                <IconCheck className="w-3 h-3" /> Saved
                                            </span>
                                        ) : dirty && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-600">
                                                <IconAlertCircle className="w-3 h-3" /> Unsaved
                                            </span>
                                        )}
                                    </div>
                                    <RowActions dept={dept} dirty={dirty} />
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1">
                                        <IconFileText className="w-3.5 h-3.5" /> Test Papers
                                    </p>
                                    <div className="space-y-2">
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 mb-1 block">Mandatory</label>
                                            <ServerSearchMultiSelect
                                                selectedIds={row.dojoMandatoryQuizId}
                                                onChange={(ids) => updateRow(dept.id, "dojoMandatoryQuizId", ids)}
                                                useSearchQuery={useLazyGetAllQuizzesQuery}
                                                fixedParams={{ isDojo: true }}
                                                disabled={!canUpdate}
                                                placeholder="Select test papers"
                                                unwrapResults={unwrapQuizzes}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 mb-1 block">Handover Marks</label>
                                            <ServerSearchMultiSelect
                                                selectedIds={row.dojoHandoverQuizId}
                                                onChange={(ids) => updateRow(dept.id, "dojoHandoverQuizId", ids)}
                                                useSearchQuery={useLazyGetAllQuizzesQuery}
                                                fixedParams={{ isDojo: true, isHandover: true }}
                                                disabled={!canUpdate}
                                                placeholder="Select test papers"
                                                unwrapResults={unwrapQuizzes}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 mb-1 block">1st Interview</label>
                                            {isSpecific ? (
                                                <ServerSearchMultiSelect
                                                    selectedIds={row.dojoInterviewQuizId}
                                                    onChange={(ids) => updateRow(dept.id, "dojoInterviewQuizId", ids)}
                                                    useSearchQuery={useLazyGetAllQuizzesQuery}
                                                    fixedParams={{ isDojo: true }}
                                                    disabled={!canUpdate}
                                                    placeholder="Select test papers"
                                                    unwrapResults={unwrapQuizzes}
                                                />
                                            ) : <NotRequiredPill />}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1">
                                        <IconClipboardCheck className="w-3.5 h-3.5" /> Evaluations
                                    </p>
                                    <div className="space-y-2">
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 mb-1 block">Handover Eligibility</label>
                                            <ServerSearchMultiSelect
                                                selectedIds={row.dojoEligibilityEvaluationId}
                                                onChange={(ids) => updateRow(dept.id, "dojoEligibilityEvaluationId", ids)}
                                                useSearchQuery={useLazyGetEvaluationTestsQuery}
                                                fixedParams={{}}
                                                disabled={!canUpdate}
                                                placeholder="Select evaluations"
                                                unwrapResults={unwrapEvaluations}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 mb-1 block">2nd Interview</label>
                                            {isSpecific ? (
                                                <ServerSearchMultiSelect
                                                    selectedIds={row.dojoInterviewEvaluationId}
                                                    onChange={(ids) => updateRow(dept.id, "dojoInterviewEvaluationId", ids)}
                                                    useSearchQuery={useLazyGetEvaluationTestsQuery}
                                                    fixedParams={{}}
                                                    disabled={!canUpdate}
                                                    placeholder="Select evaluations"
                                                    unwrapResults={unwrapEvaluations}
                                                />
                                            ) : <NotRequiredPill />}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                                    <div className="flex items-center gap-2">
                                        <IconUserStar className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm font-bold text-slate-700">Specific Department</span>
                                    </div>
                                    <Switch
                                        checked={isSpecific}
                                        onCheckedChange={(checked) => updateRow(dept.id, "isDojoSpecificDept", !!checked)}
                                        disabled={!canUpdate}
                                        className="cursor-pointer disabled:cursor-not-allowed"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead rowSpan={2} className="align-bottom">Department</TableHead>
                                <TableHead colSpan={3} className="text-center border-l border-slate-100 text-blue-700">
                                    <span className="inline-flex items-center gap-1.5"><IconFileText className="w-3.5 h-3.5" /> Test Papers</span>
                                </TableHead>
                                <TableHead colSpan={2} className="text-center border-l border-slate-100 text-teal-700">
                                    <span className="inline-flex items-center gap-1.5"><IconClipboardCheck className="w-3.5 h-3.5" /> Evaluations</span>
                                </TableHead>
                                <TableHead rowSpan={2} className="align-bottom text-center">Specific Dept</TableHead>
                                <TableHead rowSpan={2} className="align-bottom text-right">Actions</TableHead>
                            </TableRow>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="border-l border-slate-100 font-medium">Safety (HR)</TableHead>
                                <TableHead className="font-medium">Handover Marks</TableHead>
                                <TableHead className="font-medium">1st Interview (Safety)</TableHead>
                                <TableHead className="border-l border-slate-100 font-medium">Evaluation (HR)</TableHead>
                                <TableHead className="font-medium">2nd Interview (Safety)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingConfigs && (
                                [...Array(4)].map((_, i) => (
                                    <TableRow key={i}>
                                        {[...Array(8)].map((__, j) => (
                                            <TableCell key={j}><Skeleton className="h-8 w-full" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )}
                            {isEmpty && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12">
                                        <IconMoodEmpty className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                        <p className="text-sm font-bold text-slate-600">No departments found</p>
                                        <p className="text-xs text-slate-400">Try a different search term.</p>
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoadingConfigs && filteredDepartments.map((dept) => {
                                const row = rows[dept.id];
                                if (!row) return null;
                                const dirty = isRowDirty(dept);
                                const justSaved = justSavedId === dept.id;
                                const isSpecific = row.isDojoSpecificDept;
                                return (
                                    <TableRow
                                        key={dept.id}
                                        className={`transition-colors duration-500 ${justSaved ? "bg-emerald-50/60" : dirty ? "bg-amber-50/50" : undefined
                                            }`}
                                    >
                                        <TableCell className="font-bold text-slate-800">
                                            <div className="flex items-center gap-2">
                                                {dept.name}
                                                {justSaved ? (
                                                    <span title="Saved" className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-600">
                                                        <IconCheck className="w-3 h-3" /> Saved
                                                    </span>
                                                ) : dirty && (
                                                    <span title="Unsaved changes" className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="border-l border-slate-50">
                                            <ServerSearchMultiSelect
                                                selectedIds={row.dojoMandatoryQuizId}
                                                onChange={(ids) => updateRow(dept.id, "dojoMandatoryQuizId", ids)}
                                                useSearchQuery={useLazyGetAllQuizzesQuery}
                                                fixedParams={{ isDojo: true }}
                                                disabled={!canUpdate}
                                                placeholder="Select test papers"
                                                unwrapResults={unwrapQuizzes}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <ServerSearchMultiSelect
                                                selectedIds={row.dojoHandoverQuizId}
                                                onChange={(ids) => updateRow(dept.id, "dojoHandoverQuizId", ids)}
                                                useSearchQuery={useLazyGetAllQuizzesQuery}
                                                fixedParams={{ isDojo: true, isHandover: true }}
                                                disabled={!canUpdate}
                                                placeholder="Select test papers"
                                                unwrapResults={unwrapQuizzes}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {isSpecific ? (
                                                <ServerSearchMultiSelect
                                                    selectedIds={row.dojoInterviewQuizId}
                                                    onChange={(ids) => updateRow(dept.id, "dojoInterviewQuizId", ids)}
                                                    useSearchQuery={useLazyGetAllQuizzesQuery}
                                                    fixedParams={{ isDojo: true }}
                                                    disabled={!canUpdate}
                                                    placeholder="Select test papers"
                                                    unwrapResults={unwrapQuizzes}
                                                />
                                            ) : <NotRequiredPill />}
                                        </TableCell>
                                        <TableCell className="border-l border-slate-50">
                                            <ServerSearchMultiSelect
                                                selectedIds={row.dojoEligibilityEvaluationId}
                                                onChange={(ids) => updateRow(dept.id, "dojoEligibilityEvaluationId", ids)}
                                                useSearchQuery={useLazyGetEvaluationTestsQuery}
                                                fixedParams={{}}
                                                disabled={!canUpdate}
                                                placeholder="Select evaluations"
                                                unwrapResults={unwrapEvaluations}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {isSpecific ? (
                                                <ServerSearchMultiSelect
                                                    selectedIds={row.dojoInterviewEvaluationId}
                                                    onChange={(ids) => updateRow(dept.id, "dojoInterviewEvaluationId", ids)}
                                                    useSearchQuery={useLazyGetEvaluationTestsQuery}
                                                    fixedParams={{}}
                                                    disabled={!canUpdate}
                                                    placeholder="Select evaluations"
                                                    unwrapResults={unwrapEvaluations}
                                                />
                                            ) : <NotRequiredPill />}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Switch
                                                checked={isSpecific}
                                                onCheckedChange={(checked) => updateRow(dept.id, "isDojoSpecificDept", !!checked)}
                                                disabled={!canUpdate}
                                                className="cursor-pointer disabled:cursor-not-allowed"
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end">
                                                <RowActions dept={dept} dirty={dirty} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

export default DojoHiringConfig;
