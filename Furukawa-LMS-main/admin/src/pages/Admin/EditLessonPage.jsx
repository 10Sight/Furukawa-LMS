import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import SlideStage from "@/components/common/SlideStage";
import DraggableCanvas from "@/components/common/DraggableCanvas";
import { ArrowLeft, Plus, Loader2, Trash2, MoveUp, MoveDown, Palette, Save, Type as TypeIcon, Square, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  useGetLessonByIdQuery,
  useAddLessonSlideMutation,
  useUpdateLessonSlideMutation,
  useDeleteLessonSlideMutation,
  useReorderLessonSlidesMutation,
  useUpdateLessonMutation,
} from "@/Redux/AllApi/LessonApi";

const EditLessonPage = () => {
  const { moduleId, lessonId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useGetLessonByIdQuery({ moduleId, lessonId }, {
    skip: !moduleId || !lessonId,
  });

  const lesson = data?.data;
  const [title, setTitle] = useState("");
  const [slides, setSlides] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const [addSlide, { isLoading: adding }] = useAddLessonSlideMutation();
  const [updateSlide, { isLoading: updating }] = useUpdateLessonSlideMutation();
  const [deleteSlide, { isLoading: deleting }] = useDeleteLessonSlideMutation();
  const [reorderSlides, { isLoading: reordering }] = useReorderLessonSlidesMutation();
  const [updateLessonMeta, { isLoading: updatingMeta }] = useUpdateLessonMutation();

  useEffect(() => {
    if (!lesson) return;
    setTitle(lesson.title || "");
    // Only hydrate from server if we don't already have local edits
    setSlides((prev) => {
      if (Array.isArray(prev) && prev.length > 0) return prev;
      let sorted = Array.isArray(lesson.slides)
        ? [...lesson.slides].sort((a, b) => (a.order || 0) - (b.order || 0))
        : [];
      // Fallback: if no slides but legacy content exists, synthesize a slide for editing
      if ((!sorted || sorted.length === 0) && lesson.content) {
        sorted = [{ order: 1, contentHtml: String(lesson.content || ''), bgColor: '#ffffff', images: [] }];
      }
      setActiveIndex(0);
      return sorted;
    });
  }, [lessonId, lesson]);

  const activeSlide = slides[activeIndex] || null;
  const fileRef = React.useRef(null);

  const addElement = (el) => {
    patchActiveSlide({ elements: [...(activeSlide?.elements || []), el] });
  };
  const addTextBox = () => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    addElement({ id, type: 'text', xPct: 10, yPct: 10, wPct: 30, hPct: 12, text: 'Text' });
  };
  const addRect = () => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    addElement({ id, type: 'rect', xPct: 15, yPct: 15, wPct: 20, hPct: 12, fill: '#e5e7eb', stroke: '#d1d5db' });
  };
  const addImage = () => fileRef.current?.click();

  // Ensure we hydrate slides from server on mount/open
  useEffect(() => {
    (async () => {
      if (!lessonId || !moduleId) return;
      try {
        const axios = (await import("@/Helper/axiosInstance")).default;
        const res = await axios.get(`/api/modules/${moduleId}/lessons/${lessonId}`);
        const l = res?.data?.data;
        if (Array.isArray(l?.slides)) {
          const sorted = [...l.slides].sort((a,b)=> (a.order||0)-(b.order||0));
          setSlides(sorted);
          if (sorted.length > 0) setActiveIndex(0);
          if (l.title) setTitle(l.title);
        }
      } catch (_) {
        // ignore and rely on RTK data
      }
    })();
  }, [lessonId, moduleId]);

  const handleAddSlide = async () => {
    try {
      const next = [...slides, { order: slides.length + 1, contentHtml: "", bgColor: "#ffffff", images: [] }];
      const normalized = next.map((s,i)=> ({...s, order: i+1}));
      await updateLessonMeta({ moduleId, lessonId, slides: normalized, content: normalized[0]?.contentHtml || '' }).unwrap();
      setSlides(next);
      setActiveIndex(next.length - 1);
      toast.success("Slide added");
      try { await refetch(); } catch (_) {}
    } catch (e) {
      toast.error(e?.data?.message || "Failed to add slide");
    }
  };

  const handleDeleteSlide = async (index) => {
    try {
      const next = slides.filter((_, i) => i !== index).map((sl, i) => ({ ...sl, order: i + 1 }));
      await updateLessonMeta({ moduleId, lessonId, slides: next, content: next[0]?.contentHtml || '' }).unwrap();
      setSlides(next);
      setActiveIndex((prev) => Math.max(0, prev - 1));
      toast.success("Slide deleted");
      try { await refetch(); } catch (_) {}
    } catch (e) {
      toast.error(e?.data?.message || "Failed to delete slide");
    }
  };

  const handleMove = async (from, to) => {
    if (to < 0 || to >= slides.length) return;
    const newOrder = [...slides];
    const [item] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, item);
    const normalized = newOrder.map((s,i)=> ({ ...s, order: i+1 }));
    setSlides(normalized);
    setActiveIndex(to);
    try {
      await updateLessonMeta({ moduleId, lessonId, slides: normalized, content: normalized[0]?.contentHtml || '' }).unwrap();
      toast.success("Slides reordered");
      try { await refetch(); } catch (_) {}
    } catch (e) {
      toast.error(e?.data?.message || "Failed to reorder");
      refetch();
    }
  };

  const handleSaveSlide = async () => {
    const s = activeSlide;
    setSaving(true);
    try {
      const normalized = slides.map((sl,i)=> ({ ...sl, order: i+1 }));
      await updateLessonMeta({ moduleId, lessonId, slides: normalized, content: normalized[0]?.contentHtml || '' }).unwrap();
      toast.success("Slide saved");
      try { await refetch(); } catch (_) {}
    } catch (e) {
      toast.error(e?.data?.message || "Failed to save slide");
    } finally {
      setSaving(false);
    }
  };

  const patchActiveSlide = (patch) => {
    setSlides((prev) => prev.map((s, i) => i === activeIndex ? { ...s, ...patch } : s));
  };

  const handleSaveMeta = async () => {
    try {
      await updateLessonMeta({ moduleId, lessonId, title }).unwrap();
      toast.success("Lesson updated");
      refetch();
    } catch (e) {
      toast.error(e?.data?.message || "Failed to update lesson");
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }
  if (isError || !lesson) {
    return <div className="p-6">Failed to load lesson</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Lesson</h1>
          <p className="text-muted-foreground">Manage slides visually</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lesson</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={title} onChange={(e)=> setTitle(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSaveMeta} disabled={updatingMeta} className="ml-auto">
                {updatingMeta ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4 mr-2"/>}
                Save Lesson
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Slides list */}
              <div className="md:col-span-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Slides</h4>
                  <Button type="button" size="sm" onClick={handleAddSlide} className="gap-1" disabled={adding}>
                    <Plus className="h-4 w-4" /> New
                  </Button>
                </div>
                <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                  {slides.map((s, i) => (
                    <div
                      key={s._id || i}
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
                        <Button type="button" size="icon" variant="outline" disabled={i === 0 || reordering} onClick={() => handleMove(i, i - 1)}>
                          <MoveUp className="h-3 w-3" />
                        </Button>
                        <Button type="button" size="icon" variant="outline" disabled={i === slides.length - 1 || reordering} onClick={() => handleMove(i, i + 1)}>
                          <MoveDown className="h-3 w-3" />
                        </Button>
                        <Button type="button" size="icon" variant="destructive" disabled={deleting} onClick={() => handleDeleteSlide(i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            {/* Editor area */}
            <div className="md:col-span-3 space-y-3">
              {activeSlide ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-sm font-medium flex items-center gap-2 mr-2">
                      <Palette className="h-4 w-4" /> Slide Background
                    </label>
                    <input
                      type="color"
                      value={activeSlide.bgColor || '#ffffff'}
                      onChange={(e) => patchActiveSlide({ bgColor: e.target.value })}
                      className="h-8 w-12 border rounded"
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
                    <Button onClick={handleSaveSlide} disabled={saving || updating} className="ml-2">
                      {saving || updating ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4 mr-2"/>}
                      Save Slide
                    </Button>
                  </div>
                  <SlideStage bgColor={activeSlide.bgColor || '#ffffff'} transitionKey={activeIndex}>
                    <div className="relative w-full h-full">
                      <RichTextEditor
                        value={activeSlide.contentHtml || ''}
                        onChange={(html) => patchActiveSlide({ contentHtml: html })}
                        className="bg-transparent"
                        placeholder="Design your slide..."
                        borderless
                      />
                      <DraggableCanvas
                        elements={activeSlide.elements || []}
                        onChange={(next) => patchActiveSlide({ elements: next })}
                      />
                      <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return; e.target.value = '';
                        const axios = (await import("@/Helper/axiosInstance")).default;
                        try {
                          const fd = new FormData(); fd.append('file', file);
                          const res = await axios.post('/api/upload/single', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                          const url = res?.data?.data?.url;
                          if (url) {
                            // default 30% width, 20% height
                            addElement({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type: 'image', url, xPct: 20, yPct: 20, wPct: 30, hPct: 20, alt: file.name });
                          }
                        } catch (err) { /* ignore here, upload feedback handled in RTE elsewhere */ }
                      }} />
                    </div>
                  </SlideStage>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No slides yet. Add one to start editing.</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditLessonPage;
