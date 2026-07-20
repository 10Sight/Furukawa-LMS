import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGetUserByIdQuery } from "@/Redux/AllApi/UserApi";
import { useGetMentorMenteesQuery } from "@/Redux/AllApi/InstructorApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  IconMail,
  IconPhone,
  IconRefresh,
  IconUsers,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { getMediaUrl } from "@/utils/mediaUtils";

const MentorDetail = () => {
  const { mentorId } = useParams();
  const navigate = useNavigate();

  const {
    data: mentorRes,
    isLoading: mentorLoading,
    error: mentorError,
  } = useGetUserByIdQuery(mentorId, { skip: !mentorId });

  const {
    data: menteesRes,
    isLoading: menteesLoading,
    isFetching: menteesFetching,
    refetch: refetchMentees,
  } = useGetMentorMenteesQuery(mentorId, { skip: !mentorId });

  const mentor = mentorRes?.data;
  const mentees = menteesRes?.data?.mentees || [];
  const assignedCount = menteesRes?.data?.assignedCount || 0;
  const mentorLimit = mentor?.mentorLimit ?? 0;
  const atLimit = mentorLimit > 0 && assignedCount >= mentorLimit;

  if (mentorLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (mentorError || !mentor) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <p className="text-gray-500">Mentor not found.</p>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <IconArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <IconArrowLeft className="w-4 h-4 mr-2" />
          Back to Mentors
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetchMentees()}
          disabled={menteesFetching}
        >
          <IconRefresh className={`w-4 h-4 ${menteesFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={getMediaUrl(mentor.avatar?.url)} alt={mentor.fullName} />
              <AvatarFallback className="text-lg">{mentor.fullName?.[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <h1 className="text-2xl font-bold">{mentor.fullName}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                {mentor.empId && <span>Emp Code: {mentor.empId}</span>}
                {mentor.designation && <span>&middot; {mentor.designation}</span>}
                {mentor.department?.name && <span>&middot; {mentor.department.name}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 pt-1">
                {mentor.email && (
                  <span className="flex items-center gap-1">
                    <IconMail className="w-3.5 h-3.5" /> {mentor.email}
                  </span>
                )}
                {mentor.phoneNumber && (
                  <span className="flex items-center gap-1">
                    <IconPhone className="w-3.5 h-3.5" /> {mentor.phoneNumber}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2">
              <Badge variant={atLimit ? "destructive" : "success"} className="text-sm px-3 py-1">
                <IconUsers className="w-3.5 h-3.5 mr-1" />
                Assigned {assignedCount} / {mentorLimit || "∞"}
              </Badge>
              <Badge variant={mentor.status === "PRESENT" ? "success" : "secondary"}>
                {mentor.status || "PRESENT"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Assigned Mentees ({mentees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mentee</TableHead>
                <TableHead>Emp Code</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Process</TableHead>
                <TableHead>Marks</TableHead>
                <TableHead>Interview 1</TableHead>
                <TableHead>Interview 2</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Handover</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {menteesLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-gray-500">
                    Loading mentees...
                  </TableCell>
                </TableRow>
              ) : mentees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-gray-500">
                    No mentees assigned to this mentor yet.
                  </TableCell>
                </TableRow>
              ) : (
                mentees.map((mentee) => (
                  <TableRow
                    key={mentee.studentId}
                    className={mentee.studentId ? "cursor-pointer hover:bg-muted/30" : ""}
                    onClick={() => mentee.studentId && navigate(`/admin/employees/${mentee.studentId}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-7 h-7">
                          <AvatarImage src={getMediaUrl(mentee.avatar?.url)} />
                          <AvatarFallback>{mentee.employeeName?.[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{mentee.employeeName || "N/A"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{mentee.empId || "N/A"}</TableCell>
                    <TableCell>{mentee.department || "N/A"}</TableCell>
                    <TableCell>{mentee.section || "N/A"}</TableCell>
                    <TableCell>{mentee.process || "-"}</TableCell>
                    <TableCell>{mentee.marks || "-"}</TableCell>
                    <TableCell>{mentee.interview1 || "-"}</TableCell>
                    <TableCell>{mentee.interview2 || "-"}</TableCell>
                    <TableCell>
                      {mentee.status ? (
                        <Badge variant={mentee.status === "PRESENT" ? "success" : "secondary"}>
                          {mentee.status}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {mentee.sheetDate ? format(new Date(mentee.sheetDate), "dd MMM yyyy") : "-"}
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

export default MentorDetail;
