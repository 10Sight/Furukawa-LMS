import React from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  IconEdit,
  IconPlus,
  IconLoader,
  IconArrowLeft,
} from "@tabler/icons-react";

const ModuleForm = ({
  formData,
  formErrors,
  editingModule,
  modules,
  isCreating,
  isUpdating,
  handleInputChange,
  handleSubmit,
  handleCancelEdit,
  navigate
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {editingModule ? (
            <IconEdit className="h-5 w-5" />
          ) : (
            <IconPlus className="h-5 w-5" />
          )}
          {editingModule ? "Edit Module" : "Add New Module"}
        </CardTitle>
        <CardDescription>
          {editingModule
            ? `Update the "${editingModule.title}" module`
            : "Create a new module for this course. All fields are required."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Module Title</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter module title"
              className={formErrors.title ? "border-red-500" : ""}
            />
            {formErrors.title && (
              <p className="text-sm text-red-600">{formErrors.title}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter module description"
              rows={3}
              className={formErrors.description ? "border-red-500" : ""}
            />
            {formErrors.description && (
              <p className="text-sm text-red-600">{formErrors.description}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="order">Order</Label>
            <Input
              id="order"
              name="order"
              type="number"
              min="1"
              value={formData.order}
              onChange={handleInputChange}
              placeholder="Enter module order"
              className={formErrors.order ? "border-red-500" : ""}
            />
            {formErrors.order && (
              <p className="text-sm text-red-600">{formErrors.order}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Suggested next order: {modules.length + 1}
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            {editingModule && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
              >
                Cancel Edit
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
            >
              Back to Courses
            </Button>
            <Button
              type="submit"
              disabled={isCreating || isUpdating}
              className="gap-2"
            >
              {(isCreating || isUpdating) && (
                <IconLoader className="h-4 w-4 animate-spin" />
              )}
              {isCreating
                ? "Creating..."
                : isUpdating
                ? "Updating..."
                : editingModule
                ? "Update Module"
                : "Create Module"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ModuleForm;