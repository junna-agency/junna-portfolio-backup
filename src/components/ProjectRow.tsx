"use client";

import gsap from "gsap";
import Image from "next/image";
import posthog from "posthog-js";
import { memo, useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { projectLightbox } from "@/content";

import { useReveal } from "./Reveal";

/** Row grows/shrinks to make room before the photos travel. */
const EXPAND = 0.3;
const DOWN = 0.35;
const ACROSS = 0.45;
/** Travel time for one photo, both legs. */
const MOVE = DOWN + ACROSS;
const STAGGER = 0.04;
const PANEL = 0.4;
/** Ceiling on expanded photo height, in rem. */
const MAX_PHOTO_H = 22;

/**
 * Medal colours for placements. Tinted fills rather than solid ones, so the
 * badges stay legible over the video backdrop without shouting. `rank` is a
 * free string ("Finalist" and the like), hence the fallback.
 */
export const RANK_STYLE: Record<string, string> = {
  "1st": "bg-amber-300/15 text-amber-200 ring-amber-300/35",
  "2nd": "bg-zinc-300/15 text-zinc-200 ring-zinc-300/35",
  "3rd": "bg-orange-400/15 text-orange-300 ring-orange-400/35",
  default: "bg-white/10 text-white ring-white/20",
};

/**
 * The one row currently expanded. Rows are siblings on a single page, so a
 * module-level pointer is enough to make this an accordion — no lifted state,
 * no context, and each row keeps owning its own animation.
 */
let openRow: (() => void) | null = null;

export type Project = {
  name: string;
  url?: string;
  tags: string[];
  photos: string[];
  description: string;
  /** Hackathon or event this was built at. Omit for client work. */
  event?: string;
  /** Placement at that event, e.g. "1st" or "Finalist". Omit if not placed. */
  rank?: string;
  /** Longer write-up shown when the row is expanded. Falls back to description. */
  detail?: string;
};

/**
 * memo: the parent re-renders on every frame of an expand/collapse, because the
 * hover highlight re-measures from a ResizeObserver. `projects` is a
 * module-level constant, so each `project` prop is referentially stable and
 * every one of those re-renders is skippable.
 */
export default memo(function ProjectRow({
  project,
  onPhotoOpen,
}: {
  project: Project;
  onPhotoOpen: (photo: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Real aspect ratio per photo, read off the decoded image.
  const [ratios, setRatios] = useState<number[]>([]);

  // onLoad never fires for an image the browser already has cached, so this
  // gets called from the ref as well, where `complete` is already true.
  function captureRatio(i: number, img: HTMLImageElement | null) {
    if (!img?.complete || !img.naturalHeight) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    setRatios((prev) => {
      if (prev[i] === ratio) return prev;
      const next = [...prev];
      next[i] = ratio;
      return next;
    });
  }
  // The photo travel needs the two-column desktop layout to move between. Below
  // `lg` the photos already sit full-width above the panel, so there is nowhere
  // to travel to — the row just reveals its write-up.
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const photosOpen = open && wide;

  const panelId = useId();
  const photoRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLLIElement>(null);
  useReveal(rowRef);

  // Re-pointed every render so the accordion never calls a stale closure.
  const collapse = useRef<() => void>(undefined);
  collapse.current = () => {
    const panel = panelRef.current;
    if (!wide) {
      panelOnly(false);
      return;
    }
    // Fade the write-up out *before* the layout changes. Once the row
    // collapses the panel jumps up into the space the photos still visually
    // occupy, so fading it afterwards shows it sitting on top of them.
    if (panel) {
      gsap.killTweensOf(panel);
      gsap.to(panel, {
        opacity: 0,
        duration: PANEL,
        ease: "power2.in",
        onComplete: () => move(false),
      });
    } else {
      move(false);
    }
  };
  // Stable identity, so it can be compared against `openRow`.
  const closeSelf = useRef(() => collapse.current?.());

  /** Reveal/hide just the write-up — no photo travel, no row height freeze. */
  function panelOnly(willOpen: boolean) {
    setOpen(willOpen);
    const panel = panelRef.current;
    if (!panel) return;
    gsap.killTweensOf(panel);
    gsap.to(panel, {
      height: willOpen ? "auto" : 0,
      opacity: willOpen ? 1 : 0,
      duration: PANEL,
      ease: willOpen ? "power2.out" : "power2.in",
    });
  }

  function toggle() {
    const els = photoRefs.current.filter((el) => el !== null);
    const panel = panelRef.current;
    const row = rowRef.current;
    const willOpen = !open;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Only one row open at a time.
    if (willOpen) {
      posthog.capture("project_details_opened", {
        project_name: project.name,
        project_category: project.event ?? "portfolio",
        project_rank: project.rank ?? "unranked",
      });
      if (openRow && openRow !== closeSelf.current) openRow();
      openRow = closeSelf.current;
    } else if (openRow === closeSelf.current) {
      openRow = null;
    }

    if (reduced || els.length === 0 || !row) {
      setOpen(willOpen);
      if (panel) {
        gsap.set(panel, {
          height: willOpen ? "auto" : 0,
          opacity: willOpen ? 1 : 0,
        });
      }
      return;
    }

    if (!wide) {
      panelOnly(willOpen);
      return;
    }

    if (!willOpen) {
      collapse.current?.();
      return;
    }

    move(true);
  }

  function move(willOpen: boolean) {
    const els = photoRefs.current.filter((el) => el !== null);
    const panel = panelRef.current;
    const row = rowRef.current;
    if (!row) return;

    // FLIP, first half: where things are now.
    const first = els.map((el) => el.getBoundingClientRect());
    const rowFrom = row.getBoundingClientRect().height;

    // Commit the final layout — true ratios, centred — before measuring, so
    // FLIP carries each photo straight to where it actually ends up.
    flushSync(() => setOpen(willOpen));

    gsap.killTweensOf([row, ...els]);
    if (panel) gsap.killTweensOf(panel);

    // Measure the row's resting height with the panel collapsed, then add the
    // panel back in, so `rowTo` is where the row actually ends up.
    if (panel) gsap.set(panel, { height: 0 });
    const rowTo =
      row.getBoundingClientRect().height +
      (willOpen ? (panel?.firstElementChild?.scrollHeight ?? 0) : 0);

    // Freeze synchronously — before the browser paints. Inside the timeline
    // this lands a tick late and the photos flash over the rows below.
    gsap.set(row, { height: rowFrom });

    els.forEach((el, i) => {
      const from = first[i];
      const to = el.getBoundingClientRect();
      gsap.set(el, {
        x: from.left - to.left,
        y: from.top - to.top,
        scaleX: from.width / to.width,
        scaleY: from.height / to.height,
        transformOrigin: "top left",
      });
    });

    const tl = gsap.timeline();
    const lastPhoto = (els.length - 1) * STAGGER;

    if (willOpen) {
      // 1. Row opens up first, so there is room to move into.
      tl.to(row, { height: rowTo, duration: EXPAND, ease: "power2.inOut" }, 0);

      els.forEach((el, i) => {
        const at = EXPAND + i * STAGGER;
        // 2. Straight down at thumbnail size — y only, so the photo drops
        //    under the column it started in rather than drifting sideways.
        tl.to(el, { y: 0, duration: DOWN, ease: "power2.inOut" }, at);
        // 3. Then spread and grow into the final box in one move. That box is
        //    already the photo's true ratio at the shared row height, so there
        //    is no second reshape afterwards.
        tl.to(
          el,
          { x: 0, scaleX: 1, scaleY: 1, duration: ACROSS, ease: "power2.out" },
          at + DOWN,
        );
      });

      // 4. Write-up fades in as the last photo lands.
      if (panel) {
        tl.fromTo(
          panel,
          { height: 0, opacity: 0 },
          { height: "auto", opacity: 1, duration: PANEL, ease: "power2.out" },
          EXPAND + lastPhoto + MOVE - PANEL,
        );
      }
    } else {
      // Rewind of the open sequence. The write-up already faded out before
      // the layout changed, so it only has to give up its height here.
      if (panel) tl.set(panel, { height: 0 }, 0);

      els.forEach((el, i) => {
        // Last photo out leads, mirroring the open stagger.
        const at = (els.length - 1 - i) * STAGGER;
        // 2. Right, shrinking back to thumbnail size.
        tl.to(
          el,
          {
            x: 0,
            scaleX: 1,
            scaleY: 1,
            duration: ACROSS,
            ease: "power2.inOut",
          },
          at,
        );
        // 3. Then up into the row.
        tl.to(el, { y: 0, duration: DOWN, ease: "power2.out" }, at + ACROSS);
      });

      // 4. Row closes only once every photo is home.
      tl.to(
        row,
        { height: rowTo, duration: EXPAND, ease: "power2.inOut" },
        lastPhoto + MOVE,
      );
    }

    // Back to auto so the row still reflows on resize.
    tl.set(row, { clearProps: "height" });
  }

  return (
    // relative so the row paints above the list's sliding hover highlight.
    <li
      ref={rowRef}
      className="reveal relative border-b border-white/10 bg-black/25"
    >
      <div className="grid w-full grid-cols-1 gap-4 py-6 lg:grid-cols-12 lg:items-center lg:gap-6">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="grid cursor-pointer grid-cols-1 gap-4 text-left lg:col-span-7 lg:grid-cols-7 lg:items-center lg:gap-6"
        >
        {/* min-h matches the closed photo height (h-24), so the top row keeps
            its height once the photos leave it for their own row. */}
        <div className="lg:col-span-3 lg:flex lg:min-h-24 lg:flex-col lg:justify-center">
          <h3 className="text-[17px] font-medium">{project.name}</h3>
          {(project.rank || project.event) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {project.rank && (
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                    RANK_STYLE[project.rank] ?? RANK_STYLE.default
                  }`}
                >
                  {project.rank}
                </span>
              )}
              {project.event && (
                <span className="text-xs uppercase tracking-widest text-neutral-400">
                  {project.event}
                </span>
              )}
            </div>
          )}
        </div>
        {/* Tags over the one-liner so this copy column can stay narrow — the
            list sits on the right of the shell and leaves the left for the head. */}
          <div className="flex flex-col gap-2 lg:col-span-4">
          <ul className="flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-md border border-white/25 bg-black/25 px-2 py-0.5 text-xs text-white"
              >
                {tag}
              </li>
            ))}
          </ul>
          <p className="text-sm leading-5">{project.description}</p>
          </div>
        </button>

        {/* One set of photos in both states — FLIP carries them from the
            right-hand column down to their own full-width row.

            Open: each box gets its photo's own aspect-ratio and a flex-grow to
            match. Widths then come out proportional to the ratios, which makes
            every height identical — width_i / ratio_i is the same for all of
            them — with no crop and no letterbox.

            This layout is applied the moment the row opens, not after the
            photos land. It used to arrive in a second pass, which meant the
            travel ended on equal boxes at full width and only then reshaped and
            re-centred — two visible stages where the design calls for one. */}
        <div
          // w-full keeps the width definite. Without it, the auto margins make
          // this shrink-to-fit, and flex-basis:0 children collapse it to zero.
          // mx-auto at every breakpoint: the capped width is narrower than the
          // grid column, so without it the group sits left, not centred.
          className={`mx-auto flex w-full gap-3 ${photosOpen ? "lg:col-span-12 lg:pt-4" : "lg:col-span-5"}`}
          style={
            photosOpen && ratios.length === project.photos.length
              ? {
                  // Caps how tall the row can get, keeping ratios exact.
                  maxWidth: `calc(${MAX_PHOTO_H}rem * ${ratios.reduce((a, b) => a + b, 0)} + 0.75rem * ${project.photos.length - 1})`,
                }
              : undefined
          }
        >
          {project.photos.map((photo, i) => {
            const ratio = ratios[i];
            const sized = photosOpen && ratio > 0;
            return (
              <button
                type="button"
                key={photo}
                ref={(el) => {
                  photoRefs.current[i] = el;
                }}
                aria-label={`${projectLightbox.openLabel}: ${project.name}`}
                onClick={() => onPhotoOpen(photo)}
                style={
                  sized
                    ? { aspectRatio: ratio, flex: `${ratio} 1 0` }
                    : undefined
                }
                className={`relative overflow-hidden rounded transition-[transform,opacity] duration-200 ease-out ${
                  sized ? "" : photosOpen ? "h-[22rem] flex-1" : "h-24 flex-1"
                }`}
              >
                <Image
                  src={`/projects/${photo}`}
                  alt={`${project.name} screenshot`}
                  fill
                  onContextMenu={(event) => event.preventDefault()}
                  // Closed, a photo is a ~150px thumbnail in a 4-of-12 column;
                  // the open row gives it a third of the full width. One
                  // `sizes` for both meant every row loaded at the open size on
                  // first paint. Opening a row does re-request at the larger
                  // candidate, which the expand animation covers.
                  sizes={
                    photosOpen
                      ? "(max-width: 1024px) 45vw, 28vw"
                      : "(max-width: 1024px) 30vw, 18vw"
                  }
                  className="object-cover"
                  ref={(el) => captureRatio(i, el)}
                  onLoad={(e) => captureRatio(i, e.currentTarget)}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Always mounted so it can animate closed — an unmount is instant. */}
      <div
        id={panelId}
        ref={panelRef}
        aria-hidden={!open}
        style={{ height: 0, opacity: 0, overflow: "hidden" }}
      >
        <div className="pb-10 lg:grid lg:grid-cols-12 lg:gap-6">
          <p className="max-w-[620px] font-instrument text-[17px] leading-6 lg:col-span-8 lg:col-start-4">
            {project.detail ?? project.description}
          </p>
        </div>
      </div>
    </li>
  );
});
