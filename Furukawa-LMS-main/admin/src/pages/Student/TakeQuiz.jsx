import React, { useEffect, useState } from "react";
import { formatPaperSubTitle } from "@/utils/formatters";
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
  IconLockOpen,
  IconPrinter
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
  const STORAGE_KEY = `fme_quiz_session_${quizId}_${currentUser?.id || currentUser?._id || 'guest'}`;
  const isAdminOrTrainer = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN' || currentUser.role === 'INSTRUCTOR' || currentUser.role === 'TRAINER');
  const isCustomRole = currentUser?.role === 'CUSTOM';
  const isCustomAdminOrTrainer = isCustomRole && ['admin', 'superadmin', 'trainer', 'instructor'].includes(String(currentUser?.customRole?.targetLayout).toLowerCase());
  const canAdminister = isAdminOrTrainer || isCustomAdminOrTrainer;

  // Stateful inputs for Candidate details & autocomplete search
  const [candidateName, setCandidateName] = useState("");
  const [eCode, setECode] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [conductedBy, setConductedBy] = useState("");

  // Populate candidate info automatically if candidate is taking quiz directly
  useEffect(() => {
    if (!canAdminister && currentUser) {
      setCandidateName(currentUser.fullName || "");
      const code = (currentUser.userName || "").toUpperCase();
      setECode(code);
      setSelectedStudent(currentUser);
    }
  }, [currentUser, canAdminister]);

  const handleCandidateNameChange = async (value) => {
    setCandidateName(value);
    setSelectedStudent(null); // Reset selected student as typing indicates custom/new candidate

    if (!canAdminister) {
      setECode(""); // Clear own eCode so backend doesn't resolve to the logged-in user
      return;
    }

    if (!value.trim() || value.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      setIsSearching(true);
      const response = await axiosInstance.get(`/api/users/students`, {
        params: {
          search: value,
          page: 1,
          limit: 10,
          includeTemporary: "true",
          isDojo: quiz?.isDojo ? "true" : undefined,
          ojtApprovedToday: !quiz?.isDojo ? "true" : undefined
        }
      });
      const studentsList = response.data?.data?.users || [];
      setSearchSuggestions(studentsList);
      setShowSuggestions(studentsList.length > 0);
    } catch (err) {
      console.error("Failed to search students:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleECodeChange = async (value) => {
    setECode(value);
    setSelectedStudent(null); // Reset as typing indicates custom/new E.code

    if (!canAdminister) {
      return;
    }

    if (!value.trim() || value.length < 2) {
      return;
    }

    try {
      const response = await axiosInstance.get(`/api/users/students`, {
        params: {
          search: value,
          page: 1,
          limit: 5,
          includeTemporary: "true",
          isDojo: quiz?.isDojo ? "true" : undefined,
          ojtApprovedToday: !quiz?.isDojo ? "true" : undefined
        }
      });
      const studentsList = response.data?.data?.users || [];
      const exactMatch = studentsList.find(s => {
        const studentCode = s.userName || "";
        return studentCode.toLowerCase().trim() === value.toLowerCase().trim();
      });
      if (exactMatch) {
        setCandidateName(exactMatch.fullName);
        setSelectedStudent(exactMatch);
      }
    } catch (err) {
      console.error("Failed to search student by E.code:", err);
    }
  };

  const handleSelectStudent = (student) => {
    setCandidateName(student.fullName);
    const code = (student.userName || "").toUpperCase();
    setECode(code);
    setSelectedStudent(student);
    setShowSuggestions(false);
  };

  const totalMarks = quiz?.questions?.reduce((sum, q) => sum + (q.marks || 1), 0) || 0;
  const passingMarks = Math.round(totalMarks * (quiz?.passingScore || 70) / 100);

  const getMarksOfEachQuestion = () => {
    if (!quiz?.questions || quiz.questions.length === 0) return "1 Mark";
    const marksList = [...new Set(quiz.questions.map(q => q.marks || 1))];
    if (marksList.length === 1) {
      return `${marksList[0]} Mark${marksList[0] > 1 ? 's' : ''}`;
    }
    return marksList.join(" + ") + " Marks";
  };

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

        // Check if there is a saved session in localStorage
        const savedSessionStr = localStorage.getItem(STORAGE_KEY);
        let restoredSession = null;
        if (savedSessionStr) {
          try {
            restoredSession = JSON.parse(savedSessionStr);
          } catch (e) {
            console.error("Failed to parse saved quiz session:", e);
          }
        }

        if (restoredSession && restoredSession.startTime) {
          // Calculate elapsed time in seconds
          const elapsedSeconds = Math.floor((Date.now() - restoredSession.startTime) / 1000);
          const limitSeconds = data.quiz.timeLimit ? data.quiz.timeLimit * 60 : null;

          if (limitSeconds !== null) {
            const remaining = limitSeconds - elapsedSeconds;
            if (remaining <= 0) {
              // The time has already expired while they were away
              setTimeRemaining(0);
              setStartTime(restoredSession.startTime);

              if (restoredSession.answers) {
                setAnswers(restoredSession.answers);
              } else {
                const initialAnswers = {};
                if (data.quiz.questions) {
                  data.quiz.questions.forEach((_, index) => {
                    initialAnswers[index] = null;
                  });
                }
                setAnswers(initialAnswers);
              }

              if (restoredSession.candidateName) setCandidateName(restoredSession.candidateName);
              if (restoredSession.eCode) setECode(restoredSession.eCode);
              if (restoredSession.selectedStudent) setSelectedStudent(restoredSession.selectedStudent);
              if (restoredSession.conductedBy) setConductedBy(restoredSession.conductedBy);

              setStep("quiz");
              setLoading(false);
              // Trigger auto submit immediately
              setTimeout(() => handleAutoSubmit(), 100);
              return;
            } else {
              // Resuming with remaining time
              setTimeRemaining(remaining);
              setStartTime(restoredSession.startTime);
              setTimerActive(true);
            }
          } else {
            // No time limit quiz
            setStartTime(restoredSession.startTime);
          }

          // Restore answers
          if (restoredSession.answers) {
            setAnswers(restoredSession.answers);
          } else {
            const initialAnswers = {};
            if (data.quiz.questions) {
              data.quiz.questions.forEach((_, index) => {
                initialAnswers[index] = null;
              });
            }
            setAnswers(initialAnswers);
          }

          // Restore candidate details
          if (restoredSession.candidateName) setCandidateName(restoredSession.candidateName);
          if (restoredSession.eCode) setECode(restoredSession.eCode);
          if (restoredSession.selectedStudent) setSelectedStudent(restoredSession.selectedStudent);
          if (restoredSession.conductedBy) setConductedBy(restoredSession.conductedBy);

        } else {
          // Initialize fresh attempt
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

  // Auto-save quiz session to localStorage whenever state changes
  useEffect(() => {
    if (step === "quiz" && startTime) {
      const sessionData = {
        answers,
        candidateName,
        eCode,
        selectedStudent,
        conductedBy,
        startTime
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    }
  }, [answers, candidateName, eCode, selectedStudent, conductedBy, startTime, step, STORAGE_KEY]);

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

      let studentIdToSubmit = null;
      let submitCandidateName = null;
      let submitECode = null;

      if (canAdminister) {
        if (selectedStudent) {
          studentIdToSubmit = selectedStudent.id || selectedStudent._id;
        } else {
          if (!candidateName.trim()) {
            alert("Please enter a Candidate Name");
            setSubmitting(false);
            setTimerActive(quiz?.timeLimit ? true : false);
            return;
          }
          submitCandidateName = candidateName.trim();
          submitECode = eCode.trim();
        }
      } else {
        // For standard students (e.g. shared accounts)
        const nameChanged = candidateName.trim() !== (currentUser?.fullName || "").trim();
        const currentUserCode = (currentUser?.userName || "").toUpperCase();
        const codeChanged = eCode.trim().toUpperCase() !== currentUserCode;

        if (nameChanged || codeChanged) {
          if (!candidateName.trim()) {
            alert("Please enter a Candidate Name");
            setSubmitting(false);
            setTimerActive(quiz?.timeLimit ? true : false);
            return;
          }
          submitCandidateName = candidateName.trim();
          // Only send eCode if it was explicitly changed; sending own eCode causes
          // the backend to resolve the attempt back to the logged-in user
          submitECode = codeChanged ? eCode.trim() : "";
          if (selectedStudent) {
            studentIdToSubmit = selectedStudent.id || selectedStudent._id;
          }
        } else {
          studentIdToSubmit = currentUser.id;
        }
      }

      // Calculate time taken
      const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

      // Convert answers to array format
      const answersArray = quiz.questions.map((_, index) => answers[index]);

      const response = await axiosInstance.post("/api/attempts/submit", {
        quizId,
        answers: answersArray,
        timeTaken,
        studentId: studentIdToSubmit,
        candidateName: submitCandidateName,
        eCode: submitECode,
        conductedBy: conductedBy
      });

      const resultData = response.data.data;
      setResult(resultData);

      // Sync displayed name/code to whoever the attempt was actually stored under
      if (resultData.attemptedBy) {
        setCandidateName(resultData.attemptedBy.fullName || candidateName);
        setECode((resultData.attemptedBy.userName || "").toUpperCase());
      }

      localStorage.removeItem(STORAGE_KEY);
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
    localStorage.removeItem(STORAGE_KEY);
    const base = "/" + (window.location.pathname.split('/')[1] || "student");

    if (base === "/student") {
      if (!quiz?.course) {
        navigate("/student/test-paper");
      } else {
        navigate("/student");
      }
    } else {
      navigate(`${base}/test-paper`);
    }
  };

  const handleRetry = () => {
    localStorage.removeItem(STORAGE_KEY);
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

  // Show error state first to prevent indefinite skeleton loops on load failures
  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4 animate-in fade-in duration-500">
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
        <style dangerouslySetInnerHTML={{
          __html: `
          @media print {
            @page {
              size: portrait !important;
              margin: 0.4in !important;
            }
            body {
              background: white !important;
              color: black !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .no-print {
              display: none !important;
            }
            /* Custom paper worksheet styling for print */
            table, th, td, input, select, textarea {
              font-size: 11px !important;
              line-height: 1.3 !important;
              color: black !important;
            }
            th, td {
              padding: 6px 8px !important;
              border-color: black !important;
            }
            /* Prevent shadow grids */
            .shadow-2xl, .shadow-sm {
              box-shadow: none !important;
            }
          }
        `}} />
        {/* Floating Timer & Progress */}
        <div className="sticky top-4 z-50 flex justify-between items-center mb-6 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2">
            {timeRemaining !== null && (
              <Badge
                variant="outline"
                className={`px-4 py-2 text-lg shadow-xl border-2 flex items-center gap-2 bg-white/90 backdrop-blur-sm ${timeRemaining <= 300 ? 'text-red-600 border-red-200 animate-pulse' : 'text-blue-700 border-blue-200'
                  }`}
              >
                <IconClock size={20} />
                <span className="font-bold tabular-nums">{formatTime(timeRemaining)}</span>
              </Badge>
            )}

            <Button
              onClick={handleBackToCourse}
              className="px-4 py-2 h-10 shadow-xl border-2 border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 font-bold text-sm rounded-xl no-print"
              title="Cancel and Exit Test"
            >
              <IconArrowLeft size={18} />
              <span className="hidden sm:inline">Cancel & Exit</span>
            </Button>

            <Button
              onClick={() => window.print()}
              className="px-4 py-2 h-10 shadow-xl border-2 border-black bg-white text-black hover:bg-gray-100 flex items-center gap-2 font-bold text-sm rounded-xl no-print"
              title="Print Test Paper"
            >
              <IconPrinter size={18} />
              <span className="hidden sm:inline">Print Paper</span>
            </Button>
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
            {/* Logo box */}
            <div className="col-span-3 border-r-[3px] border-black flex flex-col items-center justify-center p-3 bg-white text-center">
              <span className="text-4xl font-extrabold italic tracking-tight text-black font-sans leading-none">
                <img src="../../fme_transparent.png" alt="Furukawa Minda Electric" height={"75px"} width={"110px"} />
              </span>
              <span className="text-[12px] font-black text-black mt-0 uppercase tracking-tight leading-none text-center">
                FURUKAWA MINDA<br />ELECTRIC PVT. LTD.
              </span>
            </div>

            {/* Title box */}
            <div className="col-span-6 border-r-[3px] border-black flex flex-col items-center justify-center py-4 bg-white text-center">
              <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight uppercase leading-none">
                {quiz?.paperTitle || "SKILL EVALUATION TEST PAPER"}
              </h1>
              <h2 className="text-sm sm:text-base font-bold text-black tracking-wide mt-2.5 uppercase leading-none">
                {formatPaperSubTitle(quiz?.paperSubTitle, quiz?.level, quiz?.isDojo, "New Manpower")}
              </h2>
            </div>

            {/* Doc control metadata box */}
            <div className="col-span-3 flex flex-col text-[10px] font-bold bg-white">
              <div className="grid grid-cols-2 border-b border-black flex-1 items-center">
                <div className="border-r border-black h-full flex items-center px-2">Doc.No.</div>
                <div className="px-2 text-black">{quiz?.docNo || "TST-HR-02"}</div>
              </div>
              <div className="grid grid-cols-2 border-b border-black flex-1 items-center">
                <div className="border-r border-black h-full flex items-center px-2">REV 00</div>
                <div className="px-2 text-black">02</div>
              </div>
              <div className="grid grid-cols-2 border-b border-black flex-1 items-center">
                <div className="border-r border-black h-full flex items-center px-2">REV. DATE</div>
                <div className="px-2">08.04.2021</div>
              </div>
              <div className="grid grid-cols-2 flex-1 items-center">
                <div className="border-r border-black h-full flex items-center px-2">ISSUE DATE</div>
                <div className="px-2">08.04.2021</div>
              </div>
            </div>
          </div>

          {/* QUARTER SUB-HEADER */}


          {/* METADATA SECTION */}
          <div className="grid grid-cols-12 border-b-[3px] border-black text-xs uppercase font-bold">
            {/* Left box */}
            <div className="col-span-7 border-r-[3px] border-black p-4 space-y-3 bg-white">
              <div className="flex gap-2 items-center">
                <span className="min-w-[120px] text-black">Process Name :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-black px-1 font-semibold">
                  {quiz?.subSectionNames && quiz.subSectionNames.length > 0
                    ? quiz.subSectionNames.join(", ")
                    : quiz?.title || "Visual"}
                </span>
              </div>
              <div className="flex gap-2 items-center relative">
                <span className="min-w-[120px] text-black">Candidate Name :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-black px-1 font-semibold relative">
                  {canAdminister ? (
                    <div className="relative w-full">
                      <input
                        type="text"
                        value={candidateName}
                        onChange={(e) => handleCandidateNameChange(e.target.value)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        onFocus={() => {
                          if (searchSuggestions.length > 0) setShowSuggestions(true);
                        }}
                        className="w-full bg-transparent focus:outline-none focus:ring-0 text-black border-none"
                        placeholder="Type to search or enter manually..."
                        required
                      />
                      {showSuggestions && searchSuggestions.length > 0 && (
                        <ul className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto z-50 text-left normal-case font-normal no-print">
                          {searchSuggestions.map((student) => (
                            <li
                              key={student.id || student._id}
                              onMouseDown={() => handleSelectStudent(student)}
                              className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm flex flex-col"
                            >
                              <span className="font-bold text-gray-800">{student.fullName}</span>
                              <span className="text-xs text-gray-500 font-mono">E.Code: {(student.userName || "").toUpperCase()}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {isSearching && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 no-print">
                          Searching...
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={candidateName}
                      onChange={(e) => handleCandidateNameChange(e.target.value)}
                      className="w-full bg-transparent focus:outline-none focus:ring-0 text-black border-none"
                      placeholder="Enter candidate name..."
                      required
                    />
                  )}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="min-w-[120px] text-black">E.Code :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-black px-1 font-mono">
                  {canAdminister ? (
                    <input
                      type="text"
                      value={eCode}
                      onChange={(e) => handleECodeChange(e.target.value)}
                      className="w-full bg-transparent focus:outline-none focus:ring-0 text-black border-none"
                      placeholder="Enter E.Code..."
                      required
                    />
                  ) : (
                    <input
                      type="text"
                      value={eCode}
                      onChange={(e) => handleECodeChange(e.target.value)}
                      className="w-full bg-transparent focus:outline-none focus:ring-0 text-black border-none"
                      placeholder="Enter E.Code..."
                    />
                  )}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="min-w-[120px] text-black">Department :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-black px-1 font-semibold font-sans">
                  {selectedStudent?.department?.name || selectedStudent?.department || selectedStudent?.departmentName || currentUser?.department?.name || currentUser?.department || currentUser?.departmentName || "—"}
                </span>
              </div>
            </div>

            {/* Right box */}
            <div className="col-span-5 p-4 space-y-2 bg-white text-[11px]">
              <div className="flex gap-2 items-center">
                <span className="text-black">Marks Of Each Question :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-center text-black font-semibold">
                  {getMarksOfEachQuestion()}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-black">Total Marks :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-center text-black font-semibold">
                  {totalMarks} Marks
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-black">Passing Marks Required :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-center text-black font-semibold">
                  {passingMarks} Marks ({quiz?.passingScore || 70}%)
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-black">Test Conducted By :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-center text-black font-semibold">
                  <input
                    type="text"
                    value={conductedBy}
                    onChange={(e) => setConductedBy(e.target.value)}
                    className="w-full bg-transparent text-center focus:outline-none focus:ring-0 border-none font-semibold text-black"
                  />
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-black">Test Date :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-center text-black font-semibold">
                  {new Date().toLocaleDateString('en-GB').replace(/\//g, '.')}
                </span>
              </div>
            </div>
          </div>

          {/* PARAMETERS HEADER */}
          <div className="bg-gray-100/80 border-b-[3px] border-black p-3 font-bold uppercase text-lg tracking-wider text-center">
            {quiz?.course?.title || quiz?.course?.name || quiz?.title || "THEORITICAL PARAMETERS"}
          </div>

          {/* QUESTIONS TABLE */}
          <div className="bg-white relative overflow-hidden">
            <Table className="border-collapse border-t-[3px] border-black">
              <TableHeader className="bg-gray-100">
                <TableRow className="border-b-[3px] border-black hover:bg-gray-100">
                  <TableHead className="w-[80px] border-r-[3px] border-black text-center font-bold text-black uppercase text-sm">S.No</TableHead>
                  <TableHead className="font-bold text-black uppercase text-sm">Questions & Options</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quiz?.questions?.map((question, questionIndex) => (
                  <TableRow key={questionIndex} className="border-b-[3px] border-black hover:bg-transparent">
                    {/* Serial Number */}
                    <TableCell className="border-r-[3px] border-black text-center font-bold align-top py-6 text-lg w-[80px]">
                      {questionIndex + 1}
                    </TableCell>

                    {/* Question Content & Options */}
                    <TableCell className="align-top py-6 px-6 space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex flex-col">
                          <span className="text-lg font-bold leading-snug">{question.questionText}</span>
                          {question.questionTextSec && (
                            <span className="text-sm font-semibold text-gray-600 italic mt-1">{question.questionTextSec}</span>
                          )}
                        </div>
                        <span className="text-xs font-black text-gray-600 shrink-0 border border-gray-400 px-1.5 py-0.5 rounded uppercase tracking-wider bg-gray-50 leading-none mt-1">
                          {question.marks || 1} {question.marks === 1 ? 'Mark' : 'Marks'}
                        </span>
                      </div>

                      {/* Image Support */}
                      {question.image && question.image.url && (
                        <div className="border-2 border-black p-1 bg-white inline-block max-w-full my-2">
                          <img
                            src={getMediaUrl(question.image.url)}
                            alt="Question Reference"
                            className="max-h-60 object-contain"
                          />
                        </div>
                      )}

                      {/* MCQ option choices - aligned horizontally exactly as in the photo */}
                      {(!question.type || question.type === "mcq") && (
                        <div className="flex flex-wrap gap-x-8 gap-y-4 pt-2">
                          {(question.options || []).map((option, optionIndex) => {
                            const isSelected = answers[questionIndex]?.text === option.text;
                            return (
                              <div
                                key={optionIndex}
                                onClick={() => handleAnswerChange(questionIndex, option)}
                                className={`flex items-center gap-2.5 cursor-pointer select-none transition-all p-2 rounded-lg ${isSelected
                                  ? 'bg-blue-50/60 ring-2 ring-blue-600 font-extrabold text-blue-900 shadow-sm'
                                  : 'hover:bg-gray-50 text-gray-800'
                                  }`}
                              >
                                {/* Circle Bubble Index */}
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center border-2 font-bold text-sm transition-colors ${isSelected
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : 'border-black text-black bg-white'
                                  }`}>
                                  {optionIndex + 1}
                                </span>

                                <div className="flex flex-col">
                                  <span className="text-sm font-bold tracking-tight">{option.text}</span>
                                  {option.textSec && (
                                    <span className="text-xs font-semibold text-gray-500 italic">{option.textSec}</span>
                                  )}
                                </div>

                                {/* Image side-by-side inside choice block */}
                                {option.image && option.image.url && (
                                  <div className={`border-2 p-1 bg-white ml-2 rounded shadow-sm ${isSelected ? 'border-blue-600' : 'border-black'
                                    }`}>
                                    <img
                                      src={getMediaUrl(option.image.url)}
                                      alt={`Option ${optionIndex + 1}`}
                                      className="max-h-16 object-contain"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Short Answer Fill-in-the-blank line */}
                      {question.type === "shortAnswer" && (
                        <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                          <span className="text-sm font-black text-gray-800 shrink-0">Your Answer:</span>
                          <input
                            type="text"
                            placeholder="Type your answer here..."
                            value={answers[questionIndex]?.text || ""}
                            onChange={(e) => handleAnswerChange(questionIndex, { text: e.target.value })}
                            className="flex-1 bg-transparent border-b-2 border-dashed border-black focus:border-blue-600 focus:outline-none py-1 font-bold text-base px-2 uppercase tracking-wide"
                          />
                        </div>
                      )}

                      {/* Matching Selection Panel */}
                      {question.type === "matching" && (
                        <div className="pt-2 space-y-4">
                          <div className="bg-gray-50 border-2 border-black p-2 text-xs font-bold text-black uppercase tracking-wider">
                            Select the matching right element for each left element below:
                          </div>
                          <div className="space-y-4">
                            {(question.pairs || []).map((pair, pIdx) => {
                              const selectedVal = answers[questionIndex]?.matches?.[pair.leftText] || "";
                              return (
                                <div key={pIdx} className="flex flex-col md:flex-row md:items-center gap-4 p-4 border-2 border-black bg-white shadow-sm">
                                  {/* Left item */}
                                  <div className="flex-1 space-y-1">
                                    <div className="font-bold text-base text-black">
                                      {pair.leftText}
                                    </div>
                                    {pair.leftTextSec && (
                                      <div className="text-xs font-semibold text-gray-500 italic">
                                        {pair.leftTextSec}
                                      </div>
                                    )}
                                    {pair.leftImage && pair.leftImage.url && (
                                      <div className="border border-black p-1 bg-white inline-block max-w-full">
                                        <img
                                          src={getMediaUrl(pair.leftImage.url)}
                                          alt="Left Item"
                                          className="max-h-24 object-contain"
                                        />
                                      </div>
                                    )}
                                  </div>

                                  <div className="text-black font-black text-xl hidden md:block">➔</div>

                                  {/* Right Match */}
                                  <div className="w-full md:w-72 space-y-2">
                                    <select
                                      value={selectedVal}
                                      onChange={(e) => {
                                        const currentMatches = answers[questionIndex]?.matches || {};
                                        const updatedMatches = { ...currentMatches, [pair.leftText]: e.target.value };
                                        handleAnswerChange(questionIndex, {
                                          text: JSON.stringify(updatedMatches),
                                          matches: updatedMatches
                                        });
                                      }}
                                      className="w-full h-11 px-3 border-2 border-black font-bold text-sm focus:outline-none focus:border-blue-600 bg-white"
                                    >
                                      <option value="">-- Select Match --</option>
                                      {(question.pairs || []).map((p, rIdx) => (
                                        <option key={rIdx} value={p.rightText}>
                                          {p.rightText} {p.rightTextSec ? ` (${p.rightTextSec})` : ''}
                                        </option>
                                      ))}
                                    </select>

                                    {/* Preview selected matched pair image */}
                                    {(() => {
                                      const matched = (question.pairs || []).find(p => p.rightText === selectedVal);
                                      if (matched?.rightImage && matched.rightImage.url) {
                                        return (
                                          <div className="border border-black p-1 bg-white inline-block max-w-full">
                                            <img
                                              src={getMediaUrl(matched.rightImage.url)}
                                              alt="Selected Match"
                                              className="max-h-20 object-contain"
                                            />
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
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
      <div className="max-w-6xl mx-auto p-2 sm:p-6 space-y-8 animate-in fade-in duration-500">
        <style dangerouslySetInnerHTML={{
          __html: `
          @media print {
            @page {
              size: portrait !important;
              margin: 0.4in !important;
            }
            body {
              background: white !important;
              color: black !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .no-print {
              display: none !important;
            }
            /* Custom paper worksheet styling for print */
            table, th, td, input, select, textarea {
              font-size: 11px !important;
              line-height: 1.3 !important;
              color: black !important;
            }
            th, td {
              padding: 6px 8px !important;
              border-color: black !important;
            }
            /* Prevent shadow grids */
            .shadow-2xl, .shadow-sm {
              box-shadow: none !important;
            }
          }
        `}} />

        {/* Dashboard summary card (hidden in print) */}
        <Card className={`border-none shadow-2xl overflow-hidden no-print ${result.passed ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-gradient-to-br from-red-50 to-rose-50'}`}>
          <div className={`h-2 ${result.passed ? 'bg-green-500' : 'bg-red-500'}`} />
          <CardHeader className="text-center pb-6 pt-8">
            <div className={`mx-auto size-20 rounded-full flex items-center justify-center mb-4 shadow-lg animate-in bounce-in duration-1000 ${result.passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
              {result.passed ? <IconCircleCheck size={40} /> : <IconAlertCircle size={40} />}
            </div>
            <CardTitle className={`text-3xl font-black mb-1 ${result.passed ? 'text-green-900' : 'text-red-900'}`}>
              {result.passed ? 'CONGRATULATIONS!' : 'ASSESSMENT COMPLETED'}
            </CardTitle>
            <CardDescription className="text-base font-medium text-gray-600 italic">
              {result.passed ? "You've successfully cleared the test" : "Keep practicing and try again"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-6 sm:px-12 pb-8">
            {/* Score Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl text-center shadow-sm border border-white">
                <div className={`text-3xl font-black mb-0.5 ${result.passed ? 'text-green-600' : 'text-red-600'}`}>{result.scorePercent}%</div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Accuracy</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl text-center shadow-sm border border-white">
                <div className="text-3xl font-black mb-0.5 text-gray-800">{result.score}/{result.totalMarks}</div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Total Points</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl text-center shadow-sm border border-white">
                <div className="text-3xl font-black mb-0.5 text-blue-600">{Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s</div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Time Taken</div>
              </div>
            </div>

            {/* Achievement Alerts */}
            <div className="space-y-3">
              {result.nextModuleUnlocked && (
                <div className="bg-blue-600 text-white p-3 rounded-lg flex items-center gap-3 shadow-lg shadow-blue-200 animate-in slide-in-from-right duration-500">
                  <div className="p-1.5 bg-white/20 rounded">
                    <IconLockOpen size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-sm">Next Module Unlocked!</div>
                    <div className="text-xs opacity-90">Your learning path has been updated.</div>
                  </div>
                </div>
              )}

              {result.levelUpgraded && (
                <div className="bg-purple-600 text-white p-3 rounded-lg flex items-center gap-3 shadow-lg shadow-purple-200 animate-in slide-in-from-right duration-500 delay-100">
                  <div className="p-1.5 bg-white/20 rounded">
                    <IconTrophy size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-sm">Level Promoted!</div>
                    <div className="text-xs opacity-90">Congratulations! You've achieved {result.newLevel} status.</div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={handleBackToCourse}
                className="flex-1 h-12 bg-gray-900 text-white font-bold rounded-lg hover:bg-gray-800 transition-all text-sm uppercase tracking-wider"
              >
                <IconArrowLeft size={18} className="mr-2" /> Exit Dashboard
              </Button>
              <Button
                onClick={() => window.print()}
                className="flex-1 h-12 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all text-sm uppercase tracking-wider shadow-lg shadow-blue-200"
              >
                <IconPrinter size={18} className="mr-2" /> Print Graded Sheet
              </Button>
              {!result.passed && result.canRetry && (
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  className="flex-1 h-12 border-2 border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-50 transition-all text-sm uppercase tracking-wider"
                >
                  <IconRotateClockwise size={18} className="mr-2" /> Attempt Again
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Standardized Graded Test Paper Worksheet */}
        <div className="bg-white border-[3px] border-black text-black font-serif shadow-2xl overflow-hidden mb-12">
          {/* HEADER TABLE */}
          <div className="grid grid-cols-12 border-b-[3px] border-black">
            {/* Logo box */}
            <div className="col-span-3 border-r-[3px] border-black flex flex-col items-center justify-center p-3 bg-white text-center">
              <span className="text-4xl font-extrabold italic tracking-tight text-black font-sans leading-none">
                <img src="../../fme_transparent.png" alt="Furukawa Minda Electric" height={"75px"} width={"110px"} />
              </span>
              <span className="text-[12px] font-black text-black mt-0 uppercase tracking-tight leading-none text-center">
                FURUKAWA MINDA<br />ELECTRIC PVT. LTD.
              </span>
            </div>

            {/* Title box */}
            <div className="col-span-6 border-r-[3px] border-black flex flex-col items-center justify-center py-4 bg-white text-center">
              <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight uppercase leading-none">
                SKILL EVALUATION RESULT SHEET
              </h1>
              <h2 className="text-sm sm:text-base font-bold text-black tracking-wide mt-2.5 uppercase leading-none">
                {formatPaperSubTitle(quiz?.paperSubTitle, quiz?.level, quiz?.isDojo, "Graded Sheet")}
              </h2>
            </div>

            {/* Doc control metadata box */}
            <div className="col-span-3 flex flex-col text-[10px] font-bold bg-white">
              <div className="grid grid-cols-2 border-b border-black flex-1 items-center">
                <div className="border-r border-black h-full flex items-center px-2">Doc.No.</div>
                <div className="px-2 text-black">{quiz?.docNo || "TST-HR-02"}</div>
              </div>
              <div className="grid grid-cols-2 border-b border-black flex-1 items-center">
                <div className="border-r border-black h-full flex items-center px-2">REV 00</div>
                <div className="px-2 text-black">02</div>
              </div>
              <div className="grid grid-cols-2 border-b border-black flex-1 items-center">
                <div className="border-r border-black h-full flex items-center px-2">REV. DATE</div>
                <div className="px-2">08.04.2021</div>
              </div>
              <div className="grid grid-cols-2 flex-1 items-center">
                <div className="border-r border-black h-full flex items-center px-2">ISSUE DATE</div>
                <div className="px-2">08.04.2021</div>
              </div>
            </div>
          </div>

          {/* QUARTER SUB-HEADER */}
          <div className="border-b-[3px] border-black flex justify-end px-6 py-2 bg-white">
            <span className="font-bold text-xs tracking-widest uppercase">{getCurrentQuarter()}</span>
          </div>

          {/* METADATA SECTION */}
          <div className="grid grid-cols-12 border-b-[3px] border-black text-xs uppercase font-bold">
            {/* Left box */}
            <div className="col-span-7 border-r-[3px] border-black p-4 space-y-3 bg-white">
              <div className="flex gap-2 items-center">
                <span className="min-w-[120px] text-black">Process Name :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-black px-1 font-semibold">
                  {quiz?.subSectionNames && quiz.subSectionNames.length > 0
                    ? quiz.subSectionNames.join(", ")
                    : quiz?.title || "Visual"}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="min-w-[120px] text-black">Candidate Name :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-black px-1 font-semibold">
                  {candidateName || "—"}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="min-w-[120px] text-black">E.Code :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-black px-1 font-mono">
                  {eCode || "—"}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="min-w-[120px] text-black">Department :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-black px-1 font-semibold font-sans">
                  {selectedStudent?.department?.name || selectedStudent?.department || selectedStudent?.departmentName || currentUser?.department?.name || currentUser?.department || currentUser?.departmentName || "—"}
                </span>
              </div>
            </div>

            {/* Right box */}
            <div className="col-span-5 p-4 space-y-2 bg-white text-[11px]">
              <div className="flex gap-2 items-center">
                <span className="text-black">Marks Of Each Question :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-center text-black font-semibold">
                  {getMarksOfEachQuestion()}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-black">Total Marks :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-center text-black font-semibold">
                  {result.totalMarks} Marks
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-black">Passing Marks Required :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-center text-black font-semibold">
                  {Math.round(result.totalMarks * (quiz?.passingScore || 70) / 100)} Marks ({quiz?.passingScore || 70}%)
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-black">Marks Obtained :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-center text-black font-black text-xs">
                  {result.score} Marks ({result.scorePercent}%)
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-black">Result Status :</span>
                <span className={`border-b border-dashed border-black flex-1 pb-0.5 text-center font-black text-xs uppercase ${result.passed ? 'text-green-600 animate-pulse' : 'text-red-600'
                  }`}>
                  {result.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-black">Test Conducted By :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-center text-black font-semibold">
                  {result.conductedBy || conductedBy || "—"}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-black">Test Date :</span>
                <span className="border-b border-dashed border-black flex-1 pb-0.5 text-center text-black font-semibold">
                  {result.createdAt ? new Date(result.createdAt).toLocaleDateString('en-GB').replace(/\//g, '.') : new Date().toLocaleDateString('en-GB').replace(/\//g, '.')}
                </span>
              </div>
            </div>
          </div>

          {/* PARAMETERS HEADER */}
          <div className="bg-gray-100/80 border-b-[3px] border-black p-3 font-bold uppercase text-lg tracking-wider text-center">
            {quiz?.course?.title || quiz?.course?.name || quiz?.title || "THEORITICAL PARAMETERS REVIEW"}
          </div>

          {/* QUESTIONS TABLE */}
          <div className="bg-white relative overflow-hidden">
            <Table className="border-collapse border-t-[3px] border-black">
              <TableHeader className="bg-gray-100">
                <TableRow className="border-b-[3px] border-black hover:bg-gray-100">
                  <TableHead className="w-[80px] border-r-[3px] border-black text-center font-bold text-black uppercase text-sm">S.No</TableHead>
                  <TableHead className="font-bold text-black uppercase text-sm">Questions & Corrective Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quiz?.questions?.map((question, questionIndex) => {
                  const detailedAnswer = result.detailedAnswers?.find(d => d.questionNumber === questionIndex + 1) || {};

                  return (
                    <TableRow key={questionIndex} className="border-b-[3px] border-black hover:bg-transparent">
                      {/* Serial Number */}
                      <TableCell className="border-r-[3px] border-black text-center font-bold align-top py-6 text-lg w-[80px]">
                        {questionIndex + 1}
                      </TableCell>

                      {/* Question Content & Graded Options */}
                      <TableCell className="align-top py-6 px-6 space-y-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex flex-col">
                            <span className="text-lg font-bold leading-snug">{question.questionText}</span>
                            {question.questionTextSec && (
                              <span className="text-sm font-semibold text-gray-600 italic mt-1">{question.questionTextSec}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 mt-1">
                            <span className={`text-xs font-black shrink-0 border px-2 py-1 rounded uppercase tracking-wider leading-none shadow-sm ${detailedAnswer.isCorrect
                              ? 'bg-green-100 border-green-300 text-green-800'
                              : 'bg-red-100 border-red-300 text-red-800'
                              }`}>
                              Score: {detailedAnswer.marksObtained} / {detailedAnswer.totalMarks}
                            </span>
                          </div>
                        </div>

                        {/* Image Support */}
                        {question.image && question.image.url && (
                          <div className="border-2 border-black p-1 bg-white inline-block max-w-full my-2">
                            <img
                              src={getMediaUrl(question.image.url)}
                              alt="Question Reference"
                              className="max-h-60 object-contain"
                            />
                          </div>
                        )}

                        {/* MCQ option choices - aligned horizontally exactly as in the photo */}
                        {(!question.type || question.type === "mcq") && (
                          <div className="flex flex-wrap gap-x-8 gap-y-4 pt-2">
                            {(question.options || []).map((option, optionIndex) => {
                              const isCorrectOption = option.isCorrect || option.text === detailedAnswer.correctAnswer;
                              const isUserSelected = option.text === detailedAnswer.userAnswer;

                              let optionBg = 'hover:bg-gray-50 text-gray-800 border-transparent';
                              let badgeColor = 'border-black text-black bg-white';
                              let indicatorIcon = null;

                              if (isUserSelected && isCorrectOption) {
                                optionBg = 'bg-green-50/70 border-green-300 text-green-950 font-bold ring-2 ring-green-500 shadow-sm';
                                badgeColor = 'border-green-600 bg-green-600 text-white';
                                indicatorIcon = <IconCircleCheck size={16} className="text-green-600 ml-1 shrink-0" />;
                              } else if (isUserSelected && !isCorrectOption) {
                                optionBg = 'bg-red-50/70 border-red-300 text-red-950 font-bold ring-2 ring-red-500 shadow-sm';
                                badgeColor = 'border-red-600 bg-red-600 text-white';
                                indicatorIcon = <IconAlertCircle size={16} className="text-red-600 ml-1 shrink-0" />;
                              } else if (!isUserSelected && isCorrectOption) {
                                optionBg = 'bg-green-50/30 border-green-400 text-green-800 font-bold border-2 border-dashed';
                                badgeColor = 'border-green-500 text-green-600 bg-white';
                              }

                              return (
                                <div
                                  key={optionIndex}
                                  className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all ${optionBg}`}
                                >
                                  {/* Circle Bubble Index */}
                                  <span className={`w-7 h-7 rounded-full flex items-center justify-center border-2 font-bold text-sm ${badgeColor}`}>
                                    {optionIndex + 1}
                                  </span>

                                  <div className="flex flex-col">
                                    <span className="text-sm font-bold tracking-tight">{option.text}</span>
                                    {option.textSec && (
                                      <span className="text-xs font-semibold text-gray-500 italic">{option.textSec}</span>
                                    )}
                                  </div>

                                  {/* Indicator check/cross icon */}
                                  {indicatorIcon}

                                  {/* Image side-by-side inside choice block */}
                                  {option.image && option.image.url && (
                                    <div className="border border-black p-1 bg-white ml-2 rounded shadow-sm">
                                      <img
                                        src={getMediaUrl(option.image.url)}
                                        alt={`Option ${optionIndex + 1}`}
                                        className="max-h-16 object-contain"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Short Answer view */}
                        {question.type === "shortAnswer" && (
                          <div className="pt-2 space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-black text-gray-800 shrink-0">Your Answer:</span>
                              <div className={`flex-1 border-b-2 py-1 font-bold text-base px-2 uppercase tracking-wide flex items-center justify-between ${detailedAnswer.isCorrect
                                ? 'border-green-600 text-green-700 bg-green-50/20'
                                : 'border-red-600 text-red-700 bg-red-50/20'
                                }`}>
                                <span>{detailedAnswer.userAnswer || "NO ANSWER"}</span>
                                {detailedAnswer.isCorrect ? (
                                  <IconCircleCheck size={18} className="text-green-600 shrink-0" />
                                ) : (
                                  <IconAlertCircle size={18} className="text-red-600 shrink-0" />
                                )}
                              </div>
                            </div>

                            {!detailedAnswer.isCorrect && (
                              <div className="flex items-center gap-3 text-sm text-green-700 font-bold bg-green-50/50 p-2 border border-green-200">
                                <span>Correct Answer:</span>
                                <span className="uppercase tracking-wide">{detailedAnswer.correctAnswer}</span>
                                {detailedAnswer.correctAnswerSec && (
                                  <span className="italic text-xs text-green-600">({detailedAnswer.correctAnswerSec})</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Matching Selection View */}
                        {question.type === "matching" && (
                          <div className="pt-2 space-y-4">
                            <div className="bg-gray-50 border border-gray-300 p-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                              Graded Matching Results:
                            </div>

                            {(() => {
                              let userMatches = {};
                              try {
                                if (detailedAnswer.userAnswer) {
                                  userMatches = JSON.parse(detailedAnswer.userAnswer);
                                }
                              } catch (e) { }

                              return (
                                <div className="space-y-4">
                                  {(question.pairs || []).map((pair, pIdx) => {
                                    const userSelectedRight = userMatches[pair.leftText] || "";
                                    const isPairCorrect = String(userSelectedRight).trim().toLowerCase() === String(pair.rightText).trim().toLowerCase();

                                    return (
                                      <div
                                        key={pIdx}
                                        className={`flex flex-col md:flex-row md:items-center gap-4 p-4 border-2 shadow-sm ${isPairCorrect
                                          ? 'border-green-300 bg-green-50/10'
                                          : 'border-red-300 bg-red-50/10'
                                          }`}
                                      >
                                        {/* Left item */}
                                        <div className="flex-1 space-y-1">
                                          <div className="font-bold text-base text-black">
                                            {pair.leftText}
                                          </div>
                                          {pair.leftTextSec && (
                                            <div className="text-xs font-semibold text-gray-500 italic">
                                              {pair.leftTextSec}
                                            </div>
                                          )}
                                          {pair.leftImage && pair.leftImage.url && (
                                            <div className="border border-black p-1 bg-white inline-block max-w-full">
                                              <img
                                                src={getMediaUrl(pair.leftImage.url)}
                                                alt="Left Item"
                                                className="max-h-24 object-contain"
                                              />
                                            </div>
                                          )}
                                        </div>

                                        <div className="text-black font-black text-xl hidden md:block">➔</div>

                                        {/* User match preview compared with correct */}
                                        <div className="w-full md:w-[350px] space-y-2">
                                          <div className={`p-3 rounded-lg border flex items-center justify-between ${isPairCorrect
                                            ? 'bg-green-50 border-green-300 text-green-950 font-bold'
                                            : 'bg-red-50 border-red-300 text-red-950 font-bold'
                                            }`}>
                                            <div className="flex flex-col text-sm">
                                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Your Selection:</span>
                                              <span>{userSelectedRight || "NO SELECTION"}</span>
                                            </div>
                                            {isPairCorrect ? (
                                              <IconCircleCheck size={18} className="text-green-600 shrink-0" />
                                            ) : (
                                              <IconAlertCircle size={18} className="text-red-600 shrink-0" />
                                            )}
                                          </div>

                                          {!isPairCorrect && (
                                            <div className="p-2 bg-green-50 border border-green-200 text-green-800 text-xs font-bold rounded flex flex-col">
                                              <span className="text-[9px] text-green-600 font-bold uppercase tracking-wider">Correct Match:</span>
                                              <span>{pair.rightText} {pair.rightTextSec ? ` (${pair.rightTextSec})` : ''}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default TakeQuiz;
