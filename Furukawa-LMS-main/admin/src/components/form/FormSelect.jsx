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
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { IconAlertCircle, IconCheck, IconInfoCircle, IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export const FormSelect = ({
  id,
  label,
  value,
  onValueChange,
  options = [],
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
  searchable = true,
  multiple = false,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const sizeClasses = {
    sm: "h-8",
    default: "h-10",
    lg: "h-12"
  };

  const minSizeClasses = {
    sm: "min-h-8",
    default: "min-h-10",
    lg: "min-h-12"
  };

  const variantClasses = {
    default: "border bg-background",
    filled: "border-0 bg-muted/50 focus:bg-muted/80",
    minimal: "border-0 border-b rounded-none bg-transparent focus:border-b-2"
  };

  const selectedValues = Array.isArray(value)
    ? value.map(String)
    : (value !== null && value !== undefined && value !== "" ? [String(value)] : []);

  const hasValue = selectedValues.length > 0;

  // Single select option helper
  const selectedOption = !multiple && options.find(opt => String(opt.value) === String(value));

  // Multi select display text
  const triggerText = multiple
    ? (selectedValues.length === 0
        ? placeholder || "Select options..."
        : selectedValues.length === 1
          ? (options.find(opt => String(opt.value) === selectedValues[0])?.label || selectedValues[0])
          : `${selectedValues.length} Selected`)
    : placeholder || "Select option...";

  const handleToggle = (optVal) => {
    const strVal = String(optVal);
    const newValues = selectedValues.includes(strVal)
      ? selectedValues.filter(v => v !== strVal)
      : [...selectedValues, strVal];
    onValueChange(newValues);
  };

  const handleSelectAll = () => {
    const allVals = options.filter(opt => !opt.disabled).map(opt => String(opt.value));
    onValueChange(allVals);
  };

  const handleClearAll = () => {
    onValueChange([]);
  };

  const filteredOptions = options.filter(opt =>
    String(opt.label || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        {multiple ? (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                id={id}
                disabled={disabled}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm shadow-sm transition-all text-left bg-background",
                  multiple ? `${minSizeClasses[size]} h-auto py-1.5` : sizeClasses[size],
                  icon && "pl-10",
                  (error || success) && "pr-10",
                  error && "border-destructive text-destructive",
                  success && "border-green-500 text-green-700",
                  disabled && "cursor-not-allowed opacity-50",
                  hasValue ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <div className="flex flex-wrap items-center gap-1.5 w-full pr-6">
                  {icon && <span className="text-muted-foreground flex-shrink-0">{icon}</span>}
                  {selectedValues.length === 0 ? (
                    <span className="text-muted-foreground text-sm">{placeholder || "Select options..."}</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 items-center w-full">
                      {selectedValues.map(val => {
                        const option = options.find(opt => String(opt.value) === val);
                        const label = option ? option.label : val;
                        return (
                          <Badge
                            key={val}
                            variant="secondary"
                            className="flex items-center gap-1 px-2 py-0.5 text-xs font-normal bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                          >
                            <span className="truncate max-w-[120px]">{label}</span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (disabled) return;
                                handleToggle(val);
                              }}
                              className="hover:bg-muted-foreground/30 rounded-full p-0.5 cursor-pointer ml-1 inline-flex items-center justify-center flex-shrink-0 text-muted-foreground hover:text-foreground border-0 bg-transparent outline-none h-4 w-4"
                            >
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </span>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
                <IconChevronDown className="h-4 w-4 opacity-50 flex-shrink-0 ml-2" />
              </button>
            </PopoverTrigger>
            <PopoverContent 
              className="p-2 bg-popover border shadow-md rounded-md z-50 w-72" 
              style={{ width: "var(--radix-popover-trigger-width)" }}
              align="start"
            >
              {searchable && (
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border rounded-md mb-2 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-background text-foreground"
                />
              )}
              <div className="flex items-center justify-between border-b pb-2 mb-2 px-1">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium"
                >
                  Clear All
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                {filteredOptions.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4">No results found</div>
                ) : (
                  filteredOptions.map((option) => {
                    const isChecked = selectedValues.includes(String(option.value));
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/80 cursor-pointer text-sm transition-colors select-none",
                          option.disabled && "opacity-50 cursor-not-allowed"
                        )}
                        onClick={(e) => {
                          e.preventDefault();
                          if (option.disabled) return;
                          handleToggle(option.value);
                        }}
                      >
                        <Checkbox
                          checked={isChecked}
                          disabled={option.disabled}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => {
                            if (option.disabled) return;
                            handleToggle(option.value);
                          }}
                        />
                        <div className="flex flex-col flex-1 truncate">
                          <span className="truncate text-foreground">{option.label}</span>
                          {option.description && (
                            <span className="text-[10px] text-muted-foreground leading-tight">{option.description}</span>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
        ) : (
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
        )}

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
              onValueChange(multiple ? [] : "");
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
