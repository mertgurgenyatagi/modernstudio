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

## The audio engine

Built in plan24 step 4. The pure logic is in `src/core/` with unit tests: `playback.ts` (what plays and when), `cursor.ts` (hands notes out a little ahead of the clock), `samples.ts` (which file plays which note), `envelope.ts` and `levels.ts` (what the 0 to 100 numbers mean). The Web Audio part is in `src/audio/` (`engine.ts`, `voice.ts`, `notes.ts`, `soundFiles.ts`). No step without a window can hear it; the first listening is step 5.

- **Scheduling.** A timer looks every 25 ms and hands the sound card the notes due in the next 0.15 s, timed on the audio clock, so the user interface cannot make it late. Playback starts 60 ms after Play. Tempo changes apply at once, edited notes are picked up without a gap, and a meter change stops playback.
- **Samples.** A pitched note plays the nearest recorded sample, sped up or slowed down to reach the note (never more than one semitone inside the recorded range). A drum hit plays its row's file for its whole length. Notes hidden outside a shortened pattern, or on frets above the lowered fret count, are not played.
- **Hold.** A note is held for its length. A note longer than the key was held while recording (2.5, 3 or 4 seconds) is released at that point, which is how the Synth Voice of Keys, the one that never dies away, is faded out rather than looped. A note is cut where its pattern ends; its release rings on past it.
- **Volume.** 0 to 100 is a squared curve to a gain from 0 to 1. 100 plays the recorded level, and the samples were levelled to the same loudness, so volume 100 means the same for every instrument. The master is the same curve. Isolate silences the other instruments and is not saved with the project; an instrument that is muted and isolated stays silent.
- **Envelope.** Attack, decay and release each run 0 to 2 seconds on a squared curve (50 is 0.5 s). Attack is a fade-in from silence. Decay is a fall from full level to half level, held after that; with decay 0 the level stays full. Release is the fade-out after the note ends. With all three at 0 the recorded sound is unshaped, apart from a 20 ms fade at the end of a note so that cutting it does not click. A drum hit has no length, so it is held for its whole sample: attack and decay shape it, and release has no effect.
- **Meters.** The peak of an analyser beside each instrument and the master, on a dB scale from -60 to 0, rising at once and falling from full to empty in 0.4 seconds. The master meter reads after the master volume.
- **Metronome.** A click on every beat, the first beat of the bar higher, straight to the speakers: it is heard with everything muted, and it does not move the meters or the WAV export. No count-in.
- **Pattern mode.** The selected pattern of the focused instrument loops; the other instruments play their selected pattern along, a shorter one repeating to fill the loop and a longer one cut at its end. **Song mode** plays the lanes from the chosen bar to the end of the last block, then loops from the beginning of the song (not from the chosen bar).
- **Offline render.** The voice code takes any audio context, so the WAV export builds its notes the same way with an offline one (`src/audio/render.ts`, plan24 step 12): the Song from bar 1 to the end of the last block, through the same plan, voices and gain chain as playback, at 44.1 kHz stereo, written as a 16-bit PCM WAV (`src/core/wav.ts`). Mute and isolate are ignored (every instrument plays at its volume), the metronome is left out, the master volume applies, nothing is normalised, and 3 seconds of tail follow the last bar so releases and the longest sample ring out. Louder than full scale is clipped, not wrapped.

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
