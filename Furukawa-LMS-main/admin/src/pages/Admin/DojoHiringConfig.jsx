import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import {
    useGetDojoHiringConfigsQuery,
    useSaveDojoHiringConfigMutation,
} from "@/Redux/AllApi/DepartmentApi";
import { useGetAllQuizzesQuery } from "@/Redux/AllApi/QuizApi";
import { useGetEvaluationTestsQuery } from "@/Redux/AllApi/EvaluationTestApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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

const NONE_VALUE = "none";

const toRowState = (dept) => ({
    dojoMandatoryQuizId: dept.dojoMandatoryQuizId ? String(dept.dojoMandatoryQuizId) : NONE_VALUE,
    dojoHandoverQuizId: dept.dojoHandoverQuizId ? String(dept.dojoHandoverQuizId) : NONE_VALUE,
    dojoInterviewQuizId: dept.dojoInterviewQuizId ? String(dept.dojoInterviewQuizId) : NONE_VALUE,
    dojoEligibilityEvaluationId: dept.dojoEligibilityEvaluationId ? String(dept.dojoEligibilityEvaluationId) : NONE_VALUE,
    dojoInterviewEvaluationId: dept.dojoInterviewEvaluationId ? String(dept.dojoInterviewEvaluationId) : NONE_VALUE,
    isDojoSpecificDept: !!dept.isDojoSpecificDept,
});

const rowsEqual = (a, b) => {
    if (!a || !b) return a === b;
    return (
        a.dojoMandatoryQuizId === b.dojoMandatoryQuizId &&
        a.dojoHandoverQuizId === b.dojoHandoverQuizId &&
        a.dojoInterviewQuizId === b.dojoInterviewQuizId &&
        a.dojoEligibilityEvaluationId === b.dojoEligibilityEvaluationId &&
        a.dojoInterviewEvaluationId === b.dojoInterviewEvaluationId &&
        a.isDojoSpecificDept === b.isDojoSpecificDept
    );
};

const isConfigured = (dept) => !!(dept.dojoHandoverQuizId || dept.dojoEligibilityEvaluationId);

