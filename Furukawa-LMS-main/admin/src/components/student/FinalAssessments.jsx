import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, HelpCircle, GraduationCap, Play, Upload } from "lucide-react";

export default function FinalAssessments({ finalQuiz, finalAssignment, onFinalComplete }) {
  const [quizDone, setQuizDone] = useState(!finalQuiz);
  const [assignmentDone, setAssignmentDone] = useState(!finalAssignment);

  const canFinish = quizDone && assignmentDone;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <GraduationCap className="h-10 w-10 text-primary mx-auto" />
        <h2 className="text-2xl font-bold">Final Assessments</h2>
        <p className="text-muted-foreground">Complete the course-level test and assignment to finish the course.</p>
      </div>

      {/* Final Quiz */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Final Quiz</span>
              {quizDone ? (
                <Badge variant="outline" className="bg-green-100 text-green-700">Completed</Badge>
              ) : (
                <Badge variant="outline">Questions: {finalQuiz?.questions?.length || 'N/A'}</Badge>
              )}
            </div>
            {!quizDone && (
              <Button variant="outline" onClick={() => setQuizDone(true)}>
                <Play className="h-4 w-4 mr-2" /> Attempt Final Quiz
              </Button>
            )}
          </div>
          {!finalQuiz && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <HelpCircle className="h-4 w-4" /> No final test configured.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Final Assignment */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Final Assignment</span>
              {assignmentDone ? (
                <Badge variant="outline" className="bg-green-100 text-green-700">Submitted</Badge>
              ) : (
                <Badge variant="outline">Due: {finalAssignment?.dueDate ? new Date(finalAssignment.dueDate).toLocaleDateString() : 'N/A'}</Badge>
              )}
            </div>
            {!assignmentDone && (
              <Button variant="outline" onClick={() => setAssignmentDone(true)}>
                <Upload className="h-4 w-4 mr-2" /> Upload Final Assignment
              </Button>
            )}
          </div>
          {!finalAssignment && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <HelpCircle className="h-4 w-4" /> No final assignment configured.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Finish Course */}
      <div className="flex justify-center pt-2">
        <Button onClick={() => onFinalComplete && onFinalComplete()} disabled={!canFinish} className="bg-green-600 hover:bg-green-700">
          <CheckCircle2 className="h-4 w-4 mr-2" /> Complete Course
        </Button>
      </div>
    </div>
  );
}

