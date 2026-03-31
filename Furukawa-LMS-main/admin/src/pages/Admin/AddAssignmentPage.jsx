import React, { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useCreateAssignmentMutation } from "@/Redux/AllApi/AssignmentApi";
import { useGetCourseByIdQuery } from "@/Redux/AllApi/CourseApi";
import { useGetModulesByCourseQuery } from "@/Redux/AllApi/moduleApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  IconArrowLeft,
  IconPlus,
  IconTrash,
  IconLoader,
  IconCalendar,
  IconUpload,
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const AddAssignmentPage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [createAssignment, { isLoading }] = useCreateAssignmentMutation();

  const { data: courseData, refetch: refetchCourse } = useGetCourseByIdQuery(courseId);

  const basePath = React.useMemo(() => {
    const p = location.pathname || '';
    if (p.startsWith('/superadmin')) return '/superadmin';
    if (p.startsWith('/instructor')) return '/instructor';
    return '/admin';
  }, [location.pathname]);
  const { data: modulesData } = useGetModulesByCourseQuery(courseId);

  const course = courseData?.data || {};
  const modules = modulesData?.data || [];

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assignmentType: "MODULE", // New field for assignment type
    moduleId: "", // Module selection (only for MODULE type)
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default: 7 days from now
  });

  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    // Only require module selection for MODULE type assignments
    if (formData.assignmentType === "MODULE" && !formData.moduleId) {
      toast.error("Please select a module for module assignment");
      return false;
    }

    if (!formData.title.trim()) {
      toast.error("Assignment title is required");
      return false;
    }

    if (!formData.dueDate) {
      toast.error("Due date is required");
      return false;
    }

    if (formData.dueDate < new Date()) {
      toast.error("Due date cannot be in the past");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Ensure we are sending a real MongoDB ObjectId for the course
    if (!course?._id) {
      toast.error("Course not loaded yet. Please wait a moment and try again.");
      return;
    }

    try {
      const assignmentData = {
        courseId: course._id, // Use the actual course ObjectId instead of the URL param (which may be a slug)
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate.toISOString(),
      };

      // Only include moduleId for MODULE type assignments
      if (formData.assignmentType === "MODULE" && formData.moduleId) {
        assignmentData.moduleId = formData.moduleId;
      }

      await createAssignment(assignmentData).unwrap();

      toast.success("Assignment created successfully!");

      // Refetch course data to update the assignments list
      await refetchCourse();

      navigate(`${basePath}/courses/${courseId}`);
    } catch (error) {
      console.error("Create assignment error:", error);
      toast.error(error?.data?.message || "Failed to create assignment");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`${basePath}/courses/${courseId}`)}
        >
          <IconArrowLeft className="h-4 w-4 mr-2" />
          Back to Course
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Create New Assignment
          </h1>
          <p className="text-muted-foreground">
            Add an assignment for {course.title || "the course"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment Information</CardTitle>
            <CardDescription>
              Enter the basic details for your assignment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Assignment Type Selection */}
            <div className="grid gap-2">
              <Label htmlFor="assignmentType">Assignment Type *</Label>
              <Select
                value={formData.assignmentType}
                onValueChange={(value) => {
                  setFormData((prev) => ({
                    ...prev,
                    assignmentType: value,
                    moduleId: value === "COURSE" ? "" : prev.moduleId // Clear module when switching to course
                  }))
                }}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MODULE">
                    📝 Module Assignment - Assess specific module completion
                  </SelectItem>
                  <SelectItem value="COURSE">
                    🏆 Course Final Assignment - Assess entire course completion
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formData.assignmentType === "MODULE"
                  ? "Module assignments unlock after completing all lessons in the selected module"
                  : "Course assignments unlock only after completing ALL modules in the course"
                }
              </p>
            </div>

            {/* Module Selection - Only show for MODULE type */}
            {formData.assignmentType === "MODULE" && (
              <div className="grid gap-2">
                <Label htmlFor="moduleId">Module *</Label>
                <Select
                  value={formData.moduleId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, moduleId: value }))
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No modules available. Create modules first.
                      </SelectItem>
                    ) : (
                      modules.map((module) => (
                        <SelectItem key={String(module.id || module._id)} value={String(module.id || module._id)}>
                          {module.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {/* Show error message if no modules */}
                {modules.length === 0 && (
                  <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3">
                    <p className="font-medium">No modules found for this course.</p>
                    <p className="text-xs mt-1">
                      You need to create modules first before adding assignments.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-1"
                      onClick={() => navigate(`${basePath}/courses/${courseId}`)}
                    >
                      <IconPlus className="h-3 w-3" />
                      Go to Course
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="title">Assignment Title *</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter assignment title"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter assignment description and instructions"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Due Date */}
        <Card>
          <CardHeader>
            <CardTitle>Due Date</CardTitle>
            <CardDescription>
              Set when this assignment is due
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Due Date *</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.dueDate && "text-muted-foreground"
                    )}
                  >
                    <IconCalendar className="mr-2 h-4 w-4" />
                    {formData.dueDate ? (
                      format(formData.dueDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.dueDate}
                    onSelect={(date) => {
                      setFormData((prev) => ({ ...prev, dueDate: date }));
                      setDatePickerOpen(false);
                    }}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`${basePath}/courses/${courseId}`)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="gap-2">
            {isLoading && <IconLoader className="h-4 w-4 animate-spin" />}
            {isLoading ? "Creating..." : "Create Assignment"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddAssignmentPage;
