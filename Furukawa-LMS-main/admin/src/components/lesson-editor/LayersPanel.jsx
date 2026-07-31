import React from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Lock, Unlock, ChevronUp, ChevronDown, Type, Square, Image as ImageIcon, Video as VideoIcon, Layers } from "lucide-react";

const ICONS = { text: Type, rect: Square, image: ImageIcon, video: VideoIcon };

const labelFor = (el) => {
  if (el.type === 'text') return el.text ? el.text.slice(0, 24) : 'Text box';
  if (el.type === 'rect') return 'Shape';
  if (el.type === 'image') return el.alt || 'Image';
  if (el.type === 'video') return el.alt || 'Video';
  return el.type;
};

/**
 * LayersPanel: lists the active slide's elements top-to-bottom by zIndex
 * (topmost layer first, matching PowerPoint's Selection Pane convention).
 */
export default function LayersPanel({ editor }) {
  const elements = editor.activeSlide?.elements || [];
  const layered = [...elements].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));

  if (layered.length === 0) {
    return (
      <div className="text-xs text-muted-foreground p-3 text-center border rounded-md border-dashed">
        No elements on this slide yet.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground px-1">
        <Layers className="h-3.5 w-3.5" /> Layers
      </div>
      <div className="space-y-1 max-h-[260px] overflow-auto pr-1">
        {layered.map((el) => {
          const Icon = ICONS[el.type] || Square;
          const selected = editor.selectedIds.includes(el.id);
          return (
            <div
              key={el.id}
              className={clsx(
                "group flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs cursor-pointer transition-colors",
                selected ? "border-blue-500 bg-blue-50/40" : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
              )}
              onClick={(e) => editor.selectElement(el.id, { additive: e.shiftKey || e.ctrlKey || e.metaKey })}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{labelFor(el)}</span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  type="button" size="icon" variant="ghost" className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); editor.bringForward([el.id]); }}
                  title="Bring forward"
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  type="button" size="icon" variant="ghost" className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); editor.sendBackward([el.id]); }}
                  title="Send backward"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button
                  type="button" size="icon" variant="ghost" className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); editor.updateElements([el.id], { locked: !el.locked }); }}
                  title={el.locked ? 'Unlock' : 'Lock'}
                >
                  {el.locked ? <Lock className="h-3 w-3 text-amber-600" /> : <Unlock className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
