# Fit at 960 by 540

How each page and panel fits the default window ([design.md](design.md)). Done in plan24 step 19 by reading the CSS and the layout code, and by `src/pages/fit.test.ts`, which recomputes the numbers below from the CSS files and the geometry code. **Nothing was looked at in a window** (the user's rule); the heights of lines of text and buttons are estimates by hand (font size times line height, plus padding), so each figure is good to about ten pixels. The user's check is to open each page in `npm run dev` at the default size.

## The budget

- The window is 960 by 540 inside the frame (`useContentSize`, [open-items.md](open-items.md)). No minimum size is set.
- The top bar takes about 44 px, so a page has **about 496 px** of height. A notice under the top bar (a refusal, "The sounds could not be loaded") takes another 29 px, leaving **about 467 px**. Two notices at once are not budgeted: the page then scrolls or its inner box shrinks, as described per page.
- The page never scrolls sideways. `.page` is the scrolling box of the shell (`overflow-y: auto`, `overflow-x: hidden`); a page that is taller than the window scrolls inside it, and the pages below say where they take care not to.

## Per page

| Page | Height used (usual / with a notice) | What scrolls | Verdict |
| --- | --- | --- | --- |
| Mixer | about 437 of 496 / 467 | nothing | fits |
| Song | about 420 of 496, 447 if the toolbar wraps (467 with a notice) | the lanes sideways; up and down only if the window is too low | fits |
| Drums | about 450 of 467 | nothing at 20 patterns; the page, if 40 or more patterns are shown | fits |
| Guitar | the box fills the page | the cards, up and down and sideways, inside their own box | fits, as accepted |
| Keys | the box fills the page | the roll, up and down and sideways, inside its own box | fits, as accepted |
| Mapping step | the panel is the window less 1 rem | the track list | fits |
| Import report | the panel is the window less 1 rem | the instrument rows | fits |

### Mixer

Padding 30, the heading and song fields 38, the table head 27, five instrument rows and the master row of 3.1 rem (49.6 px). The footer row holds Import MIDI, Export WAV and Export MIDI in the two narrow columns right of the master (128 px), so the three buttons **stack, one per line**, and the footer row is about 92 px instead of 50. That is the one place where the page looks different from the Ledger as drawn; it still fits (about 437 px). Width: the table is 912 px wide at most (the page is 64 rem wide at most); the name column is 11 rem, the volume column 38 per cent.

### Song

Sixteen bars: 16 bars of 48 px (768) plus the name column of 8 rem (128) plus 2 rem of padding is 928 of 960, so sixteen bars show and the rest scroll sideways inside the lanes. Height: padding 18, toolbar 38 (66 if it wraps), timeline 30, five lanes of 63 px and the sideways scrollbar (15): about 420 px. **The lane height was changed** from `(100vh - 11.5rem) / 5` to `(100vh - 14rem) / 5` (71 px to 63 px at 540): with a notice, a wrapped toolbar and the scrollbar together, the old formula cut the last lane by about 19 px, and the box did not scroll. The lane keeps 3.4 rem at least and 5.5 rem at most (reached at about 664 px of window height). The lanes box now scrolls up and down if the window is lower than the five lanes need (about 420 px), instead of cutting them off. A block's number (1.7 rem) fits a 63 px lane with 0.4 rem above and below.

### Drums

The panel is one bordered block: heading 36, bank 74 (two rows of ten numbers), the middle row, the envelope strip 56, plus padding and borders 26. The middle row was the problem: the tools column (Length, Note value, Show whole pattern, Copy notes to…) was **about 350 px tall** in a 9 rem column, which made the whole page about 541 px, 45 px more than the window. **Changed**: the tools column is 11.5 rem wide, Length is one row of four, Note value is two columns by three rows (Half of a third wraps to two lines), which brings the column to about 257 px. The pad rows are `(100vh - 20rem) / 5`, 44 px at 540 (they were 38 px with the 22 rem formula; the pads use the height the page has). The page is now about 450 px with a notice. A bar of 16th pads is now 39 px wide per pad (13.1 px per tick, a 4/4 bar being 48 ticks), not 42; the 14 px per tick maximum is reached from about 1000 px of window width. With 40 or more patterns the bank has four rows (+61 px) and the page scrolls as a whole; that is the only case.

### Guitar and Keys (the note editors)

Two columns: the main column and a 15 rem side panel. In the main column above the scrolling box: padding 8, the heading 25, the pattern bank 57 (two rows), the tools row 44 (88 if Length and Note value and Copy notes wrap to a second row), gaps 24. That leaves **about 339 px** for the box in the usual case (316 under the sticky ruler of 22 px), and **at least 244 px** in the worst case (a notice, a wrapped tools row, a two-line heading); the test asserts at least 200 px. Only this box scrolls; the title, bank and tools stay. The beat numbers stick to the top of the box and the fret or key column to its left.

- Width: the box is 688 px wide, minus the label column 35 px; one bar of 4/4 (48 ticks) gets 13.6 px per tick, of 3/4 the full 14. "Show whole pattern" fits the whole pattern.
- **String cards** (row 1.3 rem plus a 1 px rule, header 28 px, 10 px between cards): 5 frets 169 px, 7 frets 213 px, 12 frets 322 px. In the usual case one whole 5 or 7 fret card is in view (the Bass has four cards, about 850 px at 7 frets; the guitars six, about 1280 px); a 12 fret card is almost entirely in view (316 of 322 px). The vertical scroll is the one the user accepted in questionnaire 16.
- **Piano roll**: 49 rows of 22 px, about 1068 px, opened with middle C in the middle of the box.
- **Side panel** (Guitar): Instrument 102, Frets and Show whole pattern about 75, Envelope about 200, padding and gaps about 75: about 450 px against 467 to 496. It scrolls inside itself (`overflow-y: auto`) if it ever is taller. The Keys panel is shorter.

### The two import panels

The scrim keeps a 1 rem margin, so the panel is at most 508 px tall. Mapping step: header, tempo line, summary and footer take about 170 px, leaving about 338 px, or seven rows of 48 px, for the track list, which scrolls (New York City Cops has nine tracks). Report: the headline and notes take about 100 px (the notes box scrolls beyond 5.5 rem) and the footer 41 px, leaving about 290 px, four to five instrument rows; the rows scroll and Close stays in view.

## Narrow windows

Below 720 px every page restacks (the Mixer rows become blocks, the Drums and note editor panels move under their grids, the panels put the choice under a track's name). That was reasoned when each page was built and is not part of the 960 by 540 check.

## What the user should look at first

Open each page at the default size and check: the Mixer footer buttons stacked, the Song with all five lanes and the bottom scrollbar, the Drums page without a page scrollbar, one string card on the Guitar page, and the import mapping panel with a nine-track file.
