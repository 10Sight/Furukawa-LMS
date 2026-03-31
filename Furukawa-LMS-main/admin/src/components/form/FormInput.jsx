import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { IconEye, IconEyeOff, IconAlertCircle, IconCheck, IconInfoCircle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export const FormInput = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  success,
  type = "text",
  className = "",
  disabled = false,
  required = false,
  optional = false,
  helperText,
  showSuccessIndicator = false,
  showCharacterCount = false,
  maxLength,
  icon,
  endIcon,
  variant = "default", // default, filled, minimal
  size = "default", // sm, default, lg
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;
  const hasValue = value && value.toString().length > 0;
  const characterCount = value ? value.toString().length : 0;

  const sizeClasses = {
    sm: "h-8 px-3 text-sm",
    default: "h-10 px-3",
    lg: "h-12 px-4 text-lg"
  };

  const variantClasses = {
    default: "border bg-background",
    filled: "border-0 bg-muted/50 focus-within:bg-muted/80",
    minimal: "border-0 border-b rounded-none bg-transparent focus-within:border-b-2"
  };

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
              <span className="text-red-500 ml-1">*</span>
            )}
            {optional && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                Optional
              </Badge>
            )}
          </Label>
          {showCharacterCount && maxLength && (
            <span className={cn(
              "text-xs transition-colors",
              characterCount > maxLength * 0.9 ? "text-warning" : "text-muted-foreground",
              characterCount > maxLength ? "text-destructive" : ""
            )}>
              {characterCount}/{maxLength}
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
        {/* Start Icon */}
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {icon}
          </div>
        )}
        
        <Input
          id={id}
          value={value}
          onChange={(e) => {
            if (maxLength && e.target.value.length > maxLength) return;
            onChange(e);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          type={inputType}
          disabled={disabled}
          maxLength={maxLength}
          className={cn(
            "transition-all duration-200 border-0 bg-transparent shadow-none focus-visible:ring-0",
            sizeClasses[size],
            icon && "pl-10",
            (isPassword || error || (success && showSuccessIndicator) || endIcon) && "pr-10",
            error && "text-destructive placeholder:text-destructive/50",
            success && "text-green-700",
            isFocused && "placeholder:text-muted-foreground/60",
            disabled && "cursor-not-allowed"
          )}
          {...props}
        />
        
        {/* End Icons Container */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {/* Custom End Icon */}
          {endIcon && !error && !success && !isPassword && (
            <div className="text-muted-foreground">
              {endIcon}
            </div>
          )}
          
          {/* Success indicator */}
          {success && showSuccessIndicator && !error && (
            <div className="text-green-500 animate-in zoom-in duration-200">
              <IconCheck className="h-4 w-4" />
            </div>
          )}
          
          {/* Error indicator */}
          {error && (
            <div className="text-destructive animate-in zoom-in duration-200">
              <IconAlertCircle className="h-4 w-4" />
            </div>
          )}
          
          {/* Password toggle */}
          {isPassword && (
            <button
              type="button"
              className={cn(
                "text-muted-foreground hover:text-foreground transition-colors p-1 rounded",
                "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              )}
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <IconEyeOff className="h-4 w-4" />
              ) : (
                <IconEye className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        
        {/* Focus indicator */}
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
  );
};