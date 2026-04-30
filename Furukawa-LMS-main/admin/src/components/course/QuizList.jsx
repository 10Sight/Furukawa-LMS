import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconHelpCircle,
  IconClock,
  IconLoader,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useDeleteQuizMutation } from "@/Redux/AllApi/QuizApi";

const QuizList = ({ quizzes, courseId, onRefetch, modules = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [deleteQuiz, { isLoading: isDeletingQuiz }] = useDeleteQuizMutation();

  const basePath = React.useMemo(() => {
    const p = location.pathname || '';
    if (p.startsWith('/superadmin')) return '/superadmin';
    if (p.startsWith('/instructor')) return '/instructor';
    return '/admin';
  }, [location.pathname]);

  const handleDeleteQuiz = async (quizId) => {
    if (!window.confirm("Are you sure you want to delete this quiz? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteQuiz(quizId).unwrap();
      toast.success("Test deleted successfully!");
      if (onRefetch) {
        onRefetch();
      }
    } catch (error) {
      console.error("Delete test error:", error);
      toast.error(error?.data?.message || "Failed to delete quiz");
    }
  };

  // Ensure quizzes is always an array
  const quizArray = Array.isArray(quizzes) ? quizzes : [];
  
  // Helper function to get module name
  const getModuleName = (moduleId) => {
    const module = modules.find(m => m._id === moduleId || m.id === moduleId);
    return module ? module.title : 'Unknown Module';
  };

  if (quizArray.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <IconHelpCircle className="h-12 w-12 text-muted-foreground/60 mb-4" />
          <p className="text-muted-foreground font-medium">No quizzes yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add quizzes to test operator knowledge
          </p>
          <Button 
            onClick={() => navigate(`${basePath}/add-quiz/${courseId}`)} 
            className="mt-4"
          >
            Add Quiz
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Course Quizzes</h3>
          <p className="text-sm text-muted-foreground">
            Tests to assess student understanding
          </p>
        </div>
        <Button onClick={() => navigate(`${basePath}/add-quiz/${courseId}`)}>
          <IconPlus className="h-4 w-4 mr-2" />
          Add Quiz
        </Button>
      </div>

      <div className="grid gap-4">
        {quizArray.map((quiz) => (
          <Card key={quiz._id} className="group">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{quiz.title}</CardTitle>
                  <CardDescription>{quiz.description}</CardDescription>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`${basePath}/edit-quiz/${quiz.slug || quiz._id}`)}
                  >
                    <IconPencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                    onClick={() => handleDeleteQuiz(quiz._id)}
                    disabled={isDeletingQuiz}
                  >
                    {isDeletingQuiz ? (
                      <IconLoader className="h-4 w-4 animate-spin" />
                    ) : (
                      <IconTrash className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <IconHelpCircle className="h-4 w-4" />
                  <span>
                    {quiz.questions?.length || 0} question
                    {quiz.questions?.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {quiz.moduleId && (
                  <Badge variant="secondary" className="text-xs">
                    📚 {getModuleName(quiz.moduleId)}
                  </Badge>
                )}
                {quiz.timeLimit && (
                  <div className="flex items-center gap-1">
                    <IconClock className="h-4 w-4" />
                    <span>{quiz.timeLimit} mins</span>
                  </div>
                )}
                {quiz.attemptsAllowed !== undefined && (
                  <div className="flex items-center gap-1">
                    <span>Attempts: {quiz.attemptsAllowed === 0 ? "Unlimited" : quiz.attemptsAllowed}</span>
                  </div>
                )}
                {quiz.passingScore && (
                  <Badge variant="outline">
                    Passing: {quiz.passingScore}%
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {quiz.departmentId && quiz.departmentId.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase mr-1 flex items-center">Depts:</span>
                    {quiz.departmentId.map((id, idx) => (
                      <Badge key={idx} variant="outline" className="text-[9px] bg-blue-50/50 text-blue-700 border-blue-200">
                        {id}
                      </Badge>
                    ))}
                  </div>
                )}
                {quiz.sectionId && quiz.sectionId.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase mr-1 flex items-center">Sections:</span>
                    {quiz.sectionId.map((id, idx) => (
                      <Badge key={idx} variant="outline" className="text-[9px] bg-gray-50 text-gray-700 border-gray-200">
                        {id}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default QuizList;