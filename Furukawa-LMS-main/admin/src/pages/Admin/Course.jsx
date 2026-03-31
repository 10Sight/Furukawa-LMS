import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  useGetCoursesQuery,
  useDeleteCourseMutation,
  useTogglePublishCourseMutation,
  useUpdateCourseMutation,
} from "@/Redux/AllApi/CourseApi";
import { useLazyExportCoursesQuery } from "@/Redux/AllApi/CourseApi";
import {
  useGetActiveConfigQuery
} from "@/Redux/AllApi/CourseLevelConfigApi";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconBook,
  IconSchool,
  IconSearch,
  IconFilter,
  IconX,
  IconLoader,
  IconRefresh,
  IconInfoCircle,
  IconEye,
  IconEyeOff,
  IconCalendar,
  IconUsers,
  IconFileText,
  IconChartBar,
  IconExternalLink,
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

// Import reusable components
import SearchInput from "@/components/common/SearchInput";
import FilterSelect from "@/components/common/FilterSelect";
import StatCard from "@/components/common/StatCard";
import FilterBar from "@/components/common/FilterBar";

const Course = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastToastId, setLastToastId] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    difficulty: "BEGINNER",
    status: "DRAFT",
  });
  const [formErrors, setFormErrors] = useState({});
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState("all");

  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // API Hooks
  const {
    data: coursesData,
    isLoading,
    error: coursesError,
    refetch,
  } = useGetCoursesQuery(
    {
      page: currentPage,
      limit: 10,
      search: debouncedSearchTerm || "",
      category: categoryFilter !== "ALL" ? categoryFilter : "",
      status: statusFilter !== "ALL" ? statusFilter : "",
    },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: false,
      refetchOnReconnect: false,
    }
  );

  const [updateCourse] = useUpdateCourseMutation();
  const [deleteCourse] = useDeleteCourseMutation();
  const [togglePublish] = useTogglePublishCourseMutation();
  const [triggerExportCourses, { isFetching: isExportingCourses }] = useLazyExportCoursesQuery();
  const { data: configData, isLoading: isConfigLoading } = useGetActiveConfigQuery();
  const activeLevels = configData?.data?.levels || [];

  const courses = coursesData?.data?.courses || [];
  const totalPages = coursesData?.data?.totalPages || 1;
  const totalCount = coursesData?.data?.total || 0;

  // Extract unique categories for filter
  const categories = useMemo(() => {
    const uniqueCategories = [
      ...new Set(courses.map((course) => course.category)),
    ];
    return ["ALL", ...uniqueCategories].filter(Boolean);
  }, [courses]);

  // Filter options for reusable components
  const statusOptions = [
    { value: "ALL", label: "All Status" },
    { value: "PUBLISHED", label: "Published" },
    { value: "DRAFT", label: "Draft" },
    { value: "ARCHIVED", label: "Archived" },
  ];

  const categoryOptions = useMemo(() => {
    const categoryOpts = categories
      .filter((cat) => cat !== "ALL")
      .map((category) => ({ value: category, label: category }));
    return [{ value: "ALL", label: "All Categories" }, ...categoryOpts];
  }, [categories]);

  // Active filters for FilterBar
  const activeFilters = useMemo(() => {
    const filters = [];

    if (statusFilter !== "ALL") {
      const statusLabel = statusOptions.find(
        (opt) => opt.value === statusFilter
      )?.label;
      filters.push({ label: "Status", value: statusLabel });
    }

    if (categoryFilter !== "ALL") {
      filters.push({ label: "Category", value: categoryFilter });
    }

    if (searchTerm) {
      filters.push({ label: "Search", value: searchTerm });
    }

    return filters;
  }, [statusFilter, categoryFilter, searchTerm, statusOptions]);

  // Toast helpers
  const showToast = useCallback(
    (type, message) => {
      if (lastToastId) toast.dismiss(lastToastId);
      const toastId =
        type === "success"
          ? toast.success(message)
          : type === "error"
            ? toast.error(message)
            : toast(message);
      setLastToastId(toastId);
    },
    [lastToastId]
  );

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "",
      difficulty: "BEGINNER",
      status: "DRAFT",
    });
    setFormErrors({});
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.title?.trim()) errors.title = "Title is required";
    if (!formData.description?.trim())
      errors.description = "Description is required";
    if (!formData.category?.trim()) errors.category = "Category is required";
    return errors;
  };

  const handleUpdateCourse = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast("error", "Please fix the form errors");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateCourse({
        id: selectedCourse._id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category.trim(),
        difficulty: formData.difficulty,
        status: formData.status,
      }).unwrap();

      showToast("success", "Course updated successfully!");
      setIsEditDialogOpen(false);
      resetForm();
      setSelectedCourse(null);
      refetch();
    } catch (error) {
      console.error("Update course error:", error);
      const errorMessage = error?.data?.message || "Failed to update course";
      showToast("error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCourse = async () => {
    try {
      await deleteCourse(selectedCourse._id).unwrap();
      showToast("success", "Course deleted successfully!");
      setIsDeleteDialogOpen(false);
      setSelectedCourse(null);
      refetch();
    } catch (error) {
      console.error("Delete course error:", error);
      const errorMessage = error?.data?.message || "Failed to delete course";
      showToast("error", errorMessage);
    }
  };

  const handleTogglePublishStatus = async (courseId, currentStatus) => {
    try {
      await togglePublish(courseId).unwrap();
      showToast(
        "success",
        `Course ${currentStatus === "PUBLISHED" ? "unpublished" : "published"
        } successfully!`
      );
      refetch();
    } catch (error) {
      console.error("Toggle publish error:", error);
      const errorMessage =
        error?.data?.message || "Failed to update course status";
      showToast("error", errorMessage);
    }
  };

  const openEditDialog = (course) => {
    setSelectedCourse(course);
    setFormData({
      title: course.title,
      description: course.description,
      category: course.category,
      difficulty: course.difficulty,
      status: course.status,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (course) => {
    setSelectedCourse(course);
    setIsDeleteDialogOpen(true);
  };

  const handleCourseClick = (course) => {
    const handle = course.slug || course._id;
    navigate(`${handle}`);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      PUBLISHED: { variant: "success", label: "Published", icon: IconEye },
      DRAFT: { variant: "secondary", label: "Draft", icon: IconEyeOff },
      ARCHIVED: { variant: "destructive", label: "Archived", icon: IconX },
    };

    const config = statusConfig[status] || {
      variant: "secondary",
      label: status,
      icon: IconInfoCircle,
    };
    const IconComponent = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <IconComponent className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getDifficultyBadge = (difficulty) => {
    if (!difficulty) return <Badge variant="outline">Unknown</Badge>;

    // Try to find matching level in active config
    const matchedLevel = activeLevels.find(l => l.name?.toUpperCase() === difficulty?.toUpperCase());

    if (matchedLevel) {
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

    const difficultyConfig = {
      BEGINNER: { variant: "success", label: "Beginner" },
      INTERMEDIATE: { variant: "warning", label: "Intermediate" },
      ADVANCED: { variant: "destructive", label: "Advanced" },
    };

    const config = difficultyConfig[difficulty?.toUpperCase()] || {
      variant: "secondary",
      label: difficulty,
    };

    return (
      <Badge variant={config.variant} className="w-fit">
        {config.label}
      </Badge>
    );
  };

  const clearFilters = () => {
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setSearchTerm("");
    setActiveTab("all");
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Stats Skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter Skeletons */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <Skeleton className="h-10 w-80" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Table Skeleton */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <TableHead key={i}>
                      <Skeleton className="h-4 w-20" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map((row) => (
                  <TableRow key={row}>
                    {[1, 2, 3, 4, 5, 6].map((cell) => (
                      <TableCell key={cell}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (coursesError) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4 p-4">
        <div className="text-red-600 text-lg font-medium">
          Error loading courses
        </div>
        <p className="text-gray-600 text-center">
          {coursesError?.message || "Failed to fetch courses"}
        </p>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <IconRefresh className="h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with Stats using reusable StatCard components */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Total Courses"
          value={totalCount}
          description="All courses in the system"
          icon={IconBook}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
          gradientFrom="from-blue-50"
          gradientTo="to-blue-100"
          borderColor="border-blue-200"
          textColor="text-blue-800"
          valueColor="text-blue-900"
        />

        <StatCard
          title="Published"
          value={courses.filter((c) => c.status === "PUBLISHED").length}
          description="Currently published"
          icon={IconEye}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
          gradientFrom="from-green-50"
          gradientTo="to-green-100"
          borderColor="border-green-200"
          textColor="text-green-800"
          valueColor="text-green-900"
        />

        <StatCard
          title="Total Modules"
          value={courses.reduce(
            (total, course) => total + (course.modules?.length || 0),
            0
          )}
          description="Learning materials"
          icon={IconFileText}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
          gradientFrom="from-purple-50"
          gradientTo="to-purple-100"
          borderColor="border-purple-200"
          textColor="text-purple-800"
          valueColor="text-purple-900"
        />
      </div>

      {/* Tabs for filtering */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row justify-between items-stretch sm:items-center gap-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto">
            <TabsTrigger value="all" onClick={() => clearFilters()} className="text-xs sm:text-sm">
              All
            </TabsTrigger>
            <TabsTrigger
              value="published"
              onClick={() => setStatusFilter("PUBLISHED")}
              className="text-xs sm:text-sm"
            >
              Published
            </TabsTrigger>
            <TabsTrigger value="draft" onClick={() => setStatusFilter("DRAFT")} className="text-xs sm:text-sm">
              Draft
            </TabsTrigger>
            <TabsTrigger
              value="archived"
              onClick={() => setStatusFilter("ARCHIVED")}
              className="text-xs sm:text-sm"
            >
              Archived
            </TabsTrigger>
          </TabsList>

          <Button
            onClick={() => navigate("/admin/add-course")}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-auto"
          >
            <IconPlus className="h-4 w-4 mr-2" />
            <span className="hidden xs:inline">Add Course</span>
            <span className="xs:hidden">Add</span>
          </Button>
        </div>
      </Tabs>

      {/* Search and Filters using reusable components */}
      <Card className="shadow-sm border border-gray-200/50">
        <CardHeader className="pb-3 px-4 sm:px-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row justify-between items-stretch sm:items-center gap-4">
            <SearchInput
              placeholder="Search courses..."
              value={searchTerm}
              onChange={setSearchTerm}
              className="w-full sm:w-80 lg:w-96"
            />

            <div className="flex flex-col xs:flex-row gap-2">
              <div className="grid grid-cols-2 xs:flex gap-2">
                <FilterSelect
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  options={statusOptions}
                  placeholder="Status"
                  icon={IconFilter}
                  className="min-w-0"
                />

                <FilterSelect
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                  options={categoryOptions}
                  placeholder="Category"
                  icon={IconChartBar}
                  className="min-w-0 xs:w-[140px]"
                />
              </div>

              {(statusFilter !== "ALL" ||
                categoryFilter !== "ALL" ||
                searchTerm) && (
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="gap-1 w-full xs:w-auto"
                    size="sm"
                  >
                    <IconX className="h-4 w-4" />
                    <span className="hidden xs:inline">Clear</span>
                    <span className="xs:hidden">Clear Filters</span>
                  </Button>
                )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isExportingCourses}
                onClick={async () => {
                  try {
                    const { data } = await triggerExportCourses({
                      format: 'excel',
                      category: categoryFilter !== 'ALL' ? categoryFilter : '',
                      status: statusFilter !== 'ALL' ? statusFilter : '',
                      search: debouncedSearchTerm || ''
                    });
                    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `courses_${new Date().toISOString().slice(0, 10)}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                  } catch { }
                }}
              >
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isExportingCourses}
                onClick={async () => {
                  try {
                    const { data } = await triggerExportCourses({
                      format: 'pdf',
                      category: categoryFilter !== 'ALL' ? categoryFilter : '',
                      status: statusFilter !== 'ALL' ? statusFilter : '',
                      search: debouncedSearchTerm || ''
                    });
                    const blob = new Blob([data], { type: 'application/pdf' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `courses_${new Date().toISOString().slice(0, 10)}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                  } catch { }
                }}
              >
                Export PDF
              </Button>
            </div>
          </div>

          {/* Filter bar showing active filters */}
          <FilterBar
            filters={activeFilters}
            onClearFilters={clearFilters}
            className="mt-3"
          />
        </CardHeader>

        <CardContent className="p-0">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[250px]">Course</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.length > 0 ? (
                  courses.map((course) => (
                    <TableRow
                      key={course._id}
                      className="group hover:bg-muted/30 cursor-pointer"
                      onClick={() => handleCourseClick(course)}
                    >
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10 border bg-blue-100">
                            <AvatarFallback className="bg-blue-100 text-blue-800">
                              <IconBook className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground line-clamp-1">
                                {course.title}
                              </p>
                              <IconExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {course.description}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{course.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {getDifficultyBadge(course.difficulty)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={course.status}
                          onValueChange={(newStatus) =>
                            handleTogglePublishStatus(course._id, course.status)
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            {getStatusBadge(course.status)}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PUBLISHED">Published</SelectItem>
                            <SelectItem value="DRAFT">Draft</SelectItem>
                            <SelectItem value="ARCHIVED">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditDialog(course);
                                  }}
                                  className="h-8 w-8 p-0"
                                >
                                  <IconPencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit course</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDeleteDialog(course);
                                  }}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                                >
                                  <IconTrash className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete course</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      <div className="flex flex-col items-center space-y-3">
                        <IconBook className="h-12 w-12 text-muted-foreground/60" />
                        <p className="text-muted-foreground font-medium">
                          No courses found
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {searchTerm ||
                            statusFilter !== "ALL" ||
                            categoryFilter !== "ALL"
                            ? "Try adjusting your search or filters"
                            : "Add your first course to get started"}
                        </p>
                        {(searchTerm ||
                          statusFilter !== "ALL" ||
                          categoryFilter !== "ALL") && (
                            <Button
                              variant="outline"
                              onClick={clearFilters}
                              className="mt-2"
                            >
                              Clear filters
                            </Button>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3 p-4">
            {courses.length > 0 ? (
              courses.map((course) => (
                <Card
                  key={course._id}
                  className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] border border-gray-200/50"
                  onClick={() => handleCourseClick(course)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Avatar className="h-12 w-12 border bg-blue-100 flex-shrink-0">
                        <AvatarFallback className="bg-blue-100 text-blue-800">
                          <IconBook className="h-6 w-6" />
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-foreground line-clamp-1 group-hover:text-blue-600 transition-colors">
                              {course.title}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {course.description}
                            </p>
                          </div>
                          <IconExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {course.category}
                          </Badge>
                          {getDifficultyBadge(course.difficulty)}
                          {getStatusBadge(course.status)}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            <Select
                              value={course.status}
                              onValueChange={(newStatus) =>
                                handleTogglePublishStatus(course._id, course.status)
                              }
                              onClick={(e) => e.stopPropagation()}
                            >
                              <SelectTrigger className="w-[120px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PUBLISHED">Published</SelectItem>
                                <SelectItem value="DRAFT">Draft</SelectItem>
                                <SelectItem value="ARCHIVED">Archived</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(course);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <IconPencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteDialog(course);
                              }}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                            >
                              <IconTrash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-12">
                <IconBook className="h-16 w-16 text-muted-foreground/60 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  No courses found
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm ||
                    statusFilter !== "ALL" ||
                    categoryFilter !== "ALL"
                    ? "Try adjusting your search or filters"
                    : "Add your first course to get started"}
                </p>
                {(searchTerm ||
                  statusFilter !== "ALL" ||
                  categoryFilter !== "ALL") && (
                    <Button
                      variant="outline"
                      onClick={clearFilters}
                      className="mt-2"
                    >
                      Clear filters
                    </Button>
                  )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Showing {courses.length} of {totalCount} courses
          </p>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </Button>
            <div className="flex items-center justify-center px-4 text-sm">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Edit Course Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconPencil className="h-5 w-5" />
              Edit Course
            </DialogTitle>
            <DialogDescription>
              Update course information. All fields are required.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Course Title</Label>
              <Input
                id="edit-title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter course title"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter course description"
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-category">Category</Label>
              <Input
                id="edit-category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                placeholder="Enter course category"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-difficulty">Difficulty Level</Label>
              <Select
                value={formData.difficulty}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, difficulty: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  {isConfigLoading ? (
                    <SelectItem value="LOADING" disabled>Loading levels...</SelectItem>
                  ) : activeLevels.length > 0 ? (
                    activeLevels.map((level) => (
                      <SelectItem key={level.name} value={level.name}>
                        {level.name}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="BEGINNER">Beginner</SelectItem>
                      <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                      <SelectItem value="ADVANCED">Advanced</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                resetForm();
                setSelectedCourse(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateCourse}
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting && <IconLoader className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Updating..." : "Update Course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <IconTrash className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <DialogTitle className="text-red-800">
                  Delete Course
                </DialogTitle>
                <DialogDescription>
                  This action is permanent and cannot be undone
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 bg-red-50 rounded-lg border border-red-200 mb-4">
              <p className="text-sm text-red-800 font-medium mb-2">
                You are about to delete the following course:
              </p>

              <div className="bg-white p-3 rounded-md border border-red-100">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 border bg-blue-100 flex-shrink-0">
                    <AvatarFallback className="bg-blue-100 text-blue-800">
                      <IconBook className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground truncate">
                      {selectedCourse?.title}
                    </h4>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="outline">
                        {selectedCourse?.category}
                      </Badge>
                      {getDifficultyBadge(selectedCourse?.difficulty)}
                      {getStatusBadge(selectedCourse?.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {selectedCourse?.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-100 rounded-md">
              <p className="text-sm font-medium text-slate-800 flex items-center gap-2">
                <IconInfoCircle className="h-4 w-4" />
                To confirm deletion, type the course title below
              </p>
              <Input
                id="confirm-delete"
                placeholder={`Type "${selectedCourse?.title}" to confirm`}
                className="mt-2"
                onChange={(e) => setDeleteConfirmation(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setSelectedCourse(null);
                setDeleteConfirmation("");
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCourse}
              disabled={deleteConfirmation !== selectedCourse?.title}
              className="w-full sm:w-auto gap-2"
            >
              <IconTrash className="h-4 w-4" />
              Delete Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Course;