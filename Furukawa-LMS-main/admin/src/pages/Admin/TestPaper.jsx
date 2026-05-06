import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetAllQuizzesQuery } from "@/Redux/AllApi/QuizApi";
import { 
  IconFileText, 
  IconSearch, 
  IconFilter, 
  IconExternalLink,
  IconRefresh,
  IconClock,
  IconCertificate,
  IconPlayerPlay,
  IconLayoutGrid
} from "@tabler/icons-react";
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

  const [selectedDepartment, setSelectedDepartment] = useState("ALL");
  const [selectedSection, setSelectedSection] = useState("ALL");
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

  // Fetch Quizzes with filters
  const { data: quizzesData, isLoading: quizzesLoading, refetch } = useGetAllQuizzesQuery({
    page,
    limit: 50,
    search: searchTerm,
    departmentId: selectedDepartment !== "ALL" ? selectedDepartment : undefined,
    sectionId: selectedSection !== "ALL" ? selectedSection : undefined,
    isDojo: currentUser?.isTemporary ? true : undefined,
  });

  const quizzes = quizzesData?.data?.quizzes || [];
  const pagination = quizzesData?.data?.pagination || {};

  const handleReset = () => {
    setSelectedDepartment("ALL");
    setSelectedSection("ALL");
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
            <Button onClick={() => navigate("/admin/courses")} className="gap-2">
              <IconFileText className="h-4 w-4" />
              Manage Courses
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Department</label>
              <Select 
                value={selectedDepartment} 
                onValueChange={(val) => {
                  setSelectedDepartment(val);
                  setSelectedSection("ALL");
                }}
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
                onValueChange={setSelectedSection}
                disabled={selectedDepartment === "ALL"}
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
              <Button variant="ghost" onClick={handleReset} className="w-full text-muted-foreground">
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
                <TableHead className="font-semibold">Course / Module</TableHead>
                <TableHead className="font-semibold">Scope</TableHead>
                <TableHead className="font-semibold">Details</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quizzesLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>
                  </TableRow>
                ))
              ) : quizzes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <IconFileText className="h-12 w-12 mb-3 opacity-20" />
                      <p className="text-lg font-medium">No test papers found</p>
                      <p className="text-sm">Try adjusting your filters or search term</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                quizzes.map((quiz) => (
                  <TableRow key={quiz._id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {quiz.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {quiz.questions?.length || 0} Questions • {quiz.timeLimit || 0} mins
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
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
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "capitalize font-medium",
                          quiz.scope === 'course' ? "bg-blue-50 text-blue-700" : 
                          quiz.scope === 'module' ? "bg-purple-50 text-purple-700" : 
                          "bg-orange-50 text-orange-700"
                        )}
                      >
                        {quiz.scope}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <IconClock size={14} />
                          <span>Pass: {quiz.passingScore}%</span>
                        </div>
                        {quiz.issueCertificate && (
                          <div className="flex items-center gap-1.5 text-green-600 font-medium">
                            <IconCertificate size={14} />
                            <span>Certificate</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => {
                          const base = window.location.pathname.startsWith("/portal") ? "/portal" : 
                                       window.location.pathname.startsWith("/student") ? "/student" : "/admin";
                          const quizPath = base === "/student" ? "quiz" : "take-test";
                          navigate(`${base}/${quizPath}/${quiz._id}`);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
                      >
                        <IconPlayerPlay className="h-4 w-4" />
                        <span className="ml-2 font-semibold">Take Test</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
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
