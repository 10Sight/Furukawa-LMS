import React, { useMemo, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useGetAttemptByIdQuery, useAdminUpdateAttemptMutation } from "@/Redux/AllApi/AttemptedQuizApi";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  IconCircleCheck,
  IconAlertCircle,
  IconDeviceFloppy,
  IconX,
  IconPrinter,
  IconChevronRight,
  IconClock,
  IconCalendar,
  IconEye,
  IconAlertTriangle,
  IconChevronLeft
} from "@tabler/icons-react";
import { getMediaUrl } from "@/utils/mediaUtils";
import { toast } from "sonner";

const AttemptReviewModal = ({ attemptId, isOpen, onClose, canEdit = false }) => {
  const { user: currentUser } = useSelector((state) => state.auth);
  const isEditable = useMemo(() => {
    if (canEdit) return true;
    return !!(
      currentUser?.isAdmin ||
      currentUser?.isTrainer ||
      ['ADMIN', 'SUPERADMIN', 'TRAINER', 'INSTRUCTOR'].includes(currentUser?.role) ||
      (currentUser?.role === 'CUSTOM' && ['admin', 'superadmin', 'trainer', 'instructor'].includes(String(currentUser?.customRole?.targetLayout).toLowerCase()))
    );
  }, [canEdit, currentUser]);

  const { data, isLoading, isError, refetch } = useGetAttemptByIdQuery(attemptId, { skip: !attemptId || !isOpen });
  const attempt = data?.data;

  const [answersOverride, setAnswersOverride] = useState({});
  const [notes, setNotes] = useState("");
  const [updateAttempt, { isLoading: isSaving }] = useAdminUpdateAttemptMutation();

  // Reset override states on change
  useEffect(() => {
    if (isOpen) {
      setAnswersOverride({});
      setNotes("");
    }
  }, [attemptId, isOpen]);

  // Map student answers by questionId for robust lookup
  const answersMap = useMemo(() => {
    const map = new Map();
    if (attempt && Array.isArray(attempt.answer)) {
      attempt.answer.forEach((ans, idx) => {
        if (ans.questionId) {
          map.set(String(ans.questionId), ans);
        }
        // Also map by index for absolute fallback
        map.set(`index-${idx}`, ans);
      });
    }
    return map;
  }, [attempt]);

  // Total possible marks of the test
  const totalPossibleMarks = useMemo(() => {
    const questions = attempt?.quiz?.questions || [];
    return questions.reduce((sum, q) => sum + (q.marks || 1), 0);
  }, [attempt]);

  // Real-time calculation of score based on active overrides
  const currentTotalScore = useMemo(() => {
    const questions = attempt?.quiz?.questions || [];
    return questions.reduce((sum, q, idx) => {
      const qId = String(q._id || q.id);
      let ans = answersMap.get(qId) || answersMap.get(`index-${idx}`) || {};
      const override = answersOverride[qId] || {};

      const marks = override.marksObtained !== undefined && override.marksObtained !== ""
        ? Number(override.marksObtained)
        : (ans.marksObtained ?? 0);
      return sum + marks;
    }, 0);
  }, [attempt, answersMap, answersOverride]);

  const currentScorePercent = totalPossibleMarks > 0 ? Math.round((currentTotalScore / totalPossibleMarks) * 100) : 0;
  const currentPassed = currentScorePercent >= (attempt?.quiz?.passingScore || 70);

  const getMarksOfEachQuestion = () => {
    if (!attempt?.quiz?.questions || attempt.quiz.questions.length === 0) return "1 Mark";
    const marksList = [...new Set(attempt.quiz.questions.map(q => q.marks || 1))];
    if (marksList.length === 1) {
      return `${marksList[0]} Mark${marksList[0] > 1 ? 's' : ''}`;
    }
    return marksList.join(" + ") + " Marks";
  };

  const getCurrentQuarter = () => {
    const dateToUse = attempt?.createdAt || attempt?.completedAt || new Date();
    const month = new Date(dateToUse).getMonth();
    if (month >= 3 && month <= 5) return "QUARTER-1 (APR-JUN)";
    if (month >= 6 && month <= 8) return "QUARTER-2 (JUL-SEP)";
    if (month >= 9 && month <= 11) return "QUARTER-3 (OCT-DEC)";
    return "QUARTER-4 (JAN-MAR)";
  };

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
    try {
      const payload = Object.entries(answersOverride).map(([questionId, override]) => ({
        questionId,
        isCorrect: typeof override.isCorrect === 'boolean' ? override.isCorrect : undefined,
        marksObtained: override.marksObtained !== undefined && override.marksObtained !== "" ? Number(override.marksObtained) : undefined,
        selectedOptions: override.selectedOptions && Array.isArray(override.selectedOptions) ? override.selectedOptions : undefined,
      }));

      await updateAttempt({ attemptId, answersOverride: payload, adjustmentNotes: notes || undefined }).unwrap();

      toast.success("Attempt grades and overrides updated successfully!");
      setAnswersOverride({});
      setNotes("");
      onClose?.();
    } catch (err) {
      console.error("Failed to update grading overrides:", err);
      toast.error(err?.data?.message || "Failed to update grades");
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose?.()}
      className="max-w-[95vw] lg:max-w-[1300px] w-full"
    >
      <DialogContent className="p-4 sm:p-6 border-none">
        <style dangerouslySetInnerHTML={{
          __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .print-worksheet, .print-worksheet * {
              visibility: visible;
            }
            .print-worksheet {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              border: none !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}} />

        <DialogHeader className="no-print pb-3 border-b border-gray-100">
          <DialogTitle className="text-xl font-bold tracking-tight text-gray-900 flex items-center justify-between">
            <span>Test Worksheet Review</span>
            {isEditable && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                Evaluation/Grading Mode
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="size-8 animate-spin border-4 border-primary/20 border-t-primary rounded-full" />
            <span className="text-sm font-semibold text-gray-500">Loading worksheet data...</span>
          </div>
        ) : isError ? (
          <Alert variant="destructive" className="my-6">
            <IconAlertTriangle className="h-4 w-4" />
            <AlertDescription className="font-semibold">Failed to fetch the candidate attempt. Please close and try again.</AlertDescription>
          </Alert>
        ) : attempt ? (
          <div className="space-y-6 mt-2">

            {/* Standardized Graded Test Paper Worksheet Container */}
            <div className="print-worksheet bg-white border-[3px] border-black text-black font-serif shadow-sm overflow-hidden">

              {/* HEADER TABLE */}
              <div className="grid grid-cols-12 border-b-[3px] border-black">
                {/* Logo box */}
                <div className="col-span-3 border-r-[3px] border-black flex flex-col items-center justify-center p-3 bg-white text-center">
                  <span className="text-4xl font-extrabold italic tracking-tight text-black font-sans leading-none">
                    <img src="../../fme_transparent.png" alt="FME Logo" srcset="" width={80} height={80} />
                  </span>
                  <span className="text-[8px] font-black text-black mt-1.5 uppercase tracking-tight leading-none text-center">
                    FURUKAWA MINDA<br />ELECTRIC PVT. LTD.
                  </span>
                </div>

                {/* Title box */}
                <div className="col-span-6 border-r-[3px] border-black flex flex-col items-center justify-center py-4 bg-white text-center">
                  <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight uppercase leading-none">
                    SKILL EVALUATION RESULT SHEET
                  </h1>
                  <h2 className="text-sm sm:text-base font-bold text-black tracking-wide mt-2.5 uppercase leading-none">
                    Graded Sheet for {attempt.quiz?.level || "L-2"}
                  </h2>
                </div>

                {/* Doc control metadata box */}
                <div className="col-span-3 flex flex-col text-[10px] font-bold bg-white">
                  <div className="grid grid-cols-2 border-b border-black flex-1 items-center">
                    <div className="border-r border-black h-full flex items-center px-2">Doc.No.</div>
                    <div className="px-2 text-black">{attempt.quiz?.docNo || "TST-HR-02"}</div>
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

              {/* METADATA SECTION */}
              <div className="grid grid-cols-12 border-b-[3px] border-black text-xs uppercase font-bold">
                {/* Left box */}
                <div className="col-span-7 border-r-[3px] border-black p-4 space-y-3 bg-white">
                  <div className="flex gap-2 items-center">
                    <span className="min-w-[120px] text-black">Process Name :</span>
                    <span className="border-b border-dashed border-black flex-1 pb-0.5 text-black px-1 font-semibold">
                      {attempt.student?.subSectionName || attempt.quiz?.title || "Visual"}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="min-w-[120px] text-black">Candidate Name :</span>
                    <span className="border-b border-dashed border-black flex-1 pb-0.5 text-black px-1 font-semibold font-sans">
                      {attempt.student?.fullName || "—"}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="min-w-[120px] text-black">E.Code :</span>
                    <span className="border-b border-dashed border-black flex-1 pb-0.5 text-black px-1 font-mono">
                      {(attempt.student?.userName || attempt.student?.empId || "—").toUpperCase()}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="min-w-[120px] text-black">Department :</span>
                    <span className="border-b border-dashed border-black flex-1 pb-0.5 text-black px-1 font-semibold font-sans">
                      {attempt.student?.departmentName || "—"}
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
                      {totalPossibleMarks} Marks
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-black">Passing Marks Required :</span>
                    <span className="border-b border-dashed border-black flex-1 pb-0.5 text-center text-black font-semibold font-mono">
                      {Math.round(totalPossibleMarks * (attempt.quiz?.passingScore || 70) / 100)} Marks ({attempt.quiz?.passingScore || 70}%)
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-black">Marks Obtained :</span>
                    <span className="border-b border-dashed border-black flex-1 pb-0.5 text-center text-black font-black text-xs font-sans">
                      {currentTotalScore} Marks ({currentScorePercent}%)
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-black">Result Status :</span>
                    <span className={`border-b border-dashed border-black flex-1 pb-0.5 text-center font-black text-xs uppercase ${currentPassed ? 'text-green-600' : 'text-red-600'
                      }`}>
                      {currentPassed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-black">Test Conducted By :</span>
                    <span className="border-b border-dashed border-black flex-1 pb-0.5 text-center text-black font-semibold font-sans">
                      {attempt.conductedBy || "—"}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-black">Test Date :</span>
                    <span className="border-b border-dashed border-black flex-1 pb-0.5 text-center text-black font-semibold">
                      {attempt.createdAt
                        ? new Date(attempt.createdAt).toLocaleDateString('en-GB').replace(/\//g, '.')
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* PARAMETERS HEADER */}
              <div className="bg-gray-100/80 border-b-[3px] border-black p-3 font-bold uppercase text-lg tracking-wider text-center">
                {attempt.quiz?.title || "THEORETICAL ASSESSMENT SHEET"}
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
                    {attempt.quiz?.questions?.map((question, questionIndex) => {
                      const qId = question._id || question.id ? String(question._id || question.id) : String(questionIndex);
                      const ans = answersMap.get(qId) || answersMap.get(String(questionIndex)) || answersMap.get(`index-${questionIndex}`) || {};

                      const override = answersOverride[qId] || {};
                      const isCorrect = override.isCorrect ?? ans.isCorrect;
                      const marksObtained = override.marksObtained ?? ans.marksObtained;

                      // Get student's answer text (prioritize dynamic overrides over submitted answers)
                      const studentAnswerText = override.selectedOptions?.[0] ?? ans.selectedOptions?.[0] ?? "";

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
                                <span className={`text-xs font-black shrink-0 border px-2 py-1 rounded uppercase tracking-wider leading-none shadow-sm ${isCorrect
                                  ? 'bg-green-100 border-green-300 text-green-800'
                                  : 'bg-red-100 border-red-300 text-red-800'
                                  }`}>
                                  Score: {marksObtained} / {question.marks || 1}
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

                            {/* MCQ option choices */}
                            {(!question.type || question.type === "mcq") && (
                              <div className="flex flex-wrap gap-x-8 gap-y-4 pt-2">
                                {(question.options || []).map((option, optionIndex) => {
                                  const isCorrectOption = option.isCorrect === true ||
                                    option.isCorrect === 1 ||
                                    String(option.isCorrect).toLowerCase() === 'true' ||
                                    (question.correctOption && option.text === question.correctOption);
                                  const isUserSelected = option.text === studentAnswerText;

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
                                      onClick={() => {
                                        if (canEdit) {
                                          handleChange(qId, 'selectedOptions', [option.text]);
                                          handleChange(qId, 'isCorrect', isCorrectOption);
                                          handleChange(qId, 'marksObtained', isCorrectOption ? (question.marks || 1) : 0);
                                        }
                                      }}
                                      className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all ${canEdit ? 'cursor-pointer hover:border-slate-400 hover:shadow-md' : ''
                                        } ${optionBg}`}
                                    >
                                      <span className={`w-7 h-7 rounded-full flex items-center justify-center border-2 font-bold text-sm ${badgeColor}`}>
                                        {optionIndex + 1}
                                      </span>

                                      <div className="flex flex-col">
                                        <span className="text-sm font-bold tracking-tight">{option.text}</span>
                                        {option.textSec && (
                                          <span className="text-xs font-semibold text-gray-500 italic">{option.textSec}</span>
                                        )}
                                      </div>

                                      {indicatorIcon}

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
                                  <span className="text-sm font-black text-gray-800 shrink-0">Candidate Answer:</span>
                                  <div className={`flex-1 border-b-2 py-1 font-bold text-base px-2 uppercase tracking-wide flex items-center justify-between ${isCorrect
                                    ? 'border-green-600 text-green-700 bg-green-50/20'
                                    : 'border-red-600 text-red-700 bg-red-50/20'
                                    }`}>
                                    {canEdit ? (
                                      <Input
                                        type="text"
                                        value={studentAnswerText}
                                        onChange={(e) => {
                                          const newAnsText = e.target.value;
                                          handleChange(qId, 'selectedOptions', [newAnsText]);
                                          const correctText = String(question.correctAnswer || "").trim().toLowerCase();
                                          const isMatch = correctText !== "" && correctText === String(newAnsText).trim().toLowerCase();
                                          handleChange(qId, 'isCorrect', isMatch);
                                          handleChange(qId, 'marksObtained', isMatch ? (question.marks || 1) : 0);
                                        }}
                                        className="flex-1 font-bold text-base uppercase tracking-wide border border-gray-300 bg-white text-black p-1 h-8 rounded"
                                        placeholder="Modify candidate's answer..."
                                      />
                                    ) : (
                                      <span>{studentAnswerText || "NO ANSWER"}</span>
                                    )}
                                    {isCorrect ? (
                                      <IconCircleCheck size={18} className="text-green-600 shrink-0 ml-2" />
                                    ) : (
                                      <IconAlertCircle size={18} className="text-red-600 shrink-0 ml-2" />
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 text-sm text-green-700 font-bold bg-green-50/50 p-2 border border-green-200">
                                  <span>Set Correct Answer:</span>
                                  <span className="uppercase tracking-wide">{question.correctAnswer || "Not set (manual audit)"}</span>
                                  {question.correctAnswerSec && (
                                    <span className="italic text-xs text-green-600">({question.correctAnswerSec})</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Matching Selection View */}
                            {question.type === "matching" && (
                              <div className="pt-2 space-y-4">
                                <div className="bg-gray-50 border border-gray-300 p-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                                  Candidate Matching Selections:
                                </div>

                                {(() => {
                                  let userMatches = {};
                                  try {
                                    if (studentAnswerText) {
                                      userMatches = JSON.parse(studentAnswerText);
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

                                            <div className="w-full md:w-[350px] space-y-2">
                                              <div className={`p-3 rounded-lg border flex items-center justify-between ${isPairCorrect
                                                ? 'bg-green-50 border-green-300 text-green-950 font-bold'
                                                : 'bg-red-50 border-red-300 text-red-950 font-bold'
                                                }`}>
                                                <div className="flex flex-col text-sm flex-1">
                                                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Candidate Match:</span>
                                                  {isEditable ? (
                                                    <select
                                                      value={userSelectedRight}
                                                      onChange={(e) => {
                                                        const newVal = e.target.value;
                                                        const updatedMatches = { ...userMatches, [pair.leftText]: newVal };
                                                        const serialized = JSON.stringify(updatedMatches);

                                                        handleChange(qId, 'selectedOptions', [serialized]);

                                                        // Auto-grade: all pairs must match
                                                        let allCorrect = true;
                                                        (question.pairs || []).forEach(p => {
                                                          const userRight = p.leftText === pair.leftText ? newVal : (updatedMatches[p.leftText] || "");
                                                          const isMatch = String(userRight).trim().toLowerCase() === String(p.rightText).trim().toLowerCase();
                                                          if (!isMatch) allCorrect = false;
                                                        });

                                                        handleChange(qId, 'isCorrect', allCorrect);
                                                        handleChange(qId, 'marksObtained', allCorrect ? (question.marks || 1) : 0);
                                                      }}
                                                      className="w-full h-8 px-2 border border-gray-300 font-bold text-xs focus:outline-none focus:border-blue-600 bg-white text-black mt-1"
                                                    >
                                                      <option value="">-- Select Match --</option>
                                                      {(question.pairs || []).map((p, rIdx) => (
                                                        <option key={rIdx} value={p.rightText}>
                                                          {p.rightText} {p.rightTextSec ? ` (${p.rightTextSec})` : ''}
                                                        </option>
                                                      ))}
                                                    </select>
                                                  ) : (
                                                    <span>{userSelectedRight || "NO SELECTION"}</span>
                                                  )}
                                                </div>
                                                {isPairCorrect ? (
                                                  <IconCircleCheck size={18} className="text-green-600 shrink-0 ml-2" />
                                                ) : (
                                                  <IconAlertCircle size={18} className="text-red-600 shrink-0 ml-2" />
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

                            {/* Interactive Grading Panel */}
                            {isEditable && (
                              <div className="flex flex-wrap items-center gap-4 bg-slate-50 border border-slate-200 p-3 rounded-lg mt-4 shadow-sm no-print">
                                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                  Grade Override Panel:
                                </span>
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={`override-correct-${qId}`}
                                    checked={!!isCorrect}
                                    onCheckedChange={(checked) => {
                                      const isChecked = !!checked;
                                      handleChange(qId, 'isCorrect', isChecked);
                                      handleChange(qId, 'marksObtained', isChecked ? (question.marks || 1) : 0);
                                    }}
                                    className="h-4 w-4 border-slate-400 data-[state=checked]:bg-green-600"
                                  />
                                  <label htmlFor={`override-correct-${qId}`} className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                                    Mark Correct
                                  </label>
                                </div>
                                <div className="flex items-center gap-2 ml-auto sm:ml-0">
                                  <span className="text-[11px] font-semibold text-slate-500">Marks Awarded:</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={question.marks || 1}
                                    step={0.5}
                                    value={marksObtained}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? 0 : Number(e.target.value);
                                      handleChange(qId, 'marksObtained', val);
                                      if (val >= (question.marks || 1)) {
                                        handleChange(qId, 'isCorrect', true);
                                      } else if (val === 0) {
                                        handleChange(qId, 'isCorrect', false);
                                      }
                                    }}
                                    className="h-8 w-20 text-xs font-mono font-bold text-center border-slate-300"
                                  />
                                  <span className="text-xs text-slate-400">/ {question.marks || 1} max</span>
                                </div>
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

            {/* Save Override Panel (Admin Only) */}
            {isEditable && (
              <Card className="no-print border border-yellow-200 bg-yellow-50/30 p-4 space-y-3 rounded-xl">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-700 uppercase tracking-wider">Adjustment Auditing Notes</label>
                  <Input
                    className="bg-white border-gray-300 shadow-sm"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter audit reason (e.g. Graded matching points manually or override short answer)..."
                  />
                </div>
                <div className="flex justify-end gap-3 pt-1">
                  <Button variant="outline" onClick={onClose} className="h-10 border-gray-300">
                    <IconX className="h-4 w-4 mr-2" /> Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving} className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 shadow-md shadow-blue-200">
                    {isSaving ? "Saving overrides..." : (
                      <>
                        <IconDeviceFloppy className="h-4 w-4 mr-2" /> Save Worksheet Changes
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            )}

            {/* Read-Only Close / Print Panel (Instructors / Viewers) */}
            <div className="no-print flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => window.print()} className="h-10 border-gray-300">
                <IconPrinter className="h-4 w-4 mr-2 text-gray-600" /> Print Graded Worksheet
              </Button>
              {!isEditable && (
                <Button variant="default" onClick={onClose} className="h-10 px-6 font-bold">
                  <IconX className="h-4 w-4 mr-2" /> Close Review
                </Button>
              )}
            </div>

          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default AttemptReviewModal;
