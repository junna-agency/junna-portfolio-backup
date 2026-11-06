"use client";

import posthog from "posthog-js";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import { projects, projectsIntro } from "@/content";

import ProjectDetail from "./ProjectDetail";
import ProjectLightbox, { type LightboxImage } from "./ProjectLightbox";
import ProjectRow from "./ProjectRow";
import ProjectWheel from "./ProjectWheel";
import Reveal from "./Reveal";

type Box = { top: number; height: number };

const boxOf = (el: HTMLElement): Box => ({
  top: el.offsetTop,
  height: el.offsetHeight,
});

/**
 * Stays inside the list. The list is already the right-hand column, so a
 * full-viewport bar would slide under the parked head.
 */
const HIGHLIGHT =
  "pointer-events-none absolute left-0 top-0 h-px w-full origin-top bg-white/10 duration-300 ease-out";

/** Extra dynamic-viewport-height percentage per project while the stage is pinned.
 *  Count is `projects.length`, not `length - 1`, so the last card has a full
 *  slot before the pin releases. */
const SLOT_DVH = 45;

export default function Projects() {
  const listRef = useRef<HTMLUListElement>(null);
  const hoveredRef = useRef<HTMLElement | null>(null);
  const openLayer = useRef<HTMLDivElement>(null);
  const hoverLayer = useRef<HTMLDivElement>(null);
  /**
   * Geometry is kept even while hidden, so a layer fades out in place instead
   * of sliding back to the top of the list on its way out — hence a remembered
   * box rather than a null one.
   */
  const openBox = useRef<Box | null>(null);
  const hoverBox = useRef<Box | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [wide, setWide] = useState(true);
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);
  const sawIndex = useRef(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      setReduced(motion.matches);
      setWide(desktop.matches);
    };
    sync();
    motion.addEventListener("change", sync);
    desktop.addEventListener("change", sync);
    return () => {
      motion.removeEventListener("change", sync);
      desktop.removeEventListener("change", sync);
    };
  }, []);

  /**
   * Writes straight to the DOM instead of through state. The ResizeObserver
   * below fires on every frame of a row expanding, and routing that through
   * React re-rendered this component ~60 times per interaction for values that
   * only ever land on two elements.
   */
  const paint = useCallback(
    (
      el: HTMLDivElement | null,
      box: Box | null,
      visible: boolean,
      slide: boolean,
    ) => {
      if (!el) return;
      el.style.transform = `translate3d(0, ${box?.top ?? 0}px, 0) scaleY(${box?.height ?? 0})`;
      el.style.opacity = visible ? "1" : "0";
      // Only ease when moving between rows. While a row animates open or
      // closed the observer already feeds a smooth value every frame, and
      // easing toward each one leaves the highlight trailing the row's border.
      el.classList.toggle("transition-[transform,opacity]", slide);
      el.classList.toggle("will-change-transform", slide);
      el.classList.toggle("transition-opacity", !slide);
    },
    [],
  );

  const measure = useCallback(
    (slide: boolean) => {
      const list = listRef.current;
      if (!list) return;
      // Every read happens before every write, so nothing here forces a second
      // layout inside one callback.
      //
      // Rows own their open state, so read it back off the DOM rather than
      // lifting it — the button already reports it for assistive tech.
      const open = list.querySelector<HTMLElement>(
        ':scope > li:has(button[aria-expanded="true"])',
      );
      const hovered = hoveredRef.current;
      const openNext = open ? boxOf(open) : null;
      // Skip the hover layer on the open row, or the two stack and read twice
      // as bright as every other row.
      const hoverNext = hovered && hovered !== open ? boxOf(hovered) : null;
      // Only overwrite geometry when there is some, so a layer on its way out
      // keeps the box it is fading from.
      if (openNext) openBox.current = openNext;
      if (hoverNext) hoverBox.current = hoverNext;

      paint(openLayer.current, openBox.current, !!openNext, slide);
      paint(hoverLayer.current, hoverBox.current, !!hoverNext, slide);
    },
    [paint],
  );

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // Rows animate their height open and closed, so the highlight has to
    // re-measure while that runs or it keeps the row's old size. Tracked
    // instantly, so its edges stay glued to the row's border.
    const observer = new ResizeObserver(() => measure(false));
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    const project = projects[index];
    if (!project) return;
    window.dispatchEvent(
      new CustomEvent("portfolio:project-change", { detail: index }),
    );
    // The first project is visible on arrival; this event is for picking one.
    if (!sawIndex.current) {
      sawIndex.current = true;
      return;
    }
    posthog.capture("project_details_opened", {
      project_name: project.name,
      project_category: project.event ?? "portfolio",
      project_rank: project.rank ?? "unranked",
    });
  }, [index]);

  function trackRow(e: PointerEvent) {
    // Hover highlight is a mouse/pen affordance. On touch it sticks after tap
    // and fights the expand interaction — skip it on coarse pointers.
    if (e.pointerType === "touch") return;
    // Walk up to the direct child of the list — `closest("li")` would stop at
    // a tag chip, since those are list items too.
    let el = e.target as HTMLElement | null;
    while (el && el.parentElement !== listRef.current) el = el.parentElement;
    if (!el) return;
    // pointerover re-fires for every descendant the pointer enters, so most
    // calls are just noise from moving within one row. Bail on those: they
    // would otherwise re-run measure mid-slide and cancel the transition.
    if (el === hoveredRef.current) return;
    hoveredRef.current = el;
    measure(true);
  }

  const selected = projects[index] ?? projects[0];
  const pin = wide && !reduced;

  return (
    <section
      ref={sectionRef}
      id="projects"
      className="pt-32 relative z-10 w-full shrink-0"
      style={
        pin
          ? {
              height: `calc(100dvh + ${projects.length * SLOT_DVH}dvh)`,
              minHeight: `calc(100dvh + ${projects.length * SLOT_DVH}dvh)`,
            }
          : undefined
      }
    >
      {/* Full-width viewport stage. Sticks once this block fills the screen;
          further scroll turns the wheel instead of moving the stage. `shell`
          lives inside so the pin is the whole viewport, not the 1440 column. */}
      <div
        className={
          pin
            ? "hidden lg:sticky lg:top-0 lg:z-10 lg:flex lg:h-dvh lg:w-full lg:flex-col"
            : "hidden lg:flex lg:min-h-dvh lg:w-full lg:flex-col lg:justify-center"
        }
      >
        <div className="shell relative flex min-h-0 w-full flex-1 flex-col justify-center pt-32 pb-10">
          {/* The stage is already sticky, so anchoring the intro to it keeps
              this copy still while project details of different heights swap. */}
          <div className="absolute inset-x-0 top-[clamp(5rem,11dvh,8rem)] flex h-[4.5rem] justify-center">
            <p className="w-[38rem] text-center font-instrument text-[28px] leading-9 font-medium uppercase xl:text-[31px]">
              {projectsIntro.map((line) => (
                <span key={line} className="block whitespace-nowrap">
                  {line}
                </span>
              ))}
            </p>
          </div>

          <div className="translate-y-[2dvh] lg:ml-auto lg:w-[66%]">
            {/* Preserve the intro's original space in the centered composition. */}
            <div aria-hidden className="h-[5.5rem]" />

            <div className="flex items-start gap-10">
              {selected && (
                <ProjectDetail
                  project={selected}
                  onPhotoOpen={(photo) =>
                    setLightbox({ project: selected, photo })
                  }
                />
              )}
              {/* Holds the wheel's column while the wheel itself is positioned
                  against the viewport-height stage below. */}
              <div aria-hidden className="w-[20rem] shrink-0" />
            </div>
          </div>
          <ProjectWheel
            projects={projects}
            index={index}
            onIndex={setIndex}
            reduced={reduced}
            sectionRef={sectionRef}
            scrollLinked={pin}
          />
        </div>
      </div>

      <div className="shell pt-24 pb-24 lg:hidden">
        <div className="flex flex-col gap-10 pb-10">
          <Reveal>
            <p className="max-w-[320px] text-[16px] font-semibold uppercase leading-5 tracking-[-0.02em] text-white">
              {projectsIntro.map((line, i) => (
                <span key={line}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))}
            </p>
          </Reveal>
        </div>

        <ul
          ref={listRef}
          onPointerOver={trackRow}
          onPointerLeave={() => {
            hoveredRef.current = null;
            measure(false);
          }}
          className="relative border-t border-white/10"
        >
          {/* Two layers, same look: one stays on the expanded row, one slides to
              whichever row is hovered. Both come first in the tree and the rows
              are positioned, so rows paint over them without any z-index.
              Heights vary per row, hence the measured geometry.

              Transform and transition classes are owned by `paint`, not by the
              render — these only carry the static look and the hidden start. */}
          <div
            ref={openLayer}
            aria-hidden
            className={HIGHLIGHT}
            style={{ opacity: 0 }}
          />
          <div
            ref={hoverLayer}
            aria-hidden
            className={HIGHLIGHT}
            style={{ opacity: 0 }}
          />
          {projects.map((project) => (
            <ProjectRow
              key={project.name}
              project={project}
              onPhotoOpen={(photo) => setLightbox({ project, photo })}
            />
          ))}
        </ul>
      </div>
      <ProjectLightbox
        image={lightbox}
        onClose={() => setLightbox(null)}
      />
    </section>
  );
}
