// src/components/departments/DepartmentCourseCard.jsx
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconBook, IconExternalLink, IconClock } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

const DepartmentCourseCard = ({ course, departmentId }) => {
  const navigate = useNavigate();

  if (!course) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconBook className="h-5 w-5" />
            Course
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-muted-foreground mb-4">
              No course assigned to this department
            </div>
            <Button
              onClick={() => navigate(`../?editDepartment=${departmentId}`, { relative: "path" })}
            >
              Assign Course
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getDifficultyBadge = (difficulty) => {
    const difficultyConfig = {
      BEGINNER: { variant: "secondary", label: "Beginner" },
      INTERMEDIATE: { variant: "default", label: "Intermediate" },
      ADVANCED: { variant: "destructive", label: "Advanced" },
    };

    return difficultyConfig[difficulty] || { variant: "outline", label: difficulty };
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconBook className="h-5 w-5" />
          Course
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/admin/courses/${course._id}`)}
        >
          <IconExternalLink className="h-4 w-4 mr-2" />
          View
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold">{course.title}</h3>
            <p className="text-muted-foreground mt-1">{course.description}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={getDifficultyBadge(course.difficulty).variant}>
              {getDifficultyBadge(course.difficulty).label}
            </Badge>

            {course.duration && (
              <Badge variant="outline" className="flex items-center gap-1">
                <IconClock className="h-3 w-3" />
                {course.duration}
              </Badge>
            )}

            {course.category && (
              <Badge variant="secondary">{course.category}</Badge>
            )}
          </div>

          {course.learningObjectives && course.learningObjectives.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">Learning Objectives</h4>
              <ul className="text-sm space-y-1">
                {course.learningObjectives.slice(0, 3).map((objective, index) => (
                  <li key={index} className="text-muted-foreground">
                    • {objective}
                  </li>
                ))}
                {course.learningObjectives.length > 3 && (
                  <li className="text-muted-foreground text-xs">
                    +{course.learningObjectives.length - 3} more objectives
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DepartmentCourseCard;