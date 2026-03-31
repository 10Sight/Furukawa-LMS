import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  CheckCircle2,
  PlayCircle,
  Lock,
  Trophy,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  ExternalLink,
  Video,
  FileImage,
  BarChart3,
  Award,
  ListChecks,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Star,
  Target,
  BookMarked,
  GraduationCap,
  Lightbulb,
  TrendingUp,
  Zap,
} from "lucide-react";
import axiosInstance from "@/Helper/axiosInstance";
import { useGetResourcesByCourseQuery } from "@/Redux/AllApi/resourceApi";
import { useGetQuizzesByCourseQuery, useGetQuizzesByModuleQuery } from "@/Redux/AllApi/QuizApi";
import { useGetAssignmentsByCourseQuery, useGetAssignmentsByModuleQuery } from "@/Redux/AllApi/AssignmentApi";
import { useGetMySubmissionsQuery } from "@/Redux/AllApi/SubmissionApi";
import { useGetMyAttemptsQuery } from "@/Redux/AllApi/AttemptedQuizApi";

// Import custom components
import StudentModuleResources from "@/components/student/StudentModuleResources";
import StudentCourseResources from "@/components/student/StudentCourseResources";
import StudentModuleQuizzes from "@/components/student/StudentModuleQuizzes";
import StudentModuleAssignments from "@/components/student/StudentModuleAssignments";
import AssignmentDetailsModal from "@/components/student/AssignmentDetailsModal";
import AssignmentSubmissionModal from "@/components/student/AssignmentSubmissionModal";

// Constants
const STATUS_CONFIG = {
  ACTIVE: { name: "Active", color: "bg-green-100 text-green-800" },
  UPCOMING: { name: "Upcoming", color: "bg-blue-100 text-blue-800" },
  COMPLETED: { name: "Completed", color: "bg-gray-100 text-gray-800" },
  PAUSED: { name: "Paused", color: "bg-yellow-100 text-yellow-800" },
};

// Hook for managing course data
const useCourseData = () => {
  const [state, setState] = useState({
    department: null,
    modules: [],
    currentLevel: "L1",
    completedModuleIds: [],
    completedLessonIds: [],
    loading: true,
    error: null,
    refreshing: false,
  });


  const fetchCourseData = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setState(prev => ({ ...prev, refreshing: true }));
      } else {
        setState(prev => ({ ...prev, loading: true }));
      }

      // Get department course content
      const response = await axiosInstance.get("/api/departments/me/course-content");
      const courseData = response?.data?.data;

      if (!courseData) {
        throw new Error("No course data available");
      }

      // The API now returns the course object directly
      const department = {
        course: courseData,
        status: 'ACTIVE' // Default status since we're viewing content
      };

      const modules = courseData.modules || [];
      const progress = courseData.progress || {};

      // Extract completed IDs from the nested structure
      const completedModuleIds = progress.completedModules
        ? progress.completedModules.map(module => String(module.moduleId || module._id || module))
        : [];

      const completedLessonIds = progress.completedLessons
        ? progress.completedLessons.map(lesson => String(lesson.lessonId || lesson._id || lesson))
        : [];


      setState({
        department,
        modules: modules.sort((a, b) => (a.order || 0) - (b.order || 0)),
        currentLevel: progress.currentLevel || "L1",
        levelLockEnabled: progress.levelLockEnabled || false,
        lockedLevel: progress.lockedLevel || null,
        completedModuleIds,
        completedLessonIds,
        loading: false,
        refreshing: false,
        error: null,
      });
    } catch (error) {
      console.error("Error fetching course data:", error);
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: error.message || "Failed to load course data",
      }));
      toast.error("Failed to load course data");
    }
  }, []);

  useEffect(() => {
    fetchCourseData();
  }, [fetchCourseData]);

  return { ...state, refresh: () => fetchCourseData(true) };
};


// Hook for managing course-level content using RTK Query
const useCourseContent = (courseId, allModulesCompleted) => {
  const {
    data: courseQuizzesData,
    isLoading: courseQuizzesLoading,
  } = useGetQuizzesByCourseQuery(courseId, {
    skip: !courseId || !allModulesCompleted,
  });

  const {
    data: courseAssignmentsData,
    isLoading: courseAssignmentsLoading,
  } = useGetAssignmentsByCourseQuery(courseId, {
    skip: !courseId || !allModulesCompleted,
  });

  const courseQuizzes = courseQuizzesData?.data || [];
  const courseAssignments = courseAssignmentsData?.data || [];
  const loading = courseQuizzesLoading || courseAssignmentsLoading;
  const loaded = !loading && (courseQuizzesData !== undefined || courseAssignmentsData !== undefined);

  return {
    courseQuizzes,
    courseAssignments,
    loading,
    loaded,
    loadCourseContent: () => { }, // No longer needed with RTK Query
  };
};

// Updated hook for managing module content with RTK Query for assessments
const useModuleContent = () => {
  const [state, setState] = useState({
    lessonsByModule: {},
    resourcesByModule: {},
    quizzesByModule: {},
    assignmentsByModule: {},
    loadingStates: {},
    loadedModules: new Set(), // Track which modules have been loaded
  });

  // Refs to prevent duplicate network calls across re-renders
  const loadingModulesRef = useRef(new Set());
  const loadedModulesRef = useRef(new Set());

  // Store moduleId and courseId for RTK Query hooks
  const [currentModules, setCurrentModules] = useState({});

  const loadModuleContent = useCallback(async (moduleId, courseId, existingLessons = null) => {
    // Guard against undefined/invalid moduleId
    if (!moduleId) {
      console.warn("DepartmentCourse - Skipping loadModuleContent: missing moduleId", { moduleId, courseId });
      return;
    }

    const key = String(moduleId);
    if (loadedModulesRef.current.has(key) || loadingModulesRef.current.has(key)) {
      return;
    }

    loadingModulesRef.current.add(key);

    // Add to current modules for RTK Query
    setCurrentModules(prev => ({ ...prev, [key]: { moduleId, courseId } }));

    setState(prev => ({
      ...prev,
      loadingStates: { ...prev.loadingStates, [key]: true }
    }));

    try {
      // Load resources (always fetch resources as they might not be in courseData)
      const resourcesPromise = axiosInstance.get(`/api/resources/module/${moduleId}`);

      // Use existing lessons if provided, else fetch
      const lessonsPromise = (existingLessons && existingLessons.length > 0)
        ? Promise.resolve({ data: { data: existingLessons } })
        : axiosInstance.get(`/api/modules/${moduleId}/lessons`);

      const [lessonsRes, resourcesRes] = await Promise.allSettled([
        lessonsPromise,
        resourcesPromise,
      ]);

      if (resourcesRes.status === 'rejected') {
        console.error(`DepartmentCourse - Resources fetch failed for moduleId ${moduleId}:`, resourcesRes.reason);
      }

      const lessons = lessonsRes.status === 'fulfilled'
        ? (lessonsRes.value?.data?.data || []).sort((a, b) => (a.order || 0) - (b.order || 0))
        : [];

      const resources = resourcesRes.status === 'fulfilled'
        ? resourcesRes.value?.data?.data || []
        : [];

      setState(prev => ({
        ...prev,
        lessonsByModule: { ...prev.lessonsByModule, [key]: lessons },
        resourcesByModule: { ...prev.resourcesByModule, [key]: resources },
        loadingStates: { ...prev.loadingStates, [key]: false },
        loadedModules: new Set([...prev.loadedModules, key])
      }));
      loadedModulesRef.current.add(key);
    } catch (error) {
      console.error(`Error loading module ${moduleId} content:`, error);
      setState(prev => ({
        ...prev,
        lessonsByModule: { ...prev.lessonsByModule, [key]: [] },
        resourcesByModule: { ...prev.resourcesByModule, [key]: [] },
        loadingStates: { ...prev.loadingStates, [key]: false }
      }));
    } finally {
      loadingModulesRef.current.delete(key);
    }
    // Intentionally leave deps empty to keep a stable function identity.
  }, []);

  // Function to update assessments data from RTK Query
  const updateModuleAssessments = useCallback((moduleId, quizzes = [], assignments = []) => {
    const key = String(moduleId);
    setState(prev => ({
      ...prev,
      quizzesByModule: { ...prev.quizzesByModule, [key]: quizzes },
      assignmentsByModule: { ...prev.assignmentsByModule, [key]: assignments }
    }));
  }, []);

  return {
    ...state,
    loadModuleContent,
    updateModuleAssessments,
    currentModules
  };
};

