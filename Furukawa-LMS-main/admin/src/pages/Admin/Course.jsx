import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  useGetCoursesQuery,
  useDeleteCourseMutation,
  useUpdateCourseMutation,
} from "@/Redux/AllApi/CourseApi";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
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
  IconCalendar,
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
    difficulty: "THEORETICAL",
    departmentId: [],
    sectionId: [],
  });
  const [formErrors, setFormErrors] = useState({});
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [courseTypeFilter, setCourseTypeFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [sectionFilter, setSectionFilter] = useState("ALL");

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
      level: courseTypeFilter !== "ALL" ? courseTypeFilter : "",
      departmentId: departmentFilter !== "ALL" ? departmentFilter : "",
      sectionId: sectionFilter !== "ALL" ? sectionFilter : "",
    },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: false,
      refetchOnReconnect: false,
    }
  );

  const [updateCourse] = useUpdateCourseMutation();
  const [deleteCourse] = useDeleteCourseMutation();

  // New API Hooks for Edit Dialog
  const { data: departmentsData } = useGetAllDepartmentsQuery();
  const { data: sectionsData } = useGetSectionsByDepartmentQuery(
    Array.isArray(formData.departmentId) ? formData.departmentId.join(',') : "",
    { skip: !formData.departmentId?.length }
  );

  // Sections for the filter row, keyed off the selected Department filter
  const { data: filterSectionsData } = useGetSectionsByDepartmentQuery(
    departmentFilter,
    { skip: departmentFilter === "ALL" }
  );

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
  const categoryOptions = useMemo(() => {
    const categoryOpts = categories
      .filter((cat) => cat !== "ALL")
      .map((category) => ({ value: category, label: category }));
    return [{ value: "ALL", label: "All Categories" }, ...categoryOpts];
  }, [categories]);

  const courseTypeOptions = [
    { value: "ALL", label: "All Types" },
    { value: "THEORETICAL", label: "Theoretical" },
    { value: "PRACTICAL", label: "Practical" },
  ];

  const departmentOptions = useMemo(() => {
    return (departmentsData?.data?.departments || []).map((d) => ({
      value: String(d.id),
      label: d.name,
    }));
  }, [departmentsData]);

  const departmentFilterOptions = useMemo(() => {
    return [{ value: "ALL", label: "All Departments" }, ...departmentOptions];
  }, [departmentOptions]);

  const sectionOptions = useMemo(() => {
    return (sectionsData?.data || []).map((s) => ({
      value: String(s.id),
      label: s.name,
    }));
  }, [sectionsData]);

  const sectionFilterOptions = useMemo(() => {
    const filterSections = (filterSectionsData?.data || []).map((s) => ({
      value: String(s.id),
      label: s.name,
    }));
    return [{ value: "ALL", label: "All Sections" }, ...filterSections];
  }, [filterSectionsData]);

  // Active filters for FilterBar
  const activeFilters = useMemo(() => {
    const filters = [];

    if (categoryFilter !== "ALL") {
      filters.push({ label: "Category", value: categoryFilter });
    }

    if (courseTypeFilter !== "ALL") {
      const typeLabel = courseTypeFilter === "THEORETICAL" ? "Theoretical" : "Practical";
      filters.push({ label: "Course Type", value: typeLabel });
    }

    if (departmentFilter !== "ALL") {
      const departmentLabel = departmentFilterOptions.find(
        (opt) => opt.value === departmentFilter
      )?.label;
      filters.push({ label: "Department", value: departmentLabel });
    }

    if (sectionFilter !== "ALL") {
      const sectionLabel = sectionFilterOptions.find(
        (opt) => opt.value === sectionFilter
      )?.label;
      filters.push({ label: "Section", value: sectionLabel });
    }

    if (searchTerm) {
      filters.push({ label: "Search", value: searchTerm });
    }

    return filters;
  }, [categoryFilter, courseTypeFilter, departmentFilter, sectionFilter, departmentFilterOptions, sectionFilterOptions, searchTerm]);

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
      difficulty: "THEORETICAL",
      departmentId: [],
      sectionId: [],
    });
    setFormErrors({});
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => {
      const newData = { ...prev };
      if (name === "departmentId" || name === "sectionId") {
        const currentValues = Array.isArray(prev[name]) ? prev[name] : [];
        if (currentValues.includes(value)) {
          newData[name] = currentValues.filter((v) => v !== value);
        } else {
          newData[name] = [...currentValues, value];
        }
      } else {
        newData[name] = value;
      }
      return newData;
    });

    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const removeItem = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: (prev[name] || []).filter((v) => v !== value),
    }));
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
        departmentId: formData.departmentId,
        sectionId: formData.sectionId || [],
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

  const openEditDialog = (course) => {
    setSelectedCourse(course);
    setFormData({
      title: course.title,
      description: course.description,
      category: course.category,
      difficulty: course.difficulty,
      departmentId: Array.isArray(course.departmentId) ? course.departmentId.map(String) : (course.departmentId ? [String(course.departmentId)] : []),
      sectionId: Array.isArray(course.sectionId) ? course.sectionId.map(String) : (course.sectionId ? [String(course.sectionId)] : []),
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (course) => {
    setSelectedCourse(course);
    setIsDeleteDialogOpen(true);
  };

  const handleCourseClick = (course) => {
    const handle = course.slug || course._id;
    navigate(`/admin/courses/${handle}`);
  };

  const getCourseTypeBadge = (difficulty) => {
    if (!difficulty) return <Badge variant="outline">Unknown</Badge>;

    const typeConfig = {
      THEORETICAL: {
        className: "bg-teal-100 text-teal-800 hover:bg-teal-100/80 border-teal-200",
        label: "Theoretical",
      },
      PRACTICAL: {
        className: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100/80 border-indigo-200",
        label: "Practical",
      },
    };

    const upperDifficulty = difficulty.toUpperCase();
    if (typeConfig[upperDifficulty]) {
      return (
        <Badge className={typeConfig[upperDifficulty].className}>
          {typeConfig[upperDifficulty].label}
        </Badge>
      );
    }

    // Legacy fallback for courses created before Course Type replaced Difficulty Level
    const legacyConfig = {
      BEGINNER: { variant: "success", label: "Beginner" },
      BEGGINER: { variant: "success", label: "Beginner" },
      INTERMEDIATE: { variant: "warning", label: "Intermediate" },
      ADVANCED: { variant: "destructive", label: "Advanced" },
    };

    const config = legacyConfig[upperDifficulty] || {
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
    setCategoryFilter("ALL");
    setCourseTypeFilter("ALL");
    setDepartmentFilter("ALL");
    setSectionFilter("ALL");
    setSearchTerm("");
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

  const legacyCourseTypeValue =
    formData.difficulty &&
    !["THEORETICAL", "PRACTICAL"].includes(formData.difficulty.toUpperCase())
      ? formData.difficulty
      : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with Stats using reusable StatCard components */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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

      <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <Button
          onClick={() => navigate("/admin/add-course")}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-auto"
        >
          <IconPlus className="h-4 w-4 mr-2" />
          <span className="hidden xs:inline">Add Course</span>
          <span className="xs:hidden">Add</span>
        </Button>
      </div>

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
              <div className="grid grid-cols-2 xs:flex gap-2 flex-wrap">

                <FilterSelect
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                  options={categoryOptions}
                  placeholder="Category"
                  icon={IconChartBar}
                  className="min-w-0 xs:w-[140px]"
                />

                <FilterSelect
                  value={courseTypeFilter}
                  onValueChange={setCourseTypeFilter}
                  options={courseTypeOptions}
                  placeholder="Course Type"
                  icon={IconFilter}
                  className="min-w-0 xs:w-[140px]"
                />

                <FilterSelect
                  value={departmentFilter}
                  onValueChange={(value) => {
                    setDepartmentFilter(value);
                    setSectionFilter("ALL");
                  }}
                  options={departmentFilterOptions}
                  placeholder="Department"
                  icon={IconSchool}
                  className="min-w-0 xs:w-[160px]"
                />

                <FilterSelect
                  value={sectionFilter}
                  onValueChange={setSectionFilter}
                  options={sectionFilterOptions}
                  placeholder="Section"
                  icon={IconSchool}
                  className="min-w-0 xs:w-[160px]"
                  disabled={departmentFilter === "ALL"}
                />
              </div>

              {(categoryFilter !== "ALL" ||
                courseTypeFilter !== "ALL" ||
                departmentFilter !== "ALL" ||
                sectionFilter !== "ALL" ||
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
                  <TableHead>Departments</TableHead>
                  <TableHead>Sections</TableHead>
                  <TableHead>Course Type</TableHead>
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
                      <TableCell className="max-w-[150px]">
                        <div className="flex flex-wrap gap-1">
                          {course.departments && course.departments.length > 0 ? (
                            course.departments.map((dept, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-[10px] py-0 px-1"
                              >
                                {dept}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              {course.department || "N/A"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[150px]">
                        <div className="flex flex-wrap gap-1">
                          {course.sections && course.sections.length > 0 ? (
                            course.sections.map((sec, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-[10px] py-0 px-1 bg-secondary/20"
                              >
                                {sec}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              {course.section || "N/A"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getCourseTypeBadge(course.difficulty)}
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
                    <TableCell colSpan={8} className="text-center py-10">
                      <div className="flex flex-col items-center space-y-3">
                        <IconBook className="h-12 w-12 text-muted-foreground/60" />
                        <p className="text-muted-foreground font-medium">
                          No courses found
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {searchTerm ||
                            categoryFilter !== "ALL" ||
                            courseTypeFilter !== "ALL" ||
                            departmentFilter !== "ALL" ||
                            sectionFilter !== "ALL"
                            ? "Try adjusting your search or filters"
                            : "Add your first course to get started"}
                        </p>
                        {(searchTerm ||
                          categoryFilter !== "ALL" ||
                          courseTypeFilter !== "ALL" ||
                          departmentFilter !== "ALL" ||
                          sectionFilter !== "ALL") && (
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
                          {getCourseTypeBadge(course.difficulty)}
                        </div>

                        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                          <div className="flex items-start gap-1">
                            <IconSchool className="h-3 w-3 mt-0.5" />
                            <div className="flex flex-wrap gap-1">
                              {course.departments && course.departments.length > 0 ? (
                                course.departments.map((d, i) => (
                                  <span key={i} className="bg-muted px-1 rounded">{d}</span>
                                ))
                              ) : (
                                <span>{course.department || "N/A"}</span>
                              )}
                              {course.sections && course.sections.length > 0 && (
                                <>
                                  <span className="mx-1 text-gray-300">|</span>
                                  {course.sections.map((s, i) => (
                                    <span key={i} className="bg-blue-50 text-blue-700 px-1 rounded">{s}</span>
                                  ))}
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end pt-2 border-t border-gray-100">
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
                    categoryFilter !== "ALL" ||
                    courseTypeFilter !== "ALL" ||
                    departmentFilter !== "ALL" ||
                    sectionFilter !== "ALL"
                    ? "Try adjusting your search or filters"
                    : "Add your first course to get started"}
                </p>
                {(searchTerm ||
                  categoryFilter !== "ALL" ||
                  courseTypeFilter !== "ALL" ||
                  departmentFilter !== "ALL" ||
                  sectionFilter !== "ALL") && (
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
              <Label htmlFor="edit-difficulty">Course Type</Label>
              <Select
                value={formData.difficulty}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, difficulty: value }))
                }
              >
                <SelectTrigger id="edit-difficulty">
                  <SelectValue placeholder="Select course type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="THEORETICAL">Theoretical</SelectItem>
                  <SelectItem value="PRACTICAL">Practical</SelectItem>
                  {legacyCourseTypeValue && (
                    <SelectItem value={legacyCourseTypeValue} disabled>
                      {legacyCourseTypeValue.charAt(0) + legacyCourseTypeValue.slice(1).toLowerCase()} (Legacy)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>


            <div className="grid grid-cols-1 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-department">Departments *</Label>
                <Select
                  value=""
                  onValueChange={(value) => handleSelectChange("departmentId", value)}
                >
                  <SelectTrigger id="edit-department">
                    <SelectValue placeholder={formData.departmentId.length > 0
                      ? `${formData.departmentId.length} departments selected`
                      : "Add Department"} />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentOptions
                      .filter(opt => !formData.departmentId.includes(opt.value))
                      .map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1 mt-1">
                  {formData.departmentId.map(id => {
                    const dept = departmentOptions.find(opt => opt.value === id);
                    return (
                      <Badge key={id} variant="secondary" className="flex items-center gap-1">
                        {dept?.label || id}
                        <IconX
                          size={12}
                          className="cursor-pointer hover:text-destructive"
                          onClick={() => removeItem("departmentId", id)}
                        />
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-section">Sections (Optional)</Label>
              <Select
                value=""
                onValueChange={(value) => handleSelectChange("sectionId", value)}
                disabled={!formData.departmentId.length}
              >
                <SelectTrigger id="edit-section">
                  <SelectValue placeholder={formData.sectionId.length > 0
                    ? `${formData.sectionId.length} sections selected`
                    : (formData.departmentId.length ? "Add Section" : "Select departments first")} />
                </SelectTrigger>
                <SelectContent>
                  {sectionOptions
                    .filter(opt => !formData.sectionId.includes(opt.value))
                    .map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1 mt-1">
                {formData.sectionId.map(id => {
                  const sec = sectionOptions.find(opt => opt.value === id);
                  return (
                    <Badge key={id} variant="outline" className="flex items-center gap-1">
                      {sec?.label || id}
                      <IconX
                        size={12}
                        className="cursor-pointer hover:text-destructive"
                        onClick={() => removeItem("sectionId", id)}
                      />
                    </Badge>
                  );
                })}
              </div>
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
                      {getCourseTypeBadge(selectedCourse?.difficulty)}
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