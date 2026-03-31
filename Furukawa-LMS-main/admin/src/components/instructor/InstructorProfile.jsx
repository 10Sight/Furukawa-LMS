// components/InstructorProfile.jsx
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconMail, IconPhone, IconCalendar, IconSchool } from "@tabler/icons-react";

const InstructorProfile = ({ instructor }) => {
  const getStatusBadge = (status) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge variant="success" className="flex items-center gap-1 w-fit">
            <div className="h-2 w-2 rounded-full bg-green-500"></div> Active
          </Badge>
        );
      case "SUSPENDED":
        return (
          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
            <div className="h-2 w-2 rounded-full bg-red-500"></div> Suspended
          </Badge>
        );
      case "PENDING":
        return (
          <Badge variant="warning" className="flex items-center gap-1 w-fit">
            <div className="h-2 w-2 rounded-full bg-amber-500"></div> Pending
          </Badge>
        );
      case "BANNED":
        return (
          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
            <div className="h-2 w-2 rounded-full bg-red-700"></div> Banned
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
            <div className="h-2 w-2 rounded-full bg-gray-500"></div> {status}
          </Badge>
        );
    }
  };

  const getDepartmentInfo = (instructor) => {
    if (!instructor.department && (!instructor.departments || instructor.departments.length === 0)) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          No Section Assigned
        </Badge>
      );
    }

    // Handle single department or multiple
    const departments = instructor.departments || (instructor.department ? [instructor.department] : []);

    return (
      <div className="flex flex-wrap gap-1">
        {departments.map((dept, idx) => {
          const deptName = dept?.name || dept;
          return (
            <Badge key={idx} variant="info" className="flex items-center gap-1">
              <IconSchool className="h-3 w-3" />
              {deptName}
            </Badge>
          )
        })}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Full Name</p>
              <p className="font-medium">{instructor.fullName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Username</p>
              <p className="font-medium">@{instructor.userName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <div className="flex items-center gap-2">
                <IconMail className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">{instructor.email}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Phone</p>
              <div className="flex items-center gap-2">
                <IconPhone className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">{instructor.phoneNumber || "Not provided"}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              {getStatusBadge(instructor.status)}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Department</p>
              {getDepartmentInfo(instructor)}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Member Since</p>
              <div className="flex items-center gap-2">
                <IconCalendar className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">
                  {new Date(instructor.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
              <div className="flex items-center gap-2">
                <IconCalendar className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">
                  {new Date(instructor.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">User ID</p>
            <p className="font-mono text-sm break-all">{instructor._id}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Role</p>
            <Badge variant="outline" className="capitalize">
              {instructor.role?.toLowerCase()}
            </Badge>
          </div>
          {instructor.bio && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Bio</p>
              <p className="text-sm">{instructor.bio}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InstructorProfile;