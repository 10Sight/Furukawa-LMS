import React, { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  IconPlus,
  IconPaperclip,
  IconFileText,
  IconDownload,
  IconTrash,
  IconEdit,
  IconLoader,
  IconChevronDown,
  IconChevronUp,
  IconFile,
  IconPhoto,
  IconVideo,
  IconFileTypePdf,
  IconLink,
  IconEye,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDeleteResourceMutation, useGetResourcesByModuleQuery } from "@/Redux/AllApi/resourceApi";
import { toast } from "sonner";
import { getMediaUrl } from "@/utils/mediaUtils";

const ResourceModule = ({ module, courseId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  // Auto-expand if module already has resources
  const [isExpanded, setIsExpanded] = useState(Boolean(module.resources?.length));
  const [deleteResource, { isLoading: isDeletingResource }] = useDeleteResourceMutation();

  const basePath = React.useMemo(() => {
    const p = location.pathname || '';
    if (p.startsWith('/superadmin')) return '/superadmin';
    if (p.startsWith('/instructor')) return '/instructor';
    return '/admin';
  }, [location.pathname]);

  const moduleId = module.id || module._id;
  
  // Independently fetch resources for this module when expanded
  const { 
    data: moduleResourcesRes, 
    isLoading: moduleResourcesLoading 
  } = useGetResourcesByModuleQuery(moduleId, { skip: !moduleId || !isExpanded });

  const resources = useMemo(() => {
    if (moduleResourcesRes?.data) return moduleResourcesRes.data;
    return Array.isArray(module.resources) ? module.resources : [];
  }, [moduleResourcesRes, module.resources]);

  const resourcesLoading = moduleResourcesLoading;

  const handlePreview = (resource) => {
    if (resource.type?.toLowerCase() === 'link') {
      window.open(resource.url, "_blank");
    } else {
      navigate(`${basePath}/resource-preview/${resource._id || resource.id}`, { 
        state: { 
          resource, 
          moduleTitle: module.title,
          courseTitle: "Course"
        } 
      });
    }
  };

  const handleDeleteResource = async (resourceId) => {
    if (!window.confirm("Are you sure you want to delete this resource? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteResource(resourceId).unwrap();
      toast.success("Resource deleted successfully!");
      // Note: Parent component should handle refetching modules to update resource lists
    } catch (error) {
      console.error("Delete resource error:", error);
      toast.error(error?.data?.message || "Failed to delete resource");
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (resource) => {
    const format = resource.format?.toLowerCase();
    const type = resource.type?.toLowerCase();
    
    // Check by resource type first
    switch (type) {
      case 'video':
        return <IconVideo className="h-4 w-4 text-purple-500" />;
      case 'image':
        return <IconPhoto className="h-4 w-4 text-green-500" />;
      case 'pdf':
        return <IconFileTypePdf className="h-4 w-4 text-red-500" />;
      case 'link':
        return <IconLink className="h-4 w-4 text-blue-500" />;
      case 'text':
        return <IconFileText className="h-4 w-4 text-gray-500" />;
    }
    
    // Fallback to format if type doesn't match
    switch (format) {
      case 'pdf':
        return <IconFileTypePdf className="h-4 w-4 text-red-500" />;
      case 'doc':
      case 'docx':
        return <IconFileText className="h-4 w-4 text-blue-500" />;
      case 'xls':
      case 'xlsx':
        return <IconFileText className="h-4 w-4 text-green-500" />;
      case 'ppt':
      case 'pptx':
        return <IconFileText className="h-4 w-4 text-orange-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return <IconPhoto className="h-4 w-4 text-green-500" />;
      case 'mp4':
      case 'mov':
      case 'avi':
      case 'wmv':
      case 'webm':
        return <IconVideo className="h-4 w-4 text-purple-500" />;
      default:
        return <IconFile className="h-4 w-4 text-gray-500" />;
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div 
            className="flex items-center gap-2 cursor-pointer flex-1" 
            onClick={toggleExpanded}
          >
            <CardTitle>{module.title}</CardTitle>
            <Badge variant="outline">
              {isExpanded ? (resources.length || 0) : (module.resources?.length || 0)} resource
              {((isExpanded ? resources.length : module.resources?.length) !== 1) ? "s" : ""}
            </Badge>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); setIsExpanded((v) => !v); }}>
              {isExpanded ? (
                <IconChevronUp className="h-4 w-4" />
              ) : (
                <IconChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`${basePath}/add-resource/${courseId}?moduleId=${moduleId}`)}
          >
            <IconPlus className="h-4 w-4 mr-2" />
            Add Resource
          </Button>
        </div>
      </CardHeader>

      {/* Resources accordion content */}
      {isExpanded && (
        <CardContent className="pt-4">
          
          {resourcesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border rounded-lg p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : resources.length > 0 ? (
            <div className="space-y-3">
              {resources.map((resource, index) => (
                <div key={resource.id || resource._id || index} className="border rounded-lg p-4 flex items-start justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-0 overflow-hidden bg-muted rounded-lg border flex items-center justify-center min-w-[56px] h-[56px] flex-shrink-0 mt-1">
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
                        <div className="p-2">
                          {getFileIcon(resource)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h5 className="font-medium">{resource.title || resource.fileName}</h5>
                        <Badge variant="outline" className="text-xs">
                          {resource.type || 'File'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {resource.fileName && (
                          <span>{resource.fileName}</span>
                        )}
                        {resource.fileSize && (
                          <span>{formatFileSize(resource.fileSize)}</span>
                        )}
                        {resource.createdAt && (
                          <span>Added {new Date(resource.createdAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {/* Preview button for images and videos */}
                    {resource.url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handlePreview(resource); }}
                        title="Preview"
                      >
                        <IconEye className="h-4 w-4" />
                      </Button>
                    )}
                    
                    {/* Download button for all resource types */}
                    {resource.url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); window.open(getMediaUrl(resource.url), '_blank'); }}
                        title="Download"
                      >
                        <IconDownload className="h-4 w-4" />
                      </Button>
                    )}
                    
                    {/* Legacy support for older resources */}
                    {!resource.url && resource.fileUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); window.open(getMediaUrl(resource.fileUrl), '_blank'); }}
                        title="Download"
                      >
                        <IconDownload className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); navigate(`${basePath}/edit-resource/${resource.id || resource._id}`); }}
                    >
                      <IconEdit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                      onClick={() => handleDeleteResource(resource.id || resource._id)}
                      disabled={isDeletingResource}
                    >
                      {isDeletingResource ? (
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
              <IconPaperclip className="h-10 w-10 text-muted-foreground/60 mb-2" />
              <p className="text-muted-foreground font-medium">No resources yet</p>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                Add resources to this module to provide supplementary materials
              </p>
              <Button 
                size="sm" 
                onClick={() => navigate(`${basePath}/add-resource/${courseId}?moduleId=${moduleId}`)}
              >
                <IconPlus className="h-4 w-4 mr-1" />
                Add Resource
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default ResourceModule;
