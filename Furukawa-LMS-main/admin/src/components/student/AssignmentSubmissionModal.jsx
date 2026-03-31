import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Upload, 
  X, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Award
} from 'lucide-react';
import useFileUpload from '@/hooks/useFileUpload';
import { useCreateSubmissionMutation, useResubmitAssignmentMutation } from '@/Redux/AllApi/SubmissionApi';

const AssignmentSubmissionModal = ({ 
  assignment, 
  submission = null, 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  
  const { uploadFile, isUploading, uploadProgress, error: uploadError } = useFileUpload();
  const [createSubmission, { isLoading: isCreating }] = useCreateSubmissionMutation();
  const [resubmitAssignment, { isLoading: isResubmitting }] = useResubmitAssignmentMutation();

  if (!assignment) return null;

  const isResubmission = !!submission;
  const isProcessing = isUploading || isCreating || isResubmitting;

  const allowedExtensions = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'ppt', 'pptx', 'zip', 'rar'];
  const maxSizeBytes = 50 * 1024 * 1024; // 50MB

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file) => {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      return `File type not allowed. Allowed: ${allowedExtensions.join(', ')}`;
    }
    
    if (file.size > maxSizeBytes) {
      return `File too large. Maximum size: ${formatFileSize(maxSizeBytes)}`;
    }
    
    return null;
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const error = validateFile(file);
      if (error) {
        alert(error);
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const error = validateFile(file);
      if (error) {
        alert(error);
        return;
      }
      setSelectedFile(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      alert('Please select a file to submit');
      return;
    }

    try {
      // Upload file
      const uploadResult = await uploadFile(selectedFile, {
        folder: 'assignment-submissions',
        allowedTypes: allowedExtensions,
        maxSizeBytes
      });
      // Get assignment ID - handle both _id and id fields
      const assignmentId = assignment._id || assignment.id;
      if (!assignmentId) {
        throw new Error('Assignment ID not found');
      }
      
      // Submit assignment
      const submissionData = {
        assignmentId: assignmentId,
        fileUrl: uploadResult.url
      };

      let result;
      if (isResubmission) {
        const submissionId = submission._id || submission.id;
        if (!submissionId) {
          throw new Error('Submission ID not found for resubmission');
        }
        result = await resubmitAssignment({
          submissionId: submissionId,
          fileUrl: uploadResult.url
        });
      } else {
        result = await createSubmission(submissionData);
      }
      
      if (result.error) {
        console.error('Submission API error:', result.error);
        throw new Error(result.error.data?.message || result.error.message || 'Submission failed');
      }

      // Success
      if (onSuccess) {
        onSuccess(result.data);
      }
      onClose();
      setSelectedFile(null);
    } catch (error) {
      console.error('Submission error:', error);
      const errorMessage = error.message || 'Failed to submit assignment';
      console.error('Final error message:', errorMessage);
      alert(errorMessage);
    }
  };

  const getDueDateStatus = () => {
    if (!assignment.dueDate) return null;
    
    const now = new Date();
    const dueDate = new Date(assignment.dueDate);
    const timeDiff = dueDate - now;
    
    if (timeDiff < 0) {
      return { message: 'Overdue', color: 'destructive' };
    } else if (timeDiff < 24 * 60 * 60 * 1000) {
      return { message: 'Due soon', color: 'destructive' };
    } else {
      const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      return { message: `${daysDiff} days left`, color: 'default' };
    }
  };

  const dueDateStatus = getDueDateStatus();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <Upload className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold">
                {isResubmission ? 'Resubmit Assignment' : 'Submit Assignment'}
              </DialogTitle>
              <DialogDescription className="mt-2 text-base">
                {assignment.title}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Info */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-orange-50 text-orange-800 border-orange-200">
              <Award className="h-3 w-3 mr-1" />
              {assignment.maxScore || 100} points
            </Badge>
            
            {dueDateStatus && (
              <Badge variant={dueDateStatus.color}>
                <Clock className="h-3 w-3 mr-1" />
                {dueDateStatus.message}
              </Badge>
            )}

            {isResubmission && (
              <Badge variant="secondary">
                <Upload className="h-3 w-3 mr-1" />
                Resubmission
              </Badge>
            )}
          </div>

          {/* Upload Error */}
          {uploadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {/* File Upload Area */}
          <div className="space-y-4">
            <div className="text-sm font-medium">Upload your assignment file</div>
            
            {!selectedFile ? (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept={allowedExtensions.map(ext => `.${ext}`).join(',')}
                />
                
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">
                  Drop your file here or <span className="text-blue-600">browse</span>
                </p>
                <p className="text-sm text-gray-500 mb-2">
                  Maximum file size: {formatFileSize(maxSizeBytes)}
                </p>
                <p className="text-xs text-gray-400">
                  Supported formats: {allowedExtensions.join(', ').toUpperCase()}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                    disabled={isProcessing}
                    className="text-gray-500 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {/* Submit Progress */}
          {(isCreating || isResubmitting) && (
            <div className="flex items-center justify-center py-4">
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                {isResubmission ? 'Resubmitting assignment...' : 'Submitting assignment...'}
              </div>
            </div>
          )}

          {/* Warning for resubmission */}
          {isResubmission && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will replace your previous submission. Your instructor will be notified of the resubmission.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isUploading ? 'Uploading...' : isResubmission ? 'Resubmitting...' : 'Submitting...'}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isResubmission ? 'Resubmit Assignment' : 'Submit Assignment'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssignmentSubmissionModal;
