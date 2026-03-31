import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useGetQuizByIdQuery, useUpdateQuizMutation } from "@/Redux/AllApi/QuizApi";
import { toast } from "sonner";
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
import { IconArrowLeft, IconPlus, IconTrash, IconLoader, IconCheck, IconX, IconPhoto } from "@tabler/icons-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useFileUpload from "@/hooks/useFileUpload";
import { getMediaUrl } from "@/utils/mediaUtils";

const EditQuizPage = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { data, isFetching, isError } = useGetQuizByIdQuery(quizId);
  const [updateQuiz, { isLoading: isSaving }] = useUpdateQuizMutation();
  const { uploadFile, isUploading: isImageUploading } = useFileUpload();

  const basePath = React.useMemo(() => {
    const p = location.pathname || '';
    if (p.startsWith('/superadmin')) return '/superadmin';
    if (p.startsWith('/instructor')) return '/instructor';
    return '/admin';
  }, [location.pathname]);

  const quiz = data?.data;
  const courseHandle = quiz?.course?.slug || quiz?.course?._id || quiz?.courseId || "";

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    passingScore: 70,
    skillUpgradation: false,
    issueCertificate: true,
    questions: [
      {
        questionText: "",
        marks: 1,
        options: [
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
        ],
      },
    ],
  });

  useEffect(() => {
    if (quiz) {
      setFormData({
        title: quiz.title || "",
        description: quiz.description || "",
        passingScore: quiz.passingScore ?? 70,
        skillUpgradation: quiz.skillUpgradation || false,
        issueCertificate: quiz.issueCertificate !== undefined ? !!quiz.issueCertificate : true,
        questions: Array.isArray(quiz.questions) && quiz.questions.length > 0
          ? quiz.questions.map((q) => ({
            questionText: q.questionText || q.text || "",
            marks: q.marks ?? 1,
            image: q.image || null,
            options: (q.options || []).map((o) => ({
              text: o.text || "",
              isCorrect: !!o.isCorrect,
            })),
          }))
          : [
            {
              questionText: "",
              marks: 1,
              options: [
                { text: "", isCorrect: false },
                { text: "", isCorrect: false },
              ],
            },
          ],
      });
    }
  }, [quiz]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleQuestionChange = (index, field, value) => {
    const updated = [...formData.questions];
    updated[index][field] = value;
    setFormData((prev) => ({ ...prev, questions: updated }));
  };

  const handleOptionChange = (qIndex, oIndex, field, value) => {
    const updated = [...formData.questions];
    if (field === "isCorrect") {
      updated[qIndex].options = updated[qIndex].options.map((opt, idx) => ({
        ...opt,
        isCorrect: idx === oIndex,
      }));
    } else {
      updated[qIndex].options[oIndex][field] = value;
    }
    setFormData((prev) => ({ ...prev, questions: updated }));
  };

  const addQuestion = () => {
    setFormData((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        { questionText: "", marks: 1, options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] },
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

  const addOption = (qIndex) => {
    const updated = [...formData.questions];
    updated[qIndex].options.push({ text: "", isCorrect: false });
    setFormData((prev) => ({ ...prev, questions: updated }));
  };

  const removeOption = (qIndex, oIndex) => {
    const updated = [...formData.questions];
    if (updated[qIndex].options.length <= 2) {
      toast.error("Question must have at least 2 options");
      return;
    }
    updated[qIndex].options = updated[qIndex].options.filter((_, idx) => idx !== oIndex);
    setFormData((prev) => ({ ...prev, questions: updated }));
  };

  const handleQuestionImageUpload = async (index, file) => {
    if (!file) return;
    try {
      const loadingToast = toast.loading("Uploading image...");
      const result = await uploadFile(file, { folder: 'quizzes' });

      const updated = [...formData.questions];
      updated[index].image = {
        url: result.url,
        public_id: result.public_id
      };
      setFormData(prev => ({ ...prev, questions: updated }));
      toast.dismiss(loadingToast);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error("Failed to upload image");
    }
  };

  const removeQuestionImage = (index) => {
    const updated = [...formData.questions];
    updated[index].image = null;
    setFormData(prev => ({ ...prev, questions: updated }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      toast.error("Test title is required");
      return false;
    }
    if (formData.questions.length === 0) return false;
    for (const [i, q] of formData.questions.entries()) {
      if (!q.questionText.trim()) {
        toast.error(`Question ${i + 1} text is required`);
        return false;
      }
      if (q.options.length < 2) {
        toast.error(`Question ${i + 1} must have at least 2 options`);
        return false;
      }
      if (!q.options.some((o) => o.isCorrect)) {
        toast.error(`Question ${i + 1} must have one correct answer`);
        return false;
      }
      for (const [j, o] of q.options.entries()) {
        if (!o.text.trim()) {
          toast.error(`Option ${j + 1} in Question ${i + 1} is required`);
          return false;
        }
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!quiz) return;
    if (!validateForm()) return;

    try {
      await updateQuiz({
        id: quiz?._id,
        title: formData.title,
        description: formData.description,
        questions: formData.questions,
        passingScore: parseInt(formData.passingScore),
        // timeLimit and attemptsAllowed are not in state currently but should be if we want full editing
        skillUpgradation: formData.skillUpgradation,
        issueCertificate: formData.issueCertificate,
      }).unwrap();

      toast.success("Test updated successfully!");
      if (courseHandle) navigate(`${basePath}/courses/${courseHandle}`);
    } catch (error) {
      console.error("Update test error:", error);
      toast.error(error?.data?.message || "Failed to update test");
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center h-40">
        <IconLoader className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (isError || !quiz) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">Failed to load quiz.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(courseHandle ? `${basePath}/courses/${courseHandle}` : -1)}>
          <IconArrowLeft className="h-4 w-4 mr-2" />
          Back to Course
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Test</h1>
          <p className="text-muted-foreground">Update test details and questions</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Update the test title and description</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Test Title *</Label>
              <Input id="title" name="title" value={formData.title} onChange={handleInputChange} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} rows={3} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="skillUpgradation">Skill Upgradation</Label>
              <Select
                key={formData.skillUpgradation ? "yes" : "no"} // Force re-mount on change
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
              <Label htmlFor="issueCertificate">Issue Certificate</Label>
              <Select
                key={formData.issueCertificate ? "yes" : "no"}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Questions</CardTitle>
                <CardDescription>Edit questions and options</CardDescription>
              </div>
              <Button type="button" onClick={addQuestion} variant="outline" className="gap-2">
                <IconPlus className="h-4 w-4" />
                Add Question
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {formData.questions.map((q, qi) => (
              <div key={`q-${qi}`} className="border rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold">Question {qi + 1}</h3>
                  <Button type="button" onClick={() => removeQuestion(qi)} variant="ghost" size="sm" className="text-red-600 hover:text-red-800 hover:bg-red-50">
                    <IconTrash className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={`question-${qi}`}>Question Text *</Label>
                  <Input id={`question-${qi}`} value={q.questionText} onChange={(e) => handleQuestionChange(qi, "questionText", e.target.value)} required />

                  {/* Image Upload */}
                  <div className="mt-2">
                    {q.image ? (
                      <div className="relative w-full max-w-xs border rounded p-2">
                        <img src={getMediaUrl(q.image.url)} alt="Question" className="w-full h-auto rounded" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6 rounded-full"
                          onClick={() => removeQuestionImage(qi)}
                        >
                          <IconX className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          id={`question-image-${qi}`}
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleQuestionImageUpload(qi, e.target.files[0])}
                          disabled={isImageUploading}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isImageUploading}
                          onClick={() => document.getElementById(`question-image-${qi}`).click()}
                        >
                          <IconPhoto className="h-4 w-4 mr-2" />
                          {isImageUploading ? "Uploading..." : "Add Image"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={`marks-${qi}`}>Marks</Label>
                  <Input id={`marks-${qi}`} type="number" min="1" value={q.marks} onChange={(e) => handleQuestionChange(qi, "marks", parseInt(e.target.value) || 1)} />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label>Options *</Label>
                    <Button type="button" onClick={() => addOption(qi)} variant="outline" size="sm" className="gap-1">
                      <IconPlus className="h-3 w-3" />
                      Add Option
                    </Button>
                  </div>

                  {q.options.map((o, oi) => (
                    <div key={`q-${qi}-o-${oi}`} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOptionChange(qi, oi, "isCorrect", true)}
                        className={`p-2 rounded-full border ${o.isCorrect ? "bg-green-100 border-green-300 text-green-700" : "bg-gray-100 border-gray-300 text-gray-500"}`}
                        title={o.isCorrect ? "Correct answer" : "Mark as correct"}
                      >
                        {o.isCorrect ? <IconCheck className="h-4 w-4" /> : <IconX className="h-4 w-4" />}
                      </button>

                      <Input value={o.text} onChange={(e) => handleOptionChange(qi, oi, "text", e.target.value)} placeholder={`Option ${oi + 1}`} className="flex-1" required />

                      <Button type="button" onClick={() => removeOption(qi, oi)} variant="ghost" size="sm" className="text-red-600 hover:text-red-800 hover:bg-red-50" disabled={q.options.length <= 2}>
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(courseHandle ? `${basePath}/courses/${courseHandle}` : -1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving} className="gap-2">
            {isSaving && <IconLoader className="h-4 w-4 animate-spin" />}
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div >
  );
};

export default EditQuizPage;
