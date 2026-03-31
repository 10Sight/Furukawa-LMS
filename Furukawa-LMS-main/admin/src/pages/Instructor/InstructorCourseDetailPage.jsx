import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useGetCourseByIdQuery } from "@/Redux/AllApi/CourseApi";
import { useGetModulesByCourseQuery } from "@/Redux/AllApi/moduleApi";
import { useGetAllQuizzesQuery } from "@/Redux/AllApi/QuizApi";
import { useGetAllAssignmentsQuery } from "@/Redux/AllApi/AssignmentApi";
import { useGetSubmissionByAssignmentQuery } from "@/Redux/AllApi/SubmissionApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
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
  IconCheck,
  IconX,
  IconDownload,
  IconChartBar,
  IconList,
  IconFileCheck,
} from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

// Import reusable components
import ModuleList from "@/components/course/ModuleList";
import QuizList from "@/components/course/QuizList";
import AssignmentList from "@/components/course/AssignmentList";
import ResourceList from "@/components/course/ResourceList";
import CourseStats from "@/components/course/CourseStats";

const InstructorCourseDetailPage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

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
  } = useGetAllQuizzesQuery({ courseId });

  const {
    data: assignmentsData,
    isLoading: assignmentsLoading,
    refetch: refetchAssignments,
  } = useGetAllAssignmentsQuery({ courseId });

  const {
    data: submissionsData,
    isLoading: submissionsLoading,
    refetch: refetchSubmissions,
  } = useGetSubmissionByAssignmentQuery(courseId);

  const course = courseData?.data || {};
  const modules = modulesData?.data || [];
  const quizzes = quizzesData?.data?.quizzes || [];
  const assignments = assignmentsData?.data || [];
  const submissions = submissionsData?.data || [];

  const isLoading =
    courseLoading ||
    modulesLoading ||
    quizzesLoading ||
    assignmentsLoading ||
    submissionsLoading;

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

  const getDifficultyBadge = (difficulty) => {
    const difficultyConfig = {
      BEGINNER: { variant: "success", label: "Beginner" },
      INTERMEDIATE: { variant: "warning", label: "Intermediate" },
      ADVANCED: { variant: "destructive", label: "Advanced" },
    };

    const config = difficultyConfig[difficulty] || {
      variant: "secondary",
      label: difficulty,
    };

    return (
      <Badge variant={config.variant} className="w-fit">
        {config.label}
      </Badge>
    );
  };

  const getSubmissionStatusBadge = (status) => {
    const statusConfig = {
      SUBMITTED: { variant: "secondary", label: "Submitted", icon: IconFileText },
      LATE: { variant: "destructive", label: "Late", icon: IconClock },
      GRADED: { variant: "success", label: "Graded", icon: IconCheck },
      MISSING: { variant: "destructive", label: "Missing", icon: IconX },
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

  const handleRefetchAll = () => {
    refetchCourse();
    refetchModules();
    refetchQuizzes();
    refetchAssignments();
    refetchSubmissions();
  };

  // Calculate course statistics
  const enrolledStudents = course.enrolledStudents || 0;
  const gradedSubmissions = submissions.filter(sub => sub.grade !== undefined && sub.grade !== null);
  const averageGrade = gradedSubmissions.length > 0
    ? (gradedSubmissions.reduce((sum, sub) => sum + (sub.grade || 0), 0) / gradedSubmissions.length).toFixed(1)
    : 0;
  const completionRate = enrolledStudents > 0
    ? ((submissions.filter(sub => sub.status === "GRADED").length / enrolledStudents) * 100).toFixed(0)
    : 0;

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
            onClick={() => navigate('/trainer/courses')}
            variant="outline"
            className="gap-2"
          >
            <IconEdit className="h-4 w-4" />
            Manage Course
          </Button>
          <Button
            onClick={() => navigate(`/trainer/add-module/${courseId}`)}
            className="gap-2"
          >
            <IconPlus className="h-4 w-4" />
            Add Content
          </Button>
        </div>
      </div>

      {/* Instructor Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Enrolled Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enrolledStudents}</div>
            <p className="text-xs text-muted-foreground">
              Total students enrolled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Grade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageGrade}%</div>
            <p className="text-xs text-muted-foreground">
              Across all assignments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate}%</div>
            <p className="text-xs text-muted-foreground">
              Of enrolled students
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Grading</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {submissions.filter(sub => sub.status === "SUBMITTED").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Submissions to grade
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="modules">Modules ({modules.length})</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes ({quizzes.length})</TabsTrigger>
          <TabsTrigger value="assignments">
            Assignments ({assignments.length})
          </TabsTrigger>
          <TabsTrigger value="submissions">
            Submissions ({submissions.length})
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
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={course.instructor?.avatar} />
                      <AvatarFallback>
                        {course.instructor?.name?.charAt(0) || "I"}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm">
                      {course.instructor?.name || "Not assigned"}
                    </p>
                  </div>
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

          {/* Recent Submissions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Submissions</CardTitle>
              <CardDescription>
                Latest student submissions that need grading
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submissions.filter(sub => sub.status === "SUBMITTED").length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions
                      .filter(sub => sub.status === "SUBMITTED")
                      .slice(0, 5)
                      .map((submission) => (
                        <TableRow key={submission._id}>
                          <TableCell className="font-medium">
                            {submission.student?.name || "Unknown Student"}
                          </TableCell>
                          <TableCell>
                            {submission.assignment?.title || "Unknown Assignment"}
                          </TableCell>
                          <TableCell>
                            {new Date(submission.submittedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {getSubmissionStatusBadge(submission.status)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/trainer/submissions/${submission._id}`)}
                            >
                              Grade
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  No pending submissions to grade
                </div>
              )}
            </CardContent>
            {submissions.filter(sub => sub.status === "SUBMITTED").length > 0 && (
              <CardFooter>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setActiveTab("submissions")}
                >
                  View All Submissions
                </Button>
              </CardFooter>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="modules">
          <ModuleList
            modules={modules}
            courseId={courseId}
            onRefetch={refetchModules}
            isInstructor={true}
          />
        </TabsContent>

        <TabsContent value="quizzes">
          <QuizList
            quizzes={quizzes}
            courseId={courseId}
            onRefetch={refetchQuizzes}
            key={quizzes.length}
            isInstructor={true}
          />
        </TabsContent>

        <TabsContent value="assignments">
          <AssignmentList
            assignments={assignments}
            courseId={courseId}
            onRefetch={refetchAssignments}
            isInstructor={true}
          />
        </TabsContent>

        <TabsContent value="submissions">
          <Card>
            <CardHeader>
              <CardTitle>Student Submissions</CardTitle>
              <CardDescription>
                All submissions for this course's assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submissions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((submission) => (
                      <TableRow key={submission._id}>
                        <TableCell className="font-medium">
                          {submission.student?.name || "Unknown Student"}
                        </TableCell>
                        <TableCell>
                          {submission.assignment?.title || "Unknown Assignment"}
                        </TableCell>
                        <TableCell>
                          {new Date(submission.submittedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {getSubmissionStatusBadge(submission.status)}
                        </TableCell>
                        <TableCell>
                          {submission.grade !== undefined ? `${submission.grade}%` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/trainer/submissions/${submission._id}`)}
                          >
                            {submission.status === "SUBMITTED" ? "Grade" : "View"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  No submissions yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources">
          <ResourceList courseId={courseId} modules={modules} isInstructor={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InstructorCourseDetailPage;