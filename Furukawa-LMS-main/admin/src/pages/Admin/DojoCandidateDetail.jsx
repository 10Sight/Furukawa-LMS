import React, { useState, useMemo, useEffect } from "react";
import { useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import { useGetUserByIdQuery, useUpdateUserMutation, useDeleteUserMutation } from "@/Redux/AllApi/UserApi";
import { useGetStudentAttemptsQuery } from "@/Redux/AllApi/AttemptedQuizApi";
import AttemptReviewModal from "@/components/common/AttemptReviewModal";
import {
  Card, CardContent, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  IconArrowLeft, IconUser, IconMail, IconPhone, IconBuilding,
  IconSettings, IconCalendar, IconTrash, IconEdit,
  IconUserPlus, IconRefresh, IconChevronRight, IconFileText, IconChartBar,
  IconClipboardList, IconEye, IconClock, IconShieldCheck, IconHistory,
  IconActivity, IconCircleCheck, IconAlertTriangle, IconLoader2,
  IconShieldLock, IconShieldOff
} from "@tabler/icons-react";
import { toast } from "sonner";
import { getMediaUrl } from "@/utils/mediaUtils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import axiosInstance from "@/Helper/axiosInstance";
import SixteenDayMonitoringSheet from "@/components/admin/SixteenDayMonitoringSheet";
import MenteeFeedbackMonitoringSheet from "@/components/admin/MenteeFeedbackMonitoringSheet";
import { displayDate, safeDateFormat } from "@/utils/dateUtils";

const DojoCandidateDetail = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const currentUser = useSelector((state) => state.auth.user);
  const isAdminUser = !!(currentUser?.isAdmin || currentUser?.role === "ADMIN" || currentUser?.role === "SUPERADMIN");
  const hasPermission = (permission) => {
    if (isAdminUser) return true;
    return !!currentUser?.customRole?.permissions?.includes(permission);
  };
  const canDelete = hasPermission("dojo_hiring:delete");

  const { data: candidateData, isLoading, refetch } = useGetUserByIdQuery(studentId);
  const [updateUser] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();

  const { data: attemptsData, isLoading: attemptsLoading } = useGetStudentAttemptsQuery(studentId, {
    skip: !studentId,
    refetchOnMountOrArgChange: true,
  });

  const [viewAttemptId, setViewAttemptId] = useState(null);
  const [attemptModalOpen, setAttemptModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  const [evalAttempts, setEvalAttempts] = useState([]);
  const [evalLoading, setEvalLoading] = useState(false);
  const [handoverHistory, setHandoverHistory] = useState([]);
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [eligibilityReport, setEligibilityReport] = useState(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideScope, setOverrideScope] = useState("all"); // "all" | "date"
  const [overrideForDate, setOverrideForDate] = useState("");
  const [overrideActionLoading, setOverrideActionLoading] = useState(false);

  const candidate = candidateData?.data;
  const attempts = attemptsData?.data || [];

  const attemptStats = useMemo(() => {
    if (!attempts.length) return { total: 0, passed: 0, failed: 0, avgScore: 0 };
    const passed = attempts.filter(a => a.passed).length;
    const avgScore = Math.round(attempts.reduce((sum, a) => sum + (a.scorePercent || 0), 0) / attempts.length);
    return { total: attempts.length, passed, failed: attempts.length - passed, avgScore };
  }, [attempts]);

  useEffect(() => {
    if (activeTab === "dojo" && studentId) {
      setEvalLoading(true);
      axiosInstance.get(`/api/evaluation-tests/attempts/student/${studentId}`)
        .then(res => setEvalAttempts(res.data?.data || []))
        .catch(() => toast.error("Failed to load evaluation test attempts"))
        .finally(() => setEvalLoading(false));
    }
  }, [activeTab, studentId]);

  useEffect(() => {
    if (activeTab === "handover" && studentId) {
      setHandoverLoading(true);
      axiosInstance.get(`/api/departments/handover-sheet/student/${studentId}`)
        .then(res => setHandoverHistory(res.data?.data || []))
        .catch(() => toast.error("Failed to load handover history"))
        .finally(() => setHandoverLoading(false));
    }
  }, [activeTab, studentId]);

  const fetchEligibilityReport = () => {
    if (!studentId) return;
    setCheckingEligibility(true);
    axiosInstance.get(`/api/departments/handover-sheet/eligibility-check/${studentId}`)
      .then(res => setEligibilityReport(res.data?.data || null))
      .catch(() => toast.error("Failed to run eligibility check"))
      .finally(() => setCheckingEligibility(false));
  };

  useEffect(() => {
    if (activeTab === "handover" && studentId) {
      fetchEligibilityReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, studentId]);

  const handleBypassEligibility = () => {
    if (overrideScope === "date" && !overrideForDate) {
      toast.error("Please pick a date for the override");
      return;
    }
    setOverrideActionLoading(true);
    axiosInstance.post(`/api/departments/handover-sheet/bypass-eligibility/${studentId}`, {
      reason: overrideReason,
      forDate: overrideScope === "date" ? overrideForDate : null,
    })
      .then(() => {
        toast.success("Handover eligibility manually overridden");
        setOverrideReason("");
        setOverrideForDate("");
        fetchEligibilityReport();
      })
      .catch(err => toast.error(err.response?.data?.message || "Failed to override eligibility"))
      .finally(() => setOverrideActionLoading(false));
  };

  const handleRevokeOverride = (forDate) => {
    setOverrideActionLoading(true);
    axiosInstance.post(`/api/departments/handover-sheet/revoke-eligibility/${studentId}`, { forDate: forDate || null })
      .then(() => {
        toast.success("Handover eligibility override revoked");
        fetchEligibilityReport();
      })
      .catch(err => toast.error(err.response?.data?.message || "Failed to revoke override"))
      .finally(() => setOverrideActionLoading(false));
  };

  // Handle Delete User
  const handleDelete = async () => {
    if (!canDelete) return;
    try {
      await deleteUser(studentId).unwrap();
      toast.success("Candidate deleted successfully");
      navigate("/admin/dojo-hiring");
    } catch (error) {
      toast.error(error.data?.message || "Failed to delete candidate");
    }
  };

  if (isLoading) return <DetailSkeleton navigate={navigate} />;
  if (!candidate) return <NotFound navigate={navigate} />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/dojo-hiring")}>
            <IconArrowLeft className="h-4 w-4 mr-2" />
            Back to Hiring
          </Button>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2">
              <AvatarImage src={getMediaUrl(candidate.avatar?.url)} alt={candidate.fullName} />
              <AvatarFallback className="bg-blue-100 text-blue-800 text-lg">
                {candidate.fullName?.split(" ").map((n) => n[0]).join("").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{candidate.fullName}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={candidate.isTemporary ? "warning" : "success"} className="px-2 py-0 h-5 text-[10px]">
                  {candidate.isTemporary ? "Dojo Candidate" : "Permanent Employee"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 gap-2">
                  <IconTrash className="w-4 h-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the candidate record for {candidate.fullName}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-red-600">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Button onClick={() => refetch()} variant="outline" size="sm">
            <IconRefresh className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="profile" className="gap-1.5 text-xs">
            <IconUser className="h-3.5 w-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="dojo" className="gap-1.5 text-xs">
            <IconClipboardList className="h-3.5 w-3.5" />
            DOJO Evaluation
          </TabsTrigger>
          <TabsTrigger value="handover" className="gap-1.5 text-xs">
            <IconShieldCheck className="h-3.5 w-3.5" />
            Handover Sheet
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="gap-1.5 text-xs">
            <IconActivity className="h-3.5 w-3.5" />
            16-Day Monitoring
          </TabsTrigger>
        </TabsList>

        {/* ── Profile Tab ── */}
        <TabsContent value="profile" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 bg-gradient-to-b from-blue-50/50 to-white border-blue-100 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-blue-900 text-base font-bold">
                  <IconUser className="h-5 w-5" />
                  Primary Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoItem label="Email Address" icon={IconMail} value={candidate.email} />
                <InfoItem label="Mobile Number" icon={IconPhone} value={candidate.phoneNumber} />
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Employee ID</label>
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Badge variant="outline" className="bg-white border-blue-200 font-mono text-blue-700">{candidate.empId || "—"}</Badge>
                  </div>
                </div>
                {candidate.idCard && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Card No.</label>
                    <div className="text-sm font-medium flex items-center gap-2">
                      <Badge variant="outline" className="bg-white border-slate-200 font-mono text-slate-700">{candidate.idCard}</Badge>
                    </div>
                  </div>
                )}
                <InfoItem label="Designation" value={candidate.designation || "Candidate"} highlight />
                <InfoItem label="Contractor" icon={IconBuilding} value={candidate.contractor} />
                {(candidate.leavingDate || candidate.status === "LEFT") && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Leaving Date</label>
                      <div className="flex items-center gap-2 text-sm">
                        <IconCalendar className="h-4 w-4 text-red-500" />
                        <span className="font-medium text-red-600">{candidate.leavingDate ? displayDate(candidate.leavingDate) : "—"}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Reason of Leaving</label>
                      <p className="text-sm text-red-600 font-medium">{candidate.reasonOfLeaving || "—"}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b bg-slate-50/50">
                <CardTitle className="text-base flex items-center gap-2 font-bold text-slate-700">
                  <IconFileText className="h-5 w-5 text-slate-600" />
                  Detailed Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-y-6 gap-x-8">
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-1">Personal</h4>
                    <div className="space-y-3">
                      <ProfileField label="Father / Husband" value={candidate.fatherHusbandName} />
                      <ProfileField label="Gender" value={candidate.gender} />
                      <ProfileField label="DOB" value={candidate.dob && displayDate(candidate.dob)} />
                      <div className="group">
                        <p className="text-[10px] text-muted-foreground mb-0.5 font-bold uppercase">Qualification</p>
                        <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50/30 text-[10px] py-0 px-2">
                          {candidate.education || "—"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-1 space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-1">Placement</h4>
                    <div className="space-y-3">
                      <ProfileField label="Department" value={candidate.deptName || candidate.department?.name} />
                      <ProfileField label="Section" value={candidate.sectionName} />
                      <ProfileField label="Line" value={candidate.lineName} />
                      <ProfileField label="Unit" value={candidate.unit?.replace('_', ' ')} />
                      {(candidate.leavingDate || candidate.status === "LEFT") && (
                        <ProfileField label="Reason of Leaving" value={candidate.reasonOfLeaving} />
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-1">Location</h4>
                    <div className="space-y-3">
                      <ProfileField label="District & State" value={`${candidate.district || ""} ${candidate.state || ""}`.trim() || "—"} />
                      <ProfileField label="PIN Code" value={candidate.pin} />
                      <ProfileField label="Bus Route" value={candidate.busRoute} />
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-lg">
                  <TimelineItem label="Target Joining" value={candidate.joiningDate && displayDate(candidate.joiningDate)} icon={IconCalendar} color="green" />
                  <TimelineItem label="Expected Handover" value={candidate.expectedHandover ? displayDate(candidate.expectedHandover) : "—"} icon={IconCalendar} color="amber" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <IconSettings className="h-4 w-4" />
                Specific Station Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center gap-3">
                <DeploymentChip label="Dept" value={candidate.deptName || candidate.department?.name} />
                <IconChevronRight className="w-4 h-4 text-slate-300" />
                <DeploymentChip label="Section" value={candidate.sectionName} />
                <IconChevronRight className="w-4 h-4 text-slate-300" />
                <DeploymentChip label="Line" value={candidate.lineName} />
                <IconChevronRight className="w-4 h-4 text-slate-300" />
                <DeploymentChip label="Station" value={candidate.stationName} highlight />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── DOJO Evaluation Tab ── */}
        <TabsContent value="dojo" className="space-y-6 mt-6">
          {/* Quiz Attempts */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 py-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <IconClipboardList className="h-4 w-4" />
                  Quiz Test Attempts
                </CardTitle>
                <Badge variant="outline" className="text-xs font-mono">{attemptStats.total} total</Badge>
              </div>
            </CardHeader>

            {attempts.length > 0 && (
              <div className="grid grid-cols-4 divide-x border-b bg-slate-50/30 text-center text-xs">
                <div className="py-2 px-3">
                  <p className="text-muted-foreground uppercase font-bold text-[9px] tracking-widest">Total</p>
                  <p className="font-bold text-slate-800 text-base">{attemptStats.total}</p>
                </div>
                <div className="py-2 px-3">
                  <p className="text-muted-foreground uppercase font-bold text-[9px] tracking-widest">Passed</p>
                  <p className="font-bold text-green-600 text-base">{attemptStats.passed}</p>
                </div>
                <div className="py-2 px-3">
                  <p className="text-muted-foreground uppercase font-bold text-[9px] tracking-widest">Failed</p>
                  <p className="font-bold text-red-500 text-base">{attemptStats.failed}</p>
                </div>
                <div className="py-2 px-3">
                  <p className="text-muted-foreground uppercase font-bold text-[9px] tracking-widest">Avg Score</p>
                  <p className="font-bold text-blue-600 text-base">{attemptStats.avgScore}%</p>
                </div>
              </div>
            )}

            <CardContent className="p-0">
              {attemptsLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : attempts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="text-xs font-bold">Quiz</TableHead>
                      <TableHead className="text-xs font-bold">Type</TableHead>
                      <TableHead className="text-xs font-bold">Attempted On</TableHead>
                      <TableHead className="text-xs font-bold">Score</TableHead>
                      <TableHead className="text-xs font-bold">Result</TableHead>
                      <TableHead className="text-xs font-bold">Time</TableHead>
                      <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attempts.map((attempt) => (
                      <TableRow key={attempt._id} className="hover:bg-slate-50/50">
                        <TableCell className="font-semibold text-sm text-slate-800">
                          {attempt.quiz?.title || "—"}
                        </TableCell>
                        <TableCell>
                          <AttemptTypeBadge quiz={attempt.quiz} />
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {attempt.attemptedAt ? (
                            <div className="flex flex-col gap-0.5">
                              <span>{safeDateFormat(attempt.attemptedAt, "dd MMM yyyy")}</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {safeDateFormat(attempt.attemptedAt, "hh:mm a")}
                              </span>
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {attempt.scorePercent ?? 0}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={attempt.passed ? "success" : "destructive"} className="text-[10px] px-2 py-0 h-5">
                            {attempt.passed ? "Passed" : "Failed"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <IconClock className="h-3 w-3" />
                            {attempt.timeTaken ? `${attempt.timeTaken} min` : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => { setViewAttemptId(attempt._id); setAttemptModalOpen(true); }}
                          >
                            <IconEye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <IconClipboardList className="h-12 w-12 text-slate-200" />
                  <p className="text-sm font-semibold text-slate-500">No quiz attempts yet</p>
                  <p className="text-xs text-slate-400">This candidate has not submitted any quizzes.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Practical Evaluation Attempts */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 py-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <IconChartBar className="h-4 w-4" />
                  Practical Evaluation Test Attempts
                </CardTitle>
                <Badge variant="outline" className="text-xs font-mono">{evalAttempts.length} total</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {evalLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : evalAttempts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="text-xs font-bold">Test Title</TableHead>
                      <TableHead className="text-xs font-bold">Educator</TableHead>
                      <TableHead className="text-xs font-bold">Submitted On</TableHead>
                      <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evalAttempts.map((attempt) => (
                      <TableRow key={attempt.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-semibold text-sm text-slate-800">
                          {attempt.testTitle || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {attempt.educatorName || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {attempt.createdAt ? (
                            <div className="flex flex-col gap-0.5">
                              <span>{safeDateFormat(attempt.createdAt, "dd MMM yyyy")}</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {safeDateFormat(attempt.createdAt, "hh:mm a")}
                              </span>
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 text-xs px-2"
                            onClick={() => navigate(`/admin/view-evaluation-attempt/${attempt.id}`)}
                          >
                            <IconEye className="h-3.5 w-3.5" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <IconChartBar className="h-12 w-12 text-slate-200" />
                  <p className="text-sm font-semibold text-slate-500">No evaluation attempts yet</p>
                  <p className="text-xs text-slate-400">No practical DOJO evaluation sheets have been submitted for this candidate.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Handover Sheet Tab ── */}
        <TabsContent value="handover" className="space-y-6 mt-6">
          <HandoverEligibilityPanel
            report={eligibilityReport}
            loading={checkingEligibility}
            onRunCheck={fetchEligibilityReport}
            isAdminUser={isAdminUser}
            overrideReason={overrideReason}
            onOverrideReasonChange={setOverrideReason}
            overrideScope={overrideScope}
            onOverrideScopeChange={setOverrideScope}
            overrideForDate={overrideForDate}
            onOverrideForDateChange={setOverrideForDate}
            onBypass={handleBypassEligibility}
            onRevoke={handleRevokeOverride}
            actionLoading={overrideActionLoading}
          />

          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 py-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <IconHistory className="h-4 w-4" />
                  Handover Sheet History
                </CardTitle>
                <Badge variant="outline" className="text-xs font-mono">{handoverHistory.length} entries</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {handoverLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : handoverHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="text-xs font-bold">Date</TableHead>
                      <TableHead className="text-xs font-bold">Department</TableHead>
                      <TableHead className="text-xs font-bold">Section</TableHead>
                      <TableHead className="text-xs font-bold">Marks</TableHead>
                      <TableHead className="text-xs font-bold">Process</TableHead>
                      <TableHead className="text-xs font-bold">Mentor</TableHead>
                      <TableHead className="text-xs font-bold">Interview 1</TableHead>
                      <TableHead className="text-xs font-bold">Interview 2</TableHead>
                      <TableHead className="text-xs font-bold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {handoverHistory.map((entry) => (
                      <TableRow key={`${entry.id}-${entry.date}`} className="hover:bg-slate-50/50">
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {entry.date ? displayDate(entry.date) : "—"}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{entry.departmentName || "—"}</TableCell>
                        <TableCell className="text-xs text-slate-500">{entry.sectionName || "—"}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="font-mono text-xs">{entry.marks ?? "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{entry.process || "—"}</TableCell>
                        <TableCell className="text-xs text-slate-500">{entry.mentor || "—"}</TableCell>
                        <TableCell className="text-xs text-slate-500">{entry.interview1 || "—"}</TableCell>
                        <TableCell className="text-xs text-slate-500">{entry.interview2 || "—"}</TableCell>
                        <TableCell>
                          <HandoverStatusBadge status={entry.interviewStatus} actionBy={entry.statusActionBy} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <IconShieldCheck className="h-12 w-12 text-slate-200" />
                  <p className="text-sm font-semibold text-slate-500">No handover entries found</p>
                  <p className="text-xs text-slate-400">This candidate has not appeared in any department's handover sheet yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 16-Day Monitoring Tab ── */}
        <TabsContent value="monitoring" className="space-y-6 mt-6">
          <SixteenDayMonitoringSheet
            studentId={Number(studentId)}
            studentName={candidate.fullName}
            employeeCode={candidate.empId}
            departmentId={candidate.targetDeptId || candidate.departmentId}
            departmentName={candidate.deptName || candidate.department?.name}
            sectionId={candidate.targetSectionId || candidate.sectionId || 0}
            sectionName={candidate.sectionName}
            studentStatus={candidate.status}
          />
          <MenteeFeedbackMonitoringSheet studentId={Number(studentId)} />
        </TabsContent>
      </Tabs>

      <AttemptReviewModal
        attemptId={viewAttemptId}
        isOpen={attemptModalOpen}
        onClose={() => setAttemptModalOpen(false)}
        canEdit={true}
      />
    </div>
  );
};

const HandoverEligibilityPanel = ({
  report, loading, onRunCheck, isAdminUser,
  overrideReason, onOverrideReasonChange,
  overrideScope, onOverrideScopeChange,
  overrideForDate, onOverrideForDateChange,
  onBypass, onRevoke, actionLoading,
}) => {
  const overrides = report?.overrideDetails || [];
  const hasOverride = overrides.length > 0;
  // Always offered to admins, even when naturallyEligible is true: the real Handover Sheet search
  // gates on exact/on-or-after passedDate rules this "eligible" verdict doesn't check, so a
  // naturally-eligible candidate can still fail to appear for a specific sheet date.
  const showBypassControls = isAdminUser && !!report;

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="bg-slate-50/50 py-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <IconShieldCheck className="h-4 w-4" />
            Handover Sheet Eligibility Diagnostics
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs px-2"
            onClick={onRunCheck}
            disabled={loading}
          >
            {loading ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" /> : <IconRefresh className="h-3.5 w-3.5" />}
            Run Check
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {loading && !report ? (
          <div className="space-y-3">
            {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !report ? (
          <p className="text-sm text-slate-400 text-center py-6">Unable to load eligibility diagnostics.</p>
        ) : (
          <div className="space-y-5">
            {/* Status Banner */}
            <div className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border p-4 ${report.isEligible ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              {report.isEligible ? (
                <IconCircleCheck className="h-6 w-6 text-green-600 shrink-0" />
              ) : (
                <IconAlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-bold ${report.isEligible ? "text-green-800" : "text-red-800"}`}>
                  {report.isEligible ? "Eligible for Handover Sheet" : "Not Eligible for Handover Sheet"}
                  {hasOverride && <span className="font-normal"> (Manually Overridden)</span>}
                </p>
                {report.deptDetails && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Evaluated against target department: <span className="font-semibold">{report.deptDetails.name}</span>
                  </p>
                )}
              </div>
              {report.policyMode && (
                <Badge variant="outline" className="text-[10px] font-mono uppercase self-start sm:self-center">
                  {report.policyMode} mode
                </Badge>
              )}
            </div>

            {/* Active Overrides */}
            {hasOverride && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Manual Overrides</p>
                <div className="space-y-2">
                  {overrides.map((o, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                      <div className="min-w-0 text-xs text-blue-800">
                        <span className="font-semibold">{o.forDate ? `Approved for ${displayDate(o.forDate)}` : "Approved for all dates"}</span>
                        {" — by "}<span className="font-semibold">{o.overriddenBy || "Admin"}</span>
                        {o.overriddenAt && ` on ${displayDate(o.overriddenAt)}`}
                        {o.reason && <span className="block text-slate-500 mt-0.5">"{o.reason}"</span>}
                      </div>
                      {isAdminUser && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50 shrink-0"
                          onClick={() => onRevoke(o.forDate || null)}
                          disabled={actionLoading}
                        >
                          <IconShieldOff className="h-3.5 w-3.5" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Criteria */}
            {!report.isEligible && report.missingCriteria?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Reasons for Ineligibility</p>
                <ul className="space-y-1">
                  {report.missingCriteria.map((reason, i) => (
                    <li key={i} className="text-xs text-red-700 flex items-start gap-2">
                      <span className="mt-1 h-1 w-1 rounded-full bg-red-500 shrink-0" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Manual Override Controls (Admin-only). Shown even when naturallyEligible is true,
                because the real Handover Sheet search date-gates separately from this verdict. */}
            {showBypassControls && (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                  <IconShieldLock className="h-3.5 w-3.5" />
                  Manual Eligibility Override
                </p>
                <p className="text-xs text-slate-500">
                  {report.naturallyEligible
                    ? "This candidate meets the eligibility criteria, but the Handover Sheet search only shows them for dates matching their passed-test date rules (see \"Passed on\" notes below). If they're not showing up when building a sheet for a specific date, approve them for that date here."
                    : "Force this candidate onto the Handover Sheet without a passed test/quiz."}
                  {" "}This is recorded separately from real test attempts and can be revoked later.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={overrideScope === "all" ? "default" : "outline"}
                    className="h-7 text-xs px-2.5"
                    onClick={() => onOverrideScopeChange("all")}
                  >
                    All Dates
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={overrideScope === "date" ? "default" : "outline"}
                    className="h-7 text-xs px-2.5"
                    onClick={() => onOverrideScopeChange("date")}
                  >
                    Specific Date
                  </Button>
                  {overrideScope === "date" && (
                    <Input
                      type="date"
                      value={overrideForDate}
                      onChange={(e) => onOverrideForDateChange(e.target.value)}
                      className="h-7 text-xs w-40 bg-white"
                    />
                  )}
                </div>
                <Textarea
                  placeholder="Reason for override (optional, but recommended for audit)"
                  value={overrideReason}
                  onChange={(e) => onOverrideReasonChange(e.target.value)}
                  className="text-xs bg-white"
                  rows={2}
                />
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs px-3 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={onBypass}
                  disabled={actionLoading}
                >
                  {actionLoading ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" /> : <IconShieldLock className="h-3.5 w-3.5" />}
                  {report.naturallyEligible ? "Approve for Handover Sheet" : "Force Handover Eligibility"}
                </Button>
              </div>
            )}

            {/* Eligibility Papers */}
            {report.eligibilityPapers?.length > 0 && (
              <RequirementList title="Configured Eligibility Papers" items={report.eligibilityPapers} />
            )}

            {/* Interview Papers */}
            {report.interviewPapers?.length > 0 && (
              <RequirementList title="Configured Interview Papers" items={report.interviewPapers} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const DATE_RULE_NOTES = {
  EXACT_DATE: "Only appears in Handover Sheet search for this exact date",
  ON_OR_AFTER: "Appears in Handover Sheet search for this date or any later date",
  INFORMATIONAL: "Not date-gated — used only to prefill the Interview column",
};

const RequirementList = ({ title, items }) => (
  <div className="space-y-1.5">
    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
    <div className="border rounded-lg divide-y overflow-hidden">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 bg-white">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{item.title}</p>
            <p className="text-[10px] text-slate-400">{item.label} &middot; {item.type}</p>
            {item.passed && item.passedDate && (
              <p className="text-[10px] text-blue-600 mt-0.5">
                Passed on {displayDate(item.passedDate)}
                {DATE_RULE_NOTES[item.dateRule] && <span className="text-slate-400"> — {DATE_RULE_NOTES[item.dateRule]}</span>}
              </p>
            )}
          </div>
          <RequirementStatusBadge status={item.status} />
        </div>
      ))}
    </div>
  </div>
);

const RequirementStatusBadge = ({ status }) => {
  const map = {
    PASSED: { label: "Passed", cls: "bg-green-100 text-green-700 border-green-200" },
    FAILED: { label: "Failed", cls: "bg-red-100 text-red-700 border-red-200" },
    PENDING: { label: "Pending", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  };
  const cfg = map[status] || map.PENDING;
  return (
    <div className="flex flex-col items-end gap-0.5 shrink-0">
      <Badge variant="outline" className={`text-[10px] px-2 py-0 h-5 ${cfg.cls}`}>{cfg.label}</Badge>
      {status === "PENDING" && <span className="text-[9px] text-slate-400 leading-none">No attempts made yet</span>}
    </div>
  );
};

const HandoverStatusBadge = ({ status, actionBy }) => {
  if (!status) return <span className="text-slate-400 text-xs">Pending</span>;
  const map = {
    approved: { label: "Approved", cls: "bg-green-100 text-green-700 border-green-200" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-700 border-red-200" },
  };
  const cfg = map[status.toLowerCase()] || { label: status, cls: "bg-slate-100 text-slate-600" };
  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${cfg.cls}`}>{cfg.label}</Badge>
      {actionBy && <span className="text-[9px] text-slate-400 leading-none">{actionBy}</span>}
    </div>
  );
};

const InfoItem = ({ label, icon: Icon, value, highlight }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{label}</label>
    <div className={`flex items-center gap-2 text-sm ${highlight ? "font-bold text-indigo-700" : "font-medium text-slate-700"}`}>
      {Icon && <Icon className="h-4 w-4 text-blue-500 opacity-70" />}
      <span>{value || "—"}</span>
    </div>
  </div>
);

const ProfileField = ({ label, value }) => (
  <div className="group">
    <p className="text-[10px] text-muted-foreground mb-0.5 font-bold uppercase tracking-tight">{label}</p>
    <p className="text-sm font-semibold text-slate-800">{value || "—"}</p>
  </div>
);

const TimelineItem = ({ label, value, icon: Icon, color }) => {
  const colors = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700"
  };
  return (
    <div className="flex items-start gap-3">
      <div className={`${colors[color]} p-1.5 rounded`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="text-[9px] uppercase font-bold text-muted-foreground leading-none mb-1">{label}</p>
        <p className="text-xs font-bold">{value || "—"}</p>
      </div>
    </div>
  );
};

const AttemptTypeBadge = ({ quiz }) => {
  if (!quiz) return <span className="text-slate-400 text-xs">—</span>;
  if (quiz.isDojo) return <Badge className="text-[9px] px-1.5 py-0 h-4 bg-purple-100 text-purple-700 border-purple-200" variant="outline">Dojo</Badge>;
  if (quiz.isHandover) return <Badge className="text-[9px] px-1.5 py-0 h-4 bg-orange-100 text-orange-700 border-orange-200" variant="outline">Handover</Badge>;
  if (quiz.isTheoretical) return <Badge className="text-[9px] px-1.5 py-0 h-4 bg-sky-100 text-sky-700 border-sky-200" variant="outline">Theory</Badge>;
  return <Badge className="text-[9px] px-1.5 py-0 h-4 bg-slate-100 text-slate-600" variant="outline">Standard</Badge>;
};

const DeploymentChip = ({ label, value, highlight }) => (
  <div className={`flex flex-col px-3 py-1.5 rounded-lg border shadow-sm ${highlight ? "bg-blue-50 border-blue-200 ring-1 ring-blue-100" : "bg-white border-slate-100"}`}>
    <span className="text-[8px] uppercase font-black text-slate-400 tracking-tighter leading-none mb-1">{label}</span>
    <span className={`text-xs font-bold ${highlight ? "text-blue-700" : "text-slate-700"}`}>{value || "—"}</span>
  </div>
);

const DetailSkeleton = ({ navigate }) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <div className="flex gap-4 items-center">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-40" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-64 md:col-span-2 rounded-xl" />
    </div>
  </div>
);

const NotFound = ({ navigate }) => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
    <IconUser className="h-12 w-12 text-slate-300" />
    <h2 className="text-2xl font-bold text-slate-800">Candidate Not Found</h2>
    <p className="text-slate-500 max-w-sm">The record you are looking for might have been deleted or the ID is incorrect.</p>
    <Button onClick={() => navigate("/admin/dojo-hiring")}>Return to Hiring List</Button>
  </div>
);

export default DojoCandidateDetail;
