import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { useGetInstructorByIdQuery, useUpdateInstructorMutation } from "@/Redux/AllApi/InstructorApi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { IconArrowLeft, IconLoader } from "@tabler/icons-react";
import { toast } from "sonner";

// Import components
import InstructorDetailHeader from "@/components/instructor/InstructorDetailHeader";
import InstructorStats from "@/components/instructor/InstructorStats";
import InstructorCourses from "@/components/instructor/InstructorCourses";
import InstructorDepartments from "@/components/instructor/InstructorDepartments";

// Import Edit Dialog Component (to be created)
import EditInstructorDialog from "@/components/instructor/EditInstructorDialog";

const InstructorDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data, isLoading, error, refetch } = useGetInstructorByIdQuery(id);
  const [updateInstructor, { isLoading: isUpdating }] = useUpdateInstructorMutation();

  const instructor = data?.data || {};

  useEffect(() => {
    if (error) {
      toast.error("Failed to load instructor details");
    }
  }, [error]);

  const handleUpdateInstructor = async (updateData) => {
    try {
      await updateInstructor({
        id: instructor._id,
        ...updateData
      }).unwrap();

      toast.success("Instructor updated successfully");
      setIsEditDialogOpen(false);
      refetch();
    } catch (error) {
      console.error("Update error:", error);
      toast.error(error?.data?.message || "Failed to update instructor");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => navigate(-1)} className="mb-4">
          <IconArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="grid gap-6">
          {/* Header Skeleton */}
          <Card>
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-32"></div>
            <CardContent className="relative pt-0">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between -mt-16">
                <div className="flex flex-col md:flex-row items-center md:items-end gap-4">
                  <Skeleton className="h-24 w-24 rounded-full" />
                  <div className="text-center md:text-left mb-4 md:mb-6 space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-12" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabs Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-red-600 text-lg font-medium">
          Error loading instructor
        </div>
        <p className="text-muted-foreground text-center">
          {error?.data?.message || "Failed to fetch instructor details"}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <IconArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
          <Button onClick={() => refetch()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Mock stats data - you would replace this with actual API calls
  const statsData = {
    coursesCount: 5, // This would come from courses API filtered by instructor
    departmentsCount: 3, // This would come from departments API filtered by instructor
    studentsCount: 45, // This would be calculated from all departments
    averageRating: 4.7 // This would come from reviews/ratings API
  };

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => navigate(-1)}>
        <IconArrowLeft className="h-4 w-4 mr-2" />
        Back to Instructors
      </Button>

      <InstructorDetailHeader
        instructor={instructor}
        onEdit={() => setIsEditDialogOpen(true)}
      />

      {/* <InstructorStats stats={statsData} /> */}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
              <CardDescription>
                Instructor information and bio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Full Name</h4>
                  <p>{instructor.fullName}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Username</h4>
                  <p>@{instructor.userName}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Email</h4>
                  <p>{instructor.email}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Phone</h4>
                  <p>{instructor.phoneNumber}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Status</h4>
                  <p>{instructor.status}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Member Since</h4>
                  <p>{new Date(instructor.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {instructor.bio && (
                <div className="mt-6">
                  <h4 className="font-medium text-sm text-muted-foreground">Bio</h4>
                  <p className="mt-2">{instructor.bio}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="departments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sections</CardTitle>
              <CardDescription>
                Sections assigned to this instructor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InstructorDepartments instructorId={instructor._id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Instructor Dialog */}
      <EditInstructorDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        instructor={instructor}
        onSave={handleUpdateInstructor}
        isLoading={isUpdating}
      />
    </div>
  );
};

export default InstructorDetail;