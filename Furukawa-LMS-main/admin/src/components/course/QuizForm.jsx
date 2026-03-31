// components/course/QuizForm.jsx
import React from "react";
import { Button } from "@/components/ui/button";
import { FormInput, FormTextarea } from "@/components/form/index";
import { QuestionForm } from "./QuestionForm";
import { IconTrash, IconPlus } from "@tabler/icons-react";

export const QuizForm = ({
  quiz,
  errors = {},
  onUpdate,
  onRemove,
  onAddQuestion,
  onUpdateQuestion,
  onRemoveQuestion,
  onUpdateQuestionOption,
  onAddOptionToQuestion,
  onRemoveOptionFromQuestion,
  onSetCorrectAnswer,
}) => {
  return (
    <div key={quiz.id} className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <FormInput
            label="Test Title *"
            value={quiz.title}
            onChange={(e) => onUpdate(quiz.id, "title", e.target.value)}
            placeholder="Enter test title"
            error={errors[`quiz-${quiz.id}-title`]}
          />
        </div>
        <div className="space-y-2 ml-4 w-32">
          <FormInput
            label="Passing Score (%)"
            type="number"
            value={quiz.passingScore}
            onChange={(e) => {
              const value = e.target.value;
              const numValue = value === "" ? 70 : parseInt(value) || 70;
              onUpdate(quiz.id, "passingScore", numValue);
            }}
            placeholder="70"
            min="0"
            max="100"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onRemove(quiz.id)}
          className="text-red-600 hover:text-red-800 ml-4"
        >
          <IconTrash className="h-4 w-4" />
        </Button>
      </div>

      {errors[`quiz-${quiz.id}-questions`] && (
        <p className="text-sm text-red-600">
          {errors[`quiz-${quiz.id}-questions`]}
        </p>
      )}

      {quiz.questions.map((question, qIndex) => (
        <QuestionForm
          key={question.id}
          quizId={quiz.id}
          question={question}
          qIndex={qIndex}
          errors={errors}
          onUpdate={(field, value) =>
            onUpdateQuestion(quiz.id, question.id, field, value)
          }
          onRemove={() => onRemoveQuestion(quiz.id, question.id)}
          onUpdateOption={(optionId, field, value) =>
            onUpdateQuestionOption(quiz.id, question.id, optionId, field, value)
          }
          onAddOption={() => onAddOptionToQuestion(quiz.id, question.id)}
          onRemoveOption={(optionId) =>
            onRemoveOptionFromQuestion(quiz.id, question.id, optionId)
          }
          onSetCorrectAnswer={(optionId) =>
            onSetCorrectAnswer(quiz.id, question.id, optionId)
          }
        />
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() => onAddQuestion(quiz.id)}
        className="gap-2"
      >
        <IconPlus className="h-4 w-4" />
        Add Question
      </Button>
    </div>
  );
};