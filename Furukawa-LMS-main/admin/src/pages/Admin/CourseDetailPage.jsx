import React, { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useGetCourseByIdQuery } from "@/Redux/AllApi/CourseApi";
import { useGetModulesByCourseQuery } from "@/Redux/AllApi/moduleApi";
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
} from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

// Import reusable components
import ModuleList from "@/components/course/ModuleList";
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

  const { data: configData } = useGetActiveConfigQuery();


  const course = courseData?.data || {};
  const modules = modulesData?.data || [];

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

  const isLoading = courseLoading || modulesLoading;

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
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
      />

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-3 mb-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="modules">Modules ({modules.length})</TabsTrigger>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Course Title</p>
                  <p className="text-sm font-medium">{course.title}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</p>
                  <Badge variant="secondary" className="font-normal">{course.category}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Difficulty Level</p>
                  {getDifficultyBadge(course.difficulty || "BEGINNER")}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Status</p>
                  {getStatusBadge(course.status)}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trainer</p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px]">
                        {course.instructor?.fullName?.charAt(0) || 'T'}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium">
                      {course.instructor?.fullName || "Not assigned"}
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created Date</p>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <IconCalendar className="h-3.5 w-3.5" />
                    <span>{new Date(course.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                  </div>
                </div>

                <div className="space-y-1 col-span-full md:col-span-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Departments</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {course.departments && course.departments.length > 0 ? (
                      course.departments.map((dept, idx) => (
                        <Badge key={idx} variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-200/50">
                          {dept}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground italic">{course.department || "No department assigned"}</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1 col-span-full md:col-span-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sections</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {course.sections && course.sections.length > 0 ? (
                      course.sections.map((sec, idx) => (
                        <Badge key={idx} variant="outline" className="bg-secondary/20 text-secondary-foreground border-secondary/30">
                          {sec}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground italic">{course.section || "No section assigned"}</span>
                    )}
                  </div>
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

        <TabsContent value="modules">
          <ModuleList
            modules={modules}
            courseId={courseId}
            onRefetch={refetchModules}
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
