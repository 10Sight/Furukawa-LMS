import React from 'react';
import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw, Eye, Edit, User, Users } from "lucide-react";
import { cn } from '@/lib/utils';

const ActionButton = ({ 
  icon: Icon, 
  onClick, 
  tooltip, 
  variant = "outline", 
  size = "sm",
  className,
  disabled = false,
  ...props 
}) => {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn("p-2", className)}
      title={tooltip}
      {...props}
    >
      <Icon className="w-4 h-4" />
    </Button>
  );
};

const ActionButtons = {
  View: (props) => (
    <ActionButton 
      icon={Eye} 
      tooltip="View Details"
      className="hover:bg-blue-50 hover:text-blue-600"
      {...props} 
    />
  ),
  
  Edit: (props) => (
    <ActionButton 
      icon={Edit} 
      tooltip="Edit"
      className="hover:bg-green-50 hover:text-green-600"
      {...props} 
    />
  ),
  
  Delete: (props) => (
    <ActionButton 
      icon={Trash2} 
      tooltip="Delete Permanently"
      className="hover:bg-red-50 hover:text-red-600"
      variant="outline"
      {...props} 
    />
  ),
  
  SoftDelete: (props) => (
    <ActionButton 
      icon={Trash2} 
      tooltip="Delete"
      className="hover:bg-orange-50 hover:text-orange-600"
      variant="outline"
      {...props} 
    />
  ),
  
  Restore: (props) => (
    <ActionButton 
      icon={RotateCcw} 
      tooltip="Restore"
      className="hover:bg-green-50 hover:text-green-600"
      variant="outline"
      {...props} 
    />
  ),

  ViewUser: (props) => (
    <ActionButton 
      icon={User} 
      tooltip="View User"
      className="hover:bg-blue-50 hover:text-blue-600"
      {...props} 
    />
  ),

  ManageUsers: (props) => (
    <ActionButton 
      icon={Users} 
      tooltip="Manage Users"
      className="hover:bg-purple-50 hover:text-purple-600"
      {...props} 
    />
  ),
};

export default ActionButtons;
