import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Lock, CheckCircle2, HelpCircle, Play, ArrowRight } from "lucide-react";

export default function ModuleQuiz({
  quiz,
  isUnlocked = false,
  completed = false,
  onComplete,
  onNext,
  canProceed = true,
}) {
  const [attempted, setAttempted] = useState(false);
  const [markedComplete, setMarkedComplete] = useState(completed);

  if (!quiz) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Test for this Module</h3>
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
          Complete lessons and resources to unlock the quiz.
        </AlertDescription>
      </Alert>
    );
  }

  const handleAttempt = () => {
    setAttempted(true);
  };

  const handleComplete = () => {
    setMarkedComplete(true);
    if (onComplete) onComplete();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Module Test</h2>
        <p className="text-muted-foreground">Attempt the test to test your understanding.</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Questions: {quiz?.questions?.length || 'N/A'}</Badge>
              {markedComplete && (
                <Badge variant="outline" className="bg-green-100 text-green-700">Completed</Badge>
              )}
            </div>
            {!markedComplete && (
              <Button variant="outline" onClick={handleAttempt}>
                <Play className="h-4 w-4 mr-2" /> Attempt Quiz
              </Button>
            )}
          </div>

          {attempted && !markedComplete && (
            <div className="text-sm text-muted-foreground">
              Demo mode: This is a placeholder quiz. Click "Mark as Complete" when finished.
            </div>
          )}

          <div className="flex gap-2">
            {!markedComplete && (
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="h-4 w-4 mr-2" /> Mark as Complete
              </Button>
            )}
            {canProceed && (markedComplete || !quiz) && (
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