const DojoHiringConfig = () => {
    const currentUser = useSelector((state) => state.auth.user);
    const hasPermission = (permission) => {
        if (currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") return true;
        return currentUser?.customRole?.permissions?.includes(permission);
    };
    const canUpdate = hasPermission("dojo_hiring:update");

    const { data: configsResponse, isLoading: isLoadingConfigs, refetch } = useGetDojoHiringConfigsQuery();
    const { data: quizzesResponse } = useGetAllQuizzesQuery({ isDojo: true, limit: 100 });
    const { data: evaluationTestsResponse } = useGetEvaluationTestsQuery();
    const [saveDojoHiringConfig] = useSaveDojoHiringConfigMutation();

    const departments = useMemo(() => configsResponse?.data || [], [configsResponse]);
    const dojoQuizzes = useMemo(() => quizzesResponse?.data?.quizzes || [], [quizzesResponse]);
    const handoverQuizzes = useMemo(() => dojoQuizzes.filter((q) => q.isHandover), [dojoQuizzes]);
    const evaluationTests = useMemo(() => evaluationTestsResponse?.data || [], [evaluationTestsResponse]);

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
                dojoMandatoryQuizId: row.dojoMandatoryQuizId === NONE_VALUE ? null : row.dojoMandatoryQuizId,
                dojoHandoverQuizId: row.dojoHandoverQuizId === NONE_VALUE ? null : row.dojoHandoverQuizId,
                dojoInterviewQuizId: row.dojoInterviewQuizId === NONE_VALUE ? null : row.dojoInterviewQuizId,
                dojoEligibilityEvaluationId: row.dojoEligibilityEvaluationId === NONE_VALUE ? null : row.dojoEligibilityEvaluationId,
                dojoInterviewEvaluationId: row.dojoInterviewEvaluationId === NONE_VALUE ? null : row.dojoInterviewEvaluationId,
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

    const evaluationsFor = (deptId) =>
        evaluationTests.filter((t) => !t.departmentId || String(t.departmentId) === String(deptId));

    const QuizSelect = ({ deptId, field, options, placeholder = "Select test paper" }) => (
        <Select
            value={rows[deptId]?.[field] || NONE_VALUE}
            onValueChange={(value) => updateRow(deptId, field, value)}
            disabled={!canUpdate}
        >
            <SelectTrigger className="w-full min-w-[170px] h-9 bg-white cursor-pointer disabled:cursor-not-allowed">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE_VALUE} className="cursor-pointer">None</SelectItem>
                {options.map((q) => (
                    <SelectItem key={q.id} value={String(q.id)} className="cursor-pointer">{q.title}</SelectItem>
                ))}
                {options.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-slate-400">No test papers available</div>
                )}
            </SelectContent>
        </Select>
    );

    const EvaluationSelect = ({ deptId, field, options }) => (
        <Select
            value={rows[deptId]?.[field] || NONE_VALUE}
            onValueChange={(value) => updateRow(deptId, field, value)}
            disabled={!canUpdate}
        >
            <SelectTrigger className="w-full min-w-[170px] h-9 bg-white cursor-pointer disabled:cursor-not-allowed">
                <SelectValue placeholder="Select evaluation" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE_VALUE} className="cursor-pointer">None</SelectItem>
                {options.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)} className="cursor-pointer">{t.title}</SelectItem>
                ))}
                {options.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-slate-400">No evaluations available</div>
                )}
            </SelectContent>
        </Select>
    );

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
                    className={`h-9 px-3 gap-1.5 font-bold transition-colors cursor-pointer disabled:cursor-not-allowed ${
                        justSaved
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
                            Map each department to the test papers and evaluation tests that govern mandatory training, handover marks and interviews.
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
                        const deptEvaluations = evaluationsFor(dept.id);
                        return (
                            <div
                                key={dept.id}
                                className={`rounded-xl border p-4 space-y-4 transition-colors duration-500 ${
                                    justSaved
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
                                            <QuizSelect deptId={dept.id} field="dojoMandatoryQuizId" options={dojoQuizzes} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 mb-1 block">Handover Marks</label>
                                            <QuizSelect deptId={dept.id} field="dojoHandoverQuizId" options={handoverQuizzes} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 mb-1 block">1st Interview</label>
                                            {isSpecific ? (
                                                <QuizSelect deptId={dept.id} field="dojoInterviewQuizId" options={dojoQuizzes} />
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
                                            <EvaluationSelect deptId={dept.id} field="dojoEligibilityEvaluationId" options={deptEvaluations} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 mb-1 block">2nd Interview</label>
                                            {isSpecific ? (
                                                <EvaluationSelect deptId={dept.id} field="dojoInterviewEvaluationId" options={deptEvaluations} />
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
                                <TableHead className="border-l border-slate-100 font-medium">Mandatory</TableHead>
                                <TableHead className="font-medium">Handover Marks</TableHead>
                                <TableHead className="font-medium">1st Interview</TableHead>
                                <TableHead className="border-l border-slate-100 font-medium">Eligibility</TableHead>
                                <TableHead className="font-medium">2nd Interview</TableHead>
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
                                const deptEvaluations = evaluationsFor(dept.id);
                                return (
                                    <TableRow
                                        key={dept.id}
                                        className={`transition-colors duration-500 ${
                                            justSaved ? "bg-emerald-50/60" : dirty ? "bg-amber-50/50" : undefined
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
                                            <QuizSelect deptId={dept.id} field="dojoMandatoryQuizId" options={dojoQuizzes} />
                                        </TableCell>
                                        <TableCell>
                                            <QuizSelect deptId={dept.id} field="dojoHandoverQuizId" options={handoverQuizzes} />
                                        </TableCell>
                                        <TableCell>
                                            {isSpecific ? (
                                                <QuizSelect deptId={dept.id} field="dojoInterviewQuizId" options={dojoQuizzes} />
                                            ) : <NotRequiredPill />}
                                        </TableCell>
                                        <TableCell className="border-l border-slate-50">
                                            <EvaluationSelect deptId={dept.id} field="dojoEligibilityEvaluationId" options={deptEvaluations} />
                                        </TableCell>
                                        <TableCell>
                                            {isSpecific ? (
                                                <EvaluationSelect deptId={dept.id} field="dojoInterviewEvaluationId" options={deptEvaluations} />
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
