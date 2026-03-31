import React from "react";
import { Badge } from "@/components/ui/badge";
import { IconHierarchy, IconHash } from "@tabler/icons-react";

const SubSectionDetailHeader = ({ subSection, lineName }) => {
  return (
    <div className="flex flex-col gap-4 p-6 bg-card rounded-lg border shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-blue-500/10">
            <IconHierarchy className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{subSection.name}</h1>
            <p className="text-muted-foreground">Line: {lineName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <Badge variant={subSection.isActive ? "success" : "destructive"}>
                {subSection.isActive ? "Active" : "Inactive"}
            </Badge>
        </div>
      </div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <p className="text-sm text-muted-foreground">Description</p>
            <p className="text-sm">{subSection.description || "No description provided"}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubSectionDetailHeader;
