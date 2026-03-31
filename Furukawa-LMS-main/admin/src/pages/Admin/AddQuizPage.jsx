import React, { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useCreateQuizMutation } from "@/Redux/AllApi/QuizApi";
import { useGetCourseByIdQuery } from "@/Redux/AllApi/CourseApi";
import { useGetModulesByCourseQuery } from "@/Redux/AllApi/moduleApi";
import { useGetLessonsByModuleQuery } from "@/Redux/AllApi/LessonApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  IconArrowLeft,
  IconPlus,
  IconTrash,
  IconCheck,
  IconX,
  IconLoader,
  IconPhoto,
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useFileUpload from "@/hooks/useFileUpload";

const AddQuizPage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [createQuiz, { isLoading }] = useCreateQuizMutation();
  const { uploadFile, isUploading: isImageUploading } = useFileUpload();

  const basePath = React.useMemo(() => {
    const p = location.pathname || '';
    if (p.startsWith('/superadmin')) return '/superadmin';
    if (p.startsWith('/instructor')) return '/instructor';
    return '/admin';
  }, [location.pathname]);

  // Fetch course to know its slug for navigation after creation
  const { data: courseData, refetch: refetchCourse } = useGetCourseByIdQuery(courseId);

  // Fetch modules for the course
  const {
    data: modulesData,
    isLoading: modulesLoading,
    error: modulesError,
    refetch: refetchModules
  } = useGetModulesByCourseQuery(courseId, {
    skip: !courseId, // Skip if no courseId
  });

  const modules = modulesData?.data || [];

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    scope: "module", // New scope field: course, module, lesson
    quizType: "MODULE", // Added to fix uncontrolled warning
    moduleId: "", // Module selection (for module and lesson scopes)
    lessonId: "", // Lesson selection (only for lesson scope)
    passingScore: 70,
    timeLimit: 30,
    attemptsAllowed: 1,
    skillUpgradation: false,
    issueCertificate: true,
    questions: [
      {
        questionText: "",
        marks: 1,
        image: null,
        options: [
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
        ],
      },
    ],
  });

  // Fetch lessons for the selected module
  const {
    data: lessonsData,
    isLoading: lessonsLoading,
    error: lessonsError,
    refetch: refetchLessons
  } = useGetLessonsByModuleQuery(formData.moduleId, {
    skip: !formData.moduleId || formData.scope !== "lesson", // Skip if no module selected or not lesson scope
  });

  const lessons = lessonsData?.data || [];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleQuestionChange = (index, field, value) => {
    const updatedQuestions = [...formData.questions];
    updatedQuestions[index][field] = value;
    setFormData((prev) => ({
      ...prev,
      questions: updatedQuestions,
    }));
  };

  const handleOptionChange = (questionIndex, optionIndex, field, value) => {
    const updatedQuestions = [...formData.questions];

    if (field === "isCorrect") {
      // If setting this option as correct, make all others incorrect
      updatedQuestions[questionIndex].options.forEach((opt, idx) => {
        opt.isCorrect = idx === optionIndex;
      });
    } else {
      updatedQuestions[questionIndex].options[optionIndex][field] = value;
    }

    setFormData((prev) => ({
      ...prev,
      questions: updatedQuestions,
    }));
  };

  const addQuestion = () => {
    setFormData((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          questionText: "",
          marks: 1,
          image: null,
          options: [
            { text: "", isCorrect: false },
            { text: "", isCorrect: false },
          ],
        },
      ],
    }));
  };

  const removeQuestion = (index) => {
    if (formData.questions.length <= 1) {
      toast.error("Test must have at least one question");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  };

  const addOption = (questionIndex) => {
    const updatedQuestions = [...formData.questions];
    updatedQuestions[questionIndex].options.push({
      text: "",
      isCorrect: false,
    });

    setFormData((prev) => ({
      ...prev,
      questions: updatedQuestions,
    }));
  };

  const removeOption = (questionIndex, optionIndex) => {
    const updatedQuestions = [...formData.questions];

    if (updatedQuestions[questionIndex].options.length <= 2) {
      toast.error("Question must have at least 2 options");
      return;
    }

    updatedQuestions[questionIndex].options = updatedQuestions[questionIndex].options.filter(
      (_, idx) => idx !== optionIndex
    );

    setFormData((prev) => ({
      ...prev,
      questions: updatedQuestions,
    }));
  };

  const handleQuestionImageUpload = async (index, file) => {
    if (!file) return;
    try {
      const loadingToast = toast.loading("Uploading image...");
      const result = await uploadFile(file, { folder: 'quizzes' });

      const updatedQuestions = [...formData.questions];
      updatedQuestions[index].image = {
        url: result.url,
        public_id: result.public_id
      };
      setFormData(prev => ({ ...prev, questions: updatedQuestions }));
      toast.dismiss(loadingToast);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error("Failed to upload image");
    }
  };

  const removeQuestionImage = (index) => {
    const updatedQuestions = [...formData.questions];
    updatedQuestions[index].image = null;
    setFormData(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const validateForm = () => {
    // Validate scope-specific requirements
    if (formData.scope === "module" && !formData.moduleId) {
      toast.error("Please select a module for module quiz");
      return false;
    }

    if (formData.scope === "lesson" && !formData.moduleId) {
      toast.error("Please select a module for lesson quiz");
      return false;
    }

    if (formData.scope === "lesson" && !formData.lessonId) {
      toast.error("Please select a lesson for lesson quiz");
      return false;
    }

    if (!formData.title.trim()) {
      toast.error("Test title is required");
      return false;
    }

    if (formData.questions.length === 0) {
      toast.error("Test must have at least one question");
      return false;
    }

    for (const [qIndex, question] of formData.questions.entries()) {
      if (!question.questionText.trim()) {
        toast.error(`Question ${qIndex + 1} text is required`);
        return false;
      }

      if (question.options.length < 2) {
        toast.error(`Question ${qIndex + 1} must have at least 2 options`);
        return false;
      }

      const hasCorrectAnswer = question.options.some(opt => opt.isCorrect);
      if (!hasCorrectAnswer) {
        toast.error(`Question ${qIndex + 1} must have one correct answer`);
        return false;
      }

      for (const [oIndex, option] of question.options.entries()) {
        if (!option.text.trim()) {
          toast.error(`Option ${oIndex + 1} in Question ${qIndex + 1} is required`);
          return false;
        }
      }
    }

    if (formData.passingScore < 0 || formData.passingScore > 100) {
      toast.error("Passing score must be between 0 and 100");
      return false;
    }

    if (formData.timeLimit && formData.timeLimit < 1) {
      toast.error("Time limit must be at least 1 minute");
      return false;
    }

    // attemptsAllowed === 0 => Unlimited attempts
    if (formData.attemptsAllowed < 0) {
      toast.error("Attempts must be 0 (unlimited) or at least 1");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Ensure we are sending a real MongoDB ObjectId for the course
    const resolvedCourseId = courseData?.data?._id || courseData?.data?.id;

    if (!resolvedCourseId) {
      toast.error("Course data not fully loaded. Please wait.");
      return;
    }

    try {
      const quizData = {
        courseId: resolvedCourseId,
        scope: formData.scope,
        title: formData.title,
        description: formData.description,
        questions: formData.questions,
        passingScore: parseInt(formData.passingScore),
        timeLimit: formData.timeLimit ? parseInt(formData.timeLimit) : undefined,
        attemptsAllowed: parseInt(formData.attemptsAllowed),
        skillUpgradation: formData.skillUpgradation,
        issueCertificate: formData.issueCertificate,
      };

      // Include moduleId for module and lesson scopes
      if ((formData.scope === "module" || formData.scope === "lesson") && formData.moduleId) {
        quizData.moduleId = formData.moduleId;
      }

      // Include lessonId for lesson scope
      if (formData.scope === "lesson" && formData.lessonId) {
        quizData.lessonId = formData.lessonId;
      }

      await createQuiz(quizData).unwrap();

      toast.success("Test created successfully!");

      // Instead of navigating immediately, wait a moment for the backend to process
      setTimeout(() => {
        const target = courseData?.data?.slug || courseId;
        navigate(`${basePath}/courses/${target}`);
      }, 500);

    } catch (error) {
      console.error("Create test error:", error);
      toast.error(error?.data?.message || "Failed to create quiz");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`${basePath}/courses/${courseId}`)}
        >
          <IconArrowLeft className="h-4 w-4 mr-2" />
          Back to Course
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New Quiz</h1>
          <p className="text-muted-foreground">
            Add a test to assess operator understanding
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Enter the basic details for your quiz
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quiz Type Selection */}
            <div className="grid gap-2">
              <Label htmlFor="quizType">Test Type *</Label>
              <Select
                value={formData.quizType || "MODULE"}
                onValueChange={(value) => {
                  setFormData((prev) => ({
                    ...prev,
                    quizType: value,
                    scope: value.toLowerCase(), // sync scope with quizType
                    moduleId: value === "COURSE" ? "" : prev.moduleId // Clear module when switching to course
                  }))
                }}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select test type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MODULE">
                    📝 Module Test - Assess specific module completion
                  </SelectItem>
                  <SelectItem value="COURSE">
                    🏆 Course Final Test - Assess entire course completion
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formData.quizType === "MODULE"
                  ? "Module quizzes unlock after completing all lessons in the selected module"
                  : "Course quizzes unlock only after completing ALL modules in the course"
                }
              </p>
            </div>

            {/* Module Selection - Only show for MODULE type */}
            {formData.quizType === "MODULE" && (
              <div className="grid gap-2">
                <Label htmlFor="moduleId">Module *</Label>
                <Select
                  value={formData.moduleId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, moduleId: value }))
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modulesLoading ? (
                      <SelectItem value="loading" disabled>
                        <div className="flex items-center gap-2">
                          <IconLoader className="h-4 w-4 animate-spin" />
                          Loading modules...
                        </div>
                      </SelectItem>
                    ) : modulesError ? (
                      <SelectItem value="error" disabled>
                        Error loading modules
                      </SelectItem>
                    ) : modules.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No modules available. Create modules first.
                      </SelectItem>
                    ) : (
                      modules.map((module) => (
                        <SelectItem key={String(module.id || module._id)} value={String(module.id || module._id)}>
                          {module.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {/* Show error message if no modules */}
                {!modulesLoading && !modulesError && modules.length === 0 && (
                  <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3">
                    <p className="font-medium">No modules found for this course.</p>
                    <p className="text-xs mt-1">
                      You need to create modules first before adding quizzes.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-1"
                      onClick={() => navigate(`${basePath}/courses/${courseId}`)}
                    >
                      <IconPlus className="h-3 w-3" />
                      Go to Course
                    </Button>
                  </div>
                )}

                {/* Show error message if modules failed to load */}
                {modulesError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="font-medium">Failed to load modules.</p>
                    <p className="text-xs mt-1">
                      {modulesError?.message || "Please try again later."}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => refetchModules()}
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="title">Test Title *</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter test title"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter test description (optional)"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="passingScore">Passing Score (%) *</Label>
                <Input
                  id="passingScore"
                  name="passingScore"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.passingScore}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
                <Input
                  id="timeLimit"
                  name="timeLimit"
                  type="number"
                  min="1"
                  value={formData.timeLimit}
                  onChange={handleInputChange}
                  placeholder="Optional"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="attemptsAllowed">Attempts Allowed *</Label>
                <Select
                  value={(formData.attemptsAllowed ?? 1).toString()}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      attemptsAllowed: parseInt(value),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select attempts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 attempt</SelectItem>
                    <SelectItem value="2">2 attempts</SelectItem>
                    <SelectItem value="3">3 attempts</SelectItem>
                    <SelectItem value="0">Unlimited</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="skillUpgradation">Skill Upgradation *</Label>
                <Select
                  value={formData.skillUpgradation ? "yes" : "no"}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      skillUpgradation: value === "yes",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  If Yes, student level will be upgraded upon passing this quiz.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="issueCertificate">Issue Certificate *</Label>
                <Select
                  value={formData.issueCertificate ? "yes" : "no"}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      issueCertificate: value === "yes",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  If Yes, a certificate will be issued upon passing this test (if skill upgradation applies).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Questions</CardTitle>
                <CardDescription>
                  Add questions for your quiz. Each question must have at least 2 options and one correct answer.
                </CardDescription>
              </div>
              <Button
                type="button"
                onClick={addQuestion}
                variant="outline"
                className="gap-2"
              >
                <IconPlus className="h-4 w-4" />
                Add Question
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {formData.questions.map((question, qIndex) => (
              <div key={`q-${qIndex}`} className="border rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold">Question {qIndex + 1}</h3>
                  <Button
                    type="button"
                    onClick={() => removeQuestion(qIndex)}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                  >
                    <IconTrash className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={`question-${qIndex}`}>Question Text *</Label>
                  <Input
                    id={`question-${qIndex}`}
                    value={question.questionText}
                    onChange={(e) =>
                      handleQuestionChange(qIndex, "questionText", e.target.value)
                    }
                    placeholder="Enter your question"
                    required
                  />

                  {/* Image Upload */}
                  <div className="mt-2">
                    {question.image ? (
                      <div className="relative w-full max-w-xs border rounded p-2">
                        <img src={question.image.url} alt="Question" className="w-full h-auto rounded" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6 rounded-full"
                          onClick={() => removeQuestionImage(qIndex)}
                        >
                          <IconX className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          id={`question-image-${qIndex}`}
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleQuestionImageUpload(qIndex, e.target.files[0])}
                          disabled={isImageUploading}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isImageUploading}
                          onClick={() => document.getElementById(`question-image-${qIndex}`).click()}
                        >
                          <IconPhoto className="h-4 w-4 mr-2" />
                          {isImageUploading ? "Uploading..." : "Add Image"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={`marks-${qIndex}`}>Marks</Label>
                  <Input
                    id={`marks-${qIndex}`}
                    type="number"
                    min="1"
                    value={question.marks}
                    onChange={(e) =>
                      handleQuestionChange(qIndex, "marks", parseInt(e.target.value) || 1)
                    }
                    placeholder="1"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label>Options *</Label>
                    <Button
                      type="button"
                      onClick={() => addOption(qIndex)}
                      variant="outline"
                      size="sm"
                      className="gap-1"
                    >
                      <IconPlus className="h-3 w-3" />
                      Add Option
                    </Button>
                  </div>

                  {question.options.map((option, oIndex) => (
                    <div key={`q-${qIndex}-o-${oIndex}`} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleOptionChange(qIndex, oIndex, "isCorrect", true)
                        }
                        className={`p-2 rounded-full border ${option.isCorrect
                          ? "bg-green-100 border-green-300 text-green-700"
                          : "bg-gray-100 border-gray-300 text-gray-500"
                          }`}
                        title={option.isCorrect ? "Correct answer" : "Mark as correct"}
                      >
                        {option.isCorrect ? (
                          <IconCheck className="h-4 w-4" />
                        ) : (
                          <IconX className="h-4 w-4" />
                        )}
                      </button>

                      <Input
                        value={option.text}
                        onChange={(e) =>
                          handleOptionChange(qIndex, oIndex, "text", e.target.value)
                        }
                        placeholder={`Option ${oIndex + 1}`}
                        className="flex-1"
                        required
                      />

                      <Button
                        type="button"
                        onClick={() => removeOption(qIndex, oIndex)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        disabled={question.options.length <= 2}
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {question.options.filter(opt => opt.isCorrect).length === 0 && (
                  <p className="text-sm text-red-600">
                    This question needs a correct answer
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`${basePath}/courses/${courseId}`)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || modulesLoading} className="gap-2">
            {isLoading && <IconLoader className="h-4 w-4 animate-spin" />}
            {isLoading ? "Creating..." : "Create Quiz"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddQuizPage;