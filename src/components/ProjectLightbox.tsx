"use client";

import { useLenis } from "lenis/react";
import Image from "next/image";
import { useEffect, useRef } from "react";

import { projectLightbox } from "@/content";

import type { Project } from "./ProjectRow";

export type LightboxImage = {
  project: Project;
  photo: string;
};

export default function ProjectLightbox({
  image,
  onClose,
}: {
  image: LightboxImage | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const lenis = useLenis();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (image) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      if (!dialog.open) dialog.showModal();
      lenis?.stop();
      return;
    }

    if (dialog.open) dialog.close();
    lenis?.start();
    returnFocusRef.current?.focus();
    returnFocusRef.current = null;
  }, [image, lenis]);

  useEffect(
    () => () => {
      lenis?.start();
    },
    [lenis],
  );

  useEffect(() => {
    if (!image) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [image, onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={
        image
          ? `${projectLightbox.dialogLabel}: ${image.project.name}`
          : projectLightbox.dialogLabel
      }
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (image) onClose();
      }}
      onPointerDown={() => onClose()}
      className="project-lightbox m-auto h-dvh max-h-none w-screen max-w-none items-center justify-center bg-transparent p-[var(--gutter)] text-white"
    >
      {image && (
        <div
          onPointerDown={(event) => event.stopPropagation()}
          className="relative h-[min(82dvh,900px)] w-[min(88vw,1440px)]"
        >
          <Image
            src={`/projects/${image.photo}`}
            alt={`${image.project.name} screenshot`}
            fill
            priority
            sizes="100vw"
            onContextMenu={(event) => event.preventDefault()}
            className="object-contain"
          />
        </div>
      )}
    </dialog>
  );
}
