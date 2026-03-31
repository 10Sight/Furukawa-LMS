import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useGetAttemptByIdQuery, useAdminUpdateAttemptMutation } from "@/Redux/AllApi/AttemptedQuizApi";
import { CheckCircle2, AlertCircle, Save, X } from "lucide-react";

const AttemptReviewModal = ({ attemptId, isOpen, onClose, canEdit = false }) => {
  const { data, isLoading, isError } = useGetAttemptByIdQuery(attemptId, { skip: !attemptId || !isOpen });
  const attempt = data?.data;
  const [answersOverride, setAnswersOverride] = useState({});
  const [notes, setNotes] = useState("");
  const [updateAttempt, { isLoading: isSaving }] = useAdminUpdateAttemptMutation();

  const questionMap = useMemo(() => {
    const map = new Map();
    const questions = attempt?.quiz?.questions || [];
    questions.forEach(q => map.set(String(q._id || q.id), q));
    return map;
  }, [attempt]);

  const totalMarks = useMemo(() => {
    const questions = attempt?.quiz?.questions || [];
    return questions.reduce((sum, q) => sum + (q.marks || 1), 0);
  }, [attempt]);

  const handleChange = (questionId, field, value) => {
    setAnswersOverride(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [field]: value,
      }
    }));
  };

  const handleSave = async () => {
    if (!attemptId) return;
    const payload = Object.entries(answersOverride).map(([questionId, override]) => ({
      questionId,
      isCorrect: typeof override.isCorrect === 'boolean' ? override.isCorrect : undefined,
      marksObtained: override.marksObtained !== undefined && override.marksObtained !== "" ? Number(override.marksObtained) : undefined,
      selectedOptions: override.selectedOptions && Array.isArray(override.selectedOptions) ? override.selectedOptions : undefined,
    }));

    await updateAttempt({ attemptId, answersOverride: payload, adjustmentNotes: notes || undefined });
    setAnswersOverride({});
    setNotes("");
    onClose?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Test Attempt Review</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="p-6">Loading...</div>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load attempt.</AlertDescription>
          </Alert>
        ) : attempt ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{attempt.quiz?.title}</div>
                <div className="text-xs text-muted-foreground">Operator: {attempt.student?.fullName} ({attempt.student?.email})</div>
              </div>
              <Badge variant={attempt.status === 'PASSED' ? 'default' : 'destructive'}>
                {attempt.status}
              </Badge>
            </div>

            <div className="text-sm">Score: {attempt.score}/{totalMarks}</div>

            <div className="h-[400px] border rounded-md p-3 overflow-y-auto">
              <div className="space-y-3">
                {(attempt.answer || []).map((ans, idx) => {
                  const q = questionMap.get(String(ans.questionId));
                  const correct = q?.options?.find(o => o.isCorrect);
                  const override = answersOverride[String(ans.questionId)] || {};
                  const isCorrect = override.isCorrect ?? ans.isCorrect;
                  const marksObtained = override.marksObtained ?? ans.marksObtained;

                  return (
                    <div key={idx} className={`p-3 rounded border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-start gap-2">
                        {isCorrect ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">Q{idx + 1}: {q?.questionText}</div>
                          <div className="text-xs text-muted-foreground">Marks: {q?.marks}</div>
                          <div className="text-xs mt-1">
                            <span className="font-medium">Student answer:</span> {ans.selectedOptions?.[0] || 'Not answered'}
                          </div>
                          <div className="text-xs">
                            <span className="font-medium">Correct:</span> {correct?.text}
                          </div>
                        </div>
                        <div className="w-40 space-y-2">
                          {canEdit ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`correct-${idx}`}
                                  checked={!!isCorrect}
                                  onCheckedChange={(checked) => handleChange(String(ans.questionId), 'isCorrect', !!checked)}
                                />
                                <label htmlFor={`correct-${idx}`} className="text-xs">Mark Correct</label>
                              </div>
                              <Input
                                type="number"
                                value={marksObtained}
                                onChange={(e) => handleChange(String(ans.questionId), 'marksObtained', e.target.value)}
                                className="h-8 text-xs"
                                placeholder="Marks obtained"
                              />
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">Marks: {marksObtained}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {canEdit && (
              <div className="space-y-2">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adjustment notes (optional)"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={onClose}>
                    <X className="h-4 w-4 mr-1" /> Close
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-1" /> Save
                  </Button>
                </div>
              </div>
            )}

            {!canEdit && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={onClose}>
                  <X className="h-4 w-4 mr-1" /> Close
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default AttemptReviewModal;
