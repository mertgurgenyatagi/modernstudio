# Design: modernstudio

The decided look. Every exhibition and page build reads this first.

**This file decides the palette and the fonts, and nothing else.** It does not decide any layout, page design, control shape, corner radius, line weight, spacing or density. Those stay open and are decided page by page.

## The look: Bone and black

Chosen on 2026-11-08 from the twenty looks in [exhibition/overall-feel.html](exhibition/overall-feel.html), look 09. Off-white paper, near-black ink, no colour. The one "accent" is the ink itself: selection, notes, the play button and filled sliders are ink-filled.

### Palette

| Role | Token | Value | Hex |
| --- | --- | --- | --- |
| Ground | `--color-paper` | `oklch(96.5% 0.006 90)` | `#f5f3ef` |
| Panel | `--color-paper-2` | `oklch(99% 0.004 90)` | `#fdfcf9` |
| Editor and inset | `--color-paper-3` | `oklch(94% 0.006 90)` | `#edebe7` |
| Ink | `--color-ink` | `oklch(18% 0.006 90)` | `#13110f` |
| Muted text | `--color-muted` | `oklch(44% 0.006 90)` | `#54524f` |
| Rules | `--color-rule` | `oklch(79% 0.006 90)` | `#bcbab6` |
| Accent | `--color-accent` | same as ink | `#13110f` |
| Text on accent | `--color-accent-ink` | `oklch(97% 0.005 90)` | `#f6f5f1` |
| Focus ring | `--color-focus` | same as ink | `#13110f` |

### Fonts

| Role | Token | Face | Source |
| --- | --- | --- | --- |
| Titles and the wordmark | `--font-display` | Piazzolla, weight 700 | Google Fonts |
| Text, labels and buttons | `--font-body` | Golos Text, weights 400 to 600 | Google Fonts |
| Figures (fret numbers, pattern numbers, pitch names) | `--font-outlier` | Fragment Mono, weight 400 | Google Fonts |

```css
:root {
  --color-paper: oklch(96.5% 0.006 90);  --color-paper-2: oklch(99% 0.004 90);  --color-paper-3: oklch(94% 0.006 90);
  --color-ink: oklch(18% 0.006 90);  --color-muted: oklch(44% 0.006 90);  --color-rule: oklch(79% 0.006 90);
  --color-accent: oklch(18% 0.006 90);  --color-accent-ink: oklch(97% 0.005 90);  --color-focus: oklch(18% 0.006 90);
  --font-display: "Piazzolla", ui-serif, serif;
  --font-body: "Golos Text", ui-sans-serif, sans-serif;
  --font-outlier: "Fragment Mono", ui-monospace, monospace;
}
```

## Not decided

Everything in the exhibition other than the two tables above was only a sample to show the look at work: the Bass page layout, the top bar with page tabs, the side panels, the 2px corners, the 1px rules, the row height, the square note shape. None of it is chosen. See [open-items.md](open-items.md).
