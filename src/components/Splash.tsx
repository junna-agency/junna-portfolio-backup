"use client";

import gsap from "gsap";
import { useLenis } from "lenis/react";
import { useEffect, useRef, useState } from "react";

/** Each leg of a dot's journey, then the halves parting. */
const LEG = 0.6;
const PART = 0.8;

/** Frames of head positions kept. More frames, longer and finer tail. */
const TRAIL = 64;

/** Head and tail stroke widths, in px. The taper does most of the comet. */
const HEAD_W = 2.4;
const TAIL_W = 0.4;

/** Stacked drop-shadows bloom the whole trail at once, on the GPU. Applied to
 *  the element rather than per stroke, so overlaps cannot pile up. */
const NEON =
  "drop-shadow(0 0 3px rgba(255,255,255,0.85)) drop-shadow(0 0 9px rgba(255,255,255,0.5)) drop-shadow(0 0 22px rgba(255,255,255,0.25))";

/**
 * Intro curtain. Two dots set off from opposite corners, each running half the
 * screen height and then inward, dragging a comet tail behind them. Where they
 * meet is the seam the black splits along to reveal the page.
 *
 * The tail is redrawn from scratch every frame out of a short history of head
 * positions. Both earlier approaches ribbed because they built the tail up
 * incrementally: stacked SVG dashes each end on a hard edge, and stamping onto
 * a decaying canvas composites every new stroke over the last, so round caps
 * overlap and leave a bright bead at each frame's joint. Clearing first means
 * nothing accumulates, and alpha is a plain function of age.
 */
export default function Splash() {
  const [done, setDone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Held until the curtain lifts, so the page cannot be scrolled behind it.
  // Keyed on `done` as well as `lenis`, since the instance arrives a tick late.
  const lenis = useLenis();
  useEffect(() => {
    if (!lenis) return;
    if (done) lenis.start();
    else lenis.stop();
  }, [lenis, done]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const finish = () => setDone(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Measure the curtain, not the window: innerWidth counts the vertical
    // scrollbar but this fixed box does not, so window maths would part the
    // two dots by a scrollbar's width instead of meeting them at the centre.
    const { width, height } = root.getBoundingClientRect();
    const halfH = height / 2;
    const halfW = width / 2;

    // Capped at 2 — past that the extra fill cost buys nothing visible.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const head = { ax: 0, ay: height, bx: width, by: 0 };
    const trails: { x: number; y: number }[][] = [[], []];
    let stamping = true;

    function drawTrail(points: { x: number; y: number }[]) {
      if (!ctx || points.length < 2) return;
      const last = points.length - 1;

      // Butt caps, deliberately: round ones would overlap the neighbouring
      // segment and double-composite into a bead at every joint — the ribbing.
      // Segments abut exactly instead, and share an alpha at the boundary.
      ctx.lineCap = "butt";
      for (let i = 1; i <= last; i++) {
        const t = i / last; // 0 at the tail's end, 1 at the head
        ctx.strokeStyle = `rgba(255,255,255,${t * t})`;
        ctx.lineWidth = TAIL_W + (HEAD_W - TAIL_W) * t;
        ctx.beginPath();
        ctx.moveTo(points[i - 1].x, points[i - 1].y);
        ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
      }

      // Rounds off the leading end, which butt caps leave squared.
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(points[last].x, points[last].y, HEAD_W / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    function paint() {
      if (!ctx) return;

      if (stamping) {
        trails[0].push({ x: head.ax, y: head.ay });
        trails[1].push({ x: head.bx, y: head.by });
      }
      for (const points of trails) {
        // While running, hold the tail at a fixed length. Once the heads stop,
        // keep dropping the oldest point so the tail walks forward into the
        // centre rather than fading on the spot.
        if (stamping) {
          if (points.length > TRAIL) points.shift();
        } else if (points.length) {
          points.shift();
        }
      }

      ctx.clearRect(0, 0, width, height);
      for (const points of trails) drawTrail(points);
    }

    gsap.ticker.add(paint);

    const q = gsap.utils.selector(root);
    const ease = "power2.inOut";
    const tl = gsap.timeline({ onComplete: finish });

    tl
      // Up and down the outer edges.
      .to(head, { ay: halfH, duration: LEG, ease }, 0)
      .to(head, { by: halfH, duration: LEG, ease }, 0)
      // Then inward along the middle, until both land on the centre.
      .to(head, { ax: halfW, duration: LEG, ease }, LEG)
      .to(head, { bx: halfW, duration: LEG, ease }, LEG)
      // Heads stop at the meeting point and the tails are drawn in after them.
      .call(
        () => {
          stamping = false;
        },
        undefined,
        LEG * 2,
      )
      // The seam they drew opens.
      .to(
        q("[data-half=top]"),
        { yPercent: -100, duration: PART, ease: "power3.inOut" },
        LEG * 2 + 0.25,
      )
      .to(
        q("[data-half=bottom]"),
        { yPercent: 100, duration: PART, ease: "power3.inOut" },
        LEG * 2 + 0.25,
      )
      // Whatever is left goes with the curtain, never over the live page.
      .to(canvas, { opacity: 0, duration: 0.4 }, LEG * 2 + 0.25);

    return () => {
      gsap.ticker.remove(paint);
      tl.kill();
    };
  }, []);

  if (done) return null;

  return (
    // Under the cursor's z-100 so the custom cursor stays visible over it,
    // above everything else on the page.
    <div ref={rootRef} aria-hidden className="fixed inset-0 z-90">
      <div data-half="top" className="absolute inset-x-0 top-0 h-1/2 bg-black" />
      <div
        data-half="bottom"
        className="absolute inset-x-0 bottom-0 h-1/2 bg-black"
      />
      {/* Backing store is sized in the effect, once the curtain is measured. */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ filter: NEON }}
      />
    </div>
  );
}
