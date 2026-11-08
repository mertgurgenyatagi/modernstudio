# plan24

The build plan, run one step per invocation of the `/plan24` skill ([.claude/skills/plan24/SKILL.md](../.claude/skills/plan24/SKILL.md)). Step numbers are plan24's own and have nothing to do with the older branches `00-overall` to `04-guitars`.

Horizon: 24
Last completed step: 2
Replanned after step: 0

The plan is replanned after every third completed step (3, 6, 9, and so on). Done steps are history and are never changed by a replan.

## Ground rules for every step

- Verify by static means only: type check, lint, unit tests, build, running scripts. No Playwright, no browser tests, no screenshots (user's rule). Launching the Electron window to look at it is not part of a step either.
- The decided docs are the specification: [design.md](design.md), [page-designs.md](page-designs.md), [pages.md](pages.md), [sound.md](sound.md), [midi-import.md](midi-import.md) and the rest in the reading order of [README.md](README.md). Where something is undecided, ask; if a step goes on an assumption, it is written into [open-items.md](open-items.md).
- The app lives at the repository root (`package.json`, `src/`, `electron/`). `docs/`, `midis/`, `tools/` and `questionnaires/` stay where they are.
- Logic that is not drawing (the project model, time grid, scheduling maths, MIDI, fingering) is plain TypeScript with unit tests, so it can be checked without a window.
- The full described scope is wanted in the first build ([editing-and-project.md](editing-and-project.md)).

## Next three steps

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

## Later steps

Broad strokes only. The next replan (after step 3) details steps 4 to 6.

- 4: Audio engine. Load the samples, schedule notes ahead of time in Web Audio, apply per-instrument envelope and volume, mute and isolate, master volume, level meters, the metronome, pattern loop and song playback, play from the clicked bar.
- 5: App shell and the Mixer page. App state and Undo wired to the model, the transport bar (Play, Stop, metronome, Undo), the page switch (place undecided: ask), the Mixer layout "the Ledger".
- 6: The Song page, "the Brush bar": lanes, brush, ghost block, playhead, drag to move, Delete to remove.
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
| 3 | Capture the sounds | todo | 03-sounds |
| 4 | Audio engine | todo | |
| 5 | App shell and the Mixer page | todo | |
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
