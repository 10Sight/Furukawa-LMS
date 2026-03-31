import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useCreateResourceMutation } from "@/Redux/AllApi/resourceApi";
import { useGetModulesByCourseQuery } from "@/Redux/AllApi/moduleApi";
import { useGetLessonsByModuleQuery } from "@/Redux/AllApi/LessonApi";
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
import {
  IconArrowLeft,
  IconUpload,
  IconLink,
  IconFileText,
  IconVideo,
  IconPhoto,
  IconLoader,
  IconPlus,
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AddResourcePage = () => {
  const { courseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [createResource, { isLoading }] = useCreateResourceMutation();

  // Get initial scope and entity from URL params or location state
  const urlParams = new URLSearchParams(location.search);
  const initialScope = urlParams.get('scope') || 'course';
  const initialModuleId = urlParams.get('moduleId') || '';
  const initialLessonId = urlParams.get('lessonId') || '';

  const [formData, setFormData] = useState({
    scope: initialScope,
    courseId: courseId || '',
    moduleId: initialModuleId,
    lessonId: initialLessonId,
    title: '',
    type: 'pdf',
    description: '',
    url: '',
    file: null,
  });

  // Fetch course data
  const { data: courseData } = useGetCourseByIdQuery(courseId, {
    skip: !courseId,
  });

  // Fetch modules for the course
  const {
    data: modulesData,
    isLoading: modulesLoading,
    error: modulesError
  } = useGetModulesByCourseQuery(courseId, {
    skip: !courseId || formData.scope === 'course',
  });

  // Fetch lessons for selected module
  const {
    data: lessonsData,
    isLoading: lessonsLoading
  } = useGetLessonsByModuleQuery(formData.moduleId, {
    skip: !formData.moduleId || formData.scope !== 'lesson',
  });

  const course = courseData?.data || {};
  const modules = modulesData?.data || [];
  const lessons = lessonsData?.data || [];

  const [filePreview, setFilePreview] = useState(null);

  // Clear dependent fields when scope changes
  useEffect(() => {
    if (formData.scope === 'course') {
      setFormData(prev => ({ ...prev, moduleId: '', lessonId: '' }));
    } else if (formData.scope === 'module') {
      setFormData(prev => ({ ...prev, lessonId: '' }));
    }
  }, [formData.scope]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File size must be less than 50MB");
      return;
    }

    setFormData(prev => ({
      ...prev,
      file: file,
      url: "" // Clear URL when file is selected
    }));

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleUrlChange = (value) => {
    setFormData(prev => ({
      ...prev,
      url: value,
      file: null // Clear file when URL is entered
    }));
    setFilePreview(null);
  };

  const removeFile = () => {
    setFormData(prev => ({ ...prev, file: null }));
    setFilePreview(null);
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      toast.error("Resource title is required");
      return false;
    }

    if (!formData.type) {
      toast.error("Resource type is required");
      return false;
    }

    if (formData.scope === 'module' && !formData.moduleId) {
      toast.error("Please select a module");
      return false;
    }

    if (formData.scope === 'lesson' && !formData.lessonId) {
      toast.error("Please select a lesson");
      return false;
    }

    if (!formData.file && !formData.url.trim()) {
      toast.error("Either a file or URL must be provided");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const formDataToSend = new FormData();

      // Add required fields
      formDataToSend.append("title", formData.title.trim());
      formDataToSend.append("type", formData.type);
      formDataToSend.append("scope", formData.scope);

      if (formData.description.trim()) {
        formDataToSend.append("description", formData.description.trim());
      }

      // Add the appropriate ID based on scope
      if (formData.scope === "course" && courseId) {
        formDataToSend.append("courseId", courseId);
      } else if (formData.scope === "module" && formData.moduleId) {
        formDataToSend.append("moduleId", formData.moduleId);
      } else if (formData.scope === "lesson" && formData.lessonId) {
        formDataToSend.append("lessonId", formData.lessonId);
      }

      // Add file or URL
      if (formData.file) {
        formDataToSend.append("file", formData.file);
      } else if (formData.url.trim()) {
        formDataToSend.append("url", formData.url.trim());
      }

      await createResource(formDataToSend).unwrap();

      toast.success(`Resource added to ${formData.scope} successfully!`);
      const basePath = (() => {
        const p = location.pathname || '';
        if (p.startsWith('/superadmin')) return '/superadmin';
        if (p.startsWith('/instructor')) return '/instructor';
        return '/admin';
      })();
      navigate(`${basePath}/courses/${courseId}`);
    } catch (error) {
      console.error("Create resource error:", error);
      toast.error(error?.data?.message || `Failed to add resource to ${formData.scope}`);
    }
  };

  const getEntityName = () => {
    switch (formData.scope) {
      case 'course':
        return course.title || 'Course';
      case 'module':
        const selectedModule = modules.find(m => (m.id || m._id) === formData.moduleId);
        return selectedModule?.title || 'Module';
      case 'lesson':
        const selectedLesson = lessons.find(l => (l.id || l._id) === formData.lessonId);
        return selectedLesson?.title || 'Lesson';
      default:
        return '';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "VIDEO":
        return <IconVideo className="h-5 w-5" />;
      case "PDF":
        return <IconFileText className="h-5 w-5" />;
      case "IMAGE":
        return <IconPhoto className="h-5 w-5" />;
      case "LINK":
        return <IconLink className="h-5 w-5" />;
      case "TEXT":
        return <IconFileText className="h-5 w-5" />;
      default:
        return <IconFileText className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const basePath = (() => {
              const p = location.pathname || '';
              if (p.startsWith('/superadmin')) return '/superadmin';
              if (p.startsWith('/instructor')) return '/instructor';
              return '/admin';
            })();
            navigate(`${basePath}/courses/${courseId}`);
          }}
        >
          <IconArrowLeft className="h-4 w-4 mr-2" />
          Back to Course
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Add New Resource
          </h1>
          <p className="text-muted-foreground">
            Upload files or add links to support student learning
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Target Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Resource Target</CardTitle>
            <CardDescription>
              Choose where this resource should be attached
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Scope Selection */}
            <div className="grid gap-2">
              <Label>Add Resource To *</Label>
              <Select
                value={formData.scope}
                onValueChange={(value) => handleInputChange('scope', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="course">Entire Course</SelectItem>
                  <SelectItem value="module">Specific Module</SelectItem>
                  <SelectItem value="lesson">Specific Lesson</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Current target: <span className="font-medium">{getEntityName()}</span>
              </p>
            </div>

            {/* Module Selection (for module and lesson scopes) */}
            {(formData.scope === 'module' || formData.scope === 'lesson') && (
              <div className="grid gap-2">
                <Label>Module *</Label>
                <Select
                  value={formData.moduleId}
                  onValueChange={(value) => handleInputChange('moduleId', value)}
                  disabled={modulesLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modulesLoading ? (
                      <SelectItem value="loading" disabled>
                        <div className="flex items-center gap-2">
                          <IconLoader className="h-4 w-4 animate-spin" />
                          Loading modules...
                        </div>
                      </SelectItem>
                    ) : modules.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No modules available
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
              </div>
            )}

            {/* Lesson Selection (for lesson scope) */}
            {formData.scope === 'lesson' && formData.moduleId && (
              <div className="grid gap-2">
                <Label>Lesson *</Label>
                <Select
                  value={formData.lessonId}
                  onValueChange={(value) => handleInputChange('lessonId', value)}
                  disabled={lessonsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a lesson" />
                  </SelectTrigger>
                  <SelectContent>
                    {lessonsLoading ? (
                      <SelectItem value="loading" disabled>
                        <div className="flex items-center gap-2">
                          <IconLoader className="h-4 w-4 animate-spin" />
                          Loading lessons...
                        </div>
                      </SelectItem>
                    ) : lessons.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No lessons in this module
                      </SelectItem>
                    ) : (
                      lessons.map((lesson) => (
                        <SelectItem key={String(lesson.id || lesson._id)} value={String(lesson.id || lesson._id)}>
                          {lesson.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resource Information */}
        <Card>
          <CardHeader>
            <CardTitle>Resource Information</CardTitle>
            <CardDescription>
              Enter the details for your resource
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Resource Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Enter resource title"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Resource Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => handleInputChange('type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select resource type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="text">Text Document</SelectItem>
                  <SelectItem value="link">External Link</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe this resource..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Resource Content */}
        <Card>
          <CardHeader>
            <CardTitle>Resource Content</CardTitle>
            <CardDescription>
              Upload a file or provide a URL
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Upload */}
            <div className="grid gap-2">
              <Label>Upload File</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />

                {formData.file ? (
                  <div className="flex items-center justify-between bg-blue-50 p-4 rounded-md">
                    <div className="flex items-center gap-3">
                      <IconFileText className="h-6 w-6 text-blue-600" />
                      <div className="text-left">
                        <p className="text-sm font-medium truncate">{formData.file.name}</p>
                        <p className="text-xs text-gray-600">
                          {(formData.file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeFile}
                      className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                    >
                      ❌
                    </Button>
                  </div>
                ) : (
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    <IconUpload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <div>
                      <p className="text-sm text-gray-600">
                        Drop a file here or{" "}
                        <span className="text-blue-600 hover:text-blue-800 font-medium">
                          browse files
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        File will be uploaded to Cloudinary (Max 50MB)
                      </p>
                    </div>
                  </label>
                )}

                {filePreview && (
                  <div className="mt-4">
                    <img
                      src={filePreview}
                      alt="Preview"
                      className="max-w-full h-32 object-contain mx-auto rounded"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* OR separator */}
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="mx-4 text-sm text-gray-500 bg-white px-2">OR</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            {/* URL Input */}
            <div className="grid gap-2">
              <Label htmlFor="url">External URL</Label>
              <Input
                id="url"
                value={formData.url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://example.com/resource.pdf"
                disabled={!!formData.file}
              />
              <p className="text-xs text-gray-500">
                {formData.file
                  ? "URL input is disabled when a file is selected"
                  : "Provide a URL to an external resource"
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const basePath = (() => {
                const p = location.pathname || '';
                if (p.startsWith('/superadmin')) return '/superadmin';
                if (p.startsWith('/instructor')) return '/instructor';
                return '/admin';
              })();
              navigate(`${basePath}/courses/${courseId}`);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || modulesLoading} className="gap-2">
            {isLoading && <IconLoader className="h-4 w-4 animate-spin" />}
            {isLoading ? "Creating..." : "Create Resource"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddResourcePage;