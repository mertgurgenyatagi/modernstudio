# First run

What to try first, in the order a person would, after `npm install` and `npm run dev`. Nothing here has been run in a window by the build (see "Needs the user's check" in [open-items.md](open-items.md)), so each line is a real test. If a line fails, note it down; the build is meant to be fixed from your notes.

1. **The window.** It opens at 960 by 540 on the Mixer, in Bone and black, with the three fonts. No dark "sounds could not be loaded" line under the top bar. If there is one, nothing else will sound; stop and report it.
2. **Sound.** On the Drums page click a few pads, press Space (Play, Stop). The loop should play on the beat. Try the metronome button and the Undo button.
3. **Mixer.** Move a volume slider and a Mute square while playing; the level meters should move. Change BPM; the tempo changes at once.
4. **Envelope.** On Keys, place a few notes and move Attack, Decay and Release. Judge whether 0 to 100 feels right. These are guesses.
5. **Drums.** Place hits with the 16th and with the third values; try Length 2x, Show whole pattern and "Copy notes to…".
6. **Guitar.** Place, drag and lengthen notes on Bass and both guitars; switch 5, 7 and 12 frets; select a note and press Delete. Look at how much of the cards is in view at 960 by 540.
7. **Keys.** The roll should open around middle C. Place a chord; drag a note's right edge.
8. **Song.** Choose a brush, click empty bars to place blocks, drag one, press Delete on another. Click a bar number and press Play to start from there.
9. **Save.** Ctrl+S, close the window, start the app again: the project should come back. Ctrl+O, Ctrl+N and the "Save changes to…?" question on close.
10. **Export WAV.** On the Mixer (with a Song that has blocks), export and listen to the file in another player.
11. **Export MIDI.** Export, then open the file in a music program: five tracks and the right instruments.
12. **Import.** Press Import MIDI and choose a file from `midis/` (try *New York City Cops* for nine tracks). Check the mapping panel, press Import, read the report, then play the result.
13. **Look at the fit.** Go through all five pages and both import panels at 960 by 540 once more with your eyes, and tell me what is cut or cramped ([fit.md](fit.md) has the figures).
14. **The packaged app.** `npm run dist`, install `release/modernstudio-setup-0.1.0.exe` (Windows will warn about an unknown publisher), and repeat lines 1, 2 and 9. This is where the sounds loading from inside the package is tested.
