import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Video,
  FileText,
  FileImage,
  ExternalLink,
  Eye,
  Play,
  BookOpen,
  Trophy,
  ScrollText,
  RefreshCw,
  Target,
  AlertCircle,
  Award,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useGetResourcesByLessonQuery } from "@/Redux/AllApi/resourceApi";
import axiosInstance from "@/Helper/axiosInstance";
import SlideRender from "@/components/common/SlideRender";

const LessonDetail = () => {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const scrollContainerRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [hasReachedBottom, setHasReachedBottom] = useState(false);
  const [completingLesson, setCompletingLesson] = useState(false);
  const [courseData, setCourseData] = useState(null);

  // Fetch lesson resources
  const {
    data: resourcesData,
    isLoading: resourcesLoading,
    error: resourcesError,
  } = useGetResourcesByLessonQuery(lessonId, {
    skip: !lessonId,
  });


  const resources = resourcesData?.data || [];

  // Lesson and course data state
  const [lessonModuleId, setLessonModuleId] = useState(null);
  const [lessonDataState, setLessonDataState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch lesson details and course data
  useEffect(() => {
    const fetchLessonData = async () => {
      if (!lessonId) return;
      try {
        setLoading(true);
        setError(null);

        // 1) Get course content (for courseId and completion status)
        const response = await axiosInstance.get('/api/departments/me/course-content');
        const courseData = response?.data?.data;
        if (!courseData) throw new Error('Course not found');

        // Structure normalized: courseData IS the course
        const data = {
          course: courseData,
          progress: courseData.progress || {}
        };
        setCourseData(data);

        const progress = data.progress;
        const completedLessons = progress.completedLessons || [];
        const isLessonCompleted = completedLessons.some(lesson => String(lesson.lessonId || lesson._id || lesson) === String(lessonId));
        setIsCompleted(isLessonCompleted);

        // 2) Try direct lesson fetch (new API)
        try {
          const lessonRes = await axiosInstance.get(`/api/lessons/${lessonId}`);
          const fetchedLesson = lessonRes?.data?.data;
          if (fetchedLesson) {
            setLessonDataState(fetchedLesson);
            return;
          }
        } catch (directErr) {
          // Fall through to legacy fallback if 404 or any error
        }

        // 3) Fallback: locate module and fetch via legacy routes
        // 3) Fallback: locate module locally since we already have the full course structure including lessons
        let foundLesson = null;
        let foundModuleId = null;

        const modules = data.course.modules || [];
        for (const module of modules) {
          const moduleId = module._id || module.id;
          // Lessons are already nested in the module from the getDepartmentCourseContent response
          const lessons = module.lessons || [];

          const match = lessons.find(l => String(l._id || l.id) === String(lessonId) || String(l.slug || '') === String(lessonId));
          if (match) {
            foundLesson = match;
            foundModuleId = moduleId;
            break;
          }
        }
        if (!foundLesson || !foundModuleId) {
          throw new Error('Lesson not found');
        }
        setLessonModuleId(foundModuleId);
        // Try to get the single lesson payload if supported; else use found list item
        try {
          const singleLessonRes = await axiosInstance.get(`/api/modules/${foundModuleId}/lessons/${lessonId}`);
          setLessonDataState(singleLessonRes?.data?.data || foundLesson);
        } catch (_) {
          setLessonDataState(foundLesson);
        }
      } catch (err) {
        setError(err.message || 'Failed to load lesson');
      } finally {
        setLoading(false);
      }
    };

    fetchLessonData();
  }, [lessonId]);

  const lesson = lessonDataState;

  // Slide viewer state
  const [slideIndex, setSlideIndex] = useState(0);
  const slides = Array.isArray(lesson?.slides) ? [...lesson.slides].sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
  const slideStageRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Reset slide index when lesson changes
  useEffect(() => {
    setSlideIndex(0);
  }, [lesson?._id, lesson?.updatedAt]);

  // Keyboard navigation for slides + fullscreen toggle
  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      if (!slides.length) return;
      if (e.key === 'ArrowRight') setSlideIndex((i) => Math.min(slides.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setSlideIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length]);

  // Track fullscreen state
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    const el = slideStageRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  // Progress tracking: if slides exist, base on slide index; else use scroll listener
  useEffect(() => {
    if (slides.length) {
      const pct = Math.round(((slideIndex + 1) / slides.length) * 100);
      setScrollProgress(pct);
      setHasReachedBottom(slideIndex === slides.length - 1);
      return; // skip scroll handler when using slides
    }

    const handleScroll = () => {
      const container = scrollContainerRef.current;
      if (!container || isCompleted) return;

      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight - container.clientHeight;
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 100;
      setScrollProgress(Math.min(progress, 100));
      if (scrollHeight - scrollTop <= 5 && !hasReachedBottom) {
        setHasReachedBottom(true);
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      handleScroll();
    }

    return () => {
      if (container) container.removeEventListener('scroll', handleScroll);
    };
  }, [slides.length, slideIndex, isCompleted, hasReachedBottom]);

  // Auto-complete lesson when user reaches bottom
  useEffect(() => {
    if (hasReachedBottom && !isCompleted && !completingLesson) {
      const timer = setTimeout(() => {
        handleCompleteLesson();
      }, 2000); // Wait 2 seconds after reaching bottom

      return () => clearTimeout(timer);
    }
  }, [hasReachedBottom, isCompleted, completingLesson]);

  const handleCompleteLesson = async () => {
    if (isCompleted || completingLesson || !courseData?.course) return;

    try {
      setCompletingLesson(true);

      const courseId = courseData.course._id || courseData.course.id;

      // Use the progress API to mark lesson complete
      const response = await axiosInstance.patch('/api/progress/lesson-complete', {
        courseId,
        lessonId
      });

      if (response.data.success) {
        setIsCompleted(true);
        toast.success("🎉 Lesson completed!");
        // Navigate back to course to reflect progress and unlock next lesson
        setTimeout(() => navigate('/student/course', { replace: true }), 600);
      } else {
        throw new Error(response.data.message || 'Failed to complete lesson');
      }

    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to mark lesson as complete";
      toast.error(errorMessage);
    } finally {
      setCompletingLesson(false);
    }
  };

  const getResourceIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'video':
        return <Video className="h-5 w-5" />;
      case 'pdf':
      case 'text':
        return <FileText className="h-5 w-5" />;
      case 'image':
        return <FileImage className="h-5 w-5" />;
      case 'link':
        return <ExternalLink className="h-5 w-5" />;
      default:
        return <Download className="h-5 w-5" />;
    }
  };

  const handleResourceView = (url, type, title) => {
    if (type === 'link') {
      window.open(url, '_blank');
    } else {
      window.open(url, '_blank');
    }
  };

  const handleDownload = (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'resource';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBackToCourse = () => {
    navigate('/student/course');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="sticky top-0 bg-white border-b z-10 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center gap-4">
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="space-y-4">
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-64 sm:h-80 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-32 bg-gray-200 rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-20 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-20 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto text-center">
          <div className="p-6 sm:p-8 bg-white rounded-lg shadow-lg border">
            <div className="mb-6">
              <BookOpen className="h-12 w-12 sm:h-16 sm:w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Lesson Not Found</h3>
              <Alert variant="destructive" className="mb-4">
                <AlertDescription className="text-sm">
                  {error || "The requested lesson could not be found. Please try again."}
                </AlertDescription>
              </Alert>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={handleBackToCourse} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Course
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Enhanced Fixed Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 z-20 shadow-sm">
        <div className="max-w-[300px] md:max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
            {/* Left Section */}
            <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToCourse}
                className="shrink-0 text-xs sm:text-sm hover:bg-blue-50 hover:border-blue-300 transition-colors duration-200"
              >
                <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Back to Course</span>
                <span className="sm:hidden">Back</span>
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 leading-tight truncate">
                  {lesson.title || "Lesson"}
                </h1>
                <div className="flex items-center gap-4 mt-1 text-xs sm:text-sm text-muted-foreground">
                  {lesson.duration && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{lesson.duration}</span>
                    </div>
                  )}
                  {lesson.order && (
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      <span>Lesson {lesson.order}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Section - Progress/Status */}
            <div className="flex items-center gap-2 sm:gap-3">
              {isCompleted ? (
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800 border-green-300 px-3 py-1.5 text-xs sm:text-sm font-medium">
                    <CheckCircle2 className="h-3 w-3 mr-1.5" />
                    Completed
                  </Badge>
                  <div className="hidden sm:flex items-center text-xs text-green-600">
                    <Trophy className="h-3 w-3 mr-1" />
                    <span>Well done!</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex flex-col items-end">
                      <div className="w-24 sm:w-32">
                        <Progress
                          value={scrollProgress}
                          className="h-2 sm:h-2.5"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground mt-1">
                        {Math.round(scrollProgress)}% complete
                      </span>
                    </div>
                    {hasReachedBottom && (
                      <div className="flex items-center text-xs text-blue-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Almost done!</span>
                        <span className="sm:hidden">Done!</span>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCompleteLesson}
                    disabled={completingLesson}
                    className="ml-2 shrink-0"
                  >
                    {completingLesson ? (
                      <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    )}
                    Mark Completed
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Scrollable Content */}
      <div
        ref={scrollContainerRef}
        className="max-w-4xl mx-auto sm:p-6 space-y-4 sm:space-y-6 h-[calc(100vh-80px)] sm:h-[calc(100vh-88px)] overflow-y-auto scroll-smooth"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E0 #F7FAFC' }}
      >
        {/* Enhanced Lesson Content */}
        <Card className="shadow-lg border-0 bg-white">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              </div>
              <span>Lesson Content</span>
              {slides.length > 0 && (
                <Badge variant="outline" className="ml-2 text-xs">{slides.length} slide{slides.length > 1 ? 's' : ''}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 lg:p-8">
            {slides.length > 0 ? (
              <div className="max-w-none">
                {/* Slide viewer */}
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-muted-foreground">Slide {slideIndex + 1} / {slides.length}</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={toggleFullscreen} title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Enter Fullscreen (F)'}>
                      {isFullscreen ? (
                        <><Minimize2 className="h-4 w-4 mr-1" /> Exit</>
                      ) : (
                        <><Maximize2 className="h-4 w-4 mr-1" /> Full Screen</>
                      )}
                    </Button>
                    <Button size="sm" variant="outline" disabled={slideIndex === 0} onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}>Prev</Button>
                    <Button size="sm" variant="outline" disabled={slideIndex === slides.length - 1} onClick={() => setSlideIndex((i) => Math.min(slides.length - 1, i + 1))}>Next</Button>
                  </div>
                </div>
                <div
                  ref={slideStageRef}
                  className={`overflow-hidden bg-transparent ${isFullscreen ? 'w-screen h-screen rounded-none' : 'h-[60vh] md:h-[70vh] rounded-lg'}`}
                  onDoubleClick={toggleFullscreen}
                >
                  <div className="h-full w-full">
                    {/* Read-only slide renderer (content + positioned elements) */}
                    {/* eslint-disable-next-line react/jsx-no-useless-fragment */}
                    <>
                      {/* We embed our 16:9 stage inside the available viewport */}
                      <div className="h-full w-full flex items-center justify-center">
                        <div className={`w-full ${isFullscreen ? '' : 'max-w-4xl'}`}>
                          <SlideRender slide={slides[slideIndex]} className={isFullscreen ? 'fullscreen' : ''} />
                        </div>
                      </div>
                    </>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 mt-4">
                  {slides.map((_, i) => (
                    <button key={i} aria-label={`Go to slide ${i + 1}`} onClick={() => setSlideIndex(i)} className={`h-2.5 w-2.5 rounded-full ${i === slideIndex ? 'bg-blue-600' : 'bg-gray-300'} hover:bg-blue-500`} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="prose prose-sm sm:prose-base max-w-none">
                {lesson.content ? (
                  <div className="whitespace-pre-wrap text-gray-700 leading-relaxed text-sm sm:text-base">
                    {lesson.content}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No lesson content available.</p>
                  </div>
                )}
              </div>
            )}

            {/* Additional info only for legacy content */}
            {slides.length === 0 && (
              <div className="mt-8 sm:mt-12 space-y-6 sm:space-y-8">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                    <Target className="h-4 w-4 sm:h-5 sm:w-5" />
                    Learning Objectives
                  </h3>
                  <ul className="space-y-2 sm:space-y-3 text-sm sm:text-base">
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">1</div>
                      <span>Understand the core concepts covered in this lesson</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">2</div>
                      <span>Apply the knowledge to practical scenarios</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">3</div>
                      <span>Build upon previous lessons for comprehensive learning</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-orange-400 rounded-r-lg p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-bold text-orange-900 mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    Key Points
                  </h3>
                  <p className="text-orange-800 text-sm sm:text-base leading-relaxed">
                    Make sure to review all the materials and resources provided below to get the most out of this lesson.
                    Take notes and refer back to this content as needed during your learning journey.
                  </p>
                </div>

                {/* Additional Interactive Elements */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-6">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-green-800 text-sm">Remember</span>
                    </div>
                    <p className="text-green-700 text-sm leading-relaxed">
                      Practice makes perfect. Apply these concepts in real scenarios.
                    </p>
                  </div>

                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="h-4 w-4 text-purple-600" />
                      <span className="font-semibold text-purple-800 text-sm">Pro Tip</span>
                    </div>
                    <p className="text-purple-700 text-sm leading-relaxed">
                      Review the lesson resources for additional insights.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enhanced Lesson Resources */}
        {resources.length > 0 && (
          <Card className="border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-100 to-emerald-100 border-b border-green-200">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <Download className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <span className="text-base sm:text-lg">Lesson Resources</span>
                  <Badge className="bg-green-500 text-white border-0 px-3 py-1 text-xs sm:text-sm">
                    {resources.length} resource{resources.length > 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardTitle>
              <p className="text-xs sm:text-sm text-green-700 mt-2">
                Additional materials and references for enhanced learning
              </p>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                {resources.map((resource, index) => {
                  const resourceId = resource._id || resource.id || index;

                  return (
                    <div
                      key={resourceId}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border-2 border-white bg-white/80 backdrop-blur-sm hover:shadow-md hover:border-green-200 transition-all duration-300"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2 sm:p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors duration-300">
                          {getResourceIcon(resource.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                            <h4 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                              {resource.title || `Resource ${index + 1}`}
                            </h4>
                            <Badge
                              variant="outline"
                              className={`text-xs self-start sm:self-auto ${resource.type === 'video' ? 'border-red-200 text-red-700 bg-red-50' :
                                resource.type === 'pdf' ? 'border-blue-200 text-blue-700 bg-blue-50' :
                                  resource.type === 'link' ? 'border-purple-200 text-purple-700 bg-purple-50' :
                                    'border-gray-200 text-gray-700 bg-gray-50'
                                }`}
                            >
                              {resource.type?.toUpperCase() || 'FILE'}
                            </Badge>
                          </div>
                          {resource.content && (
                            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed line-clamp-2">
                              {resource.content}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-row sm:flex-col lg:flex-row items-center gap-2 shrink-0">
                        <Button
                          onClick={() => handleResourceView(resource.url, resource.type, resource.title)}
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none h-8 sm:h-9 text-xs sm:text-sm hover:bg-green-50 hover:border-green-300"
                        >
                          {resource.type === 'video' ? (
                            <>
                              <Play className="h-3 w-3 mr-1.5" />
                              <span className="hidden sm:inline">Play</span>
                              <span className="sm:hidden">▶️</span>
                            </>
                          ) : resource.type === 'link' ? (
                            <>
                              <ExternalLink className="h-3 w-3 mr-1.5" />
                              <span className="hidden sm:inline">Visit</span>
                              <span className="sm:hidden">🔗</span>
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3 mr-1.5" />
                              <span className="hidden sm:inline">Preview</span>
                              <span className="sm:hidden">👁️</span>
                            </>
                          )}
                        </Button>

                        {resource.type !== 'link' && (
                          <Button
                            onClick={() => handleDownload(resource.url, resource.title)}
                            variant="outline"
                            size="sm"
                            className="flex-1 sm:flex-none h-8 sm:h-9 text-xs sm:text-sm hover:bg-blue-50 hover:border-blue-300"
                          >
                            <Download className="h-3 w-3 mr-1.5" />
                            <span className="hidden sm:inline">Download</span>
                            <span className="sm:hidden">⬇️</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Completion Status */}
        {!isCompleted && (
          <Card className="border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg">
            <CardContent className="p-4 sm:p-6 text-center">
              <div className="relative mb-4">
                {hasReachedBottom ? (
                  <CheckCircle2 className="h-12 w-12 sm:h-16 sm:w-16 text-green-500 mx-auto animate-bounce" />
                ) : (
                  <ScrollText className="h-12 w-12 sm:h-16 sm:w-16 text-blue-500 mx-auto" />
                )}
                <div className="absolute inset-0 bg-blue-200 rounded-full blur-xl opacity-30 animate-pulse"></div>
              </div>

              <h3 className="text-base sm:text-lg font-bold mb-3 text-gray-900">
                {hasReachedBottom ? (
                  completingLesson ? (
                    <span className="flex items-center justify-center gap-2 text-green-700">
                      <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                      <span className="hidden sm:inline">Completing lesson...</span>
                      <span className="sm:hidden">Processing...</span>
                    </span>
                  ) : (
                    <span className="text-green-700">🎉 Great! Lesson will be marked complete shortly.</span>
                  )
                ) : (
                  <span className="text-blue-700">📖 Continue reading to complete this lesson</span>
                )}
              </h3>

              <p className="text-xs sm:text-sm text-gray-600 mb-4 leading-relaxed max-w-sm mx-auto">
                {hasReachedBottom ? (
                  "You've reviewed all the content. Well done on your dedication to learning!"
                ) : (
                  "Read through all the content and resources to mark this lesson as complete."
                )}
              </p>

              <div className="max-w-xs mx-auto">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-gray-600">Progress</span>
                  <span className="text-xs font-bold text-blue-600">
                    {Math.round(scrollProgress)}%
                  </span>
                </div>
                <Progress
                  value={scrollProgress}
                  className="h-2.5 sm:h-3 bg-gray-200"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Start</span>
                  <span>Complete</span>
                </div>
              </div>

              {scrollProgress > 50 && !hasReachedBottom && (
                <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                  <p className="text-xs text-blue-700 font-medium">
                    🚀 You're making great progress! Keep going to finish the lesson.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Enhanced Completion Success */}
        {isCompleted && (
          <Card className="border-green-300 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 shadow-xl">
            <CardContent className="p-6 sm:p-8 text-center">
              <div className="relative mb-6">
                <Trophy className="h-16 w-16 sm:h-20 sm:w-20 text-yellow-500 mx-auto animate-bounce" />
                <div className="absolute inset-0 bg-yellow-300 rounded-full blur-xl opacity-30 animate-pulse"></div>

                {/* Confetti effect */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-4">
                  <div className="text-2xl sm:text-3xl animate-bounce">🎉</div>
                </div>
                <div className="absolute top-2 left-1/4 transform -translate-x-1/2">
                  <div className="text-xl sm:text-2xl animate-bounce delay-100">⭐</div>
                </div>
                <div className="absolute top-2 right-1/4 transform translate-x-1/2">
                  <div className="text-xl sm:text-2xl animate-bounce delay-200">✨</div>
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-800 mb-3">
                🎉 Lesson Completed!
              </h3>

              <p className="text-sm sm:text-base text-green-700 mb-6 max-w-md mx-auto leading-relaxed">
                Excellent work! You have successfully completed this lesson. Your dedication to learning is commendable.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
                <Button
                  onClick={handleBackToCourse}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                  size="lg"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Continue Learning</span>
                  <span className="sm:hidden">Continue</span>
                </Button>

                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="flex-1 border-green-300 text-green-700 hover:bg-green-50"
                  size="lg"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Review Again</span>
                  <span className="sm:hidden">Review</span>
                </Button>
              </div>

              {/* Achievement badge */}
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 rounded-full border border-yellow-300">
                <Award className="h-4 w-4 text-yellow-600" />
                <span className="text-xs sm:text-sm font-medium text-yellow-800">
                  Learning Achievement Unlocked!
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Extra content for scrolling demo */}
        <div className="h-32" /> {/* Spacer to ensure scrolling */}
      </div>
    </div>
  );
};

export default LessonDetail;
