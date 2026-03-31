import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, FileText, Eye, Clock, Award, CheckCircle, AlertCircle, Upload } from "lucide-react";

const StudentModuleAssignments = ({ 
  assignments = [], 
  submissions = {}, // Object with assignmentId as key and submission data as value
  isUnlocked = false, 
  onViewDetails,
  onSubmit
}) => {
  if (!assignments || assignments.length === 0) return null;

  const handleViewDetails = (assignment) => {
    if (!isUnlocked) return;
    if (typeof onViewDetails === "function") onViewDetails(assignment, submissions[assignment._id]);
  };

  const handleSubmit = (assignment) => {
    if (!isUnlocked) return;
    if (typeof onSubmit === "function") onSubmit(assignment, submissions[assignment._id]);
  };

  const getSubmissionStatus = (assignment) => {
    const submission = submissions[assignment._id];
    if (!submission) {
      return { status: 'not_submitted', message: 'Not submitted', color: 'secondary', icon: Upload };
    }
    
    if (submission.grade !== null && submission.grade !== undefined) {
      return { status: 'graded', message: `Graded: ${submission.grade}/${assignment.maxScore || 100}`, color: 'default', icon: CheckCircle };
    }
    
    if (submission.isLate) {
      return { status: 'late', message: 'Submitted late', color: 'destructive', icon: AlertCircle };
    }
    
    return { status: 'submitted', message: 'Submitted', color: 'default', icon: CheckCircle };
  };

  const getDueDateStatus = (assignment) => {
    if (!assignment.dueDate) return null;
    
    const now = new Date();
    const dueDate = new Date(assignment.dueDate);
    const timeDiff = dueDate - now;
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (timeDiff < 0) {
      return { status: 'overdue', message: 'Overdue', color: 'destructive' };
    } else if (daysDiff <= 1) {
      return { status: 'urgent', message: 'Due soon', color: 'destructive' };
    } else if (daysDiff <= 7) {
      return { status: 'warning', message: `${daysDiff} days left`, color: 'secondary' };
    }
    
    return null; // Don't show badge if more than 7 days
  };

  return (
    <div className="space-y-3">
      <h4 className="font-medium mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4" />
        Assignments ({assignments.length})
      </h4>
      <div className="space-y-3">
        {assignments.map((assignment, idx) => {
          const submissionStatus = getSubmissionStatus(assignment);
          const dueDateStatus = getDueDateStatus(assignment);
          const StatusIcon = submissionStatus.icon;
          
          return (
            <Card 
              key={assignment._id || assignment.id || idx} 
              className={`${!isUnlocked ? "opacity-50" : ""}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base flex items-center gap-2 min-w-0">
                    {!isUnlocked && <Lock className="h-4 w-4" />}
                    <FileText className="h-4 w-4" />
                    <span className="truncate break-words min-w-0">{assignment.title || "Module Assignment"}</span>
                  </CardTitle>
                </div>
                
                {/* Status Badges */}
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge className="bg-orange-100 text-orange-800 text-xs border-orange-200">
                    MODULE LEVEL
                  </Badge>
                  
                  {dueDateStatus && (
                    <Badge variant={dueDateStatus.color} className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {dueDateStatus.message}
                    </Badge>
                  )}
                  
                  <Badge variant={submissionStatus.color} className="text-xs">
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {submissionStatus.message}
                  </Badge>
                </div>
                
                {assignment.description && (
                  <CardDescription className="mt-2 break-words overflow-hidden">{assignment.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Due: {assignment.dueDate 
                      ? new Date(assignment.dueDate).toLocaleDateString() 
                      : 'No deadline'
                    }
                  </div>
                  <div className="flex items-center gap-1">
                    <Award className="h-4 w-4 text-muted-foreground" />
                    Max Score: {assignment.maxScore || 100} points
                  </div>
                </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      disabled={!isUnlocked}
                      onClick={() => handleViewDetails(assignment)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      {!isUnlocked ? 'Locked' : 'View Details'}
                    </Button>
                    {submissionStatus.status === 'not_submitted' ? (
                      <Button 
                        className="flex-1"
                        disabled={!isUnlocked}
                        onClick={() => handleSubmit(assignment)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        {!isUnlocked ? 'Locked' : 'Submit'}
                      </Button>
                    ) : (
                      <Button 
                        variant="outline"
                        className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                        disabled={!isUnlocked}
                        onClick={() => handleSubmit(assignment)}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {!isUnlocked ? 'Locked' : 'Resubmit'}
                      </Button>
                    )}
                  </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default StudentModuleAssignments;
