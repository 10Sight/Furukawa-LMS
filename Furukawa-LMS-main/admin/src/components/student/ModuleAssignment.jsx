import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Lock, CheckCircle2, Upload, FileText, ArrowRight } from "lucide-react";

export default function ModuleAssignment({
  assignment,
  isUnlocked = false,
  completed = false,
  onSubmitComplete,
  onNext,
  canProceed = true,
}) {
  const [submitted, setSubmitted] = useState(false);
  const [markedComplete, setMarkedComplete] = useState(completed);

  if (!assignment) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Assignment for this Module</h3>
          <p className="text-muted-foreground">You can proceed to the next stage.</p>
          {canProceed && (
            <div className="mt-4">
              <Button onClick={onNext}>Continue</Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!isUnlocked) {
    return (
      <Alert className="bg-amber-50 border-amber-200">
        <Lock className="h-4 w-4 text-amber-600" />
        <AlertDescription>
          Complete prior stages to unlock the assignment.
        </AlertDescription>
      </Alert>
    );
  }

  const handleSubmit = () => {
    setSubmitted(true);
  };

  const handleComplete = () => {
    setMarkedComplete(true);
    if (onSubmitComplete) onSubmitComplete();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Module Assignment</h2>
        <p className="text-muted-foreground">Submit the assignment to complete this module.</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Due: {assignment?.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'N/A'}</Badge>
              {markedComplete && (
                <Badge variant="outline" className="bg-green-100 text-green-700">Submitted</Badge>
              )}
            </div>
            {!markedComplete && (
              <Button variant="outline" onClick={handleSubmit}>
                <Upload className="h-4 w-4 mr-2" /> Upload File
              </Button>
            )}
          </div>

          {submitted && !markedComplete && (
            <div className="text-sm text-muted-foreground">
              Demo mode: File upload not implemented. Click "Mark as Submitted" to continue.
            </div>
          )}

          <div className="flex gap-2">
            {!markedComplete && (
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="h-4 w-4 mr-2" /> Mark as Submitted
              </Button>
            )}
            {canProceed && (markedComplete || !assignment) && (
              <Button variant="outline" onClick={onNext}>
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

