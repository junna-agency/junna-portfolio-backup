"use client";

import gsap from "gsap";
import { useLenis } from "lenis/react";
import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type MutableRefObject,
  type RefObject,
} from "react";

import { sections } from "@/content";

import { RANK_STYLE, type Project } from "./ProjectRow";

/** Degrees between neighbouring items. Small on purpose: a bow, not a ferris wheel. */
const ANGLE = 26;
/** Vertical radius of the arc, in px. */
const RY = 210;
/** How far neighbours tuck to the right, so the wheel sits on that edge. */
const RX = 150;
/** Depth so the far items recede a little. */
const RZ = 110;
const RAD = Math.PI / 180;

type Props = {
  projects: Project[];
  index: number;
  onIndex: (index: number) => void;
  reduced: boolean;
  /** Tall pin section: leftover height past 100dvh is the wheel's travel. */
  sectionRef: RefObject<HTMLElement | null>;
  /** Scrub off Lenis while the stage is pinned. Off below `lg` and when reduced. */
  scrollLinked: boolean;
};

function clampIndex(i: number, n: number) {
  return Math.max(0, Math.min(n - 1, i));
}

/** Ease within each project slot without disconnecting the wheel from scroll. */
function easeSlot(value: number) {
  const slot = Math.floor(value);
  const progress = value - slot;
  const eased = progress * progress * (3 - 2 * progress);
  return slot + eased;
}

/** Signed offset from the current project on the finite arc. */
function offsetOf(i: number, spin: number) {
  return i - spin;
}

/**
 * Vertical project picker. Items sit on a shallow wheel whose centre is off
 * to the right, so the focused card is nearest the detail column and
 * neighbours peel back toward the gutter as the arc turns.
 *
 * Cards use the page fill rather than a white tint. Transparent stacks read
 * as mud because two tints and the cloud all show through the same pixels.
 *
 * On large screens the arc is scrubbed from the page scroll, like
 * `HeroDivider` — a GSAP tween toward each new value would lag the wheel.
 * The stage itself is sticky: it only starts rolling once it fills the
 * viewport, and it stays put while the arc turns.
 */
export default function ProjectWheel({
  projects,
  index,
  onIndex,
  reduced,
  sectionRef,
  scrollLinked,
}: Props) {
  const n = projects.length;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const spin = useRef(index);
  const dest = useRef(index);
  const tween = useRef<gsap.core.Tween | null>(null);
  const onIndexRef = useRef(onIndex);
  onIndexRef.current = onIndex;
  const geom = useRef({ start: 0, travel: 1, ready: false });
  const lenis = useLenis();

  const paint = useCallback(
    (value: number) => {
      spin.current = value;
      // Keep the distant end of the finite arc readable without letting it
      // compete with the selected card.
      const reach = n / 2;
      for (let i = 0; i < n; i++) {
        const el = buttonsRef.current[i];
        if (!el) continue;
        const o = offsetOf(i, value);
        const abs = Math.abs(o);
        const theta = o * ANGLE * RAD;
        const x = (1 - Math.cos(theta)) * RX;
        const y = Math.sin(theta) * RY;
        const z = (Math.cos(theta) - 1) * RZ;
        const tilt = -o * ANGLE * 0.38;
        const scale = 1 - Math.min(abs, reach) * 0.07;
        const opacity = 0.42 + 0.58 * (1 - Math.min(abs, reach) / reach);
        const selected = dest.current === i;
        // translateY(-50%) centres the card on the stage; the rest is the arc.
        // One transform string so Tailwind's translate properties stay out of it.
        el.style.transform = `translateY(-50%) translate3d(${x}px, ${y}px, ${z}px) rotateX(${tilt}deg) scale(${scale})`;
        el.style.opacity = String(opacity);
        el.style.zIndex = String(Math.round((reach - abs) * 10));
        el.style.pointerEvents = "auto";
        el.setAttribute("aria-selected", selected ? "true" : "false");
        el.tabIndex = selected ? 0 : -1;
        el.classList.toggle("border-white/30", selected);
        el.classList.toggle("border-white/10", !selected);
        // Keep every card opaque so the stack stays clean, but lift the
        // selected one with a brighter mixed fill and a crisp leading edge.
        el.style.backgroundColor = selected
          ? "color-mix(in srgb, var(--background), white 7%)"
          : "var(--background)";
        el.style.boxShadow = selected
          ? "inset 3px 0 0 rgba(255,255,255,0.78), 0 18px 48px rgba(0,0,0,0.5)"
          : "none";
      }
    },
    [n],
  );

  const commit = useCallback(
    (value: number) => {
      const next = clampIndex(Math.round(value), n);
      if (next === dest.current) return;
      dest.current = next;
      onIndexRef.current(next);
    },
    [n],
  );

  const draw = useCallback(
    (scroll: number) => {
      const { start, travel, ready } = geom.current;
      if (!ready) return;
      const p = Math.min(1, Math.max(0, (scroll - start) / travel));
      // n equal slots so the last project owns the final slice of the pin.
      // Clamp to n-1 so the arc stops cleanly on the final project.
      const value = easeSlot(Math.min(n - 1, p * n));
      commit(value);
      paint(value);
    },
    [commit, n, paint],
  );

  const measure = useCallback(() => {
    const section = sectionRef.current;
    if (!section || !scrollLinked) return;
    const vh = window.innerHeight;
    // Pin begins when the section top hits the top of the viewport — that is
    // the first frame the 100dvh stage is fully on screen. Leftover height
    // past that is the wheel's travel; p stays 0 until then.
    const start = section.getBoundingClientRect().top + window.scrollY;
    const travel = Math.max(1, section.offsetHeight - vh);
    geom.current = { start, travel, ready: true };
    draw(window.scrollY);
  }, [draw, scrollLinked, sectionRef]);

  useLenis((instance) => {
    if (!scrollLinked) return;
    draw(instance.scroll);
  });

  useEffect(() => {
    if (!scrollLinked) return;
    measure();
    window.addEventListener("resize", measure);
    const section = sectionRef.current;
    const ro = section ? new ResizeObserver(measure) : null;
    if (section) ro?.observe(section);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [measure, scrollLinked, sectionRef]);

  const snapTo = useCallback(
    (target: number, duration = 0.4) => {
      tween.current?.kill();
      const next = clampIndex(target, n);
      dest.current = next;
      onIndexRef.current(next);
      const end = spin.current + offsetOf(next, spin.current);
      if (reduced || duration === 0) {
        paint(end);
        return;
      }
      const proxy = { v: spin.current };
      tween.current = gsap.to(proxy, {
        v: end,
        duration,
        ease: "power2.out",
        onUpdate: () => paint(proxy.v),
        onComplete: () => paint(end),
      });
    },
    [n, paint, reduced],
  );

  useEffect(() => {
    if (scrollLinked || reduced) return;
    paint(spin.current);
  }, [paint, reduced, scrollLinked]);

  function go(i: number) {
    const next = clampIndex(i, n);
    if (scrollLinked) {
      const { start, travel } = geom.current;
      const t = n <= 1 ? 0 : (next + 0.5) / n;
      lenis?.scrollTo(start + t * travel);
      return;
    }
    snapTo(next);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      go(dest.current + 1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      go(dest.current - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      go(n - 1);
    }
  }

  if (n === 0) return null;

  const label = sections.find((s) => s.id === "projects")?.label;

  if (reduced) {
    return (
      <div
        ref={rootRef}
        role="listbox"
        aria-label={label}
        aria-activedescendant={`project-option-${index}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="absolute top-[56%] right-[var(--gutter)] flex w-[18rem] -translate-y-1/2 flex-col gap-1"
      >
        {projects.map((project, i) => (
          <Item
            key={project.name}
            project={project}
            i={i}
            selected={i === index}
            reduced
            buttonsRef={buttonsRef}
            onSelect={() => go(i)}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      role="listbox"
      aria-label={label}
      aria-activedescendant={`project-option-${index}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="absolute top-[56%] right-[var(--gutter)] h-[min(36rem,70vh)] w-[20rem] -translate-y-1/2 overflow-visible [perspective:960px] focus:outline-none"
    >
      <div className="absolute inset-0 [transform-style:preserve-3d]">
        {projects.map((project, i) => (
          <Item
            key={project.name}
            project={project}
            i={i}
            selected={i === index}
            reduced={false}
            buttonsRef={buttonsRef}
            onSelect={() => go(i)}
          />
        ))}
      </div>
    </div>
  );
}

function Item({
  project,
  i,
  selected,
  reduced,
  buttonsRef,
  onSelect,
}: {
  project: Project;
  i: number;
  selected: boolean;
  reduced: boolean;
  buttonsRef: MutableRefObject<(HTMLButtonElement | null)[]>;
  onSelect: () => void;
}) {
  return (
    <button
      ref={(el) => {
        buttonsRef.current[i] = el;
      }}
      type="button"
      role="option"
      id={`project-option-${i}`}
      aria-selected={selected}
      onClick={onSelect}
      className={
        reduced
          ? `rounded-lg border bg-background px-4 py-3 text-left ${
              selected
                ? "border-white/30 bg-white/[0.07] shadow-[inset_3px_0_0_rgba(255,255,255,0.78)]"
                : "border-white/10"
            }`
          : // top-1/2 + translateY(-50%) in `paint`, not a Tailwind translate —
            // those properties would fight the inline transform.
            "absolute top-1/2 left-0 w-[17.5rem] rounded-lg border border-white/10 bg-background px-4 py-2.5 text-left opacity-0 transition-[border-color,background-color,box-shadow] duration-200 ease-out"
      }
    >
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
    </button>
  );
}
