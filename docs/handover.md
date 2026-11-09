# Handover

The state of modernstudio at the end of [plan24.md](plan24.md) (step 22, 2026-11-09). Five minutes to read. The build ran unattended, so nobody has yet opened the app in a window or listened to it. That is the user's next job, and [first-run.md](first-run.md) is the order to do it in.

## What is built

**Changed since:** the user's sweeping changes after the first run are built: seven tabs, zoom, no scrollbars, compact instrument pages, selection and copying as in a music program, the right-click menu on the Song, the meter switch that keeps notes. [sweeping-changes.md](sweeping-changes.md) says what changed; the list below is the state at step 22.

**Pages** (top-bar tabs: Mixer, Song, Drums, Guitar, Keys; one transport bar on every page with Play, Stop, metronome and Undo, and Space for Play/Stop)

- **Mixer** (the Ledger): five channels with volume, level meters, Mute and Isolate, BPM (field and slider), meter 4/4 or 3/4, master volume, and the buttons Import MIDI, Export WAV and Export MIDI.
- **Song** (the Brush bar): five lanes of blocks over 256 bars, a brush with a ghost block, drag to move, Delete to remove, click a bar to play from it.
- **Drums** (the Pad machine): five rows of pads for the chosen note value, patterns of 1x to 8x, "Show whole pattern", "Copy notes to…".
- **Guitar** (the String cards): one page for Bass, Rhythm Guitar and Lead Guitar, one card per string, frets 5, 7 or 12, notes placed, moved and lengthened by mouse.
- **Keys**: a piano roll from C2 to C6, built from the Guitar page.
- **Patterns:** 120 per instrument, 20 shown, "+20" opens more.

**Features**

- **Sound:** the four chosen General MIDI sounds, recorded from the Windows synth into 45 WAV files ([sound.md](sound.md)); a Web Audio engine with a look-ahead scheduler, envelopes, mute and isolate, a metronome.
- **Files:** New, Open, Save, Save As (`.modernstudio`), reopening the last project, the unsaved-changes question.
- **Export:** WAV (16-bit stereo, 44.1 kHz, offline render) and MIDI (one track per instrument).
- **Import MIDI:** the mapping panel, a converter that cuts tracks into patterns and Song blocks and chooses strings and frets, and a report ([midi-import.md](midi-import.md)). Checked end to end on the eleven album files in `midis/`.
- **Installer:** `npm run dist` makes a per-user NSIS installer (about 123 MB, no code signing, no icon).

## What was never run

Everything was type checked, linted, unit tested where it has pure parts, and built. Nothing was run in a window, heard or looked at (the rules of the build forbid it). The full list is "Needs the user's check" in [open-items.md](open-items.md); the order to try it in is [first-run.md](first-run.md). The most likely trouble spots, in order:

1. The packaged app loading its sounds from inside `app.asar` (a dark "sounds could not be loaded" line under the top bar).
2. The feel of the envelope (Attack, Decay, Release on 0 to 100) and the volume curve.
3. Fit at 960 by 540, which was checked by arithmetic ([fit.md](fit.md)) and not by eye.
4. The file dialogs, the close guard and the offline WAV render.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Opens the app in a window |
| `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` | The four checks every step passed |
| `npm run check:sounds`, `npm run check:package`, `npm run check:docs` | Sounds against their manifest; the package holds only the app; broken links in the docs |
| `npm run pack`, `npm run dist` | Unpacked folder; installer in `release/` |

## Folder map

- `src/core/`: plain logic (model, time grid, playback plan, MIDI reader, writer, converter, fingering), the part with most of the tests. `src/audio/`: Web Audio. `src/state/`: the store. `src/pages/`, `src/ui/`: screens and controls.
- `electron/main`, `electron/preload`: the window, files and dialogs.
- `docs/`: the specification and these notes. `midis/`: the MIDI files. `tools/`: the sound capture, the audition tool, the MIDI prototype in Python (a reference, not part of the app), the package and docs checks.

## Numbers

At the end of step 22: 34 test files, 652 tests, all passing; typecheck, lint, build, `check:sounds` (45 files), `check:package` (98 entries in `app.asar`, none foreign) and `check:docs` pass. `npm audit --omit=dev` finds 0 advisories; the 15 moderate ones are in build tools only.

## Assumptions you may want to overturn

All are in [open-items.md](open-items.md) with the file where each lives. The ones most likely to matter once you have used the app:

- The five questions of questionnaire 17 (the table at the top of open-items).
- The envelope scale: attack and release 0 to about 2 s, decay the fall to a sustain level, squared curves.
- Importing opens a new, unsaved project named after the MIDI file; the report shows once.
- MIDI drums: toms and splash are dropped, pedal hi-hat goes to hi-hat, the crashes to crash.
- A placed pad or note makes no sound when placed (no audition call). Since the sweeping changes it does.
- No window minimum size, no icon, no code signing, version stays 0.1.0, no release tag.

## What next

Use [first-run.md](first-run.md) and note what fails or feels wrong. Steps 23 and 24 of the plan are reserves for fixes: ask for one by name (for example "run plan24 step 23, with these notes") and it will be built. The plan itself is complete.
