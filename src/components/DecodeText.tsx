"use client";

import { useEffect, useRef, useState } from "react";
import DecryptedText from "./DecryptedText";

type Props = {
  phrases: string[];
  /** Seconds a phrase stays readable before the next one decodes in. */
  hold?: number;
};

export default function DecodeText({ phrases, hold = 3.5 }: Props) {
  const [i, setI] = useState(0);
  const [onScreen, setOnScreen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // The cycle is endless, so without this it keeps timers running and remounts
  // four DecryptedText instances every few seconds for the life of the page —
  // including while the hero is scrolled far out of view.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) =>
      setOnScreen(entry.isIntersecting),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!onScreen) return;
    if (phrases.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = setInterval(
      () => setI((n) => (n + 1) % phrases.length),
      hold * 1000,
    );
    return () => clearInterval(id);
  }, [onScreen, phrases.length, hold]);

  return (
    <span
      ref={ref}
      // Reserve the longest phrase so the row beside it doesn't shuffle
      // as the text length changes.
      style={{ minWidth: `${Math.max(...phrases.map((p) => p.length))}ch` }}
      className="inline-block"
    >
      {/* One decode per word rather than one sweep across the phrase, so every
          word scrambles at once and settles on its own length. The words are
          announced from here instead: each DecryptedText carries its own
          sr-only copy, and eight of those in a row would be read without the
          spaces between them. */}
      <span className="sr-only">{phrases[i]}</span>

      {phrases[i].split(" ").map((word, w) => (
        // key remounts the component, which is what re-runs its decode — so it
        // has to change with the phrase, not just the word position.
        <span key={`${i}-${w}`} aria-hidden>
          {w > 0 && " "}
          <DecryptedText
            text={word}
            animateOn="view"
            sequential
            revealDirection="start"
            speed={100}
            maxIterations={12}
            characters="A!B@C#D$E%F^J&K*"
            encryptedClassName="text-neutral-400"
          />
        </span>
      ))}
    </span>
  );
}
