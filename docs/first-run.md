# First run

What to try first, in the order a person would, after `npm install` and `npm run dev`. Brought up to date for the sweeping changes of 2026-11-09 ([sweeping-changes.md](sweeping-changes.md)), which have not been run in a window either, so each line is a real test. If a line fails, note it down; the build is meant to be fixed from your notes.

1. **The window.** It opens at 960 by 540 on the Mixer, in Bone and black, with the three fonts and seven tabs: Rhythm, Lead, Bass, Drums, Keys, Song, Mixer. No scrollbar anywhere. No dark "sounds could not be loaded" line under the top bar; if there is one, nothing else will sound, so stop and report it.
2. **Sound.** On Drums click a few pads (each should sound as it is placed), press Space (Play, Stop). The loop should play on the beat. Try the metronome button, Undo and Ctrl+Z.
3. **Mixer.** Move a volume slider and a Mute square while playing; the level meters should move. Type a BPM, or step it with the arrow keys; the tempo changes at once. Import MIDI, Export WAV and Export MIDI sit in their own row under the table.
4. **Meter.** Put a hit on beat 4, switch to 3/4 (the hit disappears), then back to 4/4: the hit is back.
5. **The settings bar.** On any instrument page: ‹ › and the pattern number (it opens a grid of patterns), 1× to 8×, the note values 1/1 to 1/16T (the lines of the grid follow them), − + Fit, and the four knobs (drag up and down, the wheel, a double click for the default).
6. **Editing.** On Keys, place a few notes; drag over empty space to select some; drag them up, down and sideways; drag a right edge; Ctrl+C, then Ctrl+V twice (copies land end to end); Delete. Choose another pattern and Ctrl+V: the notes land at the same places. Ctrl+wheel zooms where the pointer is.
7. **Guitars.** On Rhythm, Lead and Bass: place and drag notes across strings and frets; switch 5, 7 and 12 frets; the wheel scrolls the strings, Shift and the wheel go sideways.
8. **Envelope.** On Keys, place a long note and turn Att, Dec and Rel. Judge whether 0 to 100 feels right. These are guesses.
9. **Song.** Right-click an empty bar and pick a pattern. Drag a block; Ctrl+click or draw a rectangle round several; Ctrl+C then Ctrl+V (they land right after); Delete. Double-click a block to open its pattern. Ctrl+wheel zooms; Fit shows the whole song. Click a bar number and press Play to start from there.
10. **Save.** Ctrl+S, close the window, start the app again: the project should come back. Ctrl+O, Ctrl+N and the "Save changes to…?" question on close.
11. **Export WAV.** On the Mixer (with a Song that has blocks), export and listen to the file in another player.
12. **Export MIDI.** Export, then open the file in a music program: five tracks and the right instruments.
13. **Import.** Press Import MIDI and choose a file from `midis/`. Try *Is This it (2)* (its vocal track should go to Keys) and *New York City Cops (4)* for nine tracks (it has no vocals, so Keys stays empty). Check the mapping panel, press Import, read the report, then play the result.
14. **Look at the fit.** Go through every tab and both import panels at 960 by 540 once more with your eyes, and tell me what is cut or cramped ([fit.md](fit.md) has the figures).
15. **The packaged app.** `npm run dist`, install `release/modernstudio-setup-0.1.0.exe` (Windows will warn about an unknown publisher), and repeat lines 1, 2 and 10. This is where the sounds loading from inside the package is tested.
