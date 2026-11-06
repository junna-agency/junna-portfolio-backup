import { education } from "@/content";

import GrowRule from "./GrowRule";
import Reveal from "./Reveal";

export default function Education() {
  return (
    <section id="education" className="shell w-full pt-24 pb-24">
      <Reveal>
        <p className="text-xs uppercase tracking-widest text-neutral-400">
          Education
        </p>

        {education.map((item) => (
          <div
            key={item.school}
            className="flex flex-col gap-4 pt-8 sm:flex-row sm:items-start sm:gap-6"
          >
            <h2 className="min-w-0 text-[clamp(1.375rem,4.5vw,2rem)] font-semibold leading-tight tracking-[-0.01em]">
              {item.school}
            </h2>

            {/* Major + tags as one vertical stack beside the school. */}
            <div className="flex shrink-0 flex-col gap-4">
              <p className="text-[17px] leading-6">{item.detail}</p>
              <ul className="flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-md border border-white/25 px-2 py-0.5 text-xs text-white"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </Reveal>

      {/* Its own element rather than a border on the section: an inline border
          would follow the padding box out to the edge of shell's gutter and
          run wider than every other rule on the page. */}
      <GrowRule className="mt-24 bg-white/40" />
    </section>
  );
}
