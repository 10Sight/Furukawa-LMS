import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosInstance from "@/Helper/axiosInstance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  IconPlayerPlay,
  IconUser,
  IconId,
  IconCalendar,
  IconBook,
  IconGenderMale,
  IconMail,
  IconMapPin,
  IconBus,
  IconUserPlus,
  IconClock,
  IconCircleCheck,
  IconAlertCircle,
  IconChartBar,
  IconArrowLeft,
  IconSend,
  IconTrophy,
  IconRotateClockwise,
  IconLockOpen
} from "@tabler/icons-react";
import { getMediaUrl } from "@/utils/mediaUtils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [step, setStep] = useState("loading"); // loading, details, quiz, result
  const [userDetails, setUserDetails] = useState({
    fullName: "",
    empId: "",
    fatherHusbandName: "",
    gender: "",
    dob: "",
    education: "",
    joiningDate: "",
    district: "",
    state: "",
    pin: "",
    busRoute: "",
    email: "",
    userName: ""
  });
  const [registeringUser, setRegisteringUser] = useState(false);
  const [studentId, setStudentId] = useState(null);

  const { user: currentUser } = useSelector((state) => state.auth);
  const isAdminOrTrainer = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN' || currentUser.role === 'INSTRUCTOR' || currentUser.role === 'TRAINER');

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
        
        // Decide which step to show
        if (isAdminOrTrainer) {
          setStep("details");
        } else {
          setStep("quiz");
        }
      } catch (err) {
        console.error("Failed to load quiz:", err);
        setError(err.response?.data?.message || "Failed to load quiz");
      } finally {
        setLoading(false);
        if (!isAdminOrTrainer) setStep("quiz");
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
        studentId: studentId || (isAdminOrTrainer ? null : currentUser.id)
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

  const handleStartQuiz = async (e) => {
    e.preventDefault();
    if (!userDetails.fullName || !userDetails.empId) {
      setError("Name and Employee ID are required");
      return;
    }

    try {
      setRegisteringUser(true);
      setError(null);

      // Create a temporary/new user for this attempt
      // Using a specialized endpoint or just register
      const response = await axiosInstance.post("/api/v1/auth/register", {
        ...userDetails,
        role: "STUDENT",
        unit: currentUser?.unit || "UNIT_1",
        fullName: userDetails.fullName,
        isEmployee: true,
        isTemporary: true,
        password: "DefaultPassword123!", // Secure default
        // If email/userName is blank, generate it
        email: userDetails.email || `${userDetails.empId}@sarvagaya.edu`,
        userName: userDetails.userName || userDetails.empId
      });

      setStudentId(response.data.data.user.id);
      setStep("quiz");
      setStartTime(Date.now());
      if (quiz.timeLimit) setTimerActive(true);
    } catch (err) {
      console.error("Failed to register user:", err);
      setError(err.response?.data?.message || "Failed to register user details");
    } finally {
      setRegisteringUser(false);
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

  if (step === "details") {
    return (
      <div className="max-w-4xl mx-auto p-3 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="border-none shadow-2xl bg-white overflow-hidden">
          <div className="h-2 bg-blue-600" />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <IconUserPlus size={24} />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-gray-900">Trainee Registration</CardTitle>
                <CardDescription>Enter candidate details before starting the assessment</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStartQuiz} className="space-y-8 py-4">
              {error && (
                <Alert variant="destructive" className="animate-in head-shake">
                  <IconAlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* Personal Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <IconUser size={14} /> Personal Information
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input 
                      id="fullName" 
                      placeholder="Enter full name" 
                      value={userDetails.fullName}
                      onChange={e => setUserDetails(p => ({ ...p, fullName: e.target.value }))}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatherHusbandName">Father/Husband Name</Label>
                    <Input 
                      id="fatherHusbandName" 
                      placeholder="Enter name"
                      value={userDetails.fatherHusbandName}
                      onChange={e => setUserDetails(p => ({ ...p, fatherHusbandName: e.target.value }))}
                      className="h-11"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <Select 
                        onValueChange={v => setUserDetails(p => ({ ...p, gender: v }))}
                        value={userDetails.gender}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MALE">Male</SelectItem>
                          <SelectItem value="FEMALE">Female</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dob">DOB</Label>
                      <Input 
                        id="dob" 
                        type="date"
                        value={userDetails.dob}
                        onChange={e => setUserDetails(p => ({ ...p, dob: e.target.value }))}
                        className="h-11"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="education">Education</Label>
                    <Input 
                      id="education" 
                      placeholder="e.g. B.Tech, Diploma"
                      value={userDetails.education}
                      onChange={e => setUserDetails(p => ({ ...p, education: e.target.value }))}
                      className="h-11"
                    />
                  </div>
                </div>

                {/* Professional Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <IconId size={14} /> Professional Details
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="empId">Employee ID *</Label>
                    <Input 
                      id="empId" 
                      placeholder="Enter employee ID"
                      value={userDetails.empId}
                      onChange={e => setUserDetails(p => ({ ...p, empId: e.target.value }))}
                      className="h-11 border-blue-200 focus:border-blue-500 bg-blue-50/30 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="joiningDate">Joining Date</Label>
                    <Input 
                      id="joiningDate" 
                      type="date"
                      value={userDetails.joiningDate}
                      onChange={e => setUserDetails(p => ({ ...p, joiningDate: e.target.value }))}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="busRoute">Bus Route</Label>
                    <Input 
                      id="busRoute" 
                      placeholder="Enter route info"
                      value={userDetails.busRoute}
                      onChange={e => setUserDetails(p => ({ ...p, busRoute: e.target.value }))}
                      className="h-11"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="district">District</Label>
                      <Input 
                        id="district" 
                        placeholder="District"
                        value={userDetails.district}
                        onChange={e => setUserDetails(p => ({ ...p, district: e.target.value }))}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input 
                        id="state" 
                        placeholder="State"
                        value={userDetails.state}
                        onChange={e => setUserDetails(p => ({ ...p, state: e.target.value }))}
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate(-1)}
                  disabled={registeringUser}
                  className="h-12 px-8"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={registeringUser}
                  className="h-12 px-10 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 transition-all hover:scale-[1.02]"
                >
                  {registeringUser ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <IconPlayerPlay className="mr-2 h-5 w-5" />
                      Start Assessment
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "quiz") {
    return (
      <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 animate-in fade-in duration-700">
        {/* Quiz Header */}
        <Card className="bg-gradient-to-br from-white to-blue-50/50 border-blue-100 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600" />
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Badge className="bg-blue-600 text-white border-none px-3 py-1">Assessment</Badge>
                  {timeRemaining !== null && (
                    <Badge variant="outline" className={`px-3 py-1 flex items-center gap-2 ${timeRemaining <= 300 ? 'text-red-600 border-red-200 bg-red-50' : 'text-blue-700 border-blue-200 bg-blue-50'}`}>
                      <IconClock size={14} className={timeRemaining <= 300 ? 'animate-pulse' : ''} />
                      <span className="font-bold tabular-nums">{formatTime(timeRemaining)}</span>
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900 leading-tight mb-2">
                  {quiz.title}
                </CardTitle>
                {quiz.description && (
                  <CardDescription className="text-gray-600 leading-relaxed max-w-2xl">{quiz.description}</CardDescription>
                )}
                
                <div className="flex flex-wrap items-center gap-y-2 gap-x-6 mt-4 text-sm font-medium text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-blue-400" />
                    {quiz.questions.length} Questions
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-green-400" />
                    Passing: {quiz.passingScore}%
                  </div>
                  {isAdminOrTrainer && studentId && (
                    <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-xs">
                      <IconUser size={14} />
                      Candidate: {userDetails.fullName} ({userDetails.empId})
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Progress Bar Area */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">Completion</span>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-600">{Math.round((getAnsweredCount() / quiz.questions.length) * 100)}%</Badge>
                </div>
                <span className="text-xs font-medium text-gray-500 italic">
                  {getAnsweredCount()} of {quiz.questions.length} answered
                </span>
              </div>
              <Progress
                value={(getAnsweredCount() / quiz.questions.length) * 100}
                className="h-2.5 bg-gray-100"
              />
            </div>
          </CardHeader>
        </Card>

        {/* Questions Grid */}
        <div className="space-y-6">
          {quiz.questions.map((question, questionIndex) => (
            <Card key={questionIndex} className={`group border-none shadow-md transition-all duration-300 hover:shadow-lg ${answers[questionIndex] ? 'bg-white' : 'bg-white/90'}`}>
              <CardHeader className="pb-4 relative">
                <div className={`absolute top-6 -left-1 w-2 h-12 rounded-r-full transition-colors ${answers[questionIndex] ? 'bg-green-500' : 'bg-gray-200 group-hover:bg-blue-400'}`} />
                <div className="flex justify-between items-start gap-4 ml-2">
                  <CardTitle className="text-lg font-bold text-gray-800 flex items-start gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center size-7 rounded-lg bg-gray-100 text-gray-600 text-xs mt-0.5">
                      {question.questionNumber}
                    </span>
                    <span className="pt-0.5 leading-relaxed">{question.questionText}</span>
                  </CardTitle>
                  <Badge variant="outline" className="shrink-0 font-bold tabular-nums text-gray-400 border-gray-100">
                    {question.marks} PTS
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="ml-10">
                {question.image && question.image.url && (
                  <div className="mb-6 rounded-xl overflow-hidden border border-gray-100 shadow-sm inline-block max-w-full">
                    <img
                      src={getMediaUrl(question.image.url)}
                      alt="Question Reference"
                      className="max-h-96 w-auto object-contain bg-white"
                    />
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  {question.options.map((option, optionIndex) => {
                    const isSelected = answers[questionIndex]?.text === option.text;
                    return (
                      <div
                        key={optionIndex}
                        className={`group/opt p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-4
                          ${isSelected 
                            ? 'border-blue-600 bg-blue-50/50 shadow-sm' 
                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
                        onClick={() => handleAnswerChange(questionIndex, option)}
                      >
                        <div className={`flex-shrink-0 size-6 rounded-full border-2 flex items-center justify-center transition-all
                          ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-200 group-hover/opt:border-blue-400'}`}>
                          {isSelected && <div className="size-2 bg-white rounded-full" />}
                        </div>
                        <span className={`text-sm font-medium transition-colors ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                          {option.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Submit Section */}
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-none shadow-2xl p-6 sm:p-10 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-bold mb-2 flex items-center justify-center md:justify-start gap-3">
                <IconSend size={24} className="text-blue-400" /> Finished Assessment?
              </h3>
              <p className="text-gray-400 text-sm max-w-md">
                Please review your answers before submitting. You have answered <strong>{getAnsweredCount()}</strong> out of <strong>{quiz.questions.length}</strong> questions.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <Button 
                variant="ghost" 
                onClick={handleBackToCourse} 
                className="h-14 px-8 border border-white/10 text-white hover:bg-white/5 transition-all order-2 sm:order-1"
              >
                <IconArrowLeft size={20} className="mr-2" />
                Cancel & Exit
              </Button>
              <Button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="h-14 px-12 bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-900/20 font-bold text-lg transition-all hover:scale-105 active:scale-95 order-1 sm:order-2"
              >
                {submitting ? (
                  <div className="flex items-center gap-3">
                    <div className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Submitting...
                  </div>
                ) : (
                  "Finalize Assessment"
                )}
              </Button>
            </div>
          </div>
        </Card>
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

        {/* Detailed Review */}
        {result.detailedAnswers && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-700 delay-300">
            <h3 className="text-xl font-bold text-gray-800 ml-1">Review Assessment Details</h3>
            <div className="grid grid-cols-1 gap-4">
              {result.detailedAnswers.map((answer, index) => (
                <Card key={index} className={`border-none shadow-sm ${answer.isCorrect ? 'bg-white' : 'bg-red-50/30'}`}>
                  <CardContent className="p-5 flex gap-4">
                    <div className={`shrink-0 size-10 rounded-xl flex items-center justify-center font-bold shadow-sm ${answer.isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {answer.questionNumber}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 mb-2 leading-relaxed">{answer.questionText}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">Your Selection:</span>
                          <span className={`font-bold ${answer.isCorrect ? 'text-green-600' : 'text-red-600'}`}>{answer.userAnswer || "None"}</span>
                        </div>
                        {!answer.isCorrect && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">Correct Answer:</span>
                            <span className="font-bold text-emerald-600">{answer.correctAnswer}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-gray-400 tabular-nums">
                        {answer.marksObtained}/{answer.totalMarks} <span className="text-[10px]">PTS</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
