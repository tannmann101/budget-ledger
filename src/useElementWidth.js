import { useRef, useState, useLayoutEffect } from "react";

// Tracks an element's rendered width so SVG charts can draw at true pixel
// size (readable text, no sideways scrolling) instead of scaling a fixed
// desktop-sized viewBox down to a phone screen.
export function useElementWidth(fallback = 700) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width) || fallback);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width) || fallback));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width];
}
