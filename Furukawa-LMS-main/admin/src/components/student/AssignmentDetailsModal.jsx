import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Clock, 
  Award, 
  CheckCircle, 
  AlertCircle, 
  Calendar,
  User,
  Download,
  Upload
} from 'lucide-react';

const AssignmentDetailsModal = ({ 
  assignment, 
  submission = null,
  isOpen, 
  onClose, 
  onSubmit,
  isSubmissionLoading = false 
}) => {
  if (!assignment) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'No deadline';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDueDateStatus = () => {
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
      return { status: 'warning', message: `${daysDiff} days left`, color: 'warning' };
    } else {
      return { status: 'ok', message: `${daysDiff} days left`, color: 'default' };
    }
  };

  const getSubmissionStatus = () => {
    if (!submission) {
      return { status: 'not_submitted', message: 'Not submitted', color: 'secondary' };
    }
    
    if (submission.grade !== null && submission.grade !== undefined) {
      return { status: 'graded', message: 'Graded', color: 'default' };
    }
    
    if (submission.isLate) {
      return { status: 'late', message: 'Submitted late', color: 'warning' };
    }
    
    return { status: 'submitted', message: 'Submitted', color: 'success' };
  };

  const dueDateStatus = getDueDateStatus();
  const submissionStatus = getSubmissionStatus();

  const handleDownloadSubmission = () => {
    if (submission?.fileUrl) {
      window.open(submission.fileUrl, '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <FileText className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-semibold pr-6">
                {assignment.title}
              </DialogTitle>
              <DialogDescription className="mt-2 text-base">
                {assignment.description || 'No description provided.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-orange-50 text-orange-800 border-orange-200">
              <Award className="h-3 w-3 mr-1" />
              Module Assignment
            </Badge>
            
            {dueDateStatus && (
              <Badge variant={dueDateStatus.color}>
                <Clock className="h-3 w-3 mr-1" />
                {dueDateStatus.message}
              </Badge>
            )}
            
            <Badge variant={submissionStatus.color}>
              {submissionStatus.status === 'submitted' || submissionStatus.status === 'graded' ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : submissionStatus.status === 'late' ? (
                <AlertCircle className="h-3 w-3 mr-1" />
              ) : (
                <Upload className="h-3 w-3 mr-1" />
              )}
              {submissionStatus.message}
            </Badge>
          </div>

          <div className="border-b" />

          {/* Assignment Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Due Date:</span>
                <span>{formatDate(assignment.dueDate)}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Award className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Max Score:</span>
                <span>{assignment.maxScore || 100} points</span>
              </div>
            </div>

            {submission && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Submitted:</span>
                  <span>{formatDate(submission.submittedAt)}</span>
                </div>
                
                {submission.grade !== null && submission.grade !== undefined && (
                  <div className="flex items-center gap-2 text-sm">
                    <Award className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Grade:</span>
                    <span className="font-semibold text-green-600">
                      {submission.grade}/{assignment.maxScore || 100}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submission Section */}
          {submission ? (
            <div className="space-y-4">
              <div className="border-b" />
              <h4 className="font-medium">Your Submission</h4>
              
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Submitted File</span>
                  </div>
                  <Button
                    variant="outline" 
                    size="sm"
                    onClick={handleDownloadSubmission}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    View File
                  </Button>
                </div>
                
                {submission.resubmissionCount > 0 && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Resubmitted {submission.resubmissionCount} time(s)
                  </p>
                )}
                
                {submission.feedback && (
                  <div className="mt-3 pt-3 border-t">
                    <h5 className="text-sm font-medium mb-2">Instructor Feedback</h5>
                    <p className="text-sm text-muted-foreground bg-background p-3 rounded border">
                      {submission.feedback}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-b" />
              <div className="text-center py-6 border-2 border-dashed border-muted rounded-lg">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-4">
                  You haven't submitted this assignment yet.
                </p>
                <Button onClick={onSubmit} disabled={isSubmissionLoading}>
                  {isSubmissionLoading ? 'Processing...' : 'Submit Assignment'}
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {submission ? (
              <Button onClick={onSubmit} disabled={isSubmissionLoading}>
                {isSubmissionLoading ? 'Processing...' : 'Resubmit Assignment'}
              </Button>
            ) : (
              <Button onClick={onSubmit} disabled={isSubmissionLoading}>
                {isSubmissionLoading ? 'Processing...' : 'Submit Assignment'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssignmentDetailsModal;
