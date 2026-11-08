# Open items

Not yet decided, or decided by assumption.

- Which General MIDI instrument is used for each of the four sounds (drums, bass, guitar, keys). To be picked with the audition tool, then final.
- Tech stack: decided, no longer open. The assistant recommended Electron, TypeScript, React and Web Audio, and the user agreed. See [stack.md](stack.md). Its one known risk is how to record the General MIDI sounds.
- Page names and contents: written in [pages.md](pages.md) with assumptions. Pattern mode is treated as part of each instrument page. The places of the transport, metronome and undo controls are not specified.
- Palette and fonts: decided, no longer open. "Bone and black", look 09 of the overall-feel exhibition. See [design.md](design.md). That is all it decides. Page layouts are picked page by page and recorded in [page-designs.md](page-designs.md). Decided so far: the Mixer (the Ledger) and the Song page (the Brush bar). Every other page is still open.
- Mixer design assumptions: volume shown as 0 to 100, a Play button on the Mixer page, BPM as both a field and a slider, and three status words under each channel name. See [page-designs.md](page-designs.md).
- Song design assumptions: a Play button on the Song page, a "Bar 6 of 12" readout, a stepper that skips empty patterns, and 16 visible bars scrolling to 256. How blocks are removed (a Remove action or the Delete key) is still open. The ten Song designs were only statically linted, never viewed in a browser. See [page-designs.md](page-designs.md).
- The Keys range of C2 to C6 and the BPM range of 40 to 300 were examples the user accepted.
- Pattern names: the answer was "No", read as numbered only.
- Song length limit of 256 bars was picked by the assistant.
- Fret numbers shown on guitar and bass notes were left to the assistant.
- How a pattern is placed in the Song lane, and what happens to notes on a meter switch, were both left to the assistant. See [patterns-and-song.md](patterns-and-song.md) and [time-and-notes.md](time-and-notes.md).
