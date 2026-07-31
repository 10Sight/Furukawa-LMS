import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SlideEditorWorkspace from "@/components/lesson-editor/SlideEditorWorkspace";
import { useSlidesEditor } from "@/components/lesson-editor/useSlidesEditor";
import { ArrowLeft, Loader2, Save } from "lucide-react";
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
  const editor = useSlidesEditor([]);
  const { slides, setSlides, resetSlides, activeIndex, setActiveIndex, activeSlide, patchActiveSlide } = editor;
  const [saving, setSaving] = useState(false);

  const [addSlide, { isLoading: adding }] = useAddLessonSlideMutation();
  const [updateSlide, { isLoading: updating }] = useUpdateLessonSlideMutation();
  const [deleteSlide, { isLoading: deleting }] = useDeleteLessonSlideMutation();
  const [reorderSlides, { isLoading: reordering }] = useReorderLessonSlidesMutation();
  const [updateLessonMeta, { isLoading: updatingMeta }] = useUpdateLessonMutation();

  useEffect(() => {
    if (!lesson) return;
    setTitle(lesson.title || "");
    // Only hydrate from server if we don't already have local edits. Uses
    // resetSlides (not setSlides) since this is a data load, not a user
    // edit — it shouldn't create an undoable history entry.
    if (Array.isArray(slides) && slides.length > 0) return;
    let sorted = Array.isArray(lesson.slides)
      ? [...lesson.slides].sort((a, b) => (a.order || 0) - (b.order || 0))
      : [];
    // Fallback: if no slides but legacy content exists, synthesize a slide for editing
    if ((!sorted || sorted.length === 0) && lesson.content) {
      sorted = [{ order: 1, contentHtml: String(lesson.content || ''), bgColor: '#ffffff', images: [] }];
    }
    resetSlides(sorted);
    setActiveIndex(0);
  }, [lessonId, lesson]);

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
          resetSlides(sorted);
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

          <SlideEditorWorkspace
            editor={editor}
            onAddSlide={handleAddSlide}
            onRemoveSlide={handleDeleteSlide}
            onMoveSlide={handleMove}
            busy={{ adding, moving: reordering, removing: deleting }}
            headerActions={(
              <Button onClick={handleSaveSlide} disabled={saving || updating} className="ml-2">
                {saving || updating ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4 mr-2"/>}
                Save Slide
              </Button>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default EditLessonPage;
