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

Program numbers are the General MIDI numbering from 1 to 128. The program change value is that number minus 1. The guitars are electric guitars. Keys is the instrument for vocals, which is why a voice sound was picked.

## Audition tool

Built and used. It lives in [tools/audition/](../tools/audition/) and is not a page of the app.

- It lists the candidates for each instrument, plays a short phrase written for that instrument, and copies the picks as text.
- It has two sources. The preview synth is a rough stand-in that plays in any browser. The Windows synth is the real Microsoft GS Wavetable Synth, reached through a small local bridge.
- To use the real sounds, run `node tools/audition/bridge.mjs` in the project folder and open the address it prints (`http://127.0.0.1:7777`).
- The bridge is needed because Chrome and Edge hide the Microsoft GS Wavetable Synth from web pages. Web MIDI lists no outputs for it, although Windows has it. The bridge calls the Windows MIDI API (winmm) through a PowerShell helper instead. See [stack.md](stack.md).
- It only plays the synth. It does not record it.

Windows' synth cannot shape attack, decay and release. The agreed plan is to record the chosen instruments from it into audio files that ship with the app, and shape the envelope in the app's own engine.

Fallback (questionnaire 16): if the Windows synth cannot be recorded exactly, a free General MIDI soundfont with the same four instrument names is acceptable. It would sound close to the Windows synth but not identical.

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
