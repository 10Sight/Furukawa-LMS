import React, { useState } from 'react';
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
  Download,
  Video,
  FileText,
  FileImage,
  ExternalLink,
  Eye,
  Play,
  Lock,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const ModuleResources = ({ 
  resources, 
  isUnlocked, 
  completedResourceIds = [],
  onResourceComplete,
  onNext,
  canProceed 
}) => {
  const [viewedResources, setViewedResources] = useState(() => new Set(completedResourceIds));
  
  const getResourceIcon = (type) => {
    switch(type?.toLowerCase()) {
      case 'video':
        return <Video className="h-5 w-5" />;
      case 'pdf':
      case 'document':
        return <FileText className="h-5 w-5" />;
      case 'image':
        return <FileImage className="h-5 w-5" />;
      case 'link':
        return <ExternalLink className="h-5 w-5" />;
      default:
        return <Download className="h-5 w-5" />;
    }
  };

  const handleResourceView = (resourceId, url, type) => {
    if (!isUnlocked) return;
    
    // Open in new window/tab
    window.open(url, '_blank');
    
    // Mark as viewed
    if (!viewedResources.has(resourceId)) {
      const newViewed = new Set(viewedResources);
      newViewed.add(resourceId);
      setViewedResources(newViewed);
      
      if (onResourceComplete) {
        onResourceComplete(resourceId);
      }
    }
  };

  const handleDownload = (url, filename) => {
    if (!isUnlocked) return;
    
    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'resource';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const allResourcesViewed = resources.every(resource => 
    viewedResources.has(resource._id || resource.id)
  );

  if (!isUnlocked) {
    return (
      <div className="space-y-6">
        <Alert className="bg-amber-50 border-amber-200">
          <Lock className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span className="text-amber-800">
                Complete all lessons first to unlock module resources
              </span>
            </div>
          </AlertDescription>
        </Alert>
        
        <div className="grid gap-4">
          {resources.map((resource, index) => (
            <Card key={index} className="opacity-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Lock className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-500">
                      {resource.title || `Resource ${index + 1}`}
                    </h3>
                    <p className="text-sm text-gray-400">
                      Locked - Complete lessons first
                    </p>
                  </div>
                  <Badge variant="outline" className="text-gray-400">
                    {resource.type || 'FILE'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Module Resources</h2>
        <p className="text-muted-foreground">
          Study materials and additional content for this module. 
          View or download resources to continue learning.
        </p>
      </div>

      {/* Progress Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <CheckCircle2 className="h-4 w-4 text-blue-600" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <span className="text-blue-800">
              {viewedResources.size} of {resources.length} resources viewed
            </span>
            <Badge variant="outline" className="text-blue-600">
              {Math.round((viewedResources.size / resources.length) * 100)}% Complete
            </Badge>
          </div>
        </AlertDescription>
      </Alert>

      {/* Resources Grid */}
      <div className="grid gap-4">
        {resources.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Resources Available</h3>
              <p className="text-muted-foreground">
                This module doesn't have any additional resources.
              </p>
            </CardContent>
          </Card>
        ) : (
          resources.map((resource, index) => {
            const resourceId = resource._id || resource.id;
            const isViewed = viewedResources.has(resourceId);
            
            return (
              <Card 
                key={resourceId || index} 
                className={`transition-all hover:shadow-md ${
                  isViewed ? 'bg-green-50 border-green-200' : 'hover:bg-gray-50'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${
                      isViewed ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {isViewed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        getResourceIcon(resource.type)
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">
                          {resource.title || `Resource ${index + 1}`}
                        </h3>
                        {isViewed && (
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                            Viewed
                          </Badge>
                        )}
                      </div>
                      
                      {resource.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {resource.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {resource.type?.toUpperCase() || 'FILE'}
                        </Badge>
                        {resource.size && (
                          <span className="text-xs text-muted-foreground">
                            {resource.size}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Preview/View Button */}
                      <Button
                        onClick={() => handleResourceView(resourceId, resource.url, resource.type)}
                        variant="outline"
                        size="sm"
                      >
                        {resource.type === 'video' ? (
                          <>
                            <Play className="h-3 w-3 mr-1" />
                            Play
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3 mr-1" />
                            {resource.type === 'link' ? 'Visit' : 'Preview'}
                          </>
                        )}
                      </Button>
                      
                      {/* Download Button (for non-link resources) */}
                      {resource.type !== 'link' && (
                        <Button
                          onClick={() => handleDownload(resource.url, resource.title)}
                          variant="outline"
                          size="sm"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Next Button */}
      {resources.length > 0 && allResourcesViewed && canProceed && (
        <div className="flex justify-center pt-6 border-t">
          <Button onClick={onNext} size="lg" className="bg-green-600 hover:bg-green-700">
            <ArrowRight className="h-4 w-4 mr-2" />
            Continue to Next Stage
          </Button>
        </div>
      )}
      
      {resources.length === 0 && canProceed && (
        <div className="flex justify-center pt-6 border-t">
          <Button onClick={onNext} size="lg" className="bg-green-600 hover:bg-green-700">
            <ArrowRight className="h-4 w-4 mr-2" />
            No Resources - Continue
          </Button>
        </div>
      )}
    </div>
  );
};

export default ModuleResources;
