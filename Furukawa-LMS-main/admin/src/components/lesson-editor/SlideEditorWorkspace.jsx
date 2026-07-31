import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, MoveUp, MoveDown, Palette, Loader2 } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "@/Helper/axiosInstance";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import SlideStage from "@/components/common/SlideStage";
import DraggableCanvas from "@/components/common/DraggableCanvas";
import EditorRibbon from "@/components/lesson-editor/EditorRibbon";
import LayersPanel from "@/components/lesson-editor/LayersPanel";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

/**
 * SlideEditorWorkspace: shared presentational layout for the slide list +
 * ribbon + canvas + layers panel, used by both AddLessonPage and
 * EditLessonPage. Slide-list mutation timing (local-only vs. persist-
 * immediately) stays page-specific via the onAddSlide/onRemoveSlide/
 * onMoveSlide callbacks; everything about editing the active slide's
 * content/elements is driven by the `editor` (useSlidesEditor) instance.
 */
export default function SlideEditorWorkspace({
  editor,
  onAddSlide,
  onRemoveSlide,
  onMoveSlide,
  busy = {},
  disabled = false,
  headerActions = null,
  emptyState = null,
}) {
  const { slides, activeIndex, setActiveIndex, activeSlide, patchActiveSlide, patchContentHtml, addImageElement, addVideoElement } = editor;
  const fileRef = React.useRef(null);
  const videoFileRef = React.useRef(null);
  const [uploadingMedia, setUploadingMedia] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);

  useKeyboardShortcuts(editor);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Sidebar: slides list */}
      <div className="md:col-span-1 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Slides</h4>
          <Button type="button" size="sm" onClick={onAddSlide} className="gap-1" disabled={busy.adding}>
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
        <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
          {slides.map((s, i) => (
            <div
              key={s._id || s.id || i}
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
                <Button type="button" size="icon" variant="outline" disabled={i === 0 || busy.moving} onClick={() => onMoveSlide(i, i - 1)}>
                  <MoveUp className="h-3 w-3" />
                </Button>
                <Button type="button" size="icon" variant="outline" disabled={i === slides.length - 1 || busy.moving} onClick={() => onMoveSlide(i, i + 1)}>
                  <MoveDown className="h-3 w-3" />
                </Button>
                <Button type="button" size="icon" variant="destructive" disabled={busy.removing} onClick={() => onRemoveSlide(i)}>
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
            <EditorRibbon
              editor={editor}
              onInsertImage={() => fileRef.current?.click()}
              onInsertVideo={() => videoFileRef.current?.click()}
              uploadingMedia={uploadingMedia}
              disabled={disabled}
            />

            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-medium flex items-center gap-2 mr-2">
                <Palette className="h-4 w-4" /> Slide Background
              </label>
              <input
                type="color"
                value={activeSlide.bgColor || '#ffffff'}
                onChange={(e) => patchActiveSlide({ bgColor: e.target.value })}
                className="h-8 w-12 border rounded"
                disabled={disabled}
              />
              {headerActions && <div className="ml-auto">{headerActions}</div>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-3">
                <SlideStage bgColor={activeSlide.bgColor || '#ffffff'} transitionKey={activeIndex}>
                  <div className="relative w-full h-full">
                    <RichTextEditor
                      value={activeSlide.contentHtml || ''}
                      onChange={(html) => patchContentHtml(html)}
                      className="bg-transparent"
                      placeholder="Design your slide..."
                      borderless
                    />
                    <DraggableCanvas editor={editor} />
                    <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return; e.target.value = '';
                      try {
                        const fd = new FormData(); fd.append('file', file);
                        const res = await axiosInstance.post('/api/upload/single', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                        const url = res?.data?.data?.url;
                        if (url) addImageElement(url, file.name);
                      } catch { /* ignore here, upload feedback handled in RTE elsewhere */ }
                    }} />
                    <input type="file" accept="video/*" ref={videoFileRef} className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return; e.target.value = '';
                      setUploadingMedia(true);
                      setUploadProgress(0);
                      try {
                        const fd = new FormData(); fd.append('file', file);
                        const res = await axiosInstance.post('/api/upload/single', fd, {
                          headers: { 'Content-Type': 'multipart/form-data' },
                          onUploadProgress: (progressEvent) => {
                            if (progressEvent.total) {
                              setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
                            }
                          },
                        });
                        const url = res?.data?.data?.url;
                        if (url) {
                          addVideoElement(url, file.name);
                        } else {
                          toast.error('Upload succeeded but no URL returned');
                        }
                      } catch (err) {
                        const message = err?.response?.data?.message || err?.message || 'Video upload failed';
                        toast.error(message);
                      } finally {
                        setUploadingMedia(false);
                        setUploadProgress(0);
                      }
                    }} />
                    {uploadingMedia && (
                      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-md">
                        <div className="flex flex-col items-center gap-3 px-6 py-5 rounded-xl bg-white/80 backdrop-blur-md shadow-lg border border-white/40">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                          <div className="text-sm font-medium text-slate-800">Uploading video… {uploadProgress}%</div>
                          <div className="w-40 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 transition-all" style={{ width: `${uploadProgress}%` }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </SlideStage>
              </div>
              <div className="lg:col-span-1">
                <LayersPanel editor={editor} />
              </div>
            </div>
          </>
        ) : (
          emptyState || <div className="text-sm text-muted-foreground">No slides yet. Add one to start editing.</div>
        )}
      </div>
    </div>
  );
}
