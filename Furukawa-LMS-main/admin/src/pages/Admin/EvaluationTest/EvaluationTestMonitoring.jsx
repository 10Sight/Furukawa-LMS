import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { 
  useGetEvaluationTestAttemptsQuery, 
  useDeleteEvaluationTestAttemptMutation 
} from "@/Redux/AllApi/EvaluationTestApi";
import { toast } from "sonner";
import {
  IconClipboardList,
  IconEye,
  IconRefresh,
  IconSearch,
  IconX,
  IconBuilding,
  IconAdjustments,
  IconUser,
  IconCalendar,
  IconClock,
  IconTrash,
  IconChevronRight,
  IconLoader,
  IconPencil,
  IconSquareCheck
} from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EvaluationTestMonitoring = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [deleteAttempt, { isLoading: isDeleting }] = useDeleteEvaluationTestAttemptMutation();
  const [deleteId, setDeleteId] = useState(null);

  // Filter States — persisted in the URL query string so they survive navigating
  // away to audit/attempt a test paper and back (see back-button `state.from` wiring).
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDeptId = searchParams.get("deptId") || "all";
  const selectedTestDeptId = searchParams.get("testDeptId") || "all";
  const search = searchParams.get("search") || "";
  const rawPage = parseInt(searchParams.get("page"), 10);
  const currentPage = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const itemsPerPage = 10;

  // Merges the given updates into the URL search params, dropping keys back to
  // their default (deptId=all, testDeptId=all, search="", page=1) so the URL stays clean.
  const updateParams = useCallback((updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        const isDefault =
          value === null || value === undefined || value === "" ||
          value === "all" || (key === "page" && Number(value) === 1);
        if (isDefault) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Restrict the Test Paper Dept filter for non-admin users assigned to specific departments.
  // The trainee Department filter stays unrestricted so restricted users can still monitor
  // all temporary users' evaluation test attempts.
  const currentUser = useSelector((state) => state.auth.user);
  const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "SUPERADMIN" || currentUser?.isAdmin;

  const assignedDepartments = useMemo(() => {
    if (isAdmin) return [];
    const ids = [];
    if (Array.isArray(currentUser?.departments)) {
      currentUser.departments.forEach((d) => {
        const id = d && typeof d === "object" ? (d.id || d._id) : d;
        if (id) ids.push(String(id));
      });
    }
    if (currentUser?.departmentId) ids.push(String(currentUser.departmentId));
    return [...new Set(ids)];
  }, [currentUser, isAdmin]);

  const isUserRestricted = !isAdmin && assignedDepartments.length > 0;
  const isTestDeptSelectDisabled = isUserRestricted && assignedDepartments.length === 1;

  useEffect(() => {
    if (isUserRestricted && !assignedDepartments.includes(selectedTestDeptId)) {
      updateParams({ testDeptId: assignedDepartments[0] });
    }
  }, [isUserRestricted, assignedDepartments, selectedTestDeptId, updateParams]);

  // 1. Fetch organizational departments
  const { data: deptsData } = useGetAllDepartmentsQuery({ limit: 1000 });
  const departments = deptsData?.data?.departments || [];

  const uniqueDepartments = useMemo(() => {
    const seenIds = new Set();
    const seenNames = new Set();
    return departments.filter(d => {
      const idStr = String(d.id || d._id || '');
      const nameStr = (d.name || '').trim().toLowerCase();
      if (!idStr || seenIds.has(idStr) || seenNames.has(nameStr)) return false;
      seenIds.add(idStr);
      seenNames.add(nameStr);
      return true;
    });
  }, [departments]);

  const assignableTestDepartments = useMemo(() => {
    if (!isUserRestricted) return uniqueDepartments;
    return uniqueDepartments.filter((d) => assignedDepartments.includes(String(d.id)));
  }, [uniqueDepartments, assignedDepartments, isUserRestricted]);

  // Fetch attempts
  const { data: attemptsRes, isLoading: attemptsLoading, refetch } = useGetEvaluationTestAttemptsQuery();
  const rawAttempts = attemptsRes?.data || [];

  const handleDeptChange = (val) => {
    updateParams({ deptId: val, page: 1 });
  };

  const handleTestDeptChange = (val) => {
    updateParams({ testDeptId: val, page: 1 });
  };

  const handleDeleteClick = (id) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAttempt(deleteId).unwrap();
      toast.success("Evaluation sheet attempt deleted successfully");
      setDeleteId(null);
      refetch();
    } catch (error) {
      console.error("Failed to delete attempt:", error);
      toast.error(error?.data?.message || "Failed to delete attempt");
    }
  };

  const handleResetAll = () => {
    updateParams({ deptId: "all", testDeptId: "all", search: "", page: 1 });
  };

  const hasActiveFilters =
    selectedDeptId !== "all" ||
    selectedTestDeptId !== "all" ||
    search.trim() !== "";

  // Compile dynamic filled column indicators
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

  // Filter attempts locally
  const filteredAttempts = useMemo(() => {
    return rawAttempts.filter((attempt) => {
      // 0. Only show Dojo (temporary) candidate attempts — check both the resolved
      // flag and the raw snapshot so handed-over/LEFT/deleted candidates stay visible.
      const isDojoUserAttempt =
        attempt.studentIsTemporary === 1 || attempt.studentIsTemporary === true || String(attempt.studentIsTemporary) === '1' ||
        attempt.isTemporary === 1 || attempt.isTemporary === true || String(attempt.isTemporary) === '1';
      if (!isDojoUserAttempt) {
        return false;
      }
      // 1. Department Filter
      if (selectedDeptId !== "all" && String(attempt.departmentId) !== selectedDeptId) {
        return false;
      }
      // 1b. Test Paper Department Filter
      if (selectedTestDeptId !== "all" && String(attempt.testDepartmentId) !== selectedTestDeptId) {
        return false;
      }
      // 2. Search Bar
      if (search.trim()) {
        const query = search.toLowerCase();
        const traineeName = (attempt.traineeName || "").toLowerCase();
        const employeeNo = (attempt.employeeNo || "").toLowerCase();
        const educatorName = (attempt.educatorName || "").toLowerCase();
        const testTitle = (attempt.testTitle || "").toLowerCase();
        if (
          !traineeName.includes(query) &&
          !employeeNo.includes(query) &&
          !educatorName.includes(query) &&
          !testTitle.includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [rawAttempts, selectedDeptId, selectedTestDeptId, search]);

  // Paginated attempts
  const paginatedAttempts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAttempts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAttempts, currentPage]);

  const totalPages = Math.ceil(filteredAttempts.length / itemsPerPage) || 1;

  // Clamp an out-of-range page from the URL (e.g. returning from a stale link, or a
  // filter/delete shrinking the result set) back within bounds once the data has loaded.
  useEffect(() => {
    if (!attemptsLoading && currentPage > totalPages) {
      updateParams({ page: totalPages });
    }
  }, [attemptsLoading, currentPage, totalPages, updateParams]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <IconClipboardList className="text-blue-600 h-7 w-7" />
            DOJO Evaluation Monitoring
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Monitor, audit, and inspect all practical DOJO evaluation test submissions and sign-offs for temporary users.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9 border-gray-200">
            <IconRefresh className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <Card className="border border-gray-150/60 shadow-sm rounded-xl bg-white">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <IconAdjustments className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base font-semibold text-gray-800">Hierarchy & Search Selection</CardTitle>
          </div>
          <CardDescription>Filter submitted evaluation sheets for temporary users by department and candidate/evaluator details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Department */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Department</label>
              <Select value={selectedDeptId} onValueChange={handleDeptChange}>
                <SelectTrigger className="h-9 text-xs border-gray-200 rounded-lg">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {uniqueDepartments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Test Paper Department */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Test Paper Dept</label>
              <Select value={selectedTestDeptId} onValueChange={handleTestDeptChange} disabled={isTestDeptSelectDisabled}>
                <SelectTrigger className="h-9 text-xs border-gray-200 rounded-lg">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  {!isUserRestricted && (
                    <SelectItem value="all">All Departments</SelectItem>
                  )}
                  {assignableTestDepartments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Search Candidate or Evaluator</label>
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  className="h-9 pl-9 pr-8 border-gray-200 focus:ring-2 focus:ring-blue-100 rounded-lg text-xs"
                  placeholder="Search trainee name, E-code, evaluator, or test title..."
                  value={search}
                  onChange={(e) => updateParams({ search: e.target.value, page: 1 })}
                />
                {search && (
                  <button
                    onClick={() => updateParams({ search: "", page: 1 })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 hover:bg-gray-100 rounded-full flex items-center justify-center"
                  >
                    <IconX className="h-3 w-3 text-gray-500" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active Filter Badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-500 mr-1">Active filters:</span>

              {selectedDeptId !== "all" && (
                <Badge variant="secondary" className="gap-1 pl-2.5 pr-1.5 py-1 bg-slate-100 text-slate-700 font-medium">
                  Dept: {departments.find(d => String(d.id) === selectedDeptId)?.name || selectedDeptId}
                  <IconX className="h-3.5 w-3.5 cursor-pointer hover:bg-slate-200 rounded-full p-0.5" onClick={() => handleDeptChange("all")} />
                </Badge>
              )}
              {selectedTestDeptId !== "all" && (
                <Badge variant="secondary" className="gap-1 pl-2.5 pr-1.5 py-1 bg-slate-100 text-slate-700 font-medium">
                  Test Dept: {departments.find(d => String(d.id) === selectedTestDeptId)?.name || selectedTestDeptId}
                  <IconX className="h-3.5 w-3.5 cursor-pointer hover:bg-slate-200 rounded-full p-0.5" onClick={() => updateParams({ testDeptId: "all" })} />
                </Badge>
              )}
              {search && (
                <Badge variant="secondary" className="gap-1 pl-2.5 pr-1.5 py-1 bg-slate-100 text-slate-700 font-medium">
                  Search: "{search}"
                  <IconX className="h-3.5 w-3.5 cursor-pointer hover:bg-slate-200 rounded-full p-0.5" onClick={() => updateParams({ search: "", page: 1 })} />
                </Badge>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetAll}
                className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 ml-auto font-semibold"
              >
                Clear All
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attempts List Table */}
      <Card className="border border-gray-150/60 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardContent className="p-0">
          {attemptsLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4 items-center">
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredAttempts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50/75 border-b border-gray-100">
                  <TableRow>
                    <TableHead className="font-semibold text-gray-700 pl-6 py-4">Trainee</TableHead>
                    <TableHead className="font-semibold text-gray-700 py-4">DOJO Evaluation Test</TableHead>
                    <TableHead className="font-semibold text-gray-700 py-4">Hierarchy Location</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-center py-4">Sub-Columns Filled</TableHead>
                    <TableHead className="font-semibold text-gray-700 py-4">Submitted Details</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-center py-4">Approved</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-center py-4">Confirmed</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right pr-6 py-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAttempts.map((attempt) => {
                    const traineeName = attempt.traineeName || "Unknown";
                    const isTemp = !attempt.userId; // fallback check for temp id
                    const idLabel = isTemp ? "Base ID" : "ID";
                    const empIdVal = attempt.userName || attempt.employeeNo || "N/A";
                    const maxCols = attempt.performDateCount || 4;
                    const filledCols = getFilledColumnsList(attempt, maxCols);
                    const actualAttemptCols = Math.max(maxCols, attempt.attemptData?._performDates?.length || 0);

                    return (
                      <TableRow key={attempt.id} className="hover:bg-slate-50/30 transition-colors border-b border-gray-100">
                        {/* Trainee Details */}
                        <TableCell className="pl-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold shadow-sm uppercase shrink-0">
                              {traineeName.charAt(0)}
                            </div>
                            <div className="space-y-0.5">
                              <div className="font-semibold text-gray-900 leading-tight">{traineeName}</div>
                              <div className="flex items-center mt-0.5">
                                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                                  {idLabel}: {empIdVal.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Test details */}
                        <TableCell className="py-4">
                          <div className="font-medium text-gray-900 max-w-[200px] truncate leading-normal">
                            {attempt.testTitle || "DOJO Evaluation Test"}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Template ID: {attempt.testId}</div>
                        </TableCell>

                        {/* Hierarchy Path */}
                        <TableCell className="py-4">
                          {attempt.departmentName ? (
                            <div className="flex items-center gap-1 text-[11px] text-gray-600 flex-wrap max-w-sm">
                              <span className="bg-slate-50 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded font-medium">
                                {attempt.departmentName}
                              </span>
                              {attempt.sectionName && (
                                <>
                                  <IconChevronRight className="h-3 w-3 text-gray-400" />
                                  <span className="bg-slate-50 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded font-medium">
                                    {attempt.sectionName}
                                  </span>
                                </>
                              )}
                              {attempt.lineName && (
                                <>
                                  <IconChevronRight className="h-3 w-3 text-gray-400" />
                                  <span className="bg-slate-50 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded font-medium">
                                    {attempt.lineName}
                                  </span>
                                </>
                              )}
                              {attempt.subSectionName && (
                                <>
                                  <IconChevronRight className="h-3 w-3 text-gray-400" />
                                  <span className="bg-slate-50 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded font-medium">
                                    {attempt.subSectionName}
                                  </span>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No hierarchy path</span>
                          )}
                        </TableCell>

                        {/* Columns filled */}
                        <TableCell className="text-center py-4">
                          {filledCols.length === 0 ? (
                            <span className="text-[10.5px] font-semibold text-gray-400 italic">No columns filled</span>
                          ) : (
                            <div className="flex justify-center gap-1 flex-wrap max-w-[140px] mx-auto">
                              {filledCols.map(col => (
                                <span 
                                  key={col} 
                                  className="px-1.5 py-0.5 text-[9px] font-extrabold text-green-700 bg-green-50 border border-green-150 rounded"
                                  title={`Column ${col} has values`}
                                >
                                  Col {col}
                                </span>
                              ))}
                              <span className="text-[10px] text-gray-400 font-semibold block w-full mt-0.5">
                                ({filledCols.length} of {actualAttemptCols} filled)
                              </span>
                            </div>
                          )}
                        </TableCell>

                        {/* Submitted timestamp & educator */}
                        <TableCell className="py-4 text-xs text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <IconCalendar className="h-3.5 w-3.5 text-gray-400" />
                            <div>
                              <div className="font-medium">{new Date(attempt.createdAt).toLocaleDateString("en-IN")}</div>
                              <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                                <IconClock className="h-3 w-3" />
                                {new Date(attempt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                          {attempt.educatorName && (
                            <div className="text-[10px] text-gray-500 font-semibold mt-1 flex items-center gap-1">
                              <IconUser className="h-3 w-3 text-slate-400" />
                              Eval: {attempt.educatorName}
                            </div>
                          )}
                        </TableCell>

                        {/* Approved Badge */}
                        <TableCell className="text-center py-4">
                          {attempt.attemptData?._approvedStatus === "APPROVED" ? (
                            <Badge className="bg-green-50 text-green-700 border border-green-200 text-[9px] uppercase font-black px-2 py-0.5 hover:bg-green-50">
                              ✓ {attempt.attemptData?._approvedBy || "Manager"}
                            </Badge>
                          ) : attempt.attemptData?._approvedStatus === "REJECTED" ? (
                            <Badge className="bg-red-50 text-red-700 border border-red-200 text-[9px] uppercase font-black px-2 py-0.5 hover:bg-red-50">
                              X {attempt.attemptData?._approvedBy || "Manager"}
                            </Badge>
                          ) : (
                            <span className="text-[10.5px] text-slate-400 font-medium italic">Pending</span>
                          )}
                        </TableCell>

                        {/* Confirmed Badge */}
                        <TableCell className="text-center py-4">
                          {attempt.attemptData?._confirmedStatus === "APPROVED" ? (
                            <Badge className="bg-green-50 text-green-700 border border-green-200 text-[9px] uppercase font-black px-2 py-0.5 hover:bg-green-50">
                              ✓ {attempt.attemptData?._confirmedBy || "Manager"}
                            </Badge>
                          ) : attempt.attemptData?._confirmedStatus === "REJECTED" ? (
                            <Badge className="bg-red-50 text-red-700 border border-red-200 text-[9px] uppercase font-black px-2 py-0.5 hover:bg-red-50">
                              X {attempt.attemptData?._confirmedBy || "Manager"}
                            </Badge>
                          ) : (
                            <span className="text-[10.5px] text-slate-400 font-medium italic">Pending</span>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right pr-6 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/admin/view-evaluation-attempt/${attempt.id}`, { state: { from: location.pathname + location.search } })}
                              className="h-8 w-8 p-0 border-gray-200 hover:bg-slate-50 text-slate-600 rounded-lg"
                              title="Audit Test Sheet"
                            >
                              <IconEye className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/admin/attempt-evaluation-test/${attempt.testId}?attemptId=${attempt.id}`, { state: { from: location.pathname + location.search } })}
                              className="h-8 w-8 p-0 border-gray-200 hover:bg-slate-50 text-slate-600 rounded-lg"
                              title="Edit/Fill Sheet"
                            >
                              <IconPencil className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteClick(attempt.id)}
                              className="h-8 w-8 p-0 border-red-200 hover:bg-rose-50 text-rose-600 rounded-lg"
                              title="Delete Sheet Attempt"
                            >
                              <IconTrash className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full border border-dashed border-gray-300 flex items-center justify-center mx-auto mb-4">
                <IconClipboardList className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-800">No evaluation test attempts found</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">
                We couldn't find any evaluation test submissions matching your current filters. Try adjusting your selections.
              </p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={handleResetAll} className="mt-4 border-gray-200 rounded-lg">
                  Reset Active Filters
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination Footer */}
      {filteredAttempts.length > itemsPerPage && (
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-150/60">
          <p className="text-slate-400 text-sm font-medium">
            Showing <span className="text-slate-900 font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-900 font-bold">{Math.min(currentPage * itemsPerPage, filteredAttempts.length)}</span> of <span className="text-slate-900 font-bold">{filteredAttempts.length}</span> entries
          </p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={currentPage === 1}
              onClick={() => updateParams({ page: currentPage - 1 })}
              className="rounded-lg border-gray-250"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => updateParams({ page: currentPage + 1 })}
              className="rounded-lg border-gray-250"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">Delete Evaluation Sheet Attempt</DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-2">
              Are you sure you want to delete this evaluation attempt? This will permanently remove the logged grading scores and sign-offs for this trainee. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setDeleteId(null)}
              disabled={isDeleting}
              className="border-gray-200 rounded-lg"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 font-semibold rounded-lg"
            >
              {isDeleting ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EvaluationTestMonitoring;
