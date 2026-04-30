// src/pages/DepartmentDetail.jsx
import React, { useState, useMemo } from "react";
import {
  useGetDepartmentByIdQuery,
  useGetDepartmentProgressQuery,
  useGetDepartmentSubmissionsQuery,
  useGetDepartmentAttemptsQuery
} from "@/Redux/AllApi/DepartmentApi";
import DepartmentDetailHeader from "@/components/departments/DepartmentDetailHeader";
import DepartmentInstructorCard from "@/components/departments/DepartmentInstructorCard";
import DepartmentCourseCard from "@/components/departments/DepartmentCourseCard";
import DepartmentStudentsTable from "@/components/departments/DepartmentStudentsTable";
import DepartmentStats from "@/components/departments/DepartmentStats";
import DepartmentSkeleton from "@/components/departments/DepartmentSkeleton";
import DepartmentCancellationBanner from "@/components/departments/DepartmentCancellationBanner";
import DepartmentSectionManager from "@/components/departments/DepartmentSectionManager";
import MultiSkillingPlan from "@/components/departments/MultiSkillingPlan";
import HandoverSheet from "@/components/departments/HandoverSheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  IconArrowLeft,
  IconRefresh,
  IconUsers,
  IconTrendingUp,
  IconFileText,
  IconClipboardList,
  IconChartBar,
  IconEye,
  IconX,
  IconBook2,
  IconTrophy,
  IconUser,
  IconMail,
  IconChevronLeft,
  IconChevronRight
} from "@tabler/icons-react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

