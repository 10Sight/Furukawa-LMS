import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  IconBook,
  IconFileText,
  IconClipboardList,
  IconHelpCircle,
  IconPaperclip,
  IconClock,
} from "@tabler/icons-react";
import StatCard from "@/components/common/StatCard";

const CourseStats = ({ course, modules, quizzes, assignments }) => {
  // Calculate total duration of all modules
  const totalDuration = modules.reduce((total, module) => {
    return total + (module.duration || 0);
  }, 0);

  // Format duration to hours and minutes
  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard
        title="Modules"
        value={modules.length}
        description="Learning sections"
        icon={IconBook}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
      />
      
      <StatCard
        title="Quizzes"
        value={quizzes.length}
        description="Knowledge checks"
        icon={IconHelpCircle}
        iconBgColor="bg-purple-100"
        iconColor="text-purple-600"
      />
      
      <StatCard
        title="Assignments"
        value={assignments.length}
        description="Practical tasks"
        icon={IconClipboardList}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-600"
      />
      
      <StatCard
        title="Lessons"
        value={modules.reduce((total, module) => total + (module.lessons?.length || 0), 0)}
        description="Learning units"
        icon={IconFileText}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
      />
    </div>
  );
};

export default CourseStats;