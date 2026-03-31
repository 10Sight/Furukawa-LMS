import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/form/index";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IconUpload,
  IconX,
  IconFile,
  IconLoader,
  IconVideo,
  IconFileText,
  IconPhoto,
  IconLink,
  IconFileZip
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useCreateResourceMutation } from "@/Redux/AllApi/resourceApi";

const resourceTypeOptions = [
  { value: "pdf", label: "PDF Document", icon: IconFileText },
  { value: "video", label: "Video", icon: IconVideo },
  { value: "image", label: "Image", icon: IconPhoto },
  { value: "link", label: "External Link", icon: IconLink },
  { value: "text", label: "Text Document", icon: IconFileText },
];

export const ResourceManagementModal = ({ 
  isOpen, 
  onClose, 
  scope, 
  courseId, 
  moduleId, 
  lessonId,
  entityName = "" 
}) => {
  const fileInputRef = useRef(null);
  const [createResource, { isLoading: isCreatingResource }] = useCreateResourceMutation();
  
  const [formData, setFormData] = useState({
    title: "",
    type: "",
    description: "",
    url: "",
    file: null,
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const resetForm = () => {
    setFormData({
      title: "",
      type: "",
      description: "",
      url: "",
      file: null,
    });
    setIsUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFormData(prev => ({
      ...prev,
      file: file,
      url: "" // Clear URL when file is selected
    }));
  };

  const handleUrlChange = (value) => {
    setFormData(prev => ({
      ...prev,
      url: value,
      file: null // Clear file when URL is entered
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = () => {
    setFormData(prev => ({
      ...prev,
      file: null
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

    if (!formData.file && !formData.url.trim()) {
      toast.error("Either a file or URL must be provided");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      const formDataToSend = new FormData();
      
      // Add required fields
      formDataToSend.append("title", formData.title.trim());
      formDataToSend.append("type", formData.type);
      formDataToSend.append("scope", scope);
      
      if (formData.description.trim()) {
        formDataToSend.append("description", formData.description.trim());
      }

      // Add the appropriate ID based on scope
      if (scope === "course" && courseId) {
        formDataToSend.append("courseId", courseId);
      } else if (scope === "module" && moduleId) {
        formDataToSend.append("moduleId", moduleId);
      } else if (scope === "lesson" && lessonId) {
        formDataToSend.append("lessonId", lessonId);
      }

      // Add file or URL
      if (formData.file) {
        formDataToSend.append("file", formData.file);
      } else if (formData.url.trim()) {
        formDataToSend.append("url", formData.url.trim());
      }

      await createResource(formDataToSend).unwrap();
      
      toast.success(`Resource added to ${scope} successfully!`);
      resetForm();
      onClose();
    } catch (error) {
      console.error("Create resource error:", error);
      toast.error(error?.data?.message || `Failed to add resource to ${scope}`);
    }
  };

  const getFileAccept = () => {
    switch (formData.type) {
      case "pdf": return ".pdf";
      case "image": return "image/*";
      case "video": return "video/*";
      case "text": return ".txt,.doc,.docx";
      default: return "*";
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Resource to {getScopeDisplayName()}</DialogTitle>
          <DialogDescription>
            Add a new resource to {entityName ? `"${entityName}"` : `this ${scope}`}. 
            Resources can be files uploaded to Cloudinary or external links.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Resource Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="Enter resource title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Resource Type *</Label>
              <FormSelect
                value={formData.type}
                onValueChange={(value) => handleInputChange("type", value)}
                options={resourceTypeOptions}
                placeholder="Select resource type"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Describe this resource..."
              rows={3}
            />
          </div>

          {/* File Upload Section */}
          <div className="space-y-4">
            <Label>Resource Content</Label>
            
            {/* File Upload Option */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept={getFileAccept()}
              />
              
              {formData.file ? (
                <div className="flex items-center justify-between bg-blue-50 p-4 rounded-md">
                  <div className="flex items-center gap-3">
                    <IconFile className="h-6 w-6 text-blue-600" />
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
                    <IconX className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <IconUpload className="h-12 w-12 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-sm text-gray-600">
                      Drop a file here or{" "}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        browse files
                      </button>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      File will be uploaded to Cloudinary
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* OR separator */}
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="mx-4 text-sm text-gray-500 bg-white px-2">OR</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            {/* URL Input */}
            <div className="space-y-2">
              <Label htmlFor="url">External URL</Label>
              <Input
                id="url"
                value={formData.url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://example.com/resource"
                disabled={!!formData.file}
              />
              <p className="text-xs text-gray-500">
                {formData.file 
                  ? "URL input is disabled when a file is selected"
                  : "Provide a URL to an external resource"
                }
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => {
              resetForm();
              onClose();
            }}
            disabled={isCreatingResource}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isCreatingResource}
            className="gap-2"
          >
            {isCreatingResource && <IconLoader className="h-4 w-4 animate-spin" />}
            {isCreatingResource ? "Adding..." : "Add Resource"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
