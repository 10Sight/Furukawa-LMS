import React from "react";
import clsx from "clsx";
import "./slide-stage.css";
import { getMediaUrl, convertRelativeToAbsolute } from "@/utils/mediaUtils";

/**
 * SlideRender: read-only renderer for a slide (contentHtml + elements)
 * Renders inside a 16:9 canvas with padding similar to editor stage.
 */
export default function SlideRender({ slide, className }) {
  const bg = slide?.bgColor || '#ffffff';
  const elements = Array.isArray(slide?.elements)
    ? [...slide.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    : [];
  return (
    <div className={clsx("stage-outer", className)}>
      <div className="stage-wrapper">
        <div className="stage-inner" style={{ backgroundColor: bg }}>
          <div className="stage-content relative select-none">
            <div className="prose prose-sm sm:prose-base max-w-none">
              <div dangerouslySetInnerHTML={{ __html: convertRelativeToAbsolute(slide?.contentHtml || '') }} />
            </div>
            {/* Positioned elements */}
            <div className="absolute inset-0">
              {elements.map((el) => (
                <div
                  key={el.id}
                  className="absolute"
                  style={{
                    left: `${el.xPct ?? 0}%`,
                    top: `${el.yPct ?? 0}%`,
                    width: `${el.wPct ?? 0}%`,
                    height: `${el.hPct ?? 0}%`,
                    transform: `rotate(${el.rotation || 0}deg)`
                  }}
                >
                  {el.type === 'text' && (
                    <div className="w-full h-full p-2 overflow-hidden text-[hsl(var(--foreground))]">
                      {el.text || 'Text'}
                    </div>
                  )}
                  {el.type === 'rect' && (
                    <div className="w-full h-full" style={{ background: el.fill || '#e5e7eb', border: `1px solid ${el.stroke || '#d1d5db'}` }} />
                  )}
                  {el.type === 'image' && (
                    <img src={getMediaUrl(el.url)} alt={el.alt || ''} className="w-full h-full object-contain" />
                  )}
                  {el.type === 'video' && (
                    <video
                      src={getMediaUrl(el.url)}
                      controls
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}