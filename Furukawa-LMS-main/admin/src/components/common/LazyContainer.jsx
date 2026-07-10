import React, { useEffect, useRef, useState } from 'react';
import { Skeleton } from "@/components/ui/skeleton";

// Renders `children` only once this container has entered (or is close to) the
// viewport. Keeps the mounted content in place afterwards so scrolling back up
// doesn't re-trigger the underlying API queries.
const LazyContainer = ({ children, minHeight = 400, rootMargin = "200px" }) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (isVisible) return;

    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible, rootMargin]);

  return (
    <div ref={containerRef} style={{ minHeight: isVisible ? undefined : minHeight }}>
      {isVisible ? children : <Skeleton className="w-full h-full" style={{ height: minHeight }} />}
    </div>
  );
};

export default LazyContainer;
