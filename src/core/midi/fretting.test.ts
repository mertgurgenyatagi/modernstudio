import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TUNING } from '../instruments';
import { chooseFretCount, chordArrangements, fingerTrack, fretCountPenalty, measureFingering, type FingeredNote } from './fretting';
import { guessMapping } from './guess';
import { quantizeNotes } from './quantize';
import { readMidi } from './read';
import { analyseTiming } from './timing';
import type { GridNote } from './types';

const GUITAR = TUNING.rhythm;
const BASS = TUNING.bass;

function n(start: number, pitch: number, length = 12): GridNote {
  return { start, length, pitch };
}

function pitchOf(tuning: readonly number[], placed: FingeredNote): number {
  return (tuning[placed.string] as number) + placed.fret;
}

describe('one note', () => {
  it('goes on its only string when there is one (G1 on the bass is the E string, fret 3)', () => {
    const { notes } = fingerTrack([n(0, 31)], BASS, 5);
    expect(notes).toEqual([{ start: 0, length: 12, string: 0, fret: 3 }]);
  });

  it('takes an open string over a fretted note', () => {
    const { notes } = fingerTrack([n(0, 50)], GUITAR, 12);
    expect(notes).toEqual([{ start: 0, length: 12, string: 2, fret: 0 }]);
  });

  it('takes the lowest fret when none is open', () => {
    // 57 is A3: string 1 fret 12, string 2 fret 7, string 3 fret 2
    const { notes } = fingerTrack([n(0, 57)], GUITAR, 12);
    expect(notes[0]).toMatchObject({ string: 3, fret: 2 });
  });

  it('gives an empty track an empty result', () => {
    const result = fingerTrack([], GUITAR, 7);
    expect(result.notes).toEqual([]);
    expect(result.metrics.notes).toBe(0);
    expect(result.metrics.openShare).toBe(0);
  });
});

describe('chords', () => {
  it('puts a chord on distinct strings, every note at its own pitch', () => {
    // E major open: E2 B2 E3 G#3 B3 E4
    const pitches = [40, 47, 52, 56, 59, 64];
    const { notes, metrics } = fingerTrack(
      pitches.map((p) => n(0, p)),
      GUITAR,
      7,
    );
    expect(notes).toHaveLength(6);
    expect(new Set(notes.map((x) => x.string)).size).toBe(6);
    expect(notes.map((x) => pitchOf(GUITAR, x))).toEqual(pitches);
    expect(metrics.sharedStringChords).toBe(0);
    expect(metrics.groups).toBe(1);
  });

  it('lists a chord low pitch first and keeps the longest length of a repeated pitch', () => {
    const { notes } = fingerTrack([n(0, 52, 6), n(0, 40, 24), n(0, 52, 12)], GUITAR, 7);
    expect(notes.map((x) => pitchOf(GUITAR, x))).toEqual([40, 52]);
    expect(notes.map((x) => x.length)).toEqual([24, 12]);
  });

  it('falls back to a shared string when the notes have no distinct strings', () => {
    // E1 and F1 on the bass are both only playable on the E string at 5 frets
    const { notes, metrics } = fingerTrack([n(0, 28), n(0, 29)], BASS, 5);
    expect(notes.map((x) => x.string)).toEqual([0, 0]);
    expect(metrics.sharedStringChords).toBe(1);
  });

  it('keeps at most 24 arrangements per chord, cheapest first', () => {
    const list = chordArrangements([52, 57], GUITAR, 12);
    expect(list.length).toBeLessThanOrEqual(24);
    for (let i = 1; i < list.length; i += 1) expect(list[i]!.cost).toBeGreaterThanOrEqual(list[i - 1]!.cost);
  });

  it('handles a chord wider than the strings without trying every combination', () => {
    const wide = Array.from({ length: 20 }, (_, i) => 40 + i);
    const { notes, metrics } = fingerTrack(
      wide.map((p) => n(0, p)),
      GUITAR,
      12,
    );
    expect(notes).toHaveLength(20);
    expect(metrics.sharedStringChords).toBe(1);
    expect(notes.map((x) => pitchOf(GUITAR, x))).toEqual(wide);
  });
});

