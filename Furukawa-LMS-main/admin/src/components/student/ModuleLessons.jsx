import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Lock, Play, BookOpen, ArrowRight } from "lucide-react";

export default function ModuleLessons({
  lessons = [],
  isUnlocked = true,
  completedLessonIds = [],
  onLessonComplete,
  onNext,
  canProceed = true,
}) {
  const allLessonsCompleted = lessons.length === 0 || lessons.every(l => completedLessonIds.includes(l._id || l.id));

  if (!isUnlocked) {
    return (
      <div className="space-y-6">
        <Alert className="bg-amber-50 border-amber-200">
          <Lock className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span className="text-amber-800">Lessons are locked until prerequisites are complete.</span>
            </div>
          </AlertDescription>
        </Alert>

        <div className="grid gap-4">
          {lessons.map((lesson, index) => (
            <Card key={lesson._id || lesson.id || index} className="opacity-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Lock className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-500">{lesson.title || `Lesson ${index + 1}`}</h3>
                    <p className="text-sm text-gray-400">Locked</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Module Lessons</h2>
        <p className="text-muted-foreground">Work through each lesson to unlock module resources.</p>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <CheckCircle2 className="h-4 w-4 text-blue-600" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <span className="text-blue-800">{(completedLessonIds || []).length} of {lessons.length} lessons completed</span>
            <Badge variant="outline" className="text-blue-600">
              {lessons.length ? Math.round(((completedLessonIds || []).length / lessons.length) * 100) : 100}% Complete
            </Badge>
          </div>
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {lessons.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Lessons Available</h3>
              <p className="text-muted-foreground">This module doesn't have any lessons.</p>
            </CardContent>
          </Card>
        ) : (
          lessons.map((lesson, index) => {
            const id = lesson._id || lesson.id;
            const isCompleted = completedLessonIds.includes(id);
            return (
              <Card key={id || index} className={`transition-all hover:shadow-md ${isCompleted ? 'bg-green-50 border-green-200' : 'hover:bg-gray-50'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${isCompleted ? 'bg-green-100' : 'bg-gray-100'}`}>
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <Play className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{lesson.title || `Lesson ${index + 1}`}</h3>
                        {isCompleted && (
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-700">Completed</Badge>
                        )}
                      </div>
                      {lesson.description && (
                        <p className="text-sm text-muted-foreground mb-2">{lesson.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!isCompleted && (
                        <Button variant="outline" size="sm" onClick={() => onLessonComplete && onLessonComplete(id)}>
                          Mark as Completed
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {canProceed && allLessonsCompleted && (
        <div className="flex justify-center pt-6 border-t">
          <Button onClick={onNext} size="lg" className="bg-green-600 hover:bg-green-700">
            <ArrowRight className="h-4 w-4 mr-2" />
            Continue to Resources
          </Button>
        </div>
      )}

      {lessons.length === 0 && canProceed && (
        <div className="flex justify-center pt-6 border-t">
          <Button onClick={onNext} size="lg" className="bg-green-600 hover:bg-green-700">
            <ArrowRight className="h-4 w-4 mr-2" />
            No Lessons - Continue
          </Button>
        </div>
      )}
    </div>
  );
}

