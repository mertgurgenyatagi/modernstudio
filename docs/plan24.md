# plan24

The build plan, run one step per invocation of the `/plan24` skill ([.claude/skills/plan24/SKILL.md](../.claude/skills/plan24/SKILL.md)). Step numbers are plan24's own and have nothing to do with the older branches `00-overall` to `04-guitars`.

Horizon: 24
Last completed step: 14
Replanned after step: 12
Plan complete: no

The plan is replanned after every third completed step (3, 6, 9, and so on). Done steps are history and are never changed by a replan.

## Ground rules for every step

- Verify by static means only: type check, lint, unit tests, build, running scripts. No Playwright, no browser tests, no screenshots (user's rule). Launching the Electron window to look at it is not part of a step either.
- The decided docs are the specification: [design.md](design.md), [page-designs.md](page-designs.md), [pages.md](pages.md), [sound.md](sound.md), [midi-import.md](midi-import.md) and the rest in the reading order of [README.md](README.md). Where something is undecided, the step decides (the run is unattended, nobody is asked) and writes the assumption into [open-items.md](open-items.md).
- The app lives at the repository root (`package.json`, `src/`, `electron/`). `docs/`, `midis/`, `tools/` and `questionnaires/` stay where they are.
- Logic that is not drawing (the project model, time grid, scheduling maths, MIDI, fingering) is plain TypeScript with unit tests, so it can be checked without a window.
- The full described scope is wanted in the first build ([editing-and-project.md](editing-and-project.md)).

## Next three steps

Replanned after step 12 (2026-11-09). The horizon stays at 24 and the order is unchanged. Steps 13 and 14 are built (in the history below). Step 15 is in detail here; steps 16 to 24 are in "Later steps". The next replan comes after step 15, when steps 16 to 18 are detailed.

### Step 15: MIDI import, part two: strings and frets

**Produces:** the fingering search as pure code, checked against the prototype.

- **Fingering (`src/core/midi/fretting.ts`):** chord grouping, the cheapest 24 arrangements per chord (a shared string only if nothing else exists), the group and transition costs of [midi-import.md](midi-import.md), the `f` decay by gap, Viterbi with the per-survivor ringing check. A port of `fretting.py` with the same weights.
- **Fret count choice:** run at 5, 7 and 12, the penalty (3 per octave-moved note, 2 per chord with two notes on one string, 1 per ringing clash), the smallest count within `max(1, 0.2% of the notes)` of the best.
- **API:** `fingerTrack(notes, tuning, fretCount)` and `chooseFretCount(notes, tuning)`, returning string, fret and the metrics the report needs. The use once per distinct pattern comes in step 16.
- **Tests:** hand-made cases (a lone note on its lowest string; a chord on distinct strings; open strings do not move the hand; every result has the input pitch; a chord that cannot be placed on distinct strings falls back to a shared string), and a comparison with the prototype's fret counts and metrics on the eleven files, run on whole tracks.

**Relies on:** step 14, [midi-import.md](midi-import.md), `fretting.py`, `instruments.ts` (tunings).

**Done when:** tests pass; the chosen fret counts of the 33 guitar and bass parts equal the prototype's; typecheck, lint, test and build pass; the longest part (Barely Legal's rhythm guitar) finishes in a few seconds (noted in open-items).

**Decisions it may need:** exact float equality with the prototype is not required, only the same fingering choices except for recorded ties; the cap of 24 and the weights stay as in the docs.

## Done steps (history)

### Step 1: Scaffold the app

**Produces:** an Electron + TypeScript + React project that builds, with a window that opens at 960 by 540 (resizable and maximizable, no smaller minimum is decided so none is set), the decided palette and fonts as CSS tokens from [design.md](design.md), and the checks every later step uses.

