"use client";

import gsap from "gsap";
import Image from "next/image";
import { useEffect, useRef } from "react";

import { projectLightbox, projectLinkLabel } from "@/content";

import type { Project } from "./ProjectRow";

/**
 * Write-up for whichever project the wheel is sitting on. Remounts on name
 * change so the fade is a fresh one-shot, not a reverse of the last one.
 */
export default function ProjectDetail({
  project,
  onPhotoOpen,
}: {
  project: Project;
  onPhotoOpen: (photo: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.killTweensOf(el);
    gsap.fromTo(
      el,
      { opacity: 0 },
      { opacity: 1, duration: 0.2, ease: "power2.out" },
    );
  }, [project.name]);

  const [featured, ...supporting] = project.photos;

  return (
    <article
      ref={ref}
      className="flex min-w-0 flex-1 flex-col gap-5 pl-5"
    >
      <p className="font-instrument text-[19px] leading-6 font-medium text-neutral-200">
        {project.description}
      </p>

      {featured && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-label={`${projectLightbox.openLabel}: ${project.name}`}
            onClick={() => onPhotoOpen(featured)}
            className="relative h-[clamp(11rem,22dvh,14rem)] overflow-hidden rounded-md border border-white/10 bg-white/5 text-left transition-[transform,border-color] duration-200 ease-out hover:border-white/25 active:scale-[0.99]"
          >
            <Image
              src={`/projects/${featured}`}
              alt={`${project.name} screenshot`}
              fill
              onContextMenu={(event) => event.preventDefault()}
              sizes="(max-width: 1024px) 90vw, 32vw"
              className="object-cover"
            />
          </button>

          {supporting.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {supporting.map((photo) => (
                <button
                  type="button"
                  key={photo}
                  aria-label={`${projectLightbox.openLabel}: ${project.name}`}
                  onClick={() => onPhotoOpen(photo)}
                  className="relative h-[clamp(3.5rem,7dvh,4.5rem)] overflow-hidden rounded border border-white/10 bg-white/5 text-left transition-[transform,border-color] duration-200 ease-out hover:border-white/25 active:scale-[0.98]"
                >
                  <Image
                    src={`/projects/${photo}`}
                    alt={`${project.name} screenshot`}
                    fill
                    onContextMenu={(event) => event.preventDefault()}
                    sizes="(max-width: 1024px) 45vw, 11vw"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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

      <p className="max-w-[620px] text-sm leading-5 text-neutral-300">
        {project.detail ?? project.description}
      </p>

      {project.url && (
        <a
          href={project.url}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex w-fit items-center gap-2 border-b border-white/25 pb-1 text-sm font-medium text-white transition-colors duration-200 ease-out hover:border-white/70"
        >
          {projectLinkLabel}
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          >
            <path
              d="M4 12 12 4m0 0H6m6 0v6"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
        </a>
      )}
    </article>
  );
}
