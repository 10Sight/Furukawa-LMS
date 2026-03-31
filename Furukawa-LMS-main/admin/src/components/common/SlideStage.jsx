import React from "react";
import clsx from "clsx";
import "./slide-stage.css";

/**
 * SlideStage
 * - Centers a 16:9 slide canvas with a subtle shadow and rounded corners
 * - Adds optional grid/guides overlay to help align content
 * - Applies enter/exit animations when the transitionKey changes
 */
const SlideStage = ({
  bgColor = "#ffffff",
  children,
  className,
  showGrid = true,
  transitionKey,
}) => {
  return (
    <div className={clsx("stage-outer")}
         style={{ '--stage-bg': bgColor }}>
      <div className={clsx("stage-wrapper")}
           role="region"
           aria-label="Slide canvas">
        <div
          key={transitionKey}
          className={clsx(
            "stage-inner",
            "animate-fade-in",
            className
          )}
          style={{ backgroundColor: bgColor }}
        >
          {/* Grid / Guides Overlay */}
          {showGrid && (
            <div className="stage-grid" aria-hidden="true">
              {/* vertical and horizontal center lines */}
              <div className="guide guide-v" />
              <div className="guide guide-h" />
            </div>
          )}
          <div className="stage-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(SlideStage);