describe('the hand', () => {
  it('does not count an open string as a position', () => {
    const placed: FingeredNote[] = [
      { start: 0, length: 6, string: 0, fret: 7 },
      { start: 6, length: 6, string: 2, fret: 0 },
      { start: 12, length: 6, string: 1, fret: 7 },
    ];
    const { handMove } = measureFingering(placed);
    expect(handMove).toBe(0);
  });

  it('keeps a run in one position when it can', () => {
    // A3 then B3 then C4 played within a beat: one position on one string row each, no big jump
    const { notes, metrics } = fingerTrack([n(0, 57, 3), n(3, 59, 3), n(6, 60, 3), n(9, 62, 3)], GUITAR, 12);
    expect(notes.map((x) => pitchOf(GUITAR, x))).toEqual([57, 59, 60, 62]);
    expect(metrics.handMove).toBeLessThanOrEqual(5);
  });

  it('avoids starting a note on a string that is still ringing, when another way is as cheap', () => {
    // two long notes of different pitch that could share a string: the second goes to another one
    const { notes } = fingerTrack([n(0, 52, 48), n(12, 57, 12)], GUITAR, 12);
    expect(notes[0]!.string).not.toBe(notes[1]!.string);
  });

  it('keeps the pitches whatever the gap between chords', () => {
    for (const gap of [12, 240]) {
      const result = fingerTrack([n(0, 41, 3), n(gap, 76, 3)], GUITAR, 12);
      expect(result.notes.map((x) => pitchOf(GUITAR, x))).toEqual([41, 76]);
    }
  });
});

describe('every result has the input pitch', () => {
  it('on a mixed run of notes and chords', () => {
    const notes: GridNote[] = [];
    let seed = 7;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed;
    };
    for (let i = 0; i < 300; i += 1) {
      const start = i * 6;
      const count = 1 + (next() % 3);
      for (let k = 0; k < count; k += 1) notes.push(n(start, 40 + (next() % 30), 6 + (next() % 4) * 6));
    }
    for (const fretCount of [5, 7, 12]) {
      const { notes: placed, folded } = fingerTrack(notes, GUITAR, fretCount);
      const high = 64 + fretCount;
      const expected = new Map<string, number>();
      for (const note of notes) {
        let p = note.pitch;
        while (p > high) p -= 12;
        expected.set(`${note.start},${p}`, 1);
      }
      expect(placed).toHaveLength(expected.size);
      for (const x of placed) {
        expect(x.fret).toBeGreaterThanOrEqual(0);
        expect(x.fret).toBeLessThanOrEqual(fretCount);
        expect(expected.has(`${x.start},${pitchOf(GUITAR, x)}`)).toBe(true);
      }
      expect(folded).toBe(fretCount === 5 ? notes.filter((x) => x.pitch > 69).length : 0);
    }
  });

  it('moves a note outside the range by octaves and counts it', () => {
    const { notes, folded } = fingerTrack([n(0, 90), n(12, 20), n(24, 50)], GUITAR, 5);
    expect(folded).toBe(2);
    expect(notes.map((x) => pitchOf(GUITAR, x))).toEqual([66, 44, 50]);
  });
});

describe('choosing the fret count', () => {
  it('takes 5 when nothing needs more', () => {
    const notes = Array.from({ length: 40 }, (_, i) => n(i * 12, 45 + (i % 5)));
    const choice = chooseFretCount(notes, GUITAR);
    expect(choice.fretCount).toBe(5);
    expect(choice.penalties).toEqual({ 5: 0, 7: 0, 12: 0 });
  });

  it('takes 12 when high notes would be moved an octave at the smaller counts', () => {
    const notes = Array.from({ length: 40 }, (_, i) => n(i * 12, 74 + (i % 2)));
    const choice = chooseFretCount(notes, GUITAR);
    // 74 and 75 are above E4 + 7 (71) but within E4 + 12 (76)
    expect(choice.fretCount).toBe(12);
    expect(choice.penalties[5]).toBeGreaterThan(0);
    expect(choice.penalties[7]).toBeGreaterThan(0);
    expect(choice.penalties[12]).toBe(0);
  });

  it('takes the middle count when 7 is enough', () => {
    const notes = Array.from({ length: 40 }, (_, i) => n(i * 12, 70 + (i % 2)));
    expect(chooseFretCount(notes, GUITAR).fretCount).toBe(7);
  });

  it('forgives a penalty within 0.2% of the notes (at least 1)', () => {
    // 2000 notes: tolerance 4; one note above range at 5 frets costs 3, so 5 is still chosen
    const notes = Array.from({ length: 2000 }, (_, i) => n(i * 12, 45 + (i % 5)));
    notes[0] = n(0, 71);
    const choice = chooseFretCount(notes, GUITAR);
    expect(choice.penalties[5]).toBe(3);
    expect(choice.fretCount).toBe(5);
    // one note alone is not forgiven: tolerance is 1 and the cost is 3
    expect(chooseFretCount([n(0, 71)], GUITAR).fretCount).toBe(7);
  });

  it('returns the fingering of the chosen count, with its penalty', () => {
    const notes = Array.from({ length: 10 }, (_, i) => n(i * 12, 60 + i));
    const choice = chooseFretCount(notes, GUITAR);
    expect(choice.result.notes).toHaveLength(10);
    expect(fretCountPenalty(choice.result)).toBe(choice.penalties[choice.fretCount]);
  });

  it('works for the bass', () => {
    const notes = Array.from({ length: 40 }, (_, i) => n(i * 12, 28 + (i % 12)));
    expect([5, 7, 12]).toContain(chooseFretCount(notes, BASS).fretCount);
  });
});

