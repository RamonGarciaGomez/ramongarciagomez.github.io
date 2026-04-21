# Design System — "The Record"

This is the design brief for Ramon's personal site. Read this before making visual changes.

## Concept

The site is framed as **"The Record"** — a personal newspaper/logbook/archive. It has a split personality: **warm literary serif** for reading content, **cold monospaced metadata** for technical bits (dates, catalog numbers, timestamps, version numbers).

The aesthetic is **editorial, archival, confident** — like a printed journal someone keeps meticulously. Inspired by Robin Rendle's "v19" but with a unique technical/editorial tension that's ours.

## Non-negotiables

- **No rounded corners.** Sharp edges everywhere. `rounded-*` classes are forbidden except where they already exist on legacy filter pills (and those should move to squared in a future pass).
- **Mono vs serif is the core tension.** Never use sans-serif body copy. Inter stays for UI chrome only; all reading type is serif, all metadata/technical type is mono.
- **Catalog numbers on every content item.** Format: `E-001` (essays/writing), `P-001` (projects), `N-001` (notes). Numbered sequentially within type, oldest = 001. These are computed at build time in `index.astro` — do not hardcode.
- **One accent color only.** Warm terracotta. Never introduce another hue.
- **Dates and numbers are always mono.**
- **Uppercase + letter-spacing for all labels.** `tracking-widest uppercase text-xs` is the label style.

## Design tokens (see `src/styles/global.css`)

```
--color-paper  #f0ebe0   warm off-white background
--color-ink    #141210   deep warm ink (almost black)
--color-muted  #5b5750   secondary text
--color-rule   #d1c9b6   horizontal rules, borders
--color-accent #b8441f   terracotta (used sparingly)

--font-serif   Fraunces (variable, optical sizing 9..144)
--font-sans    Inter (UI chrome only)
--font-mono    JetBrains Mono (all metadata)
```

## Layout

- **Max width**: `max-w-5xl` for most pages — we moved wider than before to accommodate the metadata right rail.
- **Asymmetric grid** on the homepage list: `grid-cols-[auto_1fr_auto]` = [catalog number | title+description | date], all aligned to a common baseline.
- **Mobile**: collapses to single column, date moves under title.

## Key components

### Top ticker bar (`Ticker.astro`)
Thin 1-line strip at the absolute top of every page. Monospace, tiny. Shows: location dot · live SF time · version string. Updates every second via a small client script. Border-bottom only.

### Hero (homepage only)
- Tiny "THE RECORD" eyebrow masthead in mono uppercase.
- Name in massive display serif (`text-6xl md:text-8xl`), line-broken as `Ramon` / `García-Gómez`.
- One-line bio in larger serif italic below.
- Meta row underneath: `→ 4 entries · San Francisco · Est. Apr 2026` in mono.
- Thin horizontal rule below hero.

### Entry list (homepage)
- Three-column grid: `[catalog-id] [title + description] [date]`.
- ID is mono, tiny, terracotta on hover.
- Title is serif, larger. Description is muted serif at body size.
- Date is mono, right-aligned, `APR 19 2026` format.
- On hover: title gets underline, ID turns accent color.
- Between entries: subtle `border-t` hairline — feels like a proper tabular archive.

### Filter pills
Keep existing behavior (All / Writing / Projects) but restyle: square corners, mono text, uppercase, with an active bg instead of pill shape.

## What NOT to do

- Don't add card-based designs with drop shadows.
- Don't introduce gradient backgrounds.
- Don't use emoji as primary visual elements (the 🌉 was removed; location is now text-only in the ticker).
- Don't add animation beyond the ticker clock and subtle hover color transitions.
- Don't add a dark mode yet — commit to the warm paper light aesthetic for now.

## Optimization passes (for the cheaper model)

After the first version is built, these are the refinements to make:

1. **Typography polish**: Tune optical sizing and weights on Fraunces display headings. Try `font-variation-settings: 'opsz' 144, 'wght' 550` on hero name. Check leading.
2. **Rhythm**: Verify vertical spacing uses a consistent scale (e.g., 4/8/16/24/32/48/64px multiples).
3. **Copy**: The intro paragraph still says "I build things..." — tighten this to ~15 words max, more distinct voice.
4. **Hover states**: Ensure every interactive element has a considered hover. No "just the default link underline."
5. **Entry list density**: Currently `py-5` per row — consider tightening to `py-4` if the list grows, or keeping as-is if < 10 entries.
6. **Footer**: Current footer is still the old design — should be restyled to match (thin, mono-for-meta, full-width with rule on top).
7. **Other pages** (`/blog`, `/projects`, `/about`): These are still the old design. Should be updated to match the new system once homepage is finalized.
8. **Nav**: Simplified and squared, but could be further refined — consider mono nav links at small caps size.

## References

- **Robin Rendle**'s site (robinrendle.com) — the archival philosophy, entry numbering.
- **NYT Magazine** web design — for mono/serif split.
- **Craig Mod**'s site (craigmod.com) — for warm editorial tone.
- **Linear.app** marketing site — for precise mono label treatment.
