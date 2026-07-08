import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGetUserByIdQuery } from "@/Redux/AllApi/UserApi";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetStudentProgressQuery } from "@/Redux/AllApi/ProgressApi";
import { useGetStudentSubmissionsQuery } from "@/Redux/AllApi/SubmissionApi";
import { useGetStudentAttemptsQuery } from "@/Redux/AllApi/AttemptedQuizApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AttemptReviewModal from "@/components/common/AttemptReviewModal";
import OnJobTrainingTable from "@/components/admin/OnJobTrainingTable"; // Keep this for detail view
import OJTTrainingRecordSheet from "@/components/admin/OJTTrainingRecordSheet"; // New format
import { useGetStudentOJTsQuery } from "@/Redux/AllApi/OnJobTrainingApi";
import SkillMatrixCertificate from "@/components/admin/SkillMatrixCertificate";
import OperatorObservanceSheet from "@/components/admin/OperatorObservanceSheet";
import SixteenDayMonitoringSheet from "@/components/admin/SixteenDayMonitoringSheet";
import ThreeDayMonitoringSheet from "@/components/admin/ThreeDayMonitoringSheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  IconChevronRight,
  IconBuilding,
  IconLayout,
  IconGitBranch,
  IconGitCommit,
  IconSettings
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getMediaUrl } from "@/utils/mediaUtils";
import { safeDateFormat, displayDate } from "@/utils/dateUtils";

const safeLocaleDate = (dateValue) => {
  return displayDate(dateValue) || "—";
};

