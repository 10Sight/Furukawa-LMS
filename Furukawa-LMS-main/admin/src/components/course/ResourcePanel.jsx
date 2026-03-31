import React, { useState } from "react";
import {
  useGetResourcesByModuleQuery,
  useCreateResourceMutation,
  useDeleteResourceMutation,
} from "../../Redux/AllApi/resourceApi";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconFileText,
  IconExternalLink,
  IconLoader,
  IconPlus,
  IconTrash,
  IconVideo,
  IconFileTypePdf,
  IconFileTypePpt,
  IconPhoto,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ResourcePanel = ({ moduleId, moduleTitle }) => {
  const { data, isLoading, error, refetch } = useGetResourcesByModuleQuery(
    moduleId,
    { skip: !moduleId }
  );
  const [createResource, { isLoading: isCreatingResource }] =
    useCreateResourceMutation();
  const [deleteResource, { isLoading: isDeletingResource }] =
    useDeleteResourceMutation();

  const [newResource, setNewResource] = useState({
    title: "",
    type: "VIDEO",
    url: "",
    file: null,
  });
  const [showAddResource, setShowAddResource] = useState(false);
  const [resourceErrors, setResourceErrors] = useState({});
  const [fileName, setFileName] = useState("");

  const handleResourceInputChange = (e) => {
    const { name, value } = e.target;
    setNewResource((prev) => ({ ...prev, [name]: value }));
    if (resourceErrors[name]) {
      setResourceErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewResource((prev) => {
        const updated = { ...prev, file };
        if (!prev.title) {
          updated.title = file.name;
        }
        return updated;
      });
      setFileName(file.name);
    }
  };

  const validateResourceForm = () => {
    const errors = {};
    if (!newResource.title?.trim()) errors.title = "Title is required";
    if (!newResource.file && !newResource.url?.trim()) {
      errors.url = "Either URL or file is required";
    }
    return errors;
  };

  const handleAddResource = async (e) => {
    e.preventDefault();

    const errors = validateResourceForm();
    if (Object.keys(errors).length > 0) {
      setResourceErrors(errors);
      toast.error("Please fix the form errors");
      return;
    }

    try {
      await createResource({
        moduleId,
        title: newResource.title.trim(),
        type: newResource.type,
        url: newResource.url.trim(),
        file: newResource.file,
      }).unwrap();

      toast.success("Resource added successfully!");
      setNewResource({
        title: "",
        type: "VIDEO",
        url: "",
        file: null,
      });
      setFileName("");
      setResourceErrors({});
      setShowAddResource(false);
      refetch();
    } catch (err) {
      console.error("Add resource error:", err);
      const errorMessage = err?.data?.message || "Failed to add resource";
      toast.error(errorMessage);
    }
  };

  const handleDeleteResource = async (resourceId) => {
    if (!window.confirm("Are you sure you want to delete this resource?")) {
      return;
    }

    try {
      await deleteResource(resourceId).unwrap();
      toast.success("Resource deleted successfully!");
      refetch();
    } catch (err) {
      console.error("Delete resource error:", err);
      const errorMessage = err?.data?.message || "Failed to delete resource";
      toast.error(errorMessage);
    }
  };

  const getResourceIcon = (type) => {
    switch (type) {
      case "VIDEO":
        return <IconVideo className="h-4 w-4 text-red-500" />;
      case "PDF":
        return <IconFileTypePdf className="h-4 w-4 text-red-600" />;
      case "PPT":
        return <IconFileTypePpt className="h-4 w-4 text-orange-500" />;
      case "IMAGE":
        return <IconPhoto className="h-4 w-4 text-green-500" />;
      default:
        return <IconFileText className="h-4 w-4 text-blue-500" />;
    }
  };

  // Function to truncate long text with ellipsis
  const truncateText = (text, maxLength = 40) => {
    if (!text) return "";
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  if (!moduleId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resources</CardTitle>
          <CardDescription>
            Select a module from the left to view and manage its resources.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center p-6 border-2 border-dashed rounded-lg">
            <IconFileText className="h-10 w-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No module selected
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resources</CardTitle>
          <CardDescription>
            Resources for "{moduleTitle}"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resources</CardTitle>
          <CardDescription>
            Resources for "{moduleTitle}"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">Failed to load resources</p>
        </CardContent>
      </Card>
    );
  }

  const resources = data?.data || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Resources</CardTitle>
            <CardDescription>
              Resources for "{moduleTitle}"
            </CardDescription>
          </div>
          <Dialog open={showAddResource} onOpenChange={setShowAddResource}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <IconPlus className="h-3 w-3" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Resource to "{moduleTitle}"</DialogTitle>
                <DialogDescription>
                  Add a new learning resource to this module.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAddResource} className="space-y-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="resource-title">Resource Title</Label>
                  <Input
                    id="resource-title"
                    name="title"
                    value={newResource.title}
                    onChange={handleResourceInputChange}
                    placeholder="Enter resource title"
                    className={resourceErrors.title ? "border-red-500" : ""}
                  />
                  {resourceErrors.title && (
                    <p className="text-sm text-red-600">{resourceErrors.title}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="resource-type">Resource Type</Label>
                  <Select
                    value={newResource.type}
                    onValueChange={(value) =>
                      setNewResource((prev) => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select resource type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIDEO">Video</SelectItem>
                      <SelectItem value="PDF">PDF Document</SelectItem>
                      <SelectItem value="PPT">PowerPoint</SelectItem>
                      <SelectItem value="IMAGE">Image</SelectItem>
                      <SelectItem value="TEXT">Text</SelectItem>
                      <SelectItem value="LINK">External Link</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="resource-url">
                    URL (Optional if uploading file)
                  </Label>
                  <Input
                    id="resource-url"
                    name="url"
                    value={newResource.url}
                    onChange={handleResourceInputChange}
                    placeholder="Enter resource URL"
                    className={resourceErrors.url ? "border-red-500" : ""}
                  />
                  {resourceErrors.url && (
                    <p className="text-sm text-red-600">{resourceErrors.url}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="resource-file">
                    Upload File (Optional if providing URL)
                  </Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <Input
                      id="resource-file"
                      name="file"
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Label
                      htmlFor="resource-file"
                      className="flex flex-col items-center justify-center gap-2 cursor-pointer"
                    >
                      <IconUpload className="h-8 w-8 text-gray-400" />
                      <div>
                        <span className="font-medium text-blue-600">
                          Click to upload
                        </span>
                        <span className="text-gray-500"> or drag and drop</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Supported formats: PDF, PPT, Images, Videos
                      </p>
                    </Label>
                    {fileName && (
                      <div className="mt-3 bg-blue-50 border border-blue-200 rounded-md p-2">
                        <div className="flex items-center justify-between">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm font-medium truncate block max-w-[200px]">
                                  {truncateText(fileName, 30)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{fileName}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setNewResource((prev) => ({ ...prev, file: null }));
                              setFileName("");
                            }}
                            className="h-4 w-4 text-red-500"
                          >
                            <IconX className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You must provide either a URL or a file
                  </p>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddResource(false);
                      setResourceErrors({});
                      setFileName("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isCreatingResource}
                    className="gap-2"
                  >
                    {isCreatingResource && (
                      <IconLoader className="h-4 w-4 animate-spin" />
                    )}
                    {isCreatingResource ? "Adding..." : "Add Resource"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {resources.length === 0 ? (
          <div className="text-center p-6 border-2 border-dashed rounded-lg">
            <IconFileText className="h-10 w-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No resources added yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Add your first resource to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {resources.map((resource) => (
              <div
                key={resource._id}
                className="border rounded-lg p-3 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-slate-100 rounded-md mt-0.5">
                      {getResourceIcon(resource.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <h5 className="font-medium truncate">
                              {truncateText(resource.title, 50)}
                            </h5>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{resource.title}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {resource.type}
                      </Badge>
                      {resource.url && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs text-muted-foreground truncate mt-1">
                                {truncateText(resource.url, 50)}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md">
                              <p className="break-all">{resource.url}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {resource.fileName && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs text-muted-foreground truncate mt-1">
                                File: {truncateText(resource.fileName, 40)}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{resource.fileName}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {(resource.url || resource.fileUrl) && (
                      <a
                        href={resource.url || resource.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1 p-1 rounded hover:bg-blue-50"
                        onClick={(e) => e.stopPropagation()}
                        title="View resource"
                      >
                        <IconExternalLink className="h-4 w-4" />
                      </a>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteResource(resource._id)}
                      disabled={isDeletingResource}
                      className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50"
                      title="Delete resource"
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ResourcePanel;