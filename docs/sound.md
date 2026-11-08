# Sound

## Sound source

All instrument sounds come from the classic Windows built-in set, the General MIDI synth (Microsoft GS Wavetable Synth). One sound is picked per instrument and is then final. The user has no say in it at runtime.

Rhythm Guitar and Lead Guitar use the same General MIDI instrument. They still have separate volume and envelope settings.

A small audition tool will be built so the instruments can be listened to and picked.

Windows' synth cannot shape attack, decay and release. The agreed plan is to record the chosen instruments from it into audio files that ship with the app, and shape the envelope in the app's own engine.

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
