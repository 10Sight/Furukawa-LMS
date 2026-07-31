import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateCourseMutation } from "@/Redux/AllApi/CourseApi";
import { useCreateModuleMutation } from "@/Redux/AllApi/moduleApi";
import { useCreateQuizMutation } from "@/Redux/AllApi/QuizApi";
import { useCreateAssignmentMutation } from "@/Redux/AllApi/AssignmentApi";
import { useCreateResourceMutation } from "@/Redux/AllApi/resourceApi"; // Added resource API import
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { Button } from "@/components/ui/button";
import { FormCard, FormInput, FormTextarea, FormSelect } from "@/components/form";
import { CModuleForm } from "@/components/course/CModuleForm";
import { QuizForm } from "@/components/course/QuizForm";
import { AssignmentForm } from "@/components/course/AssignmentForm";
import {
  IconPlus,
  IconLoader,
  IconX,
  IconBook,
  IconArrowLeft,
} from "@tabler/icons-react";
import { toast } from "sonner";

const AddCourse = () => {
  const navigate = useNavigate();
  const [createCourse, { isLoading: isCreatingCourse }] = useCreateCourseMutation();
  const [createModule] = useCreateModuleMutation();
  const [createQuiz] = useCreateQuizMutation();
  const [createAssignment] = useCreateAssignmentMutation();
  const [createResource] = useCreateResourceMutation(); // Added resource mutation

  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    level: "THEORETICAL",
    departmentId: [], // Now an array
    sectionId: [],    // Now an array
  });

  const [modules, setModules] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [formErrors, setFormErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => {
      const newData = { ...prev };
      
      if (name === 'departmentId' || name === 'sectionId') {
        // Multi-select logic: Toggle value in array
        const currentValues = Array.isArray(prev[name]) ? prev[name] : [];
        if (currentValues.includes(value)) {
          newData[name] = currentValues.filter(v => v !== value);
        } else {
          newData[name] = [...currentValues, value];
        }

        // If department changes, we might want to filter sections
        // For simplicity, we'll keep existing sections but they might belong to removed depts.
        // Better: reset sections if a dept is removed? 
        // Actually, the API will fetch sections for all selected depts.
      } else {
        newData[name] = value;
      }

      return newData;
    });
    
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const removeItem = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: (prev[name] || []).filter(v => v !== value)
    }));
  };

  // Module Functions
  const addModule = () => {
    setModules(prev => [
      ...prev,
      {
        id: Date.now(),
        title: "",
        description: "",
        order: prev.length + 1,
        isExpanded: true,
        resources: []
      }
    ]);
  };

  const updateModule = (id, field, value) => {
    setModules(prev => prev.map(module =>
      module.id === id ? { ...module, [field]: value } : module
    ));
  };

  const removeModule = (id) => {
    setModules(prev => prev.filter(module => module.id !== id));
  };

  const toggleModuleExpand = (id) => {
    setModules(prev => prev.map(module =>
      module.id === id ? { ...module, isExpanded: !module.isExpanded } : module
    ));
  };

  const moveModule = (id, direction) => {
    setModules(prev => {
      const index = prev.findIndex(m => m.id === id);
      if ((direction === 'up' && index === 0) || (direction === 'down' && index === prev.length - 1)) {
        return prev;
      }

      const newModules = [...prev];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      [newModules[index], newModules[newIndex]] = [newModules[newIndex], newModules[index]];

      // Update order numbers
      return newModules.map((module, idx) => ({ ...module, order: idx + 1 }));
    });
  };

  // Resource Functions
  const addResource = (moduleId) => {
    setModules(prev => prev.map(module =>
      module.id === moduleId
        ? {
          ...module,
          resources: [
            ...module.resources,
            {
              id: Date.now(),
              title: "",
              type: "pdf",
              file: null,
              url: ""
            }
          ]
        }
        : module
    ));
  };

  const updateResource = (moduleId, resourceId, field, value) => {
    setModules(prev => prev.map(module =>
      module.id === moduleId
        ? {
          ...module,
          resources: module.resources.map(resource =>
            resource.id === resourceId ? { ...resource, [field]: value } : resource
          )
        }
        : module
    ));
  };

  const removeResource = (moduleId, resourceId) => {
    setModules(prev => prev.map(module =>
      module.id === moduleId
        ? {
          ...module,
          resources: module.resources.filter(resource => resource.id !== resourceId)
        }
        : module
    ));
  };

  // Quiz Functions
  const addQuiz = () => {
    setQuizzes(prev => [
      ...prev,
      {
        id: Date.now(),
        title: "",
        passingScore: 70,
        questions: [{
          id: Date.now() + 1,
          questionText: "",
          options: [
            { id: Date.now() + 2, text: "", isCorrect: false },
            { id: Date.now() + 3, text: "", isCorrect: false }
          ]
        }]
      }
    ]);
  };

  const updateQuiz = (id, field, value) => {
    setQuizzes(prev => prev.map(quiz =>
      quiz.id === id ? { ...quiz, [field]: value } : quiz
    ));
  };

  const removeQuiz = (id) => {
    setQuizzes(prev => prev.filter(quiz => quiz.id !== id));
  };

  const addQuestionToQuiz = (quizId) => {
    setQuizzes(prev => prev.map(quiz =>
      quiz.id === quizId
        ? {
          ...quiz,
          questions: [
            ...quiz.questions,
            {
              id: Date.now(),
              questionText: "",
              options: [
                { id: Date.now() + 1, text: "", isCorrect: false },
                { id: Date.now() + 2, text: "", isCorrect: false }
              ]
            }
          ]
        }
        : quiz
    ));
  };

  const updateQuestion = (quizId, questionId, field, value) => {
    setQuizzes(prev => prev.map(quiz =>
      quiz.id === quizId
        ? {
          ...quiz,
          questions: quiz.questions.map(q =>
            q.id === questionId ? { ...q, [field]: value } : q
          )
        }
        : quiz
    ));
  };

  const updateQuestionOption = (quizId, questionId, optionId, field, value) => {
    setQuizzes(prev => prev.map(quiz =>
      quiz.id === quizId
        ? {
          ...quiz,
          questions: quiz.questions.map(q =>
            q.id === questionId
              ? {
                ...q,
                options: q.options.map(opt =>
                  opt.id === optionId ? { ...opt, [field]: value } : opt
                )
              }
              : q
          )
        }
        : quiz
    ));
  };

  const addOptionToQuestion = (quizId, questionId) => {
    setQuizzes(prev => prev.map(quiz =>
      quiz.id === quizId
        ? {
          ...quiz,
          questions: quiz.questions.map(q =>
            q.id === questionId
              ? {
                ...q,
                options: [
                  ...q.options,
                  { id: Date.now(), text: "", isCorrect: false }
                ]
              }
              : q
          )
        }
        : quiz
    ));
  };

  const removeOptionFromQuestion = (quizId, questionId, optionId) => {
    setQuizzes(prev => prev.map(quiz =>
      quiz.id === quizId
        ? {
          ...quiz,
          questions: quiz.questions.map(q =>
            q.id === questionId
              ? {
                ...q,
                options: q.options.filter(opt => opt.id !== optionId)
              }
              : q
          )
        }
        : quiz
    ));
  };

  const setCorrectAnswer = (quizId, questionId, optionId) => {
    setQuizzes(prev => prev.map(quiz =>
      quiz.id === quizId
        ? {
          ...quiz,
          questions: quiz.questions.map(q =>
            q.id === questionId
              ? {
                ...q,
                options: q.options.map(opt => ({
                  ...opt,
                  isCorrect: opt.id === optionId
                }))
              }
              : q
          )
        }
        : quiz
    ));
  };

  const removeQuestion = (quizId, questionId) => {
    setQuizzes(prev => prev.map(quiz =>
      quiz.id === quizId
        ? { ...quiz, questions: quiz.questions.filter(q => q.id !== questionId) }
        : quiz
    ));
  };

  // Assignment Functions
  const addAssignment = () => {
    setAssignments(prev => [
      ...prev,
      {
        id: Date.now(),
        title: "",
        description: "",
        dueDate: ""
      }
    ]);
  };

  const updateAssignment = (id, field, value) => {
    setAssignments(prev => prev.map(assignment =>
      assignment.id === id ? { ...assignment, [field]: value } : assignment
    ));
  };

  const removeAssignment = (id) => {
    setAssignments(prev => prev.filter(assignment => assignment.id !== id));
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.title.trim()) errors.title = "Title is required";
    if (!formData.description.trim()) errors.description = "Description is required";
    if (!formData.category.trim()) errors.category = "Category is required";
    if (!formData.departmentId) errors.departmentId = "Department is required";

    modules.forEach((module, index) => {
      if (!module.title.trim()) errors[`module-${module.id}-title`] = `Module ${index + 1} title is required`;

      // Validate resources
      module.resources.forEach((resource, resIndex) => {
        if (!resource.title.trim()) {
          errors[`module-${module.id}-resource-${resource.id}-title`] = `Resource ${resIndex + 1} title is required`;
        }
        if (resource.type === "URL" && !resource.url.trim()) {
          errors[`module-${module.id}-resource-${resource.id}-url`] = `Resource ${resIndex + 1} URL is required`;
        }
        if (resource.type === "FILE" && !resource.file) {
          errors[`module-${module.id}-resource-${resource.id}-file`] = `Resource ${resIndex + 1} file is required`;
        }
      });
    });

    // Validate quizzes
    quizzes.forEach((quiz, quizIndex) => {
      if (!quiz.title.trim()) errors[`quiz-${quiz.id}-title`] = `Test ${quizIndex + 1} title is required`;

      quiz.questions.forEach((question, qIndex) => {
        if (!question.questionText.trim()) {
          errors[`quiz-${quiz.id}-question-${question.id}-text`] = `Question ${qIndex + 1} text is required`;
        }

        // Validate that at least one option is correct
        const hasCorrectAnswer = question.options.some(opt => opt.isCorrect);
        if (!hasCorrectAnswer) {
          errors[`quiz-${quiz.id}-question-${question.id}-correct`] = `Question ${qIndex + 1} must have a correct answer`;
        }

        // Validate that all options have text
        question.options.forEach((option, oIndex) => {
          if (!option.text.trim()) {
            errors[`quiz-${quiz.id}-question-${question.id}-option-${option.id}-text`] = `Option ${oIndex + 1} text is required`;
          }
        });

        // Validate that there are at least 2 options
        if (question.options.length < 2) {
          errors[`test-${quiz.id}-question-${question.id}-options`] = `Question ${qIndex + 1} must have at least 2 options`;
        }
      });

      // Validate that there's at least one question
      if (quiz.questions.length === 0) {
        errors[`quiz-${quiz.id}-questions`] = `Test ${quizIndex + 1} must have at least one question`;
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the form errors");
      return;
    }

    setIsLoading(true);

    try {
      // First create the course
      const courseResponse = await createCourse({
        title: formData.title,
        description: formData.description,
        category: formData.category,
        level: formData.level,
        departmentId: formData.departmentId,
        sectionId: formData.sectionId || null
      }).unwrap();

      const courseId = courseResponse.data.id || courseResponse.data._id;

      // Create modules and their resources sequentially to prevent slug race conditions
      const moduleIds = [];
      for (const module of modules) {
        const moduleResponse = await createModule({
          courseId,
          title: module.title,
          description: module.description,
          order: module.order
        }).unwrap();

        const moduleId = moduleResponse.data.id || moduleResponse.data._id;
        moduleIds.push(moduleId);

        // Create resources for this module sequentially
        if (module.resources && module.resources.length > 0) {
          for (const resource of module.resources) {
            const formDataToSend = new FormData();
            formDataToSend.append("moduleId", moduleId);
            formDataToSend.append("title", resource.title);
            formDataToSend.append("type", resource.type);
            formDataToSend.append("scope", "module");

            if (resource.file) {
              formDataToSend.append("file", resource.file);
            } else if (resource.url) {
              formDataToSend.append("url", resource.url);
            }

            await createResource(formDataToSend).unwrap();
          }
        }
      }

      // Create quizzes sequentially
      for (const quiz of quizzes) {
        await createQuiz({
          courseId,
          title: quiz.title,
          passingScore: quiz.passingScore || 70,
          questions: quiz.questions.map(q => ({
            questionText: q.questionText,
            options: q.options.map(opt => ({
              text: opt.text,
              isCorrect: opt.isCorrect
            }))
          }))
        }).unwrap();
      }

      // Create assignments sequentially
      for (const assignment of assignments) {
        await createAssignment({
          courseId,
          title: assignment.title,
          description: assignment.description,
          dueDate: assignment.dueDate
        }).unwrap();
      }

      toast.success("Course created successfully!");
      navigate("/admin/courses");
    } catch (error) {
      console.error("Create course error:", error);
      toast.error(error?.data?.message || "Failed to create course");
    } finally {
      setIsLoading(false);
    }
  };

  const courseTypeOptions = [
    { value: "THEORETICAL", label: "Theoretical" },
    { value: "PRACTICAL", label: "Practical" },
  ];

  // Fetch Departments
  const { data: departmentsData } = useGetAllDepartmentsQuery({ limit: 1000 });
  const departments = departmentsData?.data?.departments || [];
  const departmentOptions = departments.map(dept => ({
    value: String(dept.id || dept._id),
    label: dept.name
  }));

  // Fetch Sections based on selected Department
  const { data: sectionsData } = useGetSectionsByDepartmentQuery(formData.departmentId, {
    skip: !formData.departmentId
  });
  const sections = sectionsData?.data || [];
  const sectionOptions = sections.map(section => ({
    value: String(section.id || section._id),
    label: section.name
  }));

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate("/admin/courses")}
            className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
          >
            <IconArrowLeft className="h-4 w-4 mr-1" />
            Back to courses
          </button>
          <h1 className="text-3xl font-bold tracking-tight">Create New Course</h1>
          <p className="text-muted-foreground mt-2">
            Build a comprehensive course with modules, quizzes, and assignments
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/admin/courses")}
          className="gap-2"
        >
          <IconX className="h-4 w-4" />
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information Card */}
        <FormCard
          title={
            <div className="flex items-center gap-2">
              <IconBook className="h-5 w-5" />
              Basic Information
            </div>
          }
          description="Enter the basic details of your course"
          className="border-l-4 border-l-primary"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormInput
              id="title"
              name="title"
              label="Course Title *"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter course title"
              error={formErrors.title}
              className="bg-muted/50"
            />

            <FormSelect
              id="category"
              label="Category *"
              value={formData.category}
              onValueChange={(value) => handleSelectChange("category", value)}
              options={[
                { value: "Critical", label: "Critical" },
                { value: "Non-Critical", label: "Non-Critical" }
              ]}
              placeholder="Select category"
              error={formErrors.category}
            />
          </div>

          <FormTextarea
            id="description"
            name="description"
            label="Description *"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Enter course description"
            error={formErrors.description}
            className="min-h-32 bg-muted/50"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormSelect
              id="level"
              label="Course Type"
              value={formData.level}
              onValueChange={(value) => handleSelectChange("level", value)}
              options={courseTypeOptions}
              placeholder="Select course type"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <FormSelect
                label="Departments *"
                name="departmentId"
                value=""
                onValueChange={(val) => handleSelectChange("departmentId", val)}
                options={departmentOptions.filter(opt => !formData.departmentId.includes(opt.value))}
                placeholder={formData.departmentId.length > 0 ? `${formData.departmentId.length} departments selected` : "Add Department"}
                error={formErrors.departmentId}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.departmentId.map(id => {
                  const dept = departmentOptions.find(opt => opt.value === id);
                  return (
                    <div key={id} className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm border border-primary/20">
                      {dept?.label || id}
                      <button type="button" onClick={() => removeItem("departmentId", id)}>
                        <IconX size={14} className="hover:text-destructive" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <FormSelect
                label="Sections (Optional)"
                name="sectionId"
                value=""
                onValueChange={(val) => handleSelectChange("sectionId", val)}
                options={sectionOptions.filter(opt => !formData.sectionId.includes(opt.value))}
                placeholder={formData.sectionId.length > 0 ? `${formData.sectionId.length} sections selected` : (formData.departmentId.length ? "Add Section" : "Select departments first")}
                error={formErrors.sectionId}
                disabled={!formData.departmentId.length}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.sectionId.map(id => {
                  const sec = sectionOptions.find(opt => opt.value === id);
                  return (
                    <div key={id} className="flex items-center gap-1 bg-secondary/10 text-secondary-foreground px-2 py-1 rounded-md text-sm border border-secondary/20">
                      {sec?.label || id}
                      <button type="button" onClick={() => removeItem("sectionId", id)}>
                        <IconX size={14} className="hover:text-destructive" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </FormCard>

        {/* Modules Card */}
        <FormCard
          title="Course Modules"
          description="Organize your course content into modules. Students will progress through these in order."
          actionButton={
            <Button type="button" onClick={addModule} className="gap-2 bg-primary hover:bg-primary/90">
              <IconPlus className="h-4 w-4" />
              Add Module
            </Button>
          }
          className="border-l-4 border-l-blue-500"
        >
          {modules.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
              <IconBook className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No modules added yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click "Add Module" to start building your course content
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {modules.map((module, index) => (
                <CModuleForm
                  key={module.id}
                  module={module}
                  index={index}
                  errors={formErrors}
                  onUpdate={updateModule}
                  onRemove={removeModule}
                  onMove={moveModule}
                  onToggleExpand={toggleModuleExpand}
                  onAddResource={addResource}
                  onUpdateResource={updateResource}
                  onRemoveResource={removeResource}
                />
              ))}
            </div>
          )}
        </FormCard>

        {/* Quizzes Card */}
        <FormCard
          title="Quizzes"
          description="Add quizzes to test student knowledge throughout the course"
          actionButton={
            <Button type="button" onClick={addQuiz} className="gap-2 bg-primary hover:bg-primary/90">
              <IconPlus className="h-4 w-4" />
              Add Quiz
            </Button>
          }
          className="border-l-4 border-l-green-500"
        >
          {quizzes.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
              <div className="bg-green-100 text-green-600 h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-muted-foreground font-medium">No quizzes added yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add quizzes to assess student understanding
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {quizzes.map(quiz => (
                <QuizForm
                  key={quiz.id}
                  quiz={quiz}
                  errors={formErrors}
                  onUpdate={updateQuiz}
                  onRemove={removeQuiz}
                  onAddQuestion={addQuestionToQuiz}
                  onUpdateQuestion={updateQuestion}
                  onRemoveQuestion={removeQuestion}
                  onUpdateQuestionOption={updateQuestionOption}
                  onAddOptionToQuestion={addOptionToQuestion}
                  onRemoveOptionFromQuestion={removeOptionFromQuestion}
                  onSetCorrectAnswer={setCorrectAnswer}
                />
              ))}
            </div>
          )}
        </FormCard>

        {/* Assignments Card */}
        <FormCard
          title="Assignments"
          description="Add practical assignments for students to apply their knowledge"
          actionButton={
            <Button type="button" onClick={addAssignment} className="gap-2 bg-primary hover:bg-primary/90">
              <IconPlus className="h-4 w-4" />
              Add Assignment
            </Button>
          }
          className="border-l-4 border-l-purple-500"
        >
          {assignments.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
              <div className="bg-purple-100 text-purple-600 h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <p className="text-muted-foreground font-medium">No assignments added yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add assignments for practical application of concepts
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map(assignment => (
                <AssignmentForm
                  key={assignment.id}
                  assignment={assignment}
                  onUpdate={updateAssignment}
                  onRemove={() => removeAssignment(assignment.id)}
                />
              ))}
            </div>
          )}
        </FormCard>

        {/* Submit Button */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/admin/courses")}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading || isCreatingCourse}
            className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90"
          >
            {(isLoading || isCreatingCourse) && <IconLoader className="h-4 w-4 animate-spin" />}
            {(isLoading || isCreatingCourse) ? "Creating Course..." : "Create Course"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddCourse;