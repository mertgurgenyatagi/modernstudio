# plan24

The build plan, run one step per invocation of the `/plan24` skill ([.claude/skills/plan24/SKILL.md](../.claude/skills/plan24/SKILL.md)). Step numbers are plan24's own and have nothing to do with the older branches `00-overall` to `04-guitars`.

Horizon: 24
Last completed step: 5
Replanned after step: 3
Plan complete: no

The plan is replanned after every third completed step (3, 6, 9, and so on). Done steps are history and are never changed by a replan.

## Ground rules for every step

- Verify by static means only: type check, lint, unit tests, build, running scripts. No Playwright, no browser tests, no screenshots (user's rule). Launching the Electron window to look at it is not part of a step either.
- The decided docs are the specification: [design.md](design.md), [page-designs.md](page-designs.md), [pages.md](pages.md), [sound.md](sound.md), [midi-import.md](midi-import.md) and the rest in the reading order of [README.md](README.md). Where something is undecided, the step decides (the run is unattended, nobody is asked) and writes the assumption into [open-items.md](open-items.md).
- The app lives at the repository root (`package.json`, `src/`, `electron/`). `docs/`, `midis/`, `tools/` and `questionnaires/` stay where they are.
- Logic that is not drawing (the project model, time grid, scheduling maths, MIDI, fingering) is plain TypeScript with unit tests, so it can be checked without a window.
- The full described scope is wanted in the first build ([editing-and-project.md](editing-and-project.md)).

## Next three steps

Replanned after step 3 (2026-11-09). Steps 4 and 5 are built and moved to the history below; step 6 is the one left of this batch. The next replan comes after step 6.

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

## Later steps

Broad strokes only. The next replan (after step 6) details steps 7 to 9. Step 6 is detailed above. The horizon stays at 24; the order is unchanged.

- 7: The Drums page, "the Pad machine", including pad grids for the other note values and for 2x to 8x patterns.
- 8: The Guitar page, "the String cards", for Bass, Rhythm Guitar and Lead Guitar, with 5, 7 and 12 fret layouts.
- 9: The Keys page, built from the Guitar page with a piano roll from C2 to C6. May need a question on how rows are labelled.
- 10: Pattern tools and shortcuts: "Copy notes to…" picker, the hidden control for patterns 21 to 120, "Show whole pattern", Space to play, Delete for notes, fret count lowered after notes are placed.
- 11: Saving and files: save, open, reopen the last project, unsaved-changes prompt on close and on import.
- 12: WAV export by offline render.
- 13: MIDI file reader and writer, and MIDI export.
- 14: MIDI import, part one: tempo, meter, pickup bars, time grid, drum mapping, pitch range, checked against the Python prototype.
- 15: MIDI import, part two: string and fret choice (Viterbi) and the fret count.
- 16: MIDI import, part three: patterns and Song lanes (the tiling).
- 17: MIDI import screens: Import and Export buttons on the Mixer, the mapping step, the report.
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
| 6 | The Song page | todo | |
| 7 | The Drums page | todo | |
| 8 | The Guitar page | todo | |
| 9 | The Keys page | todo | |
| 10 | Pattern tools and shortcuts | todo | |
| 11 | Saving and files | todo | |
| 12 | WAV export | todo | |
| 13 | MIDI reader, writer and export | todo | |
| 14 | MIDI import 1: time, tempo, drums, range | todo | |
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
