# Design system

Dark, near-black site with a full-viewport particle cloud fixed behind every
section. Almost every surface is a translucent white tint over that backdrop
rather than a solid fill — that is the defining constraint, and it drives most
of the decisions below.

Tokens live in `src/app/globals.css`. Copy and URLs live in `src/content.ts`.

---

## Colour

### Tokens

| Token          | Value     | Use                          |
| -------------- | --------- | ---------------------------- |
| `--background` | `#0a0a0a` | Page canvas, behind the cloud |
| `--foreground` | `#ededed` | Default body text            |

### Surfaces

There is no grey palette. Surfaces are white at low alpha, so the cloud reads
through them. Established steps:

| Tint          | Use                                                     |
| ------------- | ------------------------------------------------------- |
| `white/5`     | Mobile project-row highlight                             |
| `white/10`    | Cards (ReachOut), borders                                |
| `white/12`    | ReachOut hover                                           |
| `white/25`    | Hero social buttons, tag borders                         |
| `white/35`    | Hero social button hover                                 |
| `white/70`    | Cursor ring and fill, splash trail mid-stops             |

The project wheel is the exception: stacked cards use `--background` so one
card actually occludes the one behind it. A white tint lets the cloud (and the
card underneath) show through, and two of those on top of each other read as
mud rather than a stack.

Borders: `white/10` for structural rules (section dividers, row separators),
`white/15`–`white/25` for elements meant to be noticed (tags, navbar).

### Text

`text-white` for primary, `text-neutral-200`/`300` for supporting copy,
`text-neutral-400` for labels and metadata (uppercase, tracked).

### Accents

Placement badges in `ProjectRow.tsx` are the only hue in the design — tinted
fills at `/15` with a matching `ring-inset` at `/35`, never solid, so they sit in
the palette rather than shouting over the cloud:

- 1st — `amber` (gold)
- 2nd — `zinc` (silver)
- 3rd — `orange` (bronze)
- fallback — `white/10`, since `rank` is a free string

---

## Spacing & layout

### The shell

`@utility shell` is the layout primitive: `max-width: 1440px`, auto margins, and
`padding-inline: var(--gutter)`.

```css
--gutter: clamp(1.25rem, 4.5vw, 4rem);
```

The gutter is a variable specifically so absolutely-positioned elements can line
up with the content column — see the hero's social stack using
`right-[var(--gutter)]`. Use the variable, never a hardcoded padding.

### Rhythm

- Section vertical: `pt-24 pb-24` (`pb-24` alone where the previous section
  already supplies the top space)
- Column gaps: `gap-10` stacked, `gap-16` on `lg`
- Inline element gaps: `gap-1.5` (tag rows), `gap-2`–`gap-4` (button stacks)

### Full-bleed

To break out of the shell, centre against the viewport instead of the parent:

```
absolute left-1/2 w-screen -translate-x-1/2
```

`w-screen` is `100vw`, which **counts the scrollbar**. On a `fixed` element that
is harmless, but an `absolute` one contributes to scrollable overflow and adds a
horizontal scrollbar. `html { overflow-x: clip }` guards this globally — `clip`
rather than `hidden`, because `hidden` makes the element a scroll container and
breaks `position: sticky`.

### Z-index

| Layer                    | z     |
| ------------------------ | ----- |
| Hero cloud backdrop      | `-10` |
| Page grid (on the canvas)| `-10` |
| Below-hero glass panel   | `-5`  |
| Hero social stack        | `40`  |
| Top scroll-fade strip    | `40`  |
| Navbar                   | `50`  |
| Splash curtain           | `90`  |
| Custom cursor            | `100` |
| Project image lightbox   | browser top layer |

The splash deliberately sits *below* the cursor: the native cursor is hidden by
`cursor: none`, so a curtain above it would leave no visible pointer.

A wide dim grid (`--grid`, 1px at `white/4.5%`) is painted over the opaque
WebGL canvas inside the same `-10` layer. Putting it behind the canvas would
hide it; putting it above content would veil the type.

---

## Typography

Two families, both via `next/font`:

- `--font-sans` — **Archivo**, default for everything
- `--font-instrument` — **Instrument Sans**, used for intro/lede paragraphs

Headings use fluid `clamp()` rather than breakpoint steps:

| Role          | Size                              |
| ------------- | --------------------------------- |
| Hero h1       | `clamp(2.5rem, 7vw, 3.75rem)`     |
| ReachOut CTA  | `clamp(1.75rem, 5vw, 3rem)`       |

Body copy is fixed: `text-[17px]` for lede paragraphs, `text-sm` for row copy,
`text-xs` for tags, badges, and tracked uppercase labels.

Hero and CTA headings are `uppercase` with tight tracking (`-0.04em` / `-0.02em`).

---

## Motion

### Duration scale

| Duration | Use                                                  |
| -------- | ---------------------------------------------------- |
| `200ms`  | Hover states, dropdown open/close, cursor expansion   |
| `300ms`  | Highlight slides, hamburger morph                     |
| `500ms`  | Navbar label 3D roll, scroll reveals                  |

