import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosInstance from "@/Helper/axiosInstance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  ArrowLeft,
  Send,
  Trophy,
  RotateCcw,
  Unlock
} from "lucide-react";
import { getMediaUrl } from "@/utils/mediaUtils";

const TakeQuiz = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [startTime, setStartTime] = useState(null);

  // Load quiz data
  useEffect(() => {
    const loadQuiz = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get(`/api/attempts/start/${quizId}`);
        const data = response.data.data;

        if (!data.canAttempt) {
          setError(data.reason || "Cannot attempt this quiz");
          setQuiz({ title: data.quiz?.title || "Quiz" });
          return;
        }

        setQuiz(data.quiz);
        setTimeRemaining(data.quiz.timeLimit ? data.quiz.timeLimit * 60 : null);
        setStartTime(Date.now());

        // Initialize answers array
        const initialAnswers = {};
        data.quiz.questions.forEach((_, index) => {
          initialAnswers[index] = null;
        });
        setAnswers(initialAnswers);

        // Start timer if time limit exists
        if (data.quiz.timeLimit) {
          setTimerActive(true);
        }

        setError(null);
      } catch (err) {
        console.error("Failed to load quiz:", err);
        setError(err.response?.data?.message || "Failed to load quiz");
      } finally {
        setLoading(false);
      }
    };

    if (quizId) {
      loadQuiz();
    }
  }, [quizId]);

  // Timer countdown
  useEffect(() => {
    if (!timerActive || timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setTimerActive(false);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timerActive, timeRemaining]);

  const handleAutoSubmit = () => {
    if (!submitting) {
      handleSubmit(true);
    }
  };

  const handleAnswerChange = (questionIndex, option) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: option
    }));
  };

  const handleSubmit = async (autoSubmit = false) => {
    try {
      setSubmitting(true);
      setTimerActive(false);

      // Calculate time taken
      const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

      // Convert answers to array format
      const answersArray = quiz.questions.map((_, index) => answers[index]);

      const response = await axiosInstance.post("/api/attempts/submit", {
        quizId,
        answers: answersArray,
        timeTaken
      });

      setResult(response.data.data);
    } catch (err) {
      console.error("Failed to submit quiz:", err);
      setError(err.response?.data?.message || "Failed to submit quiz");
      setTimerActive(true); // Restart timer on error
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    if (seconds === null) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAnsweredCount = () => {
    return Object.values(answers).filter(answer => answer !== null).length;
  };

  const handleBackToCourse = () => {
    navigate("/student/course");
  };

  const handleRetry = () => {
    setResult(null);
    setAnswers({});
    setTimeRemaining(quiz?.timeLimit ? quiz.timeLimit * 60 : null);
    setStartTime(Date.now());
    setTimerActive(quiz?.timeLimit ? true : false);
    setError(null);

    // Reinitialize answers
    const initialAnswers = {};
    quiz.questions.forEach((_, index) => {
      initialAnswers[index] = null;
    });
    setAnswers(initialAnswers);
  };

  const handleContactInstructor = () => {
    // You could implement email functionality or modal here
    alert("Please contact your instructor for assistance with this quiz.");
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="animate-pulse">
          <Card>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-gray-200 rounded"></div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show result page
  if (result) {
    return (
      <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        <Card className={`${result.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.passed ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : (
                <AlertCircle className="h-6 w-6 text-red-600" />
              )}
              Test {result.passed ? 'Passed!' : 'Failed'}
            </CardTitle>
            <CardDescription>
              {result.quiz.title} - {result.quiz.module?.title}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Score Display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-gray-900">{result.scorePercent}%</div>
                <div className="text-sm text-gray-600">Your Score</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-gray-900">{result.score}/{result.totalMarks}</div>
                <div className="text-sm text-gray-600">Points Earned</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-gray-900">{result.quiz.passingScore}%</div>
                <div className="text-sm text-gray-600">Passing Score</div>
              </div>
            </div>

            {/* Progress Messages */}
            {result.nextModuleUnlocked && (
              <Alert className="bg-blue-50 border-blue-200">
                <Unlock className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  🎉 Congratulations! The next module has been unlocked.
                </AlertDescription>
              </Alert>
            )}

            {result.levelUpgraded && (
              <Alert className="bg-purple-50 border-purple-200">
                <Trophy className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-purple-800">
                  🏆 Level Up! You've been promoted to {result.newLevel}!
                </AlertDescription>
              </Alert>
            )}

            {/* Attempts Info */}
            <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
              <div>
                <div className="font-medium">Attempts Used</div>
                <div className="text-sm text-gray-600">
                  {result.attemptsAllowed === 0
                    ? `${result.attemptsUsed} of Unlimited attempts`
                    : `${result.attemptsUsed} of ${result.attemptsAllowed} attempts`}
                </div>
              </div>
              <div>
                <Badge variant={result.canRetry ? "secondary" : "destructive"}>
                  {result.attemptsAllowed === 0
                    ? "Unlimited attempts remaining"
                    : `${result.attemptsRemaining} attempts remaining`}
                </Badge>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleBackToCourse} variant="outline" className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Course
              </Button>

              {!result.passed && result.canRetry && (
                <Button onClick={handleRetry} className="flex-1">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}

              {!result.passed && !result.canRetry && (
                <Button onClick={handleContactInstructor} variant="secondary" className="flex-1">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Contact Instructor
                </Button>
              )}
            </div>

            {/* Detailed Answers (Optional - could be collapsible) */}
            {result.detailedAnswers && (
              <div className="space-y-3">
                <h3 className="font-semibold">Review Answers:</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {result.detailedAnswers.map((answer, index) => (
                    <div key={index} className={`p-3 rounded-lg border ${answer.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-start gap-2 mb-2">
                        {answer.isCorrect ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium text-sm">Question {answer.questionNumber}</div>
                          <div className="text-xs text-gray-600 mb-1">{answer.questionText}</div>
                          <div className="text-xs">
                            <span className="font-medium">Your answer:</span> {answer.userAnswer || "Not answered"}
                          </div>
                          {!answer.isCorrect && (
                            <div className="text-xs text-green-700">
                              <span className="font-medium">Correct answer:</span> {answer.correctAnswer}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-600">
                          {answer.marksObtained}/{answer.totalMarks}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div><strong>Error:</strong> {error}</div>
              {error.includes("not found") && (
                <div className="text-sm">
                  This usually means the test route is not properly configured or the server is not running.
                </div>
              )}
              {error.includes("401") || error.includes("authentication") || error.includes("unauthorized") ? (
                <div className="text-sm">
                  Authentication error. Please try logging out and logging in again.
                </div>
              ) : null}
            </div>
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleBackToCourse}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Course
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="secondary"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Show quiz taking interface
  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Quiz Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <span className="break-words">{quiz.title}</span>
              </CardTitle>
              {quiz.description && (
                <CardDescription className="mt-2 text-sm">{quiz.description}</CardDescription>
              )}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3 text-xs sm:text-sm text-gray-600">
                <span>Module: {quiz.module?.title}</span>
                <span className="hidden sm:inline">•</span>
                <span>Passing: {quiz.passingScore}%</span>
                <span className="hidden sm:inline">•</span>
                <span>{quiz.questions.length} Questions</span>
              </div>
            </div>

            {/* Timer */}
            {timeRemaining !== null && (
              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-2 text-base sm:text-lg font-bold">
                  <Clock className={`h-4 w-4 sm:h-5 sm:w-5 ${timeRemaining <= 300 ? 'text-red-600' : 'text-blue-600'}`} />
                  <span className={timeRemaining <= 300 ? 'text-red-600' : 'text-blue-600'}>
                    {formatTime(timeRemaining)}
                  </span>
                </div>
                <div className="text-xs text-gray-600">Time Remaining</div>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-xs sm:text-sm text-gray-600">
                {getAnsweredCount()} of {quiz.questions.length} answered
              </span>
            </div>
            <Progress
              value={(getAnsweredCount() / quiz.questions.length) * 100}
              className="h-2"
            />
          </div>
        </CardHeader>
      </Card>

      {/* Questions */}
      <div className="space-y-6">
        {quiz.questions.map((question, questionIndex) => (
          <Card key={questionIndex} className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">
                Question {question.questionNumber}
                <Badge variant="outline" className="ml-2 text-xs">
                  {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
                </Badge>
              </CardTitle>
              <CardDescription className="text-base text-gray-800">
                {question.questionText}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {question.image && question.image.url && (
                <div className="mb-4 flex justify-center">
                  <img
                    src={getMediaUrl(question.image.url)}
                    alt="Question Reference"
                    className="max-h-72 w-auto rounded-md object-contain border bg-white"
                  />
                </div>
              )}
              <div className="space-y-3">
                {question.options.map((option, optionIndex) => (
                  <div
                    key={optionIndex}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${answers[questionIndex]?.text === option.text
                        ? 'bg-blue-50 border-blue-300'
                        : 'hover:bg-gray-50 border-gray-200'
                      }`}
                    onClick={() => handleAnswerChange(questionIndex, option)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${answers[questionIndex]?.text === option.text
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300'
                        }`}>
                        {answers[questionIndex]?.text === option.text && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                      <span className="flex-1">{option.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submit Section */}
      <Card className="bg-gray-50">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="font-medium">Ready to submit?</div>
              <div className="text-sm text-gray-600">
                {getAnsweredCount() === quiz.questions.length
                  ? "All questions answered"
                  : `${quiz.questions.length - getAnsweredCount()} questions remaining`}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <Button variant="outline" onClick={handleBackToCourse} className="text-sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => handleSubmit()}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 text-sm"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Quiz
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TakeQuiz;
