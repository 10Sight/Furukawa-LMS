import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getMediaUrl } from '@/utils/mediaUtils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Video,
  FileText,
  FileImage,
  ExternalLink,
  Eye,
  Play,
  GraduationCap,
  Maximize2,
} from "lucide-react";

const StudentCourseResources = ({ resources, courseTitle }) => {
  const navigate = useNavigate();

  const getResourceIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'video':
        return <Video className="h-4 w-4 sm:h-5 sm:w-5" />;
      case 'pdf':
      case 'text':
        return <FileText className="h-4 w-4 sm:h-5 sm:w-5" />;
      case 'image':
        return <FileImage className="h-4 w-4 sm:h-5 sm:w-5" />;
      case 'link':
        return <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5" />;
      default:
        return <Download className="h-4 w-4 sm:h-5 sm:w-5" />;
    }
  };

  // Get preview thumbnail or placeholder image
  const getPreviewImage = (resource) => {
    const { type, url, title } = resource;

    // For images, use the actual image URL
    if (type?.toLowerCase() === 'image') {
      return getMediaUrl(url);
    }

    // For videos, try to get thumbnail (you may need to implement this based on your video service)
    if (type?.toLowerCase() === 'video') {
      // Return a placeholder for now - you can implement video thumbnail logic here
      return '/placeholder-video-thumbnail.jpg';
    }

    // For PDFs, return a PDF placeholder
    if (type?.toLowerCase() === 'pdf') {
      return '/placeholder-pdf.jpg';
    }

    // For other files, return a generic file placeholder
    return '/placeholder-file.jpg';
  };

  const handleResourceView = (resource) => {
    const { url, type, title } = resource;
    if (type === 'link') {
      window.open(url, '_blank');
    } else {
      // Navigate to preview page
      const resourceId = resource._id || resource.id || 'view';
      navigate(`/student/resource-preview/${resourceId}`, {
        state: {
          resource: resource,
          courseTitle: courseTitle
        }
      });
    }
  };

  const handleDownload = (url, filename) => {
    const link = document.createElement('a');
    link.href = getMediaUrl(url);
    link.download = filename || 'resource';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!resources || resources.length === 0) {
    return null;
  }

  return (
    <Card className="border-purple-300 bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 shadow-xl">
      <CardHeader className="pb-3 sm:pb-4 bg-gradient-to-r from-purple-100 to-pink-100 border-b border-purple-200">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <div className="p-2 bg-purple-500 rounded-lg">
            <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <span>Course Resources</span>
          <Badge className="bg-purple-500 text-white border-0 px-3 py-1 text-xs sm:text-sm">
            {resources.length} resource{resources.length > 1 ? 's' : ''}
          </Badge>
        </CardTitle>
        <p className="text-xs sm:text-sm text-purple-700 mt-2 leading-relaxed">
          Additional course materials and references for your comprehensive learning journey
        </p>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {resources.map((resource, index) => {
            const resourceId = resource._id || resource.id || index;
            const previewImage = getPreviewImage(resource);

            return (
              <div
                key={resourceId}
                className="group bg-white rounded-lg border-2 border-purple-200 overflow-hidden hover:shadow-xl hover:border-purple-300 transition-all duration-300"
              >
                {/* Preview Image Box */}
                <div
                  className="relative h-32 sm:h-40 bg-gradient-to-br from-gray-100 to-gray-200 cursor-pointer overflow-hidden"
                  onClick={() => handleResourceView(resource)}
                >
                  <img
                    src={previewImage}
                    alt={resource.title || `Resource ${index + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      // Fallback to icon-based preview if image fails to load
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  {/* Fallback Icon Display */}
                  <div className="absolute inset-0 hidden items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
                    <div className="text-center">
                      <div className="p-4 bg-purple-500 rounded-full mb-2 inline-block">
                        {getResourceIcon(resource.type)}
                      </div>
                      <p className="text-xs text-purple-700 font-medium">
                        {resource.type?.toUpperCase() || 'FILE'}
                      </p>
                    </div>
                  </div>

                  {/* Overlay with preview icon */}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="bg-white/90 rounded-full p-2 sm:p-3">
                      <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                    </div>
                  </div>

                  {/* Type Badge */}
                  <div className="absolute top-2 right-2">
                    <Badge
                      className={`text-xs font-bold px-2 py-1 ${resource.type === 'video' ? 'bg-red-500 text-white' :
                          resource.type === 'pdf' ? 'bg-blue-500 text-white' :
                            resource.type === 'image' ? 'bg-green-500 text-white' :
                              resource.type === 'link' ? 'bg-purple-500 text-white' :
                                'bg-gray-500 text-white'
                        }`}
                    >
                      {resource.type?.toUpperCase() || 'FILE'}
                    </Badge>
                  </div>

                  {/* Course Level Indicator */}
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-1">
                      COURSE
                    </Badge>
                  </div>
                </div>

                {/* Resource Info */}
                <div className="p-4 min-w-0">
                  <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-2 line-clamp-2 leading-tight break-words">
                    {resource.title || `Resource ${index + 1}`}
                  </h4>

                  {resource.description && (
                    <p className="text-xs sm:text-sm text-gray-600 mb-3 line-clamp-2 leading-relaxed break-words">
                      {resource.description}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={() => handleResourceView(resource)}
                      className="flex-1 h-8 sm:h-9 text-xs sm:text-sm bg-purple-600 hover:bg-purple-700 text-white min-h-[44px] sm:min-h-0"
                      size="sm"
                    >
                      {resource.type === 'video' ? (
                        <>
                          <Play className="h-3 w-3 mr-1.5" />
                          <span className="hidden sm:inline">Play</span>
                          <span className="sm:hidden">▶️</span>
                        </>
                      ) : resource.type === 'link' ? (
                        <>
                          <ExternalLink className="h-3 w-3 mr-1.5" />
                          <span className="hidden sm:inline">Visit</span>
                          <span className="sm:hidden">🔗</span>
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3 mr-1.5" />
                          <span className="hidden sm:inline">Preview</span>
                          <span className="sm:hidden">👁️</span>
                        </>
                      )}
                    </Button>

                    {/* Download Button (for non-link resources) */}
                    {resource.type !== 'link' && (
                      <Button
                        onClick={() => handleDownload(resource.url, resource.title)}
                        variant="outline"
                        className="flex-1 h-8 sm:h-9 text-xs sm:text-sm hover:bg-purple-50 border-purple-200 hover:border-purple-300"
                        size="sm"
                      >
                        <Download className="h-3 w-3 mr-1.5" />
                        <span className="hidden sm:inline">Download</span>
                        <span className="sm:hidden">⬇️</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentCourseResources;
