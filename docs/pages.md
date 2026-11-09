# Pages

The names of the app's pages and what each one contains. Nothing here says how a page looks. Everything is taken from the other docs.

There are three kinds of page: the Mixer, the Song page, and the instrument pages, one for each of the five instruments. Rhythm, Lead and Bass are the same page drawn for each ([sweeping-changes.md](sweeping-changes.md)).

## Transport bar

One bar at the top of every page (decided in questionnaire 16) holds Play, Stop, the metronome toggle and Undo. These controls are not drawn separately on each page. The page switch sits at the left of the same bar, as seven text tabs in this order: Rhythm, Lead, Bass, Drums, Keys, Song, Mixer (the user's sweeping changes, 2026-11-09). See [editing-and-project.md](editing-and-project.md).

## Mixer

The master mixer screen. See [sound.md](sound.md).

- For each of the five instruments: volume, mute, isolate, and a level meter that moves while playing.
- Master volume.
- BPM (40 to 300) and meter (4/4 or 3/4). These apply to the whole project. See [time-and-notes.md](time-and-notes.md).
- **Import MIDI** and **Export MIDI** (decided 2026-11-09). Import opens a mapping step (see below) and then a new project. See [midi-import.md](midi-import.md).

## Song

Song mode. See [patterns-and-song.md](patterns-and-song.md).

- One horizontal lane per instrument.
- A right click on an empty bar of a lane offers that instrument's patterns, to place one there. Only active patterns can be placed.
- Blocks placed in the lanes, which can be selected (several at once), moved, copied and pasted. A block is removed by selecting it and pressing the Delete key. There is no Remove button.
- The playhead, which can be moved by clicking the timeline.

## Instrument pages

Five pages, one tab each: **Rhythm**, **Lead**, **Bass**, **Drums** and **Keys**. Rhythm, Lead and Bass are the same page, because they differ only in their strings. Each instrument has its own patterns, notes, fret count and envelope. Each page is one bar of small settings above the note editor ([sweeping-changes.md](sweeping-changes.md)).

### Notes (Pattern mode)

Pattern mode lives here. It builds patterns for this one instrument. See [patterns-and-song.md](patterns-and-song.md) and [time-and-notes.md](time-and-notes.md).

- The pattern, stepped with arrows or picked from a grid of the shown patterns, and the hidden control that opens more, up to 120 ([patterns-and-song.md](patterns-and-song.md)). Notes are copied from one pattern into another with copy and paste.
- The pattern length: 1x, 2x, 4x or 8x.
- The note editor, with the layout for that instrument (see below).
- The note value selector: whole, half, quarter, 16th, third, half of a third (shown as 1/1, 1/2, 1/4, 1/16, 1/8T, 1/16T).
- The zoom: out, in, and Fit, a toggle that shows the entire pattern at once.

### Envelope

See [sound.md](sound.md).

- Volume, attack, decay and release for this instrument, as four knobs. One setting each, never per pattern or per note.

### Note editor by instrument

See [instrument-layouts.md](instrument-layouts.md).

| Instrument | Note editor |
| --- | --- |
| Drums | Rows from bottom to top: kick, snare, hi-hat, open hi-hat, crash. Hits have no length. |
| Bass | String layout, 4 strings: E1, A1, D2, G2. |
| Rhythm Guitar | String layout, 6 strings: E2, A2, D3, G3, B3, E4. |
| Lead Guitar | Identical to Rhythm Guitar. |
| Keys | Regular piano roll, C2 to C6. |

On Rhythm, Lead and Bass the fret count (5, 7 or 12) is chosen in the settings bar and applies to the whole instrument.

## Not pages

- The audition tool for picking the General MIDI instruments is a separate small tool, not a page of the app. It is built and the picks are made. See [sound.md](sound.md).
- Saving, opening and WAV export were described only as actions, not as pages. See [editing-and-project.md](editing-and-project.md).
- The MIDI import mapping step and the report that follows an import. The mapping step is a list of the file's tracks, each with a choice of Drums, Bass, Rhythm Guitar, Lead Guitar, Keys or Skip, started from the app's guess. Neither is drawn, and whether each is a dialog or a screen is not decided. See [midi-import.md](midi-import.md).

## Assumptions

- The docs say each instrument has its own page for editing notes and its envelope, and that Pattern mode builds patterns for one instrument. This doc treats these as the same page.
- Bass, Rhythm Guitar and Lead Guitar were one page with an instrument choice by the user's decision on 2026-11-08. Since the sweeping changes of 2026-11-09 each has its own tab, drawing the same page.
- The transport controls, the metronome toggle and Undo are in one bar at the top of every page (questionnaire 16). The page switch is in the same bar, at the left (assumed in plan24 step 5; seven tabs since the sweeping changes). Pattern and Song mode are not a switch: Pattern mode is part of each instrument page, Song mode is the Song page.
- The volume is on both the Mixer and the instrument pages in this doc. The docs list volume under the instrument's settings and under the mixer, so it is one setting shown in both places.
