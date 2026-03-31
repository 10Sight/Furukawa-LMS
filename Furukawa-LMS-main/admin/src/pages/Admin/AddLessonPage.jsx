import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Loader2, Trash2, MoveUp, MoveDown, Palette, Type as TypeIcon, Square, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "@/Helper/axiosInstance";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import SlideStage from "@/components/common/SlideStage";
import DraggableCanvas from "@/components/common/DraggableCanvas";

const AddLessonPage = () => {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    title: "",
    duration: 10,
    order: 1,
  });

  const [slides, setSlides] = useState([
    { id: `${Date.now()}-1`, order: 1, contentHtml: "", bgColor: "#ffffff", images: [] },
  ]);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileRef = React.useRef(null);
  const activeSlide = slides[activeIndex];
  const patchActiveSlide = (patch) => setSlides((prev) => prev.map((s,i)=> i===activeIndex ? { ...s, ...patch } : s));
  const addElement = (el) => patchActiveSlide({ elements: [...(activeSlide?.elements || []), el] });
  const addTextBox = () => addElement({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type: 'text', xPct: 10, yPct: 10, wPct: 30, hPct: 12, text: 'Text' });
  const addRect = () => addElement({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type: 'rect', xPct: 15, yPct: 15, wPct: 20, hPct: 12, fill: '#e5e7eb', stroke: '#d1d5db' });
  const addImage = () => fileRef.current?.click();

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseInt(value, 10) || 0 : value,
    }));
  };

  const addSlide = () => {
    setSlides((prev) => {
      const nextOrder = prev.length + 1;
      return [...prev, { id: `${Date.now()}-${nextOrder}`, order: nextOrder, contentHtml: "", bgColor: "#ffffff", images: [] }];
    });
    setActiveIndex(slides.length);
  };

  const removeSlide = (index) => {
    setSlides((prev) => {
      const copy = prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }));
      return copy.length ? copy : [{ id: `${Date.now()}-1`, order: 1, contentHtml: "", bgColor: "#ffffff", images: [] }];
    });
    setActiveIndex((prev) => Math.max(0, prev - 1));
  };

  const moveSlide = (from, to) => {
    setSlides((prev) => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr.map((s, i) => ({ ...s, order: i + 1 }));
    });
    setActiveIndex(to);
  };

  const updateSlide = (index, patch) => {
    setSlides((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Sidebar: slides list */}
              <div className="md:col-span-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Slides</h4>
                  <Button type="button" size="sm" onClick={addSlide} className="gap-1">
                    <Plus className="h-4 w-4" /> New
                  </Button>
                </div>
                <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                  {slides.map((s, i) => (
                    <div
                      key={s.id}
                      className={
                        "group border rounded-md p-2 flex items-center gap-2 transition-colors " +
                        (i === activeIndex ? "border-blue-500 bg-blue-50/40" : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]")
                      }
                    >
                      <div className="h-8 w-12 rounded-sm border bg-white shadow-sm shrink-0" style={{ backgroundColor: s.bgColor }} />
                      <button type="button" className="flex-1 text-left text-sm font-medium truncate" onClick={() => setActiveIndex(i)}>
                        Slide {i + 1}
                      </button>
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button type="button" size="icon" variant="outline" disabled={i === 0} onClick={() => moveSlide(i, i - 1)}>
                          <MoveUp className="h-3 w-3" />
                        </Button>
                        <Button type="button" size="icon" variant="outline" disabled={i === slides.length - 1} onClick={() => moveSlide(i, i + 1)}>
                          <MoveDown className="h-3 w-3" />
                        </Button>
                        <Button type="button" size="icon" variant="destructive" onClick={() => removeSlide(i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Editor area */}
              <div className="md:col-span-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-sm font-medium flex items-center gap-2 mr-2">
                    <Palette className="h-4 w-4" /> Slide Background
                  </label>
                  <input
                    type="color"
                    value={slides[activeIndex]?.bgColor || '#ffffff'}
                    onChange={(e) => updateSlide(activeIndex, { bgColor: e.target.value })}
                    className="h-8 w-12 border rounded"
                    disabled={isSubmitting}
                  />
                  <div className="flex items-center gap-2 ml-auto">
                    <Button type="button" variant="outline" size="sm" onClick={addTextBox} className="gap-1">
                      <TypeIcon className="h-4 w-4" /> Text
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={addRect} className="gap-1">
                      <Square className="h-4 w-4" /> Shape
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={addImage} className="gap-1">
                      <ImageIcon className="h-4 w-4" /> Image
                    </Button>
                  </div>
                </div>
                <SlideStage bgColor={slides[activeIndex]?.bgColor || '#ffffff'} transitionKey={activeIndex}>
                  <div className="relative w-full h-full">
                    <RichTextEditor
                      value={slides[activeIndex]?.contentHtml || ''}
                      onChange={(html) => updateSlide(activeIndex, { contentHtml: html })}
                      className="bg-transparent"
                      placeholder="Design your slide..."
                      borderless
                    />
                    <DraggableCanvas
                      elements={slides[activeIndex]?.elements || []}
                      onChange={(next) => updateSlide(activeIndex, { elements: next })}
                    />
                    <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return; e.target.value = '';
                      try {
                        const fd = new FormData(); fd.append('file', file);
                        const res = await axiosInstance.post('/api/upload/single', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                        const url = res?.data?.data?.url;
                        if (url) addElement({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type: 'image', url, xPct: 20, yPct: 20, wPct: 30, hPct: 20, alt: file.name });
                      } catch {}
                    }} />
                  </div>
                </SlideStage>
              </div>
            </div>

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
