"use client";

import { useLenis } from "lenis/react";
import { useCallback, useEffect, useRef } from "react";

/**
 * How much scroll the hand-off takes, as a fraction of the viewport height.
 * The split starts when the hero's line crosses the middle of the screen.
 */
const TRAVEL = 0.5;

/**
 * The hero's bottom rule splits at its centre and retreats to both ends, while
 * a second rule grows out of the centre of the hero's bottom edge. Both are
 * driven by the same progress value, so the gap opening above is always exactly
 * as long as the line appearing below — the rule reads as one piece handed down
 * rather than two separate fades.
 *
 * Scroll-linked, so it is scrubbed rather than tweened: the value has to track
 * the scroll position exactly, and a GSAP tween toward each new value would
 * lag behind it.
 */
export default function HeroDivider() {
  const railRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLSpanElement>(null);
  const rightRef = useRef<HTMLSpanElement>(null);
  const nextRef = useRef<HTMLSpanElement>(null);

  // Everything the per-frame path needs, in document coordinates. Measured
  // only on mount and resize: reading layout inside the scroll callback cost a
  // forced reflow every frame, and the rail's document position cannot change
  // without a resize anyway.
  const geom = useRef({ top: 0, vh: 0, reduced: false });

  /** Write-only: no DOM reads, so this cannot invalidate layout. */
  const draw = useCallback((scroll: number) => {
    const { top, vh, reduced } = geom.current;

    // Scroll-linked motion is the kind reduced-motion is actually about, so
    // hold the hero rule whole and never show the second one.
    const p = reduced
      ? 0
      : Math.min(
          1,
          Math.max(0, ((vh / 4) * 3 - (top - scroll)) / (vh * TRAVEL)),
        );

    // Each half shrinks toward its outer end, so the gap they leave is centred
    // and `p` of the full width — the same length the line below has grown to.
    if (leftRef.current) leftRef.current.style.transform = `scaleX(${1 - p})`;
    if (rightRef.current) rightRef.current.style.transform = `scaleX(${1 - p})`;
    if (nextRef.current) nextRef.current.style.transform = `scaleX(${p})`;
  }, []);

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    geom.current = {
      top: rail.getBoundingClientRect().top + window.scrollY,
      vh: window.innerHeight,
      reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
    draw(window.scrollY);
  }, [draw]);

  // Lenis' own scroll value rather than `window.scrollY` — it is the position
  // Lenis just applied, and reading it touches no DOM at all.
  useLenis((lenis) => draw(lenis.scroll));

  useEffect(() => {
    // Lenis only reports scrolling, so the first paint and every resize need
    // their own pass — reloading partway down the page would otherwise show an
    // unsplit rule until the next wheel event.
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <>
      <div ref={railRef} aria-hidden className="flex h-px w-full">
        <span ref={leftRef} className="h-px w-1/2 origin-left bg-white/40" />
        <span ref={rightRef} className="h-px w-1/2 origin-right bg-white/40" />
      </div>

      {/* Sits on the hero's bottom edge. An absolute box resolves against the
          padding box, so it is inset by the gutter to line up with the content
          column instead of spanning shell's padding. */}
      <span
        ref={nextRef}
        aria-hidden
        // Inline start value so it is not full-width for the frame before the
        // mount pass runs.
        style={{ transform: "scaleX(0)" }}
        className="absolute bottom-0 left-[var(--gutter)] right-[var(--gutter)] h-px origin-center bg-white/40"
      />
    </>
  );
}
