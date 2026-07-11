import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { 
    useGetEvaluationTestByIdQuery, 
    useGetEvaluationTestAttemptsByTestIdQuery 
} from "@/Redux/AllApi/EvaluationTestApi";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetAllUsersQuery } from "@/Redux/AllApi/UserApi";
import { useLogActionMutation } from "@/Redux/AllApi/AuditApi";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    IconArrowLeft,
    IconSearch,
    IconClipboardCheck,
    IconFilter,
    IconLoader,
    IconUserPlus,
    IconEye,
    IconMapPin
} from "@tabler/icons-react";

const EvaluationTestOperatorsPage = () => {
    const { testId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const fromPath = location.state?.from || "/admin/evaluation-test";

    // Permission checking
    const currentUser = useSelector((state) => state.auth.user);
    const hasPermission = (permission) => {
        if (currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") return true;
        return currentUser?.customRole?.permissions?.includes(permission);
    };
    const canTake = hasPermission("dojo_evaluation_test:take");

    // Filters states
    const [selectedDepartment, setSelectedDepartment] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");

    // RTK Query hooks for dynamic hierarchy selectors
    const { data: departmentsRes } = useGetAllDepartmentsQuery({ page: 1, limit: 500 });
    const departments = departmentsRes?.data?.departments || [];

    // Fetch operators/users within the selected hierarchy
    const { data: usersRes, isLoading: isLoadingUsers } = useGetAllUsersQuery({
        departmentId: selectedDepartment === "all" ? "" : selectedDepartment,
        limit: 1000,
        includeTemporary: "only"
    });
    const operators = usersRes?.data?.users || [];

    // Fetch details of active evaluation test template
    const { data: testRes, isLoading: isLoadingTest } = useGetEvaluationTestByIdQuery(testId);
    const testDetail = testRes?.data;
    const testTitle = testDetail?.title || "DOJO Evaluation Test";
    const maxCols = testDetail?.performDateCount || 4;

    const [logAction] = useLogActionMutation();

    // Log page-view audit event once the template details have resolved
    useEffect(() => {
        if (testRes?.data) {
            logAction({
                action: "VIEW_EVALUATION_TEST_OPERATORS",
                details: { testId, testTitle: testRes.data.title }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [testRes]);

    // Fetch all submitted grading sheets/attempts for this specific template
    const { data: attemptsRes, isLoading: isLoadingAttempts, refetch: refetchAttempts } = 
        useGetEvaluationTestAttemptsByTestIdQuery(testId);
    const attempts = attemptsRes?.data || [];

    // Reset child selectors upon parent dropdown selection change
    const handleDeptChange = (value) => {
        setSelectedDepartment(value);
    };

    // Compile dynamic filled column indicators (which sub-columns contain actual grades/dates)
    const getFilledColumnsList = (attempt, columnsLimit) => {
        const rawAttemptData = attempt.attemptData || {};
        const filled = [];
        const actualLimit = Math.max(columnsLimit || 4, rawAttemptData._performDates?.length || 0);
        for (let colIdx = 0; colIdx < actualLimit; colIdx++) {
            const hasDate = !!rawAttemptData._performDates?.[colIdx];
            let hasGrade = false;
            Object.keys(rawAttemptData).forEach((qId) => {
                if (qId.startsWith("_")) return;
                const score = rawAttemptData[qId]?.results?.[colIdx];
                if (score && score !== "-") {
                    hasGrade = true;
                }
            });
            if (hasDate || hasGrade) {
                filled.push(colIdx + 1);
            }
        }
        return filled;
    };

    // Filter operators locally matching search term
    const filteredOperators = useMemo(() => {
        return operators.filter(op => {
            const matchName = op.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchId = op.empId?.toLowerCase().includes(searchTerm.toLowerCase());
            return matchName || matchId;
        });
    }, [operators, searchTerm]);

    // Cross-reference filtered operators list with submitted grading attempts
    const operatorAttemptsMap = useMemo(() => {
        const map = {};
        attempts.forEach(attempt => {
            if (attempt.employeeNo) {
                // Keep the latest attempt for the employeeNo / userName (uppercase normalized)
                const key = attempt.employeeNo.trim().toUpperCase();
                const existing = map[key];
                if (!existing || new Date(attempt.createdAt) > new Date(existing.createdAt)) {
                    map[key] = attempt;
                }
            }
        });
        return map;
    }, [attempts]);

    const isFetching = isLoadingUsers || isLoadingTest || isLoadingAttempts;

    const displayTitle = testTitle.toUpperCase().includes("DOJO") ? testTitle : "DOJO " + testTitle;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
                <div className="flex items-start gap-3">
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => navigate(fromPath)}
                        className="h-9 w-9 border-gray-200 text-gray-600 hover:text-gray-800"
                    >
                        <IconArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                            <IconClipboardCheck className="text-blue-600 h-7 w-7" />
                            {displayTitle} Dashboard
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Filter operators by department hierarchy, audit check statuses, and manage practical grading sign-offs.
                        </p>
                    </div>
                </div>
                {canTake && (
                    <Button 
                        onClick={() => navigate(`/admin/attempt-evaluation-test/${testId}`, { state: { from: location.pathname + location.search, grandFrom: fromPath } })}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-200 flex items-center gap-2"
                    >
                        <IconUserPlus className="h-4.5 w-4.5" />
                        Attempt DOJO Evaluation Test
                    </Button>
                )}
            </div>

            {/* Hierarchy Filters Card */}
            <Card className="border border-gray-150 shadow-sm rounded-xl">
                <CardHeader className="bg-gray-50/50 rounded-t-xl border-b border-gray-100 pb-3">
                    <CardTitle className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <IconFilter className="text-blue-500 h-4.5 w-4.5" />
                        Hierarchy Filters & Selection
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Department */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Department</label>
                            <Select value={selectedDepartment} onValueChange={handleDeptChange}>
                                <SelectTrigger className="h-9 text-xs border-gray-200 rounded-lg">
                                    <SelectValue placeholder="All Departments" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Departments</SelectItem>
                                    {departments.map((dept) => (
                                        <SelectItem key={dept._id || dept.id} value={String(dept._id || dept.id)}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Operator Search */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Search Operator</label>
                            <div className="relative">
                                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <Input 
                                    type="text"
                                    placeholder="Search operator by name or employee ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-9 pl-9 pr-4 py-2 border-gray-200 focus:ring-2 focus:ring-blue-100 rounded-lg text-xs"
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Operator Attempts Grid Card */}
            <Card className="border border-gray-150 shadow-sm rounded-xl">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold text-gray-800">Operator Evaluation List</CardTitle>
                    <CardDescription>
                        Operator sheets status matching current filters. Click View Sheet to inspect grades or Take Test to log results.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0 sm:px-6 pb-6">
                    {isFetching ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-3">
                            <IconLoader className="animate-spin text-blue-600 h-8 w-8" />
                            <span className="text-sm font-medium">Querying operator results...</span>
                        </div>
                    ) : filteredOperators.length === 0 ? (
                        <div className="text-center py-16 text-gray-500 border border-dashed border-gray-150 rounded-xl m-6">
                            <IconClipboardCheck className="mx-auto text-gray-300 h-16 w-16 stroke-1 mb-3" />
                            <p className="font-semibold text-base text-gray-700">No operators matching filters found</p>
                            <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1">
                                Check department hierarchy parameters or verify that employee records are active.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-gray-100">
                            <Table>
                                <TableHeader className="bg-gray-50/70">
                                    <TableRow>
                                        <TableHead className="w-12 text-center text-xs font-semibold text-gray-600 uppercase">S.No</TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-600 uppercase">Operator Name</TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-600 uppercase">Employee ID</TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-600 uppercase">DOJO Evaluation Test</TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-600 uppercase text-center">Attempt Sub-Columns Filled</TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-600 uppercase">Performed When</TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-600 uppercase text-center">Approved</TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-600 uppercase text-center">Confirmed</TableHead>
                                        <TableHead className="text-right text-xs font-semibold text-gray-600 uppercase pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                                                    {filteredOperators.map((operator, index) => {
                                        const opEmpIdKey = operator.empId?.trim().toUpperCase();
                                        const opUserKey = operator.userName?.trim().toUpperCase();
                                        const attempt = (opEmpIdKey ? operatorAttemptsMap[opEmpIdKey] : null) || 
                                                        (opUserKey ? operatorAttemptsMap[opUserKey] : null);
                                        const filledCols = attempt ? getFilledColumnsList(attempt, maxCols) : [];
                                        const hasAttempt = !!attempt;
                                        const actualAttemptCols = attempt ? Math.max(maxCols, attempt.attemptData?._performDates?.length || 0) : maxCols;

                                        return (
                                            <TableRow key={operator._id || operator.id} className="hover:bg-gray-50/50 transition-colors">
                                                <TableCell className="text-center font-medium text-gray-500">{index + 1}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="h-8 w-8 rounded-full bg-blue-50 border border-blue-100 text-blue-600 font-bold flex items-center justify-center text-xs shadow-sm uppercase shrink-0">
                                                            {operator.fullName?.charAt(0) || "U"}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-gray-800 leading-normal">{operator.fullName}</span>
                                                            <span className="text-[10px] text-gray-500 leading-tight">@{operator.userName || "operator"}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs font-semibold">
                                                    <span className="px-2 py-0.5 text-blue-700 bg-blue-50 border border-blue-100 rounded-full text-[10px]">
                                                        {(operator.userName || operator.empId || "N/A").toUpperCase()}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm font-medium text-gray-700 max-w-[200px] truncate">
                                                    {testTitle}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {hasAttempt ? (
                                                        filledCols.length === 0 ? (
                                                            <span className="text-[10.5px] font-semibold text-gray-400 italic">No columns filled</span>
                                                        ) : (
                                                            <div className="flex justify-center gap-1.5 flex-wrap max-w-[150px] mx-auto">
                                                                {filledCols.map(col => (
                                                                    <span 
                                                                        key={col} 
                                                                        className="px-1.5 py-0.5 text-[9px] font-extrabold text-green-700 bg-green-50 border border-green-150 rounded"
                                                                        title={`Column ${col} has values`}
                                                                    >
                                                                        Col {col}
                                                                    </span>
                                                                ))}
                                                                <span className="text-[10px] text-gray-500 font-semibold block w-full mt-0.5">
                                                                    ({filledCols.length} of {actualAttemptCols} filled)
                                                                </span>
                                                            </div>
                                                        )
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Not Attempted</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs text-gray-600">
                                                    {hasAttempt ? (
                                                        new Date(attempt.createdAt).toLocaleDateString("en-IN", {
                                                            day: "2-digit",
                                                            month: "short",
                                                            year: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit"
                                                        })
                                                    ) : (
                                                        <span className="text-gray-300 italic">-</span>
                                                    )}
                                                </TableCell>
                                                {/* Approved Column */}
                                                <TableCell className="text-center">
                                                    {hasAttempt ? (
                                                        attempt.attemptData?._approvedStatus === "APPROVED" ? (
                                                            <Badge className="bg-green-50 text-green-700 border border-green-200 text-[9px] uppercase font-bold px-2 py-0.5 hover:bg-green-50">
                                                                ✓ {attempt.attemptData?._approvedBy || "Manager"}
                                                            </Badge>
                                                        ) : attempt.attemptData?._approvedStatus === "REJECTED" ? (
                                                            <Badge className="bg-red-50 text-red-700 border border-red-200 text-[9px] uppercase font-bold px-2 py-0.5 hover:bg-red-50">
                                                                X {attempt.attemptData?._approvedBy || "Manager"}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-[10px] text-gray-400 font-medium italic">Pending</span>
                                                        )
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </TableCell>
                                                {/* Confirmed Column */}
                                                <TableCell className="text-center">
                                                    {hasAttempt ? (
                                                        attempt.attemptData?._confirmedStatus === "APPROVED" ? (
                                                            <Badge className="bg-green-50 text-green-700 border border-green-200 text-[9px] uppercase font-bold px-2 py-0.5 hover:bg-green-50">
                                                                ✓ {attempt.attemptData?._confirmedBy || "Manager"}
                                                            </Badge>
                                                        ) : attempt.attemptData?._confirmedStatus === "REJECTED" ? (
                                                            <Badge className="bg-red-50 text-red-700 border border-red-200 text-[9px] uppercase font-bold px-2 py-0.5 hover:bg-red-50">
                                                                X {attempt.attemptData?._confirmedBy || "Manager"}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-[10px] text-gray-400 font-medium italic">Pending</span>
                                                        )
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex justify-end gap-1.5">
                                                        {hasAttempt && (
                                                            <Button
                                                                variant="outline"
                                                                size="xs"
                                                                onClick={() => navigate(`/admin/view-evaluation-attempt/${attempt.id}`, { state: { from: location.pathname + location.search, grandFrom: fromPath } })}
                                                                className="h-7 text-[10px] px-2 text-blue-600 hover:text-blue-700 border-gray-200 flex items-center gap-1"
                                                            >
                                                                <IconEye className="h-3.5 w-3.5" />
                                                                View Sheet
                                                            </Button>
                                                        )}
                                                        {canTake && (
                                                            <Button
                                                                size="xs"
                                                                onClick={() => {
                                                                    if (hasAttempt) {
                                                                        navigate(`/admin/attempt-evaluation-test/${testId}?attemptId=${attempt.id}`, { state: { from: location.pathname + location.search, grandFrom: fromPath } });
                                                                    } else {
                                                                        navigate(`/admin/attempt-evaluation-test/${testId}?trainee=${encodeURIComponent(operator.fullName)}&empId=${encodeURIComponent(operator.userName || operator.empId)}`, { state: { from: location.pathname + location.search, grandFrom: fromPath } });
                                                                    }
                                                                }}
                                                                className="h-7 text-[10px] px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1"
                                                            >
                                                                <IconUserPlus className="h-3.5 w-3.5" />
                                                                {hasAttempt ? "Fill Sheet" : "Take Test"}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default EvaluationTestOperatorsPage;
