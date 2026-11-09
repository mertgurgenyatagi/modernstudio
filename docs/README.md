# modernstudio docs

A minimalist, Windows-only music app made for one person. Five instruments, a Pattern mode and a Song mode, and a guitar editor laid out as strings instead of a piano roll. Start with [overview.md](overview.md).

## Status

The specification phase is closed. It was built through 16 answered questionnaires, and every answer is stored as given in [questionnaire_answers/](questionnaire_answers/). Questionnaire 17 was published but not answered; the build settled its five questions ([open-items.md](open-items.md)). MIDI import and export was added through a question-and-answer in chat ([questionnaire_answers/midi_import.md](questionnaire_answers/midi_import.md), [midi-import.md](midi-import.md)), with a Python reference for the algorithms in [tools/midi-prototype/](../tools/midi-prototype/).

**The build is complete.** [plan24.md](plan24.md) ran 22 steps: the Electron, TypeScript and React shell, the project model, the recorded sounds, the audio engine, all five pages (Mixer, Song, Drums, Guitar, Keys), saving, WAV and MIDI export, the whole MIDI import with its mapping panel and report, the check at 960 by 540, and the Windows installer. Nothing has been run in a window yet. [handover.md](handover.md) says what is built and what to check; [first-run.md](first-run.md) is the order to try it in. See the root [README.md](../README.md) for how to run it.

**Sweeping changes (2026-11-09).** After the first run the user asked for a list of changes: seven tabs, zoom, no scrollbars, compact instrument pages, selection and copying as in a music program, and more. They are built and recorded in [sweeping-changes.md](sweeping-changes.md); the user's words are in [questionnaire_answers/sweeping_changes.md](questionnaire_answers/sweeping_changes.md).

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
11. [page-designs.md](page-designs.md) — the decided layout of each page, picked one at a time. So far: the Mixer (the Ledger), the Song page (the Brush bar), the Drums page (the Pad machine) the Guitar page (the String cards), one page for Bass, Rhythm Guitar and Lead Guitar, and the Keys page (a piano roll built from the Guitar page, no exhibition).
12. [open-items.md](open-items.md) — three sections: what is decided, what the builder assumed (by step), and what needs the user's check; with the table that settles questionnaire 17. Read before building.
13. [project-model.md](project-model.md) — the project model as built (plan24 step 2): the rules in `src/core/`, and what is deliberately not in it.
14. [fit.md](fit.md) — how each page and panel fits 960 by 540: the height budgets, what scrolls, and the two changes the check made (plan24 step 19).
15. [first-run.md](first-run.md) — what to try first after `npm run dev`, in order (plan24 step 21).
16. [plan24.md](plan24.md) — the build plan, one step per `/plan24` invocation: the next three steps in detail, the rest in broad strokes, and the table of every step with its status.
17. [handover.md](handover.md) — what is built, what was never run, the commands, the folder map and what to do next (plan24 step 22).
18. [sweeping-changes.md](sweeping-changes.md) — the user's changes after the first run: what was built for each and what the builder chose. Where it disagrees with an older document, it wins.
19. [harmony.md](harmony.md) — the key and chords on the Song page and the chord of a pattern on Rhythm, Lead and Bass: how they are found.

## Where the truth lives

If a doc and a questionnaire answer disagree, the answer file wins, unless a later answer overrides it. Questionnaires 2 and 3 said BPM and meter can change mid-song. Questionnaires 7 and 8 corrected that: they are set for the whole song. The sweeping changes of 2026-11-09 overturn two answers: the editors zoom (questionnaire 12 said no) and a meter switch keeps notes (questionnaire 16 deleted them).

## Next

The plan is complete: [plan24.md](plan24.md) says `Plan complete: yes`. The next move is the user's: run `npm run dev`, go through [first-run.md](first-run.md), and write down what fails or feels wrong ([open-items.md](open-items.md), "Needs the user's check", lists what was never run). Steps 23 and 24 of the plan are reserves for fixes; they are built only when the user asks for one by name. The decisions behind the build (stack, palette and fonts, the five page layouts, the four General MIDI sounds, the 960 by 540 window, one transport bar on every page) are in the documents above; the Guitar editor may scroll vertically, as the user accepted.