Default ease is `ease-out`. The navbar roll uses `cubic-bezier(0.33,1,0.68,1)`.
GSAP work uses `power2.inOut` for travel, `power2.out` for arrivals, `power3`
for the cursor follow.

The viewport-centred navbar shares the project intro's horizontal axis. Its
rolling active-section label sits above a centred hairline rail with four
progress dots. Every dot is a direct section link; the active one enlarges and
gains a soft white glow instead of opening a separate menu.

### GSAP timings

| Constant                        | Value  | What                              |
| ------------------------------- | ------ | --------------------------------- |
| `ProjectRow` `EXPAND`           | `0.3`  | Row opens before photos move      |
| `ProjectRow` `DOWN` / `ACROSS`  | `0.35` / `0.45` | Photo travel, two legs   |
| `ProjectRow` `STAGGER`          | `0.04` | Per-photo offset                  |
| `ProjectRow` `PANEL` / `SETTLE` | `0.4` / `0.35` | Write-up fade, ratio reshape |
| `ProjectWheel` snap             | `0.4`  | Arc settles on a project          |
| `Splash` `LEG` / `PART`         | `0.6` / `0.8` | Comet leg, curtain parting |
| `Cursor` `FOLLOW`               | `0.5`  | Ease toward pointer               |

Scrolling is Lenis-driven with `wheelMultiplier`/`touchMultiplier` at `0.7`.
Native `scroll-behavior: smooth` is deliberately absent — anchor clicks route
through `lenis.scrollTo`, since Lenis only intercepts wheel and touch.

The hero cloud is 2.5D: a baked plexus of a head, tilted a few degrees with
scroll (`HeroCloud`). As the hero leaves it morphs into the abstract sculpture,
shrinks, and slides left beside the project wheel. On large screens the
projects stage is a full-viewport sticky panel: it scrolls in until it fills
the screen, then stays put while leftover section height (`n × 45dvh`) turns
the wheel — one slot per project, including the last, so the pin does not
release mid-block. Progress inside each slot uses smoothstep easing, slowing
into every project and accelerating away while staying reversible and directly
linked to scroll. That same progress adds a restrained `0.045` pitch and
`0.18` yaw to the sculpture, derived directly from scroll and therefore
reversible. Six enlarged neon-orange points sit clockwise around spread canopy
vertices as fruit, one per project in list order. The selected project's fruit
gets a stronger glow without moving; all six stay pinned to fixed tree
coordinates while the tree rotates, appear only once the tree settles, and fade
before its particles scatter. On narrow screens the head starts at `0.48` scale and the
wider abstract sculpture settles at `0.4`, both above the copy instead of
filling the viewport. Once most of the project stage has left, up to `65dvh` of the
Education handoff recentres and scatters the sculpture into a faint
viewport-wide field.
The field is derived directly from scroll, so reversing restores the sculpture;
reduced motion switches between the two settled poses without interpolation.
Points wander inside a small box around their rest position, and a mouse/pen
softly repels nearby points. The WebGL canvas is sized in `lvh` and only
rebuilt when its pixel size actually changes, so iOS chrome and accordion
resizes cannot flash the tree.

### Rules

**Animate transforms and opacity only.** `top`/`height`/`width` force layout and
repaint every frame. The mobile project highlight learned this the hard way: it
is a 1px bar stretched with `scaleY` and positioned with `translate3d`, not a
resized box. The desktop wheel is the same rule: items move on a 3D arc via one
inline `transform` string.

**Do not animate through a `ResizeObserver` and a CSS transition at once.** If a
measured value already updates per frame, easing toward it makes the element
trail its target. The project highlight transitions geometry *only* when sliding
between rows, never while a row resizes.

**Never build a trail from stacked layers.** Each layer ends on a hard edge, so
N layers read as N bands at any width. The splash comet is a canvas cleared and
redrawn each frame from a position history, with alpha as a function of age.

**`will-change: transform` only for things that move constantly** — the cursor
qualifies, most things do not.

**Scroll reveals are one-shot.** `IntersectionObserver` on transform + opacity,
then disconnect. Do not scrub them off Lenis — that is for things that have to
track the scroll position (`HeroDivider`, `GrowRule`, the project wheel).

---

## Constraints worth knowing

**`backdrop-filter` isolates its descendants.** An element with a backdrop
filter becomes a Backdrop Root, so children cannot blur the page behind it —
they only see their ancestor. Any full-section glass therefore belongs on its
own sibling layer instead of on the container that holds the content. The same
rule blocks `mix-blend-mode` on cursor children.

**GSAP and Tailwind fight over transforms.** Tailwind v4 writes the independent
`translate` / `scale` / `rotate` properties; GSAP owns them too and will
overwrite. Centre GSAP-driven elements with negative margins, not
`-translate-x-1/2` — the splash dots ended up exactly one dot-width apart before
this was found.

**Full-width fixed containers swallow clicks.** The navbar's track spans
`inset-x-0` even though the pill is left-aligned. It needs `pointer-events-none`
with `pointer-events-auto` on the pill, or it eats clicks on anything crossing
that band.
