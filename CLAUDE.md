@AGENTS.md

# Portfolio

Single-page personal portfolio. Next.js 16 (App Router, Turbopack), React 19,
Tailwind v4, TypeScript. GSAP for scripted animation, Lenis for smooth scroll.

See `design.md` for the design system — colours, spacing, motion, and the
rendering constraints that shaped them. Read it before changing anything visual.

## Commands

```bash
npm run dev     # dev server on :3000
npm run lint    # eslint
npx tsc --noEmit
```

**Never run `next build` while `next dev` is running.** They share `.next`, and
the production build corrupts the dev server's state — it will keep serving a
500 for an error you have already fixed. If that happens: stop dev,
`rm -rf .next`, restart.

## Layout of the code

```
src/
  content.ts          all copy and URLs
  app/
    layout.tsx        fonts, metadata, Lenis root, Splash, Cursor
    page.tsx          section order, top fade strip, glass panel
    globals.css       tokens, shell utility, keyframes, global overrides
  components/
```

`page.tsx` composes the sections. The hero's particle cloud is `fixed`. Projects
sit over it with no glass; education and below get a `backdrop-blur` panel.
On large screens the project list is a vertical wheel on the right of a
full-viewport sticky stage; below `lg` it stays a stacked accordion.

## Conventions

**Copy and URLs go in `src/content.ts`.** Nothing else should hardcode a string
a visitor reads or a link they follow. It is a `.ts` file, so it holds no JSX —
components map an `icon` key (`"linkedin"`, `"github"`, `"calendar"`) to their
own icon components. Several URLs are used in two places; that file is why they
cannot drift.

**Section ids are a contract.** `sections[].id` in `content.ts` must match the
`id` on the matching `<section>`, and each `menu` entry lowercases to one. A
mismatch fails silently — the nav link scrolls nowhere and the
`IntersectionObserver` never fires for it.

**Comments explain why, not what.** The codebase is dense with non-obvious
browser behaviour; most comments exist because the obvious approach was tried
and failed. Do not strip them, and add one when you work around something.

**`ponytail:` comments mark deliberate shortcuts** with a known ceiling and the
upgrade path. Honour or fix them; do not silently remove them.

## Things that will bite you

- **`backdrop-filter` isolates descendants** — see `design.md`. Put glass on its
  own layer, not on a container whose children also need to blur.
- **GSAP overwrites Tailwind's `translate`/`scale`/`rotate`.** Centre
  GSAP-driven elements with negative margins.
- **`pointerover` fires for every descendant**, so most calls are noise from
  moving within one element. Bail early when the target has not changed, or you
  will cancel in-flight transitions.
- **`<details>` content is hidden by `content-visibility` on
  `::details-content`** in current Chrome, not `display`. Animating it closed
  needs `transition-behavior: allow-discrete` on that pseudo-element.
- **Lenis does not intercept anchor clicks** — only wheel and touch. In-page
  links must call `lenis.scrollTo`.
- **Lenis clips overflow while stopped**, removing the scrollbar and shifting
  the page. `globals.css` overrides this; keep the override if you touch it.

## Verifying

There are no tests. Typecheck and lint, then check the running page — the dev
server renders the full DOM, so `curl localhost:3000` plus the emitted
stylesheet is enough to confirm markup and that Tailwind generated a class.
Animation and layout still need a browser.

An invalid arbitrary Tailwind value (e.g. `max-[pointer:coarse]:`) fails the
**CSS build**, not typecheck — the page 500s. Verify unusual variants compile.
