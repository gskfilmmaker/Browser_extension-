# FramePilot brand assets

**FramePilot**
**Your browser. In motion.**
**Developed by GSK Productions Inc.**

The mark pairs a four-corner viewfinder frame with an amber forward triangle. The frame connects to film production; the triangle suggests direction and action. Use the same geometry across the toolbar, side panel, documentation, and promotional assets.

## Files

| Asset | Usage |
| --- | --- |
| `mark.svg` | Master icon: ivory frame and amber pointer on midnight navy |
| `mark-transparent.svg` / `.png` | Background-free mark for light surfaces |
| `mark-white.svg` / `.png` | White monochrome mark for dark surfaces |
| `mark-256.png`, `mark-512.png`, `mark-1024.png` | Large app icon exports |
| `logo-light.svg` / `.png` | Horizontal wordmark for light backgrounds |
| `logo-dark.svg` / `.png` | Horizontal wordmark for dark backgrounds |
| `promo-small.svg` / `.png` | 440×280 promotional tile |
| `promo-marquee.svg` / `.png` | 1400×560 promotional banner |
| `framepilot-artwork.png` | AI-generated supplemental cinematic brand artwork; not the icon master |
| `ui-preview.png` | Branded side panel rendered with a test runtime adapter |
| `preview.html` | Local brand gallery; open directly in your browser |
| `../icons/icon-*.png` | Exact 16, 32, 48, and 128px PNGs for Chrome |

The SVG logo wordmarks use Arial / Helvetica / sans-serif; text remains editable. PNG exports freeze the appearance rendered by Chromium. No external fonts or network requests are required. Re-render the vector sources using `python scripts/render-brand.py` with Playwright and Chromium installed.

## Palette

- Midnight navy: `#111827` — logo tile, headings, primary controls.
- Motion amber: `#F5B85A` — forward triangle and send button.
- Warm ivory: `#F8F4EC` — reversed mark and wordmark.
- Studio paper: `#F7F5F0` — interface backgrounds.
- Slate: `#626C7C` — secondary text on light surfaces.

Use dark navy text over amber; do not use white text on amber for small labels. Keep clear space around the logo at least the width of one frame corner. Never stretch the mark, add shadows to it, recolor individual corners, or set the wordmark at a size where the company credit becomes illegible. Use the icon alone at toolbar sizes. The display name is always **FramePilot**, with capital F and P; the publisher credit is always **GSK Productions Inc.**