const DepartmentDetail = () => {
  const { departmentId } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  
  const queryParams = useMemo(() => new URLSearchParams(search), [search]);
  const [activeTab, setActiveTab] = useState(queryParams.get("tab") || "overview");

  // Pagination states
  const [progressPage, setProgressPage] = useState(1);
  const [submissionsPage, setSubmissionsPage] = useState(1);
  const [attemptsPage, setAttemptsPage] = useState(1);

  // Sync tab if URL changes (e.g. browser back/forward)
  React.useEffect(() => {
    const tab = queryParams.get("tab");
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [queryParams, activeTab]);

  // API Queries
  const {
    data: departmentData,
    isLoading: departmentLoading,
    error: departmentError,
    refetch: refetchDepartment,
  } = useGetDepartmentByIdQuery(departmentId);

  const {
    data: progressData,
    isLoading: progressLoading,
    isFetching: progressFetching,
    error: progressError,
    refetch: refetchProgress,
  } = useGetDepartmentProgressQuery({ 
    departmentId, 
    page: progressPage, 
    limit: 10 
  }, {
    refetchOnMountOrArgChange: true,
    skip: activeTab !== "progress" && activeTab !== "overview" && activeTab !== "multi-skilling" && activeTab !== "handover"
  });

  const {
    data: submissionsData,
    isLoading: submissionsLoading,
    isFetching: submissionsFetching,
    error: submissionsError,
    refetch: refetchSubmissions,
  } = useGetDepartmentSubmissionsQuery({ 
    departmentId, 
    page: submissionsPage, 
    limit: 10 
  }, {
    refetchOnMountOrArgChange: true,
    skip: activeTab !== "submissions" && activeTab !== "overview"
  });

  const {
    data: attemptsData,
    isLoading: attemptsLoading,
    isFetching: attemptsFetching,
    error: attemptsError,
    refetch: refetchAttempts,
  } = useGetDepartmentAttemptsQuery({ 
    departmentId, 
    page: attemptsPage, 
    limit: 10 
  }, {
    refetchOnMountOrArgChange: true,
    skip: activeTab !== "quizzes" && activeTab !== "overview"
  });

  const department = departmentData?.data;
  const progressStats = progressData?.data || { departmentProgress: [], overallStats: {} };
  const submissionStats = submissionsData?.data || { submissions: [], stats: {} };
  const attemptStats = attemptsData?.data || { attempts: [], stats: {} };

  const isLoading = departmentLoading;
  const anyError = departmentError || progressError || submissionsError || attemptsError;

  const handleRefreshAll = () => {
    refetchDepartment();
    if (activeTab === "progress" || activeTab === "overview") refetchProgress();
    if (activeTab === "submissions" || activeTab === "overview") refetchSubmissions();
    if (activeTab === "quizzes" || activeTab === "overview") refetchAttempts();
    toast.success("Department data refreshed successfully!");
  };

  const getSubmissionStatusBadge = (submission) => {
    let variant, label;

    if (submission.grade !== undefined && submission.grade !== null) {
      variant = "default";
      label = "Graded";
    } else if (submission.isLate) {
      variant = "destructive";
      label = "Late";
    } else {
      variant = "secondary";
      label = "Submitted";
    }

    return (
      <Badge variant={variant}>
        {label}
      </Badge>
    );
  };

  // Calculate enhanced statistics from global metadata returned by API
  const enhancedStats = useMemo(() => {
    const overallStats = progressStats.overallStats || {};
    const submissionStatsData = submissionStats.stats || {};
    const attemptStatsData = attemptStats.stats || {};

    return {
      totalStudents: department?.studentCount || department?.students?.length || overallStats.totalStudents || 0,
      studentsWithProgress: overallStats.studentsWithProgress || 0,
      averageProgress: overallStats.averageProgress || 0,
      totalModules: overallStats.totalModules || 0,
      totalSubmissions: submissionStatsData.totalSubmissions || 0,
      gradedSubmissions: submissionStatsData.gradedSubmissions || 0,
      averageGrade: submissionStatsData.averageGrade || 0,
      totalQuizAttempts: attemptStatsData.totalAttempts || 0,
      passedAttempts: attemptStatsData.passedAttempts || 0,
      averageQuizScore: attemptStatsData.averageScore || 0,
    };
  }, [department, progressStats, submissionStats, attemptStats]);

  if (isLoading) {
    return <DepartmentSkeleton />;
  }

  if (departmentError) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <div className="text-red-600 text-lg font-medium">
            {departmentError.status === 404 ? "Department not found" : "Error loading department"}
          </div>
          <p className="text-gray-600 text-center">
            {departmentError.data?.message || "Failed to fetch department details"}
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => navigate("..", { relative: "path" })}
              variant="outline"
              className="gap-2"
            >
              <IconArrowLeft className="h-4 w-4" />
              Back to Departments
            </Button>
            <Button onClick={handleRefreshAll} className="gap-2">
              <IconRefresh className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!department) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <div className="text-gray-600 text-lg font-medium">
            Department not found
          </div>
          <Button
            onClick={() => navigate("..", { relative: "path" })}
            variant="outline"
            className="gap-2"
          >
            <IconArrowLeft className="h-4 w-4" />
            Back to Departments
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate("..", { relative: "path" })}
            className="gap-2"
          >
            <IconArrowLeft className="h-4 w-4" />
            Back to Departments
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{department.name}</h1>
            <p className="text-muted-foreground mt-1">
              {department.course?.title || "No course assigned"} • {department.studentCount || department.students?.length || 0} trainees
            </p>
          </div>
        </div>

        <Button onClick={handleRefreshAll} variant="outline" className="gap-2">
          <IconRefresh className="h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      {/* Department Cancellation Banner */}
      <DepartmentCancellationBanner department={department} />

      {/* Enhanced Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IconUsers className="h-4 w-4 text-blue-600" />
              Trainees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{enhancedStats.totalStudents}</div>
            <p className="text-xs text-muted-foreground">Total enrolled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IconTrendingUp className="h-4 w-4 text-green-600" />
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{enhancedStats.averageProgress}%</div>
            <p className="text-xs text-muted-foreground">Average progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IconFileText className="h-4 w-4 text-purple-600" />
              Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{enhancedStats.totalSubmissions}</div>
            <p className="text-xs text-muted-foreground">Total submissions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IconChartBar className="h-4 w-4 text-orange-600" />
              Test Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{enhancedStats.averageQuizScore}%</div>
            <p className="text-xs text-muted-foreground">Average score</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-7 mb-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="progress">Progress ({enhancedStats.studentsWithProgress})</TabsTrigger>
          <TabsTrigger value="submissions">Submissions ({enhancedStats.totalSubmissions})</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes ({enhancedStats.totalQuizAttempts})</TabsTrigger>
          <TabsTrigger value="sections">Sections & Lines</TabsTrigger>
          <TabsTrigger value="multi-skilling">Multi Skilling</TabsTrigger>
          <TabsTrigger value="handover">Handover Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Original components */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DepartmentInstructorCard instructor={department.instructor} departmentId={departmentId} />
            <DepartmentCourseCard course={department.course} departmentId={departmentId} />
          </div>

          <DepartmentStudentsTable
            departmentId={departmentId}
            departmentName={department.name}
            onRefetch={refetchDepartment}
          />
        </TabsContent>

        <TabsContent value="progress">
          <Card>
            <CardHeader>
              <CardTitle>Trainee Progress Tracking</CardTitle>
              <CardDescription>
                Progress overview for all trainees in the department
              </CardDescription>
            </CardHeader>
            <CardContent>
              {progressError ? (
                <Alert>
                  <AlertDescription className="flex items-center gap-2">
                    <IconX className="h-4 w-4" />
                    Failed to load progress data. Please try refreshing.
                  </AlertDescription>
                </Alert>
              ) : progressStats.departmentProgress.length > 0 ? (
                <div className="space-y-4">
                  {progressStats.departmentProgress.map((studentProgress, index) => {
                    const { student, completedModules, totalModules, progressPercentage, lastActivity } = studentProgress;

                    return (
                      <div key={student._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-800">
                              {student.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="font-medium">{student.fullName}</p>
                              <p className="text-sm text-muted-foreground">{student.email}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-medium">{completedModules} / {totalModules} modules</div>
                            <div className="text-xs text-muted-foreground">
                              {lastActivity ? new Date(lastActivity).toLocaleDateString() : 'No activity'}
                            </div>
                          </div>
                          <div className="w-24">
                            <Progress value={progressPercentage} className="h-2" />
                            <div className="text-xs text-center mt-1">{progressPercentage}%</div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/admin/employees/${student.slug || student._id}`)}
                          >
                            <IconEye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {progressData?.data?.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Page {progressPage} of {progressData.data.totalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setProgressPage(p => Math.max(1, p - 1))}
                          disabled={progressPage === 1 || progressFetching}
                        >
                          <IconChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setProgressPage(p => Math.min(progressData.data.totalPages, p + 1))}
                          disabled={progressPage === progressData.data.totalPages || progressFetching}
                        >
                          Next
                          <IconChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <IconBook2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Progress Data</h3>
                  <p className="text-muted-foreground">
                    No trainees have started the course yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submissions">
          <Card>
            <CardHeader>
              <CardTitle>Assignment Submissions</CardTitle>
              <CardDescription>
                All assignment submissions from department trainees
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submissionsError ? (
                <Alert>
                  <AlertDescription className="flex items-center gap-2">
                    <IconX className="h-4 w-4" />
                    Failed to load submission data. Please try refreshing.
                  </AlertDescription>
                </Alert>
              ) : submissionStats.submissions.length > 0 ? (
                <div className="space-y-4">
                  {submissionStats.submissions.map((submission) => (
                    <div key={submission._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-medium text-purple-800">
                            {submission.student?.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{submission.assignment?.title || 'Assignment'}</p>
                            <p className="text-xs text-muted-foreground">
                              by {submission.student?.fullName} • {new Date(submission.submittedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {submission.grade !== undefined ? (
                          <Badge variant="outline">{submission.grade}%</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not graded</span>
                        )}
                        {getSubmissionStatusBadge(submission)}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/employees/${submission.student.slug || submission.student._id}`)}
                        >
                          <IconEye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {submissionsData?.data?.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Page {submissionsPage} of {submissionsData.data.totalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSubmissionsPage(p => Math.max(1, p - 1))}
                          disabled={submissionsPage === 1 || submissionsFetching}
                        >
                          <IconChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSubmissionsPage(p => Math.min(submissionsData.data.totalPages, p + 1))}
                          disabled={submissionsPage === submissionsData.data.totalPages || submissionsFetching}
                        >
                          Next
                          <IconChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Show stats summary */}
                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">{submissionStats.stats.totalSubmissions}</div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">{submissionStats.stats.gradedSubmissions}</div>
                      <div className="text-xs text-muted-foreground">Graded</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-orange-600">{submissionStats.stats.averageGrade}%</div>
                      <div className="text-xs text-muted-foreground">Avg Grade</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600">{submissionStats.stats.lateSubmissions}</div>
                      <div className="text-xs text-muted-foreground">Late</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <IconFileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Submissions</h3>
                  <p className="text-muted-foreground">
                    No assignments have been submitted yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quizzes">
          <Card>
            <CardHeader>
              <CardTitle>Test Attempts</CardTitle>
              <CardDescription>
                All test attempts from department trainees
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attemptsError ? (
                <Alert>
                  <AlertDescription className="flex items-center gap-2">
                    <IconX className="h-4 w-4" />
                    Failed to load test attempt data. Please try refreshing.
                  </AlertDescription>
                </Alert>
              ) : attemptStats.attempts.length > 0 ? (
                <div className="space-y-4">
                  {attemptStats.attempts.map((attempt) => (
                    <div key={attempt._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-medium text-orange-800">
                            {attempt.student?.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{attempt.quiz?.title || 'Quiz'}</p>
                            <p className="text-xs text-muted-foreground">
                              by {attempt.student?.fullName} • {new Date(attempt.attemptedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{attempt.scorePercent || 0}%</Badge>
                        <Badge variant={attempt.passed ? "default" : "destructive"}>
                          {attempt.passed ? "Passed" : "Failed"}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/employees/${attempt.student.slug || attempt.student._id}`)}
                        >
                          <IconEye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {attemptsData?.data?.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Page {attemptsPage} of {attemptsData.data.totalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAttemptsPage(p => Math.max(1, p - 1))}
                          disabled={attemptsPage === 1 || attemptsFetching}
                        >
                          <IconChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAttemptsPage(p => Math.min(attemptsData.data.totalPages, p + 1))}
                          disabled={attemptsPage === attemptsData.data.totalPages || attemptsFetching}
                        >
                          Next
                          <IconChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Show stats summary */}
                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <div className="text-lg font-bold text-orange-600">{attemptStats.stats.totalAttempts}</div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">{attemptStats.stats.passedAttempts}</div>
                      <div className="text-xs text-muted-foreground">Passed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">{attemptStats.stats.passRate}%</div>
                      <div className="text-xs text-muted-foreground">Pass Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">{attemptStats.stats.averageScore}%</div>
                      <div className="text-xs text-muted-foreground">Avg Score</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <IconClipboardList className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Test Attempts</h3>
                  <p className="text-muted-foreground">
                    No quizzes have been attempted yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections">
          <DepartmentSectionManager departmentId={departmentId} />
        </TabsContent>

        <TabsContent value="multi-skilling">
          <MultiSkillingPlan students={department.students} departmentId={departmentId} />
        </TabsContent>
        <TabsContent value="handover">
          <HandoverSheet
            departmentId={departmentId}
            students={department.students}
            departmentName={department.name}
            instructorName={department.instructor?.fullName}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DepartmentDetail;
