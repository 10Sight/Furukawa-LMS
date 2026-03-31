import React, { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useCreateModuleMutation } from "@/Redux/AllApi/moduleApi";
import { useCreateLessonMutation } from "@/Redux/AllApi/LessonApi";
import { useGetCourseByIdQuery } from "@/Redux/AllApi/CourseApi";
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
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  IconArrowLeft,
  IconPlus,
  IconTrash,
  IconLoader,
  IconBook,
  IconFileText,
} from "@tabler/icons-react";
import { toast } from "sonner";

const AddModulePage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [createModule, { isLoading: isCreatingModule }] = useCreateModuleMutation();
  const [createLesson, { isLoading: isCreatingLesson }] = useCreateLessonMutation();
  const { data: courseData } = useGetCourseByIdQuery(courseId);

  const basePath = React.useMemo(() => {
    const p = location.pathname || '';
    if (p.startsWith('/superadmin')) return '/superadmin';
    if (p.startsWith('/instructor')) return '/instructor';
    return '/admin';
  }, [location.pathname]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    order: 1,
    lessons: [
      {
        title: "",
        content: "",
        duration: 0,
        order: 1,
      },
    ],
  });

  const course = courseData?.data || {};

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLessonChange = (index, field, value) => {
    const updatedLessons = [...formData.lessons];
    updatedLessons[index][field] = value;
    setFormData((prev) => ({
      ...prev,
      lessons: updatedLessons,
    }));
  };

  const addLesson = () => {
    setFormData((prev) => ({
      ...prev,
      lessons: [
        ...prev.lessons,
        {
          title: "",
          content: "",
          duration: 0,
          order: prev.lessons.length + 1,
        },
      ],
    }));
  };

  const removeLesson = (index) => {
    if (formData.lessons.length <= 1) {
      toast.error("Module must have at least one lesson");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      lessons: prev.lessons.filter((_, i) => i !== index),
    }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      toast.error("Module title is required");
      return false;
    }

    if (formData.lessons.length === 0) {
      toast.error("Module must have at least one lesson");
      return false;
    }

    for (const [lIndex, lesson] of formData.lessons.entries()) {
      if (!lesson.title.trim()) {
        toast.error(`Lesson ${lIndex + 1} title is required`);
        return false;
      }

      if (lesson.duration < 0) {
        toast.error(`Lesson ${lIndex + 1} duration cannot be negative`);
        return false;
      }
    }

    if (formData.order < 1) {
      toast.error("Order must be at least 1");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Ensure we are sending a real ID for the course
    const actualCourseId = course?.id || course?._id;
    if (!actualCourseId) {
      toast.error("Course not loaded yet. Please wait a moment and try again.");
      return;
    }

    try {
      // First create the module
      const moduleResponse = await createModule({
        courseId: actualCourseId, // Use the actual course ID instead of the URL param (which may be a slug)
        title: formData.title,
        description: formData.description,
        order: parseInt(formData.order),
      }).unwrap();

      const moduleId = moduleResponse.data?._id || moduleResponse.data?.id;

      if (!moduleId) {
        throw new Error("Failed to create module - no module ID returned");
      }

      // Then create all lessons for this module SEQUENTIALLY to prevent slug race conditions
      for (const [index, lesson] of formData.lessons.entries()) {
        await createLesson({
          moduleId,
          title: lesson.title,
          content: lesson.content,
          duration: parseInt(lesson.duration),
          order: index + 1,
        }).unwrap();
      }

      toast.success("Module and lessons created successfully!");
      navigate(`${basePath}/courses/${courseId}`);
    } catch (error) {
      console.error("Create module error:", error);
      toast.error(error?.data?.message || "Failed to create module and lessons");
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
          <h1 className="text-2xl font-bold tracking-tight">Create New Module</h1>
          <p className="text-muted-foreground">
            Add a module with lessons to {course.title || "the course"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Module Information */}
        <Card>
          <CardHeader>
            <CardTitle>Module Information</CardTitle>
            <CardDescription>
              Enter the basic details for your module
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Module Title *</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter module title"
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
                placeholder="Enter module description (optional)"
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="order">Order *</Label>
              <Input
                id="order"
                name="order"
                type="number"
                min="1"
                value={formData.order}
                onChange={handleInputChange}
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Lessons */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Lessons</CardTitle>
                <CardDescription>
                  Add lessons to your module. Each lesson should have a title and content.
                </CardDescription>
              </div>
              <Button
                type="button"
                onClick={addLesson}
                variant="outline"
                className="gap-2"
              >
                <IconPlus className="h-4 w-4" />
                Add Lesson
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {formData.lessons.map((lesson, lIndex) => (
              <div key={lIndex} className="border rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold flex items-center gap-2">
                    <IconFileText className="h-5 w-5 text-blue-600" />
                    Lesson {lIndex + 1}
                  </h3>
                  <Button
                    type="button"
                    onClick={() => removeLesson(lIndex)}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                  >
                    <IconTrash className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={`lesson-title-${lIndex}`}>Lesson Title *</Label>
                  <Input
                    id={`lesson-title-${lIndex}`}
                    value={lesson.title}
                    onChange={(e) =>
                      handleLessonChange(lIndex, "title", e.target.value)
                    }
                    placeholder="Enter lesson title"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={`lesson-content-${lIndex}`}>Content</Label>
                  <RichTextEditor
                    value={lesson.content}
                    onChange={(value) =>
                      handleLessonChange(lIndex, "content", value)
                    }
                    placeholder="Enter lesson content (optional)"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={`lesson-duration-${lIndex}`}>Duration (minutes)</Label>
                  <Input
                    id={`lesson-duration-${lIndex}`}
                    type="number"
                    min="0"
                    value={lesson.duration}
                    onChange={(e) =>
                      handleLessonChange(lIndex, "duration", parseInt(e.target.value) || 0)
                    }
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
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
          <Button
            type="submit"
            disabled={isCreatingModule || isCreatingLesson}
            className="gap-2"
          >
            {(isCreatingModule || isCreatingLesson) && (
              <IconLoader className="h-4 w-4 animate-spin" />
            )}
            {isCreatingModule || isCreatingLesson ? "Creating..." : "Create Module"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddModulePage;