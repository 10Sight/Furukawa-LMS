import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/form/index";
import { IconTrash, IconUpload, IconX, IconFile } from "@tabler/icons-react";

const resourceTypeOptions = [
  { value: "pdf", label: "PDF" },
  { value: "video", label: "Video" },
  { value: "link", label: "External Link" },
  { value: "document", label: "Document" },
  { value: "image", label: "Image" },
];

export const ResourceForm = ({ resource, onUpdate, onRemove }) => {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Simmons upload process
    setIsUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          onUpdate("file", file); // Store actual File object
          onUpdate("uploadedFile", file.name);
          return 100;
        }
        return prev + 10;
      });
    }, 100);
  };

  const removeUploadedFile = () => {
    onUpdate("file", null);
    onUpdate("uploadedFile", "");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUrlChange = (value) => {
    onUpdate("url", value);
    // Clear uploaded file if URL is manually entered
    if (value && resource.uploadedFile) {
      onUpdate("uploadedFile", "");
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Resource</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-red-600 hover:text-red-800 hover:bg-red-50"
        >
          <IconTrash className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Title *</Label>
          <Input
            value={resource.title}
            onChange={(e) => onUpdate("title", e.target.value)}
            placeholder="Resource title"
            className="focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-2">
          <Label>Type *</Label>
          <FormSelect
            value={resource.type}
            onValueChange={(value) => onUpdate("type", value)}
            options={resourceTypeOptions}
            placeholder="Select type"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Resource Content</Label>

        {/* File Upload Option */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept={
              resource.type === "PDF" ? ".pdf" :
                resource.type === "IMAGE" ? "image/*" :
                  resource.type === "VIDEO" ? "video/*" :
                    resource.type === "DOCUMENT" ? ".doc,.docx,.txt" :
                      "*"
            }
          />

          {resource.uploadedFile ? (
            <div className="flex items-center justify-between bg-blue-50 p-3 rounded-md">
              <div className="flex items-center gap-2">
                <IconFile className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium truncate">{resource.uploadedFile}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeUploadedFile}
                className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
              >
                <IconX className="h-4 w-4" />
              </Button>
            </div>
          ) : isUploading ? (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600">Uploading... {uploadProgress}%</p>
            </div>
          ) : (
            <div className="space-y-2">
              <IconUpload className="h-8 w-8 text-gray-400 mx-auto" />
              <p className="text-sm text-gray-600">
                Drag & drop a file or{" "}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  browse files
                </button>
              </p>
              <p className="text-xs text-gray-500">
                Supports {resource.type === "PDF" ? "PDF files" :
                  resource.type === "IMAGE" ? "images" :
                    resource.type === "VIDEO" ? "videos" :
                      resource.type === "DOCUMENT" ? "documents" :
                        "all file types"}
              </p>
            </div>
          )}
        </div>

        {/* OR separator */}
        <div className="relative flex items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="mx-3 text-sm text-gray-500">OR</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        {/* URL Input */}
        <div className="space-y-2">
          <Label>External URL</Label>
          <Input
            value={resource.url && !resource.uploadedFile ? resource.url : ""}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://example.com/resource"
            className="focus:ring-2 focus:ring-blue-500"
            disabled={!!resource.uploadedFile}
          />
          <p className="text-xs text-gray-500">
            Provide a URL to external resource {resource.uploadedFile && "(disabled when file is uploaded)"}
          </p>
        </div>
      </div>
    </div>
  );
};