# Open items

Read this before building. It has three sections and a table:

1. **Decided**: no longer open. Listed so nobody asks again.
2. **Assumed by the builder**: the run was unattended, so the builder decided and wrote it down. The user may overturn any of them. First the choices made before the build, then the choices of each plan24 step, in step order, each with the file where it lives.
3. **Needs the user's check**: everything that was type checked, linted, unit tested and built but never run in a window, heard or looked at.

The table of questionnaire 17 comes first, since that questionnaire was never answered. What to try first, in order, is in [first-run.md](first-run.md). Last brought up to date in plan24 step 21 (2026-11-09); the statements were checked against the code or a step's "Built" paragraph in [plan24.md](plan24.md).

## Questionnaire 17

Questionnaire 17 was published and never answered, because the user closed the questionnaire step. Its five questions were left to the builder, and the build has settled all of them. To overturn one, change the rule in the file named and say so.

| Question | Settled as | By | Where it lives | How to overturn |
| --- | --- | --- | --- | --- |
| Does Undo restore notes a meter change deleted? | Moot since the sweeping changes: a meter change deletes nothing, the notes past the shorter bar are hidden and come back on switching back. Undo undoes the switch like any other edit | Step 2, then the sweeping changes | `setMeter` in `src/core/project.ts`, tested in `project.test.ts` | Say so |
| Does Delete remove selected notes in the instrument editors? | Yes, the whole selection, one Undo step, on every instrument page; several notes can be selected since the sweeping changes (a click on a drum hit still removes it) | Step 10, then the sweeping changes | `src/pages/editor/NoteEditor.tsx` | Ask for a Delete button |
| Does copying notes into a pattern replace or add? | Adds: "Copy notes to…" is gone since the sweeping changes, and a paste adds to the notes there (to replace, select all and delete first) | Steps 2 and 10, then the sweeping changes | `addNotes` in `src/core/patterns.ts`; the paste in `src/pages/editor/NoteEditor.tsx` | Say so |
| Does Keys label every row or only the Cs? | The Cs only (C2 to C6); screen readers get every pitch | Step 9 | `keyLabel` in `src/pages/editor/keyRoll.ts` | Change the label rule there (it is tested) |
| Does the third value show only third steps? | The grid shows the steps of the chosen value, lines and pads alike (the sweeping changes made the lines follow it on every page); a hit placed with another value is a narrow ink mark at its own time, so straight and third hits can mix | Step 7, then the sweeping changes | `isOnGrid` and `gridLines` in `src/pages/editor/grid.ts` | Say how the thirds should look; the pure grid code is tested |

## Decided

No longer open.

