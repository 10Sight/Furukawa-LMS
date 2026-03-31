import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconClipboardList,
  IconCalendar,
  IconLoader,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDeleteAssignmentMutation } from "@/Redux/AllApi/AssignmentApi";
import { toast } from "sonner";

const AssignmentList = ({ assignments, courseId, modules = [], onRefetch }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [deleteAssignment, { isLoading: isDeleting }] = useDeleteAssignmentMutation();
  const [deletingId, setDeletingId] = useState(null);

  const basePath = React.useMemo(() => {
    const p = location.pathname || '';
    if (p.startsWith('/superadmin')) return '/superadmin';
    if (p.startsWith('/instructor')) return '/instructor';
    return '/admin';
  }, [location.pathname]);
  
  // Helper function to get module name
  const getModuleName = (moduleId) => {
    const module = modules.find(m => m._id === moduleId || m.id === moduleId);
    return module ? module.title : 'Unknown Module';
  };

  // Handle assignment deletion
  const handleDeleteAssignment = async (assignmentId, assignmentTitle) => {
    try {
      setDeletingId(assignmentId);
      await deleteAssignment(assignmentId).unwrap();
      toast.success(`Assignment "${assignmentTitle}" deleted successfully`);
      // Refetch assignments data to update the UI
      if (onRefetch) {
        onRefetch();
      }
    } catch (error) {
      toast.error(error?.data?.message || "Failed to delete assignment");
      console.error("Error deleting assignment:", error);
    } finally {
      setDeletingId(null);
    }
  };

  if (assignments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <IconClipboardList className="h-12 w-12 text-muted-foreground/60 mb-4" />
          <p className="text-muted-foreground font-medium">No assignments yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add assignments for students to complete
          </p>
          <Button 
            onClick={() => navigate(`${basePath}/add-assignment/${courseId}`)} 
            className="mt-4"
          >
            Add Assignment
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Course Assignments</h3>
          <p className="text-sm text-muted-foreground">
            Practical tasks for operators
          </p>
        </div>
        <Button onClick={() => navigate(`${basePath}/add-assignment/${courseId}`)}>
          <IconPlus className="h-4 w-4 mr-2" />
          Add Assignment
        </Button>
      </div>

      <div className="grid gap-4">
        {assignments.map((assignment) => (
          <Card key={assignment._id} className="group">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{assignment.title}</CardTitle>
                  <CardDescription>{assignment.description}</CardDescription>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`${basePath}/edit-assignment/${assignment._id}`)}
                  >
                    <IconPencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        disabled={isDeleting && deletingId === assignment._id}
                      >
                        {isDeleting && deletingId === assignment._id ? (
                          <IconLoader className="h-4 w-4 animate-spin" />
                        ) : (
                          <IconTrash className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete the assignment "{assignment.title}"?
                          This will also delete all operator submissions for this assignment.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteAssignment(assignment._id, assignment.title)}
                          className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                          Delete Assignment
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {assignment.moduleId && (
                  <Badge variant="secondary" className="text-xs">
                    📚 {getModuleName(assignment.moduleId)}
                  </Badge>
                )}
                {assignment.dueDate && (
                  <div className="flex items-center gap-1">
                    <IconCalendar className="h-4 w-4" />
                    <span>
                      Due: {new Date(assignment.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AssignmentList;