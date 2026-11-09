# The project model

Built in plan24 step 2 as plain TypeScript in [src/core/](../src/core/), with unit tests beside it. It has no screen and no browser code, so every rule below is checked by `npm test`. The pages, the audio engine and the MIDI import build on it and must not bypass it.

## Files

| File | What it holds |
| --- | --- |
| `time.ts` | Ticks (12 per quarter note), the six note values, meters, the grid, snapping, BPM limits |
| `instruments.ts` | The five instruments, drum rows, tuning, fret counts, the Keys range, pattern and level limits |
| `project.ts` | The types, a new project, and the mixer and settings edits (BPM, meter, volume, mute, envelope, fret count, selected pattern, patterns shown) |
| `patterns.ts` | Note checks and edits, pattern length, copying notes between patterns |
| `song.ts` | Song lanes: placing, moving and removing blocks, song length |
| `history.ts` | Undo |
| `serialize.ts` | The saved JSON shape and the checking parser |

## Rules in the model

- Every edit is a pure function that returns a new project and shares what did not change. An edit that changes nothing returns the same object. An edit a rule can refuse returns `{ ok: false, reason }`, so a page can say why.
- **Time** is in ticks, 12 to a quarter note. A bar is 48 ticks in 4/4 and 36 in 3/4. A note starts and ends on the grid (a position in a beat of 0, 2, 3, 4, 6, 8, 9 or 10) and is at least 2 ticks long. This is the grid the MIDI import uses ([midi-import.md](midi-import.md)).
- **Notes** have no id. A drum hit is a row and a start. A string note (bass, Rhythm, Lead) is a string, a fret, a start and a length, with string 0 the lowest. A Keys note is a MIDI pitch (C4 = 60), a start and a length. Two notes with the same row/string/fret/pitch at the same start are the same note. Chords, and two notes on one string, are allowed.
- **Patterns:** 120 per instrument, 20 shown. Hidden ones open 20 at a time once every shown pattern is active. A pattern is 1, 2, 4 or 8 bars. Notes outside a shortened pattern are kept and return when it is lengthened. A pattern is active once it has a note, and goes back to inactive when its last note is deleted.
- **Song lanes:** blocks snap to bars, never overlap, may leave gaps, and stop at bar 256. A block is as long as its pattern. Only active patterns can be placed. The song ends at the last block of any lane.
- **Meter switch:** notes keep their positions. Notes that fall outside the new, shorter bar are deleted, hidden ones included, and a note running past the new end is shortened.
- **Undo:** snapshots of the whole project, 1000 at most, no redo. Edits with the same coalescing key (a slider being dragged) are one step. Choosing a pattern is not a step, and Undo leaves the selected pattern and the number of patterns shown as they are.
- **Saving:** `{ format: "modernstudio", version: 1, project }`. `parseProject` checks every field and refuses a damaged file with a reason; it never throws.

## Used by the audio engine

The engine reads the model but adds nothing to it: `levels.ts`, `envelope.ts`, `samples.ts`, `playback.ts` and `cursor.ts` in `src/core/` are described in [sound.md](sound.md). `playback.ts` turns a project into timed notes for Pattern mode and Song mode, and keeps out notes that are hidden by a shortened pattern or a lowered fret count.

## Not in the model

Isolate is a playback choice, not saved with the project (a project saved while one instrument was isolated would open silent). The playhead, the playing state, the metronome, the note value chosen in an editor and "Show whole pattern" are screen state. All of these belong to the app state of plan24 step 5.
