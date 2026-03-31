import React from "react";
import StudentLevelManager from "@/components/admin/StudentLevelManager";

const StudentLevelManagement = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Operator Level Management</h1>
        <p className="text-muted-foreground mt-2">
          Control student progression levels and prevent automatic promotions
        </p>
      </div>
      <StudentLevelManager />
    </div>
  );
};

export default StudentLevelManagement;
