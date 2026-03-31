// components/course/QuestionForm.jsx
import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormInput } from "@/components/form/index";
import { IconTrash, IconPlus } from "@tabler/icons-react";

export const QuestionForm = ({
  quizId,
  question,
  qIndex,
  errors = {},
  onUpdate,
  onRemove,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
  onSetCorrectAnswer,
}) => {
  return (
    <div className="border rounded p-3 space-y-3">
      <div className="flex items-center justify-between">
        <Label>Question {qIndex + 1}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-red-600 hover:text-red-800"
        >
          <IconTrash className="h-4 w-4" />
        </Button>
      </div>

      <FormInput
        label="Question Text *"
        value={question.questionText}
        onChange={(e) => onUpdate("questionText", e.target.value)}
        placeholder="Enter question text"
        error={errors[`quiz-${quizId}-question-${question.id}-text`]}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Options *</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddOption}
            className="gap-2"
          >
            <IconPlus className="h-4 w-4" />
            Add Option
          </Button>
        </div>

        {errors[`quiz-${quizId}-question-${question.id}-options`] && (
          <p className="text-sm text-red-600">
            {errors[`quiz-${quizId}-question-${question.id}-options`]}
          </p>
        )}

        {errors[`quiz-${quizId}-question-${question.id}-correct`] && (
          <p className="text-sm text-red-600">
            {errors[`quiz-${quizId}-question-${question.id}-correct`]}
          </p>
        )}

        {question.options.map((option, oIndex) => (
          <div key={option.id} className="flex items-center gap-2">
            <input
              type="radio"
              name={`quiz-${quizId}-question-${question.id}`}
              checked={option.isCorrect}
              onChange={() => onSetCorrectAnswer(option.id)}
              className="h-4 w-4"
            />
            <Input
              value={option.text}
              onChange={(e) =>
                onUpdateOption(option.id, "text", e.target.value)
              }
              placeholder={`Option ${oIndex + 1}`}
              className={
                errors[`quiz-${quizId}-question-${question.id}-option-${option.id}-text`]
                  ? "border-red-500"
                  : ""
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemoveOption(option.id)}
              className="text-red-600 hover:text-red-800"
              disabled={question.options.length <= 2}
            >
              <IconTrash className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};