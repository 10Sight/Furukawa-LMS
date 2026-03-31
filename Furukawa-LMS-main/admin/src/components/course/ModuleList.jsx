import React from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  IconPlus,
  IconBook,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDeleteModuleMutation } from "@/Redux/AllApi/moduleApi";
import ModuleItem from "./ModuleItem";

const ModuleList = ({ modules, courseId, onRefetch }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [, { isLoading: isDeletingModule }] = useDeleteModuleMutation();

  const basePath = React.useMemo(() => {
    const p = location.pathname || '';
    if (p.startsWith('/superadmin')) return '/superadmin';
    if (p.startsWith('/instructor')) return '/instructor';
    return '/admin';
  }, [location.pathname]);

  // Create a sorted copy of the modules array
  const sortedModules = React.useMemo(() => {
    if (!Array.isArray(modules)) return [];
    
    return [...modules].sort((a, b) => {
      const orderA = a.order || 0;
      const orderB = b.order || 0;
      return orderA - orderB;
    });
  }, [modules]);

  // Ensure modules is always an array
  const moduleArray = Array.isArray(modules) ? modules : [];

  if (moduleArray.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <IconBook className="h-12 w-12 text-muted-foreground/60 mb-4" />
          <p className="text-muted-foreground font-medium">No modules yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add modules to organize your course content
          </p>
          <Button 
            onClick={() => navigate(`${basePath}/add-module/${courseId}`)} 
            className="mt-4"
          >
            Add Module
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Course Modules</h2>
          <p className="text-sm text-muted-foreground">
            Organize your course content into modules and lessons
          </p>
        </div>
        <Button onClick={() => navigate(`${basePath}/add-module/${courseId}`)}>
          <IconPlus className="h-4 w-4 mr-2" />
          Add Module
        </Button>
      </div>

      <div className="space-y-4">
        {sortedModules.map((module) => (
          <ModuleItem
            key={module._id || module.id}
            module={module}
            onRefetch={onRefetch}
            isDeletingModule={isDeletingModule}
          />
        ))}
      </div>
    </div>
  );
};

export default ModuleList;