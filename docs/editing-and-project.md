# Editing and project

## Editing

- Note placement and length are described in [time-and-notes.md](time-and-notes.md).
- Undo is required. There is no redo.
- A Song block is removed by selecting it and pressing Delete, with no button (questionnaire 16).
- Other editing actions (select, move, copy, delete and so on) are left to whatever feels natural.
- No MIDI keyboard input. MIDI files are a separate matter: they can be imported and exported ([midi-import.md](midi-import.md)).
- Editors are not zoomable.

## Playback

- Space starts and stops playback.
- Pattern mode loops the pattern.
- Song mode starts from the beginning by default, or from the point the user clicked on the timeline, and loops at the end.
- A metronome can be turned on while playing. No count-in.
- Play, Stop, the metronome toggle and Undo sit in one bar at the top of every page (questionnaire 16).

## Saving and files

- A project is saved to a file the user chooses.
- The app asks to save when it is closed with unsaved changes.
- The app reopens the last project when it starts.
- WAV export renders the whole song with every instrument. It ignores mute and isolate. Single instruments cannot be exported on their own.
- MIDI export writes the Song arrangement as a standard MIDI file, with one track per instrument. It also ignores mute and isolate.
- MIDI import takes a whole file and opens it as a new project, after asking to save the open one. It cannot be undone, because it is a new project. Both commands are on the Mixer page. See [midi-import.md](midi-import.md).

## The app

- Called modernstudio.
- Delivered with an installer.
- The window opens at 960 by 540 by default (decided by the user on 2026-11-08). Every page must work at that size. See [design.md](design.md).
- The window can be resized and maximized.
- Everything described in these docs is wanted working from the first build.

## New project

120 BPM, 4/4, empty.
