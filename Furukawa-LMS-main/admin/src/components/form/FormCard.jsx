import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export const FormCard = ({ 
  title, 
  description, 
  children, 
  actionButton,
  footerActions,
  status,
  statusVariant = "default", // default, success, warning, destructive
  icon,
  variant = "default", // default, elevated, outlined, ghost
  size = "default", // sm, default, lg
  className = "",
  headerClassName = "",
  contentClassName = "",
  footerClassName = "",
  collapsible = false,
  defaultCollapsed = false,
  ...props
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  const variantClasses = {
    default: "border bg-card shadow-sm",
    elevated: "border-0 bg-card shadow-lg hover:shadow-xl transition-shadow",
    outlined: "border-2 bg-transparent shadow-none",
    ghost: "border-0 bg-transparent shadow-none"
  };

  const sizeClasses = {
    sm: "text-sm",
    default: "",
    lg: "text-base"
  };

  const statusColors = {
    default: "border-l-primary",
    success: "border-l-green-500",
    warning: "border-l-yellow-500",
    destructive: "border-l-red-500"
  };

  return (
    <Card 
      className={cn(
        variantClasses[variant],
        sizeClasses[size],
        status && "border-l-4",
        status && statusColors[statusVariant],
        "transition-all duration-200",
        className
      )}
      {...props}
    >
      {(title || description || actionButton || icon) && (
        <CardHeader className={cn("pb-4", headerClassName)}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {icon && (
                <div className="flex-shrink-0 mt-1">
                  <div className={cn(
                    "p-2 rounded-lg",
                    status === "success" && "bg-green-100 text-green-600",
                    status === "warning" && "bg-yellow-100 text-yellow-600",
                    status === "destructive" && "bg-red-100 text-red-600",
                    (!status || status === "default") && "bg-primary/10 text-primary"
                  )}>
                    {icon}
                  </div>
                </div>
              )}
              <div className="min-w-0 flex-1">
                {title && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className={cn(
                      "leading-tight",
                      size === "sm" && "text-base",
                      size === "lg" && "text-xl"
                    )}>
                      {title}
                    </CardTitle>
                    {status && (
                      <Badge 
                        variant={statusVariant} 
                        className="text-xs px-2 py-0 h-5"
                      >
                        {status}
                      </Badge>
                    )}
                  </div>
                )}
                {description && (
                  <CardDescription className={cn(
                    "mt-1 leading-relaxed",
                    size === "sm" && "text-xs",
                    size === "lg" && "text-sm"
                  )}>
                    {description}
                  </CardDescription>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {actionButton}
              {collapsible && (
                <button
                  type="button"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="p-1 rounded hover:bg-muted transition-colors"
                  aria-label={isCollapsed ? "Expand" : "Collapse"}
                >
                  <svg 
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      isCollapsed ? "rotate-180" : ""
                    )} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </CardHeader>
      )}
      
      {(!collapsible || !isCollapsed) && children && (
        <>
          {(title || description || actionButton || icon) && <Separator />}
          <CardContent className={cn(
            "pt-4",
            contentClassName
          )}>
            {children}
          </CardContent>
        </>
      )}
      
      {footerActions && (!collapsible || !isCollapsed) && (
        <>
          <Separator />
          <CardFooter className={cn(
            "pt-4",
            footerClassName
          )}>
            {footerActions}
          </CardFooter>
        </>
      )}
    </Card>
  );
};
