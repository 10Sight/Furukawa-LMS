// src/components/departments/DepartmentInstructorCard.jsx
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconUser, IconMail, IconPhone, IconPencil } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

const DepartmentInstructorCard = ({ instructor, departmentId }) => {
  const navigate = useNavigate();

  if (!instructor) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconUser className="h-5 w-5" />
            Trainer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-muted-foreground mb-4">
              No trainer assigned to this department
            </div>
            <Button
              onClick={() => navigate(`..?assignInstructor=${departmentId}`, { relative: "path" })}
            >
              Assign Trainer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconUser className="h-5 w-5" />
          Trainer
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`..?assignInstructor=${departmentId}`, { relative: "path" })}
        >
          <IconPencil className="h-4 w-4 mr-2" />
          Change
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center text-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={instructor.avatar?.url} alt={instructor.fullName} />
            <AvatarFallback className="text-xl">
              {instructor.fullName
                ?.split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>

          <div>
            <h3 className="text-xl font-semibold">{instructor.fullName}</h3>
            <Badge variant="outline" className="mt-1">
              Trainer
            </Badge>
          </div>

          <div className="w-full space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <IconMail className="h-4 w-4 text-muted-foreground" />
              <span>{instructor.email}</span>
            </div>

            {instructor.phone && (
              <div className="flex items-center gap-2 text-sm">
                <IconPhone className="h-4 w-4 text-muted-foreground" />
                <span>{instructor.phone}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DepartmentInstructorCard;