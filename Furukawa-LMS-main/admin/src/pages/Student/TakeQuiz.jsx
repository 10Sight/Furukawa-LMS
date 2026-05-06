import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosInstance from "@/Helper/axiosInstance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconClock,
  IconCircleCheck,
  IconAlertCircle,
  IconArrowLeft,
  IconDeviceFloppy,
  IconSend,
  IconTrophy,
  IconRotateClockwise,
  IconLockOpen
} from "@tabler/icons-react";
import { getMediaUrl } from "@/utils/mediaUtils";
import { useSelector } from "react-redux";

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
  const [step, setStep] = useState("loading"); // loading, quiz, result

  const { user: currentUser } = useSelector((state) => state.auth);
  const isAdminOrTrainer = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN' || currentUser.role === 'INSTRUCTOR' || currentUser.role === 'TRAINER');

  const getCurrentQuarter = () => {
    const month = new Date().getMonth();
    if (month >= 3 && month <= 5) return "QUARTER-1 (APR-JUN)";
    if (month >= 6 && month <= 8) return "QUARTER-2 (JUL-SEP)";
    if (month >= 9 && month <= 11) return "QUARTER-3 (OCT-DEC)";
    return "QUARTER-4 (JAN-MAR)";
  };

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
        if (data.quiz.questions) {
          data.quiz.questions.forEach((_, index) => {
            initialAnswers[index] = null;
          });
        }
        setAnswers(initialAnswers);

        // Start timer if time limit exists
        if (data.quiz.timeLimit) {
          setTimerActive(true);
        }

        setError(null);
        setStep("quiz");
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
        timeTaken,
        studentId: isAdminOrTrainer ? null : currentUser.id
      });

      setResult(response.data.data);
      setStep("result");
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

  // Render logic based on step
  if (step === "loading") {
    return (
      <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="animate-pulse space-y-6">
          <Card>
            <CardHeader>
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl"></div>)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }


  if (step === "quiz") {
    return (
      <div className="max-w-6xl mx-auto p-2 sm:p-6 animate-in fade-in duration-700">
        {/* Floating Timer & Progress */}
        <div className="sticky top-4 z-50 flex justify-between items-center mb-6 pointer-events-none">
          <div className="pointer-events-auto">
            {timeRemaining !== null && (
              <Badge 
                variant="outline" 
                className={`px-4 py-2 text-lg shadow-xl border-2 flex items-center gap-2 bg-white/90 backdrop-blur-sm ${
                  timeRemaining <= 300 ? 'text-red-600 border-red-200 animate-pulse' : 'text-blue-700 border-blue-200'
                }`}
              >
                <IconClock size={20} />
                <span className="font-bold tabular-nums">{formatTime(timeRemaining)}</span>
              </Badge>
            )}
          </div>
          <div className="pointer-events-auto bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-gray-200 shadow-xl w-48 sm:w-64">
            <div className="flex justify-between text-xs font-bold mb-1">
              <span>PROGRESS</span>
              <span>{Math.round((getAnsweredCount() / (quiz?.questions?.length || 1)) * 100)}%</span>
            </div>
            <Progress value={(getAnsweredCount() / (quiz?.questions?.length || 1)) * 100} className="h-2" />
          </div>
        </div>

        {/* Standardized Test Paper Document */}
        <div className="bg-white border-[3px] border-black text-black font-serif shadow-2xl overflow-hidden mb-12">
          {/* HEADER TABLE */}
          <div className="grid grid-cols-12 border-b-[3px] border-black">
            <div className="col-span-9 border-r-[3px] border-black flex flex-col items-center justify-center py-4 bg-gray-50/50">
              <h1 className="text-2xl sm:text-3xl font-bold text-blue-900 tracking-tighter text-center uppercase">
                FURUKAWA MINDA ELECTRIC PVT. LTD
              </h1>
              <h2 className="text-xl sm:text-2xl font-semibold text-blue-800 tracking-widest mt-1 uppercase underline decoration-2 underline-offset-4">
                TEST PAPER
              </h2>
            </div>
            <div className="col-span-3 flex flex-col text-[11px] font-bold">
              <div className="grid grid-cols-2 border-b border-black flex-1">
                <div className="border-r border-black flex items-center px-2">Doc.No.</div>
                <div className="flex items-center px-2 text-blue-800">TST-HR-02</div>
              </div>
              <div className="grid grid-cols-2 border-b border-black flex-1">
                <div className="border-r border-black flex items-center px-2">REV 00</div>
                <div className="flex items-center px-2 text-blue-800">3</div>
              </div>
              <div className="grid grid-cols-2 border-b border-black flex-1">
                <div className="border-r border-black flex items-center px-2">REV. DATE</div>
                <div className="flex items-center px-2">06.10.2019</div>
              </div>
              <div className="grid grid-cols-2 flex-1">
                <div className="border-r border-black flex items-center px-2">ISSUE DATE</div>
                <div className="flex items-center px-2">04.07.2013</div>
              </div>
            </div>
          </div>

          {/* QUARTER SUB-HEADER */}
          <div className="border-b-[3px] border-black flex justify-end px-6 py-2 bg-white">
            <span className="font-bold text-lg tracking-widest uppercase">{getCurrentQuarter()}</span>
          </div>

          {/* METADATA SECTION */}
          <div className="grid grid-cols-12 border-b-[3px] border-black text-sm uppercase">
            <div className="col-span-7 border-r-[3px] border-black p-4 space-y-3 bg-white">
              <div className="flex gap-2">
                <span className="font-bold min-w-[140px]">Process Name :</span>
                <span className="border-b border-black flex-1 pb-0.5">{quiz?.category || quiz?.title || "N/A"}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold min-w-[140px]">Candidate Name :</span>
                <span className="border-b border-black flex-1 pb-0.5">{currentUser?.fullName || "N/A"}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold min-w-[140px]">Employee Code :</span>
                <span className="border-b border-black flex-1 pb-0.5 font-mono">{currentUser?.empId || "N/A"}</span>
              </div>
            </div>
            <div className="col-span-5 p-4 space-y-3 bg-white">
              <div className="flex gap-2">
                <span className="font-bold">Marks Of Each Question :</span>
                <span className="border-b border-black flex-1 pb-0.5 text-center">{quiz?.questions?.[0]?.marks || 1}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold">Test Conducted By :</span>
                <span className="border-b border-black flex-1 pb-0.5 text-center">Education Cell</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold">Test Date :</span>
                <span className="border-b border-black flex-1 pb-0.5 text-center">{new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}</span>
              </div>
            </div>
          </div>

          {/* PARAMETERS HEADER */}
          <div className="bg-gray-100/80 border-b-[3px] border-black p-3 font-bold uppercase text-lg tracking-wider text-center">
            {quiz?.course?.title || quiz?.course?.name || "THEORITICAL PARAMETERS"}
          </div>

          {/* QUESTIONS TABLE */}
          <div className="bg-white relative overflow-hidden">
            <Table className="border-collapse border-t-[3px] border-black">
              <TableHeader className="bg-gray-100">
                <TableRow className="border-b-[3px] border-black hover:bg-gray-100">
                  <TableHead className="w-[60px] border-r-[3px] border-black text-center font-bold text-black uppercase">S.No</TableHead>
                  <TableHead className="border-r-[3px] border-black font-bold text-black uppercase">Question Description</TableHead>
                  <TableHead className="w-[45%] font-bold text-black uppercase">Options / Choices</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quiz?.questions?.map((question, questionIndex) => (
                  <TableRow key={questionIndex} className="border-b-[3px] border-black hover:bg-transparent">
                    {/* Serial Number */}
                    <TableCell className="border-r-[3px] border-black text-center font-bold align-top py-6 text-lg">
                      {questionIndex + 1}
                    </TableCell>

                    {/* Question Description */}
                    <TableCell className="border-r-[3px] border-black align-top py-6 px-4">
                      <div className="space-y-4">
                        <div className="text-lg font-bold leading-tight">
                          {question.questionText}
                        </div>
                        
                        {/* Image Support */}
                        {question.image && question.image.url && (
                          <div className="border-2 border-black p-1 bg-white shadow-sm inline-block max-w-full">
                            <img
                              src={getMediaUrl(question.image.url)}
                              alt="Question Ref"
                              className="max-h-60 w-auto object-contain mx-auto"
                            />
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Options / Choices */}
                    <TableCell className="align-top py-6 px-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                        {question.options.map((option, optionIndex) => {
                          const isSelected = answers[questionIndex]?.text === option.text;
                          const letter = String.fromCharCode(97 + optionIndex);
                          
                          return (
                            <div
                              key={optionIndex}
                              onClick={() => handleAnswerChange(questionIndex, option)}
                              className={`flex items-start gap-3 cursor-pointer group/opt transition-all ${
                                isSelected ? 'text-blue-800' : 'text-gray-700 hover:text-black'
                              }`}
                            >
                              <div className={`flex-shrink-0 font-bold text-base min-w-[22px] transition-colors ${
                                isSelected ? 'text-blue-800 underline decoration-2' : 'text-gray-500 group-hover/opt:text-black'
                              }`}>
                                {letter})
                              </div>
                              <div className={`flex-1 border-b-[1.5px] transition-all font-semibold text-sm pb-0.5 leading-tight ${
                                isSelected ? 'border-blue-600 bg-blue-50/50 px-1' : 'border-black/10 hover:border-black/30 px-1'
                              }`}>
                                {option.text}
                              </div>
                              {isSelected && <IconCircleCheck size={16} className="text-green-600 mt-0.5" />}
                            </div>
                          );
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* DOCUMENT FOOTER / SUBMIT SECTION */}
        <div className="flex justify-end gap-4 mt-8 mb-20 no-print">
          <Button
            variant="outline"
            onClick={handleBackToCourse}
            className="h-11 px-8 border-2 border-gray-300 font-bold uppercase tracking-widest hover:bg-gray-50 text-gray-600 rounded-none transition-all"
          >
            <IconArrowLeft size={18} className="mr-2" />
            Cancel & Exit
          </Button>
          <Button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="h-11 px-10 bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-widest rounded-none shadow-lg active:translate-y-0.5 transition-all"
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <div className="size-4 animate-spin border-2 border-white/30 border-t-white rounded-full" />
                Processing...
              </div>
            ) : (
              <>
                <IconDeviceFloppy size={20} className="mr-2" />
                Submit Assessment
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Show result page
  if (step === "result") {
    return (
      <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-8 animate-in zoom-in-95 duration-500">
        <Card className={`border-none shadow-2xl overflow-hidden ${result.passed ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-gradient-to-br from-red-50 to-rose-50'}`}>
          <div className={`h-2 ${result.passed ? 'bg-green-500' : 'bg-red-500'}`} />
          <CardHeader className="text-center pb-8 pt-10">
            <div className={`mx-auto size-24 rounded-full flex items-center justify-center mb-6 shadow-lg animate-in bounce-in duration-1000 ${result.passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
              {result.passed ? <IconCircleCheck size={48} /> : <IconAlertCircle size={48} />}
            </div>
            <CardTitle className={`text-4xl font-black mb-2 ${result.passed ? 'text-green-900' : 'text-red-900'}`}>
              {result.passed ? 'CONGRATULATIONS!' : 'ASSESSMENT COMPLETED'}
            </CardTitle>
            <CardDescription className="text-lg font-medium text-gray-600 italic">
              {result.passed ? "You've successfully cleared the test" : "Keep practicing and try again"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8 px-6 sm:px-12 pb-12">
            {/* Score Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl text-center shadow-sm border border-white">
                <div className={`text-4xl font-black mb-1 ${result.passed ? 'text-green-600' : 'text-red-600'}`}>{result.scorePercent}%</div>
                <div className="text-xs uppercase font-bold tracking-widest text-gray-400">Accuracy</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl text-center shadow-sm border border-white">
                <div className="text-4xl font-black mb-1 text-gray-800">{result.score}/{result.totalMarks}</div>
                <div className="text-xs uppercase font-bold tracking-widest text-gray-400">Total Points</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl text-center shadow-sm border border-white">
                <div className="text-4xl font-black mb-1 text-blue-600">{Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s</div>
                <div className="text-xs uppercase font-bold tracking-widest text-gray-400">Time Taken</div>
              </div>
            </div>

            {/* Achievement Alerts */}
            <div className="space-y-3">
              {result.nextModuleUnlocked && (
                <div className="bg-blue-600 text-white p-4 rounded-xl flex items-center gap-4 shadow-lg shadow-blue-200 animate-in slide-in-from-right duration-500 delay-200">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <IconLockOpen size={24} />
                  </div>
                  <div>
                    <div className="font-bold">Next Module Unlocked!</div>
                    <div className="text-sm opacity-90">Your learning path has been updated.</div>
                  </div>
                </div>
              )}

              {result.levelUpgraded && (
                <div className="bg-purple-600 text-white p-4 rounded-xl flex items-center gap-4 shadow-lg shadow-purple-200 animate-in slide-in-from-right duration-500 delay-400">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <IconTrophy size={24} />
                  </div>
                  <div>
                    <div className="font-bold">Level Promoted!</div>
                    <div className="text-sm opacity-90">Congratulations! You've achieved {result.newLevel} status.</div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button 
                onClick={handleBackToCourse}
                className="flex-1 h-14 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all"
              >
                <IconArrowLeft size={20} className="mr-2" /> Exit Dashboard
              </Button>
              {!result.passed && result.canRetry && (
                <Button 
                  onClick={handleRetry}
                  variant="outline"
                  className="flex-1 h-14 border-2 border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 transition-all"
                >
                  <IconRotateClockwise size={20} className="mr-2" /> Attempt Again
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Review Table */}
        {result.detailedAnswers && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-700 delay-300">
            <h3 className="text-2xl font-black text-gray-900 ml-1 tracking-tight flex items-center gap-3">
              <IconTrophy className="text-blue-600" />
              Detailed Assessment Review
            </h3>
            
            <Card className="border-none shadow-xl overflow-hidden rounded-2xl">
              <Table>
                <TableHeader className="bg-gray-50/80">
                  <TableRow className="border-b border-gray-100">
                    <TableHead className="w-[60px] text-center font-bold text-gray-400">#</TableHead>
                    <TableHead className="font-bold text-gray-900">Question Details</TableHead>
                    <TableHead className="w-[200px] font-bold text-gray-900">Your Answer</TableHead>
                    <TableHead className="w-[200px] font-bold text-emerald-700 bg-emerald-50/30">Correct Answer</TableHead>
                    <TableHead className="w-[100px] text-right font-bold text-gray-900">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.detailedAnswers.map((answer, index) => (
                    <TableRow key={index} className={`border-b border-gray-50 transition-colors ${answer.isCorrect ? 'hover:bg-green-50/30' : 'hover:bg-red-50/30'}`}>
                      <TableCell className="text-center">
                        <div className={`size-8 rounded-lg flex items-center justify-center font-bold text-sm mx-auto shadow-sm ${
                          answer.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {answer.questionNumber}
                        </div>
                      </TableCell>
                      <TableCell className="py-5">
                        <p className="font-bold text-gray-900 leading-snug">{answer.questionText}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${answer.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                            {answer.userAnswer || "NO ANSWER"}
                          </span>
                          {answer.isCorrect ? 
                            <IconCircleCheck size={16} className="text-green-500 shrink-0" /> : 
                            <IconAlertCircle size={16} className="text-red-500 shrink-0" />
                          }
                        </div>
                      </TableCell>
                      <TableCell className="bg-emerald-50/10 font-bold text-emerald-700">
                        {answer.correctAnswer}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-gray-900">
                          {answer.marksObtained}
                        </span>
                        <span className="text-[10px] font-semibold text-gray-400 ml-1">/{answer.totalMarks}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-900 shadow-lg">
          <IconAlertCircle className="h-5 w-5" />
          <AlertDescription className="font-medium">
            <div className="space-y-1">
              <div><strong>System Alert:</strong> {error}</div>
              <div className="text-xs opacity-70">If this persists, please contact technical support.</div>
            </div>
          </AlertDescription>
        </Alert>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} className="h-12 px-6">
            <IconArrowLeft size={18} className="mr-2" /> Go Back
          </Button>
          <Button onClick={() => window.location.reload()} className="h-12 px-6 bg-gray-900 hover:bg-black text-white">
            <IconRotateClockwise size={18} className="mr-2" /> Reload Page
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default TakeQuiz;
