"use client";

import posthog from "posthog-js";
import { useRef } from "react";

import { hero } from "@/content";

import DecodeText from "./DecodeText";
import HeroCloud from "./HeroCloud";
import HeroDivider from "./HeroDivider";
import { GitHubIcon, LinkedInIcon, MailIcon } from "./icons";

// Icons stay here rather than in content.ts — that file holds what the site
// says, not what it draws.
const icons = {
  linkedin: <LinkedInIcon />,
  github: <GitHubIcon />,
  email: <MailIcon />,
};

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section
      ref={sectionRef}
      id="home"
      className="relative flex min-h-dvh w-full flex-col text-white shell"
    >
      {/* Full-bleed: the section is width-capped by `shell`, so the backdrop
          breaks out to the viewport edges to avoid bars on wide screens. */}
      {/* `lvh`, not `dvh`: iOS chrome collapsing during scroll would otherwise
          resize this box every frame and rebuild the WebGL buffer. */}
      <div className="fixed left-1/2 top-0 -z-10 h-lvh w-screen -translate-x-1/2 overflow-hidden bg-black">
        <HeroCloud rootRef={sectionRef} />
        <div aria-hidden className="page-grid pointer-events-none absolute inset-0" />
      </div>
      {/* Absolute so the stack has room to travel: a sticky child can only move
          inside its parent's box. The height sets how long they stay pinned —
          shorter box, sooner release. */}
      {/* An absolute box resolves against the padding box, so right-0 would sit
          on the outer edge of shell's gutter. Offset by the gutter to line the
          stack up with the content column. */}
      <div className="absolute right-[var(--gutter)] top-0 z-40 flex h-[500px] w-fit flex-col gap-4 pt-[calc(2rem+env(safe-area-inset-top,0px))]">
        {hero.socials.map(({ label, href, icon }, i) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              posthog.capture("social_profile_opened", {
                link_location: "hero",
                platform: label.toLowerCase(),
              })
            }
            // Pins 8px lower than the one before, so each lands on top of it
            // with a sliver of the last still showing. zIndex keeps the order.
            style={{ top: 32 + i * 8, zIndex: i + 1 }}
            // Icon-only below md so the stack doesn't crowd the headline on
            // narrow screens; labels stay for screen readers.
            className="sticky flex items-center gap-2 rounded-lg bg-white/25 p-3 text-xs font-medium text-white backdrop-blur-sm hover:bg-white/35 md:px-4 md:py-3"
          >
            {icons[icon]}
            <span className="sr-only md:not-sr-only">{label}</span>
          </a>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-10 pt-24 pb-12 lg:flex-row lg:justify-between lg:gap-16 lg:pt-32 lg:pb-16">
        <h1 className="max-w-[760px] text-[clamp(2.5rem,7vw,3.75rem)] font-extrabold uppercase leading-[1] tracking-[-0.04em]">
          {hero.headline}
        </h1>
        <p className="pt-1 max-w-[310px] font-instrument text-[21px] leading-6 text-neutral-200">
          {hero.intro}
        </p>
      </div>

      <HeroDivider />

      <div className="flex flex-col gap-2 pt-4 pb-8 text-xs uppercase tracking-widest text-neutral-300 sm:flex-row sm:justify-between">
        <span>{hero.location}</span>
        <DecodeText phrases={hero.quote} />
        <span>{hero.role}</span>
      </div>
    </section>
  );
}
