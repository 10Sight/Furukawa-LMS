// components/course/CModuleForm.jsx
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormInput, FormTextarea } from "@/components/form/index";
import { ResourceForm } from "./ResourceForm";
import { IconArrowUp, IconArrowDown, IconTrash, IconPlus } from "@tabler/icons-react";

export const CModuleForm = ({
  module,
  index,
  errors = {},
  onUpdate,
  onRemove,
  onMove,
  onToggleExpand,
  onAddResource,
  onUpdateResource,
  onRemoveResource,
}) => {
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary">Module {module.order}</Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMove(module.id, "up")}
            disabled={index === 0}
          >
            <IconArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMove(module.id, "down")}
            disabled={index === module.length - 1}
          >
            <IconArrowDown className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onToggleExpand(module.id)}
          >
            {module.isExpanded ? "Collapse" : "Expand"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(module.id)}
            className="text-red-600 hover:text-red-800"
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {module.isExpanded && (
        <div className="space-y-4">
          <FormInput
            label="Module Title *"
            value={module.title}
            onChange={(e) => onUpdate(module.id, "title", e.target.value)}
            placeholder="Enter module title"
            error={errors[`module-${module.id}-title`]}
          />

          <FormTextarea
            label="Description"
            value={module.description}
            onChange={(e) => onUpdate(module.id, "description", e.target.value)}
            placeholder="Enter module description"
            rows={2}
          />

          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Resources</h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAddResource(module.id)}
              className="gap-2"
            >
              <IconPlus className="h-4 w-4" />
              Add Resource
            </Button>
          </div>

          {module.resources.map((resource) => (
            <ResourceForm
              key={resource.id}
              resource={resource}
              onUpdate={(field, value) =>
                onUpdateResource(module.id, resource.id, field, value)
              }
              onRemove={() => onRemoveResource(module.id, resource.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};