// Component to handle RTK Query hooks for individual modules
const ModuleAssessmentProvider = ({ moduleId, courseId, children, onAssessmentsLoaded }) => {
  const {
    data: moduleQuizzesData,
    isLoading: moduleQuizzesLoading,
  } = useGetQuizzesByModuleQuery(moduleId, {
    skip: !courseId || !moduleId,
  });

  const {
    data: moduleAssignmentsData,
    isLoading: moduleAssignmentsLoading,
  } = useGetAssignmentsByModuleQuery(moduleId, {
    skip: !courseId || !moduleId,
  });

  const moduleQuizzes = moduleQuizzesData?.data || [];
  const moduleAssignments = moduleAssignmentsData?.data || [];

  // Update parent component when assessments are loaded
  useEffect(() => {
    if (!moduleQuizzesLoading && !moduleAssignmentsLoading && onAssessmentsLoaded) {
      onAssessmentsLoaded(moduleId, moduleQuizzes, moduleAssignments);
    }
  }, [moduleId, moduleQuizzes, moduleAssignments, moduleQuizzesLoading, moduleAssignmentsLoading, onAssessmentsLoaded]);

  return children;
};

// Main component
const DepartmentCourse = () => {
  const navigate = useNavigate();
  const {
    department,
    modules,
    currentLevel,
    levelLockEnabled,
    lockedLevel,
    completedModuleIds,
    completedLessonIds,
    loading,
    error,
    refreshing,
    refresh
  } = useCourseData();



  const {
    lessonsByModule,
    resourcesByModule,
    quizzesByModule,
    assignmentsByModule,
    loadingStates,
    loadModuleContent,
    updateModuleAssessments
  } = useModuleContent();

  // Callback for handling module assessments loaded from RTK Query
  const handleModuleAssessmentsLoaded = useCallback((moduleId, quizzes, assignments) => {
    updateModuleAssessments(moduleId, quizzes, assignments);
  }, [updateModuleAssessments]);

  // Fetch course-level resources
  const {
    data: courseResourcesData,
  } = useGetResourcesByCourseQuery(department?.course?._id || department?.course?.id, {
    skip: !department?.course?._id && !department?.course?.id,
  });

  const courseResources = courseResourcesData?.data || [];

  const allModulesCompleted = modules.length > 0 && modules.every(m =>
    completedModuleIds.includes(String(m?._id || m?.id))
  );

  const {
    courseQuizzes,
    courseAssignments,
    loaded: courseContentLoaded,
  } = useCourseContent(department?.course?._id || department?.course?.id, allModulesCompleted);

  // Fetch student submissions
  const { data: submissionsData, refetch: refetchSubmissions } = useGetMySubmissionsQuery(undefined, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const submissions = submissionsData?.data || [];

  // Create a map of submissions by assignment ID for quick lookup (from API)
  const apiSubmissionsByAssignment = submissions.reduce((acc, submission) => {
    if (submission.assignment) {
      const key = typeof submission.assignment === 'object'
        ? (submission.assignment._id || submission.assignment.id)
        : submission.assignment;
      if (key) acc[key] = submission;
    }
    return acc;
  }, {});

  // Fetch student quiz attempts
  const { data: attemptsData, refetch: refetchAttempts } = useGetMyAttemptsQuery(undefined, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const attempts = attemptsData?.data || [];

  // Track extra attempt approvals/rejections in-session to reflect UI instantly
  const [extraGrantedQuizIds, setExtraGrantedQuizIds] = useState(new Set());
  const [rejectedQuizIds, setRejectedQuizIds] = useState(new Set());

  useEffect(() => {
    const handler = (e) => {
      const { quizId, status } = e.detail || {};
      if (!quizId) return;
      if (status === 'APPROVED') {
        setExtraGrantedQuizIds(prev => new Set(prev).add(String(quizId)));
        // refresh attempts & progress so UI updates naturally
        if (typeof refetchAttempts === 'function') refetchAttempts();
        refresh();
      } else if (status === 'REJECTED') {
        setRejectedQuizIds(prev => new Set(prev).add(String(quizId)));
        if (typeof refetchAttempts === 'function') refetchAttempts();
        refresh();
      }
    };
    window.addEventListener('attempt-extension-updated', handler);
    return () => window.removeEventListener('attempt-extension-updated', handler);
  }, [refetchAttempts, refresh]);

  // Create a map of quiz attempts by quiz ID for quick lookup
  const attemptsByQuiz = attempts.reduce((acc, attempt) => {
    if (attempt.quiz) {
      const key = typeof attempt.quiz === 'object'
        ? (attempt.quiz._id || attempt.quiz.id)
        : attempt.quiz;
      if (key) {
        if (!acc[key]) acc[key] = [];
        acc[key].push(attempt);
      }
    }
    return acc;
  }, {});

  // Local optimistic map for instant UI updates after successful submission
  const [localSubmissionsMap, setLocalSubmissionsMap] = useState({});

  // Effective submissions map (API + local optimistic updates)
  const submissionsByAssignment = { ...apiSubmissionsByAssignment, ...localSubmissionsMap };

  const [uiState, setUiState] = useState({
    levelUpgradeMessage: null,
    processingAction: null,
    activeModule: null,
    activeTab: 'lessons',
  });

  // Assignment modal states
  const [assignmentModals, setAssignmentModals] = useState({
    detailsModal: { isOpen: false, assignment: null, submission: null },
    submissionModal: { isOpen: false, assignment: null, submission: null }
  });

  // Helper functions
  const getModuleId = (m) => m?._id || m?.id;
  const getLessonId = (l) => l?._id || l?.id;
  const getAssignmentId = (a) => a?._id || a?.id;

  const isModuleCompleted = useCallback((module) => {
    const moduleId = String(getModuleId(module));
    return completedModuleIds.includes(moduleId);
  }, [completedModuleIds]);

  const isLessonCompleted = useCallback((lesson) => {
    return completedLessonIds.includes(String(getLessonId(lesson)));
  }, [completedLessonIds]);

  const isModuleAccessible = useCallback((moduleIndex) => {
    // First module is always accessible
    if (moduleIndex === 0) return true;

    // Check if all previous modules are completed
    for (let i = 0; i < moduleIndex; i++) {
      if (!isModuleCompleted(modules[i])) {
        return false;
      }
    }

    // Check level lock restrictions if enabled
    if (levelLockEnabled && lockedLevel && modules[moduleIndex]) {
      const moduleLevel = modules[moduleIndex].level || "L1";
      const currentLevelNum = parseInt(currentLevel.replace('L', ''));
      const moduleLevelNum = parseInt(moduleLevel.replace('L', ''));

      // Module is locked if its level is higher than current level
      if (moduleLevelNum > currentLevelNum) {
        return false;
      }
    }

    return true;
  }, [modules, isModuleCompleted, levelLockEnabled, lockedLevel, currentLevel]);

  const getCompletedModulesCount = useCallback(() => {
    return modules.reduce((count, module) =>
      count + (isModuleCompleted(module) ? 1 : 0), 0
    );
  }, [modules, isModuleCompleted]);

  const calculateProgress = useCallback(() => {
    if (modules.length === 0) return 0;
    return Math.round((getCompletedModulesCount() / modules.length) * 100);
  }, [modules.length, getCompletedModulesCount]);

  const getLevelBadge = useCallback((level) => {
    const colorMap = {
      L1: "bg-blue-100 text-blue-800",
      L2: "bg-orange-100 text-orange-800",
      L3: "bg-green-100 text-green-800",
    };

    const raw = typeof level === "string" ? level : (level != null ? `L${level}` : "L1");
    const color = colorMap[raw] || "bg-gray-100 text-gray-800";

    return (
      <Badge className={`${color} font-medium text-xs px-2 py-1`}>
        {raw}
      </Badge>
    );
  }, []);

  // Get the current accessible module based on completion status
  const getCurrentModuleIndex = useCallback(() => {
    for (let i = 0; i < modules.length; i++) {
      if (!isModuleCompleted(modules[i])) {
        return i;
      }
    }
    return modules.length - 1; // All modules completed, stay at last module
  }, [modules, isModuleCompleted]);

  // Check stage completion status for current module
  const getStageStatus = (moduleIndex, stage) => {
    if (moduleIndex >= modules.length) return { completed: true, accessible: false };

    const module = modules[moduleIndex];
    const moduleId = getModuleId(module);
    const moduleLessons = lessonsByModule[moduleId] || [];
    const moduleResources = resourcesByModule[moduleId] || [];
    const moduleQuizzes = quizzesByModule[moduleId] || [];
    const moduleAssignments = assignmentsByModule[moduleId] || [];

    const allLessonsCompleted = moduleLessons.every(lesson =>
      isLessonCompleted(lesson)
    );

    switch (stage) {
      case 'lessons':
        return {
          completed: allLessonsCompleted,
          accessible: true,
          hasContent: moduleLessons.length > 0
        };
      case 'resources':
        return {
          completed: allLessonsCompleted, // Resources are considered "completed" when lessons are done
          accessible: allLessonsCompleted,
          hasContent: moduleResources.length > 0
        };
      case 'quiz': {
        const allQuizzesCompleted = moduleQuizzes.length > 0 && moduleQuizzes.every(q => {
          const qid = q._id || q.id;
          const quizAttempts = attemptsByQuiz[String(qid)] || [];
          if (quizAttempts.length === 0) return false;

          // Check if passed (best score >= passing score)
          const bestAttempt = quizAttempts.reduce((best, current) => {
            return (current.score > best.score) ? current : best;
          }, quizAttempts[0]);

          const passingScore = q.passingScore || 70;
          return bestAttempt.score >= passingScore;
        });

        return {
          completed: allQuizzesCompleted,
          accessible: allLessonsCompleted,
          hasContent: moduleQuizzes.length > 0
        };
      }
      case 'assignment': {
        const allAssignmentsSubmitted = moduleAssignments.length > 0 && moduleAssignments.every(a => {
          const aid = getAssignmentId(a);
          return aid && submissionsByAssignment[String(aid)];
        });
        return {
          completed: allAssignmentsSubmitted,
          accessible: allLessonsCompleted,
          hasContent: moduleAssignments.length > 0
        };
      }
      default:
        return { completed: false, accessible: false, hasContent: false };
    }
  };

  // Determine what stage should be shown for current module
  const getCurrentStage = (moduleIndex) => {
    const stages = ['lessons', 'resources', 'quiz', 'assignment'];

    for (const stage of stages) {
      const status = getStageStatus(moduleIndex, stage);
      if (status.hasContent && !status.completed) {
        return stage;
      }
    }
    return 'complete'; // All stages completed
  };

  // Action handlers


  // Remove unused handleNextStage function as it's not being used in the current UI

  const handleStartQuiz = (quiz) => {
    navigate(`/student/quiz/${quiz._id || quiz.id}`);
  };

  // Assignment handlers
  const handleAssignmentViewDetails = (assignment, submission) => {
    setAssignmentModals({
      ...assignmentModals,
      detailsModal: { isOpen: true, assignment, submission }
    });
  };

  const handleAssignmentSubmit = (assignment, submission) => {
    console.log('🔍 handleAssignmentSubmit called with:', { assignment, submission });
    setAssignmentModals({
      ...assignmentModals,
      submissionModal: { isOpen: true, assignment, submission }
    });
  };

  const handleCloseDetailsModal = () => {
    setAssignmentModals({
      ...assignmentModals,
      detailsModal: { isOpen: false, assignment: null, submission: null }
    });
  };

  const handleCloseSubmissionModal = () => {
    setAssignmentModals({
      ...assignmentModals,
      submissionModal: { isOpen: false, assignment: null, submission: null }
    });
  };

  const handleSubmissionSuccess = (submissionData) => {
    // Normalize submission object from API response wrapper or direct object
    const submission = submissionData?.data || submissionData;
    const assignmentKey = typeof submission?.assignment === 'object'
      ? (submission.assignment?._id || submission.assignment?.id)
      : submission?.assignment;

    if (assignmentKey) {
      // Optimistically update local submissions map for instant UI change
      setLocalSubmissionsMap(prev => ({ ...prev, [String(assignmentKey)]: submission }));
    }

    toast.success('Assignment submitted successfully!');

    // Close modals
    setAssignmentModals({
      detailsModal: { isOpen: false, assignment: null, submission: null },
      submissionModal: { isOpen: false, assignment: null, submission: null }
    });

    // Ensure server state is synced (RTK invalidation + explicit refetch)
    if (typeof refetchSubmissions === 'function') {
      refetchSubmissions();
    }
  };

  const handleShowSubmissionFromDetails = () => {
    const { assignment, submission } = assignmentModals.detailsModal;
    setAssignmentModals({
      detailsModal: { isOpen: false, assignment: null, submission: null },
      submissionModal: { isOpen: true, assignment, submission }
    });
  };

  const handleModuleClick = (module, index) => {
    if (!isModuleAccessible(index)) return;

    const moduleId = getModuleId(module);
    const isCurrentlyActive = uiState.activeModule &&
      String(getModuleId(uiState.activeModule)) === String(moduleId);

    if (isCurrentlyActive) {
      // Hide the module panel
      setUiState(prev => ({ ...prev, activeModule: null, activeTab: 'lessons' }));
    } else {
      // Show the module panel and load its content
      setUiState(prev => ({ ...prev, activeModule: module, activeTab: 'lessons' }));
      loadModuleContent(moduleId, department?.course?._id || department?.course?.id, module.lessons);
    }
  };

  const handleMarkModuleComplete = useCallback(async (module) => {
    if (!department?.course || uiState.processingAction) return;

    const courseId = department.course._id || department.course.id;
    const moduleId = getModuleId(module);

    setUiState(prev => ({ ...prev, processingAction: `module-${moduleId}` }));

    try {
      const response = await axiosInstance.patch(`/api/progress/module-complete`, {
        courseId,
        moduleId
      });

      if (response.data.success) {
        toast.success("Module completed!");
        refresh(); // Refresh to get updated state

        // Check if this unlocks a new level
        if (response.data.data?.levelUp) {
          setUiState(prev => ({
            ...prev,
            levelUpgradeMessage: `Congratulations! You've advanced to ${response.data.data.newLevel}!`
          }));
        }
      } else {
        throw new Error(response.data.message || 'Failed to complete module');
      }
    } catch (error) {
      console.error("Failed to mark module complete:", error);
      const errorMessage = error.response?.data?.message || error.message || "Failed to mark module as complete. Please try again.";
      toast.error(errorMessage);
    } finally {
      setUiState(prev => ({ ...prev, processingAction: null }));
    }
  }, [department?.course, uiState.processingAction, refresh]);

  // Auto-complete module when all lessons and assessments are complete
  const isModuleReadyToComplete = useCallback((module) => {
    const moduleId = getModuleId(module);

    const moduleLessons = lessonsByModule[moduleId] || [];
    const completedLessonsInModule = moduleLessons.filter(lesson => isLessonCompleted(lesson)).length;
    const allLessonsComplete = (moduleLessons.length === 0) || (completedLessonsInModule === moduleLessons.length);

    const moduleAssignmentsList = assignmentsByModule[moduleId] || [];
    const allAssignmentsComplete = moduleAssignmentsList.length === 0 || moduleAssignmentsList.every(a => {
      const aid = getAssignmentId(a);
      return aid && submissionsByAssignment[String(aid)];
    });

    const moduleQuizzesList = quizzesByModule[moduleId] || [];
    // When lessons exist: require passing quizzes; when no lessons: require at least one attempt per quiz
    const allQuizzesPassed = moduleQuizzesList.length === 0 || moduleQuizzesList.every(q => {
      const qid = q._id || q.id;
      const quizAttempts = attemptsByQuiz[String(qid)] || [];
      if (quizAttempts.length === 0) return false;
      const bestAttempt = quizAttempts.reduce((best, current) => (current.score > best.score ? current : best), quizAttempts[0]);
      const passingScore = q.passingScore || 70;
      return bestAttempt.score >= passingScore;
    });

    const hasLessons = moduleLessons.length > 0;
    const hasAssessments = (moduleAssignmentsList.length + moduleQuizzesList.length) > 0;

    // If no lessons and no assessments at all, consider module ready to complete automatically
    if (!hasLessons && !hasAssessments) return true;

    // New rule: if there are quizzes, student must PASS (at least once) for each quiz regardless of lessons presence
    const allAssessmentsComplete = allAssignmentsComplete && allQuizzesPassed;

    return allLessonsComplete && allAssessmentsComplete;
  }, [lessonsByModule, assignmentsByModule, submissionsByAssignment, quizzesByModule, attemptsByQuiz, isLessonCompleted, getAssignmentId, getModuleId]);

  useEffect(() => {
    if (!modules || modules.length === 0) return;
    if (uiState.processingAction) return;

    const index = getCurrentModuleIndex();
    if (index >= modules.length) return;

    const module = modules[index];
    if (!isModuleCompleted(module) && isModuleReadyToComplete(module)) {
      handleMarkModuleComplete(module);
    }
  }, [
    modules,
    uiState.processingAction,
    getCurrentModuleIndex,
    isModuleCompleted,
    isModuleReadyToComplete,
    handleMarkModuleComplete
  ]);

  // Load current module content only once per module
  const lastRequestedModuleRef = useRef(null);
  useEffect(() => {
    if (!modules || modules.length === 0) return;

    const currentModule = getCurrentModuleIndex();
    if (currentModule < 0 || currentModule >= modules.length) return;

    const module = modules[currentModule];
    const moduleId = getModuleId(module);
    if (!moduleId) return;

    if (lastRequestedModuleRef.current !== String(moduleId)) {
      lastRequestedModuleRef.current = String(moduleId);
      loadModuleContent(moduleId, department?.course?._id || department?.course?.id, module.lessons);
    }
  }, [modules, department?.course, getCurrentModuleIndex]);

  // Auto-refresh when page becomes visible/focused to sync completion state and attempts/submissions
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible, refresh course data and queries
        refresh();
        if (typeof refetchSubmissions === 'function') refetchSubmissions();
        if (typeof refetchAttempts === 'function') refetchAttempts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also refresh when window gets focus (user returns from quiz/assignment pages)
    const handleFocus = () => {
      refresh();
      if (typeof refetchSubmissions === 'function') refetchSubmissions();
      if (typeof refetchAttempts === 'function') refetchAttempts();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refresh, refetchSubmissions, refetchAttempts]);

  // Load course-level content is handled automatically by RTK Query in useCourseContent hook
  // when allModulesCompleted becomes true. No manual effect needed.

  // Loading state with responsive design optimized for 320px
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 px-0 py-2 xs:px-4 xs:py-4 sm:px-6 sm:py-6">
        <div className="w-full max-w-[300px] sm:max-w-7xl mx-auto space-y-3 xs:space-y-4 sm:space-y-6">
          {/* Header Skeleton */}
          <Card className="overflow-hidden">
            <CardHeader className="space-y-3 xs:space-y-4 p-3 xs:p-4 sm:p-6">
              <div className="flex flex-col gap-3 xs:gap-4">
                <div className="space-y-2 xs:space-y-3">
                  <Skeleton className="h-5 xs:h-6 sm:h-7 w-full max-w-48 xs:max-w-64" />
                  <Skeleton className="h-3 xs:h-4 w-full max-w-32 xs:max-w-48" />
                </div>
                <div className="flex flex-col xs:flex-row gap-2">
                  <Skeleton className="h-7 xs:h-8 w-16 xs:w-20" />
                  <Skeleton className="h-7 xs:h-8 w-14 xs:w-16" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-2 xs:h-3 w-full" />
                <Skeleton className="h-3 xs:h-4 w-20 xs:w-24" />
              </div>
            </CardHeader>
          </Card>

          {/* Module Cards Skeleton */}
          <Card>
            <CardHeader className="p-3 xs:p-4 sm:p-6">
              <Skeleton className="h-4 xs:h-5 sm:h-6 w-28 xs:w-32 sm:w-40" />
              <Skeleton className="h-3 xs:h-4 w-40 xs:w-48 sm:w-60" />
            </CardHeader>
            <CardContent className="space-y-2 xs:space-y-3 sm:space-y-4 p-3 xs:p-4 sm:p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-2 xs:p-4 sm:p-6 border rounded-lg space-y-3 xs:space-y-4">
                  <div className="flex flex-col gap-3 xs:gap-4">
                    <div className="flex items-start gap-2 xs:gap-3 flex-1">
                      <Skeleton className="h-6 w-6 xs:h-8 xs:w-8 rounded-full shrink-0" />
                      <div className="space-y-1 xs:space-y-2 flex-1 min-w-0">
                        <div className="flex flex-col gap-1 xs:gap-2">
                          <Skeleton className="h-3 xs:h-4 w-full max-w-32 xs:max-w-48" />
                          <Skeleton className="h-4 xs:h-5 w-10 xs:w-12" />
                        </div>
                        <Skeleton className="h-2 xs:h-3 w-full max-w-40 xs:max-w-64" />
                        <Skeleton className="h-2 xs:h-3 w-16 xs:w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-7 xs:h-8 sm:h-9 w-full xs:w-20 xs:self-end" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state with responsive design optimized for 320px
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-0 py-2 xs:px-4">
        <div className="w-full max-w-[300px] sm:max-w-md">
          <Card className="shadow-lg border-red-200">
            <CardContent className="p-3 xs:p-6 text-center">
              <div className="mb-4 xs:mb-6">
                <AlertCircle className="h-10 w-10 xs:h-12 xs:w-12 sm:h-16 sm:w-16 text-red-500 mx-auto mb-3 xs:mb-4" />
                <h3 className="text-base xs:text-lg sm:text-xl font-bold text-gray-900 mb-2">Something went wrong</h3>
                <Alert variant="destructive" className="text-left">
                  <AlertDescription className="text-xs xs:text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              </div>
              <Button
                onClick={refresh}
                className="w-full"
                disabled={refreshing}
                size="sm"
              >
                <RefreshCw className={`h-3 w-3 xs:h-4 xs:w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // No department state with responsive design optimized for 320px
  if (!department) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-0 py-2 xs:px-4">
        <div className="w-full max-w-[300px] sm:max-w-md">
          <Card className="shadow-lg">
            <CardContent className="p-4 xs:p-6 sm:p-8 text-center">
              <div className="mb-4 xs:mb-6">
                <BookOpen className="h-10 w-10 xs:h-12 xs:w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-3 xs:mb-4" />
                <h3 className="text-base xs:text-lg sm:text-xl font-bold text-gray-900 mb-2">No Course Assigned</h3>
                <p className="text-xs xs:text-sm sm:text-base text-muted-foreground leading-relaxed">
                  You are not currently enrolled in any course. Please contact your administrator for assistance.
                </p>
              </div>
              <div className="p-3 xs:p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-center gap-2 text-blue-700">
                  <Lightbulb className="h-3 w-3 xs:h-4 xs:w-4" />
                  <p className="text-xs xs:text-sm">
                    Once you're enrolled, your courses and learning materials will appear here.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Check if department is cancelled - prevent access to course content
  if (department?.status === 'CANCELLED') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-0 py-2 xs:px-4">
        <div className="w-full max-w-[300px] sm:max-w-md lg:max-w-lg">
          <Card className="shadow-xl border-red-200 bg-gradient-to-br from-red-50 to-rose-50">
            <CardContent className="p-4 xs:p-6 sm:p-8 text-center space-y-4 xs:space-y-6">
              {/* Cancellation Icon */}
              <div className="mx-auto w-16 h-16 xs:w-20 xs:h-20 sm:w-24 sm:h-24 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-8 w-8 xs:h-10 xs:w-10 sm:h-12 sm:w-12 text-red-600" />
              </div>

              {/* Cancellation Message */}
              <div className="space-y-2 xs:space-y-3">
                <h2 className="text-lg xs:text-xl sm:text-2xl font-bold text-red-800">
                  Department Cancelled
                </h2>
                <p className="text-sm xs:text-base text-red-700 leading-relaxed">
                  Unfortunately, your department <span className="font-semibold">"{department.name}"</span> has been cancelled.
                </p>
              </div>

              {/* Department Info */}
              <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 xs:p-4 border border-red-200">
                <div className="space-y-2 text-sm xs:text-base">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Course:</span>
                    <span className="font-medium text-gray-800">
                      {department.course?.title || department.course?.name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Status:</span>
                    <Badge variant="destructive" className="text-xs">
                      Cancelled
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Cancellation Reason (if available) */}
              {/* Cancellation Reason (if available) */}
              {department.notes && (
                <Alert className="text-left bg-orange-50 border-orange-200">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-sm text-orange-800">
                    <strong>Reason:</strong> {department.notes}
                  </AlertDescription>
                </Alert>
              )}

              {/* Contact Information */}
              <div className="space-y-3 xs:space-y-4">
                <div className="bg-blue-50 rounded-lg p-3 xs:p-4 border border-blue-200">
                  <div className="flex items-start gap-2 xs:gap-3">
                    <div className="p-1 bg-blue-100 rounded-full shrink-0">
                      <Lightbulb className="h-3 w-3 xs:h-4 xs:w-4 text-blue-600" />
                    </div>
                    <div className="text-left space-y-1">
                      <p className="text-xs xs:text-sm font-medium text-blue-800">
                        Need Help?
                      </p>
                      <p className="text-xs text-blue-700">
                        Please contact your administrator or instructor for more information about alternative learning options.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col xs:flex-row gap-2 xs:gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/student/dashboard')}
                    className="flex items-center gap-2 text-xs xs:text-sm"
                  >
                    <ArrowLeft className="h-3 w-3 xs:h-4 xs:w-4" />
                    Back to Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = 'mailto:support@your-platform.com?subject=Cancelled Department Inquiry'}
                    className="flex items-center gap-2 text-xs xs:text-sm"
                  >
                    <ExternalLink className="h-3 w-3 xs:h-4 xs:w-4" />
                    Contact Support
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const completedCount = getCompletedModulesCount();
  const progress = calculateProgress();
  const currentModuleIndex = getCurrentModuleIndex();
  const currentModule = currentModuleIndex < modules.length ? modules[currentModuleIndex] : null;


  // Filter out module-level items from course-level assessments
  const courseLevelQuizzes = (courseQuizzes || []).filter(q => !q?.module && !q?.moduleId && !(q?.module && (q.module._id || q.module.id)));
  const courseLevelAssignments = (courseAssignments || []).filter(a => !a?.module && !a?.moduleId && !(a?.module && (a.module._id || a.module.id)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 overflow-x-hidden">
      <div className="w-full max-w-[300px] sm:max-w-7xl mx-auto px-0 xs:px-4 sm:px-6 py-2 xs:py-4 sm:py-6 space-y-3 xs:space-y-4 sm:space-y-6">
        {/* Level Upgrade Message */}
        {uiState.levelUpgradeMessage && (
          <Alert className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-lg">
            <Trophy className="h-4 w-4 xs:h-5 xs:w-5 text-green-600" />
            <AlertDescription className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 xs:gap-3">
              <div className="flex items-center gap-2 text-green-800 font-medium text-xs xs:text-sm sm:text-base">
                <Star className="h-3 w-3 xs:h-4 xs:w-4" />
                <span>{uiState.levelUpgradeMessage}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUiState(prev => ({ ...prev, levelUpgradeMessage: null }))}
                className="text-green-600 hover:text-green-700 hover:bg-green-100 self-end xs:self-auto p-1 xs:p-2"
              >
                <AlertCircle className="h-3 w-3 xs:h-4 xs:w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Enhanced Course Header */}
        <Card className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-blue-300 shadow-xl">
          <CardHeader className="pb-3 xs:pb-4 sm:pb-6 p-3 xs:p-4 sm:p-6">
            <div className="flex flex-col gap-3 xs:gap-4 sm:gap-6">
              {/* Header Info */}
              <div className="flex flex-col gap-3 xs:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col gap-2 xs:gap-3 mb-2 xs:mb-3">
                    <CardTitle className="flex items-start xs:items-center gap-2 xs:gap-3 text-sm xs:text-lg sm:text-xl lg:text-2xl min-w-0">
                      <div className="p-1 xs:p-2 sm:p-3 bg-blue-100 rounded-lg shrink-0">
                        <BookOpen className="h-4 w-4 xs:h-5 xs:w-5 sm:h-6 sm:w-6 text-blue-600" />
                      </div>
                      <span className="truncate leading-tight xs:leading-normal">{department.course?.title || department.course?.name || "Course"}</span>
                    </CardTitle>
                    <div className="ml-0 xs:ml-auto">
                      {getLevelBadge(currentLevel)}
                    </div>
                  </div>
                  <CardDescription className="text-xs xs:text-sm sm:text-base text-gray-700 leading-relaxed break-words">
                    {department.course?.description || "Complete the modules below to finish the course"}
                  </CardDescription>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-row gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refresh}
                    disabled={refreshing}
                    className="flex items-center gap-1 xs:gap-2 bg-white/80 hover:bg-white border-blue-200 hover:border-blue-300 text-blue-700 text-xs xs:text-sm px-2 xs:px-3 min-h-[44px]"
                  >
                    <RefreshCw className={`h-3 w-3 xs:h-4 xs:w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    <span className="hidden xs:inline">Refresh</span>
                  </Button>
                  <Badge
                    variant="outline"
                    className={`text-xs px-2 py-1 font-medium ${STATUS_CONFIG[department.status]?.color || 'bg-gray-100 text-gray-800'}`}
                  >
                    {STATUS_CONFIG[department.status]?.name || department.status}
                  </Badge>
                </div>
              </div>

              {/* Enhanced Progress Section */}
              <div className="space-y-3 xs:space-y-4">
                <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-2">
                  <span className="text-xs xs:text-sm sm:text-base font-semibold text-gray-900">Course Progress</span>
                  <div className="flex flex-col xs:flex-row items-start xs:items-center gap-1 xs:gap-2">
                    <span className="text-xs bg-white/70 px-2 py-1 rounded-full text-gray-600">
                      {completedCount}/{modules.length} modules
                    </span>
                    <div className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                      {progress}%
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Progress value={progress} className="h-2 xs:h-3 sm:h-4 bg-blue-100" />
                  <div className="grid grid-cols-2 gap-1 xs:gap-2 text-xs">
                    <div className="flex items-center gap-1 text-gray-600">
                      <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                      <span className="truncate">Done: {completedCount}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <BookOpen className="h-3 w-3 text-blue-500 shrink-0" />
                      <span className="truncate">Total: {modules.length}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <Trophy className="h-3 w-3 text-yellow-500 shrink-0" />
                      <span className="truncate">{currentLevel}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <TrendingUp className="h-3 w-3 text-purple-500 shrink-0" />
                      <span className="truncate">{progress}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Enhanced Completion Banner */}
        {allModulesCompleted && (
          <Alert className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border-green-300 shadow-xl">
            <Trophy className="h-4 w-4 xs:h-5 xs:w-5 sm:h-6 sm:w-6 text-green-600" />
            <AlertDescription>
              <div className="flex flex-col xs:flex-row xs:items-start xs:justify-between gap-3 xs:gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-green-800 font-bold text-sm xs:text-lg sm:text-xl mb-2">
                    <GraduationCap className="h-4 w-4 xs:h-5 xs:w-5" />
                    <span>Congratulations! Course Completed!</span>
                  </div>
                  <p className="text-green-700 text-xs xs:text-sm sm:text-base leading-relaxed break-words">
                    Outstanding achievement! You have successfully finished all modules. Your dedication to learning is truly commendable.
                  </p>
                  <div className="mt-2 xs:mt-3 flex flex-wrap gap-1 xs:gap-2">
                    <Badge className="bg-green-600 text-white px-2 xs:px-3 py-1 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      All Complete
                    </Badge>
                    <Badge className="bg-yellow-500 text-white px-2 xs:px-3 py-1 text-xs">
                      <Award className="h-3 w-3 mr-1" />
                      Achievement
                    </Badge>
                  </div>
                </div>
                <div className="shrink-0 self-center xs:self-start">
                  <div className="text-center p-2 xs:p-4 bg-green-100 rounded-lg border border-green-200">
                    <Trophy className="h-6 w-6 xs:h-8 xs:w-8 sm:h-10 sm:w-10 text-yellow-500 mx-auto mb-1 xs:mb-2" />
                    <Badge className="bg-green-600 text-white text-xs">
                      Complete
                    </Badge>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Enhanced Course-Level Assessments Section - 320px optimized */}
        {allModulesCompleted && courseContentLoaded && (courseLevelQuizzes.length > 0 || courseLevelAssignments.length > 0) && (
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 shadow-xl">
            <CardHeader className="pb-3 xs:pb-4 sm:pb-6 p-3 xs:p-4 sm:p-6">
              <div className="flex flex-col gap-3">
                <div className="flex-1">
                  <CardTitle className="flex flex-col xs:flex-row xs:items-center gap-2 xs:gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 xs:p-2 bg-purple-100 rounded-lg">
                        <Trophy className="h-3 w-3 xs:h-4 xs:w-4 sm:h-5 sm:w-5 text-purple-600" />
                      </div>
                      <span className="text-sm xs:text-base sm:text-lg lg:text-xl">Final Assessments</span>
                    </div>
                    <Badge className="bg-purple-500 text-white px-2 xs:px-3 py-1 text-xs self-start xs:self-auto">
                      {courseLevelQuizzes.length + courseLevelAssignments.length} tests
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs xs:text-sm sm:text-base leading-relaxed flex items-center gap-2 break-words">
                    <Target className="h-3 w-3 xs:h-4 xs:w-4 text-purple-600 shrink-0" />
                    <span>Congratulations on completing all modules! You can now access the final course assessments.</span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 xs:space-y-6 p-3 xs:p-4 sm:p-6">
              {/* Enhanced Course Quizzes */}
              {courseLevelQuizzes.length > 0 && (
                <div>
                  <h3 className="break-all font-bold mb-3 xs:mb-4 flex items-center gap-2 text-purple-800 text-xs xs:text-sm sm:text-base">
                    <Award className="h-3 w-3 xs:h-4 xs:w-4 sm:h-5 sm:w-5" />
                    Final Course Quizzes ({courseLevelQuizzes.length})
                  </h3>
                  <div className="grid gap-3 xs:gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2">
                    {courseLevelQuizzes.map((quiz, index) => (
                      <Card key={index} className="border-purple-200 hover:shadow-lg hover:border-purple-300 transition-all duration-300">
                        <CardHeader className="pb-2 xs:pb-3 p-3 xs:p-4 sm:p-6">
                          <CardTitle className="text-xs xs:text-sm sm:text-base lg:text-lg flex flex-col gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Trophy className="h-3 w-3 xs:h-4 xs:w-4 sm:h-5 sm:w-5 text-purple-600 shrink-0" />
                              <span className="truncate break-words text-xs xs:text-sm sm:text-base min-w-0">{quiz.title || 'Final Course Quiz'}</span>
                            </div>
                            <Badge className="bg-purple-600 text-white text-xs px-2 py-1 self-start">
                              COURSE LEVEL
                            </Badge>
                          </CardTitle>
                          {quiz.description && (
                            <CardDescription className="text-xs sm:text-sm leading-relaxed break-words">
                              {quiz.description}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="p-3 xs:p-4 sm:p-6">
                          <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 xs:gap-3 sm:gap-4 text-xs mb-3 xs:mb-4">
                            <div className="flex items-center gap-1">
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate">Q: {quiz.questions?.length || 0}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <BarChart3 className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate">Pass: {quiz.passingScore || 70}%</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate">{quiz.timeLimit || 60}min</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <RefreshCw className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate">{quiz.attemptsAllowed || 1} tries</span>
                            </div>
                          </div>
                          <Button
                            className="w-full bg-purple-600 hover:bg-purple-700 text-xs xs:text-sm min-h-[44px]"
                            onClick={() => handleStartQuiz(quiz)}
                            size="sm"
                          >
                            <Trophy className="h-3 w-3 mr-2" />
                            <span className="hidden xs:inline">Start Final Quiz</span>
                            <span className="xs:hidden">Start Quiz</span>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Enhanced Course Assignments */}
              {courseLevelAssignments.length > 0 && (
                <div>
                  <h3 className="font-bold mb-3 xs:mb-4 flex items-center gap-2 text-purple-800 text-xs xs:text-sm sm:text-base">
                    <FileText className="h-3 w-3 xs:h-4 xs:w-4 sm:h-5 sm:w-5" />
                    Final Course Assignments ({courseLevelAssignments.length})
                  </h3>
                  <div className="grid gap-3 xs:gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2">
                    {courseLevelAssignments.map((assignment, index) => (
                      <Card key={index} className="border-purple-200 hover:shadow-lg hover:border-purple-300 transition-all duration-300">
                        <CardHeader className="pb-2 xs:pb-3 p-3 xs:p-4 sm:p-6">
                          <CardTitle className="text-xs xs:text-sm sm:text-base lg:text-lg flex flex-col gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <FileText className="h-3 w-3 xs:h-4 xs:w-4 sm:h-5 sm:w-5 text-purple-600 shrink-0" />
                              <span className="truncate break-words text-xs xs:text-sm sm:text-base min-w-0">{assignment.title || 'Final Assignment'}</span>
                            </div>
                            <Badge className="bg-purple-600 text-white text-xs px-2 py-1 self-start">
                              COURSE LEVEL
                            </Badge>
                          </CardTitle>
                          {assignment.description && (
                            <CardDescription className="text-xs sm:text-sm leading-relaxed break-words">
                              {assignment.description}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="p-3 xs:p-4 sm:p-6">
                          <div className="grid grid-cols-1 gap-2 xs:gap-3 text-xs mb-3 xs:mb-4">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate">
                                Due: {assignment.dueDate
                                  ? new Date(assignment.dueDate).toLocaleDateString()
                                  : 'No deadline'
                                }
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Award className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate">Max: {assignment.maxScore || 100} pts</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button variant="outline" className="w-full text-xs min-h-[44px]">
                              <Eye className="h-3 w-3 mr-2" />
                              <span className="hidden xs:inline">View Details</span>
                              <span className="xs:hidden">View</span>
                            </Button>
                            <Button className="w-full bg-purple-600 hover:bg-purple-700 text-xs min-h-[44px]">
                              <FileText className="h-3 w-3 mr-2" />
                              <span className="hidden xs:inline">Submit Work</span>
                              <span className="xs:hidden">Submit</span>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Enhanced Modules Section - 320px optimized */}
        <Card className="shadow-lg">
          <CardHeader className="pb-3 xs:pb-4 sm:pb-6 p-3 xs:p-4 sm:p-6">
            <div className="flex flex-col gap-3">
              <div className="flex-1">
                <CardTitle className="flex flex-col xs:flex-row xs:items-center gap-2 xs:gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1 xs:p-2 bg-blue-100 rounded-lg">
                      <ListChecks className="h-3 w-3 xs:h-4 xs:w-4 sm:h-5 sm:w-5 text-blue-600" />
                    </div>
                    <span className="text-sm xs:text-base sm:text-lg lg:text-xl">Course Modules</span>
                  </div>
                  <Badge className="bg-blue-500 text-white px-2 xs:px-3 py-1 text-xs self-start xs:self-auto">
                    {modules.length} modules
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs xs:text-sm sm:text-base leading-relaxed flex items-start gap-2 break-words">
                  <BookMarked className="h-3 w-3 xs:h-4 xs:w-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Complete modules in strict sequence to unlock the next content. You must finish all lessons (and assessments if any) in a module before proceeding to the next one.</span>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 xs:space-y-4 sm:space-y-6 p-3 xs:p-4 sm:p-6">
            {modules.length === 0 ? (
              <div className="text-center py-6 xs:py-8 sm:py-12">
                <ListChecks className="h-10 w-10 xs:h-12 xs:w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-3 xs:mb-4" />
                <p className="text-xs xs:text-sm sm:text-base text-muted-foreground">No modules available for this course yet.</p>
              </div>
            ) : (
              modules.map((module, index) => {
                const moduleId = getModuleId(module);
                const isCompleted = isModuleCompleted(module);
                const isAccessible = isModuleAccessible(index);
                const isCurrent = isAccessible && !isCompleted;
                const isLocked = !isAccessible;
                const isActive = uiState.activeModule &&
                  String(getModuleId(uiState.activeModule)) === String(moduleId);

                // Check if module is level-locked specifically
                const isLevelLocked = levelLockEnabled && lockedLevel && module.level &&
                  parseInt(module.level.replace('L', '')) > parseInt(currentLevel.replace('L', ''));

                const moduleLessons = lessonsByModule[moduleId] || [];
                const completedLessonsInModule = moduleLessons.filter(lesson =>
                  isLessonCompleted(lesson)
                ).length;

                return (
                  <ModuleAssessmentProvider
                    key={moduleId || index}
                    moduleId={moduleId}
                    courseId={department?.course?._id || department?.course?.id}
                    onAssessmentsLoaded={handleModuleAssessmentsLoaded}
                  >
                    <div
                      className={`group relative p-2 xs:p-4 sm:p-6 rounded-xl border-2 transition-all duration-300 hover:shadow-lg ${isCompleted
                        ? "bg-gradient-to-br from-green-50 to-green-100 border-green-300 shadow-sm"
                        : isCurrent
                          ? "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 shadow-md ring-2 ring-blue-200"
                          : isLocked
                            ? "bg-gray-50 border-gray-200 opacity-60"
                            : "bg-white border-gray-200 hover:border-gray-300"
                        }`}
                    >
                      <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3 xs:gap-4">
                        <div className="flex items-start gap-2 xs:gap-3 sm:gap-4 flex-1 min-w-0">
                          {/* Module Number/Status Indicator */}
                          <div className="flex flex-col items-center shrink-0">
                            <div className={`w-6 h-6 xs:w-8 xs:h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs xs:text-sm font-medium ${isCompleted
                              ? "bg-green-100 text-green-700"
                              : isCurrent
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-500"
                              }`}>
                              {isCompleted ? (
                                <CheckCircle2 className="h-3 w-3 xs:h-4 xs:w-4 sm:h-5 sm:w-5" />
                              ) : (
                                <span className="text-xs font-bold">{index + 1}</span>
                              )}
                            </div>
                            {index < modules.length - 1 && (
                              <div className={`w-0.5 h-4 xs:h-6 sm:h-8 mt-1 hidden xs:block ${isCompleted ? "bg-green-200" : "bg-gray-200"
                                }`} />
                            )}
                          </div>

                          {/* Module Content */}
                          <div className="flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                              <h3 className={`font-semibold line-clamp-1 text-sm sm:text-base lg:text-lg  ${isCompleted ? "text-green-800" :
                                isCurrent ? "text-blue-800" :
                                  "text-gray-700"
                                }`}>
                                {module.title || `Module ${index + 1}`}
                              </h3>

                              {/* Badges Container */}
                              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                {/* Module level badge */}
                                {module.level && (
                                  <div className="flex items-center">
                                    {getLevelBadge(module.level)}
                                  </div>
                                )}

                                {isCurrent && (
                                  <Badge variant="default" className="text-xs px-2 py-1">
                                    Current
                                  </Badge>
                                )}
                                {isCompleted && (
                                  <Badge variant="outline" className="text-xs bg-green-100 text-green-800 px-2 py-1">
                                    Completed
                                  </Badge>
                                )}
                                {isLevelLocked && (
                                  <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300 px-2 py-1">
                                    <Lock className="h-3 w-3 mr-1" />
                                    <span className="hidden sm:inline">Level Locked</span>
                                    <span className="sm:hidden">Locked</span>
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground mb-3 leading-relaxed line-clamp-2 break-words">
                              {module.description || "No description available"}
                            </p>

                            {/* Module Meta */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                <span>{completedLessonsInModule} of {moduleLessons.length} lessons</span>
                              </span>
                              {module.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-blue-500" />
                                  <span>{module.duration}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <Button
                            size="sm"
                            onClick={() => handleModuleClick(module, index)}
                            disabled={isLocked || loadingStates[moduleId]}
                            className={`w-full sm:w-auto text-xs sm:text-sm min-h-[44px] ${isCompleted
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : isCurrent
                                ? "shadow-md"
                                : ""
                              }`}
                          >
                            {loadingStates[moduleId] ? (
                              <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                            ) : isCompleted ? (
                              <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            ) : isCurrent ? (
                              <PlayCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            ) : (
                              <Lock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            )}
                            <span>
                              {isCompleted ? "Review" :
                                isCurrent ? (isActive ? "Hide" : "Start") :
                                  isLevelLocked ? (
                                    <>
                                      <span className="hidden sm:inline">Need {module.level}</span>
                                      <span className="sm:hidden">Need {module.level}</span>
                                    </>
                                  ) :
                                    "Locked"}
                            </span>
                            <ChevronRight className={`h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2 transition-transform ${isActive ? 'rotate-90' : ''
                              }`} />
                          </Button>
                        </div>
                      </div>

                      {/* Enhanced Module Content Panel */}
                      {isActive && (
                        <div className="mt-4 rounded-lg border bg-white shadow-sm">
                          <Tabs value={uiState.activeTab} onValueChange={(tab) =>
                            setUiState(prev => ({ ...prev, activeTab: tab }))
                          }>
                            <div className="border-b">
                              <TabsList className="flex w-full overflow-x-auto bg-transparent h-auto p-0 gap-1">
                                <TabsTrigger value="lessons" className="flex items-center rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent py-2 sm:py-3 text-xs sm:text-sm min-w-[140px] sm:min-w-0">
                                  <BookOpen className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                  <span className="hidden sm:inline">Lessons ({moduleLessons.length})</span>
                                  <span className="sm:hidden">Lessons</span>
                                </TabsTrigger>
                                <TabsTrigger value="assessments" className="flex items-center rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent py-2 sm:py-3 text-xs sm:text-sm min-w-[140px] sm:min-w-0">
                                  <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                  <span className="hidden sm:inline">Assessments ({(quizzesByModule[moduleId]?.length || 0) + (assignmentsByModule[moduleId]?.length || 0)})</span>
                                  <span className="sm:hidden">Tests</span>
                                </TabsTrigger>
                              </TabsList>
                            </div>

                            {/* Enhanced Lessons Tab */}
                            <TabsContent value="lessons" className="p-3 sm:p-4 lg:p-6">
                              <div className="space-y-3 sm:space-y-4">
                                {moduleLessons.length === 0 ? (
                                  <div className="text-center py-6 sm:py-8">
                                    <BookOpen className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-2 sm:mb-4" />
                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                      No lessons found for this module.
                                    </p>
                                  </div>
                                ) : (
                                  moduleLessons.map((lesson, lessonIndex) => {
                                    const isLessonDone = isLessonCompleted(lesson);
                                    const currentLessonIndex = moduleLessons.findIndex(l =>
                                      !isLessonCompleted(l)
                                    );
                                    // Enforce strictly sequential lesson progression
                                    // A lesson is locked if it is not yet completed AND
                                    // it is not the immediate next lesson to complete.
                                    // Completed lessons should remain accessible for review.
                                    const isLessonLocked = !isLessonDone &&
                                      currentLessonIndex !== -1 &&
                                      lessonIndex !== currentLessonIndex;

                                    return (
                                      <div
                                        key={getLessonId(lesson) || lessonIndex}
                                        className={`flex flex-col sm:flex-row items-start justify-between rounded-lg border p-3 sm:p-4 gap-3 sm:gap-0 ${isLessonLocked
                                          ? 'opacity-60 bg-gray-50'
                                          : isLessonDone
                                            ? 'bg-green-50 border-green-200'
                                            : 'hover:bg-blue-50 border-blue-200 ring-2 ring-blue-100'
                                          }`}
                                      >
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium shrink-0 ${isLessonDone
                                            ? "bg-green-100 text-green-700"
                                            : isLessonLocked
                                              ? "bg-gray-100 text-gray-500"
                                              : "bg-blue-100 text-blue-600"
                                            }`}>
                                            {isLessonDone ? (
                                              <CheckCircle2 className="h-4 w-4" />
                                            ) : isLessonLocked ? (
                                              <Lock className="h-4 w-4" />
                                            ) : (
                                              lessonIndex + 1
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                                              <h4 className="text-sm sm:text-base font-semibold break-words max-w-full">
                                                {lesson.title || `Lesson ${lessonIndex + 1}`}
                                              </h4>
                                              {isLessonDone && (
                                                <Badge variant="outline" className="text-xs bg-green-100 text-green-700 self-start sm:self-auto">
                                                  Completed
                                                </Badge>
                                              )}
                                            </div>
                                            {lesson.description && (
                                              <p className="text-xs sm:text-sm text-muted-foreground mb-2 leading-relaxed line-clamp-2 break-words">
                                                {lesson.description}
                                              </p>
                                            )}
                                            <div className="flex items-center gap-2">
                                              <Badge variant="outline" className="text-xs px-2 py-1">
                                                <Clock className="h-3 w-3 mr-1" />
                                                {lesson.duration || "5 min"}
                                              </Badge>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 w-full sm:w-auto sm:shrink-0">
                                          {!isLessonLocked && (
                                            <Button
                                              size="sm"
                                              onClick={() => navigate(`/student/lesson/${getLessonId(lesson)}`)}
                                              className={`w-full sm:w-auto text-xs sm:text-sm min-h-[44px] ${isLessonDone ?
                                                "bg-green-100 text-green-700 hover:bg-green-200" :
                                                "bg-blue-600 hover:bg-blue-700 text-white"
                                                }`}
                                            >
                                              {isLessonDone ? (
                                                <>
                                                  <Eye className="h-3 w-3 mr-1 sm:mr-2" />
                                                  <span>Review</span>
                                                </>
                                              ) : (
                                                <>
                                                  <PlayCircle className="h-3 w-3 mr-1 sm:mr-2" />
                                                  <span className="hidden sm:inline">Start Lesson</span>
                                                  <span className="sm:hidden">Start</span>
                                                </>
                                              )}
                                            </Button>
                                          )}
                                          {isLessonLocked && (
                                            <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600 px-2 py-1 w-full sm:w-auto justify-center">
                                              <Lock className="h-3 w-3 mr-1" />
                                              Locked
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}

                                {/* Module Complete Button */}
                                {(() => {
                                  const moduleAssignments = assignmentsByModule[moduleId] || [];
                                  const moduleQuizzes = quizzesByModule[moduleId] || [];
                                  const allLessonsComplete = (moduleLessons.length === 0) || (completedLessonsInModule === moduleLessons.length);
                                  const totalAssessments = moduleQuizzes.length + moduleAssignments.length;

                                  // Check if all assignments in this module are submitted
                                  const allAssignmentsComplete = moduleAssignments.length === 0 || moduleAssignments.every(a => {
                                    const aid = getAssignmentId(a);
                                    return aid && submissionsByAssignment[String(aid)];
                                  });

                                  // New rule: quizzes must be PASSED (at least once) to complete module, regardless of lessons presence
                                  const allQuizzesPassed = moduleQuizzes.length === 0 || moduleQuizzes.every(q => {
                                    const qid = q._id || q.id;
                                    const quizAttempts = attemptsByQuiz[String(qid)] || [];
                                    if (quizAttempts.length === 0) return false;
                                    const bestAttempt = quizAttempts.reduce((best, current) => (current.score > best.score ? current : best), quizAttempts[0]);
                                    const passingScore = q.passingScore || 70;
                                    return bestAttempt.score >= passingScore;
                                  });

                                  const hasLessons = moduleLessons.length > 0;
                                  const allAssessmentsComplete = allAssignmentsComplete && allQuizzesPassed;


                                  if (!isCompleted && isAccessible && allLessonsComplete) {
                                    return (
                                      <div className="pt-4 border-t mt-4">
                                        {totalAssessments > 0 ? (
                                          allAssessmentsComplete ? (
                                            <div>
                                              <Button
                                                onClick={() => handleMarkModuleComplete(module)}
                                                className="w-full bg-green-600 hover:bg-green-700 min-h-[44px]"
                                                size="lg"
                                                disabled={uiState.processingAction === `module-${moduleId}`}
                                              >
                                                {uiState.processingAction === `module-${moduleId}` ? (
                                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                                ) : (
                                                  <Trophy className="h-4 w-4 mr-2" />
                                                )}
                                                Complete Module
                                              </Button>
                                              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-2">
                                                <Zap className="h-3 w-3 text-green-500" />
                                                <span>All {hasLessons ? 'lessons and ' : ''}assessments completed!</span>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="text-center">
                                              <div className="flex items-start gap-2 text-sm text-muted-foreground mb-4">
                                                <BookMarked className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                                                <span>{hasLessons ? 'All lessons completed! Now complete the assessments in the "Assessments" tab to finish this module.' : 'This module has no lessons. Please complete the assessments in the "Assessments" tab to finish this module.'}</span>
                                              </div>
                                              <Button
                                                onClick={() => setUiState(prev => ({ ...prev, activeTab: "assessments" }))}
                                                variant="outline"
                                                className="w-full"
                                                size="lg"
                                              >
                                                <BarChart3 className="h-4 w-4 mr-2" />
                                                Go to Assessments
                                              </Button>
                                              <div className="mt-3 text-xs text-muted-foreground">
                                                <p>Progress: {moduleAssignments.filter(a => {
                                                  const aid = getAssignmentId(a);
                                                  return aid && submissionsByAssignment[String(aid)];
                                                }).length} of {moduleAssignments.length} assignments submitted</p>
                                              </div>
                                            </div>
                                          )
                                        ) : (
                                          <div>
                                            <Button
                                              onClick={() => handleMarkModuleComplete(module)}
                                              className="w-full bg-green-600 hover:bg-green-700 min-h-[44px]"
                                              size="lg"
                                              disabled={uiState.processingAction === `module-${moduleId}`}
                                            >
                                              {uiState.processingAction === `module-${moduleId}` ? (
                                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                              ) : (
                                                <Trophy className="h-4 w-4 mr-2" />
                                              )}
                                              Complete Module
                                            </Button>
                                            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-2">
                                              <Zap className="h-3 w-3 text-green-500" />
                                              <span>{hasLessons ? 'All lessons completed! ' : ''}No assessments required for this module.</span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </TabsContent>


                            {/* Assessments Tab - 320px optimized */}
                            <TabsContent value="assessments" className="p-2 xs:p-4">
                              <div className="space-y-4">
                                {/* Assessment access control */}
                                {moduleLessons.length > 0 && (
                                  <div className={`rounded-lg p-3 xs:p-4 mb-3 xs:mb-4 ${completedLessonsInModule === moduleLessons.length
                                    ? 'bg-green-50 border border-green-200'
                                    : 'bg-amber-50 border border-amber-200'
                                    }`}>
                                    <div className="flex items-start gap-2 xs:gap-3">
                                      {completedLessonsInModule === moduleLessons.length ? (
                                        <Trophy className="h-4 w-4 xs:h-5 xs:w-5 text-green-600 mt-0.5" />
                                      ) : (
                                        <Lock className="h-4 w-4 xs:h-5 xs:w-5 text-amber-600 mt-0.5" />
                                      )}
                                      <div>
                                        <div className={`flex items-center gap-2 font-semibold mb-1 ${completedLessonsInModule === moduleLessons.length
                                          ? 'text-green-800'
                                          : 'text-amber-800'
                                          }`}>
                                          {completedLessonsInModule === moduleLessons.length ? (
                                            <>
                                              <Zap className="h-4 w-4 text-green-600" />
                                              <span>Assessments Unlocked!</span>
                                            </>
                                          ) : (
                                            <>
                                              <Lock className="h-4 w-4 text-amber-600" />
                                              <span>Complete All Lessons First</span>
                                            </>
                                          )}
                                        </div>
                                        <p className={`text-xs xs:text-sm leading-relaxed ${completedLessonsInModule === moduleLessons.length
                                          ? 'text-green-700'
                                          : 'text-amber-700'
                                          }`}>
                                          {completedLessonsInModule === moduleLessons.length
                                            ? 'Great job completing all lessons! You can now access the assessments below. Complete all assessments to finish this module.'
                                            : `You need to complete all ${moduleLessons.length} lessons in this module before you can access assessments. Progress: ${completedLessonsInModule} of ${moduleLessons.length} lessons completed.`
                                          }
                                        </p>
                                        {completedLessonsInModule < moduleLessons.length && (
                                          <div className="mt-3">
                                            <div className="w-full bg-amber-200 rounded-full h-2">
                                              <div
                                                className="bg-amber-600 h-2 rounded-full transition-all duration-500"
                                                style={{
                                                  width: `${moduleLessons.length > 0 ? (completedLessonsInModule / moduleLessons.length) * 100 : 0}%`
                                                }}
                                              ></div>
                                            </div>
                                            <p className="text-xs text-amber-600 mt-1">
                                              {Math.round((completedLessonsInModule / moduleLessons.length) * 100)}% complete
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Module Quizzes Component */}
                                <StudentModuleQuizzes
                                  quizzes={quizzesByModule[moduleId] || []}
                                  attempts={attemptsByQuiz}
                                  isUnlocked={(moduleLessons.length === 0) || (completedLessonsInModule === moduleLessons.length)}
                                  onStart={handleStartQuiz}
                                  extraGrantedQuizIds={extraGrantedQuizIds}
                                  rejectedQuizIds={rejectedQuizIds}
                                />

                                {/* Module Assignments Component */}
                                <StudentModuleAssignments
                                  assignments={assignmentsByModule[moduleId] || []}
                                  submissions={submissionsByAssignment}
                                  isUnlocked={(moduleLessons.length === 0) || (completedLessonsInModule === moduleLessons.length)}
                                  onViewDetails={handleAssignmentViewDetails}
                                  onSubmit={handleAssignmentSubmit}
                                />

                                {/* No Assessments */}
                                {(!quizzesByModule[moduleId] || quizzesByModule[moduleId].length === 0) &&
                                  (!assignmentsByModule[moduleId] || assignmentsByModule[moduleId].length === 0) && (
                                    <div className="text-center py-6 xs:py-8">
                                      <BarChart3 className="h-6 w-6 xs:h-8 xs:w-8 text-muted-foreground mx-auto mb-2" />
                                      <p className="text-xs xs:text-sm text-muted-foreground">
                                        No assessments available for this module.
                                      </p>
                                    </div>
                                  )}
                              </div>
                            </TabsContent>
                          </Tabs>
                        </div>
                      )}

                      {/* Module Resources Component - 320px optimized */}
                      <div className="mt-3 xs:mt-4">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                          <StudentModuleResources
                            moduleId={moduleId}
                            resources={resourcesByModule[moduleId] || []}
                            isModuleCompleted={isCompleted}
                            completedLessons={completedLessonsInModule}
                            totalLessons={moduleLessons.length}
                            className="p-2 xs:p-4"
                          />
                        </div>
                      </div>
                    </div>
                  </ModuleAssessmentProvider>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Course-Level Assessments (appear after all modules completed) */}
        {allModulesCompleted && (courseLevelQuizzes.length > 0 || courseLevelAssignments.length > 0) && (
          <Card className="border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50">
            <CardHeader className="bg-gradient-to-r from-yellow-100 to-amber-100">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-600" />
                Final Course Assessments
              </CardTitle>
              <CardDescription>
                🎉 Congratulations on completing all modules! Complete these final assessments to finish the course.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {courseLevelQuizzes.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold mb-2">Final Quizzes</h3>
                  <StudentModuleQuizzes
                    quizzes={courseLevelQuizzes}
                    attempts={attemptsByQuiz}
                    isUnlocked={true}
                    onStart={handleStartQuiz}
                    extraGrantedQuizIds={extraGrantedQuizIds}
                    rejectedQuizIds={rejectedQuizIds}
                  />
                </div>
              )}

              {courseLevelAssignments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Final Assignments</h3>
                  <StudentModuleAssignments
                    assignments={courseLevelAssignments}
                    submissions={submissionsByAssignment}
                    isUnlocked={true}
                    onViewDetails={handleAssignmentViewDetails}
                    onSubmit={handleAssignmentSubmit}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Course Resources Component */}
        <StudentCourseResources
          resources={courseResources}
          courseTitle={department?.course?.title || department?.course?.name}
        />

        {/* Assignment Modals */}
        <AssignmentDetailsModal
          assignment={assignmentModals.detailsModal.assignment}
          submission={assignmentModals.detailsModal.submission}
          isOpen={assignmentModals.detailsModal.isOpen}
          onClose={handleCloseDetailsModal}
          onSubmit={handleShowSubmissionFromDetails}
        />

        <AssignmentSubmissionModal
          assignment={assignmentModals.submissionModal.assignment}
          submission={assignmentModals.submissionModal.submission}
          isOpen={assignmentModals.submissionModal.isOpen}
          onClose={handleCloseSubmissionModal}
          onSuccess={handleSubmissionSuccess}
        />
      </div>
    </div>
  );
};

export default DepartmentCourse;
