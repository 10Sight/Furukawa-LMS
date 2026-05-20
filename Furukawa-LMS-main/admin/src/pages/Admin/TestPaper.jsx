import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetAllQuizzesQuery, useDeleteQuizMutation } from "@/Redux/AllApi/QuizApi";
import { useGetSubSectionsQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetLinesQuery } from "@/Redux/AllApi/LineApi";
import { useGetActiveConfigQuery } from "@/Redux/AllApi/CourseLevelConfigApi";
import {
  IconFileText,
  IconSearch,
  IconFilter,
  IconExternalLink,
  IconRefresh,
  IconClock,
  IconCertificate,
  IconPlayerPlay,
  IconLayoutGrid,
  IconEdit,
  IconTrash
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

import { useSelector } from "react-redux";

const TestPaper = () => {
  const navigate = useNavigate();
  const currentUser = useSelector((state) => state.auth.user);

  const hasPermission = (permission) => {
    if (currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") return true;
    return currentUser?.customRole?.permissions?.includes(permission);
  };

  const canRead = hasPermission("test_paper:read") || currentUser?.role === "STUDENT" || currentUser?.isEmployee;
  const canManage = hasPermission("test_paper:create");

  const isAuthorizedToAccessAll = currentUser?.role === "SUPERADMIN" || 
                                  currentUser?.role === "ADMIN" || 
                                  hasPermission("test_paper:access_all");

  const canEdit = currentUser?.role === "SUPERADMIN" || 
                  currentUser?.role === "ADMIN" || 
                  hasPermission("test_paper:edit");

  const canDelete = currentUser?.role === "SUPERADMIN" || 
                    currentUser?.role === "ADMIN" || 
                    hasPermission("test_paper:delete");

  const [selectedDepartment, setSelectedDepartment] = useState(() => {
    if (!isAuthorizedToAccessAll && currentUser?.departmentId) {
      return String(currentUser.departmentId);
    }
    return "ALL";
  });

  const [selectedSection, setSelectedSection] = useState(() => {
    if (!isAuthorizedToAccessAll && currentUser?.sectionId) {
      return String(currentUser.sectionId);
    }
    return "ALL";
  });

  const [selectedLine, setSelectedLine] = useState(() => {
    if (!isAuthorizedToAccessAll && currentUser?.lineId) {
      return String(currentUser.lineId);
    }
    return "ALL";
  });

  const [selectedSubSection, setSelectedSubSection] = useState(() => {
    if (!isAuthorizedToAccessAll && currentUser?.subSectionId) {
      return String(currentUser.subSectionId);
    }
    return "ALL";
  });
  const [selectedLevel, setSelectedLevel] = useState("ALL");
  const [selectedTestType, setSelectedTestType] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  // Fetch Departments
  const { data: departmentsData, isLoading: departmentsLoading } = useGetAllDepartmentsQuery({ limit: 1000 });
  const departments = departmentsData?.data?.departments || [];

  // Fetch Sections based on selected Department
  const { data: sectionsData, isLoading: sectionsLoading } = useGetSectionsByDepartmentQuery(
    selectedDepartment !== "ALL" ? selectedDepartment : null,
    { skip: selectedDepartment === "ALL" }
  );
  const sections = sectionsData?.data || [];

  // Fetch all lines
  const { data: linesData } = useGetLinesQuery();
  const allLines = linesData?.data || [];

  // Filtered lines based on selectedSection
  const lines = useMemo(() => {
    if (selectedSection !== "ALL") {
      return allLines.filter(l => String(l.sectionId || l._id) === selectedSection);
    }
    if (selectedDepartment !== "ALL") {
      return allLines.filter(l => String(l.department || l.departmentId) === selectedDepartment);
    }
    return allLines;
  }, [allLines, selectedSection, selectedDepartment]);

  // Fetch all sub-sections for rendering names
  const { data: subSectionsData } = useGetSubSectionsQuery({ limit: 1000 });
  const subSections = Array.isArray(subSectionsData?.data)
    ? subSectionsData.data
    : (subSectionsData?.data?.subSections || []);

  // Filtered sub-sections options based on selectedLine
  const filteredSubSections = useMemo(() => {
    if (selectedLine !== "ALL") {
      return subSections.filter(s => String(s.lineId) === selectedLine);
    }
    if (selectedSection !== "ALL") {
      // Find lines that belong to this section
      const sectionLineIds = allLines.filter(l => String(l.sectionId) === selectedSection).map(l => String(l.id || l._id));
      return subSections.filter(s => sectionLineIds.includes(String(s.lineId)));
    }
    return subSections;
  }, [subSections, selectedLine, selectedSection, allLines]);

  // Fetch active config levels
  const { data: activeConfigData } = useGetActiveConfigQuery();
  const activeLevels = activeConfigData?.data?.levels || [];

  // Fetch Quizzes with filters
  const { data: quizzesData, isLoading: quizzesLoading, refetch } = useGetAllQuizzesQuery({
    page,
    limit: 50,
    search: searchTerm,
    departmentId: selectedDepartment !== "ALL" ? selectedDepartment : undefined,
    sectionId: selectedSection !== "ALL" ? selectedSection : undefined,
    isDojo: currentUser?.isTemporary ? true : undefined,
  });

  const [deleteQuiz] = useDeleteQuizMutation();

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this test paper? This action cannot be undone.")) {
      try {
        await deleteQuiz(id).unwrap();
        toast.success("Test paper deleted successfully");
        refetch();
      } catch (err) {
        toast.error(err?.data?.message || "Failed to delete test paper");
      }
    }
  };

  const rawQuizzes = quizzesData?.data?.quizzes || [];
  const pagination = quizzesData?.data?.pagination || {};

  const quizzes = useMemo(() => {
    return rawQuizzes.filter(quiz => {
      // 1. Line Filter
      if (selectedLine !== "ALL") {
        const quizLineIds = (quiz.lineId || []).map(String);
        if (!quizLineIds.includes(selectedLine)) {
          return false;
        }
      }

      // 2. Sub-section Filter
      if (selectedSubSection !== "ALL") {
        const quizSubSectionIds = (quiz.subSectionId || []).map(String);
        if (!quizSubSectionIds.includes(selectedSubSection)) {
          return false;
        }
      }

      // 3. Level Filter
      if (selectedLevel !== "ALL") {
        if (quiz.level !== selectedLevel) {
          return false;
        }
      }

      // 4. Test Type Filter
      if (selectedTestType !== "ALL") {
        if (selectedTestType === "dojo" && !quiz.isDojo) return false;
        if (selectedTestType === "handover" && !quiz.isHandover) return false;
        if (selectedTestType === "theoretical" && !quiz.isTheoretical) return false;
        if (selectedTestType === "practical" && (quiz.isDojo || quiz.isHandover || quiz.isTheoretical)) return false;
      }

      return true;
    });
  }, [rawQuizzes, selectedLine, selectedSubSection, selectedLevel, selectedTestType]);

  const handleReset = () => {
    setSelectedDepartment(!isAuthorizedToAccessAll && currentUser?.departmentId ? String(currentUser.departmentId) : "ALL");
    setSelectedSection(!isAuthorizedToAccessAll && currentUser?.sectionId ? String(currentUser.sectionId) : "ALL");
    setSelectedLine(!isAuthorizedToAccessAll && currentUser?.lineId ? String(currentUser.lineId) : "ALL");
    setSelectedSubSection(!isAuthorizedToAccessAll && currentUser?.subSectionId ? String(currentUser.subSectionId) : "ALL");
    setSelectedLevel("ALL");
    setSelectedTestType("ALL");
    setSearchTerm("");
    setPage(1);
  };

  if (!canRead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <IconFileText className="w-12 h-12 text-slate-300" />
        <h2 className="text-2xl font-bold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 max-w-md">You do not have permission to view the Test Papers. Please contact your administrator.</p>
      </div>
    );
  }

  // Candidate Assessment Center UI (isTemporary: true)
  if (currentUser?.isTemporary) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] pb-12">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white py-12 px-8 mb-8 shadow-lg">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">DOJO Assessment Center</h1>
            <p className="text-blue-100 text-lg opacity-90">
              Welcome, <span className="text-white font-semibold">{currentUser.fullName}</span>! Here are your assigned assessments for the hiring process.
            </p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Available Assessments</h2>
              <p className="text-slate-500">Complete these tests to proceed with your application.</p>
            </div>
            <Button variant="outline" onClick={() => refetch()} className="bg-white hover:bg-slate-50 shadow-sm border-slate-200">
              <IconRefresh className="h-4 w-4 mr-2 text-blue-600" />
              Refresh List
            </Button>
          </div>

          {quizzesLoading ? (
            <Card className="border-none shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Assessment Name</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Questions</TableHead>
                      <TableHead>Min. Score</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[1, 2, 3].map((i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-10 w-24 ml-auto rounded-md" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : quizzes.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 bg-white/50 py-20">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <div className="bg-slate-100 p-4 rounded-full mb-4">
                  <IconFileText className="h-10 w-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">No Assessments Assigned</h3>
                <p className="text-slate-500 max-w-sm">
                  There are currently no assessments assigned to your profile. Please check back later or contact your supervisor.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-none shadow-xl overflow-hidden rounded-2xl bg-white">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="border-b border-slate-100 h-14">
                    <TableHead className="pl-8 font-bold text-slate-900 text-sm uppercase tracking-wider">Assessment Name</TableHead>
                    <TableHead className="font-bold text-slate-900 text-sm uppercase tracking-wider text-center">Duration</TableHead>
                    <TableHead className="font-bold text-slate-900 text-sm uppercase tracking-wider text-center">Questions</TableHead>
                    <TableHead className="font-bold text-slate-900 text-sm uppercase tracking-wider text-center">Pass Score</TableHead>
                    <TableHead className="pr-8 font-bold text-slate-900 text-sm uppercase tracking-wider text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quizzes.map((quiz) => (
                    <TableRow key={quiz._id} className="group hover:bg-blue-50/30 transition-colors border-slate-50 h-24">
                      <TableCell className="pl-8">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-blue-50 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                            <IconFileText size={24} />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 text-lg leading-tight group-hover:text-blue-700 transition-colors">
                              {quiz.title}
                            </span>
                            <span className="text-sm text-slate-500 line-clamp-1 max-w-md">
                              {quiz.description || "Assessment to evaluate skills for current position."}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5 font-semibold text-slate-700">
                          <IconClock size={18} className="text-blue-500" />
                          <span>{quiz.timeLimit || 0} Mins</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5 font-semibold text-slate-700">
                          <IconLayoutGrid size={18} className="text-blue-500" />
                          <span>{quiz.questions?.length || 0} Items</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-slate-900 text-white font-bold px-3 py-1">
                          {quiz.passingScore}%
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-8 text-right">
                        <Button
                          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold h-11 px-6 rounded-xl shadow-lg shadow-blue-100 group-hover:scale-105 transition-transform"
                          onClick={() => navigate(`/student/quiz/${quiz._id}`)}
                        >
                          <IconPlayerPlay className="h-4 w-4 mr-2" />
                          Start Test
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Standard Admin/Student UI
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test Papers</h1>
          <p className="text-muted-foreground mt-1">
            Browse and manage test papers by department and section.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <IconRefresh className="h-4 w-4" />
            Refresh
          </Button>
          {canManage && (
            <Button onClick={() => {
                const base = "/" + (window.location.pathname.split('/')[1] || "admin");
                navigate(`${base}/add-test-paper`);
            }} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              <IconFileText className="h-4 w-4" />
              Create Test Paper
            </Button>
          )}
        </div>
      </div>

      <Card className="border-none shadow-sm bg-muted/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <IconFilter className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Filter Test Papers</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Department</label>
              <Select
                value={selectedDepartment}
                onValueChange={(val) => {
                  setSelectedDepartment(val);
                  setSelectedSection("ALL");
                  setSelectedLine("ALL");
                  setSelectedSubSection("ALL");
                }}
                disabled={!isAuthorizedToAccessAll && !!currentUser?.departmentId}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept._id || dept.id} value={String(dept._id || dept.id)}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Section</label>
              <Select
                value={selectedSection}
                onValueChange={(val) => {
                  setSelectedSection(val);
                  setSelectedLine("ALL");
                  setSelectedSubSection("ALL");
                }}
                disabled={(!isAuthorizedToAccessAll && !!currentUser?.sectionId) || selectedDepartment === "ALL"}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={selectedDepartment === "ALL" ? "Select department first" : "Select Section"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Sections</SelectItem>
                  {sections.map((sec) => (
                    <SelectItem key={sec.id} value={String(sec.id)}>
                      {sec.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Line</label>
              <Select
                value={selectedLine}
                onValueChange={(val) => {
                  setSelectedLine(val);
                  setSelectedSubSection("ALL");
                }}
                disabled={(!isAuthorizedToAccessAll && !!currentUser?.lineId) || (selectedSection === "ALL" && selectedDepartment === "ALL")}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={
                    selectedSection === "ALL" && selectedDepartment === "ALL"
                      ? "Select section first"
                      : "Select Line"
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Lines</SelectItem>
                  {lines.map((line) => (
                    <SelectItem key={line.id || line._id} value={String(line.id || line._id)}>
                      {line.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sub-Section</label>
              <Select
                value={selectedSubSection}
                onValueChange={setSelectedSubSection}
                disabled={(!isAuthorizedToAccessAll && !!currentUser?.subSectionId) || (selectedLine === "ALL" && selectedSection === "ALL")}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={
                    selectedLine === "ALL" && selectedSection === "ALL"
                      ? "Select line first"
                      : "Select Sub-Section"
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Sub-Sections</SelectItem>
                  {filteredSubSections.map((subSec) => (
                    <SelectItem key={subSec.id || subSec._id} value={String(subSec.id || subSec._id)}>
                      {subSec.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Level</label>
              <Select
                value={selectedLevel}
                onValueChange={setSelectedLevel}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Levels</SelectItem>
                  <SelectItem value="L0">L0 (Dojo User)</SelectItem>
                  {activeLevels.map((lvl) => (
                    <SelectItem key={lvl.name} value={lvl.name}>
                      {lvl.name} {lvl.description ? `- ${lvl.description}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Test Type</label>
              <Select
                value={selectedTestType}
                onValueChange={setSelectedTestType}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="dojo">Dojo Hiring</SelectItem>
                  <SelectItem value="handover">Handover</SelectItem>
                  <SelectItem value="theoretical">Theoretical</SelectItem>
                  <SelectItem value="practical">Practical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search quiz title..."
                  className="pl-9 bg-background"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button variant="ghost" onClick={handleReset} className="w-full text-muted-foreground hover:bg-slate-100">
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold">Test Paper Title</TableHead>
                <TableHead className="font-semibold">Target Sub-Section</TableHead>
                <TableHead className="font-semibold">Test Type</TableHead>
                <TableHead className="font-semibold">Course / Module</TableHead>
                <TableHead className="font-semibold">Passing Criteria</TableHead>
                <TableHead className="font-semibold">Total Marks</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quizzesLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>
                  </TableRow>
                ))
              ) : quizzes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <IconFileText className="h-12 w-12 mb-3 opacity-20" />
                      <p className="text-lg font-medium">No test papers found</p>
                      <p className="text-sm">Try adjusting your filters or search term</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                quizzes.map((quiz) => {
                  const totalMarks = quiz.questions?.reduce((sum, q) => sum + (q.marks || 1), 0) || 0;
                  const passingMarks = Math.ceil((totalMarks * (quiz.passingScore || 70)) / 100);

                  return (
                    <TableRow key={quiz._id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="align-middle">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                            {quiz.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {quiz.questions?.length || 0} Questions • {quiz.timeLimit || 0} mins
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex flex-col gap-1 max-w-[200px]">
                          {(() => {
                            const quizSubSections = (quiz.subSectionId || [])
                              .map(id => subSections.find(s => String(s.id) === String(id))?.name)
                              .filter(Boolean);
                              
                            if (quizSubSections.length > 0) {
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {quizSubSections.map((name, index) => (
                                    <Badge key={index} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] py-0 px-1 font-semibold truncate max-w-[120px]">
                                      {name}
                                    </Badge>
                                  ))}
                                </div>
                              );
                            }
                            return <span className="text-xs text-muted-foreground italic">No target</span>;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex flex-wrap gap-1">
                          {quiz.isDojo && (
                            <Badge className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100/50 text-[10px] font-semibold tracking-wider">
                              Dojo Hiring
                            </Badge>
                          )}
                          {quiz.isHandover && (
                            <Badge className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100/50 text-[10px] font-semibold tracking-wider">
                              Handover
                            </Badge>
                          )}
                          {quiz.isTheoretical && (
                            <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100/50 text-[10px] font-semibold tracking-wider">
                              Theoretical
                            </Badge>
                          )}
                          {!quiz.isDojo && !quiz.isHandover && !quiz.isTheoretical && (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold tracking-wider">
                              Practical
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="w-fit font-normal text-[10px] uppercase tracking-wider">
                            {quiz.course?.title || "No Course"}
                          </Badge>
                          {quiz.module && (
                            <span className="text-xs text-muted-foreground italic">
                              {quiz.module.title}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <IconClock size={14} className="text-slate-400" />
                            <span className="font-medium text-slate-700">{quiz.passingScore}% ({passingMarks} Marks)</span>
                          </div>
                          {quiz.issueCertificate && (
                            <div className="flex items-center gap-1.5 text-green-600 font-medium">
                              <IconCertificate size={14} />
                              <span>Certificate</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-foreground text-sm">
                            {totalMarks} Marks
                          </span>
                          {quiz.level && (
                            <Badge variant="outline" className="w-fit bg-teal-50 text-teal-700 border-teal-200 uppercase font-semibold text-[10px] tracking-wider py-0 px-1.5">
                              {quiz.level}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              const base = "/" + (window.location.pathname.split('/')[1] || "admin");
                              const quizPath = base === "/student" ? "quiz" : "take-test";
                              navigate(`${base}/${quizPath}/${quiz._id}`);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
                          >
                            <IconPlayerPlay className="h-4 w-4" />
                            <span className="ml-2 font-semibold">Take Test</span>
                          </Button>

                          {canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const base = "/" + (window.location.pathname.split('/')[1] || "admin");
                                navigate(`${base}/edit-test-paper/${quiz._id}`);
                              }}
                              className="border-slate-200 hover:bg-slate-50 text-slate-700"
                              title="Edit Test Paper"
                            >
                              <IconEdit className="h-4 w-4 mr-1.5" />
                              Edit
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(quiz._id)}
                              className="border-red-200 hover:bg-red-50 text-red-600 hover:text-red-700"
                              title="Delete Test Paper"
                            >
                              <IconTrash className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// Helper for class names
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default TestPaper;
