import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Award, BarChart3, Clock, RefreshCw, CheckCircle, AlertCircle, Eye, XCircle, PlusCircle } from "lucide-react";

import { useRequestExtraAttemptMutation } from "@/Redux/AllApi/AttemptedQuizApi";
import axiosInstance from "@/Helper/axiosInstance";
import AttemptReviewModal from "@/components/common/AttemptReviewModal";

const StudentModuleQuizzes = ({ quizzes = [], attempts = {}, isUnlocked = false, onStart, extraGrantedQuizIds = new Set(), rejectedQuizIds = new Set() }) => {
  // Cache per-quiz attempt status (includes extra allowances)
  const [statusByQuiz, setStatusByQuiz] = useState({});
  const [pendingRequested, setPendingRequested] = useState(new Set());
  const [reviewAttemptId, setReviewAttemptId] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Hooks must remain at top-level; do not early-return before hooks
  useEffect(() => {
    let cancelled = false;
    const fetchStatuses = async () => {
      try {
        const results = await Promise.allSettled(
          quizzes.map(q => axiosInstance.get(`/api/attempts/status/${q._id || q.id || q.slug}`))
        );
        if (cancelled) return;
        const map = {};
        results.forEach((res, idx) => {
          const q = quizzes[idx];
          if (res.status === 'fulfilled') {
            const data = res.value?.data?.data;
            if (data) map[String(q._id || q.id || q.slug)] = data; // normalize key to _id when available
          }
        });
        setStatusByQuiz(map);
      } catch (_) { }
    };
    fetchStatuses();

    // Light polling for status updates (e.g., extra attempts approval)
    const interval = setInterval(fetchStatuses, 10000);

    const handler = () => fetchStatuses();
    window.addEventListener('attempt-extension-updated', handler);
    return () => { cancelled = true; window.removeEventListener('attempt-extension-updated', handler); clearInterval(interval); };
  }, [quizzes]);
  const [requestExtra, { isLoading: requesting }] = useRequestExtraAttemptMutation();

  const handleStart = (quiz) => {
    if (!isUnlocked) return;
    const quizStatus = getQuizStatus(quiz);
    if (quizStatus.status === 'no_attempts_left') return;
    if (typeof onStart === "function") onStart(quiz);
  };

  // Prefer stable ObjectId for all internal keys; fallback to slug last
  const getQuizId = (quiz) => quiz._id || quiz.id || quiz.slug;

  const getQuizStatus = (quiz) => {
    const quizId = getQuizId(quiz);
    const allAttempts = attempts[String(quizId)] || [];
    // Defensive filter to ensure we only look at valid attempt objects with scores
    const quizAttempts = allAttempts.filter(a => a && typeof a === 'object' && a.score !== undefined && a.score !== null);
    const attemptsUsed = quizAttempts.length;

    // Prefer server status (includes approved extra attempts)
    const serverStatus = statusByQuiz[String(quizId)];
    const rawAttemptsAllowed = serverStatus?.attemptsAllowed ?? quiz.attemptsAllowed;
    const isUnlimited = rawAttemptsAllowed === 0;
    const attemptsAllowed = isUnlimited ? 0 : (rawAttemptsAllowed || 1);
    let attemptsLeft = serverStatus?.attemptsRemaining ?? (isUnlimited ? Infinity : ((attemptsAllowed ?? 1) - attemptsUsed));

    // Fallback for immediate UI after approval via realtime flag
    if (extraGrantedQuizIds && extraGrantedQuizIds.has(String(quizId))) {
      attemptsLeft = Math.max(1, attemptsLeft);
    }

    if (attemptsUsed === 0 && (serverStatus?.canAttempt ?? (attemptsLeft > 0))) {
      return {
        status: 'not_attempted',
        message: 'Not attempted',
        color: 'secondary',
        icon: BarChart3,
        buttonText: 'Start Quiz',
        buttonDisabled: false,
        canStart: true
      };
    }

    // Get the best attempt (highest score)
    // Safe reduce because we filtered for non-empty objects above, but still need to be careful if array is empty (handled by attemptsUsed check)
    if (attemptsUsed === 0) {
      // Should technically be covered by above, but if we fall through (e.g. no attempts left but 0 used? impossible as logic implies attemptsUsed > 0 to get here if attemptsLeft <= 0)
      // If attemptsUsed is 0 here, it means attemptsLeft <= 0 (and !canAttempt). So "no attempts left" without ever trying? (e.g. 0 attempts allowed).
      // We need a dummy bestAttempt or handle it.
      // Actually if attemptsUsed is 0, we shouldn't be calculating 'isPassed'.
    }

    const bestAttempt = quizAttempts.length > 0 ? quizAttempts.reduce((best, current) => {
      return (current?.score > best?.score) ? current : best;
    }, quizAttempts[0]) : null;

    if (!bestAttempt) {
      // Fallback if something weird happened (attemptsUsed > 0 but no bestAttempt?)
      return {
        status: 'not_attempted',
        message: 'Error loading status',
        color: 'destructive',
        icon: AlertCircle,
        buttonText: 'Refresh',
        buttonDisabled: false,
        canStart: false
      };
    }

    const passingScore = quiz.passingScore || 70;
    const isPassed = bestAttempt.score >= passingScore;

    if (serverStatus?.canAttempt ?? (attemptsLeft > 0)) {
      if (isPassed) {
        // Business rule: once passed, do not allow retakes; only show results
        return {
          status: 'passed_no_attempts',
          message: `Completed: ${bestAttempt.score}%`,
          color: 'default',
          icon: CheckCircle,
          buttonText: 'View Results',
          buttonDisabled: false,
          canStart: false,
          score: bestAttempt.score
        };
      } else {
        return {
          status: 'failed_can_retake',
          message: `Score: ${bestAttempt.score}% (${attemptsLeft} attempts left)`,
          color: 'destructive',
          icon: AlertCircle,
          buttonText: `Retake Test (${attemptsLeft} left)`,
          buttonDisabled: false,
          canStart: true,
          score: bestAttempt.score
        };
      }
    } else {
      if (isPassed) {
        return {
          status: 'passed_no_attempts',
          message: `Completed: ${bestAttempt.score}%`,
          color: 'default',
          icon: CheckCircle,
          buttonText: 'View Results',
          buttonDisabled: false,
          canStart: false,
          score: bestAttempt.score
        };
      } else {
        // If server now allows attempt (approved extra), treat as retake available
        if (serverStatus?.canAttempt) {
          const leftSrv = serverStatus?.attemptsRemaining ?? 1;
          return {
            status: 'failed_can_retake',
            message: `Score: ${bestAttempt.score}% (${leftSrv} attempts left)`,
            color: 'destructive',
            icon: AlertCircle,
            buttonText: `Retake Test (${leftSrv} left)`,
            buttonDisabled: false,
            canStart: true,
            score: bestAttempt.score,
            showRequest: false
          };
        }
        // If rejected, lock completely with no buttons
        if (rejectedQuizIds && rejectedQuizIds.has(String(quizId))) {
          return {
            status: 'rejected',
            message: `Failed: ${bestAttempt.score}% (Request rejected)`,
            color: 'destructive',
            icon: XCircle,
            buttonText: '',
            buttonDisabled: true,
            canStart: false,
            score: bestAttempt.score,
            showRequest: false
          };
        }
        return {
          status: 'no_attempts_left',
          message: `Failed: ${bestAttempt.score}% (No attempts left)`,
          color: 'destructive',
          icon: XCircle,
          buttonText: pendingRequested.has(String(quizId)) ? 'Request Pending' : 'Request One More Attempt',
          buttonDisabled: !!pendingRequested.has(String(quizId)),
          canStart: false,
          score: bestAttempt.score,
          showRequest: !pendingRequested.has(String(quizId))
        };
      }
    }
  };

  // If no quizzes, render nothing
  if (!quizzes || quizzes.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="font-medium mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4" />
        Quizzes ({quizzes.length})
      </h4>
      <div className="space-y-3">
        {quizzes.map((quiz, idx) => {
          const quizStatus = getQuizStatus(quiz);
          const StatusIcon = quizStatus.icon;
          const quizId = getQuizId(quiz);
          const rawAttempts = attempts[String(quizId)] || [];
          const quizAttempts = rawAttempts.filter(a => a && typeof a === 'object' && a.score !== undefined && a.score !== null);
          const attemptsUsed = quizAttempts.length;
          const server = statusByQuiz[String(quizId)];
          const rawAttemptsAllowed = server?.attemptsAllowed ?? quiz.attemptsAllowed;
          const isUnlimited = rawAttemptsAllowed === 0;
          const attemptsAllowed = isUnlimited ? 0 : (rawAttemptsAllowed || 1);

          return (
            <Card
              key={quiz._id || quiz.id || idx}
              className={`${!isUnlocked ? "opacity-50" : ""}`}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 min-w-0">
                  {!isUnlocked && <Lock className="h-4 w-4" />}
                  <Award className="h-4 w-4" />
                  <span className="truncate break-words min-w-0">{quiz.title || "Module Quiz"}</span>
                </CardTitle>

                {/* Status Badges */}
                <div className="flex flex-wrap gap-2 mt-2 items-center">
                  <Badge className="bg-orange-100 text-orange-800 text-xs border-orange-200">
                    MODULE LEVEL
                  </Badge>

                  {isUnlocked && (
                    <Badge variant={quizStatus.color} className="text-xs">
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {quizStatus.message}
                    </Badge>
                  )}
                  {/* Attempts left badge */}
                  {(() => {
                    const attemptsUsedLocal = (attempts[String(quizId)] || []).length;
                    const rawAttemptsAllowedLocal = server?.attemptsAllowed ?? quiz.attemptsAllowed;
                    const isUnlimitedLocal = rawAttemptsAllowedLocal === 0;
                    let left = server?.attemptsRemaining ?? (isUnlimitedLocal ? Infinity : ((attemptsAllowed) - attemptsUsedLocal));
                    if (!isUnlimitedLocal && extraGrantedQuizIds && extraGrantedQuizIds.has(String(quizId))) {
                      left = Math.max(1, left);
                    }
                    return (
                      <Badge variant="secondary" className="text-xs">
                        {isUnlimitedLocal ? "Attempts: Unlimited" : `Left: ${Math.max(0, left)}`}
                      </Badge>
                    );
                  })()}
                </div>

                {quiz.description && (
                  <CardDescription className="mt-2 break-words overflow-hidden">{quiz.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {/* Rejection banner */}
                {(rejectedQuizIds && rejectedQuizIds.has(String(quizId))) && (
                  <div className="mb-3 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-xs">
                    This test request was rejected by your instructor/admin. No further attempts are available.
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
                  <div className="flex items-center gap-1">
                    <Award className="h-4 w-4 text-muted-foreground" />
                    Questions: {quiz.questions?.length || 0}
                  </div>
                  <div className="flex items-center gap-1">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    Passing: {quiz.passingScore || 70}%
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Time: {quiz.timeLimit ? `${quiz.timeLimit} min` : 'No time limit'}
                  </div>
                  <div className="flex items-center gap-1">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    Attempts: {server?.attemptsUsed ?? attemptsUsed}/{server?.attemptsAllowed ?? attemptsAllowed}
                  </div>
                </div>

                {/* Show attempt history if there are attempts */}
                {isUnlocked && quizAttempts.length > 0 && (
                  <div className="mb-4 p-3 bg-muted rounded-lg">
                    <h5 className="text-sm font-medium mb-2">Attempt History:</h5>
                    <div className="space-y-1">
                      {quizAttempts.map((attempt, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span>Attempt {idx + 1}:</span>
                          <span className={`${attempt.score >= (quiz.passingScore || 70)
                            ? 'text-green-600'
                            : 'text-red-600'
                            } font-medium`}>
                            {attempt.score}%
                          </span>
                        </div>
                      ))}
                    </div>
                    {quizStatus.score !== undefined && (
                      <div className="pt-2 mt-2 border-t text-xs">
                        <span className="font-medium">
                          Best Score:
                          <span className={`ml-1 ${quizStatus.score >= (quiz.passingScore || 70)
                            ? 'text-green-600'
                            : 'text-red-600'
                            }`}>
                            {quizStatus.score}%
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* If passed, show only View Results button */}
                {isUnlocked && (quizStatus.status === 'passed_no_attempts') ? (
                  <Button
                    className="w-full bg-green-100 text-green-700 hover:bg-green-200"
                    variant="outline"
                    onClick={() => {
                      const best = (attempts[String(quizId)] || []).reduce((b, c) => (c.score > b.score ? c : b), (attempts[String(quizId)] || [])[0]);
                      if (best?._id) {
                        setReviewAttemptId(best._id);
                        setReviewOpen(true);
                      }
                    }}
                  >
                    <StatusIcon className="h-4 w-4 mr-2" />
                    View Results
                  </Button>
                ) : (
                  (quizStatus.showRequest && !(rejectedQuizIds && rejectedQuizIds.has(String(quizId)))) ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={requesting || !isUnlocked}
                      onClick={async () => {
                        try {
                          await requestExtra({ quizId: quizId }).unwrap();
                          setPendingRequested(prev => new Set(prev).add(String(quizId)));
                          alert('Request sent to admin/instructor. You will be notified when approved.');
                        } catch (e) {
                          alert(e?.data?.message || 'Failed to request extra attempt');
                        }
                      }}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      {quizStatus.buttonText}
                    </Button>
                  ) : (
                    quizStatus.status === 'rejected' ? null : (
                      <Button
                        className={`w-full ${quizStatus.status === 'no_attempts_left'
                          ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed'
                          : ''
                          }`}
                        disabled={!isUnlocked || quizStatus.buttonDisabled}
                        onClick={() => handleStart(quiz)}
                      >
                        {!isUnlocked ? (
                          <>
                            <Lock className="h-4 w-4 mr-2" />
                            Complete Lessons First
                          </>
                        ) : (
                          <>
                            <StatusIcon className="h-4 w-4 mr-2" />
                            {quizStatus.buttonText}
                          </>
                        )}
                      </Button>
                    ))
                )}

                {/* Attempt review modal */}
                <AttemptReviewModal
                  attemptId={reviewAttemptId}
                  isOpen={reviewOpen}
                  onClose={() => { setReviewOpen(false); setReviewAttemptId(null); }}
                  canEdit={false}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default StudentModuleQuizzes;