const StudentDetail = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [viewAttemptId, setViewAttemptId] = useState(null);
  const [attemptModalOpen, setAttemptModalOpen] = useState(false);

  // OJT State
  const [selectedOjtId, setSelectedOjtId] = useState(null);
  const [createOjtOpen, setCreateOjtOpen] = useState(false);

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

  const {
    data: ojtData,
    isLoading: ojtLoading,
    error: ojtError,
    refetch: refetchOjt,
  } = useGetStudentOJTsQuery(studentId, {
    skip: !studentId || studentId === "undefined",
    refetchOnMountOrArgChange: true,
  });

  const { data: deptListData } = useGetAllDepartmentsQuery({ page: 1, limit: 100 });
  const allDepts = deptListData?.data?.departments || [];

  const student = studentData?.data;
  const progressList = progressData?.data || [];
  const submissions = submissionsData?.data || [];
  const attempts = attemptsData?.data || [];

  const getDeptNames = (s) => {
    if (!s) return [];
    const rawDepts = typeof s.departments === 'string' ? JSON.parse(s.departments || "[]") : (s.departments || []);
    if (Array.isArray(rawDepts) && rawDepts.length > 0 && allDepts.length > 0) {
      const names = rawDepts.map(id => {
        const d = allDepts.find(dept => String(dept.id || dept._id) === String(id));
        return d ? d.name : null;
      }).filter(Boolean);
      if (names.length > 0) return names;
    }
    if (s.assignments?.length > 0) {
      const names = [...new Set(s.assignments.map(a => a.deptName).filter(n => n && n.toLowerCase() !== "none"))];
      if (names.length > 0) return names;
    }
    if (s.deptName && s.deptName.toLowerCase() !== "none") return [s.deptName];
    if (typeof s.department === 'object' && s.department?.name) return [s.department.name];
    return [];
  };

  const getSectionNames = (s) => {
    if (!s) return [];
    if (Array.isArray(s.assignments) && s.assignments.length > 0) {
      const names = [...new Set(s.assignments.map(a => a.sectionName).filter(n => n && n.toLowerCase() !== "none"))];
      if (names.length > 0) return names;
    }
    return (s.sectionName && s.sectionName.toLowerCase() !== "none") ? [s.sectionName] : [];
  };

  // Calculate Operator Efficiency values
  const currentEff = useMemo(() => {
    if (!student || student.currentEffeciency === undefined || student.currentEffeciency === null) return "0%";
    return `${Math.round(student.currentEffeciency * 100) / 100}%`;
  }, [student]);

  const subSecEff = useMemo(() => {
    if (!student || !student.subSectionId) return "—";
    let skillEff = student.skillEffeciency;
    if (typeof skillEff === 'string') {
      try { skillEff = JSON.parse(skillEff); } catch (e) { skillEff = {}; }
    }
    const eff = skillEff?.[String(student.subSectionId)];
    return eff !== undefined ? `${Math.round(eff * 100) / 100}%` : "0%";
  }, [student]);

  // Loading state
  const isLoading = studentLoading || progressLoading || submissionsLoading || attemptsLoading || ojtLoading;

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
    [refetchStudent, refetchProgress, refetchSubmissions, refetchAttempts, refetchOjt].forEach(fn => {
      try { fn(); } catch (e) { /* query not started yet, nothing to refresh */ }
    });
    toast.success("Operator data refreshed successfully!");
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      ACTIVE: { variant: "success", label: "Active", color: "text-green-700" },
      SUSPENDED: { variant: "destructive", label: "Suspended", color: "text-red-700" },
      PENDING: { variant: "warning", label: "Pending", color: "text-amber-700" },
      BANNED: { variant: "destructive", label: "Banned", color: "text-red-700" },
      LEFT: { variant: "destructive", label: "Left", color: "text-red-700 bg-red-50 border-red-200" },
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

  const shiftBadgeClass = (shift) => {
    const map = {
      A: "bg-blue-100 text-blue-800 border-blue-200",
      B: "bg-emerald-100 text-emerald-800 border-emerald-200",
      C: "bg-purple-100 text-purple-800 border-purple-200",
      G: "bg-amber-100 text-amber-800 border-amber-200",
    };
    return map[shift] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const parsedShiftSchedule = useMemo(() => {
    if (!student?.shiftSchedule) return {};
    let schedule = student.shiftSchedule;
    if (typeof schedule === 'string') {
      try {
        schedule = JSON.parse(schedule);
      } catch (e) {
        return {};
      }
    }
    return (schedule && typeof schedule === 'object' && !Array.isArray(schedule)) ? schedule : {};
  }, [student?.shiftSchedule]);

  const scheduledShiftToday = useMemo(() => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return parsedShiftSchedule[key] || null;
  }, [parsedShiftSchedule]);

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
          Error loading employee details
        </div>
        <p className="text-gray-600 text-center">
          {studentError?.message || "Failed to fetch employee information"}
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
        <div className="text-lg font-medium">Employee not found</div>
        <p className="text-muted-foreground">
          The employee you're looking for doesn't exist or has been deleted.
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
              <AvatarImage src={getMediaUrl(student.avatar?.url)} alt={student.fullName} />
              <AvatarFallback className="bg-blue-100 text-blue-800 text-lg">
                {student.fullName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{student.fullName}</h1>
                <Badge className="bg-indigo-600 text-white border-indigo-700 text-sm py-0.5 px-3">
                  {student.primaryLevel || "L1"} • {student.primaryStationName || "No Station"}
                </Badge>
                <Badge className="bg-emerald-600 text-white border-emerald-700 text-sm py-0.5 px-3">
                  Overall Eff: {currentEff}
                </Badge>
                {student.subSectionName && (
                  <Badge className="bg-blue-600 text-white border-blue-700 text-sm py-0.5 px-3">
                    {student.subSectionName} Eff: {subSecEff}
                  </Badge>
                )}
                {student.isTemporary && (
                  <Badge className="bg-amber-500 text-white border-amber-600 text-sm py-0.5 px-3">
                    Temporary
                  </Badge>
                )}
                {(scheduledShiftToday || student.shift) && (
                  <Badge className={`text-sm py-0.5 px-3 ${shiftBadgeClass(scheduledShiftToday || student.shift)}`}>
                    Shift {scheduledShiftToday || student.shift}
                    {scheduledShiftToday && " (Today)"}
                  </Badge>
                )}
              </div>
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

      {/* Employee & Personal Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 bg-gradient-to-b from-blue-50/50 to-white border-blue-100 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-900 text-base">
              <IconUser className="h-5 w-5" />
              Primary Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Email Address</label>
              <div className="flex items-center gap-2 text-sm">
                <IconMail className="h-4 w-4 text-blue-500" />
                <span className="font-medium">{student.email || "N/A"}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Mobile Number</label>
              <div className="flex items-center gap-2 text-sm">
                <IconPhone className="h-4 w-4 text-green-500" />
                <span className="font-medium">{student.phoneNumber || "N/A"}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Employee ID / Card No</label>
              <div className="text-sm font-medium flex items-center gap-2">
                <Badge variant="outline" className="bg-white">{student.empId || student.userName || "N/A"}</Badge>
                {student.idCard && <Badge variant="secondary" className="bg-slate-100">{student.idCard}</Badge>}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Designation</label>
              <div className="text-sm font-semibold text-indigo-700">{student.designation || "Operator"}</div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Contractor</label>
              <div className="flex items-center gap-2 text-sm">
                <IconBuilding className="h-4 w-4 text-slate-500" />
                <span className="font-medium">{student.contractor || "N/A"}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Employee Type</label>
              <Badge className={`w-fit ${student.isTemporary ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-blue-100 text-blue-800 border-blue-200"}`}>
                {student.isTemporary ? "Temporary" : "Regular"}
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Shift</label>
              {(scheduledShiftToday || student.shift) ? (
                <div className="flex flex-col gap-1">
                  <Badge className={`w-fit ${shiftBadgeClass(scheduledShiftToday || student.shift)}`}>
                    Shift {scheduledShiftToday || student.shift}
                  </Badge>
                  {scheduledShiftToday && (
                    <span className="text-[10px] text-emerald-600 font-medium">Scheduled today</span>
                  )}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Not Assigned</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Department(s)</label>
              <div className="flex flex-wrap gap-1">
                {getDeptNames(student).length > 0
                  ? getDeptNames(student).map((name, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">{name}</Badge>
                    ))
                  : <span className="text-sm text-muted-foreground">N/A</span>
                }
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Section(s)</label>
              <div className="flex flex-wrap gap-1">
                {getSectionNames(student).length > 0
                  ? getSectionNames(student).map((name, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">{name}</Badge>
                    ))
                  : <span className="text-sm text-muted-foreground">N/A</span>
                }
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Current Overall Efficiency</label>
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                <IconTrophy className="h-4 w-4 text-amber-500" />
                <span>{currentEff}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Sub-section Efficiency ({student.subSectionName || "No Sub-section"})</label>
              <div className="flex items-center gap-2 text-sm font-bold text-blue-700">
                <IconChartBar className="h-4 w-4 text-blue-500" />
                <span>{subSecEff}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Joining Date</label>
              <div className="flex items-center gap-2 text-sm">
                <IconCalendar className="h-4 w-4 text-green-500" />
                <span className="font-medium">{student.joiningDate ? safeLocaleDate(student.joiningDate) : "—"}</span>
              </div>
            </div>
            {(student.leavingDate || student.status === "LEFT") && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Leaving Date</label>
                <div className="flex items-center gap-2 text-sm">
                  <IconCalendar className="h-4 w-4 text-red-500" />
                  <span className="font-medium text-red-600">{student.leavingDate ? safeLocaleDate(student.leavingDate) : "—"}</span>
                </div>
              </div>
            )}
            {(student.leavingDate || student.status === "LEFT") && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Reason of Leaving</label>
                <p className="text-sm text-red-600 font-medium">{student.reasonOfLeaving || "—"}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b bg-slate-50/50">
            <CardTitle className="text-base flex items-center gap-2">
              <IconFileText className="h-5 w-5 text-slate-600" />
              Detailed Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-y-6 gap-x-8">
              {/* Personal Column */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-1">Personal</h4>
                <div className="space-y-3">
                  <div className="group">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Father / Husband</p>
                    <p className="text-sm font-medium">{student.fatherHusbandName || "—"}</p>
                  </div>
                  <div className="group">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Gender / DOB</p>
                    <p className="text-sm font-medium">
                      {student.gender || "—"} {student.dob ? `(${safeLocaleDate(student.dob)})` : ""}
                    </p>
                  </div>
                  <div className="group">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Qualification</p>
                    <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50/30">
                      {student.education || "Not Specified"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Professional Column */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-1">Professional</h4>
                <div className="space-y-3">
                  <div className="col-span-1 md:col-span-2 mt-2 pt-3 border-t border-slate-100">
                    <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Organizational Assignment Flow</p>
                    <div className="space-y-3">
                      {(student.assignments && student.assignments.length > 0 ? student.assignments : [
                        {
                          deptName: typeof student.department === 'object' ? student.department?.name : (student.deptName || student.department || "N/A"),
                          sectionName: student.sectionName || "N/A",
                          lineName: student.lineName || "N/A",
                          subSectionName: student.subSectionName || "N/A",
                          stationName: student.stationName || "N/A",
                          machineId: student.stationId
                        }
                      ]).map((assignment, idx) => (
                        <div key={idx} className={`flex flex-wrap items-center gap-y-2 gap-x-1 sm:gap-x-2 p-2 rounded-lg border relative transition-all ${assignment.machineId === student.stationId ? 'bg-blue-50/30 border-blue-200' : 'bg-slate-50/50 border-slate-100'}`}>
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white text-blue-700 rounded-md border border-blue-100 shadow-sm">
                            <IconBuilding size={14} className="shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-[7px] leading-none opacity-70 uppercase font-bold">Dept{idx > 0 ? ` ${idx + 1}` : ''}</span>
                              <span className="text-[10px] font-bold whitespace-nowrap">{assignment.deptName}</span>
                            </div>
                          </div>

                          <IconChevronRight size={12} className="text-slate-300" />

                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white text-indigo-700 rounded-md border border-indigo-100 shadow-sm">
                            <IconLayout size={14} className="shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-[7px] leading-none opacity-70 uppercase font-bold">Section{idx > 0 ? ` ${idx + 1}` : ''}</span>
                              <span className="text-[10px] font-bold whitespace-nowrap">{assignment.sectionName}</span>
                            </div>
                          </div>

                          <IconChevronRight size={12} className="text-slate-300" />

                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white text-violet-700 rounded-md border border-violet-100 shadow-sm">
                            <IconGitBranch size={14} className="shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-[7px] leading-none opacity-70 uppercase font-bold">Line{idx > 0 ? ` ${idx + 1}` : ''}</span>
                              <span className="text-[10px] font-bold whitespace-nowrap">{assignment.lineName}</span>
                            </div>
                          </div>

                          <IconChevronRight size={12} className="text-slate-300" />

                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white text-purple-700 rounded-md border border-purple-100 shadow-sm">
                            <IconGitCommit size={14} className="shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-[7px] leading-none opacity-70 uppercase font-bold">Sub-Sect{idx > 0 ? ` ${idx + 1}` : ''}</span>
                              <span className="text-[10px] font-bold whitespace-nowrap">{assignment.subSectionName}</span>
                            </div>
                          </div>

                          <IconChevronRight size={12} className="text-slate-300" />

                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white text-rose-700 rounded-md border border-rose-100 shadow-sm">
                            <IconSettings size={14} className="shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-[7px] leading-none opacity-70 uppercase font-bold">Station{idx > 0 ? ` ${idx + 1}` : ''}</span>
                              <span className="text-[10px] font-bold whitespace-nowrap">{assignment.stationName}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 shadow-sm ml-auto sm:ml-0">
                            <IconTrophy size={14} className="shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-[7px] leading-none opacity-70 uppercase font-bold">Level</span>
                              <span className="text-[10px] font-bold whitespace-nowrap">{student.currentSkill?.[assignment.subSectionId] || "L1"}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100 shadow-sm">
                            <IconChartBar size={14} className="shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-[7px] leading-none opacity-70 uppercase font-bold">Efficiency</span>
                              <span className="text-[10px] font-bold whitespace-nowrap">
                                {(() => {
                                  let skillEff = student.skillEffeciency;
                                  if (typeof skillEff === 'string') {
                                    try { skillEff = JSON.parse(skillEff); } catch (e) { skillEff = {}; }
                                  }
                                  const eff = skillEff?.[String(assignment.subSectionId)];
                                  return eff !== undefined ? `${Math.round(eff * 100) / 100}%` : "0%";
                                })()}
                              </span>
                            </div>
                          </div>

                          {assignment.machineId === student.stationId && (
                            <div className="absolute -top-2 -right-1">
                              <Badge className="bg-blue-600 text-white border-blue-700 text-[6px] px-1.5 py-0 h-4">Primary</Badge>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="group">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Joining Date</p>
                    <p className="text-sm font-medium">
                      {student.joiningDate ? safeLocaleDate(student.joiningDate) : (student.createdAt ? safeLocaleDate(student.createdAt) : "—")}
                    </p>
                  </div>
                  {(student.leavingDate || student.status === "LEFT") && (
                    <div className="group">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Leaving Date</p>
                      <p className="text-sm font-medium text-red-600">{student.leavingDate ? safeLocaleDate(student.leavingDate) : "—"}</p>
                    </div>
                  )}
                  {student.contractor && (
                    <div className="group">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Contractor</p>
                      <p className="text-sm font-medium">{student.contractor}</p>
                    </div>
                  )}
                  {student.expectedHandover && (
                    <div className="group">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Expected Handover</p>
                      <p className="text-sm font-medium text-indigo-600">{safeLocaleDate(student.expectedHandover)}</p>
                    </div>
                  )}
                  {(student.leavingDate || student.status === "LEFT") && (
                    <div className="group">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Reason of Leaving</p>
                      <p className="text-sm font-medium text-red-600">{student.reasonOfLeaving || "—"}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Address Column */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-1">Location & Transit</h4>
                <div className="space-y-3">
                  <div className="group">
                    <p className="text-[10px] text-muted-foreground mb-0.5">District & State</p>
                    <p className="text-sm font-medium">{student.district || "—"}{student.state ? `, ${student.state}` : ""}</p>
                  </div>
                  <div className="group">
                    <p className="text-[10px] text-muted-foreground mb-0.5">PIN Code</p>
                    <p className="text-sm font-medium tracking-wider font-mono">{student.pin || "—"}</p>
                  </div>
                  <div className="group">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Bus Route</p>
                    <p className="text-sm font-medium text-amber-700">{student.busRoute || "Self / Not Assigned"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Support Column */}
            <div className="mt-8 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="flex items-start gap-2">
                 <div className="bg-indigo-100 p-1.5 rounded text-indigo-700"><IconUser className="h-3.5 w-3.5" /></div>
                 <div>
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">Mentor</p>
                    <p className="text-xs font-medium">{student.mentor || "N/A"}</p>
                 </div>
               </div>
               <div className="flex items-start gap-2">
                 <div className="bg-emerald-100 p-1.5 rounded text-emerald-700"><IconUser className="h-3.5 w-3.5" /></div>
                 <div>
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">Supervisor</p>
                    <p className="text-xs font-medium">{student.supervisor || "N/A"}</p>
                 </div>
               </div>
               <div className="flex items-start gap-2">
                 <div className="bg-rose-100 p-1.5 rounded text-rose-700"><IconUser className="h-3.5 w-3.5" /></div>
                 <div>
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">Incharge</p>
                    <p className="text-xs font-medium">{student.incharge || "N/A"}</p>
                 </div>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shift Schedule */}
      <Card>
        <CardHeader className="pb-3 border-b bg-slate-50/50">
          <CardTitle className="flex items-center gap-2 text-base">
            <IconCalendar className="h-5 w-5 text-slate-600" />
            Shift Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Default Shift</p>
                {student.shift ? (
                  <Badge className={`text-sm py-1 px-3 ${shiftBadgeClass(student.shift)}`}>
                    Shift {student.shift}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Not Assigned</span>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Today's Shift</p>
                {scheduledShiftToday ? (
                  <Badge className={`text-sm py-1 px-3 ${shiftBadgeClass(scheduledShiftToday)}`}>
                    Shift {scheduledShiftToday}
                  </Badge>
                ) : student.shift ? (
                  <span className="text-sm text-muted-foreground">Using default (Shift {student.shift})</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Not Assigned</span>
                )}
              </div>
              {parsedShiftSchedule && Object.keys(parsedShiftSchedule).length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Schedule Summary</p>
                  <div className="flex flex-wrap gap-2">
                    {["A", "B", "C", "G"].map(s => {
                      const now = new Date();
                      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                      const count = Object.entries(parsedShiftSchedule || {})
                        .filter(([dateKey, val]) => dateKey >= todayKey && val === s).length;
                      if (!count) return null;
                      return (
                        <span key={s} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${shiftBadgeClass(s)}`}>
                          Shift {s}: {count} day{count !== 1 ? "s" : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div>
              {parsedShiftSchedule && Object.keys(parsedShiftSchedule).length > 0 ? (
                (() => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = now.getMonth();
                  const firstDay = new Date(year, month, 1);
                  const lastDay = new Date(year, month + 1, 0);
                  const startPad = firstDay.getDay();
                  const calDays = [];
                  for (let i = 0; i < startPad; i++) calDays.push(null);
                  for (let d = 1; d <= lastDay.getDate(); d++) calDays.push(d);
                  const SHIFT_COLORS = {
                    A: "bg-blue-50 text-blue-700 border-blue-200",
                    B: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    C: "bg-purple-50 text-purple-700 border-purple-200",
                    G: "bg-amber-50 text-amber-700 border-amber-200",
                  };
                  const monthLabel = firstDay.toLocaleString("default", { month: "long", year: "numeric" });
                  return (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground text-center">{monthLabel}</p>
                      <div className="grid grid-cols-7 gap-0.5 text-center text-[9px]">
                        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
                          <div key={d} className="font-bold text-muted-foreground py-0.5">{d}</div>
                        ))}
                        {calDays.map((d, i) => {
                          if (!d) return <div key={`pad-${i}`} />;
                          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                          const shift = parsedShiftSchedule?.[dateKey];
                          return (
                            <div key={d} className={`rounded py-0.5 border ${shift ? SHIFT_COLORS[shift] || "bg-gray-50 text-gray-700 border-gray-200" : "border-transparent text-gray-600"}`}>
                              <div className="leading-none">{d}</div>
                              {shift && <div className="font-bold leading-none mt-0.5">{shift}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center justify-center text-sm text-muted-foreground py-8 border border-dashed rounded-lg">
                  No shift schedule configured
                </div>
              )}
            </div>
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
          <TabsTrigger value="observance">Operator Observance</TabsTrigger>
          <TabsTrigger value="monitoring3">3 Day Monitoring</TabsTrigger>
          <TabsTrigger value="monitoring16">16 Day Monitoring</TabsTrigger>
          <TabsTrigger value="skillEvaluation">Check Sheet of Skill Evaluation</TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring16">
          <SixteenDayMonitoringSheet
            studentId={studentId}
            studentName={student?.fullName || ""}
            employeeCode={student?.userName || student?.empId || student?.employeeId || ""}
            departmentName={typeof student.department === 'object' ? (student.department?.name || "") : (student.department || "")}
            departmentId={typeof student.department === 'object' ? (student.department?._id || student.department?.id || "") : (student.department || "")}
          />
        </TabsContent>

        <TabsContent value="monitoring3">
          <ThreeDayMonitoringSheet
            studentId={studentId}
            departmentId={student?.department?._id || student?.department}
          />
        </TabsContent>

        <TabsContent value="skillEvaluation">
          <SkillMatrixCertificate
            studentId={student.id}
            studentName={student?.fullName || ""}
            employeeCode={student?.userName || student?.empId || ""}
            departmentId={typeof student.department === 'object' ? (student.department?._id || student.department?.id || "GLOBAL") : (student.department || "GLOBAL")}
            subSectionId={student?.subSectionId || student?.targetSubSectionId}
            onSaved={handleRefreshAll}
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
                Employee's progress across all enrolled courses
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
                      <div key={progress._id || index} className="space-y-3 p-4 border rounded-lg">
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
                                ? safeLocaleDate(progress.updatedAt)
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
                            {safeLocaleDate(submission.submittedAt)}
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
                            {safeLocaleDate(attempt.attemptedAt)}
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
                      <div key={progress._id || index} className="border rounded-lg p-6 space-y-4">
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
                                ? displayDate(progress.updatedAt)
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
                                <Badge key={moduleId || idx} variant="outline" className="text-xs">
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
                          {displayDate(submission.submittedAt)}
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
                          {displayDate(attempt.attemptedAt)}
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
                    This student hasn't attempted any Tests yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ojt">
          {selectedOjtId ? (
            <Tabs defaultValue="record" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="record">Training Record Sheet</TabsTrigger>
                <TabsTrigger value="evaluation">Evaluation Form</TabsTrigger>
              </TabsList>

              <TabsContent value="record">
                <Card className="border border-slate-200 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b bg-slate-50/50">
                    <CardTitle className="text-xl font-bold text-slate-800">OJT Training Record Sheet</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setSelectedOjtId(null)}>
                      <IconArrowLeft className="h-4 w-4 mr-2" />
                      Back to List
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <OJTTrainingRecordSheet
                      ojtId={selectedOjtId}
                      studentName={student.fullName}
                      readOnly={true}
                      onBack={() => setSelectedOjtId(null)}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="evaluation">
                <Card className="border border-slate-200 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b bg-slate-50/50">
                    <CardTitle className="text-xl font-bold text-slate-800">On Job Training Evaluation Form</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setSelectedOjtId(null)}>
                      <IconArrowLeft className="h-4 w-4 mr-2" />
                      Back to List
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <OnJobTrainingTable
                      ojtId={selectedOjtId}
                      studentName={student.fullName}
                      model="-"
                      readOnly={true}
                      onBack={() => setSelectedOjtId(null)}
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
                                onClick={() => setSelectedOjtId(ojtItem.id || ojtItem._id)}
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



        <TabsContent value="observance">
          <OperatorObservanceSheet
            studentId={studentId}
            studentName={student?.fullName || ""}
            employeeCode={student?.userName || student?.empId || student?.employeeId || ""}
          />
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