- Tooling: npm, `electron-vite` (main, preload and renderer in one build), React 18, TypeScript in strict mode, ESLint, Vitest, `electron-builder` added later (step 20).
- Folders: `electron/main`, `electron/preload`, `src/` for the renderer, `src/core/` for pure logic, `src/styles/tokens.css` for the palette and fonts.
- Fonts: Piazzolla, Golos Text and Fragment Mono. They ship inside the app (downloaded once and bundled), not loaded from Google at run time, so the app works offline.
- A placeholder screen that shows only the wordmark in the display face and the three tokens at work, so the shell runs. No page layout is built yet.
- Scripts: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run dev`.
- `.gitignore` for `node_modules`, `out`, `dist`.

**Relies on:** [stack.md](stack.md), [design.md](design.md), [editing-and-project.md](editing-and-project.md).

**Done when:** typecheck, lint, test and build all pass, and the README says how to run the app.

**Decisions it may need:** none expected.

### Step 2: The project model

**Produces:** the data model and its rules as pure TypeScript in `src/core/`, with unit tests.

- Project: BPM (40 to 300), meter (4/4 or 3/4), master volume, five instruments (Drums, Bass, Rhythm Guitar, Lead Guitar, Keys), each with volume, mute, attack, decay, release, 120 patterns (20 shown, the rest hidden), the selected pattern, and for the guitars a fret count (5, 7, 12).
- Time grid in twelfths of a quarter note ([midi-import.md](midi-import.md)): note values (whole, half, quarter, 16th, third, half of a third), snapping, note length.
- Patterns: length 1x, 2x, 4x, 8x; notes outside a shortened pattern are kept; a pattern is active once it has a note; copy notes between patterns.
- Song lanes: blocks that snap to bars, never overlap, may leave gaps, song ends at the last block, 256 bars at most.
- Meter switch: notes that fall outside the new bar are deleted.
- Undo: a history of whole-project snapshots (or patches), no redo. Import starts with an empty history.
- New project: 120 BPM, 4/4, empty.
- A JSON shape for saving, with a version number, and parse and validate functions.

**Relies on:** [time-and-notes.md](time-and-notes.md), [patterns-and-song.md](patterns-and-song.md), [instrument-layouts.md](instrument-layouts.md), [editing-and-project.md](editing-and-project.md).

**Done when:** tests cover each rule above and pass; typecheck and lint pass.

**Decisions it may need:** whether Undo restores notes deleted by a meter change (open since questionnaire 16). Assumed yes (it is an edit like any other), recorded in open-items if not asked.

### Step 3: Capture the sounds

**Produces:** the audio files the app ships with: the four chosen General MIDI sounds ([sound.md](sound.md)) as recorded samples, plus a manifest saying which file covers which notes.

- First try recording the Windows synth: play notes through the existing bridge ([tools/audition/bridge.mjs](../tools/audition/bridge.mjs), winmm through PowerShell) while capturing system audio (WASAPI loopback). Drums are one sample per kit piece for the five rows (kick, snare, hi-hat, open hi-hat, crash). Melodic instruments are sampled every few semitones across their range with a note held long enough to shape with attack, decay and release.
- If the Windows synth cannot be recorded cleanly, use the accepted fallback ([questionnaire 16](questionnaire_answers/questionnaire_16.md)): a free General MIDI soundfont with the same four instrument names, rendered to the same files. Which soundfont and its licence are recorded in [sound.md](sound.md).
- Files are small (mono or stereo WAV or OGG, decided in the step), trimmed, and normalised to one level per instrument so volume 100 means the same thing everywhere.
- A script in `tools/` that regenerates them, so the result is repeatable.

**Relies on:** [sound.md](sound.md), [stack.md](stack.md) (the known risk), the audition tool.

**Done when:** every instrument has its files and manifest, a script checks that each file exists, has the expected length and is not silent, and [sound.md](sound.md) and [stack.md](stack.md) say how the sounds were made.

**Decisions it may need:** if system-audio capture fails, whether to accept the soundfont straight away (the user already accepted it as a fallback). Capturing needs a working audio output device and a quiet machine while it runs, so this step may be marked blocked and finished with the user present.

### Step 4: Audio engine

**Produces:** everything that makes sound, in two layers: pure scheduling logic in `src/core/` with unit tests, and a thin Web Audio layer in `src/audio/` that uses it. No screen is built yet; the engine is driven by a small API (`load`, `play`, `stop`, `setProject`, level readout) that step 5 wires to the app.

- **Event builder (pure, tested):** turns a project into a list of timed events in ticks, for two modes. *Pattern mode*: the selected pattern of one instrument looping, with the other instruments playing their own selected pattern ([patterns-and-song.md](patterns-and-song.md)). *Song mode*: the lanes from a start bar to the song end, then looping. Drum hits, string notes (string and fret to MIDI pitch through the tuning in `instruments.ts`) and Keys notes. Notes hidden outside a shortened pattern or above a lowered fret count are not played. Plus the metronome click events (accent on beat 1). Ticks to seconds uses the BPM.
- **Sample choice (pure, tested):** from `src/assets/sounds/manifest.json`, pick the nearest sample for a pitch and the playback-rate shift (at most 1 semitone); the guitars share files.
- **Web Audio layer:** load the 45 WAVs once (decode to buffers); a look-ahead scheduler (a timer that schedules the next ~100 ms of events on the audio clock, so timing does not depend on the UI thread); one gain chain per instrument (envelope voice gain, instrument volume, mute and isolate, master volume) and an analyser per instrument and for the master for the level meters.
- **Envelope:** attack, decay and release on the 0 to 100 scale of the project. The scale's meaning is decided in this step and written into [sound.md](sound.md): attack and release as 0 to about 2 s, decay as the fall from full to a sustain level over 0 to about 2 s, with 0 meaning the recorded sound unshaped. A note held longer than its sample is faded out (this matters for Keys' Synth Voice); a note shorter than its sample is cut with its release. The decided defaults of the model may be changed here (recorded in open-items).
- **Mute and isolate:** isolate is engine state, not project state; isolating one instrument mutes the others; only one at a time; a muted instrument stays silent in the playback.
- **Pattern loop and Song playback** starting from a given bar, looping at the song end; **play from the clicked bar** is just the start-bar argument.
- **Metronome** on and off while playing, no count-in.
- The pure parts must also be reusable by step 12's offline render, so the voice-building code takes an `AudioContext`-or-`OfflineAudioContext`-shaped context.

**Relies on:** [sound.md](sound.md), [editing-and-project.md](editing-and-project.md), [patterns-and-song.md](patterns-and-song.md), [project-model.md](project-model.md), the manifest from step 3.

**Done when:** unit tests cover the event builder (both modes, hidden notes, looping, the song end, start bar, metronome) and the sample choice; typecheck, lint and build pass; the audio layer compiles against the DOM types. The audio layer itself cannot be heard in a step without a window, so it is checked by types and by running the pure parts only; step 5 is the first one that can be heard by the user.

**Decisions it may need:** the numeric meaning of attack, decay and release (decided above, recorded); whether a drum hit is cut when the same row is hit again (assumed no, they overlap); the level meter reading (assumed peak level of the analyser, fast rise, slow fall).

**Built (2026-11-09):** `src/core/playback.ts` (event builder for both modes), `cursor.ts` (the look-ahead walk), `samples.ts` (sample choice), `envelope.ts`, `levels.ts`, and `src/audio/` (engine, voices, sound files). Decisions are in [sound.md](sound.md) and [open-items.md](open-items.md).

### Step 5: App shell and the Mixer page

**Produces:** the app state and the first working page.

- **App state:** a React store (context and a reducer, no extra library) that holds the history (`history.ts`), the screen state the model deliberately leaves out (playing, playhead, metronome, note value, "Show whole pattern", isolate, current page), and the engine. Every project edit goes through the model's pure functions and the history.
- **Shell:** one top bar on every page ([pages.md](pages.md)): the page switch at the left, the transport (Play, Stop, metronome toggle, Undo) at the right. Space starts and stops playback (not while typing in a field). The page switch is a row of five text tabs: Mixer, Song, Drums, Guitar, Keys; the page contents sit below, filling the window with no sideways page scroll at 960 by 540. Playing from the Mixer is Song mode if the song has blocks, else Pattern mode of the selected patterns (assumed).
- **The Mixer, "the Ledger"** ([page-designs.md](page-designs.md)): the table with the five rows and the footer master row, volume sliders with numbers, level meters, Mute and Isolate squares, the status words, BPM as a field and a slider, the meter choice. Its own Play button is dropped, the shared bar replaces it. Import MIDI and Export MIDI buttons are left out until steps 13 and 17.
- The other four pages are routes that show only their title until their step.
- Styling uses the tokens of [design.md](design.md); the narrow restack is done, and the 960 by 540 fit is checked by reasoning, not by looking.

**Relies on:** step 4, [page-designs.md](page-designs.md), [design.md](design.md) (including the 960 by 540 rule), [pages.md](pages.md).

**Done when:** the store has unit tests for its reducer logic (edits go through the history, Undo, isolate rules, mute); typecheck, lint, test and build pass. The user can hear and look at it by running `npm run dev`; that check is the user's, not the step's.

**Decisions it may need:** the place of the page switch (assumed: the top bar, tabs at the left, recorded in open-items); whether BPM or meter changes made while playing restart playback (assumed: the tempo changes at once, a meter change stops playback).

**Built (2026-11-09):** `src/state/appState.ts` (the reducer and `playRequestFor`), `src/state/Studio.tsx` (the store: reducer plus engine, and Space), `src/ui/` (top bar, slider, number field), `src/pages/Mixer.tsx`, and placeholders for the other four pages. The engine got a guard so that a Stop or a second Play during loading cancels the first Play. Assumptions are in [open-items.md](open-items.md). Not heard or seen by the step, as planned: the user's check is `npm run dev`.

### Step 6: The Song page

**Produces:** the "Brush bar" ([page-designs.md](page-designs.md)).

- Toolbar: position readout "Bar 6 of 12", the brush (instrument choice, pattern stepper that skips empty patterns). The page's own Play button is dropped for the shared bar.
- Timeline of bar numbers; click a bar moves the playhead; playback starts from there. 16 bars visible, scrolling sideways to 256 (the lanes scroll as one piece, the page never does).
- Five lanes with their blocks (pattern number large). The brush lane shows a dashed ghost block, snapped to the bar and as wide as the pattern. Click an empty bar to place (through `song.ts`, refused placements say why in a quiet line).
- Drag a block to move it (snaps, refused if it would overlap); select a block by clicking, Delete removes it. The playhead is a 2 px line through all lanes and moves while playing.
- The block-and-ghost geometry (bar to pixel, bar from pixel, the drop position) is pure code in `src/core/` or `src/pages/song/` with tests.

**Relies on:** steps 4 and 5 (the store already has `startBar` and the `setStartBar` action, and Play on the Song page plays the Song from it; the page draws the playhead from `engine.position()`), [patterns-and-song.md](patterns-and-song.md), `song.ts`.

**Done when:** geometry tests pass; typecheck, lint, test and build pass; the page reasoned to fit 960 by 540.

**Decisions it may need:** how a drag that would overlap behaves (assumed: the block snaps back and the reason shows); the playhead position after Stop (assumed: stays where it was started).

**Built (2026-11-09):** `src/pages/Song.tsx` and `song.css`, with the pure parts in `src/pages/song/` (`geometry.ts`, `brush.ts`, both tested); the store got `brush`, `selectedBlock` and `seek`. Assumptions are in [open-items.md](open-items.md). Not looked at, as planned.

### Step 7: The Drums page, "the Pad machine"

**Produces:** the Drums page ([page-designs.md](page-designs.md)) and the editor parts the Guitar and Keys pages reuse.

- **Shared parts in `src/pages/editor/`:** the pattern bank (the shown pattern numbers in rows of ten; selected = ink-filled, with notes = ink outline, empty = grey outline, all selectable; choosing is `selectPattern` through a `select` action, so not an Undo step), the Length choice (1x, 2x, 4x, 8x through `setPatternBars`; a refusal shows its reason in a quiet line), the Note value choice (six buttons, the store's `noteValue`), the "Show whole pattern" pressed-state button (the store's `showWholePattern`), and the envelope strip (Volume, Attack, Decay, Release: name, number, slider; edits coalesce by the keys `volume:<id>`, `attack:<id>` and so on, volume with the same key the Mixer uses).
- **Pad grid geometry, pure and tested (`src/pages/editor/grid.ts`):** the cells of a note value across a pattern (a cell is one step of that value; the last cell may overhang the end, as a whole note in 3/4 does), tick to cell, whether a hit lies on the chosen value's grid, the width of a tick, the playhead position.
- **The pads:** five rows, top to bottom Crash, Open hi-hat, Hi-hat, Snare, Kick; beat numbers above; hairlines at every beat and a heavier line at every bar. Each cell of the chosen note value is a pale pad; a click places a hit (`addNote`), a click on a placed hit removes it (`removeNote`). A hit that is not on the chosen value's grid (placed with another value) is drawn as a narrow ink mark at its own time and removed by clicking it, so a pattern can mix straight and third hits. Hits beyond a shortened pattern are not drawn (they are kept).
- **Width:** a tick is at most 14 px wide (16 pads of 42 px per bar at 4/4 and the 16th) and never wider than makes one bar fit the pad compartment; a longer pattern scrolls sideways inside the compartment; "Show whole pattern" fits all bars at once. The playhead (2 px line) follows `engine.position().tick` while playing.
- The page is the one bordered panel of the design, minus the Undo and Play buttons the shared bar replaces. "Copy notes to…" is not drawn until step 10, where its picker is built.
- `App.tsx` routes `drums` to the page.

**Relies on:** steps 4 to 6 (the store and `patterns.ts` already hold every edit), [page-designs.md](page-designs.md), [time-and-notes.md](time-and-notes.md), [instrument-layouts.md](instrument-layouts.md), [design.md](design.md) (960 by 540).

**Done when:** grid tests pass; typecheck, lint, test and build pass; the page is reasoned to fit 960 by 540. Not looked at, as the rule says.

**Decisions it may need:** how off-grid hits look (assumed: narrow ink marks); whether a placed pad sounds at once (assumed no; the engine has no audition call); the playhead on a pattern wider than the view (assumed: the view does not scroll to follow it, the same rule as the Song page).

**Built (2026-11-09):** `src/pages/Drums.tsx` and `drums.css`; the shared editor parts in `src/pages/editor/` (`PatternBank`, `Tools` with Length, Note value and Show whole pattern, `EnvelopeStrip`, `useTryEdit`, and the tested `grid.ts`); the engine got a `playingRequest` getter so a page draws its playhead only for its own loop. Assumptions are in [open-items.md](open-items.md). Not looked at, as planned.

### Step 8: The Guitar page, "the String cards"

**Produces:** the Guitar page for Bass, Rhythm Guitar and Lead Guitar ([page-designs.md](page-designs.md)), using step 7's shared parts.

- Layout: two columns. The main column holds the pattern row, the tools row, the beat numbers and the string cards (lowest string first: Bass E1 A1 D2 G2; guitars E2 A2 D3 G3 B3 E4). The 15rem side panel holds the instrument choice (the store's `guitar`), the fret count (5, 7, 12 through `setFretCount`) with "Show whole pattern" under it, and the envelope strip.
- Each card: a header strip with the open string's pitch and "open string", then fret rows 0 to the fret count (6, 8 or 13 rows), the open row tinted. Notes are ink squares showing their fret number, as wide as their length. Rows are labelled by fret, the pitch only in the header (as the design has it).
- Placing: a click on an empty cell places a note one step of the chosen value long; dragging the right edge lengthens or shortens it (snapped to the value, at least half of a third); dragging the note moves it; a click selects it. A refusal shows its reason. Notes above a lowered fret count are hidden and kept (the model); a quiet line says how many.
- The pure geometry (tick to x, drag to new start and length, the row of a fret) is in `src/pages/editor/` with tests, and is shared with Keys.
- The page scrolls vertically inside its own box (accepted in questionnaire 16); sideways only inside the card area.

**Relies on:** step 7; [instrument-layouts.md](instrument-layouts.md); `patterns.ts` (`addNote`, `replaceNote`, `removeNote`).

**Done when:** geometry tests pass; typecheck, lint, test and build pass; the 5, 7 and 12 fret layouts and the three instruments are reasoned through.

**Decisions it may need:** whether a click on an existing note selects or deletes (assumed: selects; Delete removes it in step 10); the default length of a new note (assumed: one step of the chosen value); what scrolls vertically (assumed: the main column, with the pattern and tools rows staying at the top).

**Built (2026-11-09):** `src/pages/Guitar.tsx` and `guitar.css`; the pure geometry in `src/pages/editor/noteGeometry.ts` (tested, shared with Keys) and the drag hook `useNoteDrag.ts` (shared with Keys). The note editor itself is still inside the Guitar page; step 9 pulls out what it shares. Assumptions are in [open-items.md](open-items.md). Not looked at, as planned.

### Step 9: The Keys page

**Produces:** the Keys page, built from the Guitar page ([open-items.md](open-items.md)): the same two columns, pattern row, tools row and side panel, with the string cards replaced by a regular piano roll from C2 to C6 (49 rows).

- Rows are piano keys with the black-key rows tinted; the side panel holds only the Keys envelope strip and "Show whole pattern" (no instrument choice, no frets).
- Notes are ink bars of their length with the same drag rules as step 8's. The row labelling is decided here: every C is labelled (C2 to C6), other rows carry no label (assumed; settles that part of questionnaire 17).
- The roll is 49 rows tall, so the main column scrolls vertically, starting with the octave around middle C (C4) in view.
- The note editor part both pages share is pulled into one component if step 8 left it inside the Guitar page.

**Relies on:** step 8.

**Done when:** tests for the pitch-to-row mapping and the label rule pass; typecheck, lint, test and build pass; fit reasoned.

**Decisions it may need:** the row labelling (assumed: Cs only); the starting scroll (assumed: C4 in view).

**Built (2026-11-09):** `src/pages/Keys.tsx`, `keys.css` and the pure, tested `src/pages/editor/keyRoll.ts` (rows, black keys, labels, notes on screen, the starting scroll). The note editor parts the Guitar page and Keys share were pulled out into `editor/noteEditor.css`, `Ruler.tsx` and `usePlayhead.ts`; the Guitar page now uses them and looks as before. The unused Placeholder page was removed. Assumptions are in [open-items.md](open-items.md). Not looked at, as planned.

### Step 10: Pattern tools and shortcuts

**Produces:** the editing pieces that steps 7 to 9 left out, in the shared editor parts of `src/pages/editor/`.

- **"Copy notes to…"** (`CopyNotes.tsx`): a button in the tools row of Drums (next to "Show whole pattern"), Guitar and Keys. It opens a small picker under the button: the instrument's shown patterns as numbered squares (empty ones grey, the source disabled) and a two-way choice "Replace" (default) or "Add" for what happens to the target's notes. Picking a number runs `copyNotes` as one Undo step, closes the picker and says "Copied to pattern 5" (or the refusal) in the page's quiet line. Escape or a click outside closes it. The pure part (the list of targets, the wording of the result) is in `src/pages/editor/copy.ts` with tests.
- **The hidden control for patterns 21 to 120:** in `PatternBank`, a "+20" square after the last number, drawn only when `canOpenMorePatterns` is true (every shown pattern has a note) and not once 120 are shown. It runs `openMorePatterns` as a `select` (not an Undo step, like choosing a pattern). The Song page's brush already steps over `shownPatterns`, so it needs nothing.
- **Delete for selected notes** on Guitar and Keys: Delete removes the selected note (`removeNote`, one Undo step) and clears the selection. A hook `useDeleteKey` in `editor/` listens on the window, ignores typing targets (`isTypingTarget`) and does nothing when nothing is selected. Drums has no selection (a click on a hit removes it), so it gets no Delete.
- **The warning when the fret count is lowered:** on the Guitar page the quiet line, when the new count hides notes, says how many notes in how many patterns of this instrument are now hidden and that raising the count brings them back (today's line counts only the selected pattern). The pure count over all patterns goes into `noteGeometry.ts` with tests. No dialog: Undo undoes the change.

**Relies on:** steps 7 to 9; `copyNotes`, `openMorePatterns` and `canOpenMorePatterns` in the model (built and tested in step 2); [patterns-and-song.md](patterns-and-song.md); [open-items.md](open-items.md).

**Done when:** tests for `copy.ts` and the all-pattern hidden count pass; typecheck, lint, test and build pass; the picker is reasoned to fit 960 by 540.

**Decisions it may need:** copy replaces by default and adds when chosen (the model's default, in open-items); the picker is a dropdown panel under the button, not a dialog; "+20" opens 20 at a time (already assumed); Delete removes only the one selected note (there is no multi-select).

**Built (2026-11-09):** `CopyNotes.tsx` and the pure `copy.ts`; the "+20" square in `PatternBank.tsx`; `useDeleteKey.ts` and `useNoteSelection.ts` (the selection is now scoped to the instrument and pattern on screen); `hiddenAcrossPatterns` and `fretChangeLine` in `noteGeometry.ts`. Assumptions are in [open-items.md](open-items.md). Not looked at, as planned.

### Step 11: Saving and files

**Produces:** save, open, new, reopen the last project, and the unsaved-changes prompt ([editing-and-project.md](editing-and-project.md)).

- **Main process (`electron/main/files.ts`):** handlers for Save (to the known path, else the Save As dialog), Save As, Open and New, with the `.modernstudio` extension (assumed; the file is the JSON of `serializeProject`). A save writes a temporary file and renames it, so a failed save never destroys the old file. The path of the last project is kept in a small `settings.json` in the user data folder; at start the window asks for it and opens it, falling back to a new project (with a quiet line) if the file is gone or does not parse.
- **Preload bridge:** one narrow typed function per command (`window.studio.files`), the types shared with the renderer.
- **Renderer:** the store learns the file state: the path (or none), the project last saved, and a dirty flag. A pure function decides "dirty" by comparing the present project with the saved one, ignoring the selected pattern and the number of shown patterns (choosing a pattern is not an edit); it is tested. The window title shows the file name and a mark when unsaved.
- **Replacing the project** (`replaceProject` action): New, Open and later MIDI import start a new history with the given project, stop playback and reset the playhead.
- **Commands:** an application menu File with New (Ctrl+N), Open (Ctrl+O), Save (Ctrl+S) and Save As (Ctrl+Shift+S). The menu stays hidden until Alt is pressed, as the window is made; the accelerators work all the time. The top bar gets no extra buttons.
- **Close:** the main process holds back closing while the project is dirty and asks (Save, Don't save, Cancel) in a native dialog; New, Open and later import ask the same way.

**Relies on:** step 5 (the store), `serialize.ts` (step 2), [editing-and-project.md](editing-and-project.md), [stack.md](stack.md).

**Done when:** tests for the dirty rule, the `replaceProject` reducer case and the settings parsing (a pure function on the settings text) pass; typecheck, lint, test and build pass. The dialogs and the file writing are not run by the step (no window), only type checked; open-items says so.

**Decisions it may need:** the file extension (`.modernstudio`); the title format ("name - modernstudio", a mark when unsaved); where the File commands live (assumed: the hidden menu and the shortcuts only); whether the dirty mark is in the title only (assumed yes).

**Built (2026-11-09):** the pure parts in `src/core/`: `fileState.ts` (the dirty rule, names, the window title, the extension), `settings.ts` and `fileBridge.ts` (the shared types and channel names), all tested; the main process in `electron/main/files.ts` (dialogs, atomic write, last project, holding back close) and `menu.ts`; the preload bridge `window.studio.files`; in the renderer `src/state/useFiles.ts`, the `replaceProject`, `saved` and `setNotice` actions, and a `files` object plus `replaceProject` in the store for the MIDI import step. Assumptions are in [open-items.md](open-items.md). The dialogs and the writing were type checked and built, not run (no window), as planned.

### Step 12: WAV export

**Produces:** "Export WAV" for the whole Song with every instrument, mute and isolate ignored, the metronome left out ([editing-and-project.md](editing-and-project.md)).

- **Offline render (`src/audio/render.ts`):** builds the Song events with the existing pure event builder (Song mode from bar 0 to the end, no loop, mute and isolate ignored), schedules them into an `OfflineAudioContext` through the voice-building code the live engine uses (made context-agnostic in step 4 for this), runs the same gain chain without the analysers, and adds a tail after the last note so releases and the longest sample ring out (assumed: up to 3 seconds).
- **WAV writer (`src/core/wav.ts`, pure, tested):** 16-bit PCM, stereo, 44.1 kHz; tests check the header and sample values and the clipping.
- **Plumbing:** the renderer calls a `files.exportWav(bytes, suggestedName)` bridge function; the main process shows the Save dialog (default name from the project file name) and writes the bytes. Progress: a quiet "Rendering…" line on the Mixer.
- **Placement:** an "Export WAV" button on the Mixer page in the footer row next to the master (Import MIDI and Export MIDI join it in steps 13 and 17). An empty Song says so instead of writing an empty file ("The Song has no blocks").

**Relies on:** steps 4, 5 and 11 (the bridge and the dialogs), [sound.md](sound.md).

**Done when:** the WAV writer tests pass, a test checks the render length (Song bars to seconds plus tail); typecheck, lint, test and build pass. The render runs in Chromium only, so it is checked by types; the user's check is to export and listen.

**Decisions it may need:** 44.1 kHz and 16-bit; the tail length (up to 3 s); whether the master volume applies (assumed yes, it is part of the mix); normalising (assumed none, the same level as playback).

**Built (2026-11-09):** the pure `src/core/wav.ts` (render length, file names, the 16-bit PCM writer with clipping; tested), the offline render `src/audio/render.ts` (the Song plan and `startNote` into an `OfflineAudioContext`, mute and isolate ignored, master volume applied, 3 s tail), the bridge function `files.exportWav` with its main-process handler (Save dialog, atomic write), the hook `src/state/useWavExport.ts` and an "Export WAV" button in the Mixer footer row. Assumptions are in [open-items.md](open-items.md). The render and the dialog were type checked and built, not run, as planned: the user's check is to export and listen.

### Step 13: MIDI file reader, writer and export

**Produces:** the MIDI file layer and the Export MIDI command. The import steps 14 to 16 build on the reader.

- **Reader (`src/core/midi/read.ts`, pure, tested):** parses format 0 and 1 files into tracks of events (note on and off with absolute tick, channel, track name, program, tempo changes, time signatures), the time division and the end tick. Handles running status, variable-length quantities and note-on with velocity 0 as note off, and ignores other meta and sysex events. Format 2 and SMPTE division are refused with a message that says what the file has. A port of `tools/midi-prototype/midilib.py`.
- **Writer (`src/core/midi/write.ts`, pure, tested):** a small track-and-event writer (VLQ, meta events, end of track) producing a standard MIDI file as bytes. Tests read the bytes back with the reader.
- **Export (`src/core/midi/export.ts`, pure, tested):** the Song flattened as [midi-import.md](midi-import.md) says: format 1, 480 ticks per quarter, a conductor track (BPM, meter) and five named tracks; the programs and channels of [sound.md](sound.md) (Bass 33 on channel 1, Rhythm Guitar 26 on 2, Lead Guitar 26 on 3, Keys 54 on 4, Drums on 10), drum rows as 36, 38, 42, 46, 49 (each hit a short note), string notes as pitches, controller 7 from instrument volume and master volume, velocity 100. Mute and isolate are ignored. It uses the Song plan of `playback.ts` for the notes, so export and playback agree. An empty Song says "The Song has no blocks, so there is nothing to export."
- **Plumbing:** `files.exportMidi(bytes, suggestedName)` in the bridge with a Save dialog in the main process (filter `.mid`), like `exportWav`; a hook `useMidiExport` like `useWavExport`; an "Export MIDI" button in the Mixer footer row next to "Export WAV".

**Relies on:** steps 2, 4, 11 and 12; [midi-import.md](midi-import.md) (the Export section); [sound.md](sound.md); the prototype's `midilib.py`.

**Done when:** tests pass for the reader (including the real files in `midis/`: the eleven album files parse, with track and note counts equal to the prototype's where it prints them), the writer round trip and the export (pitches, positions, lengths, channels, programs, controller 7, the empty Song); typecheck, lint, test and build pass. The dialog is type checked and built, not run.

**Decisions it may need:** a drum hit's length (assumed one 16th, 120 ticks); the controller 7 value (assumed round(volume x master / 100 x 127 / 100), recorded in open-items).

**Built (2026-11-09):** `src/core/midi/read.ts` (the reader, checked against the prototype on the eleven album files through `fixtures/reader.json` from `tools/midi-prototype/dump_reader.py`), `write.ts`, `export.ts` (all tested), the bridge function `files.exportMidi` with its main-process handler, the hook `src/state/useMidiExport.ts` and an "Export MIDI" button in the Mixer footer row. The writer got an optional `lengthTicks` so every track ends at the end of the Song. Assumptions are in [open-items.md](open-items.md). The dialog was type checked and built, not run, as planned.

### Step 14: MIDI import, part one: time, tempo, drums, range

**Produces:** the first half of the converter as pure code in `src/core/midi/`, checked against the Python prototype.

- **Mapping guesses (`guess.ts`):** the track list with the pre-filled assignment of [midi-import.md](midi-import.md) (channel 10, "bass", vocals, program families; Bass and Keys take the busiest track, guitars named or busiest; the rest Skip; per-row note counts).
- **Tempo, meter and pickup (`timing.ts`):** the dominant tempo (clamped 40 to 300, 120 if none), the dominant meter (4/4 and 3/4 only, else a refusal that names the meter), the pickup shift, and the notes about ignored tempo and meter changes for the report.
- **Grid snapping (`quantize.ts`):** starts and ends to the allowed positions in twelfths (0, 2, 3, 4, 6, 8, 9, 10; ties go to the straight 16th), minimum length 2 twelfths, the overlap and duplicate rules, the 256-bar cut.
- **Drums and range (`drums.ts`, `range.ts`):** the channel-10 map to the five rows with the dropped sounds counted; the octave folding into each instrument's range (counting moved notes), parameterised by the fret count (the choice of the count is step 15).
- **A check against the prototype:** a script `tools/midi-prototype/dump.py` writes the prototype's numbers for the eleven album files (tempo, meter, shift, bars, note counts after snapping, dropped hits, octave shifts) to a JSON fixture in `src/core/midi/fixtures/`; a test runs the TypeScript on the same files from `midis/` and compares. If Python cannot run, the step compares against the figures in the [midi-import.md](midi-import.md) album table and records the gap in open-items.

**Relies on:** step 13, [midi-import.md](midi-import.md), the prototype's `pipeline.py` and `report.py`.

**Done when:** unit tests for each piece pass, the album comparison passes for all eleven files; typecheck, lint, test and build pass.

**Decisions it may need:** where the converter's types live (`src/core/midi/types.ts`); how a refusal is returned (a result type with a message, never an exception); ties at exact midpoints (the prototype's rule).

**Built (2026-11-09):** `src/core/midi/` got `types.ts` (the `Result` type), `guess.ts`, `timing.ts`, `quantize.ts`, `drums.ts` and `range.ts`, all tested in `convert.test.ts`; `tools/midi-prototype/dump.py` writes `fixtures/import.json`, and the test compares all eleven album files with it (mapping, BPM, tempos, meter, shift, bars, drum hits and drops, note counts, start error, octave moves at 5, 7 and 12 frets). Python ran, so the fallback to the document's table was not needed. Assumptions (the pickup, the span for the tempo, dropping a too-short restarted note, the bar count) are in [open-items.md](open-items.md).

## Later steps

Broad strokes only. The next replan (the first `/plan24` run after step 15) details steps 16 to 18. The horizon stays at 24; the order is unchanged.

- 16: MIDI import, part three: patterns and Song lanes (the tiling), fingering once per distinct pattern, and building a project from the result.
- 17: MIDI import screens: the Import MIDI button on the Mixer, the unsaved prompt, the mapping step, the report.
- 18: Check the eleven album files end to end against the prototype's numbers.
- 19: Fit pass at 960 by 540 for every page, and the vertical scroll of the Guitar editor.
- 20: Installer with `electron-builder`; the runtime-only parts excluded from the package.
- 21: Open items and the unanswered questionnaire 17 questions: decide or ask, then document.
- 22: Final lint, type check and test pass, documentation tidy, handover notes.
- 23 and 24: Reserve for fixes and for anything that grew past one step.

## All steps

| # | Title | Status | Branch |
| --- | --- | --- | --- |
| 1 | Scaffold the app | done | 01-scaffold |
| 2 | The project model | done | 02-model |
| 3 | Capture the sounds | done | 03-sounds |
| 4 | Audio engine | done | 04-audio |
| 5 | App shell and the Mixer page | done | 05-shell |
| 6 | The Song page | done | 06-song |
| 7 | The Drums page | done | 07-drums |
| 8 | The Guitar page | done | 08-guitar |
| 9 | The Keys page | done | 09-keys |
| 10 | Pattern tools and shortcuts | done | 10-tools |
| 11 | Saving and files | done | 11-files |
| 12 | WAV export | done | 12-wav |
| 13 | MIDI reader, writer and export | done | 13-midi |
| 14 | MIDI import 1: time, tempo, drums, range | done | 14-import-time |
| 15 | MIDI import 2: strings and frets | todo | |
| 16 | MIDI import 3: patterns and lanes | todo | |
| 17 | MIDI import screens | todo | |
| 18 | Album check | todo | |
| 19 | Fit at 960 by 540 | todo | |
| 20 | Installer | todo | |
| 21 | Open items and questionnaire 17 | todo | |
| 22 | Final pass and handover | todo | |
| 23 | Reserve | todo | |
| 24 | Reserve | todo | |