// ---- the eleven album files, whole tracks, against the prototype (fixtures/fretting.json) ----

interface PartFixture {
  notes: number;
  fretCount: number;
  penalties: Record<string, number>;
  folded: number;
  placed: number;
  groups: number;
  shared: number;
  wide: number;
  ringing: number;
  open: number;
  high: number;
  move: number;
  hash: string;
}

const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/fretting.json'), 'utf8')) as Record<string, Record<string, PartFixture>>;
const midisFolder = join(__dirname, '../../../midis');

function digest(placed: readonly FingeredNote[]): string {
  return createHash('sha1')
    .update(placed.map((x) => `${x.start},${x.length},${x.string},${x.fret}`).join(';'))
    .digest('hex');
}

describe('the album files, against the prototype', () => {
  it('has the eleven files in the fixture, 33 parts in all', () => {
    expect(Object.keys(fixture)).toHaveLength(11);
    expect(Object.values(fixture).reduce((a, e) => a + Object.keys(e).length, 0)).toBe(33);
  });

  for (const [short, parts] of Object.entries(fixture)) {
    const path = join(midisFolder, `Strokes (The) — ${short} [MIDIfind.com].mid`);
    describe.skipIf(!existsSync(path))(short, () => {
      const read = readMidi(new Uint8Array(readFileSync(path)));
      if (!read.ok) throw new Error(read.reason);
      const midi = read.file;
      const timing = analyseTiming(midi);
      if (!timing.ok) throw new Error(timing.reason);
      const rows = guessMapping(midi);

      for (const [id, want] of Object.entries(parts)) {
        it(`${id}: the same fret count, penalties, metrics and fingering`, () => {
          const row = rows.find((r) => r.assignment === id);
          expect(row, `${id} track`).toBeDefined();
          const { notes } = quantizeNotes(midi.tracks[row!.index]?.notes ?? [], midi.ticksPerQuarter, timing.value.shiftTicks);
          expect(notes).toHaveLength(want.notes);
          const tuning = TUNING[id as 'bass' | 'rhythm' | 'lead'];
          const choice = chooseFretCount(notes, tuning);
          expect(choice.fretCount).toBe(want.fretCount);
          expect(choice.penalties).toEqual(Object.fromEntries(Object.entries(want.penalties).map(([k, v]) => [k, v])));
          const m = choice.result.metrics;
          expect(choice.result.folded).toBe(want.folded);
          expect(m.notes).toBe(want.placed);
          expect(m.groups).toBe(want.groups);
          expect(m.sharedStringChords).toBe(want.shared);
          expect(m.wideChords).toBe(want.wide);
          expect(m.ringingClashes).toBe(want.ringing);
          expect(m.openShare).toBeCloseTo(want.open, 9);
          expect(m.highShare).toBeCloseTo(want.high, 9);
          expect(m.handMove).toBeCloseTo(want.move, 9);
          expect(digest(choice.result.notes)).toBe(want.hash);
        }, 60000);
      }
    });
  }

  it('finishes the longest part (Barely Legal rhythm guitar) in a few seconds', () => {
    const short = 'Barely Legal (2)';
    const path = join(midisFolder, `Strokes (The) — ${short} [MIDIfind.com].mid`);
    if (!existsSync(path)) return;
    const read = readMidi(new Uint8Array(readFileSync(path)));
    if (!read.ok) throw new Error(read.reason);
    const timing = analyseTiming(read.file);
    if (!timing.ok) throw new Error(timing.reason);
    const row = guessMapping(read.file).find((r) => r.assignment === 'rhythm');
    const { notes } = quantizeNotes(read.file.tracks[row!.index]?.notes ?? [], read.file.ticksPerQuarter, timing.value.shiftTicks);
    const began = performance.now();
    chooseFretCount(notes, GUITAR);
    expect(performance.now() - began).toBeLessThan(15000);
  }, 60000);
});
