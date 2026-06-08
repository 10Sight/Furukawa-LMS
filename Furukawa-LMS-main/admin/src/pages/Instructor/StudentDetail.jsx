import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGetUserByIdQuery } from "@/Redux/AllApi/UserApi";
import { useGetStudentProgressQuery } from "@/Redux/AllApi/ProgressApi";
import { useGetStudentSubmissionsQuery } from "@/Redux/AllApi/SubmissionApi";
import { useGetStudentAttemptsQuery } from "@/Redux/AllApi/AttemptedQuizApi";
import { useGetStudentOJTsQuery, useCreateOnJobTrainingMutation } from "@/Redux/AllApi/OnJobTrainingApi";
import { useGetLinesByDepartmentQuery } from "@/Redux/AllApi/LineApi";
import { useGetMachinesByLineQuery } from "@/Redux/AllApi/MachineApi";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AttemptReviewModal from "@/components/common/AttemptReviewModal";
import OnJobTrainingTable from "@/components/admin/OnJobTrainingTable";
import OJTTrainingRecordSheet from "@/components/admin/OJTTrainingRecordSheet";
import SixteenDayMonitoringSheet from "@/components/admin/SixteenDayMonitoringSheet";
import SkillMatrixCertificate from "@/components/admin/SkillMatrixCertificate";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    IconArrowLeft,
    IconUser,
    IconBook2,
    IconClipboardList,
    IconFileText,
    IconClock,
    IconCheck,
    IconX,
    IconTrophy,
    IconCalendar,
    IconChartBar,
    IconDownload,
    IconEye,
    IconSchool,
    IconMail,
    IconPhone,
    IconRefresh,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

