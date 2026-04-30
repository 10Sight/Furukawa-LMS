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

const TestPaper = () => {
  const navigate = useNavigate();
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
  });

  const quizzes = quizzesData?.data?.quizzes || [];
  const pagination = quizzesData?.data?.pagination || {};

  const handleReset = () => {
    setSelectedDepartment("ALL");
    setSelectedSection("ALL");
    setSearchTerm("");
    setPage(1);
  };

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
          <Button onClick={() => navigate("/admin/courses")} className="gap-2">
            <IconFileText className="h-4 w-4" />
            Manage Courses
          </Button>
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
                          const base = window.location.pathname.startsWith("/portal") ? "/portal" : "/admin";
                          navigate(`${base}/take-test/${quiz._id}`);
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
