# Key and chords

Added on 2026-11-09 at the user's request ([questionnaire_answers/key_and_chords.md](questionnaire_answers/key_and_chords.md)). Three readouts, all display only, all found again after every edit. A full song of 256 bars is about a thousand beats and takes milliseconds to analyse, so there is no refresh button. The code is `src/core/harmony/`, pure and tested without a window (`harmony.test.ts`).

## What shows where

| Readout | Where | What it looks at |
| --- | --- | --- |
| The key | Song page, settings bar, after "Bar 3 of 16": `A minor` | The whole song as it plays |
| The chords | Song page, a 20 px strip under the bar numbers that sticks with them and scrolls with the lanes | The song, beat by beat |
| The chord of a pattern | Rhythm, Lead and Bass, settings bar, after the frets: `Em7` | Every note of the pattern on screen |

- The key's tooltip names a second key when it came close (within 0.05 of the score).
- A chord in the strip is a span with a line at its start and its symbol. A span narrower than its symbol is cut short. The tooltip gives the symbol, the name in words, the bars, and the chord's notes. Bars where nothing pitched plays for a while stay blank.
- The pattern's chord follows the pattern on screen, which is the playing one while the Song plays. An empty pattern shows an empty box. A long symbol is cut at 4.2 rem, and the tooltip has it whole.

## What counts

What is heard: the pitched instruments (not the drums), not the muted ones, the sounding pitch of Keys (after Transpose), and only the notes playback plays (inside the pattern's length, on frets that exist). On the Song, every block counts each time it is placed. A note weighs as much as the time it sounds.

## Naming a chord

Every set of notes gets a name. The user said: "It's always a chord. It always has a name." One note is named by its letter (`E`). Two notes a fifth apart are a power chord (`E5`). A melody gets the chord it fits best.

There are 27 chord types: major, minor, 5, sus4, sus2, dim, aug, 7, m7, maj7, m7♭5, dim7, m(maj7), 7sus4, 6, m6, add9, m(add9), 9, maj9, m9, 6/9, 11, m11, 13 and maj13, plus the single note. Each type, on each of the 12 roots, is scored on the note weights, which are made to add up to 1:

- It gains the weight its tones cover, and loses the weight of the notes outside it.
- It loses for each missing tone: 1 for the root, 0.5 for the third (or the suspended note, or an altered fifth), 0.15 for a plain fifth, and 0.6 for a sixth, seventh or added note. A tone holding less than half of its fair share counts as partly missing.
- It gains 0.08 when the lowest note is the root. So A C E G over A is Am7, and the same notes over C are C6.
- It loses 0.03 for each tone past three, so a near-tie goes to the simpler chord. A short passing note does not turn C into Cadd9.
- On the Song, once the key is known, it gains 0.04 when all its tones are in the key.

## Where the chords change

The song is cut into beats. Each beat's weights are the time each note sounds within it, and the bass is its lowest pitch. Every chord is scored on every beat, scaled down when little sounds in it. Then a best-path search (Viterbi) picks one chord per beat. The best path has the highest total score, less a cost for each change:

- 0.1 on the first beat of a bar.
- 0.3 on beat 3 of a 4/4 bar.
- 0.5 on any other beat.

So a passing note never pays for a change, and a real change in the middle of a bar does. A beat with no notes scores nothing for any chord, so a short strum rings on to the next chord. A "silent" state scores 0.1 on an empty beat, so the strip goes blank only over a long rest, about a bar. Beats with the same chord join into one span.

## The key

The time each note name sounds over the whole song is compared, by correlation, with the profile of every major and minor key. These are the profiles Albrecht and Shanahan drew from a corpus in 2013, used the way Krumhansl's method uses its own. A key whose home chord the song dwells on gains 0.2 times that share of the chord time. Starting on it gains 0.05, and so does ending on it. This is what tells C major from A minor, which share their notes. A minor home chord is minor, m7 and the like, and a power chord or single note counts for either mode.

The order is:

1. Chords without a key.
2. The key, from the notes and those chords.
3. Chords again, leaning towards the key and spelled as it spells.

## Spelling

A key is spelled the way with fewer accidentals: D♭ major, not C♯ major. F♯ major is spelled with sharps and E♭ minor with flats. A minor key spells like its relative major. Chord roots follow the key: sharps in sharp keys, flats in flat keys, and the common mix (C♯, E♭, F♯, A♭, B♭) in C major and A minor. The pattern readout spells as the song's key spells, and uses the common mix when the song has no key yet.

## The builder's choices

- Muted instruments are left out, so the readouts follow what is heard.
- One key for the whole song. A change of key partway through is not shown.
- No slash chords (C/E). The bass helps pick the chord but is not written under it.
- The numbers above were tuned by hand on the cases in `harmony.test.ts`, not on a corpus.
