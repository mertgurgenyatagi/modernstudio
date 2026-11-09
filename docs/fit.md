# Fit at 960 by 540

How each page and panel fits the default window ([design.md](design.md)). First done in plan24 step 19; redone for the sweeping changes of 2026-11-09 ([sweeping-changes.md](sweeping-changes.md)), after which nothing shows a scrollbar, so every page has to fit. Checked by reading the CSS and the layout code, and by `src/pages/fit.test.ts`, which recomputes the numbers below from the code. **Nothing was looked at in a window** (the user's rule); the heights of text and buttons are estimates by hand, so each figure is good to about ten pixels. The user's check is to open each tab in `npm run dev` at the default size.

## The budget

- The window is 960 by 540 inside the frame (`useContentSize`). No minimum size is set.
- The top bar takes about 44 px, so a page has **about 496 px** of height; with a notice under the top bar (a refusal, "The sounds could not be loaded") **about 467 px**.
- The window never scrolls. A page that is taller than the window (only in a window smaller than the default) moves up and down with the wheel, without a scrollbar, and never sideways.

## Per page

| Page | What fits | What moves with the wheel |
| --- | --- | --- |
| Instrument pages | The settings bar (about 38 px, one row at 960 even with the frets) and the editor below it, about 436 px of rows | A pattern longer than the view sideways; the strings or keys that do not fit up and down |
| Drums | The five rows: 72 px each (the most a row takes), 360 px of 436 | A longer pattern, sideways (the plain wheel does it) |
| Bass at 5 frets | All 24 rows (18 px each) | Sideways only |
| Rhythm, Lead, Bass at 7 or 12 frets; Keys | Rows of 16 px: two whole strings of a guitar at 7 frets, two octaves of keys | The rest, up and down; sideways with Shift |
| Song | The settings bar, the bar numbers (24 px) and five lanes of 86 px (81 with a notice) | The bars, sideways (the plain wheel does it) |
| Mixer | About 450 px with the file buttons in their own row | Nothing |
| Mapping step, report | The panel is the window less 1 rem | The track list, the instrument rows |

### Instrument pages

The settings bar is one row of small buttons: the pattern (‹, the number, ›), 1× to 8×, the six note values, the frets on the string pages, − + Fit, the quiet line and four knobs. Estimated at about 917 px of the 960 at the tightest (the quiet line keeps 3 rem, and shows "…" when its text is longer). In a narrower window the bar wraps to a second row and the editor gets that much less.

The editor's rows share its height, each within the layout's limits (`src/pages/editor/layout.ts`): Drums 28 to 72 px, strings 16 to 26 px, keys 16 to 24 px. By default one bar fills the width (a 16th about 55 px wide); the zoom goes from a beat to the whole pattern.

### Song

The lanes share the height below the settings bar and the bar numbers, 40 to 104 px each; at 960 by 540 they are 86 px. A bar is 48 px by default, so sixteen bars show beside the 112 px name column; the zoom goes from 4 to 192 px a bar.

### Mixer

Padding 30, the heading and song fields 38, the table head 27, five instrument rows and the master row of 3.1 rem (49.6 px), and the file buttons' row: 1.25 rem of space, a rule, 0.8 rem and a button, about 60 px. In all about 450 px of 467.

### The two import panels

The scrim keeps a 1 rem margin, so the panel is at most 508 px tall. Mapping step: header, tempo line, summary and footer take about 170 px, leaving about 338 px, or seven rows of 48 px, for the track list (New York City Cops has nine tracks: the wheel shows the last two). Report: the headline and notes take about 100 px and the footer 41 px, leaving about 290 px, four to five instrument rows.

## Narrow windows

Below 720 px the Mixer rows become blocks and the import panels put the choice under a track's name. The settings bars wrap. That was reasoned and is not part of the 960 by 540 check.

## What the user should look at first

Open every tab at the default size and check: no scrollbar anywhere, the settings bar in one row on Rhythm (the widest), the Drums rows whole, the Song's five lanes, the Mixer's file buttons clear of the master, and the import mapping panel with a nine-track file.
