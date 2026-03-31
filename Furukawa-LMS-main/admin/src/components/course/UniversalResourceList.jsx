import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  IconFile,
  IconVideo,
  IconPhoto,
  IconLink,
  IconFileText,
  IconTrash,
  IconEdit,
  IconDownload,
  IconPlus,
  IconLoader,
  IconExternalLink
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  useGetResourcesByModuleQuery,
  useGetResourcesByCourseQuery,
  useGetResourcesByLessonQuery,
  useDeleteResourceMutation,
} from "@/Redux/AllApi/resourceApi";
import { ResourceManagementModal } from "./ResourceManagementModal";
import { getMediaUrl } from "@/utils/mediaUtils";

const getResourceIcon = (type) => {
  switch (type?.toLowerCase()) {
    case "video": return IconVideo;
    case "image": return IconPhoto;
    case "link": return IconLink;
    case "pdf": return IconFileText;
    case "text": return IconFileText;
    default: return IconFile;
  }
};

const formatFileSize = (bytes) => {
  if (!bytes) return "Unknown size";
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i];
};

const getResourceTypeBadge = (type) => {
  const colors = {
    video: "bg-red-100 text-red-800",
    image: "bg-green-100 text-green-800", 
    pdf: "bg-blue-100 text-blue-800",
    link: "bg-purple-100 text-purple-800",
    text: "bg-gray-100 text-gray-800"
  };

  return colors[type?.toLowerCase()] || "bg-gray-100 text-gray-800";
};

export const UniversalResourceList = ({ 
  scope, 
  courseId, 
  moduleId, 
  lessonId, 
  entityName = "",
  showAddButton = true 
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteResource, { isLoading: isDeletingResource }] = useDeleteResourceMutation();

  // Correctly call hooks at the top level with skip conditions
  const { data: courseRes, isLoading: courseLoading, error: courseError, refetch: refetchCourse } = useGetResourcesByCourseQuery(courseId, { skip: scope !== 'course' || !courseId });
  const { data: moduleRes, isLoading: moduleLoading, error: moduleError, refetch: refetchModule } = useGetResourcesByModuleQuery(moduleId, { skip: scope !== 'module' || !moduleId });
  const { data: lessonRes, isLoading: lessonLoading, error: lessonError, refetch: refetchLesson } = useGetResourcesByLessonQuery(lessonId, { skip: scope !== 'lesson' || !lessonId });

  const resourcesResponse = scope === 'course' ? courseRes : scope === 'module' ? moduleRes : lessonRes;
  const isLoading = scope === 'course' ? courseLoading : scope === 'module' ? moduleLoading : lessonLoading;
  const error = scope === 'course' ? courseError : scope === 'module' ? moduleError : lessonError;
  const refetch = scope === 'course' ? refetchCourse : scope === 'module' ? refetchModule : refetchLesson;
  const resources = resourcesResponse?.data || [];

  const handleDeleteResource = async (resourceId) => {
    if (!window.confirm("Are you sure you want to delete this resource?")) {
      return;
    }

    try {
      await deleteResource(resourceId).unwrap();
      toast.success("Resource deleted successfully!");
      refetch(); // Refetch the resources
    } catch (error) {
      console.error("Delete resource error:", error);
      toast.error(error?.data?.message || "Failed to delete resource");
    }
  };

  const navigate = useNavigate();
  const location = useLocation();

  const basePath = React.useMemo(() => {
    const p = location.pathname || '';
    if (p.startsWith('/superadmin')) return '/superadmin';
    if (p.startsWith('/instructor')) return '/instructor';
    if (p.startsWith('/trainer')) return '/trainer';
    return '/admin';
  }, [location.pathname]);

  const handleResourceClick = (resource) => {
    if (resource.type?.toLowerCase() === 'link') {
      window.open(resource.url, "_blank");
    } else {
      navigate(`${basePath}/resource-preview/${resource._id || resource.id}`, { 
        state: { 
          resource, 
          courseTitle: "Course", // Could be more dynamic if needed
          entityName 
        } 
      });
    }
  };

  const getScopeDisplayName = () => {
    switch (scope) {
      case "course": return "Course";
      case "module": return "Module";
      case "lesson": return "Lesson";
      default: return scope;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconFile className="h-5 w-5" />
            {getScopeDisplayName()} Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <IconLoader className="h-6 w-6 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-500">Loading resources...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconFile className="h-5 w-5" />
            {getScopeDisplayName()} Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            <p>Error loading resources: {error?.data?.message || "Unknown error"}</p>
            <Button 
              variant="outline" 
              className="mt-2" 
              onClick={refetch}
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IconFile className="h-5 w-5" />
                {getScopeDisplayName()} Resources
              </CardTitle>
              <CardDescription>
                {entityName && `Resources for "${entityName}"`}
                {resources.length > 0 && ` (${resources.length} ${resources.length === 1 ? 'resource' : 'resources'})`}
              </CardDescription>
            </div>
            {showAddButton && (
              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="gap-2"
                size="sm"
              >
                <IconPlus className="h-4 w-4" />
                Add Resource
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {resources.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <IconFile className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">No Resources Yet</h3>
              <p className="text-sm mb-4">
                Add resources like PDFs, videos, images, or external links to enhance learning.
              </p>
              {showAddButton && (
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="gap-2"
                >
                  <IconPlus className="h-4 w-4" />
                  Add First Resource
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {resources.map((resource) => {
                const IconComponent = getResourceIcon(resource.type);
                
                return (
                  <div
                    key={resource.id || resource._id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="p-0 overflow-hidden bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center min-w-[56px] h-[56px] flex-shrink-0">
                        {resource.type?.toLowerCase() === 'image' && resource.url ? (
                          <img 
                            src={getMediaUrl(resource.url)} 
                            alt={resource.title} 
                            className="w-full h-full object-cover"
                          />
                        ) : resource.type?.toLowerCase() === 'video' && resource.url ? (
                          <div className="relative w-full h-full flex items-center justify-center bg-gray-900">
                             <IconVideo className="h-6 w-6 text-white" />
                          </div>
                        ) : (
                          <div className="p-3">
                            <IconComponent className="h-6 w-6 text-gray-600" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 truncate">
                            {resource.title}
                          </h4>
                          <span 
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getResourceTypeBadge(resource.type)}`}
                          >
                            {resource.type?.toUpperCase()}
                          </span>
                        </div>
                        
                        {resource.description && (
                          <p className="text-sm text-gray-600 mb-1 line-clamp-2">
                            {resource.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          {resource.fileName && (
                            <span>📁 {resource.fileName}</span>
                          )}
                          {resource.fileSize && (
                            <span>📊 {formatFileSize(resource.fileSize)}</span>
                          )}
                          {resource.createdBy?.name && (
                            <span>👤 {resource.createdBy.name}</span>
                          )}
                          <span>📅 {new Date(resource.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {resource.url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResourceClick(resource)}
                          title={resource.type === 'link' ? "Open Link" : "Download/View"}
                        >
                          {resource.type === 'link' ? (
                            <IconExternalLink className="h-4 w-4" />
                          ) : (
                            <IconDownload className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteResource(resource.id || resource._id)}
                        disabled={isDeletingResource}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50"
                      >
                        {isDeletingResource ? (
                          <IconLoader className="h-4 w-4 animate-spin" />
                        ) : (
                          <IconTrash className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ResourceManagementModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        scope={scope}
        courseId={courseId}
        moduleId={moduleId}
        lessonId={lessonId}
        entityName={entityName}
      />
    </>
  );
};
