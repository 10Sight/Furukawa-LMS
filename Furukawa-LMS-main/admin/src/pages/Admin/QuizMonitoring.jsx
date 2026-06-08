import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AttemptReviewModal from "@/components/common/AttemptReviewModal";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetLinesQuery } from "@/Redux/AllApi/LineApi";
import { useGetSubSectionsQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetActiveConfigQuery } from "@/Redux/AllApi/CourseLevelConfigApi";
import { useGetMonitoringAttemptsQuery } from "@/Redux/AllApi/AttemptedQuizApi";
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
  IconFileText,
  IconTrash,
  IconDatabase,
  IconArrowRight,
  IconChevronRight,
  IconShieldCheck,
  IconAlertCircle
} from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";

const AdminQuizMonitoring = () => {
  const navigate = useNavigate();
  const [selectedDeptId, setSelectedDeptId] = useState("all");
  const [selectedSectionId, setSelectedSectionId] = useState("all");
  const [selectedLineId, setSelectedLineId] = useState("all");
  const [selectedSubSectionId, setSelectedSubSectionId] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [selectedTestType, setSelectedTestType] = useState("all");
  const [search, setSearch] = useState("");

  // 1. Fetch organizational metadata
  const { data: deptsData, isLoading: deptsLoading } = useGetAllDepartmentsQuery({ limit: 1000 });
  const departments = deptsData?.data?.departments || [];

  const deptQueryId = selectedDeptId === "all" ? "" : selectedDeptId;
  const { data: sectionsData, isLoading: sectionsLoading } = useGetSectionsByDepartmentQuery(deptQueryId, { skip: !deptQueryId });
  const sections = sectionsData?.data || [];

  const { data: linesData, isLoading: linesLoading } = useGetLinesQuery();
  const allLines = linesData?.data || [];
  const lines = useMemo(() => {
    if (selectedSectionId !== "all") {
      return allLines.filter(l => String(l.sectionId) === selectedSectionId);
    }
    if (selectedDeptId !== "all" && sections.length > 0) {
      const sectionIds = sections.map(s => String(s.id));
      return allLines.filter(l => sectionIds.includes(String(l.sectionId)));
    }
    return allLines;
  }, [allLines, selectedSectionId, selectedDeptId, sections]);

  const { data: subSectionsData, isLoading: subSectionsLoading } = useGetSubSectionsQuery({ limit: 1000 });
  const allSubSections = Array.isArray(subSectionsData?.data)
    ? subSectionsData.data
    : subSectionsData?.data?.subSections || [];
  const subSections = useMemo(() => {
    if (selectedLineId !== "all") {
      return allSubSections.filter(s => String(s.lineId) === selectedLineId);
    }
    if (selectedSectionId !== "all" && lines.length > 0) {
      const lineIds = lines.map(l => String(l.id));
      return allSubSections.filter(s => lineIds.includes(String(s.lineId)));
    }
    return allSubSections;
  }, [allSubSections, selectedLineId, selectedSectionId, lines]);

  const { data: activeConfigData } = useGetActiveConfigQuery();
  const levels = activeConfigData?.data?.levels || [];

  // Reset cascade when parent elements change
  const handleDeptChange = (val) => {
    setSelectedDeptId(val);
    setSelectedSectionId("all");
    setSelectedLineId("all");
    setSelectedSubSectionId("all");
  };

  const handleSectionChange = (val) => {
    setSelectedSectionId(val);
    setSelectedLineId("all");
    setSelectedSubSectionId("all");
  };

  const handleLineChange = (val) => {
    setSelectedLineId(val);
    setSelectedSubSectionId("all");
  };

  // 2. Fetch Attempts based on filters
  const queryParams = useMemo(() => {
    const params = {};
    if (selectedDeptId !== "all") params.departmentId = selectedDeptId;
    if (selectedSectionId !== "all") params.sectionId = selectedSectionId;
    if (selectedLineId !== "all") params.lineId = selectedLineId;
    if (selectedSubSectionId !== "all") params.subSectionId = selectedSubSectionId;
    if (selectedLevel !== "all") params.level = selectedLevel;
    if (selectedTestType !== "all") params.testType = selectedTestType;
    if (search.trim()) params.search = search.trim();
    return params;
  }, [selectedDeptId, selectedSectionId, selectedLineId, selectedSubSectionId, selectedLevel, selectedTestType, search]);

  const { data: attemptsData, isLoading: attemptsLoading, refetch } = useGetMonitoringAttemptsQuery(queryParams);
  const attempts = attemptsData?.data || [];

  const handleResetAll = () => {
    setSelectedDeptId("all");
    setSelectedSectionId("all");
    setSelectedLineId("all");
    setSelectedSubSectionId("all");
    setSelectedLevel("all");
    setSelectedTestType("all");
    setSearch("");
  };

  const hasActiveFilters = 
    selectedDeptId !== "all" ||
    selectedSectionId !== "all" ||
    selectedLineId !== "all" ||
    selectedSubSectionId !== "all" ||
    selectedLevel !== "all" ||
    selectedTestType !== "all" ||
    search.trim() !== "";

  // Helper: Display test type tag beautifully
  const getTestTypeBadge = (quiz) => {
    if (quiz?.isDojo) return <Badge className="bg-purple-100 text-purple-700 border border-purple-200">DOJO</Badge>;
    if (quiz?.isHandover) return <Badge className="bg-amber-100 text-amber-700 border border-amber-200">Handover</Badge>;
    if (quiz?.isTheoretical) return <Badge className="bg-teal-100 text-teal-700 border border-teal-200">Theoretical</Badge>;
    return <Badge className="bg-blue-100 text-blue-700 border border-blue-200">Regular</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Test & Evaluation Monitoring</h1>
          <p className="text-muted-foreground text-sm">
            Monitor, filter, and audit all submitted test papers across your production hierarchy
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9">
            <IconRefresh className="h-4 w-4 mr-2" /> Refresh Data
          </Button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <IconAdjustments className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Hierarchy & Scope Filters</CardTitle>
          </div>
          <CardDescription>Narrow down test submissions by organizational locations and test specifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Production Hierarchy Cascade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Department */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Department</label>
              <Select value={selectedDeptId} onValueChange={handleDeptChange}>
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Section</label>
              <Select 
                value={selectedSectionId} 
                onValueChange={handleSectionChange}
                disabled={selectedDeptId === "all"}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder={selectedDeptId === "all" ? "Select Department first" : "Select Section"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Line */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Line</label>
              <Select 
                value={selectedLineId} 
                onValueChange={handleLineChange}
                disabled={selectedSectionId === "all" && selectedDeptId === "all"}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="Select Line" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Lines</SelectItem>
                  {lines.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sub-Section */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Sub-Section</label>
              <Select 
                value={selectedSubSectionId} 
                onValueChange={setSelectedSubSectionId}
                disabled={selectedLineId === "all" && selectedSectionId === "all"}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="Select Sub-Section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sub-Sections</SelectItem>
                  {subSections.map((ss) => (
                    <SelectItem key={ss.id} value={String(ss.id)}>{ss.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Test Level, Type, and Search */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Level */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Test Level</label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="Select Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="L0 (Dojo User)">L0 (Dojo User)</SelectItem>
                  {levels.map((lvl) => (
                    <SelectItem key={lvl.name || lvl} value={lvl.name || lvl}>
                      {lvl.name || lvl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Test Type */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Test Type</label>
              <Select value={selectedTestType} onValueChange={setSelectedTestType}>
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="Select Test Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="REGULAR">Regular (Standalone)</SelectItem>
                  <SelectItem value="DOJO">DOJO hiring</SelectItem>
                  <SelectItem value="HANDOVER">Handover Paper</SelectItem>
                  <SelectItem value="THEORETICAL">Theoretical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Smart Search by User/Test */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Search Candidate or Test</label>
              <div className="relative">
                <Input
                  className="w-full h-10 pl-9 pr-8"
                  placeholder="Type name, E.Code, or test paper..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <IconSearch className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-3 h-4 w-4 hover:bg-gray-100 rounded-full flex items-center justify-center"
                  >
                    <IconX className="h-3 w-3 text-gray-500" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active Filter Badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
              <span className="text-xs font-semibold text-gray-500 mr-1">Active filters:</span>
              
              {selectedDeptId !== "all" && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                  Dept: {departments.find(d => String(d.id) === selectedDeptId)?.name || selectedDeptId}
                  <IconX className="h-3.5 w-3.5 cursor-pointer hover:bg-gray-200 rounded-full p-0.5" onClick={() => handleDeptChange("all")} />
                </Badge>
              )}
              {selectedSectionId !== "all" && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                  Sec: {sections.find(s => String(s.id) === selectedSectionId)?.name || selectedSectionId}
                  <IconX className="h-3.5 w-3.5 cursor-pointer hover:bg-gray-200 rounded-full p-0.5" onClick={() => handleSectionChange("all")} />
                </Badge>
              )}
              {selectedLineId !== "all" && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                  Line: {allLines.find(l => String(l.id) === selectedLineId)?.name || selectedLineId}
                  <IconX className="h-3.5 w-3.5 cursor-pointer hover:bg-gray-200 rounded-full p-0.5" onClick={() => handleLineChange("all")} />
                </Badge>
              )}
              {selectedSubSectionId !== "all" && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                  Sub-Sec: {allSubSections.find(ss => String(ss.id) === selectedSubSectionId)?.name || selectedSubSectionId}
                  <IconX className="h-3.5 w-3.5 cursor-pointer hover:bg-gray-200 rounded-full p-0.5" onClick={() => setSelectedSubSectionId("all")} />
                </Badge>
              )}
              {selectedLevel !== "all" && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                  Level: {selectedLevel}
                  <IconX className="h-3.5 w-3.5 cursor-pointer hover:bg-gray-200 rounded-full p-0.5" onClick={() => setSelectedLevel("all")} />
                </Badge>
              )}
              {selectedTestType !== "all" && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                  Type: {selectedTestType}
                  <IconX className="h-3.5 w-3.5 cursor-pointer hover:bg-gray-200 rounded-full p-0.5" onClick={() => setSelectedTestType("all")} />
                </Badge>
              )}
              {search && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                  Search: "{search}"
                  <IconX className="h-3.5 w-3.5 cursor-pointer hover:bg-gray-200 rounded-full p-0.5" onClick={() => setSearch("")} />
                </Badge>
              )}

              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleResetAll} 
                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
              >
                Clear All
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attempts Table Card */}
      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-0">
          {attemptsLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4 items-center">
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : attempts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50/75">
                  <TableRow>
                    <TableHead className="font-semibold text-gray-700 pl-6 py-4">Candidate</TableHead>
                    <TableHead className="font-semibold text-gray-700 py-4">Test Paper Details</TableHead>
                    <TableHead className="font-semibold text-gray-700 py-4">Hierarchy Station</TableHead>
                    <TableHead className="font-semibold text-gray-700 py-4">Grading Score</TableHead>
                    <TableHead className="font-semibold text-gray-700 py-4">Submitted At</TableHead>
                    <TableHead className="font-semibold text-gray-700 py-4">Time Taken</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-center pr-6 py-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((attempt) => {
                    const candidateName = attempt.student?.fullName || "Unknown";
                    const isDojoUser = attempt.student?.isTemporary;
                    const idLabel = isDojoUser ? "Base ID" : "ID";
                    const empIdValue = isDojoUser
                      ? (attempt.student?.userName || "N/A")
                      : (attempt.student?.empId || "N/A");

                    return (
                      <TableRow key={attempt._id || attempt.id} className="hover:bg-gray-50/50 transition-colors">
                        {/* Candidate Column */}
                        <TableCell className="pl-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-semibold border border-gray-200 shadow-sm">
                              {candidateName.charAt(0)}
                            </div>
                            <div className="space-y-0.5">
                              <div className="font-medium text-gray-900 leading-tight">{candidateName}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                                  {idLabel}: {empIdValue}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Test Paper Column */}
                        <TableCell className="py-4">
                          <div className="space-y-1 max-w-xs">
                            <div className="font-medium text-gray-900 line-clamp-1 leading-snug">
                              {attempt.quiz?.title || "Test Paper"}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {getTestTypeBadge(attempt.quiz)}
                              {attempt.quiz?.level && (
                                <Badge variant="outline" className="text-[10px] py-0 border-gray-300 bg-white text-gray-600 font-medium">
                                  {attempt.quiz.level}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Production Station Hierarchy Path */}
                        <TableCell className="py-4">
                          <div className="space-y-1 text-xs text-gray-600 max-w-sm">
                            <div className="flex items-center gap-1 text-gray-500 font-medium flex-wrap">
                              <span className="bg-slate-50 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded">
                                {attempt.student?.departmentName || "Dept N/A"}
                              </span>
                              {attempt.student?.sectionName && (
                                <>
                                  <IconChevronRight className="h-3 w-3 text-gray-400" />
                                  <span className="bg-slate-50 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded">
                                    {attempt.student.sectionName}
                                  </span>
                                </>
                              )}
                              {attempt.student?.lineName && (
                                <>
                                  <IconChevronRight className="h-3 w-3 text-gray-400" />
                                  <span className="bg-slate-50 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded">
                                    {attempt.student.lineName}
                                  </span>
                                </>
                              )}
                              {attempt.student?.subSectionName && (
                                <>
                                  <IconChevronRight className="h-3 w-3 text-gray-400" />
                                  <span className="bg-slate-50 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded">
                                    {attempt.student.subSectionName}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Grading Score */}
                        <TableCell className="py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">
                                {attempt.score} / {attempt.totalScore || 0}
                              </span>
                              <span className="text-xs text-gray-500">
                                ({attempt.totalScore > 0 ? Math.round((attempt.score / attempt.totalScore) * 100) : 0}%)
                              </span>
                            </div>
                            <div>
                              <Badge 
                                variant={attempt.status === "PASSED" ? "success" : "destructive"}
                                className="text-[10px] font-semibold py-0.5 px-2 tracking-wide"
                              >
                                {attempt.status === "PASSED" ? "PASS" : "FAIL"}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>

                        {/* Date Column */}
                        <TableCell className="py-4 text-xs text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <IconCalendar className="h-3.5 w-3.5 text-gray-400" />
                            <div>
                              <div>{new Date(attempt.createdAt || attempt.completedAt).toLocaleDateString()}</div>
                              <div className="text-[10px] text-gray-400">
                                {new Date(attempt.createdAt || attempt.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Time Taken Column */}
                        <TableCell className="py-4 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <IconClock className="h-3.5 w-3.5 text-gray-400" />
                            <span>{attempt.timeTaken ? `${Math.round(attempt.timeTaken / 60)} min` : "N/A"}</span>
                          </div>
                        </TableCell>

                        {/* Actions Column */}
                        <TableCell className="text-center pr-6 py-4">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => navigate(`/admin/quiz-monitoring/review/${attempt._id || attempt.id}`)}
                            className="h-8 w-8 p-0 border-gray-300 hover:bg-gray-50"
                            title="Audit Graded test Sheet"
                          >
                            <IconEye className="h-4 w-4 text-gray-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-gray-50 rounded-full border border-dashed border-gray-300 flex items-center justify-center mx-auto mb-4">
                <IconClipboardList className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-800">No test attempts found</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">
                We couldn't find any test submissions matching your current active filters. Try adjustments or query another E.Code.
              </p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={handleResetAll} className="mt-4 border-gray-300">
                  Reset Active Filters
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminQuizMonitoring;
