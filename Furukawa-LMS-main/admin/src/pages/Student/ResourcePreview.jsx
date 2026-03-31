import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useGetResourceByIdQuery } from '@/Redux/AllApi/resourceApi';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  Video,
  FileImage,
  Maximize2,
  Minimize2,
  AlertCircle,
  Eye,
  Loader2,
} from "lucide-react";
import { getMediaUrl } from '@/utils/mediaUtils';

const ResourcePreview = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState(null);

  const { resourceId } = useParams();
  const { data: resourceData, isLoading: isResourceLoading, error: resourceError } = useGetResourceByIdQuery(resourceId);
  const resource = resourceData?.data || location.state?.resource;
  const { moduleTitle, courseTitle } = location.state || {};

  useEffect(() => {
    if (resourceError) {
      setError(resourceError?.data?.message || "Failed to fetch resource details");
    }
  }, [resourceError]);

  if (isResourceLoading && !resource) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!resource && !isResourceLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Card className="shadow-lg border-red-200">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Resource Not Found</h3>
              <Alert variant="destructive" className="mb-4">
                <AlertDescription className="text-sm">
                  The requested resource could not be found. Please go back and try again.
                </AlertDescription>
              </Alert>
              <Button onClick={() => navigate(-1)} className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getResourceIcon = (type) => {
    switch(type?.toLowerCase()) {
      case 'video':
        return <Video className="h-5 w-5 sm:h-6 sm:w-6" />;
      case 'pdf':
      case 'text':
        return <FileText className="h-5 w-5 sm:h-6 sm:w-6" />;
      case 'image':
        return <FileImage className="h-5 w-5 sm:h-6 sm:w-6" />;
      default:
        return <Eye className="h-5 w-5 sm:h-6 sm:w-6" />;
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = getMediaUrl(resource.url);
    link.download = resource.title || 'resource';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Fallback type detection if record type is missing or wrong
  const detectType = (res) => {
    if (!res) return 'file';
    const type = res.type?.toLowerCase();
    const url = res.url || "";
    const format = res.format?.toLowerCase();
    
    if (type === 'pdf' || format === 'pdf' || url.toLowerCase().endsWith('.pdf')) return 'pdf';
    if (type === 'video' || format === 'mp4' || url.toLowerCase().match(/\.(mp4|webm|ogg)$/)) return 'video';
    if (type === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(format) || url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)) return 'image';
    if (type === 'text' || format === 'txt' || url.toLowerCase().endsWith('.txt')) return 'text';
    return type || 'file';
  };

  const currentType = detectType(resource);

  const renderPreviewContent = () => {
    if (!resource) return null;
    
    const type = currentType;
    const url = getMediaUrl(resource.url);
    const title = resource.title;

    if (isResourceLoading) {
      return (
        <div className="flex items-center justify-center h-64 sm:h-96">
          <div className="text-center">
            <Loader2 className="h-8 w-8 sm:h-12 sm:w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-sm sm:text-base text-gray-600">Loading preview...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-64 sm:h-96">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 sm:h-12 sm:w-12 text-red-500 mx-auto mb-4" />
            <p className="text-sm sm:text-base text-red-600 mb-4">{error}</p>
            <Button onClick={() => setError(null)} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    switch(type?.toLowerCase()) {
      case 'pdf':
        return (
          <div className="w-full h-full min-h-96">
            <iframe
              src={url}
              className="w-full h-full min-h-96 rounded-lg border"
              title={title}
              onError={() => setError('Failed to load PDF. Please try downloading instead.')}
            />
          </div>
        );
        
      case 'video':
        return (
          <div className="w-full">
            <video
              controls
              className="w-full max-h-96 sm:max-h-[32rem] rounded-lg shadow-lg"
              onError={() => setError('Failed to load video. Please check the file format.')}
            >
              <source src={url} type="video/mp4" />
              <source src={url} type="video/webm" />
              <source src={url} type="video/ogg" />
              Your browser does not support the video tag.
            </video>
          </div>
        );
        
      case 'image':
        return (
          <div className="w-full flex justify-center">
            <img
              src={url}
              alt={title}
              className="max-w-full max-h-96 sm:max-h-[32rem] rounded-lg shadow-lg object-contain"
              onError={() => setError('Failed to load image. Please try downloading instead.')}
            />
          </div>
        );
        
      case 'text':
        return (
          <div className="w-full">
            <iframe
              src={url}
              className="w-full h-96 sm:h-[32rem] rounded-lg border"
              title={title}
              onError={() => setError('Failed to load text file. Please try downloading instead.')}
            />
          </div>
        );
        
      default:
        return (
          <div className="text-center py-8 sm:py-12">
            <div className="p-6 sm:p-8 bg-gray-100 rounded-full w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-4 flex items-center justify-center">
              {getResourceIcon(type)}
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Preview Not Available</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              This file type cannot be previewed directly. Please download to view the content.
            </p>
            <Button onClick={handleDownload} className="bg-blue-600 hover:bg-blue-700">
              <Download className="h-4 w-4 mr-2" />
              Download File
            </Button>
          </div>
        );
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 ${isFullscreen ? 'p-0' : 'p-4 sm:p-6'}`}>
      <div className={`mx-auto ${isFullscreen ? 'max-w-full h-screen' : 'max-w-6xl'}`}>
        {/* Header */}
        {!isFullscreen && (
          <div className="mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => navigate(-1)}
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
                <div>
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 leading-tight">
                    {resource.title || 'Resource Preview'}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    {moduleTitle && (
                      <span className="text-xs sm:text-sm text-gray-600">
                        Module: {moduleTitle}
                      </span>
                    )}
                    {courseTitle && (
                      <span className="text-xs sm:text-sm text-gray-600">
                        • Course: {courseTitle}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Badge 
                  className={`px-3 py-1 text-xs sm:text-sm font-medium ${
                    currentType === 'video' ? 'bg-red-500 text-white' :
                    currentType === 'pdf' ? 'bg-blue-500 text-white' :
                    currentType === 'image' ? 'bg-green-500 text-white' :
                    'bg-gray-500 text-white'
                  }`}
                >
                  {currentType?.toUpperCase() || 'FILE'}
                </Badge>
                
                {resource.type !== 'link' && (
                  <Button
                    onClick={handleDownload}
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                )}
                
                <Button
                  onClick={toggleFullscreen}
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                >
                  <Maximize2 className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Fullscreen</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Preview Content */}
        <Card className={`shadow-xl ${isFullscreen ? 'h-screen rounded-none border-0' : ''}`}>
          {isFullscreen && (
            <div className="absolute top-4 right-4 z-10">
              <Button
                onClick={toggleFullscreen}
                variant="outline"
                size="sm"
                className="bg-white/90 backdrop-blur-sm"
              >
                <Minimize2 className="h-4 w-4 mr-2" />
                Exit Fullscreen
              </Button>
            </div>
          )}
          
          <CardContent className={`${isFullscreen ? 'p-4 h-full' : 'p-4 sm:p-6'}`}>
            {resource.description && !isFullscreen && (
              <div className="mb-4 sm:mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm sm:text-base text-blue-800 leading-relaxed">
                  {resource.description}
                </p>
              </div>
            )}
            
            <div className={`${isFullscreen ? 'h-full flex items-center justify-center' : ''}`}>
              {renderPreviewContent()}
            </div>
          </CardContent>
        </Card>

        {/* Resource Info Footer */}
        {!isFullscreen && resource.description && (
          <div className="mt-4 sm:mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    {getResourceIcon(resource.type)}
                  </div>
                  Resource Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="font-semibold text-gray-900 mb-1">Title</dt>
                    <dd className="text-gray-600">{resource.title || 'Untitled Resource'}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-gray-900 mb-1">Type</dt>
                    <dd className="text-gray-600">{resource.type?.toUpperCase() || 'Unknown'}</dd>
                  </div>
                  {resource.description && (
                    <div className="sm:col-span-2">
                      <dt className="font-semibold text-gray-900 mb-1">Description</dt>
                      <dd className="text-gray-600 leading-relaxed">{resource.description}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourcePreview;
