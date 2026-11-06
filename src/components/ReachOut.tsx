"use client";

import gsap from "gsap";
import Image from "next/image";
import posthog from "posthog-js";
import { useEffect, useRef } from "react";

import { reachOut } from "@/content";

import { useReveal } from "./Reveal";

const WIPE = 0.5;
/** Width of the soft leading edge. */
const FADE = "8rem";

export default function ReachOut() {
  const fillRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLAnchorElement>(null);
  useReveal(cardRef);

  // Hand the start state to GSAP explicitly. The inline `translateX(-100%)`
  // exists so the fill is parked off-card on the first paint, but GSAP reads
  // transforms out of the computed matrix, where that percentage has already
  // resolved to pixels — it saw `x: -width, xPercent: 0`, so tweening xPercent
  // to 0 animated nothing and the fill never came in. Zeroing x is the point:
  // without it the two offsets stack.
  useEffect(() => {
    if (fillRef.current) gsap.set(fillRef.current, { x: 0, xPercent: -100 });
  }, []);

  /** Slides in from the left on enter, back out to the left on leave. */
  function wipe(inward: boolean) {
    const fill = fillRef.current;
    if (!fill) return;
    gsap.to(fill, {
      // Translate, not scaleX: scaling squashes the gradient along with the
      // element, so the soft edge would be hairline at the start and only
      // reach full width at the end. Translating keeps it a constant width.
      xPercent: inward ? 0 : -100,
      duration: WIPE,
      // Deliberately not the ease-out the photo and icon use: the wipe leads
      // with a slow edge and snaps through the middle. Peak velocity is high,
      // so keep this layer promoted — a dropped frame here reads as a jump.
      ease: "expo.inOut",
      overwrite: true,
    });
  }

  return (
    <section id="contact" className="shell w-full pb-24">
      <a
        ref={cardRef}
        href={reachOut.href}
        target="_blank"
        rel="noopener noreferrer"
        // Hover wipe is fine-pointer only — touch would leave it stuck after tap.
        // Focus still runs it for keyboard. Coarse pointers get the static card.
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse" || e.pointerType === "pen") wipe(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse" || e.pointerType === "pen") wipe(false);
        }}
        onFocus={() => wipe(true)}
        onBlur={() => wipe(false)}
        onClick={() => posthog.capture("contact_calendar_opened")}
        // No backdrop-blur here: the page-wide glass panel already blurs the
        // video behind this card, and a second backdrop-filter over live
        // footage re-rasterises the whole card on every frame of the wipe.
        className="reveal group relative flex min-h-[160px] flex-col justify-end overflow-hidden rounded-lg bg-white/10 p-8 text-white"
      >
        {/* Transform composites; animating width would relayout every frame.
            Kept in normal flow rather than `-z-10` — a negative-z child paints
            between the parent's background and its content, which Chrome will
            not promote to its own layer, so the wipe ran on the main thread.
            GSAP owns the transform, hence the inline start value.

            One FADE wider than the card, with the gradient's tail in that extra
            width: at rest the whole thing sits off to the left, and once in, the
            solid part covers the card while the soft tail hangs past the right
            edge where `overflow-hidden` clips it. So the leading edge is never a
            hard line, and no soft edge is left sitting on the card at full
            hover. */}
        <span
          ref={fillRef}
          aria-hidden
          style={{
            width: `calc(100% + ${FADE})`,
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.2) calc(100% - ${FADE}), rgba(255,255,255,0) 100%)`,
            transform: "translateX(-100%)",
            willChange: "transform",
          }}
          className="pointer-events-none absolute inset-y-0 left-0"
        />

        {/* Stack on phones so the CTA isn't crushed beside the photo;
            side-by-side from sm up where there's room. */}
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
          {/* Wrapper does the clipping so the image can be scaled up inside
              it — the zoom is anchored near the face, not the centre. */}
          <div className="h-32 w-32 shrink-0 overflow-hidden rounded-lg transition-transform duration-500 ease-out group-hover:scale-105 sm:h-44 sm:w-44 lg:h-52 lg:w-52">
            <Image
              src={reachOut.photo}
              alt=""
              aria-hidden
              onContextMenu={(event) => event.preventDefault()}
              width={568}
              height={568}
              sizes="(max-width: 640px) 128px, 208px"
              className="h-full w-full origin-[50%_24%] scale-[1.45] object-cover"
            />
          </div>

          <span className="flex items-center gap-4 text-[clamp(1.75rem,5vw,3rem)] font-light uppercase leading-[1.05] tracking-[-0.02em]">
            {reachOut.label}
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-[0.8em] w-[0.8em] shrink-0 transition-transform duration-500 ease-out group-hover:-translate-y-1 group-hover:translate-x-1"
            >
              <path
                d="M7 17 17 7M8 7h9v9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </a>
    </section>
  );
}
