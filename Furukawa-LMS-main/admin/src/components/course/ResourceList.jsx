import React from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  IconPlus,
  IconPaperclip,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import ResourceModule from "./ResourceModule";
import { UniversalResourceList } from "./UniversalResourceList";

const ResourceList = ({ courseId, modules }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const basePath = React.useMemo(() => {
    const p = location.pathname || '';
    if (p.startsWith('/superadmin')) return '/superadmin';
    if (p.startsWith('/instructor')) return '/instructor';
    return '/admin';
  }, [location.pathname]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Course Resources</h3>
          <p className="text-sm text-muted-foreground">
            Supplementary materials organized by module
          </p>
        </div>
        <Button 
          onClick={() => navigate(`${basePath}/add-resource/${courseId}`)}
          className="gap-2"
        >
          <IconPlus className="h-4 w-4" />
          Add Resource
        </Button>
      </div>

      <UniversalResourceList 
        scope="course" 
        courseId={courseId} 
        entityName="Entire Course"
        showAddButton={false}
      />

      <div className="pt-4 border-t">
        <h3 className="text-lg font-medium mb-4">Module Resources</h3>
        {modules.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <IconPaperclip className="h-12 w-12 text-muted-foreground/60 mb-4" />
              <p className="text-muted-foreground font-medium">No modules found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add modules first to organize resources
              </p>
              <Button 
                onClick={() => navigate(`${basePath}/add-module/${courseId}`)} 
                className="mt-4"
              >
                Add Module
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {modules.map((module) => (
              <ResourceModule
                key={module._id || module.id}
                module={module}
                courseId={courseId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourceList;