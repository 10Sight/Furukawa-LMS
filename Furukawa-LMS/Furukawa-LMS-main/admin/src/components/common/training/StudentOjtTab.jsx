import React, { useMemo, useState } from "react";
import { IconArrowLeft, IconBook2, IconEye } from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/common/ui/card.jsx";
import { Button } from "@/components/common/ui/button.jsx";
import { Badge } from "@/components/common/ui/badge.jsx";
import { Skeleton } from "@/components/common/ui/skeleton.jsx";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/tables/primitives/table.jsx";
import { displayDate } from "@/utils/dateUtils.js";
import OJTTrainingRecordSheet from "./OJTTrainingRecordSheet.jsx";

const norm = (value) => String(value ?? "").trim().toLowerCase();

// Row results ("Approved" / "Rejected" / "Pending") plus the older "Pass" / "Fail" values.
const RESULT_BADGES = {
    Approved: ["Approved", "border-emerald-200 bg-emerald-50 text-emerald-700"],
    Pass: ["Approved", "border-emerald-200 bg-emerald-50 text-emerald-700"],
    Rejected: ["Rejected", "border-rose-200 bg-rose-50 text-rose-700"],
    Fail: ["Rejected", "border-rose-200 bg-rose-50 text-rose-700"],
};
const ResultBadge = ({ value }) => {
    const [label, className] = RESULT_BADGES[value] || ["Pending", "border-amber-200 bg-amber-50 text-amber-700"];
    return <Badge variant="outline" className={`font-bold ${className}`}>{label}</Badge>;
};

const formatDate = (value) => (value ? displayDate(value) || "—" : "—");
const joinNames = (...names) => names.filter(Boolean).join(" / ") || "—";

/**
 * On Job Training tab for a user's detail page. An OJT record sheet covers a whole batch of
 * trainees, each with their own attendance row (E-code, date, result); the sheet's `result` only
 * records the sheet's own check. So each row here shows the user's own result next to the sheet
 * status, and lists only sheets the user is really on: the server matches E-codes with LIKE,
 * so "E100" also returns sheets for "E1000" — those are dropped by the exact match below.
 */
const StudentOjtTab = ({ ojts = [], student, loading = false }) => {
    const [selectedOjtId, setSelectedOjtId] = useState(null);

    const rows = useMemo(() => {
        const codes = [student?.empId, student?.userName].map(norm).filter(Boolean);
        const userId = String(student?.id ?? student?._id ?? "");
        return ojts.flatMap((ojt) => {
            const record = (ojt.attendanceRecords || []).find((rec) => codes.includes(norm(rec?.ecode)));
            // Older single-trainee sheets name the trainee in `student` and carry the result on the sheet.
            const ownSheet = userId && String(ojt.student ?? "") === userId;
            if (!record && !ownSheet) return [];
            return [{
                ojt,
                id: ojt.id || ojt._id,
                trainingDate: record?.date || ojt.trainingDate,
                result: record ? record.result : ojt.result,
            }];
        });
    }, [ojts, student]);

    if (selectedOjtId) {
        return (
            <Card className="border border-slate-200 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b bg-slate-50/50">
                    <CardTitle className="text-xl font-bold text-slate-800">OJT Training Record Sheet</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setSelectedOjtId(null)}>
                        <IconArrowLeft className="h-4 w-4 mr-2" />
                        Back to List
                    </Button>
                </CardHeader>
                <CardContent className="pt-6">
                    <OJTTrainingRecordSheet
                        ojtId={selectedOjtId}
                        studentName={student?.fullName}
                        readOnly={true}
                        onBack={() => setSelectedOjtId(null)}
                    />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-slate-200 shadow-md">
            <CardHeader className="pb-3 border-b bg-slate-50/50">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <IconBook2 className="h-5 w-5 text-indigo-600" />
                    On Job Training
                </CardTitle>
                <CardDescription>
                    OJT training record sheets this operator attended, with their own result on each. Click a row to open the sheet.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                ) : rows.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-slate-200 rounded-xl bg-slate-50/30 text-slate-500">
                        <IconBook2 className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-base font-semibold text-slate-700">No OJT Records</h3>
                        <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                            This operator isn't on any On Job Training record sheet yet.
                        </p>
                    </div>
                ) : (
                    <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="font-bold text-slate-700">Training Topic</TableHead>
                                    <TableHead className="font-bold text-slate-700">Department</TableHead>
                                    <TableHead className="font-bold text-slate-700">Section / Line</TableHead>
                                    <TableHead className="font-bold text-slate-700">Sub-Section / Machine</TableHead>
                                    <TableHead className="font-bold text-slate-700">Training Date</TableHead>
                                    <TableHead className="font-bold text-slate-700">Trained By</TableHead>
                                    <TableHead className="font-bold text-slate-700">Result</TableHead>
                                    <TableHead className="font-bold text-slate-700">Sheet Status</TableHead>
                                    <TableHead className="font-bold text-slate-700 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map(({ ojt, id, trainingDate, result }) => (
                                    <TableRow
                                        key={id}
                                        className="cursor-pointer hover:bg-slate-50/40 transition-colors"
                                        onClick={() => setSelectedOjtId(id)}
                                    >
                                        <TableCell className="font-semibold text-slate-900">
                                            {ojt.trainingTopic || ojt.name || "—"}
                                        </TableCell>
                                        <TableCell className="text-slate-600">{ojt.department?.name || "—"}</TableCell>
                                        <TableCell className="text-slate-600">{joinNames(ojt.section?.name, ojt.line?.name)}</TableCell>
                                        <TableCell className="text-slate-600">{joinNames(ojt.subSection?.name, ojt.machine?.name)}</TableCell>
                                        <TableCell className="text-slate-600">{formatDate(trainingDate)}</TableCell>
                                        <TableCell className="text-slate-600">{ojt.trainingGivenBy || ojt.creatorName || "—"}</TableCell>
                                        <TableCell><ResultBadge value={result} /></TableCell>
                                        <TableCell><ResultBadge value={ojt.result} /></TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="border-indigo-100 text-indigo-700 hover:bg-indigo-50/50 hover:text-indigo-800 gap-1.5"
                                                onClick={(e) => { e.stopPropagation(); setSelectedOjtId(id); }}
                                            >
                                                <IconEye className="h-4 w-4" />
                                                View
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default StudentOjtTab;
