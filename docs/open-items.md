# Open items

Not yet decided, or decided by assumption.

- Which General MIDI instrument is used for each of the four sounds (drums, bass, guitar, keys). To be picked with the audition tool, then final.
- Tech stack: decided, no longer open. The assistant recommended Electron, TypeScript, React and Web Audio, and the user agreed. See [stack.md](stack.md). Its one known risk is how to record the General MIDI sounds.
- Page names and contents: written in [pages.md](pages.md) with assumptions. Pattern mode is treated as part of each instrument page. The places of the transport, metronome and undo controls are not specified.
- Palette and fonts: decided, no longer open. "Bone and black", look 09 of the overall-feel exhibition. See [design.md](design.md). That is all it decides. Page layouts are picked page by page and recorded in [page-designs.md](page-designs.md). Decided so far: the Mixer (the Ledger), the Song page (the Brush bar), the Drums page (the Pad machine) and the Guitar page (the String cards). Only Keys is still open.
- Guitar design assumptions: Bass, Rhythm Guitar and Lead Guitar are one page (the user's decision of 2026-11-08), with the instrument chosen in a side panel and each instrument keeping its own patterns, notes, fret count and envelope. Rows are labelled by fret number, with the pitch only on the open string in each card header, where the docs' example names the pitch on every row. The 5 and 12 fret layouts, the other note values and the 2x to 8x patterns are not drawn. Undo and Play are on the page. The twelve Guitar designs were only statically linted, never viewed in a browser. See [page-designs.md](page-designs.md).
- Mixer design assumptions: volume shown as 0 to 100, a Play button on the Mixer page, BPM as both a field and a slider, and three status words under each channel name. See [page-designs.md](page-designs.md).
- Song design assumptions: a Play button on the Song page, a "Bar 6 of 12" readout, a stepper that skips empty patterns, and 16 visible bars scrolling to 256. How blocks are removed (a Remove action or the Delete key) is still open. The ten Song designs were only statically linted, never viewed in a browser. See [page-designs.md](page-designs.md).
- Drums design assumptions: a Play and an Undo button on the page, the editor drawn as one pad per step of the chosen note value, 16 pads per bar for the 16th, "Show whole pattern" as a pressed-state button, "Copy notes to…" as a button with no picker drawn, envelope on a 0 to 100 scale with no units. How the pad grid looks for the other note values (including thirds) and for 2x to 8x patterns is not drawn. The ten Drums designs were only statically linted, never viewed in a browser. See [page-designs.md](page-designs.md).
- The Keys range of C2 to C6 and the BPM range of 40 to 300 were examples the user accepted.
- Pattern names: the answer was "No", read as numbered only.
- Song length limit of 256 bars was picked by the assistant.
- Fret numbers shown on guitar and bass notes were left to the assistant.
- How a pattern is placed in the Song lane, and what happens to notes on a meter switch, were both left to the assistant. See [patterns-and-song.md](patterns-and-song.md) and [time-and-notes.md](time-and-notes.md).
