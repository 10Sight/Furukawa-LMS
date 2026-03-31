import React, { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useGetCourseByIdQuery, useGetCourseAnalyticsQuery } from "@/Redux/AllApi/CourseApi";
import { useGetModulesByCourseQuery } from "@/Redux/AllApi/moduleApi";
import { useGetQuizzesByCourseQuery } from "@/Redux/AllApi/QuizApi";
import { useGetAllAssignmentsQuery } from "@/Redux/AllApi/AssignmentApi";
import { useGetActiveConfigQuery } from "@/Redux/AllApi/CourseLevelConfigApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  IconArrowLeft,
  IconBook,
  IconFileText,
  IconClipboardList,
  IconHelpCircle,
  IconPaperclip,
  IconEye,
  IconEyeOff,
  IconCalendar,
  IconUsers,
  IconClock,
  IconLoader,
  IconExternalLink,
  IconEdit,
  IconPlus,
  IconChartPie,
  IconSchool,
  IconRefresh,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

// Import reusable components
import ModuleList from "@/components/course/ModuleList";
import QuizList from "@/components/course/QuizList";
import AssignmentList from "@/components/course/AssignmentList";
import ResourceList from "@/components/course/ResourceList";
import CourseStats from "@/components/course/CourseStats";

const CourseDetailPage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("overview");

  const basePath = React.useMemo(() => {
    const p = location.pathname || '';
    if (p.startsWith('/superadmin')) return '/superadmin';
    if (p.startsWith('/instructor')) return '/instructor';
    return '/admin';
  }, [location.pathname]);

  const {
    data: courseData,
    isLoading: courseLoading,
    error: courseError,
    refetch: refetchCourse,
  } = useGetCourseByIdQuery(courseId);

  const {
    data: modulesData,
    isLoading: modulesLoading,
    refetch: refetchModules,
  } = useGetModulesByCourseQuery(courseId);

  const {
    data: quizzesData,
    isLoading: quizzesLoading,
    refetch: refetchQuizzes,
  } = useGetQuizzesByCourseQuery(courseId);

  const {
    data: assignmentsData,
    isLoading: assignmentsLoading,
    refetch: refetchAssignments,
  } = useGetAllAssignmentsQuery({ courseId });

  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    refetch: refetchAnalytics,
  } = useGetCourseAnalyticsQuery(courseId);

  const { data: configData } = useGetActiveConfigQuery();


  const course = courseData?.data || {};
  const modules = modulesData?.data || [];
  // Replace the current quizzes extraction line with:
  const quizzes = Array.isArray(quizzesData?.data) ? quizzesData.data : (quizzesData?.data?.quizzes || []);
  const assignments = assignmentsData?.data || [];

  // Determine difficulty badge color and label dynamically
  const getDifficultyBadge = (difficulty) => {
    if (!difficulty) return <Badge variant="outline">Unknown</Badge>;

    // Try to find matching level in active config
    const activeLevels = configData?.data?.levels || [];
    const matchedLevel = activeLevels.find(l => l.name?.toUpperCase() === difficulty?.toUpperCase());

    if (matchedLevel) {
      // Use configured color if available
      return (
        <Badge
          style={{
            backgroundColor: matchedLevel.color || "#3B82F6",
            color: "#fff",
            borderColor: matchedLevel.color || "#3B82F6"
          }}
          className="capitalize"
        >
          {matchedLevel.name}
        </Badge>
      );
    }

    // Fallback for legacy static levels
    const colors = {
      BEGINNER: "bg-green-100 text-green-800 hover:bg-green-100/80",
      INTERMEDIATE: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80",
      ADVANCED: "bg-red-100 text-red-800 hover:bg-red-100/80",
      CRITICAL: "bg-red-100 text-red-800 hover:bg-red-100/80",
      NONCRITICAL: "bg-blue-100 text-blue-800 hover:bg-blue-100/80",
    };

    const className = colors[difficulty?.toUpperCase()] || "bg-gray-100 text-gray-800";
    return <Badge className={className}>{difficulty.toLowerCase()}</Badge>;
  };

  const isLoading =
    courseLoading || modulesLoading || quizzesLoading || assignmentsLoading;

  const getStatusBadge = (status) => {
    const statusConfig = {
      PUBLISHED: { variant: "success", label: "Published", icon: IconEye },
      DRAFT: { variant: "secondary", label: "Draft", icon: IconEyeOff },
      ARCHIVED: { variant: "destructive", label: "Archived" },
    };

    const config = statusConfig[status] || {
      variant: "secondary",
      label: status,
    };
    const IconComponent = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        {IconComponent && <IconComponent className="h-3 w-3" />}
        {config.label}
      </Badge>
    );
  };



  const getLevelBadge = (level) => {
    const colorMap = {
      L1: "bg-blue-100 text-blue-800 border-blue-200",
      L2: "bg-orange-100 text-orange-800 border-orange-200",
      L3: "bg-green-100 text-green-800 border-green-200",
    };

    const raw = typeof level === "string" ? level : (level != null ? `L${level}` : "L1");
    const color = colorMap[raw] || "bg-gray-100 text-gray-800 border-gray-200";

    return (
      <Badge className={`${color} font-medium text-xs px-2 py-1`}>
        {raw}
      </Badge>
    );
  };

  const handleRefetchAll = () => {
    refetchCourse();
    refetchModules();
    refetchQuizzes();
    refetchAssignments();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <IconArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Skeleton className="h-8 w-64" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-10 w-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (courseError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-red-600 text-lg font-medium">
          Error loading course
        </div>
        <p className="text-gray-600 text-center">
          {courseError?.message || "Failed to fetch course details"}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => navigate(-1)} variant="outline">
            Go Back
          </Button>
          <Button onClick={handleRefetchAll} variant="default">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <IconArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {course.title}
            </h1>
            <p className="text-muted-foreground line-clamp-1">
              {course.description}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => navigate(`${basePath}/add-course`, { state: { editCourse: course } })}
            variant="outline"
            className="gap-2"
          >
            <IconEdit className="h-4 w-4" />
            Edit Course
          </Button>
          <Button
            onClick={() => navigate(`${basePath}/add-module/${courseId}`)}
            className="gap-2"
          >
            <IconPlus className="h-4 w-4" />
            Add Content
          </Button>
        </div>
      </div>

      {/* Stats */}
      <CourseStats
        course={course}
        modules={modules}
        quizzes={quizzes}
        assignments={assignments}
      />

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>

          <TabsTrigger value="modules">Modules ({modules.length})</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes ({quizzes.length})</TabsTrigger>
          <TabsTrigger value="assignments">
            Assignments ({assignments.length})
          </TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Course Details</CardTitle>
              <CardDescription>
                Basic information about this course
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Title</p>
                  <p className="text-sm">{course.title}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Category</p>
                  <Badge variant="outline">{course.category}</Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Level</p>
                  {getDifficultyBadge(course.difficulty || "BEGINNER")}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Status</p>
                  {getStatusBadge(course.status)}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Instructor</p>
                  <p className="text-sm">
                    {course.instructor?.name || "Not assigned"}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Created At</p>
                  <p className="text-sm">
                    {new Date(course.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Description</p>
                <p className="text-sm text-muted-foreground">
                  {course.description}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {analyticsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-6 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {/* Analytics Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-800">Student Progress</p>
                        <p className="text-xs text-blue-600">Average completion</p>
                      </div>
                      <div className="p-2 bg-blue-100 rounded-full">
                        <IconUsers className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-blue-900">
                      {analyticsData?.data?.progressStats?.averageProgress || 0}%
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-800">Assignment Grade</p>
                        <p className="text-xs text-green-600">Average score</p>
                      </div>
                      <div className="p-2 bg-green-100 rounded-full">
                        <IconClipboardList className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-900">
                      {analyticsData?.data?.submissionStats?.averageGrade || 0}%
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-800">Test Pass Rate</p>
                        <p className="text-xs text-purple-600">Success percentage</p>
                      </div>
                      <div className="p-2 bg-purple-100 rounded-full">
                        <IconHelpCircle className="h-4 w-4 text-purple-600" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-purple-900">
                      {analyticsData?.data?.quizStats?.passRate || 0}%
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-amber-800">Total Enrollments</p>
                        <p className="text-xs text-amber-600">Active students</p>
                      </div>
                      <div className="p-2 bg-amber-100 rounded-full">
                        <IconSchool className="h-4 w-4 text-amber-600" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-amber-900">
                      {analyticsData?.data?.courseInfo?.totalEnrollments || 0}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconClipboardList className="h-5 w-5" />
                      Recent Submissions
                    </CardTitle>
                    <CardDescription>
                      Latest assignment submissions from students
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analyticsData?.data?.recentActivity?.recentSubmissions?.length > 0 ? (
                      analyticsData.data.recentActivity.recentSubmissions.map((submission, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {submission.student?.fullName?.charAt(0) || 'S'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{submission.student?.fullName}</p>
                              <p className="text-xs text-muted-foreground">{submission.assignment?.title}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={submission.grade ? "success" : "secondary"}>
                              {submission.grade ? `${submission.grade}%` : "Pending"}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(submission.submittedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <IconClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No recent submissions</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconHelpCircle className="h-5 w-5" />
                      Recent Test Attempts
                    </CardTitle>
                    <CardDescription>
                      Latest test attempts from students
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analyticsData?.data?.recentActivity?.recentQuizAttempts?.length > 0 ? (
                      analyticsData.data.recentActivity.recentQuizAttempts.map((attempt, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {attempt.student?.fullName?.charAt(0) || 'S'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{attempt.student?.fullName}</p>
                              <p className="text-xs text-muted-foreground">{attempt.quiz?.title}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={attempt.passed ? "success" : "destructive"}>
                              {attempt.passed ? <IconCheck className="h-3 w-3 mr-1" /> : <IconX className="h-3 w-3 mr-1" />}
                              {attempt.scorePercent}%
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(attempt.attemptedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <IconHelpCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No recent test attempts</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>



        <TabsContent value="modules">
          <ModuleList
            modules={modules}
            courseId={courseId}
            onRefetch={refetchModules}
          />
        </TabsContent>

        <TabsContent value="quizzes">
          <QuizList
            quizzes={quizzes}
            courseId={courseId}
            modules={modules}
            onRefetch={refetchQuizzes}
            key={quizzes.length}
          />
        </TabsContent>

        <TabsContent value="assignments">
          <AssignmentList
            assignments={assignments}
            courseId={courseId}
            modules={modules}
            onRefetch={refetchAssignments}
          />
        </TabsContent>

        <TabsContent value="resources">
          <ResourceList courseId={courseId} modules={modules} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CourseDetailPage;