- **Sweeping changes (2026-11-09).** The user's list after the first run, as written in [questionnaire_answers/sweeping_changes.md](questionnaire_answers/sweeping_changes.md), built and described in [sweeping-changes.md](sweeping-changes.md). It overrides the items below where they disagree (the tabs, the meter switch, zoom, the Song's brush, the instrument page layouts). The builder's own choices in it are listed there under "Assumed by the builder".
- **Sounds.** Bass is Electric Bass (finger), both guitars are Electric Guitar (jazz), Keys is Synth Voice, Drums is the Standard Kit ([sound.md](sound.md)). Recording them from the Windows synth was solved in step 3: the real synth was captured, so the soundfont fallback (questionnaire 16) was not used. The Windows synth was not checked for all eight drum kits, which no longer matters since the Standard Kit was picked.
- **Tech stack.** The assistant recommended Electron, TypeScript, React and Web Audio, and the user agreed ([stack.md](stack.md)). Its one known risk, recording the General MIDI sounds, was resolved in step 3.
- **Palette and fonts.** "Bone and black", look 09 of the overall-feel exhibition ([design.md](design.md)). That is all it decides. Page layouts were picked page by page and are recorded in [page-designs.md](page-designs.md): the Mixer (the Ledger), the Song page (the Brush bar), the Drums page (the Pad machine), the Guitar page (the String cards), and Keys (built from the Guitar page, no exhibition).
- **Default window size: 960 by 540**, and every page must handle it ([design.md](design.md)). The four layouts were designed before this and were unchecked; step 19 checked them by reasoning and by tests and made two small changes ([fit.md](fit.md)). The Guitar page is the known tall one: six string cards run about 1000 pixels at the drawn row height, so the editor scrolls vertically inside its own box. The user accepted this in questionnaire 16.
- **Bass, Rhythm Guitar and Lead Guitar are one page** (the user's decision of 2026-11-08), each instrument keeping its own patterns, notes, fret count and envelope. Since the sweeping changes each has its own tab (Rhythm, Lead, Bass) drawing that page, and the side panel's instrument choice is gone.
- **Keys** is built from the Guitar page (the user's decision of 2026-11-08): the same two columns, pattern row, tools row and side panel, with the string cards replaced by a regular piano roll from C2 to C6. No exhibition was run for it; it was built in step 9.
- **The Keys range of C2 to C6 and the BPM range of 40 to 300** were examples the user accepted.
- **Pattern names:** the answer was "No", read as numbered only.
- **Meter switch:** notes falling outside the new bar are kept, hidden, and come back when the meter is switched back (the sweeping changes, overturning questionnaire 16, which deleted them). See [time-and-notes.md](time-and-notes.md).
- **More than 20 patterns per instrument:** 120, shown 20 at a time with a hidden control (2026-11-09). The control is the dashed "+20" square, built in step 10; since the sweeping changes it is in the grid the pattern number opens, and the Song's right-click menu lists every shown pattern with notes.
- **Fret count lowered after notes are placed:** the notes are kept, hidden, and return when the count is raised (the model, step 2), and the Guitar page's quiet line warns (step 10). This closes the old question, which mattered because imports set 12 frets for most guitar parts.
- **Blocks are removed** by selecting and pressing Delete, with no button (questionnaire 16).
- **The transport** (Play, Stop, metronome, Undo) is one bar at the top of every page (questionnaire 16). The four decided designs drew their own Play and Undo buttons; the build dropped them for the shared bar (steps 5 to 8, noted in [page-designs.md](page-designs.md)). The page switch sits in that bar (step 5).
- **Page names and contents:** [pages.md](pages.md). Pattern mode is part of each instrument page.
- **MIDI import and export:** decided on 2026-11-09, see [midi-import.md](midi-import.md); built in steps 13 to 18. Things the user left to the assistant ("your call", "you know better", or a question they did not follow), all decided there: that two tracks for one instrument are not merged unless the user chooses it; how Rhythm and Lead guitar are told apart (the busier track is Rhythm, and the user can swap them); how the fret count is picked (playability first, so mostly 12 frets); tempo (the one that covers the most time, others ignored) and meter (4/4 or 3/4 only, anything else is refused, a lead-in bar is shifted onto a bar line, a mid-song change is ignored with a warning); and the export details (a Song-arrangement file with one track per instrument, velocity 100, volume as controller 7, drum notes 36, 38, 42, 46, 49).
- **MIDI reading and writing** is the app's own small code in `src/core/midi/`, no library (step 13). The Python in [tools/midi-prototype/](../tools/midi-prototype/) is a reference, not part of the app.
- **MIDI limits.** MIDI format 2 and SMPTE time are refused with a reason (step 13), as are meters other than 4/4 and 3/4 (step 14). Only exact repeats are merged when patterns are built; merging near repeats is not designed. A lane that would need more than 120 patterns is cut (step 16; it cannot happen within 256 bars, see the step 16 items below).
- **The Mixer's extra buttons.** The Ledger as drawn has no Import MIDI, Export WAV or Export MIDI buttons. They were built as three buttons in the footer row (steps 12, 13 and 17). The mapping step and the import report are panels over the Mixer (steps 17 and 18), not drawn in an exhibition; both are recorded as the assistant's design in [page-designs.md](page-designs.md).

## Assumed by the builder

The user may overturn any of these.

### Before the build (specification phase)

- **Guitar design.** Rows are labelled by fret number, with the pitch only on the open string in each card header, where the docs' example names the pitch on every row. The 5 and 12 fret layouts, the other note values and the 2x to 8x patterns were not drawn (step 8 built them). The twelve Guitar designs were only statically linted, never viewed in a browser. See [page-designs.md](page-designs.md).
- **Mixer design.** Volume shown as 0 to 100, BPM as both a field and a slider, and three status words under each channel name. (The design's Play button was dropped for the shared bar in step 5.) See [page-designs.md](page-designs.md).
- **Song design.** A "Bar 6 of 12" readout, a stepper that skips empty patterns, and 16 visible bars scrolling to 256. (The design's Play button was dropped in step 6.) The ten Song designs were only statically linted, never viewed in a browser. See [page-designs.md](page-designs.md).
- **Drums design.** The editor drawn as one pad per step of the chosen note value, "Show whole pattern" as a pressed-state button, "Copy notes to…" as a button with no picker drawn (step 10 built one), envelope on a 0 to 100 scale with no units. (The design's Play and Undo were dropped in step 7.) How the pad grid looks for the other note values (including thirds) and for 2x to 8x patterns was not drawn; step 7 decided it. The ten Drums designs were only statically linted, never viewed in a browser. See [page-designs.md](page-designs.md).
- **Window size, scaffold (step 1).** The window is created with 960 by 540 as the area inside the frame (`useContentSize`), the safer reading of "not decided whether 960 by 540 is the window or the area inside it". No minimum window size is set. The menu bar is hidden until Alt is pressed.
- **Song length limit of 256 bars** was picked by the assistant.
- **Fret numbers shown on guitar and bass notes** were left to the assistant.
- **How a pattern is placed in the Song lane** was left to the assistant. See [patterns-and-song.md](patterns-and-song.md).
- **MIDI drums.** Pedal hi-hat (44) goes to the hi-hat row and the two crash cymbals to the crash row. The user said to drop everything except ride, so these are the assistant's choices. The drop is not small for two chosen songs: *The Modern Age* loses 736 low floor tom hits (a third of its drums) and *New York City Cops* loses 225 splash hits. Toms could be mapped somewhere if that hurts to hear.
- **The album picks** (one MIDI file per song of *Is This It*) were chosen by the assistant. The reasons and the close calls (Barely Legal, New York City Cops, Take It or Leave It) are in [midi-import.md](midi-import.md). The `midis/` folder is committed to git, all 75 files, at the user's request. New York City Cops needs a look at its mapping step: the two busiest guitars are both Albert's.

### Step by step

#### Step 2: The project model

See [project-model.md](project-model.md).

- Undo restores notes deleted by a meter change, since the history holds whole-project snapshots (this settles that part of the questionnaire 17 question).
- Copying notes into a pattern replaces the target's notes by default; the model also supports adding. The target keeps its own length. The third value showing only third steps and whether Keys labels every row are still open and belong to the pages.
- Notes on frets above a lowered fret count are kept, hidden, and return when the count is raised, the same as notes outside a shortened pattern. This settles the fret-count question above for the model; the page may still want to warn.
- A Song block is as long as its pattern. Lengthening a pattern is refused if one of its blocks would then overlap the next block or pass bar 256, and the page must say so. Shortening always works and leaves a gap.
- A meter switch also deletes notes that were already hidden past the end of a shortened pattern, if they lie beyond the new bar, and shortens notes that run past the new end.
- Bass has a fret count like the guitars (5, 7 or 12, default 7). Drums and Keys have none.
- Defaults: volume 80, master volume 80, attack, decay and release 0 (the recorded sound unshaped). The audio engine (step 4) gives the 0 to 100 numbers their meaning and may change these defaults.
- Isolate is not saved with the project. Undo keeps at most 1000 steps. The next set of patterns opens 20 at a time.

#### Step 3: Capture the sounds

See [sound.md](sound.md).

- Sound capture assumptions (plan24 step 3, see [sound.md](sound.md)): samples every 3 semitones, not every 2 or 4, which keeps the files at 13 MB and any note within one semitone of a recording. Format WAV 16-bit mono 44.1 kHz, not OGG, so that nothing needs a codec and the files can be edited. The two guitars share one set of files. The guitar samples go up to E5 (76), which is the top of the guitar range with 12 frets. The notes are held 2.5 to 4 seconds, so a note longer than that needs the engine to sustain or fade it: the Synth Voice of Keys is the one that does not die away by itself. The machine was quiet and the speakers active while recording; the loopback signal is expected not to depend on the speaker volume (not tested), and the takes were not listened to by a person, only measured (level, length, silence, clipping). A listen to the samples is worth doing once.

#### Step 4: Audio engine

See [sound.md](sound.md).

- Attack, decay and release run 0 to 2 s on a squared curve; decay falls to half level and holds; release is a fade after the note ends; with all at 0 the sound is unshaped. Drum hits ignore release. The model defaults (volume 80, master 80, envelope 0) are kept.
- Volume is a squared curve to gain. The metronome ignores mute, master and the meters, and is not in exports.
- Isolate does not unmute a muted instrument.
- A note longer than its sample (Keys' Synth Voice) is released when the recorded key went up, not looped. The sound of a long Keys note therefore ends after about 4 s.
- In Pattern mode a shorter pattern of another instrument repeats to fill the loop and a longer one is cut at the end of the loop.
- Song mode loops back to bar 1, not to the bar the user started from. A start at or past the song's end, or in an empty song, plays from the beginning (an empty song plays nothing).
- A meter change while playing stops playback; a tempo change does not.
- The same drum row hit again does not cut the earlier hit; they overlap.
- Sounds are read with XMLHttpRequest instead of fetch, and the page's content security policy allows `data:` for it, because the installed app loads from a file address. Not run in a window yet: if the sounds do not load in the packaged app, look here first.
- The engine was only checked by types and build. Nobody has heard it, not even after step 5 wired it to the app (see "Needs the user's check" below): the envelope feel, the click and the volume curve are guesses.

#### Step 5: App shell and the Mixer page

See [page-designs.md](page-designs.md).

- The page switch sits in the top bar at the left, as five text tabs (Mixer, Song, Drums, Guitar, Keys); the transport (Play, Stop, Metronome, Undo) is at the right. This settles "where the page switch sits".
- Play on the Mixer plays the Song if any lane has a block, otherwise the selected patterns, looping the one whose selected pattern is the longest (ties to the earlier instrument) so that none is cut short. On an instrument page it loops that instrument's selected pattern; on the Song page it plays the Song from the playhead bar.
- Pressing Play while playing starts again from the beginning. Stop leaves the playhead start where it was set. Pages can be switched while playing; playback goes on.
- A tempo change while playing applies at once; a meter change (or an Undo that brings the old meter back) stops playback.
- Every Mixer change except isolate is a project edit and so an Undo step: volume, master, BPM, meter, mute. A slider drag is one step (a new press or focus on the slider starts the next). Isolate is not saved and not undone.
- Space starts and stops playback anywhere except in a text or number field. Because Space would also press a focused button, the key is taken before the button sees it; buttons and the Mute and Isolate squares are used with Enter or the mouse.
- The three status words are shown as the design has them, whatever the transport is doing: "Playing" means the channel is open (not muted or silenced), also when stopped.
- The BPM field takes a typed number only once it is a whole number from 40 to 300, and puts an odd value right when left. The volume numbers are shown, not typed.
- Mute and Isolate are drawn as a ticked square at 960 wide and as two labelled buttons below 720 px, where each instrument becomes its own block. The level meters read the engine every animation frame; Import MIDI, Export WAV and Export MIDI were left out of this step and added to the footer row in steps 12, 13 and 17.
- If the sounds cannot be loaded (for example the packaged app and the file address; see the engine item above) a dark line under the top bar says so.
- The Mixer is reasoned to fit 960 by 540 at about 450 px of height (top bar 45, header 65, table head 30, five rows and the master row 50 each), not looked at.

#### Step 6: The Song page

See [page-designs.md](page-designs.md).

- The page's own Play button is dropped for the shared bar; the toolbar holds the title, the readout "Bar 6 of 12" (or "Bar 1 · empty" when no lane has a block), a quiet line for refusals, and the brush.
- The brush's pattern is the instrument's selected pattern (the same selection as on its own page; stepping it is not an Undo step). If the selected pattern is empty the brush holds the next pattern with notes, else the last one before it, else shows a dash and a click says the instrument has none yet.
- A click on an empty bar of a lane other than the brush's lane only moves the brush to that lane; the next click places. A refused placement shows its reason in the quiet line.
- A new block is selected at once, so Delete removes it. Clicking a block selects it; the selection is screen state, not saved.
- A block is dragged with the mouse by grabbing it anywhere; it snaps to bar lines while moving. A drop that would overlap, or pass bar 256, shows the block hollow and dashed while dragging and snaps it back on release, with the reason in the quiet line.
- Clicking a bar number moves the playhead there; while playing, playback restarts from that bar. The arrow keys on the focused timeline move it one bar. After Stop the playhead goes back to the bar it was started from.
- The view does not scroll to follow the playhead (the same rule as the pattern editor).
- A bar is 48 px wide: sixteen bars and the name column fit 960 px. The lane height shrinks from 5.5rem to 3.4rem with the window height so that five lanes, the timeline and the toolbar fit 540 px (about 450 px of height, reasoned, not looked at). The playhead line runs through the lanes, not the number row.

#### Step 7: The Drums page

See [page-designs.md](page-designs.md).

- The page's own Undo and Play are dropped for the shared bar. "Copy notes to…" and the control that opens patterns 21 to 120 were not drawn in this step; step 10 added both; the pattern bank shows every shown pattern, ten to a row.
- A click on an empty pad places a hit, a click on a hit removes it. There is no sound when a pad is placed (the engine has no audition call), and no dragging across pads to paint.
- A pad is one step of the chosen note value. A hit placed with another value is drawn as a narrow ink mark at its own time (or as a pad-wide hit when it falls on the chosen value's steps), so straight and third hits can mix in one pattern. The last step of a pattern may overhang its end, as a whole note in 3/4 does.
- A tick is at most 14 px wide (a 16th pad 42 px), shrunk so one bar always fits the compartment. A longer pattern scrolls sideways inside the compartment; "Show whole pattern" fits all of it. The view does not scroll to follow the playhead, which is drawn only while this page's own loop is playing (not while the Song or another page's loop plays). "Show whole pattern" is one setting shared by all instrument pages.
- Every pad is a button, so the grid has many tab stops (80 for one 4/4 bar of 16ths, up to about 1000 in the densest whole-pattern view). A roving focus is not built.
- The height is reasoned, not looked at: top bar 45 px, heading 40, pattern bank 75, tools column about 265, five rows of 2 to 3.4 rem plus the beat numbers, envelope strip 65. If the panel is taller than the window the page scrolls vertically.

#### Step 8: The Guitar page

See [page-designs.md](page-designs.md).

- Layout as drawn: main column (title and a quiet line, pattern bank, Length and Note value in one row, then the cards) and a 15rem side panel (Instrument, Frets with "Show whole pattern", Envelope as a column). The page's own Undo and Play are dropped for the shared bar; "Copy notes to…" and the 21 to 120 control were added in step 10. The pattern bank stays two rows of ten, as on the Drums page, not the design's single row of twenty (twenty squares do not fit 680 px).
- The main column does not scroll as a whole: the title, bank and tools rows stay at the top, and the cards (with the beat numbers sticking to their top, the fret column sticking to their left) scroll up and down and sideways inside their own box. At 960 by 540 that leaves about 290 px for cards, so one to two cards are in view; this is the vertical scroll the user accepted in questionnaire 16. Reasoned, not looked at.
- A card row is 1.3rem (21 px): a 7-fret card is 8 rows plus a header, about 200 px, six cards about 1250 px; at 12 frets about 1800 px. A tick is at most 14 px wide (a 16th step 42 px), shrunk so one bar fits.
- One click surface per row, not one button per cell (a 12-fret, 8x pattern at 16ths would be 10 000 buttons): a click on an empty place in a row places a note at the step of the chosen note value under the pointer, one step long, cut short at the pattern's end. The cells are therefore not drawn as pale pads, and placing by keyboard is not built. The notes themselves are focusable; Enter selects.
- A click on a note selects it (ink outline). Delete removing it was added in step 10. Dragging the body moves the note in time only (to change string or fret, remove it and place another); dragging the 6 px grip at its right edge changes the length. Both snap to the chosen note value, the length is at least one step (never under half of a third), and a note cannot leave the pattern. A refused edit (the same note already there) leaves the note where it was and says why in the quiet line. A drag is one Undo step, taken on release. Moving the pointer 4 px or less is a click.
- Notes above a lowered fret count, and notes beyond a shortened pattern, are kept and not drawn. The quiet line says how many sit above the fret count ("3 notes are on frets above 7"). When the count is lowered the line also warns, across all patterns of the instrument (step 10, see there); no dialog.
- Switching instrument clears the selection. The selected note is screen state in the page, not saved. Changing the fret count is an Undo step; choosing a pattern is not.
- The playhead is drawn only while this page's own loop plays (the same rule as Drums), and the view does not scroll to follow it.
- Narrow windows (under 720 px): one column, the panel under the cards in two columns, the page scrolling up and down and the cards sideways.

#### Step 9: The Keys page

See [page-designs.md](page-designs.md).

- The layout is the Guitar page's: the note editor parts both pages share were pulled out of the Guitar page into `src/pages/editor/` (`noteEditor.css` for the two-column layout, ruler, notes, playhead and side panel; `Ruler.tsx`; `usePlayhead.ts`), so the Guitar page itself did not change in look. The page-specific parts are `Keys.tsx`, `keys.css` and the pure `keyRoll.ts`.
- The roll has 49 rows, C6 at the top down to C2 (a regular piano roll, high pitches up). Black-key rows are tinted with the paper-3 ground; each C row has a heavier ink line above it.
- Row labels: every C is labelled (C6, C5, C4, C3, C2) and the other rows carry none. This settles that question of the unanswered questionnaire 17. (Screen readers get the pitch name on every row.)
- The side panel holds only "Show whole pattern" (under a "View" heading) and the Envelope; there is no instrument choice and no fret count.
- A note is an ink bar of its length with no text in it (the row says the pitch). Placing, selecting and the two drags are the Guitar page's rules: a click places one step of the chosen value, a click on a note selects it (Delete removing it was added in step 10), the body moves it in time only (to change pitch, remove it and place another), the 6 px grip at the right edge changes its length. Notes may overlap in time on different rows (chords).
- The roll opens scrolled so that middle C (C4) is in the middle of the view, once when the page is opened. It does not remember a scroll position between visits, and it does not follow the playhead.
- The roll is 49 rows of 1.3rem (about 1020 px) and scrolls up and down inside its own box, with the title, pattern bank and tools rows staying at the top, as on the Guitar page. Reasoned to fit 960 by 540 the same way; not looked at.
- The Placeholder page, now unused, was removed.

#### Step 10: Pattern tools and shortcuts

- "Copy notes to…" is a button in the tools row of Drums, Guitar and Keys that opens a small panel under it (not a dialog): a Replace / Add choice (Replace is the default, as in the model) and the shown patterns as numbered squares, the pattern copied from disabled. A pick copies at once as one Undo step, closes the panel and says what happened in the quiet line. Escape or a press outside closes it. Replacing a pattern that already has notes asks nothing, because Undo undoes it. Copying an empty pattern in Replace mode empties the target; the quiet line says so. The picker was not drawn in the designs; its look is the assistant's.
- The hidden control for patterns 21 to 120 is a dashed "+20" square after the last pattern number in the pattern bank, shown only while every shown pattern has a note and fewer than 120 are shown. It opens 20 at a time and is not an Undo step. The Song page needs nothing: its brush already steps over the shown patterns.
- Delete removes the selected note on the Guitar and Keys pages, one Undo step, and clears the selection. Only one note is selected at a time (there is no multi-select). The selection now belongs to the instrument and pattern on screen: switching pattern or instrument drops it, so Delete cannot reach a note of another pattern. A note hidden above the fret count cannot be deleted. Drums has no selection, since a click on a hit removes it. This settles the Delete question of the unanswered questionnaire 17.
- Lowering the fret count shows a line in the Guitar page's quiet line when notes in any pattern of that instrument end up above it ("3 notes are now above fret 7, in 2 patterns: hidden, not deleted…"). There is no dialog and no block: the notes are kept (the model) and Undo undoes the change. This settles the "fret count lowered" item above.
- Not run in a window: the panel's placement at 960 by 540 is reasoned. It is about 22 rem wide and at most 15 rem high (it scrolls inside beyond that, with 120 patterns shown), opens under its button and lies over the editor.

#### Step 11: Saving and files

See [editing-and-project.md](editing-and-project.md).

- A project file is the JSON of `serializeProject` with the extension `.modernstudio`; Save As adds the extension if it is missing. A save writes a temporary file beside the target and renames it over, so a failed save never destroys the old file.
- The File commands live only in the application menu (hidden until Alt is pressed) and in the shortcuts Ctrl+N, Ctrl+O, Ctrl+S and Ctrl+Shift+S, which work all the time. The top bar has no file buttons. In development the menu also has a View menu with Reload and the developer tools.
- The window title is "name - modernstudio", with a mark when there are unsaved changes (an unsaved new project is called "Untitled"). The dirty mark is in the title only. Whether a project is dirty is decided by comparing it with the last saved one, ignoring the selected pattern and the number of shown patterns (choosing a pattern is not an edit). Undoing back to the saved state makes it clean again.
- The path of the last project is kept in `settings.json` in the user data folder. At start the app reopens it; if the file is gone or does not parse, it starts a new project and says so in a quiet line (the `notice` under the top bar).
- Closing, New and Open ask "Save changes to…?" (Save, Don't save, Cancel) in a native dialog while the project is dirty. A project that cannot be opened (not valid JSON, wrong version) shows the reason in the quiet line and leaves the open project untouched. New, Open and later MIDI import start a fresh Undo history and stop playback.
- The dialogs, the file writing and the close guard were type checked and built, not run in a window (no window in a step). The user's check is to save, close, reopen and open a file in `npm run dev`.

#### Step 12: WAV export

See [sound.md](sound.md).

- 44.1 kHz, 16-bit PCM, stereo (the samples are mono and the app has no panning, so both channels carry the same signal). Not 48 kHz and not 24-bit: the sounds are recorded at 44.1 kHz and 16 bit, so more would add nothing.
- The master volume applies (it is part of the mix), nothing is normalised (the file is as loud as playback), and anything over full scale is clipped.
- The tail after the last bar is a fixed 3 seconds (the longest sample is about 3 seconds), so the file never ends in a cut release. Trailing silence is not trimmed.
- Mute and isolate are ignored, as the docs say, so a muted instrument is in the file at its volume; the metronome is not.
- "Export WAV" is a button in the footer row of the Mixer, in the two columns right of the master (Export MIDI and Import MIDI joined it in steps 13 and 17). While rendering the button is disabled and reads "Rendering…"; there is no progress bar. The result ("Exported demo.wav", or the reason) shows on the quiet line under the top bar. A cancelled dialog says nothing.
- An empty Song (no blocks) writes no file and says "The Song has no blocks, so there is nothing to export."
- The suggested name is the project's file name with `.wav` ("Untitled.wav" for a project never saved), in the Documents folder. The export is not remembered anywhere and does not change the project or the unsaved mark. The file is written through a temporary file and renamed, like a save.
- The render ran on the main window's thread (a few seconds for a long Song; the window may stall meanwhile). The render and the dialog were type checked and built, not run (no window, no listening), as planned: the user's check is to export and listen.

#### Step 13: MIDI reader, writer and export

See [midi-import.md](midi-import.md).

- No MIDI library: the reader (`src/core/midi/read.ts`, a port of the prototype's `midilib.py`) and the writer (`write.ts`) are about 250 lines in all. This settles "Building it" in midi-import.md. The reader refuses format 2 and SMPTE time with a reason, and keeps what it could read of a track cut off in the middle of an event. A note that is switched on twice before it is switched off is paired first in, first out (the prototype's rule). It was checked against the prototype on the eleven album files: format, time division, tempo and meter events, track names, note counts per track, channels and a checksum of every note's start, end, pitch and channel are equal (`src/core/midi/fixtures/reader.json`, written by `tools/midi-prototype/dump_reader.py`).
- Export: a drum hit is written as one 16th note (120 ticks of 480); a note is written as long as it plays (hidden notes, above the fret count or beyond a shortened pattern, are left out, as in playback). When two notes of one pitch on one instrument would overlap (a half-of-a-third drum hit after a 16th-long hit, or a long Keys note under a later one), the first ends where the next begins; two starting together become one, the longer. This keeps the file readable by any program that pairs note-offs with the last note-on. Notes are cut at the end of the Song.
- Controller 7 (channel volume) is written once at the start of each instrument track as round(instrument volume x master volume, on the 0 to 127 scale). It is the plain product, not the squared curve the engine plays at, because other programs will treat it as their own volume curve. Velocity is 100 on every note (the docs' assumption).
- Every track, the conductor included, ends at the end of the Song (the end of the last block, in bars), so silence at the end is kept when the file is opened elsewhere. The conductor track is named "modernstudio". Names are written as Latin-1.
- "Export MIDI" sits beside "Export WAV" in the Mixer's footer row (two buttons that wrap if the cell is narrow). The Save dialog offers `.mid` and `.midi`; the name is the project's with `.mid` ("Untitled.mid" for a project never saved), in Documents; the extension is added when the chosen name has neither. An empty Song says "The Song has no blocks, so there is nothing to export." and writes nothing. The export does not change the project or the unsaved mark. The dialog was type checked and built, not run: the user's check is to export and open the file in a music program.

#### Step 14: MIDI import, part one: time, tempo, drums, range

See [midi-import.md](midi-import.md).

- The converter's first half is in `src/core/midi/`: `guess.ts` (the mapping guess), `timing.ts` (tempo, meter, pickup), `quantize.ts` (the grid, the same-pitch rules, the 256-bar cut), `drums.ts` and `range.ts`. A refusal is a `Result` value with a message (`types.ts`), never an exception. Positions are the app's own ticks (`TICKS_PER_QUARTER` = 12), so there is no second "twelfths" type.
- The mapping list leaves out tracks with no notes (the conductor track), so the mapping step shows only tracks that matter. The list keeps each track's index in the file. A track counts as drums only if every note is on channel 10 (the prototype's test). Tracks with mixed channels are not drums.
- Tempo and meter are measured over the span from the first note to the end of the last note, as the document says. The prototype measures from tick 0; both give the same BPM on all eleven files. "Covers the most time" for the meter is counted in ticks, not seconds (they differ only if the tempo changes inside a different meter, which no album file does). An exact tie goes to the earlier tempo or meter. A tempo outside 40 to 300 is clamped and the report note says so. A file with no tempo event is 120 BPM, with no meter event 4/4.
- The pickup shift moves everything later by whole ticks, so it never changes the snapped positions of notes relative to each other. A meter other than 4/4 or 3/4 (6/8, 2/2, 5/4 as the main meter) is refused with "This song is mostly in 6/8. The app has only 4/4 and 3/4…". A section of another meter in the middle is ignored, and its note names the bar (counted after the shift) and by how many beats every later bar line is off (0 beats is said as "not affected"). All eleven album files are plain 4/4 with shift 0, so the shift is tested on made-up files only.
- The same-pitch rule that leaves a note shorter than the shortest note (two starts of one pitch only 1 twelfth apart, such as 2 and 3) is decided here: the earlier note is dropped and counted ("dropped" in the stats), because a 1-twelfth note cannot exist in the app and the two are one double strike in effect. The document did not say.
- Notes moved into range may land on another note of the same pitch and start; the same-pitch rules run again after the move, so a moved lane never holds a duplicate. The count of moved notes is of notes moved at least one octave, counted before that second pass, which is the prototype's count.
- Bars: "bars" is counted from bar 1 to the bar of the last note start over the mapped tracks (`barsUsed`). The table in midi-import.md counts to the end of the last note in the file's tracks, so three songs differ by a bar or four (Last Nite 83 vs 84, New York City Cops 103 vs 99, Trying Your Luck 116 vs 117). The count here is the one the import report will show.
- Prototype check: `tools/midi-prototype/dump.py` writes `src/core/midi/fixtures/import.json` (run it with Python 3; it ran here). The test `convert.test.ts` compares, for all eleven files: the mapping (track indexes), BPM, extra tempos, meter, shift, bars, drum hits and dropped hits by sound, snapped note counts per instrument, the largest start error (at most 1 twelfth) and the notes moved an octave at 5, 7 and 12 frets and for Keys. All agree. The fixture also holds the prototype's own note counts (before the same-pitch rule): only one of the 40 lanes differs from the rule-based count: Last Nite's lead guitar, 1347 against 1335 (the test allows up to 15). The rule changes the prototype's figures by about 1 per cent in that lane and not at all in the others.
- The fret count is not chosen here: `range.ts` takes it as an argument, and step 15 chooses it. report.py's "folded" figures count after a fret count has been chosen, so they are not the same numbers as the per-count figures in the fixture.

#### Step 15: MIDI import, part two: strings and frets

See [midi-import.md](midi-import.md).

- MIDI import part two (plan24 step 15), the fingering, `src/core/midi/fretting.ts`: a port of `fretting.py` with the same weights, the same 24 kept arrangements and the same order of arithmetic. `fingerTrack(notes, tuning, fretCount)` gives string, fret and the figures of the prototype's `metrics`; `chooseFretCount(notes, tuning)` runs 5, 7 and 12 and returns the choice, the three penalties and the fingering at the chosen count. Notes outside the range are folded inside `fingerTrack` (as in the prototype), so a note moved onto a pitch already in its chord is joined with it and the result can hold fewer notes than the input; step 16 folds first, so it will not happen there.
- Check: `tools/midi-prototype/dump_fretting.py` writes `fixtures/fretting.json` (Python ran here) from the snapped notes with the same-pitch rules applied, whole tracks. For all 33 guitar and bass parts the TypeScript gives the same fret count, the same penalties at 5, 7 and 12, the same metrics, and the same fingering note for note (a SHA-1 of every start, length, string and fret). There were no ties to record: every choice is equal. The fret counts: 12 for 21 parts, 5 for 8, 7 for 4 (guitars mostly 12; basses 5 for six of the eleven, 7 for one, and 12 for four: Is This It, Alone Together, New York City Cops, Trying Your Luck).
- Speed: all three fret counts for Barely Legal's rhythm guitar (4807 notes, the longest part) take about 0.2 s here (the prototype in Python took 1.4 s); every part is well under a second.
- Not in the prototype, added: a chord that has no distinct-string arrangement is normally tried in every combination (the prototype's `itertools.product`). Above 20 000 combinations (a chord of about a dozen notes or more, which only a non-guitar file could hold) a beam of 200 partial combinations is used instead, ranked by shared strings and then frets, so the search cannot hang. It is never used on the album files. A pitch no string can play throws, which cannot happen after folding into the range. The chord search is cached per chord, tuning and fret count (cleared at 20 000 entries).
- The use once per distinct pattern was built in step 16, and the report's wording of these figures in step 18.

#### Step 16: MIDI import, part three: patterns, lanes, project

See [midi-import.md](midi-import.md).

- The tiling is `src/core/midi/chunk.ts`, a port of `chunk.py` with the same weights (1 per block, 6 per new pattern, "known" meaning used twice in the round before, 8 rounds, ties to the longer block). `build.ts` joins everything: `convertMidi(file, mapping)` returns a `Project` and the figures of the report, or a refusal. `tools/midi-prototype/dump_chunk.py` writes `fixtures/chunk.json` (Python ran here); the test compares, on all 51 lanes of the eleven files, the number of patterns and blocks, the block list, the pattern lengths, the notes cut at a block edge and a hash of every pattern's notes. All equal. The prototype's numbers were taken after the same-pitch rules and a second pass of them after folding (the document's rules, as in the earlier fixtures).
- The order the pieces run in, per instrument: snap, cut at bar 256, choose the fret count on the whole track (strings only), fold into the range, tile, then finger each distinct pattern once. The fret count is therefore chosen on the track as the earlier steps checked it, and the fingering search sees one pattern at a time; the hand position does not carry across a pattern (the document says so). The hit or note count in the report is the lane before any cut.
- A pattern's fingering is run on its own notes with starts relative to the pattern. A note that runs past its block is cut at the block end (counted as `clippedNotes`; it is 0 on all eleven files, as the document says).
- The lane is cut at the first block that would need pattern 121, and everything from there is dropped, with a warning "needs N, 120 fit" and the count of notes left out. This cannot happen within 256 bars: a block holds up to 8 bars and a new pattern costs more than a block, so a lane of 256 bars needs about 32 patterns at most; the limit is tested on the tiling alone with a made-up lane over 1000 bars.
- `shownPatterns` after an import is the smallest multiple of 20 that holds the patterns used, so the "+20" control is not needed to see them. Pattern 1 is selected on every instrument. An instrument that is not mapped, or whose tracks hold nothing, keeps its defaults (a Bass or guitar with no notes keeps 7 frets). Volume, mute and the envelope are the model defaults.
- Several tracks sent to one instrument are merged (notes of one pitch and start become one; drum hits of one row and position become one). The mapping step may therefore send any number of tracks to any instrument; only the guess picks one for Bass, Keys and each guitar.
- A mapping that leaves nothing to import (every chosen track empty, or only dropped drum sounds) is refused with "The tracks chosen hold no notes that the app can use". A refusal for the meter comes from the timing step.
- `patternsNeededFor(file, timing, id, tracks)` is the cheap figure for the mapping step of step 17 (it runs the snapping, the fret count choice, the fold and the tiling, not the fingering). Imported patterns are not named (the app has numbers only). Note lengths are kept as snapped, so a part with sustained notes shows long notes.

#### Step 17: MIDI import screens, part one

See [midi-import.md](midi-import.md).

- "Import MIDI" is the first button in the Mixer footer row, before Export WAV and Export MIDI. It is disabled while an import is open. Outside the app window it says so on the quiet line.
- The unsaved-changes question ("Save changes to…?", the same native dialog as New and Open) comes when the button is pressed, before the file dialog, as plan24 says, not after the file is chosen as the document's list has it. Reason: nothing is lost by asking early, and the mapping step then never ends in a question. A cancelled question or a cancelled dialog changes nothing.
- The file dialog filters `.mid` and `.midi`, opens in the Documents folder and remembers nothing. A file over 16 MB is refused as too big to be a song. The main process sends the bytes to the window; the reading and conversion run in the window.
- Refusals (not a MIDI file, SMPTE, format 2, a meter other than 4/4 and 3/4, a file with no notes, nothing mapped to anything usable) go to the quiet line under the top bar as "<file name> was not imported. <reason>", and nothing changes. A file with a meter the app does not have is refused when it is read, before the mapping step, as the quiet line is where the user looks.
- The mapping step is a panel over the whole window (a dimmed scrim, not an operating-system dialog), 56 rem wide at most, with the file name, the tempo and meter that will be used, a five-cell summary (per instrument: patterns, and the fret count for strings, or "no track"), the track list and the Import and Cancel buttons. Escape cancels; Tab stays in the panel; the panel covers the top bar so no page can be changed in the middle of an import. It always shows, even when the guess is clear.
- Each track is a row: its name (or "Track N"), the channel of its first note, its program (1 based, as General MIDI lists them), its note count, then a six-way choice (Drums, Bass, Rhythm, Lead, Keys, Skip; the full names are the buttons' accessible names) and, for a mapped track, what it would come to alone: "14 patterns, 3 notes moved an octave" or "2 hits dropped", or "needs 143, 120 fit" in bold and underlined (the palette has no second colour). Any number of tracks may go to one instrument (merged, as the document allows); only the guess picks one for Bass and Keys.
- The figures per row and per instrument are worked out in the window from the same code as the conversion (snapping, the fret count choice, the octave fold and the tiling, not the fingering). They are kept while the mapping changes, so a change recomputes only the combinations it touched. The first display of the biggest files may take a moment; there is no progress bar.
- Import runs the conversion after letting the screen draw "Converting…". The result becomes a new project: a new history, playback stopped, the playhead at the start, the open project never changed. The project is unsaved: its name is the MIDI file's name without the extension (shown in the title, with the unsaved mark, and offered by the first Save, which therefore asks for a path), and it counts as having unsaved changes until it is saved, so closing or opening something else asks first. The report data is kept in the store (`importReport`) for the report of step 18; opening, creating or importing another project clears it.
- The height is reasoned, not looked at: the panel is the window less a 1 rem margin (about 508 px at 540); header, tempo line, summary and footer take about 180 px, so about 330 px, six to seven rows of 52 px, are left for the track list, which scrolls inside the panel (New York City Cops has nine tracks). Under 720 px the choice goes under the track's name.
- The dialog and the panel were type checked and built, not run, as the rule says. The user's check is to press Import MIDI in `npm run dev`.

#### Step 18: MIDI import screens, part two

See [midi-import.md](midi-import.md).

- The report shows once, right after an import, as a panel over the whole window like the mapping step (dimmed scrim, 56 rem wide at most). It is closed by the Close button or Escape; Tab keeps the focus on Close. It is not stored in the project and cannot be reopened later; it is kept in the store only until it is closed, or until another project is opened, created or imported. Reason: the document lists the report as part of the flow, and a project file should not carry import notes.
- Wording (`reportLines` in `src/core/midi/reportLines.ts`, tested): a headline "96 BPM · 4/4 · 57 bars"; below it the sentences about ignored tempos, the pickup and a meter change named by bar (these come from the timing step) and the 256-bar cut; then one row per instrument in Mixer order: the track or tracks used ("Track 4" for an unnamed one), the notes (hits for Drums), octave moves, frets, patterns and blocks. In bold and underlined (the palette has no second colour): hits left out with the General MIDI name and count of each sound ("tambourine ×79"), chords that had to share a string, notes cut short at the end of a block, and a lane cut because of the limit of 120 patterns. An instrument with no track says "no track". A song that reaches exactly bar 256 says it fills all 256 bars.
- Height, reasoned and not looked at: the header, the headline and the footer keep their size, the notes scroll beyond about 5.5 rem, and the five instrument rows are the one part that scrolls, so Close stays in view at 960 by 540. Five rows of about 3 lines each fit in the 330 px or so left, with the longest warning wrapping inside its row. Under 720 px the name goes above the figures.
- The album check (`src/core/midi/album.test.ts`) runs the eleven files through read, the guessed mapping and `convertMidi`, then checks: tempo, meter, bars, other tempos and, per lane, patterns and blocks against the prototype's fixtures; the lane rules and a JSON round trip (equal project, equal text); that `songPlan` plays exactly the quantized source's notes per instrument by position and pitch (no note lengthened); that `exportMidi` read back with `readMidi` holds the same pitches, times (480 per quarter) and channels per instrument, plus the tempo and meter; that every report reads without "undefined" or "NaN"; and the totals (51 lanes, 679 blocks, 645 of 8 bars, busiest lane 18 patterns). All passed on the first run: no difference to record. The report's "bars" is the one the earlier steps recorded (to the last note start), so three songs differ by a bar or more from the document's table.
- The panel and the report were type checked, linted and built, not run, as the rule says. The user's check is to import a file in `npm run dev` and read the report.

#### Step 19: Fit at 960 by 540

See [fit.md](fit.md).

- Every page and panel was checked by reasoning and by `src/pages/fit.test.ts` (the numbers read from the CSS and the geometry code, the heights of text estimated by hand). Nothing was looked at in a window, so the figures are good to about ten pixels. This closes the "unchecked at 960 by 540" items above, except that nothing has been seen.
- Two changes were made, both small and neither against a decided layout. Song: the lane height is `(100vh - 14rem) / 5` (63 px at 540, was 71) and the lanes box scrolls up and down if the window is too low, because with a notice, a wrapped toolbar and the sideways scrollbar the fifth lane was cut. Drums: the tools column is 11.5 rem (was 9 rem), Length is one row and Note value two columns, and the pad rows are `(100vh - 20rem) / 5` (44 px at 540); before, the panel was about 541 px against 496 and the page scrolled. A 16th pad is 39 px wide at 960 (was 42).
- A page may scroll as a whole at 540 only in these cases: the Drums page with 40 or more patterns shown (four rows of numbers), and any page when two notices show at once. The Guitar and Keys editors keep the vertical scroll inside their own box (at least 244 px tall in the worst case; the test asks for 200). No minimum window size is set, as in step 1.
- The Mixer footer buttons (Import MIDI, Export WAV, Export MIDI) stack one per line in the two narrow columns right of the master, so that row is about 92 px tall instead of 50. The page still fits (about 437 px). Not changed: the Ledger as drawn has no buttons there.

#### Step 20: Installer

See [stack.md](stack.md).

- `electron-builder.yml` builds an NSIS installer for Windows x64: one-click, per user (no administrator prompt, installs under the user's profile), no choice of folder. The app id is `studio.modern.app` and the product name `modernstudio`. The installer is `release/modernstudio-setup-0.1.0.exe` (about 123 MB); `release/` is not committed. All of this is the assistant's choice and the user may overturn it.
- No code signing, because the user has no certificate. Windows SmartScreen will therefore warn ("unknown publisher") when the installer is first run; "More info", then "Run anyway". `signAndEditExecutable` is off, which also stops electron-builder from downloading its signing tools; a side effect is that the executable's version and icon resources are not rewritten.
- No icon: the Electron default stays until the user supplies one (put `build/icon.ico`, 256 px, in the repository and remove the `signAndEditExecutable: false` line).
- What goes in: `out/` (the build, with the fonts and the 45 sounds inside it through the bundler) and `package.json`, in an `app.asar`. The libraries the screen uses (React and the fonts) are bundled into `out/`, so they are development dependencies in `package.json`; with no production dependency no `node_modules` is packed. The check `npm run check:package` (rules in `tools/package/`, tested in `rules.test.ts`) applies the `files` rules to the repository, fails if a document, MIDI file, tool, questionnaire, source, test, fixture, Python file, source map or `.claude`/`.serena` folder would be in, and, after `npm run pack`, lists the real `app.asar` the same way. It passed on the real package (98 entries).
- `npm run pack` (an unpacked folder, `release/win-unpacked/`) and `npm run dist` (the installer) both ran on 2026-11-09 and built; electron-builder downloaded its Electron zip and NSIS tools. The built app was **not started** (no window in a step). Not checked at run time, for the user to try: that the window loads from the file address (the built `index.html` uses relative `./assets/` paths and a content security policy of `'self'`, so it should), that the 45 sounds load by XMLHttpRequest from inside the `app.asar` (the earlier engine item above; if the dark "sounds could not be loaded" line shows, look here first), and that the fonts show.
- Advisories: `npm audit --omit=dev` finds 0, because nothing is a production dependency. `npm audit` finds 15 moderate ones, all through `minimatch` (in `eslint`, `typescript-eslint` and `electron-builder`'s build libraries). They are build-time tools; none is in the package. The only fix offered is a breaking one (`--force`), not taken. React, which is bundled into the app, has none.

### Step 22: final pass and handover

- The handover is [handover.md](handover.md) in `docs/` (the place and name were the builder's choice). The status paragraph of the docs README was cut to the current state, and the step-by-step story stays in [plan24.md](plan24.md).
- The version in `package.json` stays 0.1.0 and no release is tagged; both wait until the user has run the app.
- Step 22 changed no code. The seven checks (typecheck, lint, test, build, `check:sounds`, `check:package` after `npm run pack`, `check:docs`) were run in the step and passed: 34 test files, 652 tests.

## Needs the user's check

Everything below was type checked, linted, unit tested where it has pure parts, and built. None of it was run in a window, heard or looked at, because the rules of the build forbid a browser, a screenshot or listening in a step. The order to try them in is in [first-run.md](first-run.md).

**Sound (step 4, step 3)**

- Nobody has heard the engine. Guesses to judge by ear: the envelope feel (attack, decay and release on a squared 0 to 2 s curve), the volume curve (squared), the metronome click, the level meters (peak with a fast rise and a slow fall).
- The recorded samples were measured (level, length, silence, clipping) but not listened to by a person.
- The packaged app loads its 45 sounds by `XMLHttpRequest` from inside `app.asar`. If the dark "The sounds could not be loaded" line shows under the top bar, look at the engine items of step 4 and the installer items of step 20 first.

**Files (step 11)**

- New, Open, Save, Save As with the `.modernstudio` file, reopening the last project at start, and the "Save changes to…?" question on New, Open, Import and closing. The dialogs, the atomic write and the close guard were never run.

**Export (steps 12 and 13)**

- Export WAV: the offline render may stall the window for a few seconds on a long Song. Export it and listen.
- Export MIDI: export, then open the file in a music program and check the tracks, programs, channels and volumes.

**Import (steps 17 and 18)**

- The Import MIDI button, the question before the file dialog, the mapping panel (the guess, the six-way choice, the figures per row), "Converting…", the new unsaved project, and the report panel with Close and Escape. Try New York City Cops (nine tracks, and the two busiest guitars are both Albert's) and Barely Legal (the biggest).

**Fit at 960 by 540 (steps 5 to 10, 17, 18 and 19)**

- Every page and both import panels were reasoned to fit and tested against the numbers in the CSS ([fit.md](fit.md)), good to about ten pixels. Nothing has been seen. Look in particular at: the Song lanes (the fifth lane with a notice showing), the Drums tools column, the Guitar and Keys scroll boxes at 12 frets, the Copy picker over the editor, and the mapping panel's track list.

**The packaged app (step 20)**

- `npm run dist` built the installer (about 123 MB) but the built app was not started. Run it once: the window loads from a file address, the fonts show, the sounds load, saving works. Windows will warn about an unknown publisher (no code signing); there is no icon (the Electron default).

**Smaller points to feel for**

- Placing a pad or a note plays it (since the sweeping changes), at the instrument's volume, whatever mute and isolate say. Is that the right loudness?
- Placing a note by keyboard is not built on any instrument page; notes are moved by keyboard (the arrow keys) once selected.
- The Keys roll opens on middle C and none of the pages follows the playhead.
- Whether a bar-click restart while playing feels right.

**The sweeping changes (2026-11-09)**

- Everything in [sweeping-changes.md](sweeping-changes.md) was type checked, linted, unit tested where it has pure parts, and built, not run in a window: the seven tabs, the settings bar and its knobs, the editor (click, rectangle, drag in time and across rows, the grip, the keys), copy and paste, the zoom (wheel and buttons), the Song's right-click menus and selection, the hidden scrollbars, the Mixer's new row. Look at the instrument pages and the Song at 960 by 540 first.
