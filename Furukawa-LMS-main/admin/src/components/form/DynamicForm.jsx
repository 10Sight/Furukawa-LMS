import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FormInput } from "./FormInput";
import { FormSelect } from "./FormSelect";
import { FormTextarea } from "./FormTextarea";
import { FormCard } from "./FormCard";
import { 
  IconPlus, 
  IconTrash, 
  IconGripVertical, 
  IconCopy,
  IconEye,
  IconEyeOff,
  IconRefresh,
  IconCheck,
  IconLoader
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

// Field Types Configuration
const FIELD_TYPES = {
  text: { 
    label: "Text Input", 
    icon: "📝", 
    component: FormInput,
    defaultProps: { type: "text" }
  },
  email: { 
    label: "Email", 
    icon: "📧", 
    component: FormInput,
    defaultProps: { type: "email" }
  },
  password: { 
    label: "Password", 
    icon: "🔒", 
    component: FormInput,
    defaultProps: { type: "password" }
  },
  number: { 
    label: "Number", 
    icon: "🔢", 
    component: FormInput,
    defaultProps: { type: "number" }
  },
  textarea: { 
    label: "Text Area", 
    icon: "📄", 
    component: FormTextarea,
    defaultProps: { rows: 4 }
  },
  select: { 
    label: "Select Dropdown", 
    icon: "📋", 
    component: FormSelect,
    defaultProps: { options: [] }
  },
  multiselect: { 
    label: "Multi Select", 
    icon: "☑️", 
    component: FormSelect,
    defaultProps: { multiple: true, options: [] }
  },
  date: { 
    label: "Date", 
    icon: "📅", 
    component: FormInput,
    defaultProps: { type: "date" }
  },
  time: { 
    label: "Time", 
    icon: "🕐", 
    component: FormInput,
    defaultProps: { type: "time" }
  },
  url: { 
    label: "URL", 
    icon: "🔗", 
    component: FormInput,
    defaultProps: { type: "url" }
  },
  tel: { 
    label: "Phone", 
    icon: "📞", 
    component: FormInput,
    defaultProps: { type: "tel" }
  },
  file: { 
    label: "File Upload", 
    icon: "📎", 
    component: FormInput,
    defaultProps: { type: "file" }
  }
};

// Default field configuration
const createDefaultField = (type = "text") => ({
  id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  type,
  label: `${FIELD_TYPES[type]?.label || "Field"}`,
  placeholder: "",
  required: false,
  disabled: false,
  helperText: "",
  validation: {},
  options: type === "select" || type === "multiselect" ? [] : undefined,
  value: "",
  ...FIELD_TYPES[type]?.defaultProps
});

export const DynamicForm = ({
  initialFields = [],
  onSubmit,
  onFieldsChange,
  showPreview = false,
  allowFieldReordering = true,
  allowFieldDuplication = true,
  allowFieldDeletion = true,
  submitButtonText = "Submit Form",
  isLoading = false,
  className = "",
  variant = "default",
  ...props
}) => {
  const [fields, setFields] = useState(
    initialFields.length > 0 ? initialFields : [createDefaultField()]
  );
  const [draggedField, setDraggedField] = useState(null);
  const [previewMode, setPreviewMode] = useState(showPreview);
  const [formValues, setFormValues] = useState({});
  const [formErrors, setFormErrors] = useState({});

  // Notify parent component of field changes
  const notifyFieldsChange = useCallback((newFields) => {
    if (onFieldsChange) {
      onFieldsChange(newFields);
    }
  }, [onFieldsChange]);

  // Field manipulation functions
  const addField = useCallback((type = "text", index = null) => {
    const newField = createDefaultField(type);
    const newFields = [...fields];
    
    if (index !== null) {
      newFields.splice(index + 1, 0, newField);
    } else {
      newFields.push(newField);
    }
    
    setFields(newFields);
    notifyFieldsChange(newFields);
  }, [fields, notifyFieldsChange]);

  const updateField = useCallback((fieldId, updates) => {
    const newFields = fields.map(field => 
      field.id === fieldId ? { ...field, ...updates } : field
    );
    setFields(newFields);
    notifyFieldsChange(newFields);
  }, [fields, notifyFieldsChange]);

  const duplicateField = useCallback((fieldId) => {
    const fieldIndex = fields.findIndex(f => f.id === fieldId);
    if (fieldIndex !== -1) {
      const originalField = fields[fieldIndex];
      const duplicatedField = {
        ...originalField,
        id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        label: `${originalField.label} (Copy)`
      };
      
      const newFields = [...fields];
      newFields.splice(fieldIndex + 1, 0, duplicatedField);
      setFields(newFields);
      notifyFieldsChange(newFields);
    }
  }, [fields, notifyFieldsChange]);

  const deleteField = useCallback((fieldId) => {
    if (fields.length > 1) {
      const newFields = fields.filter(field => field.id !== fieldId);
      setFields(newFields);
      notifyFieldsChange(newFields);
    }
  }, [fields, notifyFieldsChange]);

  const moveField = useCallback((fromIndex, toIndex) => {
    const newFields = [...fields];
    const [movedField] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, movedField);
    setFields(newFields);
    notifyFieldsChange(newFields);
  }, [fields, notifyFieldsChange]);

  // Form value handling
  const handleFieldValueChange = useCallback((fieldId, value) => {
    setFormValues(prev => ({
      ...prev,
      [fieldId]: value
    }));
    
    // Clear error when user starts typing
    if (formErrors[fieldId]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  }, [formErrors]);

  // Form validation
  const validateForm = useCallback(() => {
    const errors = {};
    
    fields.forEach(field => {
      const value = formValues[field.id];
      
      // Required field validation
      if (field.required && (!value || value.toString().trim() === "")) {
        errors[field.id] = `${field.label} is required`;
        return;
      }
      
      // Type-specific validation
      if (value && field.validation) {
        const { minLength, maxLength, min, max, pattern } = field.validation;
        
        if (minLength && value.length < minLength) {
          errors[field.id] = `${field.label} must be at least ${minLength} characters`;
        }
        if (maxLength && value.length > maxLength) {
          errors[field.id] = `${field.label} must not exceed ${maxLength} characters`;
        }
        if (min !== undefined && Number(value) < min) {
          errors[field.id] = `${field.label} must be at least ${min}`;
        }
        if (max !== undefined && Number(value) > max) {
          errors[field.id] = `${field.label} must not exceed ${max}`;
        }
        if (pattern && !new RegExp(pattern).test(value)) {
          errors[field.id] = `${field.label} format is invalid`;
        }
      }
    });
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [fields, formValues]);

  // Form submission
  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    
    if (validateForm() && onSubmit) {
      const formData = {
        values: formValues,
        fields: fields
      };
      onSubmit(formData);
    }
  }, [validateForm, formValues, fields, onSubmit]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormValues({});
    setFormErrors({});
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback((e, fieldId) => {
    setDraggedField(fieldId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedField(null);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e, targetFieldId) => {
    e.preventDefault();
    
    if (draggedField && draggedField !== targetFieldId) {
      const fromIndex = fields.findIndex(f => f.id === draggedField);
      const toIndex = fields.findIndex(f => f.id === targetFieldId);
      
      if (fromIndex !== -1 && toIndex !== -1) {
        moveField(fromIndex, toIndex);
      }
    }
  }, [draggedField, fields, moveField]);

  // Render field component
  const renderField = (field, index) => {
    const FieldComponent = FIELD_TYPES[field.type]?.component || FormInput;
    const fieldValue = formValues[field.id] || "";
    const fieldError = formErrors[field.id];

    return (
      <div
        key={field.id}
        className={cn(
          "group relative transition-all duration-200",
          !previewMode && "border rounded-lg p-4 hover:border-primary/50",
          draggedField === field.id && "opacity-50"
        )}
        draggable={allowFieldReordering && !previewMode}
        onDragStart={(e) => handleDragStart(e, field.id)}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, field.id)}
      >
        {/* Field Editor Controls */}
        {!previewMode && (
          <div className="absolute -top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background border rounded-md shadow-sm">
            {allowFieldReordering && (
              <button
                type="button"
                className="p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing"
                title="Drag to reorder"
              >
                <IconGripVertical className="h-3 w-3" />
              </button>
            )}
            
            {allowFieldDuplication && (
              <button
                type="button"
                onClick={() => duplicateField(field.id)}
                className="p-1 hover:bg-muted rounded text-blue-600 hover:text-blue-700"
                title="Duplicate field"
              >
                <IconCopy className="h-3 w-3" />
              </button>
            )}
            
            {allowFieldDeletion && fields.length > 1 && (
              <button
                type="button"
                onClick={() => deleteField(field.id)}
                className="p-1 hover:bg-muted rounded text-red-600 hover:text-red-700"
                title="Delete field"
              >
                <IconTrash className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Field Type Indicator */}
        {!previewMode && (
          <div className="flex items-center justify-between mb-3">
            <Badge variant="outline" className="text-xs">
              {FIELD_TYPES[field.type]?.icon} {FIELD_TYPES[field.type]?.label}
            </Badge>
            <select
              value={field.type}
              onChange={(e) => updateField(field.id, { 
                type: e.target.value,
                ...FIELD_TYPES[e.target.value]?.defaultProps
              })}
              className="text-xs border rounded px-2 py-1"
            >
              {Object.entries(FIELD_TYPES).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Field Configuration (Editor Mode) */}
        {!previewMode && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 p-3 bg-muted/30 rounded border-l-2 border-l-muted-foreground/20">
            <FormInput
              label="Field Label"
              value={field.label}
              onChange={(e) => updateField(field.id, { label: e.target.value })}
              size="sm"
            />
            
            <FormInput
              label="Placeholder"
              value={field.placeholder || ""}
              onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
              size="sm"
            />
            
            <FormTextarea
              label="Helper Text"
              value={field.helperText || ""}
              onChange={(e) => updateField(field.id, { helperText: e.target.value })}
              rows={2}
              size="sm"
            />
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.required || false}
                  onChange={(e) => updateField(field.id, { required: e.target.checked })}
                />
                Required
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.disabled || false}
                  onChange={(e) => updateField(field.id, { disabled: e.target.checked })}
                />
                Disabled
              </label>
            </div>
            
            {/* Options for select fields */}
            {(field.type === "select" || field.type === "multiselect") && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Options</label>
                <div className="space-y-2">
                  {(field.options || []).map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center gap-2">
                      <FormInput
                        placeholder="Option label"
                        value={option.label || ""}
                        onChange={(e) => {
                          const newOptions = [...(field.options || [])];
                          newOptions[optionIndex] = { ...option, label: e.target.value };
                          updateField(field.id, { options: newOptions });
                        }}
                        size="sm"
                      />
                      <FormInput
                        placeholder="Option value"
                        value={option.value || ""}
                        onChange={(e) => {
                          const newOptions = [...(field.options || [])];
                          newOptions[optionIndex] = { ...option, value: e.target.value };
                          updateField(field.id, { options: newOptions });
                        }}
                        size="sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newOptions = [...(field.options || [])];
                          newOptions.splice(optionIndex, 1);
                          updateField(field.id, { options: newOptions });
                        }}
                      >
                        <IconTrash className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newOptions = [...(field.options || []), { label: "", value: "" }];
                      updateField(field.id, { options: newOptions });
                    }}
                  >
                    <IconPlus className="h-3 w-3 mr-1" />
                    Add Option
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rendered Field */}
        <FieldComponent
          id={field.id}
          label={previewMode ? field.label : `Preview: ${field.label}`}
          value={fieldValue}
          onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
          placeholder={field.placeholder}
          error={fieldError}
          required={field.required}
          disabled={field.disabled}
          helperText={field.helperText}
          options={field.options}
          variant={variant}
          {...field.validation}
        />

        {/* Add Field Button */}
        {!previewMode && (
          <div className="flex justify-center mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => addField("text", index)}
              className="text-xs"
            >
              <IconPlus className="h-3 w-3 mr-1" />
              Add Field Below
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <FormCard
      title="Dynamic Form Builder"
      description={previewMode ? "Form Preview" : "Design your form by configuring fields"}
      className={cn("w-full", className)}
      actionButton={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreviewMode(!previewMode)}
          >
            {previewMode ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
            <span className="ml-1">{previewMode ? "Edit" : "Preview"}</span>
          </Button>
          
          {previewMode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetForm}
            >
              <IconRefresh className="h-4 w-4" />
              <span className="ml-1">Reset</span>
            </Button>
          )}
        </div>
      }
      {...props}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Form Fields */}
        <div className="space-y-4">
          {fields.map((field, index) => renderField(field, index))}
        </div>

        {/* Add New Field (Editor Mode) */}
        {!previewMode && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-muted-foreground">Add Field:</span>
              {Object.entries(FIELD_TYPES).map(([type, config]) => (
                <Button
                  key={type}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addField(type)}
                  className="text-xs"
                >
                  <span className="mr-1">{config.icon}</span>
                  {config.label}
                </Button>
              ))}
            </div>
          </>
        )}

        {/* Form Actions (Preview Mode) */}
        {previewMode && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {fields.length} field{fields.length !== 1 ? 's' : ''} • 
                {Object.keys(formValues).length} filled • 
                {Object.keys(formErrors).length} error{Object.keys(formErrors).length !== 1 ? 's' : ''}
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={Object.keys(formValues).length === 0}
                >
                  Reset
                </Button>
                
                <Button
                  type="submit"
                  disabled={isLoading || Object.keys(formErrors).length > 0}
                >
                  {isLoading && <IconLoader className="h-4 w-4 mr-2 animate-spin" />}
                  <IconCheck className="h-4 w-4 mr-2" />
                  {submitButtonText}
                </Button>
              </div>
            </div>
          </>
        )}
      </form>
    </FormCard>
  );
};

export { FIELD_TYPES, createDefaultField };