const StudentDetail = () => {
    const { studentId } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("overview");
    const [viewAttemptId, setViewAttemptId] = useState(null);
    const [attemptModalOpen, setAttemptModalOpen] = useState(false);

    // OJT State
    const [createOJTDialog, setCreateOJTDialog] = useState(false);
    const [selectedLine, setSelectedLine] = useState("");
    const [selectedMachine, setSelectedMachine] = useState("");
    const [selectedOjt, setSelectedOjt] = useState(null);

    // API Queries
    const {
        data: studentData,
        isLoading: studentLoading,
        error: studentError,
        refetch: refetchStudent,
    } = useGetUserByIdQuery(studentId, {
        refetchOnMountOrArgChange: true,
        skip: !studentId || studentId === "undefined",
    });

    const {
        data: progressData,
        isLoading: progressLoading,
        error: progressError,
        refetch: refetchProgress,
    } = useGetStudentProgressQuery(studentId, {
        refetchOnMountOrArgChange: true,
        skip: !studentId || studentId === "undefined",
    });

    const {
        data: submissionsData,
        isLoading: submissionsLoading,
        error: submissionsError,
        refetch: refetchSubmissions,
    } = useGetStudentSubmissionsQuery(studentId, {
        refetchOnMountOrArgChange: true,
        skip: !studentId || studentId === "undefined",
    });

    const {
        data: attemptsData,
        isLoading: attemptsLoading,
        error: attemptsError,
        refetch: refetchAttempts,
    } = useGetStudentAttemptsQuery(studentId, {
        refetchOnMountOrArgChange: true,
        skip: !studentId || studentId === "undefined",
    });

    const student = studentData?.data;
    const progressList = progressData?.data || [];
    const submissions = submissionsData?.data || [];
    const attempts = attemptsData?.data || [];

    // OJT Data Fetching
    const { data: ojtData, isLoading: isOjtLoading, refetch: refetchOjt } = useGetStudentOJTsQuery(studentId, {
        skip: !studentId || studentId === "undefined"
    });
    const [createOJT] = useCreateOnJobTrainingMutation();
    const ojt = ojtData?.data?.[0];

    // Fetch lines dependent on student department
    // student.department can be populated object or ID string. Safely handle both.
    const departmentId = student?.department?._id || student?.department;
    const { data: linesData } = useGetLinesByDepartmentQuery(departmentId, {
        skip: !departmentId
    });
    const lines = linesData?.data || [];

    // Fetch machines dependent on selected line
    const { data: machinesData } = useGetMachinesByLineQuery(selectedLine, {
        skip: !selectedLine
    });
    const machines = machinesData?.data || [];

    // Loading state
    const isLoading = studentLoading || progressLoading || submissionsLoading || attemptsLoading || isOjtLoading;

    const passedOjts = useMemo(() => {
        const ojts = ojtData?.data || [];
        return ojts.filter(o => o.result === "Pass" || o.result === "Approved");
    }, [ojtData]);

    // Calculate overall statistics
    const stats = useMemo(() => {
        if (!progressList.length) {
            return {
                totalCourses: 0,
                completedModules: 0,
                completedLessons: 0,
                totalSubmissions: submissions.length,
                totalAttempts: attempts.length,
                averageGrade: 0,
                averageQuizScore: 0,
            };
        }

        const completedModules = progressList.reduce(
            (total, progress) => total + (progress.completedModuleIds?.length || 0),
            0
        );
        const completedLessons = progressList.reduce(
            (total, progress) => total + (progress.completedLessonIds?.length || 0),
            0
        );

        const gradedSubmissions = submissions.filter(sub => sub.grade !== undefined);
        const averageGrade = gradedSubmissions.length > 0
            ? gradedSubmissions.reduce((sum, sub) => sum + sub.grade, 0) / gradedSubmissions.length
            : 0;

        const scoredAttempts = attempts.filter(attempt => attempt.scorePercent !== undefined);
        const averageQuizScore = scoredAttempts.length > 0
            ? scoredAttempts.reduce((sum, attempt) => sum + attempt.scorePercent, 0) / scoredAttempts.length
            : 0;

        return {
            totalCourses: progressList.length,
            completedModules,
            completedLessons,
            totalSubmissions: submissions.length,
            totalAttempts: attempts.length,
            averageGrade: Math.round(averageGrade),
            averageQuizScore: Math.round(averageQuizScore),
        };
    }, [progressList, submissions, attempts]);

    const handleRefreshAll = () => {
        refetchStudent();
        refetchProgress();
        refetchSubmissions();
        refetchAttempts();
        refetchOjt();
        toast.success("Operator data refreshed successfully!");
    };

    const handleCreateOJT = async () => {
        if (!selectedLine || !selectedMachine || !studentId) {
            toast.error("Please select both a Line and a Machine.");
            return;
        }

        try {
            await createOJT({ studentId, lineId: selectedLine, machineId: selectedMachine }).unwrap();
            toast.success("On-Job Training created successfully!");
            setCreateOJTDialog(false);
            setSelectedLine("");
            setSelectedMachine("");
            refetchOjt(); // Refresh OJT data to show the new OJT
        } catch (err) {
            toast.error(err?.data?.message || "Failed to create On-Job Training.");
        }
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            ACTIVE: { variant: "success", label: "Active", color: "text-green-700" },
            SUSPENDED: { variant: "destructive", label: "Suspended", color: "text-red-700" },
            PENDING: { variant: "warning", label: "Pending", color: "text-amber-700" },
            BANNED: { variant: "destructive", label: "Banned", color: "text-red-700" },
        };

        const config = statusConfig[status] || { variant: "secondary", label: status, color: "text-gray-700" };

        return (
            <Badge variant={config.variant} className={`${config.color}`}>
                {config.label}
            </Badge>
        );
    };

    const getSubmissionStatusBadge = (submission) => {
        // Determine status based on submission properties
        let status, variant, icon, label;

        if (submission.grade !== undefined && submission.grade !== null) {
            status = "GRADED";
            variant = "success";
            icon = IconCheck;
            label = "Graded";
        } else if (submission.isLate) {
            status = "LATE";
            variant = "destructive";
            icon = IconClock;
            label = "Late Submission";
        } else {
            status = "SUBMITTED";
            variant = "secondary";
            icon = IconFileText;
            label = "Submitted";
        }

        return (
            <Badge variant={variant} className="flex items-center gap-1">
                {icon && React.createElement(icon, { className: "h-3 w-3" })}
                {label}
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

    if (isLoading) {
        return (
            <div className="space-y-6">
                {/* Header Skeleton */}
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
                        <IconArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <Skeleton className="h-8 w-64" />
                </div>

                {/* Stats Cards Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i}>
                            <CardHeader className="pb-2">
                                <Skeleton className="h-4 w-20" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-8 w-12" />
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Content Skeleton */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-10 w-full" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (studentError) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="text-red-600 text-lg font-medium">
                    Error loading operator details
                </div>
                <p className="text-gray-600 text-center">
                    {studentError?.message || "Failed to fetch operator information"}
                </p>
                <div className="flex gap-2">
                    <Button onClick={() => navigate(-1)} variant="outline">
                        <IconArrowLeft className="h-4 w-4 mr-2" />
                        Go Back
                    </Button>
                    <Button onClick={handleRefreshAll} variant="default">
                        <IconRefresh className="h-4 w-4 mr-2" />
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    if (!student) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <IconUser className="h-12 w-12 text-muted-foreground" />
                <div className="text-lg font-medium">Operator not found</div>
                <p className="text-muted-foreground">
                    The operator you're looking for doesn't exist or has been deleted.
                </p>
                <Button onClick={() => navigate(-1)} variant="outline">
                    <IconArrowLeft className="h-4 w-4 mr-2" />
                    Back to Employees
                </Button>
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
                        Back to Employees
                    </Button>
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 border-2">
                            <AvatarImage src={student.avatar?.url} alt={student.fullName} />
                            <AvatarFallback className="bg-blue-100 text-blue-800 text-lg">
                                {student.fullName
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">{student.fullName}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-muted-foreground">@{student.userName}</p>
                                {getStatusBadge(student.status)}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button onClick={() => setActiveTab('monitoring16')} variant="default" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                        <IconClipboardList className="h-4 w-4" />
                        16 Day Monitoring
                    </Button>
                    <Button onClick={handleRefreshAll} variant="outline" className="gap-2">
                        <IconRefresh className="h-4 w-4" />
                        Refresh Data
                    </Button>
                </div>
            </div>

            {/* Course Progress Overview */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <IconChartBar className="h-5 w-5" />
                        Course Progress
                    </CardTitle>
                    <CardDescription>Progress per enrolled course</CardDescription>
                </CardHeader>
                <CardContent>
                    {progressList && progressList.length > 0 ? (
                        <div className="space-y-4">
                            {progressList.map((p, i) => (
                                <div key={p._id || i} className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium">{p.course?.title || 'Course'}</span>
                                        <span className="text-muted-foreground">{p.progressPercent || 0}%</span>
                                    </div>
                                    <div className="w-full bg-muted rounded h-2">
                                        <div className="bg-blue-600 h-2 rounded" style={{ width: `${p.progressPercent || 0}%` }} />
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Level: {p.currentLevel || 'L1'} • Modules: {p.completedModules?.length || 0}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-muted-foreground text-sm">No course progress available.</div>
                    )}
                </CardContent>
            </Card>

            {/* Student Info Card */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-800">
                        <IconUser className="h-5 w-5" />
                        Operator Information
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                            <IconMail className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">Email</p>
                                <p className="text-sm text-muted-foreground">{student.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <IconPhone className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">Phone</p>
                                <p className="text-sm text-muted-foreground">{student.phoneNumber}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <IconCalendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">Joined</p>
                                <p className="text-sm text-muted-foreground">
                                    {new Date(student.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                        {student.department && (
                            <div className="flex items-center gap-2">
                                <IconSchool className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">Department</p>
                                    <p className="text-sm text-muted-foreground">
                                        {student.department.name || student.department}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <IconBook2 className="h-4 w-4 text-blue-600" />
                            Courses
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{stats.totalCourses}</div>
                        <p className="text-xs text-muted-foreground">Total enrolled</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <IconTrophy className="h-4 w-4 text-green-600" />
                            Progress
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.completedModules}</div>
                        <p className="text-xs text-muted-foreground">Modules completed</p>
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
                        <div className="text-2xl font-bold text-purple-600">{stats.totalSubmissions}</div>
                        <p className="text-xs text-muted-foreground">Assignment submissions</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <IconChartBar className="h-4 w-4 text-orange-600" />
                            Test Avg
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{stats.averageQuizScore}%</div>
                        <p className="text-xs text-muted-foreground">Average test score</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="flex flex-wrap h-auto p-1 gap-1 bg-muted/50">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="progress">Progress ({stats.totalCourses})</TabsTrigger>
                    <TabsTrigger value="submissions">Submissions ({stats.totalSubmissions})</TabsTrigger>
                    <TabsTrigger value="quizzes">Test Attempts ({stats.totalAttempts})</TabsTrigger>
                    <TabsTrigger value="ojt">On Job Training</TabsTrigger>
                    <TabsTrigger value="monitoring16">16 Day Monitoring</TabsTrigger>
                    <TabsTrigger value="skillEvaluation">Check Sheet of Skill Evaluation</TabsTrigger>
                </TabsList>

                <TabsContent value="monitoring16">
                    <SixteenDayMonitoringSheet studentId={studentId} />
                </TabsContent>

                <TabsContent value="skillEvaluation">
                    <SkillMatrixCertificate
                        studentId={student.id}
                        studentName={student?.fullName || ""}
                        employeeCode={student?.userName || student?.empId || ""}
                        departmentId={typeof student.department === 'object' ? (student.department?._id || student.department?.id || "GLOBAL") : (student.department || "GLOBAL")}
                        subSectionId={student?.subSectionId || student?.targetSubSectionId}
                    />
                </TabsContent>

                <TabsContent value="overview" className="space-y-6">
                    {/* Course Progress Overview */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <IconSchool className="h-5 w-5 text-blue-600" />
                                Course Progress Overview
                            </CardTitle>
                            <CardDescription>
                                Operator's progress across all enrolled courses
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {progressList.length > 0 ? (
                                <div className="space-y-4">
                                    {progressList.map((progress, index) => {
                                        const courseProgress = progress.completedModuleIds?.length || 0;
                                        const totalModules = progress.totalModules || 0;
                                        const progressPercentage = totalModules > 0 ? Math.round((courseProgress / totalModules) * 100) : 0;

                                        return (
                                            <div key={index} className="space-y-3 p-4 border rounded-lg">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-medium">{progress.courseTitle || "Course"}</h4>
                                                            {getLevelBadge(progress.currentLevel || "L1")}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            {courseProgress} of {totalModules} modules completed
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline">{progressPercentage}%</Badge>
                                                </div>
                                                <Progress value={progressPercentage} className="h-2" />
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <span className="font-medium">Lessons: </span>
                                                        <span>{progress.completedLessonIds?.length || 0}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-medium">Last Activity: </span>
                                                        <span>
                                                            {progress.updatedAt
                                                                ? new Date(progress.updatedAt).toLocaleDateString()
                                                                : "No activity"
                                                            }
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <IconBook2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                    <p className="text-muted-foreground">No course progress data available</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Recent Activity */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Recent Submissions */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-sm">
                                    <IconFileText className="h-4 w-4" />
                                    Recent Submissions
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {submissions.slice(0, 3).length > 0 ? (
                                    <div className="space-y-3">
                                        {submissions.slice(0, 3).map((submission, i) => (
                                            <div key={submission._id || i} className="flex items-center justify-between p-3 border rounded-lg">
                                                <div>
                                                    <p className="font-medium text-sm">{submission.assignment?.title || "Assignment"}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(submission.submittedAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {submission.grade && (
                                                        <Badge variant="outline">{submission.grade}%</Badge>
                                                    )}
                                                    {getSubmissionStatusBadge(submission)}
                                                </div>
                                            </div>
                                        ))}
                                        {submissions.length > 3 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setActiveTab("submissions")}
                                                className="w-full mt-2"
                                            >
                                                View All Submissions
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">No submissions yet</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Recent Quiz Attempts */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-sm">
                                    <IconClipboardList className="h-4 w-4" />
                                    Recent Test Attempts
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {attempts.slice(0, 3).length > 0 ? (
                                    <div className="space-y-3">
                                        {attempts.slice(0, 3).map((attempt, i) => (
                                            <div key={attempt._id || i} className="flex items-center justify-between p-3 border rounded-lg">
                                                <div>
                                                    <p className="font-medium text-sm">{attempt.quiz?.title || "Quiz"}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(attempt.attemptedAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline">{attempt.scorePercent || 0}%</Badge>
                                                    <Badge variant={attempt.passed ? "success" : "destructive"}>
                                                        {attempt.passed ? "Passed" : "Failed"}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                        {attempts.length > 3 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setActiveTab("quizzes")}
                                                className="w-full mt-2"
                                            >
                                                View All Attempts
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">No test attempts yet</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="progress">
                    <Card>
                        <CardHeader>
                            <CardTitle>Detailed Course Progress</CardTitle>
                            <CardDescription>
                                Complete progress breakdown for all enrolled courses
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
                            ) : progressList.length > 0 ? (
                                <div className="space-y-6">
                                    {progressList.map((progress, index) => {
                                        const courseProgress = progress.completedModuleIds?.length || 0;
                                        const totalModules = progress.totalModules || 0;
                                        const progressPercentage = totalModules > 0 ? Math.round((courseProgress / totalModules) * 100) : 0;

                                        return (
                                            <div key={index} className="border rounded-lg p-6 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <h3 className="text-lg font-semibold">{progress.courseTitle || `Course ${index + 1}`}</h3>
                                                            {getLevelBadge(progress.currentLevel || "L1")}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            Progress: {courseProgress} of {totalModules} modules completed
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-2xl font-bold text-blue-600">{progressPercentage}%</div>
                                                        <p className="text-xs text-muted-foreground">Complete</p>
                                                    </div>
                                                </div>

                                                <Progress value={progressPercentage} className="h-3" />

                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                                                    <div className="flex justify-between">
                                                        <span>Current Level:</span>
                                                        <span className="font-medium">{progress.currentLevel || "L1"}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Modules Completed:</span>
                                                        <span className="font-medium">{courseProgress}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Lessons Completed:</span>
                                                        <span className="font-medium">{progress.completedLessonIds?.length || 0}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Last Activity:</span>
                                                        <span className="font-medium">
                                                            {progress.updatedAt
                                                                ? new Date(progress.updatedAt).toLocaleDateString()
                                                                : "No activity"
                                                            }
                                                        </span>
                                                    </div>
                                                </div>

                                                {progress.completedModuleIds?.length > 0 && (
                                                    <div>
                                                        <p className="text-sm font-medium mb-2">Completed Modules:</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {progress.completedModuleIds.map((moduleId, idx) => (
                                                                <Badge key={idx} variant="outline" className="text-xs">
                                                                    Module {idx + 1}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <IconBook2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="text-lg font-medium mb-2">No Course Progress</h3>
                                    <p className="text-muted-foreground">
                                        This student hasn't started any courses yet.
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
                                All assignment submissions by this student
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {submissionsError ? (
                                <Alert>
                                    <AlertDescription className="flex items-center gap-2">
                                        <IconX className="h-4 w-4" />
                                        Failed to load submissions. Please try refreshing.
                                    </AlertDescription>
                                </Alert>
                            ) : submissions.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Assignment</TableHead>
                                            <TableHead>Course</TableHead>
                                            <TableHead>Submitted</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Grade</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {submissions.map((submission) => (
                                            <TableRow key={submission._id}>
                                                <TableCell className="font-medium">
                                                    {submission.assignment?.title || "Assignment"}
                                                </TableCell>
                                                <TableCell>
                                                    {submission.assignment?.course?.title || "Unknown Course"}
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(submission.submittedAt).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    {getSubmissionStatusBadge(submission)}
                                                </TableCell>
                                                <TableCell>
                                                    {submission.grade !== undefined ? (
                                                        <Badge variant="outline">{submission.grade}%</Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">Not graded</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex gap-1 justify-end">
                                                        {submission.fileUrl && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => window.open(submission.fileUrl, '_blank')}
                                                            >
                                                                <IconDownload className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" size="sm">
                                                            <IconEye className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="text-center py-12">
                                    <IconFileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="text-lg font-medium mb-2">No Submissions</h3>
                                    <p className="text-muted-foreground">
                                        This student hasn't submitted any assignments yet.
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
                                All test attempts by this student
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {attemptsError ? (
                                <Alert>
                                    <AlertDescription className="flex items-center gap-2">
                                        <IconX className="h-4 w-4" />
                                        Failed to load test attempts. Please try refreshing.
                                    </AlertDescription>
                                </Alert>
                            ) : attempts.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Quiz</TableHead>
                                            <TableHead>Course</TableHead>
                                            <TableHead>Attempted</TableHead>
                                            <TableHead>Score</TableHead>
                                            <TableHead>Result</TableHead>
                                            <TableHead>Time Taken</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {attempts.map((attempt) => (
                                            <TableRow key={attempt._id}>
                                                <TableCell className="font-medium">
                                                    {attempt.quiz?.title || "Quiz"}
                                                </TableCell>
                                                <TableCell>
                                                    {attempt.quiz?.course?.title || "Unknown Course"}
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(attempt.attemptedAt).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{attempt.scorePercent || 0}%</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={attempt.passed ? "success" : "destructive"}>
                                                        {attempt.passed ? "Passed" : "Failed"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {attempt.timeTaken ? `${attempt.timeTaken} min` : "N/A"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => { setViewAttemptId(attempt._id); setAttemptModalOpen(true); }}>
                                                        <IconEye className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="text-center py-12">
                                    <IconClipboardList className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="text-lg font-medium mb-2">No Test Attempts</h3>
                                    <p className="text-muted-foreground">
                                        This operator hasn't attempted any Tests yet.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="ojt">
                  {selectedOjt ? (
                    <Tabs defaultValue="record" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="record">Training Record Sheet</TabsTrigger>
                        <TabsTrigger value="evaluation">Evaluation Form</TabsTrigger>
                      </TabsList>

                      <TabsContent value="record">
                        <Card className="border border-slate-200 shadow-sm">
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b bg-slate-50/50">
                            <CardTitle className="text-xl font-bold text-slate-800">OJT Training Record Sheet</CardTitle>
                            <Button variant="outline" size="sm" onClick={() => setSelectedOjt(null)}>
                              <IconArrowLeft className="h-4 w-4 mr-2" />
                              Back to List
                            </Button>
                          </CardHeader>
                          <CardContent className="pt-6">
                            <OJTTrainingRecordSheet
                              ojtId={selectedOjt._id || selectedOjt.id}
                              studentName={student?.fullName}
                              readOnly={true}
                              onBack={() => setSelectedOjt(null)}
                            />
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="evaluation">
                        <Card className="border border-slate-200 shadow-sm">
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b bg-slate-50/50">
                            <CardTitle className="text-xl font-bold text-slate-800">On Job Training Evaluation Form</CardTitle>
                            <Button variant="outline" size="sm" onClick={() => setSelectedOjt(null)}>
                              <IconArrowLeft className="h-4 w-4 mr-2" />
                              Back to List
                            </Button>
                          </CardHeader>
                          <CardContent className="pt-6">
                            <OnJobTrainingTable
                              ojtId={selectedOjt._id || selectedOjt.id}
                              studentName={student?.fullName}
                              model={student?.department?.name || "N/A"}
                              readOnly={true}
                              onBack={() => setSelectedOjt(null)}
                            />
                          </CardContent>
                        </Card>
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <Card className="border-slate-200 shadow-md">
                      <CardHeader className="pb-3 border-b bg-slate-50/50">
                        <div className="flex justify-between items-center">
                          <div>
                            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                              <IconTrophy className="h-5 w-5 text-amber-500" />
                              On Job Training Portfolio
                            </CardTitle>
                            <CardDescription>
                              Approved and passed Level-1 Practical Evaluations for this operator
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        {passedOjts.length === 0 ? (
                          <div className="text-center py-16 border border-dashed border-slate-200 rounded-xl bg-slate-50/30 text-slate-500">
                            <IconTrophy className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-base font-semibold text-slate-700">No Passed OJT Records</h3>
                            <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                              This operator has not passed any On Job Training assessments yet.
                            </p>
                          </div>
                        ) : (
                          <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                            <Table>
                              <TableHeader className="bg-slate-50">
                                <TableRow>
                                  <TableHead className="font-bold text-slate-700">Training Topic</TableHead>
                                  <TableHead className="font-bold text-slate-700">Department</TableHead>
                                  <TableHead className="font-bold text-slate-700">Section & Line</TableHead>
                                  <TableHead className="font-bold text-slate-700">Sub-Section & Machine</TableHead>
                                  <TableHead className="font-bold text-slate-700">Approved Date</TableHead>
                                  <TableHead className="font-bold text-slate-700">Status</TableHead>
                                  <TableHead className="font-bold text-slate-700 text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {passedOjts.map((ojtItem) => (
                                  <TableRow key={ojtItem.id || ojtItem._id} className="hover:bg-slate-50/40 transition-colors">
                                    <TableCell className="font-semibold text-slate-900">
                                      {ojtItem.trainingTopic || ojtItem.name || "Practical Evaluation"}
                                    </TableCell>
                                    <TableCell className="text-slate-600">
                                      {ojtItem.department?.name || ojtItem.department || "-"}
                                    </TableCell>
                                    <TableCell className="text-slate-600">
                                      <span className="font-medium">{ojtItem.section?.name || ojtItem.section || "-"}</span>
                                      <span className="text-slate-400 mx-1">/</span>
                                      <span className="text-xs">{ojtItem.line?.name || ojtItem.line || "-"}</span>
                                    </TableCell>
                                    <TableCell className="text-slate-600">
                                      <span className="font-medium">{ojtItem.subSection?.name || ojtItem.subSection || "-"}</span>
                                      <span className="text-slate-400 mx-1">/</span>
                                      <span className="text-xs font-mono bg-slate-100 px-1 rounded">{ojtItem.machine?.name || ojtItem.machine || "-"}</span>
                                    </TableCell>
                                    <TableCell className="text-slate-600">
                                      {new Date(ojtItem.updatedAt || ojtItem.createdAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold hover:bg-emerald-100">
                                        Approved
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-indigo-100 text-indigo-700 hover:bg-indigo-50/50 hover:text-indigo-800 gap-1.5"
                                        onClick={() => setSelectedOjt(ojtItem)}
                                      >
                                        <IconEye className="h-4 w-4" />
                                        View Portfolio
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
                  )}
                </TabsContent>
            </Tabs>
            {/* Attempt Review Modal (admin editable) */}
            <AttemptReviewModal
                attemptId={viewAttemptId}
                isOpen={attemptModalOpen}
                onClose={() => setAttemptModalOpen(false)}
                canEdit={true}
            />


        </div>
    );
};

export default StudentDetail;
