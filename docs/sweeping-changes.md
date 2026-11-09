# Sweeping changes

The user's list of changes after the first run of the app (2026-11-09), stored as written in [questionnaire_answers/sweeping_changes.md](questionnaire_answers/sweeping_changes.md). It overrides earlier decisions where they disagree: the editors are now zoomable (questionnaire 12 said no), a meter switch no longer deletes notes (questionnaire 16 said it did), and the decided page designs lost the parts listed below. This file says what was built for each point and what the builder chose where the list left it open. None of it has been run in a window yet.

## All pages

**No scrollbars.** No element shows a scrollbar (`src/styles/base.css`). Every page is laid out to fit the window ([fit.md](fit.md)); where an editor holds more than it shows (a long pattern, six strings at 12 frets, the 49 keys) it still scrolls, with the wheel, Shift and the wheel for sideways, or a touchpad. Where nothing scrolls up and down (the Drums, the Song), the plain wheel scrolls sideways. The import panels' lists scroll the same way.

**Vocals to Keys.** The mapping guess of a MIDI import sends a vocal track to Keys before any other track ([midi-import.md](midi-import.md), `src/core/midi/guess.ts`). A track is vocal by its name (vocal, voice, singer, the singer's name, lyric, choir, and the words vox, voz, sing standing alone) or by a General MIDI voice program (Choir Aahs, Voice Oohs, Synth Voice, Lead 6 voice). The busiest vocal track takes Keys; only when there is none does the busiest other Keys track. Checked on the 75 files in `midis/`: every vocal track there was already guessed as Keys. The files with no vocal track at all, including the album picks for New York City Cops (the one [first-run.md](first-run.md) suggested), Barely Legal, Soma and Take It or Leave It, leave Keys empty, because there is nothing to send.

**Seven tabs:** Rhythm, Lead, Bass, Drums, Keys, Song, Mixer, in that order. Rhythm, Lead and Bass are one page drawn for each (the old Guitar page without its instrument choice). The app still opens on the Mixer.

**Horizontal zoom** on the Song page and the instrument pages: Ctrl with the wheel zooms where the pointer is; the − and + buttons zoom by two; Fit shows the whole pattern (it is the old "Show whole pattern", still a toggle) or the whole Song. An instrument page shows one bar across its width by default, from a beat up to the whole pattern; the zoom is shared by the instrument pages. A Song bar is 4 to 192 px wide (48 by default). The window itself never zooms (`setVisualZoomLevelLimits`, and Ctrl with the wheel is taken by the app).

**Natural editing**, as music programs have it. Both on the instrument pages and the Song:

- Click selects, Ctrl+click adds or removes, Shift+click adds, a drag over empty space draws a rectangle that selects (Ctrl or Shift: adds to the selection). Escape lets go.
- A selection is dragged as one, Delete or Backspace deletes it, Ctrl+A selects all, Ctrl+C, Ctrl+X and Ctrl+V copy, cut and paste, Ctrl+D doubles it right after itself, the arrow keys nudge it.
- Ctrl+Z undoes on every page. There is still no redo (questionnaire 14).
- Each edit, however many notes or blocks it moves, is one Undo step, and the model checks it (`replaceNotes`, `addNotes`, `removeNotes` in `src/core/patterns.ts`; `moveBlocks`, `placeBlocks`, `removeBlocks` in `src/core/song.ts`).

## Instrument pages (Drums, Rhythm, Lead, Bass, Keys)

**Compact settings.** One bar of small buttons above the editor replaces the pattern bank of twenty squares, the Length and Note value rows, the 15 rem side panel and the page title (`InstrumentBar.tsx`). Left to right:

- The pattern: ‹, its number, ›. The number opens all the shown patterns as a grid (a pattern with notes outlined in ink), with "+20" when every shown pattern has notes.
- The length: 1× 2× 4× 8×.
- The note value: 1/1, 1/2, 1/4, 1/16, 1/8T (the third) and 1/16T (half of a third). The full names are in the tooltips.
- Frets 5, 7, 12 (Rhythm, Lead and Bass only).
- − + Fit (the zoom).
- The quiet line (refusals, hidden notes), cut short with "…" when long; the whole text is in its tooltip.
- The envelope as four knobs: Vol, Att, Dec, Rel. Drag up or down, the wheel, or the arrow keys; a double click puts a knob back to its default; the word turns into the value while the knob is touched.

"Copy notes to…" is gone: select the notes (Ctrl+A), copy, choose the other pattern, paste. Notes pasted into another pattern land at the same places; pasted into the pattern they came from, right after themselves. Notes copied on one instrument paste only on that instrument, and between Rhythm and Lead, which share a layout.

**The editor itself** (`NoteEditor.tsx`, the same for all five pages, with the rows of `layout.ts`) takes the rest of the page. Its rows share the height (Drums 28 to 72 px a row, strings 16 to 26, keys 16 to 24). The string cards lost their headers: each string's name labels its open-string row, and an ink line divides the strings. A click on an empty place puts a note there and plays it; dragging a note moves it in time and to another row (another string or fret, another key, another drum); the grip at a note's right edge lengthens or shortens the selection. Shift with up or down moves a note by an octave on Keys and by a string on the guitars. A selected note is drawn hollow. On the Drums a click on a hit still takes it away, as on a pad; Ctrl+click selects a hit, and a dragged hit moves.

**Lines that follow the note value.** The grid draws its lines at the steps of the chosen value: every half note at 1/2, every bar at 1/1, every beat at 1/4; for the shorter values faint lines at each step and the beats in the rule colour. Bars are always ink. Lines closer than 5 px are left out when zoomed out. On the Drums the pads are the steps.

**A placed note sounds** (the open item "no audition"): placing a note, or dragging it to another row, plays it at the instrument's volume, whatever mute and isolate say.

## Song page

- The blocks are grey inside a black line, with the pattern's number at their left; the number stays in view while a block is scrolled partly out. A selected block is pale with a heavier line.
- The brush is gone (the instrument choice and the pattern stepper). A left click on an empty place does nothing but let go of the selection. A right click on an empty bar opens a menu with the lane's patterns that have notes (a pattern that does not fit there is greyed) and, when blocks are copied, Paste. A lane with no pattern yet offers to open its page instead.
- A right click on a block: Open pattern, Duplicate, Copy, Delete. A double click opens the block's pattern on its page.
- Ctrl+C then Ctrl+V pastes the copied blocks right after them, and each further Ctrl+V right after the last paste. A paste that would land on other blocks is refused, with the lane and bars named in the quiet line; nothing is overwritten.
- The lanes share the window's height (40 to 104 px), the bar numbers thin out when bars are narrow, and the readout "Bar 6 of 12" stays.
- An empty Song says "Right-click a lane to place a pattern." in its quiet line.

## Mixer

- BPM is a number field only (type it, or step it with the arrow keys); the slider is gone.
- Import MIDI, Export WAV and Export MIDI have their own row under the table, with space and a rule above, clear of the master's slider.
- The meter switch keeps every note. Switching 4/4 to 3/4 hides the notes past the shorter bar, as a shortened pattern does, and switching back brings them back. A note that runs past the new end plays and shows cut short, and keeps its length. Saved files keep the hidden notes.

## Assumed by the builder

The user may overturn any of these.

- The start page stays the Mixer.
- Paste never overwrites: a paste onto taken bars or notes is refused (blocks) or skips the notes already there (notes).
- The zoom is one setting for all instrument pages, not one per instrument.
- The arrow keys move a selection one step of the note value, or one row; the Song's selection one bar. Each press is one Undo step.
- The note values are labelled as in most music programs: 1/8T and 1/16T for the third and half of a third.
- The knobs replace the envelope sliders; the Mixer keeps its volume sliders.
- A note heard while placing is cut at a beat, so a whole note does not ring for two seconds.
- No redo, as questionnaire 14 has it, although the list asks for what a music program has.

## Second round (2026-11-09, after the MIDI album picks)

- **Instrument pages show the playing pattern.** While the Song plays, a page follows the playhead and shows the pattern of the block under it, with a playhead across it; see [patterns-and-song.md](patterns-and-song.md). Built: `blockAtTick` in `src/core/song.ts` (tested), the follow effect in `src/state/Studio.tsx`, the playhead in `src/pages/editor/NoteEditor.tsx`. The builder chose: following sets the selected pattern (not an Undo step, never "unsaved"); a gap keeps the last pattern; only the page on screen follows; the pattern picker cannot hold another pattern while the Song plays. Not run in a window yet.
- **Keys is a triangle wave** instead of the recorded Synth Voice; see "The Keys tone" in [sound.md](sound.md). The 17 Keys sample files and their manifest entry are gone (`check:sounds` now checks 28 files). The exported MIDI file still names Synth Voice for Keys. Not listened to yet.
- **Pattern names**, reached only by double-clicking the pattern number; shown as tooltips ([patterns-and-song.md](patterns-and-song.md)). Built: `setPatternName` and `patternLabel` in `src/core/project.ts`, the field in `src/pages/editor/InstrumentBar.tsx`, the tooltips on the Song page. The builder chose: tooltips only, 24 characters, an Undo step, no hint anywhere. Not run in a window yet.
- **Keys transpose**, instrument-wide, -24 to 24 semitones ([instrument-layouts.md](instrument-layouts.md)). Built: `setTranspose` in `src/core/project.ts`, applied in `src/core/playback.ts` (so both exports follow) and in the engine's note preview, the control in the Keys settings bar. The builder chose: the range, Shift for octaves, a click on the number to reset, notes drawn as written, the exports transposed. Not run in a window yet.
