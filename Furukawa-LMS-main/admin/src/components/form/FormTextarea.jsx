import React, { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconAlertCircle, IconCheck, IconInfoCircle, IconMaximize, IconMinimize } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export const FormTextarea = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  success,
  helperText,
  required = false,
  optional = false,
  disabled = false,
  rows = 3,
  minRows = 2,
  maxRows = 10,
  resize = "vertical", // none, vertical, horizontal, both
  showCharacterCount = false,
  maxLength,
  autoResize = false,
  className = "",
  variant = "default", // default, filled, minimal
  size = "default", // sm, default, lg
  allowFullscreen = false,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRef = useRef(null);
  const characterCount = value ? value.toString().length : 0;

  const sizeClasses = {
    sm: "px-3 py-2 text-sm",
    default: "px-3 py-2",
    lg: "px-4 py-3 text-lg"
  };

  const variantClasses = {
    default: "border bg-background",
    filled: "border-0 bg-muted/50 focus-within:bg-muted/80",
    minimal: "border-0 border-b rounded-none bg-transparent focus-within:border-b-2"
  };

  const resizeClasses = {
    none: "resize-none",
    vertical: "resize-y",
    horizontal: "resize-x",
    both: "resize"
  };

  // Auto-resize functionality
  useEffect(() => {
    if (autoResize && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const minHeight = minRows * 24; // Approximate line height
      const maxHeight = maxRows * 24;
      textarea.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    }
  }, [value, autoResize, minRows, maxRows]);

  const handleFullscreenToggle = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <>
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
            <div className="flex items-center gap-2">
              {showCharacterCount && maxLength && (
                <span className={cn(
                  "text-xs transition-colors",
                  characterCount > maxLength * 0.9 ? "text-warning" : "text-muted-foreground",
                  characterCount > maxLength ? "text-destructive" : "",
                  characterCount === maxLength ? "font-medium" : ""
                )}>
                  {characterCount}/{maxLength}
                </span>
              )}
              {allowFullscreen && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleFullscreenToggle}
                >
                  <IconMaximize className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        )}
        
        <div className={cn(
          "relative transition-all duration-200 rounded-lg",
          "focus-within:ring-2 focus-within:ring-primary/20",
          error && "focus-within:ring-destructive/20",
          disabled && "opacity-60 cursor-not-allowed",
          variantClasses[variant]
        )}>
          <Textarea
            ref={textareaRef}
            id={id}
            value={value}
            onChange={(e) => {
              if (maxLength && e.target.value.length > maxLength) return;
              onChange(e);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            rows={autoResize ? minRows : rows}
            disabled={disabled}
            maxLength={maxLength}
            className={cn(
              "transition-all duration-200 border-0 bg-transparent shadow-none focus-visible:ring-0",
              "min-h-[80px]",
              sizeClasses[size],
              resizeClasses[resize],
              error && "text-destructive placeholder:text-destructive/50",
              success && "text-green-700",
              isFocused && "placeholder:text-muted-foreground/60",
              disabled && "cursor-not-allowed",
              autoResize && "overflow-hidden"
            )}
            {...props}
          />
          
          {/* Status indicators */}
          {(error || success) && (
            <div className="absolute top-3 right-3">
              {error && (
                <IconAlertCircle className="h-4 w-4 text-destructive" />
              )}
              {success && !error && (
                <IconCheck className="h-4 w-4 text-green-500" />
              )}
            </div>
          )}
          
          {/* Focus indicator for minimal variant */}
          {variant === "minimal" && (
            <div className={cn(
              "absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-200",
              isFocused ? "w-full" : "w-0"
            )} />
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
      
      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-4xl h-[80vh] bg-background border rounded-lg shadow-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">{label || "Text Editor"}</h3>
              <div className="flex items-center gap-2">
                {showCharacterCount && maxLength && (
                  <span className={cn(
                    "text-xs",
                    characterCount > maxLength * 0.9 ? "text-warning" : "text-muted-foreground",
                    characterCount > maxLength ? "text-destructive" : ""
                  )}>
                    {characterCount}/{maxLength}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFullscreenToggle}
                >
                  <IconMinimize className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Textarea
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              className="border-0 resize-none h-[calc(80vh-120px)] focus-visible:ring-0"
              maxLength={maxLength}
            />
          </div>
        </div>
      )}
    </>
  );
};
