"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

/**
 * Fires once when the element has risen into the viewport, then disconnects.
 *
 * A Lenis subscription would run every frame for a one-shot fade; an
 * IntersectionObserver does not. CSS `animation-timeline: view()` is the
 * no-JS version of this, and does not run on this page — same reason
 * `GrowRule` scrubs off Lenis instead.
 *
 * Items already above the fold (reload mid-page, in-page jump) skip the
 * transition so they do not fade up from nowhere.
 */
export function useReveal<T extends HTMLElement>(
  ref: RefObject<T | null>,
  rootMargin = "0px 0px -12% 0px",
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-visible");
      return;
    }

    const show = (instant: boolean) => {
      if (instant) el.style.transition = "none";
      el.classList.add("is-visible");
      io.disconnect();
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        // Already scrolled past: top is above the viewport.
        if (entry.boundingClientRect.top < 0) {
          show(true);
          return;
        }
        if (entry.isIntersecting) show(false);
      },
      // Wait until the item has come a little way in, rather than the first
      // pixel — closer to GrowRule's three-quarters trigger than to the edge.
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
}

/** Wrapper for server components that cannot hold the ref themselves. */
export default function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref);
  return (
    <div ref={ref} className={`reveal ${className}`.trim()}>
      {children}
    </div>
  );
}
