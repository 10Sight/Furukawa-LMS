import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconAlertCircle, IconCheck, IconInfoCircle, IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export const FormSelect = ({
  id,
  label,
  value,
  onValueChange,
  options,
  placeholder,
  error,
  success,
  helperText,
  required = false,
  optional = false,
  disabled = false,
  className = "",
  variant = "default", // default, filled, minimal
  size = "default", // sm, default, lg
  icon,
  allowClear = false,
  searchable = false,
  multiple = false,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const sizeClasses = {
    sm: "h-8",
    default: "h-10",
    lg: "h-12"
  };

  const variantClasses = {
    default: "border bg-background",
    filled: "border-0 bg-muted/50 focus:bg-muted/80",
    minimal: "border-0 border-b rounded-none bg-transparent focus:border-b-2"
  };

  // Use loose equality to handle string/number mismatches
  const selectedOption = options.find(opt => String(opt.value) === String(value));
  const hasValue = value !== null && value !== undefined && value !== "";

  return (
    <div className={cn("group space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label
            htmlFor={id}
            className={cn(
              "flex items-center gap-2 font-medium transition-colors",
              "group-focus-within:text-primary",
              error ? "text-destructive" : "text-foreground"
            )}
          >
            {icon && <span className="text-muted-foreground">{icon}</span>}
            <span>{label}</span>
            {required && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0 h-4">
                Required
              </Badge>
            )}
            {optional && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                Optional
              </Badge>
            )}
          </Label>
          {options.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {options.length} option{options.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <div className={cn(
        "relative transition-all duration-200 rounded-lg",
        "focus-within:ring-2 focus-within:ring-primary/20",
        error && "focus-within:ring-destructive/20",
        disabled && "opacity-60 cursor-not-allowed",
        variantClasses[variant]
      )}>
        <Select
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          onOpenChange={setIsOpen}
          {...props}
        >
          <SelectTrigger
            id={id}
            className={cn(
              "transition-all duration-200 border-0 bg-transparent shadow-none focus:ring-0",
              sizeClasses[size],
              icon && "pl-10",
              (error || success) && "pr-10",
              error && "text-destructive",
              success && "text-green-700",
              disabled && "cursor-not-allowed",
              hasValue && "text-foreground",
              !hasValue && "text-muted-foreground"
            )}
          >
            {/* Start Icon */}
            {icon && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                {icon}
              </div>
            )}

            <SelectValue placeholder={placeholder}>
              {selectedOption ? (
                <div className="flex items-center gap-2 w-full">
                  {selectedOption.icon && <span className="text-muted-foreground flex-shrink-0">{selectedOption.icon}</span>}
                  <span className="truncate">{selectedOption.label}</span>
                </div>
              ) : (hasValue ? String(value) : null)}
            </SelectValue>

            {/* Status Icons */}
            <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {success && !error && (
                <IconCheck className="h-4 w-4 text-green-500" />
              )}
              {error && (
                <IconAlertCircle className="h-4 w-4 text-destructive" />
              )}
            </div>


          </SelectTrigger>

          <SelectContent className="max-h-60">
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  "flex items-center justify-between",
                  option.description && "flex-col items-start"
                )}
              >
                <div className="flex items-center gap-2">
                  {option.icon && <span className="text-muted-foreground">{option.icon}</span>}
                  <span>{option.label}</span>
                </div>
                {option.description && (
                  <span className="text-xs text-muted-foreground mt-1">
                    {option.description}
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Focus indicator for minimal variant */}
        {variant === "minimal" && (
          <div className={cn(
            "absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-200",
            isOpen ? "w-full" : "w-0"
          )} />
        )}

        {/* Clear button */}
        {allowClear && hasValue && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onValueChange("");
            }}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted/50"
            tabIndex={-1}
            aria-label="Clear selection"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Helper Text */}
      {helperText && !error && (
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <IconInfoCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>{helperText}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive animate-in slide-in-from-left-2 duration-200">
          <IconAlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{error}</p>
            {helperText && (
              <p className="text-xs text-muted-foreground mt-1">{helperText}</p>
            )}
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && !error && (
        <div className="flex items-start gap-2 text-sm text-green-600 animate-in slide-in-from-left-2 duration-200">
          <IconCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{success}</p>
            {helperText && (
              <p className="text-xs text-muted-foreground mt-1">{helperText}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
