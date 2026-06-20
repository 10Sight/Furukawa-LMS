import React, { useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useCreateQuizMutation } from "@/Redux/AllApi/QuizApi";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetLinesQuery } from "@/Redux/AllApi/LineApi";
import { useGetSubSectionsQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetActiveConfigQuery } from "@/Redux/AllApi/CourseLevelConfigApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { getMediaUrl } from "@/utils/mediaUtils";

const AddTestPaper = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [createQuiz, { isLoading }] = useCreateQuizMutation();
  const { uploadFile, isUploading: isImageUploading } = useFileUpload();

  const { user: currentUser } = useSelector((state) => state.auth);

  const hasButtonPermission = React.useCallback((permissionKey) => {
    if (!currentUser) return false;
    if (currentUser.role === "SUPERADMIN" || currentUser.isAdmin) return true;
    if (currentUser.role === "INSTRUCTOR" || currentUser.isTrainer) return true;
    
    const userPermissions = currentUser.customRole?.permissions || [];
    return userPermissions.includes(permissionKey);
  }, [currentUser]);

  const basePath = React.useMemo(() => {
    const p = location.pathname || '';
    if (p.startsWith('/superadmin')) return '/superadmin';
    if (p.startsWith('/instructor')) return '/instructor';
    if (p.startsWith('/portal')) return '/portal';
    return '/admin';
  }, [location.pathname]);

  const isAuthorizedToAccessAll = React.useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === "SUPERADMIN" || currentUser.role === "ADMIN") return true;
    const userPermissions = currentUser.customRole?.permissions || [];
    return userPermissions.includes("test_paper:access_all");
  }, [currentUser]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    scope: "standalone", 
    passingScore: 70,
    timeLimit: 30,
    attemptsAllowed: 0,
    skillUpgradation: false,
    issueCertificate: true,
    departmentId: [],
    sectionId: [],
    lineId: [],
    subSectionId: [],
    level: "",
    isDojo: false,

    isTheoretical: false,
    isMultiSkilling: false,
    conductedBy: "",
    paperTitle: "",
    paperSubTitle: "",
    questions: [
      {
        questionText: "",
        type: "mcq",
        marks: 1,
        image: null,
        options: [
          { text: "", isCorrect: false, image: null },
          { text: "", isCorrect: false, image: null },
          { text: "", isCorrect: false, image: null },
          { text: "", isCorrect: false, image: null },
        ],
        correctAnswer: "",
        pairs: [],
      },
    ],
  });

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const dept = params.get("departmentId");
    const sect = params.get("sectionId");
    const line = params.get("lineId");
    const subSec = params.get("subSectionId");
    const lvl = params.get("level");

    if (dept || sect || line || subSec || lvl) {
      setFormData(prev => ({
        ...prev,
        departmentId: dept ? [dept] : prev.departmentId,
        sectionId: sect ? [sect] : prev.sectionId,
        lineId: line ? [line] : prev.lineId,
        subSectionId: subSec ? [subSec] : prev.subSectionId,
        level: lvl ? lvl : prev.level,
      }));
    }
  }, [location.search]);

  React.useEffect(() => {
    if (!isAuthorizedToAccessAll && currentUser) {
      setFormData(prev => ({
        ...prev,
        departmentId: currentUser.departmentId ? [String(currentUser.departmentId)] : prev.departmentId,
        sectionId: currentUser.sectionId ? [String(currentUser.sectionId)] : prev.sectionId,
      }));
    }
  }, [currentUser, isAuthorizedToAccessAll]);

  // Fetch all departments and sections to show options
  const { data: allDepartmentsData } = useGetAllDepartmentsQuery({ limit: 1000 });
  
  // Create comma separated string for section query
  const selectedDeptIds = formData.departmentId.join(',');
  const { data: allSectionsData } = useGetSectionsByDepartmentQuery(selectedDeptIds, {
    skip: !selectedDeptIds
  });

  const { data: allLinesData } = useGetLinesQuery();
  const { data: allSubSectionsData } = useGetSubSectionsQuery({ limit: 1000 });
  const { data: activeConfigData } = useGetActiveConfigQuery();

  const activeLevels = React.useMemo(() => {
    const levels = activeConfigData?.data?.levels || [];
    if (formData.level && formData.level !== "L0 (Dojo User)" && !levels.some(lvl => lvl.name === formData.level)) {
      return [...levels, { name: formData.level, description: "" }];
    }
    return levels;
  }, [activeConfigData, formData.level]);

  const departmentOptions = React.useMemo(() => {
    const all = (allDepartmentsData?.data?.departments || []).map(d => ({ value: String(d.id), label: d.name }));
    if (!isAuthorizedToAccessAll && currentUser?.departmentId) {
      return all.filter(opt => opt.value === String(currentUser.departmentId));
    }
    return all;
  }, [allDepartmentsData, isAuthorizedToAccessAll, currentUser]);

  const sectionOptions = React.useMemo(() => {
    const all = (allSectionsData?.data || []).map(s => ({ value: String(s.id), label: s.name }));
    if (!isAuthorizedToAccessAll && currentUser?.sectionId) {
      return all.filter(opt => opt.value === String(currentUser.sectionId));
    }
    return all;
  }, [allSectionsData, isAuthorizedToAccessAll, currentUser]);

  const lineOptions = React.useMemo(() => {
    const allLines = allLinesData?.data || [];
    let lines = [];
    if (formData.sectionId.length > 0) {
      lines = allLines.filter(l => formData.sectionId.includes(String(l.sectionId)));
    }
    return lines.map(l => ({ value: String(l.id), label: l.name }));
  }, [allLinesData, formData.sectionId]);

  const subSectionOptions = React.useMemo(() => {
    const allSubSections = Array.isArray(allSubSectionsData?.data) 
      ? allSubSectionsData.data 
      : (allSubSectionsData?.data?.subSections || []);
      
    let subSecs = [];
    if (formData.lineId.length > 0) {
      subSecs = allSubSections.filter(s => formData.lineId.includes(String(s.lineId)));
    }
    return subSecs.map(s => ({ value: String(s.id), label: s.name, level: s.minimumRequiredLevel }));
  }, [allSubSectionsData, formData.lineId]);

  const toggleItem = (field, id) => {
    setFormData(prev => {
      const current = prev[field] || [];
      const updated = current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id];
        
      let nextState = { ...prev, [field]: updated };
      
      // Auto-set level if subSectionId is updated
      if (field === 'subSectionId') {
          if (updated.length > 0) {
              const lastSelected = updated[updated.length - 1];
              const subSec = subSectionOptions.find(s => s.value === lastSelected);
              if (subSec && subSec.level) {
                  nextState.level = subSec.level;
              }
          } else {
              nextState.level = "";
          }
      }
      return nextState;
    });
  };

  const removeItem = (field, id) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] || []).filter(item => item !== id)
    }));
  };

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

  const handleQuestionTypeChange = (index, newType) => {
    const updatedQuestions = [...formData.questions];
    updatedQuestions[index].type = newType;
    if (newType === "mcq") {
      updatedQuestions[index].options = [
        { text: "", isCorrect: false, image: null },
        { text: "", isCorrect: false, image: null },
        { text: "", isCorrect: false, image: null },
        { text: "", isCorrect: false, image: null },
      ];
      updatedQuestions[index].pairs = [];
      updatedQuestions[index].correctAnswer = "";
    } else if (newType === "shortAnswer") {
      updatedQuestions[index].options = [];
      updatedQuestions[index].pairs = [];
      updatedQuestions[index].correctAnswer = "";
    } else if (newType === "matching") {
      updatedQuestions[index].options = [];
      updatedQuestions[index].pairs = [
        { leftText: "", leftImage: null, rightText: "", rightImage: null },
        { leftText: "", leftImage: null, rightText: "", rightImage: null },
        { leftText: "", leftImage: null, rightText: "", rightImage: null },
        { leftText: "", leftImage: null, rightText: "", rightImage: null }
      ];
      updatedQuestions[index].correctAnswer = "";
    }
    setFormData(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const addQuestion = (type = "mcq") => {
    setFormData((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          questionText: "",
          type: type,
          marks: 1,
          image: null,
          options: type === "mcq" ? [
            { text: "", isCorrect: false, image: null },
            { text: "", isCorrect: false, image: null },
            { text: "", isCorrect: false, image: null },
            { text: "", isCorrect: false, image: null },
          ] : [],
          correctAnswer: "",
          pairs: type === "matching" ? [
            { leftText: "", leftImage: null, rightText: "", rightImage: null },
            { leftText: "", leftImage: null, rightText: "", rightImage: null },
            { leftText: "", leftImage: null, rightText: "", rightImage: null },
            { leftText: "", leftImage: null, rightText: "", rightImage: null }
          ] : [],
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
      image: null
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

  const handleOptionImageUpload = async (qIndex, oIndex, file) => {
    if (!file) return;
    try {
      const loadingToast = toast.loading("Uploading option image...");
      const result = await uploadFile(file, { folder: 'quizzes' });

      const updatedQuestions = [...formData.questions];
      updatedQuestions[qIndex].options[oIndex].image = {
        url: result.url,
        public_id: result.public_id
      };
      setFormData(prev => ({ ...prev, questions: updatedQuestions }));
      toast.dismiss(loadingToast);
      toast.success("Option image uploaded");
    } catch (err) {
      toast.error("Failed to upload image");
    }
  };

  const removeOptionImage = (qIndex, oIndex) => {
    const updatedQuestions = [...formData.questions];
    updatedQuestions[qIndex].options[oIndex].image = null;
    setFormData(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const handlePairImageUpload = async (qIndex, pIndex, side, file) => {
    if (!file) return;
    try {
      const loadingToast = toast.loading(`Uploading pair ${side} image...`);
      const result = await uploadFile(file, { folder: 'quizzes' });

      const updatedQuestions = [...formData.questions];
      if (!updatedQuestions[qIndex].pairs[pIndex]) return;
      updatedQuestions[qIndex].pairs[pIndex][side === 'left' ? 'leftImage' : 'rightImage'] = {
        url: result.url,
        public_id: result.public_id
      };
      setFormData(prev => ({ ...prev, questions: updatedQuestions }));
      toast.dismiss(loadingToast);
      toast.success("Pair image uploaded");
    } catch (err) {
      toast.error("Failed to upload image");
    }
  };

  const removePairImage = (qIndex, pIndex, side) => {
    const updatedQuestions = [...formData.questions];
    if (!updatedQuestions[qIndex].pairs[pIndex]) return;
    updatedQuestions[qIndex].pairs[pIndex][side === 'left' ? 'leftImage' : 'rightImage'] = null;
    setFormData(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const handlePairTextChange = (qIndex, pIndex, side, val, isSec = false) => {
    const updatedQuestions = [...formData.questions];
    if (!updatedQuestions[qIndex].pairs[pIndex]) return;
    const field = side === 'left' ? (isSec ? 'leftTextSec' : 'leftText') : (isSec ? 'rightTextSec' : 'rightText');
    updatedQuestions[qIndex].pairs[pIndex][field] = val;
    setFormData(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const addPair = (qIndex) => {
    const updatedQuestions = [...formData.questions];
    if (!updatedQuestions[qIndex].pairs) updatedQuestions[qIndex].pairs = [];
    updatedQuestions[qIndex].pairs.push({
      leftText: "",
      leftImage: null,
      rightText: "",
      rightImage: null
    });
    setFormData(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const removePair = (qIndex, pIndex) => {
    const updatedQuestions = [...formData.questions];
    if (updatedQuestions[qIndex].pairs.length <= 1) {
      toast.error("Matching question must have at least one pair");
      return;
    }
    updatedQuestions[qIndex].pairs = updatedQuestions[qIndex].pairs.filter((_, idx) => idx !== pIndex);
    setFormData(prev => ({ ...prev, questions: updatedQuestions }));
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

      const qType = question.type || "mcq";

      if (qType === "mcq") {
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
      } else if (qType === "shortAnswer") {
        // Correct answer is optional; if left blank, user will audit manually later.
      } else if (qType === "matching") {
        if (!question.pairs || question.pairs.length < 1) {
          toast.error(`Question ${qIndex + 1} must have at least one matching pair`);
          return false;
        }
        for (const [pIndex, pair] of question.pairs.entries()) {
          if (!pair.leftText.trim() && !pair.leftImage) {
            toast.error(`Left side of Pair ${pIndex + 1} in Question ${qIndex + 1} needs text or image`);
            return false;
          }
          if (!pair.rightText.trim() && !pair.rightImage) {
            toast.error(`Right side of Pair ${pIndex + 1} in Question ${qIndex + 1} needs text or image`);
            return false;
          }
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

    try {
      const quizData = {
        scope: "standalone",
        title: formData.title,
        description: formData.description,
        questions: formData.questions,
        passingScore: parseInt(formData.passingScore),
        timeLimit: formData.timeLimit ? parseInt(formData.timeLimit) : undefined,
        attemptsAllowed: parseInt(formData.attemptsAllowed),
        skillUpgradation: formData.skillUpgradation,
        issueCertificate: formData.issueCertificate,
        departmentId: formData.departmentId,
        sectionId: formData.sectionId,
        lineId: formData.lineId,
        subSectionId: formData.subSectionId,
        level: formData.level,
        isDojo: formData.isDojo,

        isTheoretical: formData.isTheoretical,
        isMultiSkilling: formData.isMultiSkilling,
        conductedBy: formData.conductedBy || "",
        paperTitle: formData.paperTitle || undefined,
        paperSubTitle: formData.paperSubTitle || undefined,
      };

      await createQuiz(quizData).unwrap();

      toast.success("Test created successfully!");

      setTimeout(() => {
        navigate(`${basePath}/test-paper`);
      }, 500);

    } catch (error) {
      console.error("Create test error:", error);
      toast.error(error?.data?.message || "Failed to create test paper");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`${basePath}/test-paper`)}
        >
          <IconArrowLeft className="h-4 w-4 mr-2" />
          Back to Tests
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Standalone Test</h1>
          <p className="text-muted-foreground">
            Add a test paper that is not linked to a specific course
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Enter the basic details for your test paper
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="paperTitle">Paper Header Title</Label>
                <Input
                  id="paperTitle"
                  name="paperTitle"
                  value={formData.paperTitle}
                  onChange={handleInputChange}
                  placeholder="Default: SKILL EVALUATION TEST PAPER"
                />
                <p className="text-[11px] text-muted-foreground">Printed at the top of the test paper. Leave blank to use the default.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="paperSubTitle">Paper Sub-Title</Label>
                <Input
                  id="paperSubTitle"
                  name="paperSubTitle"
                  value={formData.paperSubTitle}
                  onChange={handleInputChange}
                  placeholder={`Default: New Manpower for ${formData.level || "L-2"}`}
                />
                <p className="text-[11px] text-muted-foreground">Shown below the title. Leave blank to use the default.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label>Departments *</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.departmentId.map(id => {
                    const dept = departmentOptions.find(opt => opt.value === id);
                    return (
                      <Badge key={id} variant="secondary" className="gap-1 pr-1 py-1">
                        {dept?.label || id}
                        {(!isAuthorizedToAccessAll && currentUser?.departmentId && String(currentUser.departmentId) === id) ? null : (
                          <button
                            type="button"
                            onClick={() => removeItem('departmentId', id)}
                            className="hover:bg-muted rounded-full p-0.5"
                          >
                            <IconX className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    );
                  })}
                </div>
                <Select
                  onValueChange={(val) => toggleItem('departmentId', val)}
                  disabled={!isAuthorizedToAccessAll && !!currentUser?.departmentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.departmentId.length > 0 
                      ? `${formData.departmentId.length} departments selected` 
                      : "Select departments"} />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentOptions.length === 0 ? (
                      <SelectItem value="none" disabled>No departments available</SelectItem>
                    ) : (
                      departmentOptions.map(opt => (
                        <SelectItem 
                          key={opt.value} 
                          value={opt.value}
                          disabled={formData.departmentId.includes(opt.value)}
                        >
                          {opt.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Select which departments this test belongs to (Optional)
                </p>
              </div>

              <div className="space-y-3">
                <Label>Sections (Optional)</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.sectionId.map(id => {
                    const sec = sectionOptions.find(opt => opt.value === id);
                    return (
                      <Badge key={id} variant="outline" className="gap-1 pr-1 py-1 bg-blue-50/50">
                        {sec?.label || id}
                        {(!isAuthorizedToAccessAll && currentUser?.sectionId && String(currentUser.sectionId) === id) ? null : (
                          <button
                            type="button"
                            onClick={() => removeItem('sectionId', id)}
                            className="hover:bg-blue-100 rounded-full p-0.5"
                          >
                            <IconX className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    );
                  })}
                </div>
                <Select
                  onValueChange={(val) => toggleItem('sectionId', val)}
                  disabled={(!isAuthorizedToAccessAll && !!currentUser?.sectionId) || formData.departmentId.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.sectionId.length > 0 
                      ? `${formData.sectionId.length} sections selected` 
                      : (formData.departmentId.length === 0 ? "Select departments first" : "Select sections")} />
                  </SelectTrigger>
                  <SelectContent>
                    {sectionOptions.length === 0 ? (
                      <SelectItem value="none" disabled>No sections available for selected departments</SelectItem>
                    ) : (
                      sectionOptions.map(opt => (
                        <SelectItem 
                          key={opt.value} 
                          value={opt.value}
                          disabled={formData.sectionId.includes(opt.value)}
                        >
                          {opt.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Lines (Optional)</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.lineId.map(id => {
                    const lineOpt = lineOptions.find(opt => opt.value === id);
                    return (
                      <Badge key={id} variant="outline" className="gap-1 pr-1 py-1 bg-green-50/50">
                        {lineOpt?.label || id}
                        <button
                          type="button"
                          onClick={() => removeItem('lineId', id)}
                          className="hover:bg-green-100 rounded-full p-0.5"
                        >
                          <IconX className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
                <Select
                  onValueChange={(val) => toggleItem('lineId', val)}
                  disabled={formData.sectionId.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.lineId.length > 0 
                      ? `${formData.lineId.length} lines selected` 
                      : (formData.sectionId.length === 0 ? "Select sections first" : "Select lines")} />
                  </SelectTrigger>
                  <SelectContent>
                    {lineOptions.length === 0 ? (
                      <SelectItem value="none" disabled>No lines available for selected sections</SelectItem>
                    ) : (
                      lineOptions.map(opt => (
                        <SelectItem 
                          key={opt.value} 
                          value={opt.value}
                          disabled={formData.lineId.includes(opt.value)}
                        >
                          {opt.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Sub-Sections (Optional)</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.subSectionId.map(id => {
                    const subSecOpt = subSectionOptions.find(opt => opt.value === id);
                    return (
                      <Badge key={id} variant="outline" className="gap-1 pr-1 py-1 bg-purple-50/50">
                        {subSecOpt?.label || id}
                        <button
                          type="button"
                          onClick={() => removeItem('subSectionId', id)}
                          className="hover:bg-purple-100 rounded-full p-0.5"
                        >
                          <IconX className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
                <Select
                  onValueChange={(val) => toggleItem('subSectionId', val)}
                  disabled={formData.lineId.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.subSectionId.length > 0 
                      ? `${formData.subSectionId.length} sub-sections selected` 
                      : (formData.lineId.length === 0 ? "Select lines first" : "Select sub-sections")} />
                  </SelectTrigger>
                  <SelectContent>
                    {subSectionOptions.length === 0 ? (
                      <SelectItem value="none" disabled>No sub-sections available for selected lines</SelectItem>
                    ) : (
                      subSectionOptions.map(opt => (
                        <SelectItem 
                          key={opt.value} 
                          value={opt.value}
                          disabled={formData.subSectionId.includes(opt.value)}
                        >
                          {opt.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="level">Level</Label>
                <Select
                  key={`${activeLevels.length}-${formData.level}`}
                  value={formData.level || "none"}
                  onValueChange={(val) => {
                    const nextLevel = val === "none" ? "" : val;
                    setFormData(prev => ({ 
                      ...prev, 
                      level: nextLevel,
                      ...(nextLevel === "L0 (Dojo User)" ? { isDojo: true } : {})
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select Level</SelectItem>
                    <SelectItem value="L0 (Dojo User)">L0 (Dojo User)</SelectItem>
                    {activeLevels.map(lvl => (
                      <SelectItem key={lvl.name} value={lvl.name}>
                        {lvl.name} {lvl.description ? `- ${lvl.description}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                  value={(formData.attemptsAllowed ?? 0).toString()}
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

              {hasButtonPermission("test_paper:skill_upgradation") && (
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
                    If Yes, student level will be upgraded upon passing this test.
                  </p>
                </div>
              )}

              {hasButtonPermission("test_paper:issue_certificate") && (
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
                </div>
              )}

              {hasButtonPermission("test_paper:is_dojo") && (
                <div className="grid gap-2">
                  <Label htmlFor="isDojo">Is DOJO Quiz? *</Label>
                  <Select
                    value={formData.isDojo ? "yes" : "no"}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        isDojo: value === "yes",
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
                </div>
              )}


              {hasButtonPermission("test_paper:is_theoretical") && (
                <div className="grid gap-2">
                  <Label htmlFor="isTheoretical">Is Theoretical Quiz? *</Label>
                  <Select
                    value={formData.isTheoretical ? "yes" : "no"}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        isTheoretical: value === "yes",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No (Practical)</SelectItem>
                      <SelectItem value="yes">Yes (Theoretical)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {hasButtonPermission("test_paper:is_multi_skilling") && (
                <div className="grid gap-2">
                  <Label htmlFor="isMultiSkilling">Is Multi Skilling Quiz? *</Label>
                  <Select
                    value={formData.isMultiSkilling ? "yes" : "no"}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        isMultiSkilling: value === "yes",
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
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <CardTitle>Questions</CardTitle>
                <CardDescription>
                  Add questions for your quiz. You can create MCQs, Short Answers, and Matching Pairs.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {formData.questions.map((question, qIndex) => {
              const qType = question.type || "mcq";
              return (
                <div key={`q-${qIndex}`} className="border rounded-lg p-4 space-y-4 bg-gray-50/20">
                  <div className="flex justify-between items-center border-b pb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-lg text-gray-700">Question {qIndex + 1}</span>
                      <Badge className={
                        qType === 'mcq' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                        qType === 'shortAnswer' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                        'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      }>
                        {qType === 'mcq' ? 'Multiple Choice' :
                         qType === 'shortAnswer' ? 'Short Written' : 'Matching Pair'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Select
                        value={qType}
                        onValueChange={(val) => handleQuestionTypeChange(qIndex, val)}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue placeholder="Question Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mcq">Multiple Choice</SelectItem>
                          <SelectItem value="shortAnswer">Short Answer</SelectItem>
                          <SelectItem value="matching">Matching Pair</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        onClick={() => removeQuestion(qIndex)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 h-8 w-8 p-0"
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="grid gap-2">
                    <Label htmlFor={`question-${qIndex}`}>Question Text (English) *</Label>
                    <Input
                      id={`question-${qIndex}`}
                      value={question.questionText}
                      onChange={(e) =>
                        handleQuestionChange(qIndex, "questionText", e.target.value)
                      }
                      placeholder="Enter question text in English"
                      required
                    />
                    <Input
                      id={`question-sec-${qIndex}`}
                      value={question.questionTextSec || ""}
                      onChange={(e) =>
                        handleQuestionChange(qIndex, "questionTextSec", e.target.value)
                      }
                      placeholder="Enter question text in secondary language (e.g. Hindi, Japanese) - Optional"
                      className="text-xs text-gray-500"
                    />

                    {/* Question Image Upload */}
                    <div className="mt-1">
                      {question.image ? (
                        <div className="relative w-full max-w-xs border rounded p-2 bg-white">
                          <img src={getMediaUrl(question.image.url)} alt="Question" className="w-full h-auto rounded max-h-40 object-contain" />
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
                            className="h-8 px-2.5 text-xs text-gray-500"
                            disabled={isImageUploading}
                            onClick={() => document.getElementById(`question-image-${qIndex}`).click()}
                          >
                            <IconPhoto className="h-3.5 w-3.5 mr-1.5" />
                            {isImageUploading ? "Uploading..." : "Add Question Image"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Marks */}
                  <div className="grid gap-2 w-full max-w-[150px]">
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

                  {/* Dynamic Render based on Question Type */}
                  {qType === "mcq" && (
                    <div className="space-y-3 pt-2">
                      <Label className="text-gray-700 font-semibold block">Options *</Label>

                      <div className="space-y-3">
                        {question.options.map((option, oIndex) => (
                          <div key={`q-${qIndex}-o-${oIndex}`} className="flex flex-col gap-2 p-3 border rounded-lg bg-white/70">
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleOptionChange(qIndex, oIndex, "isCorrect", true)
                                }
                                className={`p-2 rounded-full border transition mt-1.5 ${option.isCorrect
                                  ? "bg-green-100 border-green-300 text-green-700"
                                  : "bg-gray-100 border-gray-300 text-gray-400 hover:text-gray-600 hover:bg-gray-200"
                                  }`}
                                title={option.isCorrect ? "Correct answer" : "Mark as correct"}
                              >
                                {option.isCorrect ? (
                                  <IconCheck className="h-4 w-4" />
                                ) : (
                                  <IconX className="h-4 w-4" />
                                )}
                              </button>

                              <div className="flex-1 flex flex-col gap-2">
                                <Input
                                  value={option.text}
                                  onChange={(e) =>
                                    handleOptionChange(qIndex, oIndex, "text", e.target.value)
                                  }
                                  placeholder={`Option ${oIndex + 1} (English)`}
                                  className="w-full"
                                  required
                                />
                                <Input
                                  value={option.textSec || ""}
                                  onChange={(e) =>
                                    handleOptionChange(qIndex, oIndex, "textSec", e.target.value)
                                  }
                                  placeholder={`Option ${oIndex + 1} (Secondary Language / Optional)`}
                                  className="w-full text-xs text-gray-500"
                                />
                              </div>

                              <Button
                                type="button"
                                onClick={() => removeOption(qIndex, oIndex)}
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-800 hover:bg-red-50 h-8 w-8 p-0 mt-1.5"
                                disabled={question.options.length <= 2}
                              >
                                <IconTrash className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Option Image upload */}
                            <div className="ml-11">
                              {option.image ? (
                                <div className="relative w-24 h-24 border rounded bg-white">
                                  <img src={getMediaUrl(option.image.url)} alt="Option" className="w-full h-full object-contain rounded" />
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full"
                                    onClick={() => removeOptionImage(qIndex, oIndex)}
                                  >
                                    <IconX className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  <input
                                    type="file"
                                    id={`option-image-${qIndex}-${oIndex}`}
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleOptionImageUpload(qIndex, oIndex, e.target.files[0])}
                                    disabled={isImageUploading}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[10px] text-gray-500"
                                    disabled={isImageUploading}
                                    onClick={() => document.getElementById(`option-image-${qIndex}-${oIndex}`).click()}
                                  >
                                    <IconPhoto className="h-3 w-3 mr-1" />
                                    Add Option Image
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {question.options.filter(opt => opt.isCorrect).length === 0 && (
                        <p className="text-xs text-red-600 italic">
                          * Please mark at least one option as the correct answer.
                        </p>
                      )}

                      <div className="flex justify-end pt-2">
                        <Button
                          type="button"
                          onClick={() => addOption(qIndex)}
                          variant="outline"
                          size="sm"
                          className="gap-1 h-8 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 transition-all hover:scale-105 active:scale-95"
                        >
                          <IconPlus className="h-3.5 w-3.5" />
                          Add Option
                        </Button>
                      </div>
                    </div>
                  )}

                  {qType === "shortAnswer" && (
                    <div className="space-y-3 pt-2">
                      <Label htmlFor={`correctAnswer-${qIndex}`} className="text-gray-700 font-semibold">Correct Answer (Optional)</Label>
                      <Input
                        id={`correctAnswer-${qIndex}`}
                        value={question.correctAnswer || ""}
                        onChange={(e) => handleQuestionChange(qIndex, "correctAnswer", e.target.value)}
                        placeholder="Enter the correct answer text in English (optional - leave blank for manual audit)"
                      />
                      <Input
                        id={`correctAnswerSec-${qIndex}`}
                        value={question.correctAnswerSec || ""}
                        onChange={(e) => handleQuestionChange(qIndex, "correctAnswerSec", e.target.value)}
                        placeholder="Enter the correct answer text in secondary language (optional)"
                        className="text-xs text-gray-500"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        If left blank, students' written answers will be manually reviewed/audited by the trainer later.
                      </p>
                    </div>
                  )}

                  {qType === "matching" && (
                    <div className="space-y-3 pt-2">
                      <Label className="text-gray-700 font-semibold block">Matching Pairs *</Label>

                      <div className="space-y-4">
                        {question.pairs && question.pairs.map((pair, pIndex) => (
                          <div key={`q-${qIndex}-p-${pIndex}`} className="flex flex-col gap-3 p-3 border rounded-lg bg-white/70">
                            <div className="flex justify-between items-center border-b pb-1">
                              <span className="text-xs font-semibold text-purple-600">Pair {pIndex + 1}</span>
                              <Button
                                type="button"
                                onClick={() => removePair(qIndex, pIndex)}
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                                disabled={question.pairs.length <= 1}
                              >
                                <IconTrash className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                              {/* Left Element */}
                              <div className="space-y-2">
                                <Label className="text-[11px] text-gray-500 font-medium">Left Element (Item - English)</Label>
                                <Input
                                  value={pair.leftText}
                                  onChange={(e) => handlePairTextChange(qIndex, pIndex, 'left', e.target.value)}
                                  placeholder="e.g. Question/Item in English"
                                />
                                <Input
                                  value={pair.leftTextSec || ""}
                                  onChange={(e) => handlePairTextChange(qIndex, pIndex, 'left', e.target.value, true)}
                                  placeholder="e.g. Question/Item in secondary language (optional)"
                                  className="text-xs text-gray-500"
                                />

                                {/* Left Image */}
                                <div>
                                  {pair.leftImage ? (
                                    <div className="relative w-20 h-20 border rounded bg-white">
                                      <img src={getMediaUrl(pair.leftImage.url)} alt="Left Item" className="w-full h-full object-contain rounded" />
                                      <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="absolute -top-1 -right-1 h-4 w-4 rounded-full"
                                        onClick={() => removePairImage(qIndex, pIndex, 'left')}
                                      >
                                        <IconX className="h-2 w-2" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div>
                                      <input
                                        type="file"
                                        id={`pair-image-left-${qIndex}-${pIndex}`}
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handlePairImageUpload(qIndex, pIndex, 'left', e.target.files[0])}
                                        disabled={isImageUploading}
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 text-[10px] text-gray-500"
                                        disabled={isImageUploading}
                                        onClick={() => document.getElementById(`pair-image-left-${qIndex}-${pIndex}`).click()}
                                      >
                                        <IconPhoto className="h-3 w-3 mr-1" />
                                        Add Left Image
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Right Element */}
                              <div className="space-y-2">
                                <Label className="text-[11px] text-gray-500 font-medium">Right Element (Match Value - English)</Label>
                                <Input
                                  value={pair.rightText}
                                  onChange={(e) => handlePairTextChange(qIndex, pIndex, 'right', e.target.value)}
                                  placeholder="e.g. Match Answer in English"
                                />
                                <Input
                                  value={pair.rightTextSec || ""}
                                  onChange={(e) => handlePairTextChange(qIndex, pIndex, 'right', e.target.value, true)}
                                  placeholder="e.g. Match Answer in secondary language (optional)"
                                  className="text-xs text-gray-500"
                                />

                                {/* Right Image */}
                                <div>
                                  {pair.rightImage ? (
                                    <div className="relative w-20 h-20 border rounded bg-white">
                                      <img src={getMediaUrl(pair.rightImage.url)} alt="Right Match" className="w-full h-full object-contain rounded" />
                                      <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="absolute -top-1 -right-1 h-4 w-4 rounded-full"
                                        onClick={() => removePairImage(qIndex, pIndex, 'right')}
                                      >
                                        <IconX className="h-2 w-2" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div>
                                      <input
                                        type="file"
                                        id={`pair-image-right-${qIndex}-${pIndex}`}
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handlePairImageUpload(qIndex, pIndex, 'right', e.target.files[0])}
                                        disabled={isImageUploading}
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 text-[10px] text-gray-500"
                                        disabled={isImageUploading}
                                        onClick={() => document.getElementById(`pair-image-right-${qIndex}-${pIndex}`).click()}
                                      >
                                        <IconPhoto className="h-3 w-3 mr-1" />
                                        Add Right Image
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button
                          type="button"
                          onClick={() => addPair(qIndex)}
                          variant="outline"
                          size="sm"
                          className="gap-1 h-8 text-xs text-purple-600 border-purple-200 hover:bg-purple-50 transition-all hover:scale-105 active:scale-95"
                        >
                          <IconPlus className="h-3.5 w-3.5" />
                          Add Pair
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {formData.questions.length > 0 && <div className="border-t my-6 border-dashed" />}
            <div className="flex items-center justify-center gap-4 flex-wrap pt-2">
              <Button
                type="button"
                onClick={() => addQuestion("mcq")}
                variant="outline"
                className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 transition-all shadow-sm"
              >
                <IconPlus className="h-4 w-4" />
                Add MCQ
              </Button>
              <Button
                type="button"
                onClick={() => addQuestion("shortAnswer")}
                variant="outline"
                className="gap-2 border-green-200 text-green-700 hover:bg-green-50 transition-all shadow-sm"
              >
                <IconPlus className="h-4 w-4" />
                Add Short Answer
              </Button>
              <Button
                type="button"
                onClick={() => addQuestion("matching")}
                variant="outline"
                className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 transition-all shadow-sm"
              >
                <IconPlus className="h-4 w-4" />
                Add Matching
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`${basePath}/test-paper`)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="gap-2">
            {isLoading && <IconLoader className="h-4 w-4 animate-spin" />}
            {isLoading ? "Creating..." : "Create Test Paper"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddTestPaper;
