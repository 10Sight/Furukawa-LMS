import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "@/Helper/axiosInstance";
import SlideEditorWorkspace from "@/components/lesson-editor/SlideEditorWorkspace";
import { useSlidesEditor, createBlankSlide, withSlideAdded, withSlideRemoved, withSlideMoved } from "@/components/lesson-editor/useSlidesEditor";

const AddLessonPage = () => {
  const { moduleId } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    duration: 10,
    order: 1,
  });

  const editor = useSlidesEditor([createBlankSlide(1)]);
  const { slides, setSlides, activeIndex, setActiveIndex } = editor;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleAddSlide = () => {
    setSlides((prev) => withSlideAdded(prev));
    setActiveIndex(slides.length);
  };

  const handleRemoveSlide = (index) => {
    setSlides((prev) => withSlideRemoved(prev, index));
    setActiveIndex((prev) => Math.max(0, prev - 1));
  };

  const handleMoveSlide = (from, to) => {
    setSlides((prev) => withSlideMoved(prev, from, to));
    setActiveIndex(to);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Please enter a lesson title");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: formData.title,
        duration: formData.duration,
        order: formData.order,
        slides: slides.map((s, idx) => ({
          order: idx + 1,
          contentHtml: s.contentHtml,
          bgColor: s.bgColor,
          images: s.images,
          elements: s.elements || [],
        })),
      };

      const response = await axiosInstance.post(
        `/api/modules/${moduleId}/lessons`,
        payload
      );

      if (response.data.success) {
        toast.success("Lesson created successfully!");
        navigate(-1);
      }
    } catch (error) {
      console.error("Error creating lesson:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Failed to create lesson. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add New Lesson</h1>
          <p className="text-muted-foreground">
            Create a new lesson for the selected module
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Lesson Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Module ID Display */}
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Module ID
              </label>
              <div className="mt-1 p-3 bg-muted rounded-md text-sm font-mono">
                {moduleId}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">
                Lesson Title *
              </label>
              <Input
                id="title"
                name="title"
                type="text"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter lesson title"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Slides Editor */}
            <SlideEditorWorkspace
              editor={editor}
              onAddSlide={handleAddSlide}
              onRemoveSlide={handleRemoveSlide}
              onMoveSlide={handleMoveSlide}
              disabled={isSubmitting}
            />

            {/* Duration and Order */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="duration" className="text-sm font-medium">
                  Duration (minutes)
                </label>
                <Input
                  id="duration"
                  name="duration"
                  type="number"
                  min="1"
                  max="1440"
                  value={formData.duration}
                  onChange={handleInputChange}
                  placeholder="10"
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="order" className="text-sm font-medium">
                  Lesson Order
                </label>
                <Input
                  id="order"
                  name="order"
                  type="number"
                  min="1"
                  value={formData.order}
                  onChange={handleInputChange}
                  placeholder="1"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create Lesson
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddLessonPage;
