"use client";

import posthog from "posthog-js";
import { useRef } from "react";

import { footer, site } from "@/content";

import { useReveal } from "./Reveal";
import { GitHubIcon, LinkedInIcon } from "./icons";

// Icons stay out of content.ts, which holds copy and URLs only.
const icons = {
  linkedin: <LinkedInIcon />,
  github: <GitHubIcon />,
};

export default function Footer() {
  const barRef = useRef<HTMLDivElement>(null);
  // The page cannot scroll the short footer through the default 12% reveal
  // inset, so trigger as soon as its first pixel reaches the viewport.
  useReveal(barRef, "0px");

  return (
    <footer className="shell w-full">
      {/* col-reverse puts the links above the copyright on phones, where the
          tappable things should come first. */}
      <div
        ref={barRef}
        className="reveal flex flex-col-reverse gap-6 border-t border-white/10 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] text-xs uppercase text-neutral-400 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:tracking-widest"
      >
        <span className="text-balance">
          &copy; {new Date().getFullYear()} {site.name}. All rights reserved.
        </span>
        <nav className="flex flex-wrap gap-x-6 gap-y-1 tracking-widest">
          {footer.links.map(({ label, href, icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                posthog.capture("social_profile_opened", {
                  link_location: "footer",
                  platform: label.toLowerCase(),
                })
              }
              // Negative margin keeps the row compact while the padding gives
              // the link a finger-sized tap target.
              className="-my-2 flex items-center gap-2 py-2 transition-colors hover:text-foreground"
            >
              {icons[icon]}
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
