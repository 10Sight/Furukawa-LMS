import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconFileText,
  IconClock,
  IconLoader,
  IconChevronDown,
  IconChevronUp,
  IconVideo,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDeleteModuleMutation } from "@/Redux/AllApi/moduleApi";
import {
  useDeleteLessonMutation,
  useGetLessonsByModuleQuery,
} from "@/Redux/AllApi/LessonApi";

const ModuleItem = ({ module, onRefetch, isDeletingModule }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleteModule] = useDeleteModuleMutation();
  const [deleteLesson, { isLoading: isDeletingLesson }] = useDeleteLessonMutation();

  const moduleId = module._id || module.id;
  const basePath = React.useMemo(() => {
    const p = location.pathname || '';
    if (p.startsWith('/superadmin')) return '/superadmin';
    if (p.startsWith('/instructor')) return '/instructor';
    return '/admin';
  }, [location.pathname]);

  // Fetch lessons for this module only when expanded
  const {
    data: lessonsData,
    isLoading: lessonsLoading,
    refetch: refetchLessons,
  } = useGetLessonsByModuleQuery(moduleId, {
    skip: !isExpanded, // Only fetch when expanded
  });

  const lessons = lessonsData?.data || [];

  const handleDeleteModule = async () => {
    if (!window.confirm("Are you sure you want to delete this module? All lessons in this module will also be deleted.")) {
      return;
    }

    try {
      await deleteModule(moduleId).unwrap();
      toast.success("Module deleted successfully!");
      if (onRefetch) {
        onRefetch();
      }
    } catch (error) {
      console.error("Delete module error:", error);
      toast.error(error?.data?.message || "Failed to delete module");
    }
  };

  const handleDeleteLesson = async (lessonId) => {
    if (!window.confirm("Are you sure you want to delete this lesson?")) {
      return;
    }

    try {
      await deleteLesson({ moduleId, lessonId }).unwrap();
      toast.success("Lesson deleted successfully!");
      refetchLessons();
    } catch (error) {
      console.error("Delete lesson error:", error);
      toast.error(error?.data?.message || "Failed to delete lesson");
    }
  };

  const renderLessonContent = (content) => {
    if (!content || content.trim() === "") {
      return <span className="text-muted-foreground italic">No content available</span>;
    }
    
    // Remove HTML tags if present and truncate
    const plainText = content.replace(/<[^>]*>/g, '');
    
    if (plainText.length > 100) {
      return <span>{plainText.substring(0, 100)}...</span>;
    }
    
    return <span>{plainText}</span>;
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Card className="group overflow-hidden">
      <CardHeader className="pb-3 bg-muted/30">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div 
              className="flex items-center gap-2 cursor-pointer" 
              onClick={toggleExpanded}
            >
              <CardTitle className="flex items-center gap-2">
                {module.title}
                <Badge variant="secondary" className="ml-2">
                  Order: {module.order || 1}
                </Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                {isExpanded ? (
                  <IconChevronUp className="h-4 w-4" />
                ) : (
                  <IconChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
            <CardDescription className="mt-2">{module.description}</CardDescription>
          </div>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`${basePath}/edit-module/${moduleId}`)}
            >
              <IconPencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-800 hover:bg-red-50"
              onClick={handleDeleteModule}
              disabled={isDeletingModule}
            >
              {isDeletingModule ? (
                <IconLoader className="h-4 w-4 animate-spin" />
              ) : (
                <IconTrash className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
          <div className="flex items-center gap-1">
            <IconFileText className="h-4 w-4" />
            <span>
              {isExpanded ? (lessons.length || 0) : (module.lessons?.length || 0)} lesson
              {((isExpanded ? lessons.length : module.lessons?.length) !== 1) ? "s" : ""}
            </span>
          </div>
          {module.duration > 0 && (
            <div className="flex items-center gap-1">
              <IconClock className="h-4 w-4" />
              <span>{module.duration} minutes</span>
            </div>
          )}
        </div>
      </CardHeader>
      
      {/* Lessons accordion content */}
      {isExpanded && (
        <CardContent className="pt-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold">Lessons in this module</h4>
            <Button 
              size="sm" 
              onClick={() => navigate(`${basePath}/add-lesson/${moduleId}`)}
            >
              <IconPlus className="h-4 w-4 mr-1" />
              Add Lesson
            </Button>
          </div>
          
          {lessonsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border rounded-lg p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : lessons.length > 0 ? (
            <div className="space-y-3">
              {lessons.map((lesson, index) => (
                <div key={lesson._id || index} className="border rounded-lg p-4 flex items-start justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="bg-primary/10 p-2 rounded-full mt-1">
                      <IconVideo className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h5 className="font-medium">{lesson.title}</h5>
                        <Badge variant="outline" className="text-xs">
                          #{index + 1}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {renderLessonContent(lesson.content)}
                      </p>
                      {lesson.duration > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                          <IconClock className="h-3 w-3" />
                          <span>{lesson.duration} minutes</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`${basePath}/edit-lesson/${moduleId}/${lesson._id || lesson.id}`)}
                    >
                      <IconPencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                      onClick={() => handleDeleteLesson(lesson._id || lesson.id)}
                      disabled={isDeletingLesson}
                    >
                      {isDeletingLesson ? (
                        <IconLoader className="h-4 w-4 animate-spin" />
                      ) : (
                        <IconTrash className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center border rounded-lg bg-muted/20">
              <IconFileText className="h-10 w-10 text-muted-foreground/60 mb-2" />
              <p className="text-muted-foreground font-medium">No lessons yet</p>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                Add lessons to this module to get started
              </p>
              <Button 
                size="sm" 
                onClick={() => navigate(`${basePath}/add-lesson/${moduleId}`)}
              >
                <IconPlus className="h-4 w-4 mr-1" />
                Add Lesson
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default ModuleItem;
