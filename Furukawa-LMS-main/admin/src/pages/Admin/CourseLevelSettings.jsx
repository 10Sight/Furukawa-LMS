import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Settings,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle,
  Star,
  MoveUp,
  MoveDown,
  Edit,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetAllConfigsQuery,
  useGetActiveConfigQuery,
  useCreateConfigMutation,
  useUpdateConfigMutation,
  useDeleteConfigMutation,
  useSetAsDefaultMutation,
  useValidateCompatibilityMutation,
} from "@/Redux/AllApi/CourseLevelConfigApi";

const CourseLevelSettings = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [configToDelete, setConfigToDelete] = useState(null);
  
  // Form state
  const [configName, setConfigName] = useState("");
  const [configDescription, setConfigDescription] = useState("");
  const [levels, setLevels] = useState([
    {
      name: "L1",
      order: 0,
      completionTimeframe: { minDays: 1, maxDays: 4 },
      description: "Beginner Level",
      color: "#3B82F6",
    },
  ]);

  // RTK Query hooks
  const { data: configsData, isLoading: configsLoading, refetch: refetchConfigs } = useGetAllConfigsQuery();
  const { data: activeConfigData } = useGetActiveConfigQuery();
  const [createConfig, { isLoading: isCreatingConfig }] = useCreateConfigMutation();
  const [updateConfig, { isLoading: isUpdatingConfig }] = useUpdateConfigMutation();
  const [deleteConfig, { isLoading: isDeletingConfig }] = useDeleteConfigMutation();
  const [setAsDefault, { isLoading: isSettingDefault }] = useSetAsDefaultMutation();
  const [validateCompatibility] = useValidateCompatibilityMutation();

  const configs = configsData?.data || [];
  const activeConfig = activeConfigData?.data;

  // Reset form
  const resetForm = () => {
    setConfigName("");
    setConfigDescription("");
    setLevels([
      {
        name: "L1",
        order: 0,
        completionTimeframe: { minDays: 1, maxDays: 4 },
        description: "Beginner Level",
        color: "#3B82F6",
      },
    ]);
    setIsCreating(false);
    setIsEditing(false);
    setSelectedConfig(null);
  };

  // Handle edit
  const handleEdit = (config) => {
    setSelectedConfig(config);
    setConfigName(config.name);
    setConfigDescription(config.description || "");
    setLevels(config.levels || []);
    setIsEditing(true);
  };

  // Add new level
  const handleAddLevel = () => {
    const newOrder = levels.length;
    setLevels([
      ...levels,
      {
        name: `L${newOrder}`,
        order: newOrder,
        completionTimeframe: { minDays: 1, maxDays: 4 },
        description: "",
        color: "#3B82F6",
      },
    ]);
  };

  // Remove level
  const handleRemoveLevel = (index) => {
    if (levels.length === 1) {
      toast.error("At least one level is required");
      return;
    }
    const newLevels = levels.filter((_, i) => i !== index);
    // Reorder levels
    const reorderedLevels = newLevels.map((level, i) => ({ ...level, order: i }));
    setLevels(reorderedLevels);
  };

  // Move level up
  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newLevels = [...levels];
    [newLevels[index - 1], newLevels[index]] = [newLevels[index], newLevels[index - 1]];
    // Update orders
    const reorderedLevels = newLevels.map((level, i) => ({ ...level, order: i }));
    setLevels(reorderedLevels);
  };

  // Move level down
  const handleMoveDown = (index) => {
    if (index === levels.length - 1) return;
    const newLevels = [...levels];
    [newLevels[index], newLevels[index + 1]] = [newLevels[index + 1], newLevels[index]];
    // Update orders
    const reorderedLevels = newLevels.map((level, i) => ({ ...level, order: i }));
    setLevels(reorderedLevels);
  };

  // Update level field
  const handleLevelChange = (index, field, value) => {
    const newLevels = [...levels];
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      newLevels[index][parent] = {
        ...newLevels[index][parent],
        [child]: parseInt(value) || 0,
      };
    } else {
      newLevels[index][field] = value;
    }
    setLevels(newLevels);
  };

  // Validate form
  const validateForm = () => {
    if (!configName.trim()) {
      toast.error("Configuration name is required");
      return false;
    }

    if (levels.length === 0) {
      toast.error("At least one level is required");
      return false;
    }

    // Check for duplicate level names
    const levelNames = levels.map((l) => l.name.toUpperCase());
    const uniqueNames = [...new Set(levelNames)];
    if (levelNames.length !== uniqueNames.length) {
      toast.error("Level names must be unique");
      return false;
    }

    // Validate timeframes
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      if (!level.name.trim()) {
        toast.error(`Level ${i + 1} must have a name`);
        return false;
      }
      if (level.completionTimeframe.minDays < 0 || level.completionTimeframe.maxDays < 0) {
        toast.error(`Level ${i + 1} cannot have negative days`);
        return false;
      }
      if (level.completionTimeframe.minDays > level.completionTimeframe.maxDays) {
        toast.error(`Level ${i + 1}: min days cannot be greater than max days`);
        return false;
      }
    }

    return true;
  };

  // Handle create
  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      // Validate compatibility
      const compatibilityResult = await validateCompatibility({ levels }).unwrap();
      
      if (!compatibilityResult.data.isCompatible) {
        toast.warning(
          `Warning: ${compatibilityResult.data.affectedStudentsCount} students have levels that won't exist in this configuration. Consider migrating them first.`
        );
      }

      const result = await createConfig({
        name: configName,
        description: configDescription,
        levels,
        isDefault: configs.length === 0, // Set as default if it's the first one
      }).unwrap();

      toast.success("Configuration created successfully");
      resetForm();
      refetchConfigs();
    } catch (error) {
      console.error("Error creating configuration:", error);
      toast.error(error.data?.message || "Failed to create configuration");
    }
  };

  // Handle update
  const handleUpdate = async () => {
    if (!validateForm()) return;

    try {
      await updateConfig({
        id: selectedConfig._id,
        name: configName,
        description: configDescription,
        levels,
      }).unwrap();

      toast.success("Configuration updated successfully");
      resetForm();
      refetchConfigs();
    } catch (error) {
      console.error("Error updating configuration:", error);
      toast.error(error.data?.message || "Failed to update configuration");
    }
  };

  // Handle delete
  const handleDelete = async () => {
    try {
      await deleteConfig(configToDelete._id).unwrap();
      toast.success("Configuration deleted successfully");
      setShowDeleteDialog(false);
      setConfigToDelete(null);
      refetchConfigs();
    } catch (error) {
      console.error("Error deleting configuration:", error);
      toast.error(error.data?.message || "Failed to delete configuration");
    }
  };

  // Handle set as default
  const handleSetAsDefault = async (configId) => {
    try {
      await setAsDefault(configId).unwrap();
      toast.success("Configuration set as default");
      refetchConfigs();
    } catch (error) {
      console.error("Error setting default:", error);
      toast.error(error.data?.message || "Failed to set as default");
    }
  };

  if (configsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            Course Level Configuration
          </CardTitle>
          <CardDescription>
            Configure course levels and completion timeframes for all courses. This affects student
            progression and level management.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isCreating && !isEditing ? (
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Configuration
            </Button>
          ) : (
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Active Configuration Info */}
      {activeConfig && !isCreating && !isEditing && (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <strong>Active Configuration:</strong> {activeConfig.name} ({activeConfig.levels.length} levels)
          </AlertDescription>
        </Alert>
      )}

      {/* Create/Edit Form */}
      {(isCreating || isEditing) && (
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? "Edit Configuration" : "Create New Configuration"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="config-name">Configuration Name*</Label>
                <Input
                  id="config-name"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  placeholder="e.g., 2-Level System, 5-Level Progressive"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="config-description">Description</Label>
                <Textarea
                  id="config-description"
                  value={configDescription}
                  onChange={(e) => setConfigDescription(e.target.value)}
                  placeholder="Describe this configuration..."
                  rows={2}
                />
              </div>
            </div>

            {/* Levels Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Levels</h3>
                <Button size="sm" variant="outline" onClick={handleAddLevel}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Level
                </Button>
              </div>

              <div className="space-y-4">
                {levels.map((level, index) => (
                  <Card key={index} className="bg-slate-50">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        {/* Order Controls */}
                        <div className="flex flex-col gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                          >
                            <MoveUp className="h-4 w-4" />
                          </Button>
                          <span className="text-sm font-medium text-center">{index + 1}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === levels.length - 1}
                          >
                            <MoveDown className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Level Fields */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Level Name*</Label>
                            <Input
                              value={level.name}
                              onChange={(e) => handleLevelChange(index, "name", e.target.value)}
                              placeholder="e.g., L0, Beginner"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Min Days*</Label>
                            <Input
                              type="number"
                              min="0"
                              value={level.completionTimeframe.minDays}
                              onChange={(e) =>
                                handleLevelChange(index, "completionTimeframe.minDays", e.target.value)
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Max Days*</Label>
                            <Input
                              type="number"
                              min="0"
                              value={level.completionTimeframe.maxDays}
                              onChange={(e) =>
                                handleLevelChange(index, "completionTimeframe.maxDays", e.target.value)
                              }
                            />
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label>Description</Label>
                            <Input
                              value={level.description}
                              onChange={(e) => handleLevelChange(index, "description", e.target.value)}
                              placeholder="Describe this level..."
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex gap-2">
                              <Input
                                type="color"
                                value={level.color}
                                onChange={(e) => handleLevelChange(index, "color", e.target.value)}
                                className="w-20"
                              />
                              <Input
                                value={level.color}
                                onChange={(e) => handleLevelChange(index, "color", e.target.value)}
                                placeholder="#3B82F6"
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Delete Button */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveLevel(index)}
                          disabled={levels.length === 1}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Timeframe Preview */}
                      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          Completion timeframe: {level.completionTimeframe.minDays} -{" "}
                          {level.completionTimeframe.maxDays} days
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {isEditing ? (
                <Button onClick={handleUpdate} disabled={isUpdatingConfig}>
                  <Save className="h-4 w-4 mr-2" />
                  {isUpdatingConfig ? "Updating..." : "Update Configuration"}
                </Button>
              ) : (
                <Button onClick={handleCreate} disabled={isCreatingConfig}>
                  <Save className="h-4 w-4 mr-2" />
                  {isCreatingConfig ? "Creating..." : "Create Configuration"}
                </Button>
              )}
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Configurations */}
      {!isCreating && !isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>Existing Configurations</CardTitle>
            <CardDescription>Manage your course level configurations</CardDescription>
          </CardHeader>
          <CardContent>
            {configs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No configurations found. Create one to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Levels</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => (
                    <TableRow key={config._id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{config.name}</div>
                          {config.description && (
                            <div className="text-sm text-muted-foreground">{config.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {config.levels.map((level, idx) => (
                            <Badge
                              key={idx}
                              style={{ backgroundColor: level.color, color: "#fff" }}
                            >
                              {level.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {config.isDefault && (
                            <Badge variant="default" className="w-fit">
                              <Star className="h-3 w-3 mr-1" />
                              Default
                            </Badge>
                          )}
                          {config.isActive && (
                            <Badge variant="success" className="w-fit bg-green-100 text-green-800">
                              Active
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(config.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(config)}>
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          {!config.isDefault && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSetAsDefault(config._id)}
                              disabled={isSettingDefault}
                            >
                              <Star className="h-4 w-4 mr-1" />
                              Set Default
                            </Button>
                          )}
                          {!config.isDefault && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setConfigToDelete(config);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the configuration "{configToDelete?.name}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeletingConfig}>
              {isDeletingConfig ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CourseLevelSettings;
