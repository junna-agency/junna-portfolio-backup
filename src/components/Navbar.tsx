"use client";

import { useLenis } from "lenis/react";
import { useEffect, useState } from "react";

import { sections } from "@/content";

type Section = (typeof sections)[number];

/** Shared by both faces of the roll, so they cannot drift out of sync.
 *  Positioning is left to each, since only the outgoing face is taken out
 *  of flow — the incoming one keeps the window's height honest. */
const FACE = "block truncate [backface-visibility:hidden]";
const ROLL = "500ms cubic-bezier(0.33,1,0.68,1) both";

export default function Navbar() {
  // Both faces live in one piece of state so the swap is a single pure update:
  // the outgoing label has to stay mounted long enough to roll away.
  const [{ cur, prev }, setLabel] = useState<{
    cur: Section;
    prev: Section | null;
  }>({ cur: sections[0], prev: null });
  const active = cur;
  const lenis = useLenis();

  // A plain anchor jumps instantly: Lenis only drives wheel and touch, and the
  // native smooth-scroll was dropped from globals.css when Lenis took over.
  function scrollTo(e: React.MouseEvent, id: string) {
    const target = document.getElementById(id);
    if (!lenis || !target) return;
    e.preventDefault();
    lenis.scrollTo(target);
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((entry) => entry.isIntersecting);
        const match = sections.find((s) => s.id === hit?.target.id);
        if (!match) return;
        // Pure updater, so the previous label is captured without a ref or a
        // stale closure over `cur`.
        setLabel((s) =>
          s.cur.id === match.id ? s : { cur: match, prev: s.cur },
        );
      },
      // A 1px band across the viewport middle: whichever section crosses it wins.
      { rootMargin: "-50% 0px -50% 0px" },
    );

    for (const { id } of sections) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    // Centre the nav on the same viewport axis as the project intro. `shell`
    // still supplies responsive side clearance on narrow screens.
    // pointer-events-none on the full-width track: it spans the viewport even
    // though the pill sits at the left, and at z-50 it would otherwise swallow
    // clicks on anything crossing that band — the hero's top social button does.
    <div className="shell pointer-events-none fixed inset-x-0 top-[calc(2rem+env(safe-area-inset-top,0px))] z-50 flex justify-center">
      <nav className="pointer-events-auto relative flex w-[220px] flex-col items-center gap-1 rounded-lg px-3 py-2 text-white">
        <a
          href={`#${active.id}`}
          onClick={(e) => scrollTo(e, active.id)}
          className="w-full min-w-0 px-4 py-0.5 text-center text-sm font-medium"
        >
          {/* Perspective has to sit on the parent for the faces to read as 3D
              rather than a flat squash. The window clips them to one line, so
              nothing spills into the link's padding mid-roll. */}
          <span className="relative block h-5 overflow-hidden leading-5 [perspective:340px]">
            {prev && (
              // Hinged at the bottom, turning the same way as the incoming
              // face — the front of the die on its way to becoming the base.
              <span
                key={`out-${prev.id}`}
                className={`${FACE} absolute inset-0 origin-bottom`}
                style={{ animation: `roll-out ${ROLL}` }}
                // Dropped as soon as it is off screen, rather than on a timer.
                onAnimationEnd={() => setLabel((s) => ({ ...s, prev: null }))}
              >
                {prev.label}
              </span>
            )}
            {/* Keyed on the section so a change remounts it and replays the
                roll. Static rather than absolute, so it sets the line height. */}
            <span
              key={cur.id}
              className={`${FACE} origin-top`}
              style={{ animation: `roll-in ${ROLL}` }}
            >
              {cur.label}
            </span>
          </span>
        </a>
        <div className="relative flex h-3 w-[76px] shrink-0 items-center justify-between">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-white/20"
          />
          {sections.map((section) => {
            const selected = section.id === active.id;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-label={`Go to ${section.label}`}
                aria-current={selected ? "location" : undefined}
                onClick={(e) => scrollTo(e, section.id)}
                className="group relative grid size-4 place-items-center"
              >
                <span
                  aria-hidden
                  className={`rounded-full transition-[width,height,background-color,box-shadow] duration-300 ease-out ${
                    selected
                      ? "size-2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                      : "size-1.5 bg-neutral-400 group-hover:bg-white"
                  }`}
                />
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
