# MIDI import and export

Added on 2026-11-09, after the 16 questionnaires, through a question-and-answer in chat. The answers are in [questionnaire_answers/midi_import.md](questionnaire_answers/midi_import.md). The algorithms below were worked out and tried on the real files with a reference prototype in [tools/midi-prototype/](../tools/midi-prototype/). The prototype is Python, is not part of the app, and exists so the TypeScript version can be checked against it. Run `python tools/midi-prototype/report.py` to see its results.

## What it is

- **Import** a MIDI file as a whole song. **Export** the song as a MIDI file.
- File based only. There is still no MIDI keyboard input ([editing-and-project.md](editing-and-project.md)).
- Both commands live on the Mixer page.
- The first and only real use is the album *Is This It* by The Strokes: [one file per song](#the-album-picks) is chosen from the `midis/` folder. The importer stays general so other songs can be imported later.

## Import: the flow

1. The user picks a `.mid` or `.midi` file on the Mixer page.
2. The app asks to save the open project if it has unsaved changes (the same prompt as on close).
3. **Mapping step.** A list of the file's tracks. Each row can be sent to Drums, Bass, Rhythm Guitar, Lead Guitar, Keys, or Skip. It is pre-filled by the guesses below. The user can change any row.
4. The file is converted (below) and opened as a **new project**. The open project is never changed.
5. A **report** says what was done: tempo and meter used, bars, and for each instrument the track used, notes, octave shifts, dropped drum hits, fret count, patterns and warnings.

An import cannot be undone, because it is a new project. Its Undo history starts empty. To go back, open the previous project.

### Mapping guesses

In this order, first match wins:

1. Every note on MIDI channel 10: **Drums**. All such tracks go to Drums together (the album files have extra Tambourine and Timbale tracks on channel 10, which hold only dropped sounds).
2. Track name contains "bass" or "basse": **Bass**.
3. Track name contains "vocal", "voice", "singer" or the singer's name (Julian, Julien, Casablancas): **Keys**. This comes before the program test because the vocal tracks in the album files carry random programs (oohs, violin, oboe, alto sax, overdriven guitar).
4. GM program 33 to 40 (Bass family): **Bass**. Program 25 to 32 (Guitar family): a guitar. Anything else: **Keys**.

Then, per instrument:

- **Bass and Keys:** the track with the most notes is used. Other tracks that matched are set to Skip.
- **Guitars:** a track named "rhythm" is Rhythm and one named "lead" is Lead. Otherwise the track with the most notes is Rhythm Guitar and the next is Lead Guitar. The rest are set to Skip. Both guitars use the same sound and layout, so only the label depends on this guess, and the user can swap them.

Merging: the user may send two tracks to the same instrument. Their notes are combined and exact duplicates (same pitch, same start) are dropped. Merging is never the default, because a doubled overdub track would just add noise. The drum tracks are the one case that is merged automatically.

Each row also shows what would happen to it: how many notes would be moved an octave, and how many patterns it needs (see below).

## Import: conversion

### Tempo and meter

- **Tempo.** The app has one BPM for the whole song. The BPM used is the tempo that covers the most time between the first and last note, rounded to a whole number and clamped to 40 to 300. Tempo changes are ignored. The report says how many other tempos were in the file. If the file has none, 120.
- **Meter.** The meter used is the time signature that covers the most time. If it is 4/4 or 3/4 it is used. Any other meter (6/8, 5/4, 2/2, and so on) stops the import with a message that says what the file has, rather than guess.
- **Pickup bars.** If the file starts with shorter bars before the main meter begins (a 2/4 or 3/8 lead-in bar, as in some *Someday* files), everything is shifted later so the first full bar of the main meter lands exactly on a bar line. The lead-in notes sit at the end of bar 1. The shift is `(bar length - (start of the main meter mod bar length)) mod bar length`.
- **Meter changes in the middle** (a single 5/4 bar, for example) cannot be kept. They are ignored, and the report names the bar and says every later bar line is off by that many beats.
- **Time division.** Files whose time division is SMPTE frames, and MIDI format 2, are refused. Format 0 and 1 are read.

### Time grid

The app places notes only on the grid of its note values. The importer measures time in twelfths of a quarter note, because 12 divides evenly into both the 16th grid (3 twelfths) and the third grid (4 twelfths) and the half-of-a-third grid (2 twelfths).

- Allowed start positions inside a beat, in twelfths: 0, 2, 3, 4, 6, 8, 9, 10. A note start moves to the nearest allowed position. On a tie the straight (16th) position wins.
- A note end moves to the nearest allowed position the same way. The shortest note is 2 twelfths (half of a third), so a note never has zero length.
- If a note starts before the previous note of the same pitch has ended, the earlier note ends there. Two notes with the same pitch and start become one, keeping the longer.
- Drum hits have no length. Two hits of the same sound on the same position become one.

On the 11 chosen files the largest timing error after snapping was 1 twelfth (a twelfth of a beat), and nearly every note landed exactly on the grid. They were written by a sequencer, so nothing had to be flattened. Human-played files would lose their feel here, which is accepted (the user chose nearest-grid).

### Ignored

Velocity, pitch bend, every controller (volume, pan, expression, sustain pedal), program changes (the sounds are fixed), aftertouch, system messages, lyrics, markers, key signatures and track names after the mapping guess.

### Drums

Channel-10 note numbers map to the five rows. Everything else is dropped, as the user decided, except that ride becomes open hi-hat.

| App row | General MIDI notes |
| --- | --- |
| Kick | 35, 36 |
| Snare | 38, 40 |
| Hi-hat | 42 closed, 44 pedal |
| Open hi-hat | 46 open, and the ride cymbals 51, 53 (ride bell), 59 |
| Crash | 49, 57 |
| Dropped | toms (41, 43, 45, 47, 48, 50), side stick 37, clap 39, china 52, tambourine 54, splash 55, cowbell 56, timbales, and everything else |

Pedal hi-hat (44) going to the hi-hat row is the assistant's choice, not the user's. In *Alone Together* it is the main hi-hat. Crash going to the crash row is also an assumption: the user said extras are dropped, and the crash row exists.

What the drop costs in the chosen files: *The Modern Age* loses its low floor tom, 736 hits, a third of its drum part. *New York City Cops* loses 225 splash hits and 41 side sticks. Every other song loses 80 hits or fewer (*Is This It* has 79 tambourine hits, *Alone Together* about 30 floor toms).

### Pitch range

Each instrument only has a range. A note outside it is moved by whole octaves, one note at a time, until it fits (the user chose this over dropping). The report counts them.

| Instrument | Range |
| --- | --- |
| Keys | C2 to C6 |
| Bass | E1 up to G2 plus the fret count (E1 string, then A1, D2, G2) |
| Rhythm and Lead Guitar | E2 up to E4 plus the fret count |

### Strings and frets (guitars and bass)

MIDI only stores a pitch. The app needs a string and a fret. The same pitch can be played on several strings, so one has to be chosen for every note. This was worked out as a search for the most playable fingering.

**What "playable" means here**

- Notes that start together are a chord. Each note of a chord goes on its own string if at all possible, because a real guitar cannot sound two notes on one string. The app allows two on one string, so this is a strong preference, not a rule.
- The fretted notes of a chord should sit within about 4 frets of each other.
- The hand should not jump. Between one chord and the next, the average fret position should change as little as possible, and more leniently when there is a long gap between them.
- A new note should not land on a string that is still ringing from an earlier note.
- Low frets are mildly preferred, and open strings count as no position at all (the hand does not have to move for them).

**Algorithm**

1. Group notes by identical start. Each group is a chord (one note is a group of one).
2. For each group, list every way to give each note a string and fret with `open string pitch + fret = note` and `0 <= fret <= fret count`, using each string at most once. If none exists, allow a shared string. Score each with the group cost below and keep the cheapest 24.
3. Run Viterbi over the groups from first to last. The cost of going from one arrangement to the next is the transition cost below. Pick the cheapest path.

Group cost, added up:

| Part | Cost |
| --- | --- |
| Fretted span of the chord above 3 frets | 2 per extra fret |
| Fretted span above 4 frets | another 8 per extra fret |
| Average fret of the fretted notes | 0.15 per fret |
| Strings skipped inside a chord of 3 or more notes | 0.4 per string |
| Two notes of the chord on the same string | 40 each |

Transition cost, from the previous group to this one, times `f`:

| Part | Cost |
| --- | --- |
| Change in average fret position (fretted notes only; open strings keep the previous position) | 1 per fret |
| Change in average string | 0.35 per string |
| A note lands on a string still ringing | 12 each |

`f` is 1 when the two groups start within one beat of each other (12 twelfths), then falls as `1 / (1 + (gap - 12) / 24)` to a floor of 0.25.

The ringing check looks at the best path found so far to each candidate (per-survivor, not a full search of the history), which is exact enough and keeps the search small.

**Fret count.** The fret count (5, 7 or 12) is picked per instrument, so that a part is not forced into an unplayable fingering just to keep the editor short. The algorithm is run at 5, 7 and 12 frets over the whole track. Each run gets a penalty: 3 per note that has to be moved an octave, plus 2 per chord with two notes on one string, plus 1 per ringing clash. The smallest fret count whose penalty is within `max(1, 0.2% of the notes)` of the best is used.

On the 11 chosen songs most guitar parts end up on **12 frets**, because the lead lines and wide chord voicings reach past the 7th fret, and bass parts mostly fit in 5. The Guitar page's 960 by 540 height problem ([open-items.md](open-items.md)) is therefore worse for imported songs: 13 rows per string.

**Fingering is done once per pattern**, after the song has been cut into patterns (next section), not once over the whole track. Identical bars must come out with identical string and fret choices, or they would stop being the same pattern. The cost is that the hand position does not carry across a pattern boundary, which is a small loss.

Results on the 11 songs, 33 guitar and bass parts: 29 parts have no chord with two notes on one string, and none has more than 8. The naive alternative (each note on its own lowest fret) gives 21 of the 33 parts at least one such chord, up to 764 in one part, 5768 in all. The hand moves 0.31 frets on average between neighbouring chords (0.49 for the naive way), at most 1.6 in any part, and under 0.5 in 27 of the 33.

Chords of five or six notes written as wide voicings (a G or C chord spread over all six strings, an octave up) cannot be played in the low positions on distinct strings, so they come out as barre shapes around frets 8 to 12. For those pitches it is the only way to give each note its own string, so it is not a mistake. Of 471 such chords in *Barely Legal*'s rhythm guitar only 1 could have been placed within 7 frets on distinct strings.

Because the file only has pitches, this cannot recover what the original guitarist actually played. It produces a playable version. Notes are always pitch-exact.

### Patterns and the Song lanes

The imported song must become patterns (1, 2, 4 or 8 bars long, numbered, reusable) and blocks in the Song lanes. The aim is to use the fewest patterns, and then the fewest blocks. Songs repeat bars, so most of the work is spotting repeats.

**Algorithm**, per instrument:

1. Count bars from bar 1 to the last bar with a note start. At most 256 bars are imported. The rest is cut and the report says so.
2. A *candidate* is a stretch of 1, 2, 4 or 8 bars starting at any bar. Its *signature* is the list of its notes (start inside the stretch, length, pitch or drum row). Notes that run past the end of the stretch are cut there, and the signature includes the cut length. Empty stretches are not candidates: they become gaps in the lane.
3. Choose a tiling of the whole song with a dynamic program: every bar is either an empty bar (a gap, free) or covered by exactly one candidate. A candidate costs 1 for the block, plus 6 if its signature is not already a pattern, where "already a pattern" means it was used at least twice in the previous round. The first round has no patterns yet. Run up to 8 rounds, until the tiling stops changing. Ties go to the longer block.
4. Each distinct signature becomes one pattern, numbered in the order it is first used. Its length is the length of the stretch. Each chosen candidate becomes one block in the lane.
5. Strings and frets (above) are assigned to each distinct pattern once.
6. Pattern 1 is selected on every instrument.

Only exact repeats are merged. A human-played file will have few exact repeats and will need many patterns.

**Limits.** The surface shows 20 patterns per instrument. Past that, a hidden control opens more, up to 120 ([patterns-and-song.md](patterns-and-song.md)). An import that needs more than 20 on an instrument opens the extra ones automatically. If an instrument needs more than 120, the mapping step says so before the import ("needs 143, 120 fit"), and the lane is cut after the last bar that fits.

**Results on the 11 songs** (reference prototype, 51 lanes: 11 drums, 33 guitar and bass, 7 Keys): the busiest lane needs 18 patterns, so none reaches the hidden ones. Each lane has 5 to 21 blocks, and 645 of the 679 blocks are 8 bars long (15 are 2 bars, 11 are 4, 8 are 1). No note was cut at a block edge. Rebuilding every lane from its patterns, blocks and fingerings gives back exactly the quantized notes (0 differences in all 51 lanes).

## The album picks

One file per song, chosen from 75 files in `midis/`. The rule, in order: the track list is complete (drums, bass, two guitars), the length is closest to the album's, one tempo and clean 4/4 throughout, vocals are a bonus (they become Keys), and the file agrees with most of the other versions of the song. The real lengths are those of the album's listing ([MusicBrainz](https://musicbrainz.org/release/38b94527-4f9d-49d4-85d3-d449545ceea4/disc/1), Amoeba and others: Barely Legal 3:58, New York City Cops 3:36, Trying Your Luck 3:27; the other lengths were taken from memory and not checked).

| Song | File in `midis/` (drop the "Strokes (The) — " start and the " [MIDIfind.com].mid" end) | BPM | Bars | Has vocals (Keys) |
| --- | --- | --- | --- | --- |
| Is This It | Is This it (2) | 96 | 57 | yes |
| The Modern Age | The Modern Age (5) | 146 | 126 | yes |
| Soma | Soma (8) | 150 | 95 | no |
| Barely Legal | Barely Legal (2) | 160 | 162 | no |
| Someday | Someday (6) | 106 | 82 | yes |
| Alone Together | Alone Together (6) | 145 | 112 | yes |
| Last Nite | Last Night (8) | 103 | 83 | yes |
| Hard to Explain | Hard to Explain (5) | 165 | 154 | yes |
| New York City Cops | New York City Cops (4) | 114 | 103 | no |
| Trying Your Luck | Trying Your Luck (2) | 140 | 116 | yes (first 55 bars) |
| Take It or Leave It | Take it Or Leave it (2) | 155 | 122 | no |

Notes on the harder choices:

- **Barely Legal:** version (2) has 162 bars and 4:03. The other five versions have about 146 bars and 3:40, so they are missing roughly 16 bars (the real song is 3:58). The ones with vocals, (6), are among the short ones. Completeness won over vocals.
- **New York City Cops:** version (4) is the only one near the real length (3:36). It has nine tracks (extra guitar overdubs) and no vocals. The importer takes the two busiest guitars, which are both Albert's tracks, and skips four others. The user should look at the mapping step for this file and probably swap the second guitar for one of Nick's tracks.
- **Take It or Leave It:** the versions with vocals, (3) and (5), have a 5/4 bar early in the song and a tempo ramp, which the app cannot hold. Version (2) is clean 4/4, with a slow first 4 bars (125 BPM) before the main 155.
- **Soma:** no version has the full vocals (one has 57 seconds of them). Keys stays empty.
- **Last Nite:** the folder spells it both "Last Night" and "Last Nite". They are the same song. The album's spelling is Last Nite.
- **Trying Your Luck:** all versions are about 3:19, while the album says 3:27, so something is missing or the tempo is slightly fast in all of them. Nothing better exists in the folder.
- The `midis/` folder (all 75 files, not only the picks) is committed to git, at the user's request on 2026-11-09. The files are other people's songs, downloaded from MIDIfind.

## Export

The Song arrangement is flattened and written as a standard MIDI file. This is the reverse of import and is what lets a song be opened in a normal music program.

- **Format 1, 480 ticks per quarter note.** One conductor track with the BPM and the meter, then five tracks: Drums, Bass, Rhythm Guitar, Lead Guitar, Keys. Each is named.
- **Channels and sounds** use the program change values in [sound.md](sound.md): Bass 33 on channel 1, Rhythm Guitar 26 on channel 2, Lead Guitar 26 on channel 3, Keys 54 on channel 4, Drums on channel 10.
- **Drum rows** are written as General MIDI notes: kick 36, snare 38, hi-hat 42, open hi-hat 46, crash 49. Each hit is a short note.
- **Notes** are written at the position and length they play in the song. Strings and frets are not written, because MIDI has no place for them. Opening the exported file again gives the same pitches and timing, with the strings and frets chosen afresh.
- **Not exported:** mute and isolate (like the WAV export, which ignores them), attack, decay and release, the metronome, patterns as such. The song is what plays from bar 1 to the end of the last block.
- Channel volume is written as controller 7 from each instrument's volume and the master volume, and every note has velocity 100. This is an assumption: the docs do not say.
- If the Song lanes are empty, there is nothing to export and the app says so.

## Building it

Both directions are small. The prototype's file reader is about 100 lines and a writer is about the same, so no library is needed. Decided in plan24 step 13: own code, in `src/core/midi/` (`read.ts`, `write.ts`, `export.ts`). The prototype in [tools/midi-prototype/](../tools/midi-prototype/) is the reference for the numbers above: the cost table, the 24 kept arrangements, the tolerance on the fret count, and the weights 1 and 6 in the tiling.

Built so far (plan24 step 14): the mapping guess, tempo, meter and pickup, grid snapping with the same-pitch rules, the drum map and the octave folding, in `src/core/midi/` (`guess.ts`, `timing.ts`, `quantize.ts`, `drums.ts`, `range.ts`). `tools/midi-prototype/dump.py` writes the figures the tests compare with. The assumptions where this document was silent are in [open-items.md](open-items.md).

Built in plan24 step 15: the fingering and the fret count choice, in `src/core/midi/fretting.ts`, a port of `fretting.py`. On all 33 guitar and bass parts of the eleven files it gives the prototype's fret count, penalties and fingering exactly (`tools/midi-prototype/dump_fretting.py` writes the figures it is tested against). Using it once per distinct pattern comes with the tiling in step 16.

Built in plan24 step 16: the tiling (`chunk.ts`, a port of `chunk.py`) and the join of all the pieces into `convertMidi` (`build.ts`), which returns a finished project and the figures for the report. Fingering runs once per distinct pattern. On the eleven files it gives the prototype's patterns, blocks and pattern lengths for all 51 lanes (`tools/midi-prototype/dump_chunk.py` writes the figures it is tested against), its lanes rebuild to the folded notes with no difference, and the totals above hold (679 blocks, 645 of 8 bars, at most 18 patterns on a lane). The screens (the Import MIDI button, the mapping step and the report) are steps 17 and 18.
