# modernstudio docs

A minimalist, Windows-only music app made for one person. Five instruments, a Pattern mode and a Song mode, and a guitar editor laid out as strings instead of a piano roll. Start with [overview.md](overview.md).

## Status

The specification phase is closed. It was built through 15 questionnaires, and every answer is stored as given in [questionnaire_answers/](questionnaire_answers/). No code exists yet.

## Read in this order

1. [overview.md](overview.md) — what the app is and why it exists.
2. [instrument-layouts.md](instrument-layouts.md) — the string layout, bass, drums, keys.
3. [time-and-notes.md](time-and-notes.md) — BPM, meter, note values, placing notes.
4. [patterns-and-song.md](patterns-and-song.md) — patterns and the Song timeline.
5. [sound.md](sound.md) — sound source, envelopes, mixer.
6. [editing-and-project.md](editing-and-project.md) — undo, playback, saving, export, packaging.
7. [pages.md](pages.md) — the names of the pages and what each contains.
8. [stack.md](stack.md) — the chosen tech stack and the installed tooling.
9. [design.md](design.md) — the decided palette and fonts (Bone and black). Not a layout or page design.
10. [page-designs.md](page-designs.md) — the decided layout of each page, picked one at a time. So far: the Mixer (the Ledger), the Song page (the Brush bar) and the Drums page (the Pad machine).
11. [open-items.md](open-items.md) — everything undecided or decided by assumption. Read before building.

## Where the truth lives

If a doc and a questionnaire answer disagree, the answer file wins, unless a later answer overrides it. Questionnaires 2 and 3 said BPM and meter can change mid-song. Questionnaires 7 and 8 corrected that: they are set for the whole song.

## Next

The stack is chosen, and so are the palette, the fonts, and the Mixer, Song and Drums layouts. Next: decide the remaining page designs one page at a time (the guitar pages next), then build the audition tool to pick the General MIDI instruments, then build the app. The full described scope is wanted in the first build.
