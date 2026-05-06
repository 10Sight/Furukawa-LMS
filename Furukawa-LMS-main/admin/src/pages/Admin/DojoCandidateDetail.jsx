import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGetUserByIdQuery, useUpdateUserMutation, useDeleteUserMutation } from "@/Redux/AllApi/UserApi";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  IconArrowLeft, IconUser, IconMail, IconPhone, IconBuilding, 
  IconLayout, IconGitBranch, IconGitCommit, IconSettings, 
  IconCalendar, IconId, IconTrash, IconEdit, IconCheck,
  IconUserPlus, IconRefresh, IconChevronRight, IconFileText, IconChartBar
} from "@tabler/icons-react";
import { toast } from "sonner";
import { getMediaUrl } from "@/utils/mediaUtils";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, 
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, 
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger 
} from "@/components/ui/alert-dialog";

const DojoCandidateDetail = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  
  const { data: candidateData, isLoading, refetch } = useGetUserByIdQuery(studentId);
  const [updateUser] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();

  const candidate = candidateData?.data;

  const handlePromote = async () => {
    try {
      await updateUser({
        id: studentId,
        isTemporary: false,
        role: "STUDENT", 
        joiningDate: new Date().toISOString().split('T')[0]
      }).unwrap();
      toast.success("Candidate promoted to permanent employee successfully!");
      refetch();
    } catch (error) {
      toast.error(error.data?.message || "Failed to promote candidate");
    }
  };

  const handleDelete = async () => {
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
                <p className="text-muted-foreground">@{candidate.userName}</p>
                <Badge variant={candidate.isTemporary ? "warning" : "success"} className="px-2 py-0 h-5 text-[10px]">
                  {candidate.isTemporary ? "Dojo Candidate" : "Permanent Employee"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
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

          <Button 
            onClick={handlePromote} 
            variant="default"
            size="sm"
            className="gap-2 bg-green-600 hover:bg-green-700 shadow-sm"
            disabled={!candidate.isTemporary}
          >
            <IconUserPlus className="w-4 h-4" />
            {candidate.isTemporary ? "Promote to Employee" : "Already Promoted"}
          </Button>
          
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <IconRefresh className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Primary Details */}
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
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Temporary ID</label>
              <div className="text-sm font-medium flex items-center gap-2">
                <Badge variant="outline" className="bg-white border-blue-200 font-mono text-blue-700">{candidate.empId}</Badge>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Employee Base Code</label>
              <div className="text-sm font-medium flex items-center gap-2">
                <Badge variant="secondary" className="bg-slate-100 font-mono">{candidate.userName}</Badge>
              </div>
            </div>
            <InfoItem label="Designation" value={candidate.designation || "Candidate"} highlight />
          </CardContent>
        </Card>

        {/* Right Column: Detailed Profile */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b bg-slate-50/50">
            <CardTitle className="text-base flex items-center gap-2 font-bold text-slate-700">
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
                  <ProfileField label="Father / Husband" value={candidate.fatherHusbandName} />
                  <ProfileField label="Gender" value={candidate.gender} />
                  <ProfileField label="DOB" value={candidate.dob && new Date(candidate.dob).toLocaleDateString()} />
                  <div className="group">
                    <p className="text-[10px] text-muted-foreground mb-0.5 font-bold uppercase">Qualification</p>
                    <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50/30 text-[10px] py-0 px-2">
                      {candidate.education || "—"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Professional/Placement Column */}
              <div className="md:col-span-1 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-1">Placement</h4>
                <div className="space-y-3">
                  <ProfileField label="Department" value={candidate.deptName || candidate.department?.name} />
                  <ProfileField label="Section" value={candidate.sectionName} />
                  <ProfileField label="Line" value={candidate.lineName} />
                  <ProfileField label="Unit" value={candidate.unit?.replace('_', ' ')} />
                </div>
              </div>

              {/* Address Column */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-1">Location</h4>
                <div className="space-y-3">
                  <ProfileField label="District & State" value={`${candidate.district || ""} ${candidate.state || ""}`.trim() || "—"} />
                  <ProfileField label="PIN Code" value={candidate.pin} />
                  <ProfileField label="Bus Route" value={candidate.busRoute} />
                </div>
              </div>

            </div>

            {/* Hiring Timeline Row */}
            <div className="mt-8 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-lg">
               <TimelineItem label="Registration Date" value={new Date(candidate.createdAt).toLocaleDateString()} icon={IconCalendar} color="blue" />
               <TimelineItem label="Target Joining" value={candidate.joiningDate && new Date(candidate.joiningDate).toLocaleDateString()} icon={IconCalendar} color="green" />
               <TimelineItem label="Hiring Status" value={candidate.isTemporary ? "Assessment Pending" : "Promoted"} icon={IconCheck} color="amber" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deployment Card (Wide) */}
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
