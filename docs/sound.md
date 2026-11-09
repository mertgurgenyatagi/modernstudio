# Sound

## Sound source

All instrument sounds come from the classic Windows built-in set, the General MIDI synth (Microsoft GS Wavetable Synth). One sound is picked per instrument and is then final. The user has no say in it at runtime.

Rhythm Guitar and Lead Guitar use the same General MIDI instrument. They still have separate volume and envelope settings.

## Chosen sounds

Picked by the user on 2026-11-08 with the audition tool, from 9 bass, 6 electric guitar, 10 keys and 8 drum kit candidates. Final.

| Instrument | General MIDI sound | Program number | Program change value sent |
| --- | --- | --- | --- |
| Bass | Electric Bass (finger) | 34 | 33 |
| Rhythm Guitar and Lead Guitar | Electric Guitar (jazz) | 27 | 26 |
| Keys | Synth Voice | 55 | 54 |
| Drums | Standard Kit | 1 | 0, on MIDI channel 10 |

Program numbers are the General MIDI numbering from 1 to 128. The program change value is that number minus 1. The same values are written into exported MIDI files; the program numbers inside an imported MIDI file are ignored, because the sounds are fixed ([midi-import.md](midi-import.md)). The guitars are electric guitars. Keys is the instrument for vocals, which is why a voice sound was picked.

## Audition tool

Built and used. It lives in [tools/audition/](../tools/audition/) and is not a page of the app.

- It lists the candidates for each instrument, plays a short phrase written for that instrument, and copies the picks as text.
- It has two sources. The preview synth is a rough stand-in that plays in any browser. The Windows synth is the real Microsoft GS Wavetable Synth, reached through a small local bridge.
- To use the real sounds, run `node tools/audition/bridge.mjs` in the project folder and open the address it prints (`http://127.0.0.1:7777`).
- The bridge is needed because Chrome and Edge hide the Microsoft GS Wavetable Synth from web pages. Web MIDI lists no outputs for it, although Windows has it. The bridge calls the Windows MIDI API (winmm) through a PowerShell helper instead. See [stack.md](stack.md).
- It only plays the synth. It does not record it.

Windows' synth cannot shape attack, decay and release. So the chosen instruments are recorded from it into audio files that ship with the app, and the envelope is shaped in the app's own engine.

Fallback (questionnaire 16): if the Windows synth could not be recorded exactly, a free General MIDI soundfont with the same four instrument names was acceptable. It was not needed: the real Windows synth was recorded (see below), so no soundfont is used and no soundfont licence applies.

## The recorded samples

Made in plan24 step 3, on 2026-11-09, from the real Microsoft GS Wavetable Synth. They live in `src/assets/sounds/` with a `manifest.json`, and are committed to git (13.2 MB, 45 files).

How they were made: `tools/sounds/capture.py` plays each note through the Windows synth (the same `winmidi.ps1` helper the audition tool uses) and records the default speakers with WASAPI loopback (`PyAudioWPatch`, in a Python venv in `tools/sounds/.venv`, not committed; `tools/sounds/requirements.txt` lists it). Loopback takes the digital signal before it reaches the speakers, so room noise plays no part (and the speaker volume is expected to play none; not tested). Every note is played at velocity 100. The machine must be quiet while it runs; the script measures a second of silence first and refuses to start if something else is playing. The raw takes are kept in `tools/sounds/raw/` (not committed) so `process` can be re-run without recording.

Repeat it: `python tools/sounds/capture.py` (record, then process), or `record` and `process` alone. Check the result: `npm run check:sounds`.

| Instrument | Files | Which notes |
| --- | --- | --- |
| Bass | 10, in `bass/` | every 3 semitones from E1 (28) to G3 (55), the top of its range with 12 frets |
| Rhythm and Lead Guitar (shared) | 13, in `guitar/` | every 3 semitones from E2 (40) to E5 (76) |
| Keys | 17, in `keys/` | every 3 semitones from C2 (36) to C6 (84) |
| Drums | 5, in `drums/` | one per row: kick (note 36), snare (38), hi-hat (42), open hi-hat (46), crash (49) |

- Format: WAV, 16-bit, mono, 44.1 kHz. The loopback signal is stereo at 48 kHz; it is mixed down to mono and resampled. Mono because the app has no panning.
- Each file starts 2 ms before the first sound and ends where the sound drops under -60 dBFS (with a 30 ms fade). Latency before the note is removed.
- Level: every pitched sample is set to the same loudness (RMS of its first second at -20 dBFS), which evens out the pitch-to-pitch differences of the synth, and none peaks above -1 dBFS. The drum kit gets one gain for all five rows, so kick, snare and cymbals keep their balance, with the loudest hit at -1 dBFS. Volume 100 in the app can therefore mean the same thing for every instrument, which is the engine's job (step 4).
- `manifest.json` lists, for each instrument, its samples: the file, the note recorded (`pitch`), the notes it covers (`covers`, the engine plays a note by shifting the nearest sample, at most 1 semitone), `heldSeconds` (how long the key was held while recording) and `seconds` (the file length).
- The notes were held 2.5 s (bass), 3 s (guitar) and 4 s (keys). Bass and guitar die away on their own, and the highest guitar notes are already silent before the key was released. The Synth Voice (keys) does not: it would run to the end of the file after 4.7 s. Longer notes need the engine to loop or fade it; that is step 4's decision. The synth's own release after the key goes up is in the file too, so a short note played from the start of the sample is not the same as the note being released at that point. The engine has to cut and fade it.
- The Standard Kit hits are short: the kick is 0.12 s and the closed hi-hat 0.06 s, which is how the synth plays them.

## Per-instrument settings

Each instrument has exactly one setting for each of these, never per pattern or per note:

- Volume
- Attack
- Decay
- Release

Attack, decay and release are set on the instrument's own page.

A long release lets a note ring past the end of its pattern.

## Master mixer

Shows, for each instrument: volume, mute and isolate, plus a level meter that moves while playing. There is also a master volume. The mixer page is also where BPM and meter are set. See [time-and-notes.md](time-and-notes.md).

Isolate means nothing more than muting every other instrument. Only one instrument can be isolated at a time. The isolate button is highlighted to show it is on.

## No effects

No reverb, no effects of any kind.
