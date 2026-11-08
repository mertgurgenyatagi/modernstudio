# modernstudio docs

A minimalist, Windows-only music app made for one person. Five instruments, a Pattern mode and a Song mode, and a guitar editor laid out as strings instead of a piano roll. Start with [overview.md](overview.md).

## Status

The specification phase is closed. It was built through 16 answered questionnaires, and every answer is stored as given in [questionnaire_answers/](questionnaire_answers/). Questionnaire 17 was published but not answered. After that, MIDI import and export was added through a question-and-answer in chat, stored in [questionnaire_answers/midi_import.md](questionnaire_answers/midi_import.md) and written up in [midi-import.md](midi-import.md). [tools/midi-prototype/](../tools/midi-prototype/) holds a Python reference for the import algorithms. The build began with [plan24.md](plan24.md): step 1 added an app shell (Electron, TypeScript, React) that opens a placeholder screen at 960 by 540; no page is built yet. Step 2 added the project model in `src/core/` ([project-model.md](project-model.md)). See the root [README.md](../README.md) for how to run it.

## Read in this order

1. [overview.md](overview.md) — what the app is and why it exists.
2. [instrument-layouts.md](instrument-layouts.md) — the string layout, bass, drums, keys.
3. [time-and-notes.md](time-and-notes.md) — BPM, meter, note values, placing notes.
4. [patterns-and-song.md](patterns-and-song.md) — patterns and the Song timeline.
5. [sound.md](sound.md) — sound source, the chosen General MIDI sounds, the audition tool, envelopes, mixer.
6. [editing-and-project.md](editing-and-project.md) — undo, playback, saving, export, packaging.
7. [midi-import.md](midi-import.md) — importing and exporting MIDI files: the mapping step, the algorithms, and the eleven chosen album files.
8. [pages.md](pages.md) — the names of the pages and what each contains.
9. [stack.md](stack.md) — the chosen tech stack and the installed tooling.
10. [design.md](design.md) — the decided palette and fonts (Bone and black), and the default window size, 960 by 540. Not a layout or page design.
11. [page-designs.md](page-designs.md) — the decided layout of each page, picked one at a time. So far: the Mixer (the Ledger), the Song page (the Brush bar), the Drums page (the Pad machine) and the Guitar page (the String cards), one page for Bass, Rhythm Guitar and Lead Guitar.
12. [open-items.md](open-items.md) — everything undecided or decided by assumption. Read before building.
13. [project-model.md](project-model.md) — the project model as built (plan24 step 2): the rules in `src/core/`, and what is deliberately not in it.
14. [plan24.md](plan24.md) — the build plan, one step per `/plan24` invocation: the next three steps in detail, the rest in broad strokes, and the table of every step with its status.

## Where the truth lives

If a doc and a questionnaire answer disagree, the answer file wins, unless a later answer overrides it. Questionnaires 2 and 3 said BPM and meter can change mid-song. Questionnaires 7 and 8 corrected that: they are set for the whole song.

## Next

The stack is chosen, and so are the palette, the fonts, the Mixer, Song, Drums and Guitar layouts, and the four General MIDI sounds (bass, guitar, keys, drums; [sound.md](sound.md)). The default window is 960 by 540 and every page must handle it ([design.md](design.md)). One transport bar at the top of every page holds Play, Stop, the metronome and Undo. The preparation phase is over and the app is built by [plan24.md](plan24.md), one step at a time. That plan scaffolds the app, builds the model, records the chosen sounds from the Windows synth (a free General MIDI soundfont is the accepted fallback), then builds the audio engine and the pages. The Keys page is built from the Guitar page, and every page is checked at 960 by 540 (the Guitar editor may scroll vertically). The full described scope is wanted in the first build.
