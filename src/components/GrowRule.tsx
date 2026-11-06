"use client";

import { useLenis } from "lenis/react";
import { useCallback, useEffect, useRef } from "react";

/**
 * Trigger point and duration, both matching `HeroDivider`: the draw starts
 * when the rule crosses three quarters of the way down the viewport and runs
 * for this fraction of the viewport height. Keep the two in step — they read
 * as the same gesture, so retuning one means retuning the other.
 *
 * Near the bottom of the page there may not be `TRAVEL` viewport-heights of
 * scroll left; `measure` shortens the run so progress still reaches 1 by the
 * document end instead of stalling mid-line.
 */
const START = 0.75;
const TRAVEL = 0.5;

/**
 * A rule that draws itself from the left as it scrolls up the viewport.
 *
 * A CSS `animation-timeline: view()` does exactly this with no JS, and was the
 * first thing tried — it did not run on this page. Rather than keep two
 * mechanisms for the same effect, this scrubs off Lenis like `HeroDivider`,
 * which is known to work here.
 */
export default function GrowRule({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Everything the per-frame path needs, in document coordinates. Measured
  // only on mount and resize: reading layout inside the scroll callback cost a
  // forced reflow every frame, and this rule's document position cannot change
  // without a resize anyway.
  const geom = useRef({ start: 0, travel: 1, reduced: false });

  /** Write-only: no DOM reads, so this cannot invalidate layout. */
  const draw = useCallback((scroll: number) => {
    const el = ref.current;
    if (!el) return;
    const { start, travel, reduced } = geom.current;

    // Scroll-linked motion is the kind reduced-motion is about. Draw it in
    // full rather than leaving a rule that never finishes.
    const p = reduced
      ? 1
      : Math.min(1, Math.max(0, (scroll - start) / travel));

    el.style.transform = `scaleX(${p})`;
  }, []);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const vh = window.innerHeight;
    const top = el.getBoundingClientRect().top + window.scrollY;
    // ScrollY when the rule sits at START of the viewport — animation begins.
    const start = top - vh * START;
    const idealTravel = vh * TRAVEL;
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - vh,
    );
    // If the page ends before idealTravel, compress so scaleX hits 1 at bottom.
    const travel = Math.max(1, Math.min(idealTravel, maxScroll - start));
    geom.current = {
      start,
      travel,
      reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
    draw(window.scrollY);
  }, [draw]);

  // Lenis' own scroll value rather than `window.scrollY` — it is the position
  // Lenis just applied, and reading it touches no DOM at all.
  useLenis((lenis) => draw(lenis.scroll));

  useEffect(() => {
    // Lenis only reports scrolling, so the first paint and every resize need
    // their own pass — reloading below this point would otherwise leave the
    // rule undrawn until the next wheel event.
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div
      ref={ref}
      aria-hidden
      // Inline start value so it is not full-width for the frame before the
      // mount pass runs.
      style={{ transform: "scaleX(0)", transformOrigin: "left center" }}
      className={`h-px w-full origin-left ${className}`}
    />
  );
}
