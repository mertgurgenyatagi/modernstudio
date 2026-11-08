# Pages

The names of the app's pages and what each one contains. Nothing here says how a page looks. Everything is taken from the other docs.

There are three kinds of page: the Mixer, the Song page, and the instrument pages. There are three instrument pages for five instruments: Drums, one Guitar page that serves Bass, Rhythm Guitar and Lead Guitar, and Keys.

## Transport bar

One bar at the top of every page (decided in questionnaire 16) holds Play, Stop, the metronome toggle and Undo. These controls are not drawn separately on each page. Where the page switch sits is not specified. See [editing-and-project.md](editing-and-project.md).

## Mixer

The master mixer screen. See [sound.md](sound.md).

- For each of the five instruments: volume, mute, isolate, and a level meter that moves while playing.
- Master volume.
- BPM (40 to 300) and meter (4/4 or 3/4). These apply to the whole project. See [time-and-notes.md](time-and-notes.md).

## Song

Song mode. See [patterns-and-song.md](patterns-and-song.md).

- One horizontal lane per instrument.
- The patterns of each instrument, to select and place in its lane. Only active patterns can be placed.
- Blocks placed in the lanes, which can be moved. A block is removed by selecting it and pressing the Delete key. There is no Remove button.
- The playhead, which can be moved by clicking the timeline.

## Instrument pages

Three pages for five instruments: **Drums**, **Guitar** (which serves **Bass**, **Rhythm Guitar** and **Lead Guitar**, chosen on the page) and **Keys**. Bass and the two guitars share one page because they differ only in their strings. Each instrument still has its own 20 patterns, notes, fret count and envelope. Each page has two parts.

### Notes (Pattern mode)

Pattern mode lives here. It builds patterns for this one instrument. See [patterns-and-song.md](patterns-and-song.md) and [time-and-notes.md](time-and-notes.md).

- The 20 numbered patterns of the instrument, to select from. Notes can be copied from one pattern into another.
- The pattern length: 1x, 2x, 4x or 8x.
- The note editor, with the layout for that instrument (see below).
- The note value selector: whole, half, quarter, 16th, third, half of a third.
- A toggle that shows the entire pattern at once.

### Envelope

See [sound.md](sound.md).

- Volume, attack, decay and release for this instrument. One setting each, never per pattern or per note.

### Note editor by instrument

See [instrument-layouts.md](instrument-layouts.md).

| Instrument | Note editor |
| --- | --- |
| Drums | Rows from bottom to top: kick, snare, hi-hat, open hi-hat, crash. Hits have no length. |
| Bass | String layout, 4 strings: E1, A1, D2, G2. |
| Rhythm Guitar | String layout, 6 strings: E2, A2, D3, G3, B3, E4. |
| Lead Guitar | Identical to Rhythm Guitar. |
| Keys | Regular piano roll, C2 to C6. |

On the Guitar page, the instrument (Bass, Rhythm Guitar or Lead Guitar) is chosen on the page, and the fret count (5, 7 or 12) is also chosen here and applies to the whole instrument.

## Not pages

- The audition tool for picking the General MIDI instruments is a separate small tool, not a page of the app. It is built and the picks are made. See [sound.md](sound.md).
- Saving, opening and WAV export were described only as actions, not as pages. See [editing-and-project.md](editing-and-project.md).

## Assumptions

- The docs say each instrument has its own page for editing notes and its envelope, and that Pattern mode builds patterns for one instrument. This doc treats these as the same page.
- Bass, Rhythm Guitar and Lead Guitar are one page by the user's decision on 2026-11-08, not by a questionnaire answer. Switching instrument on that page swaps in that instrument's own patterns, notes, fret count and envelope; this swap is assumed.
- The transport controls, the metronome toggle and Undo are in one bar at the top of every page (questionnaire 16). The docs still do not say where the switch between pages and modes is placed.
- The volume is on both the Mixer and the instrument pages in this doc. The docs list volume under the instrument's settings and under the mixer, so it is one setting shown in both places.
