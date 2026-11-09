import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { convertDrums } from './drums';
import { guessMapping } from './guess';
import { barsUsed, cutHitsAtBar, cutNotesAtBar, normalizeNotes, quantizeNotes, snapTwelfths } from './quantize';
import { foldIntoRange, foldPitch, KEYS_PITCH_RANGE, stringRange } from './range';
import { readMidi, type MidiFile, type MidiNote, type MidiTrack } from './read';
import { analyseTiming } from './timing';

function note(start: number, end: number, pitch: number, channel = 0): MidiNote {
  return { start, end, pitch, channel, velocity: 100 };
}

function track(name: string, notes: MidiNote[], program?: number): MidiTrack {
  return { name, notes, programs: program === undefined ? [] : [{ tick: 0, channel: notes[0]?.channel ?? 0, program }] };
}

function fileOf(tracks: MidiTrack[], extra: Partial<MidiFile> = {}): MidiFile {
  const endTick = Math.max(0, ...tracks.flatMap((t) => t.notes.map((n) => n.end)));
  return { format: 1, ticksPerQuarter: 480, tracks, tempos: [], timeSignatures: [], endTick, ...extra };
}

/** `count` notes spread over the first bars, so that a track has a given size. */
function many(count: number, channel = 0): MidiNote[] {
  return Array.from({ length: count }, (_, i) => note(i * 480, i * 480 + 240, 60, channel));
}

describe('guessing the mapping', () => {
  it('sends channel 10 to Drums, all such tracks together', () => {
    const rows = guessMapping(fileOf([track('Kit', many(5, 9)), track('Tambourine', many(3, 9)), track('Bass', many(4), 33)]));
    expect(rows.map((r) => r.assignment)).toEqual(['drums', 'drums', 'bass']);
  });

  it('uses the name before the program, and vocals go to Keys', () => {
    const rows = guessMapping(
      fileOf([track('Electric Bass', many(4), 25), track('Julian Casablancas', many(3), 29), track('Gtr 1', many(5), 29)]),
    );
    expect(rows.map((r) => r.assignment)).toEqual(['bass', 'keys', 'rhythm']);
  });

  it('reads the program families: 33 to 40 Bass, 25 to 32 guitar, anything else Keys', () => {
    const rows = guessMapping(fileOf([track('a', many(2), 32), track('b', many(3), 24), track('c', many(1), 0)]));
    expect(rows.map((r) => r.assignment)).toEqual(['bass', 'rhythm', 'keys']);
    expect(rows.map((r) => r.program)).toEqual([32, 24, 0]);
  });

  it('gives Bass and Keys the busiest track and sets the others to Skip', () => {
    const rows = guessMapping(fileOf([track('bass 1', many(3)), track('bass 2', many(9)), track('bass 3', many(5)), track('vocal', many(2)), track('voice 2', many(4))]));
    expect(rows.map((r) => r.assignment)).toEqual(['skip', 'bass', 'skip', 'skip', 'keys']);
  });

  it('gives Keys to a vocal track before a busier track that is not vocals', () => {
    const rows = guessMapping(fileOf([track('Piano', many(9), 0), track('Lead Vocals', many(3), 29), track('Strings', many(6), 48)]));
    expect(rows.map((r) => r.assignment)).toEqual(['skip', 'keys', 'skip']);
  });

  it('knows a vocal track by a voice program or a short word when the name does not say', () => {
    // Program 54 is Synth Voice (55 in the 1 based list); "Vox" stands alone in the name.
    const byProgram = guessMapping(fileOf([track('Organ', many(9), 16), track('Track 4', many(2), 54)]));
    expect(byProgram.map((r) => r.assignment)).toEqual(['skip', 'keys']);
    const byWord = guessMapping(fileOf([track('Pad', many(9), 88), track('Lead Vox', many(2), 65)]));
    expect(byWord.map((r) => r.assignment)).toEqual(['skip', 'keys']);
    const notAWord = guessMapping(fileOf([track('Voxel synth', many(9), 80), track('Single', many(2), 81)]));
    expect(notAWord.map((r) => r.assignment)).toEqual(['keys', 'skip']);
  });

  it('puts the busiest guitar on Rhythm and the next on Lead, the rest on Skip', () => {
    const rows = guessMapping(fileOf([track('g1', many(3), 27), track('g2', many(9), 27), track('g3', many(6), 27), track('g4', many(1), 27)]));
    expect(rows.map((r) => r.assignment)).toEqual(['skip', 'rhythm', 'lead', 'skip']);
  });

  it('lets a name decide which guitar is Rhythm and which is Lead', () => {
    const rows = guessMapping(fileOf([track('Lead guitar', many(9), 27), track('Rhythm guitar', many(2), 27), track('other', many(5), 27)]));
    expect(rows.map((r) => r.assignment)).toEqual(['lead', 'rhythm', 'skip']);
  });

  it('gives a lone named lead the Rhythm place and leaves Lead for the next track', () => {
    const rows = guessMapping(fileOf([track('Lead', many(4), 27), track('g', many(6), 27)]));
    expect(rows.map((r) => r.assignment)).toEqual(['lead', 'rhythm']);
  });

  it('leaves tracks with no notes out of the list and keeps the file index', () => {
    const rows = guessMapping(fileOf([track('conductor', []), track('Bass', many(2), 33)]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ index: 1, notes: 2, assignment: 'bass' });
  });
});

describe('tempo, meter and pickup', () => {
  const quarter = (n: number): number => n * 480;

  it('uses 120 BPM and 4/4 when the file says nothing', () => {
    const result = analyseTiming(fileOf([track('a', [note(0, 480, 60)])]));
    expect(result.ok && result.value).toMatchObject({ bpm: 120, meter: { numerator: 4 }, shiftTicks: 0, barTicks: 1920, otherTempos: 0 });
  });

  it('takes the tempo that covers the most time and counts the others', () => {
    const file = fileOf([track('a', [note(0, quarter(40), 60)])], {
      tempos: [
        { tick: 0, microsPerQuarter: 480000 }, // 125, 8 beats
        { tick: quarter(8), microsPerQuarter: 387097 }, // 155, 32 beats
      ],
    });
    const result = analyseTiming(file);
    expect(result.ok && result.value.bpm).toBe(155);
    expect(result.ok && result.value.otherTempos).toBe(1);
    expect(result.ok && result.value.notes.join(' ')).toMatch(/1 other tempo/);
  });

  it('measures the tempo only between the first note and the end of the last', () => {
    const file = fileOf([track('a', [note(quarter(100), quarter(104), 60)])], {
      tempos: [
        { tick: 0, microsPerQuarter: 1000000 }, // 60 BPM, long silence
        { tick: quarter(100), microsPerQuarter: 400000 }, // 150 BPM, where the notes are
      ],
    });
    const result = analyseTiming(file);
    expect(result.ok && result.value.bpm).toBe(150);
    expect(result.ok && result.value.otherTempos).toBe(0);
  });

  it('clamps the tempo to 40 to 300 and says so', () => {
    const slow = analyseTiming(fileOf([track('a', [note(0, 480, 60)])], { tempos: [{ tick: 0, microsPerQuarter: 3000000 }] }));
    expect(slow.ok && slow.value.bpm).toBe(40);
    expect(slow.ok && slow.value.notes.join(' ')).toMatch(/40 BPM/);
    const fast = analyseTiming(fileOf([track('a', [note(0, 480, 60)])], { tempos: [{ tick: 0, microsPerQuarter: 100000 }] }));
    expect(fast.ok && fast.value.bpm).toBe(300);
  });

  it('accepts 3/4', () => {
    const result = analyseTiming(fileOf([track('a', [note(0, quarter(9), 60)])], { timeSignatures: [{ tick: 0, numerator: 3, denominator: 4 }] }));
    expect(result.ok && result.value).toMatchObject({ meter: { numerator: 3 }, barTicks: 1440 });
  });

  it('refuses any other meter and names it', () => {
    const six = analyseTiming(fileOf([track('a', [note(0, quarter(12), 60)])], { timeSignatures: [{ tick: 0, numerator: 6, denominator: 8 }] }));
    expect(six.ok).toBe(false);
    if (!six.ok) expect(six.reason).toMatch(/6\/8/);
    const cut = analyseTiming(fileOf([track('a', [note(0, quarter(8), 60)])], { timeSignatures: [{ tick: 0, numerator: 2, denominator: 2 }] }));
    expect(cut.ok).toBe(false);
    if (!cut.ok) expect(cut.reason).toMatch(/2\/2/);
  });

  it('shifts a file that starts with a short lead-in bar so the first full bar lands on a bar line', () => {
    // one bar of 2/4, then 4/4 from tick 960
    const file = fileOf([track('a', [note(0, 480, 60), note(960, quarter(40), 60)])], {
      timeSignatures: [
        { tick: 0, numerator: 2, denominator: 4 },
        { tick: 960, numerator: 4, denominator: 4 },
      ],
    });
    const result = analyseTiming(file);
    expect(result.ok && result.value.meter.numerator).toBe(4);
    expect(result.ok && result.value.shiftTicks).toBe(960);
    expect(result.ok && result.value.notes.join(' ')).toMatch(/moved 2 beats later/);
  });

  it('has no shift when the main meter starts on a bar line', () => {
    const file = fileOf([track('a', [note(0, quarter(40), 60)])], { timeSignatures: [{ tick: 1920, numerator: 4, denominator: 4 }] });
    const result = analyseTiming(file);
    expect(result.ok && result.value.shiftTicks).toBe(0);
  });

  it('ignores a single 5/4 bar in the middle and says which bar and by how much every later bar line is off', () => {
    const file = fileOf([track('a', [note(0, quarter(60), 60)])], {
      timeSignatures: [
        { tick: 0, numerator: 4, denominator: 4 },
        { tick: quarter(16), numerator: 5, denominator: 4 }, // bar 5
        { tick: quarter(21), numerator: 4, denominator: 4 },
      ],
    });
    const result = analyseTiming(file);
    expect(result.ok && result.value.meter.numerator).toBe(4);
    const text = result.ok ? result.value.notes.join(' ') : '';
    expect(text).toMatch(/5\/4 section starts in bar 5/);
    expect(text).toMatch(/1 beat off/);
  });
});

describe('snapping to the grid', () => {
  it('lands on the nearest allowed position in a beat', () => {
    expect(snapTwelfths(0).position).toBe(0);
    expect(snapTwelfths(2.2).position).toBe(2);
    expect(snapTwelfths(3.4).position).toBe(3);
    expect(snapTwelfths(5.1).position).toBe(6);
    expect(snapTwelfths(7.4).position).toBe(8);
    expect(snapTwelfths(11.6).position).toBe(12);
    expect(snapTwelfths(12 * 9 + 4.2).position).toBe(12 * 9 + 4);
  });

  it('breaks ties toward the straight 16th position', () => {
    expect(snapTwelfths(1).position).toBe(0); // between 0 and 2
    expect(snapTwelfths(2.5).position).toBe(3); // between the third 2 and the 16th 3
    expect(snapTwelfths(3.5).position).toBe(3);
    expect(snapTwelfths(5).position).toBe(6);
    expect(snapTwelfths(7).position).toBe(6);
    expect(snapTwelfths(8.5).position).toBe(9);
    expect(snapTwelfths(9.5).position).toBe(9);
    expect(snapTwelfths(11).position).toBe(12);
  });

  it('reports how far a position moved', () => {
    expect(snapTwelfths(3.25).error).toBeCloseTo(0.25);
  });

  it('measures time in twelfths from the file ticks, adding the pickup shift', () => {
    const { notes } = quantizeNotes([note(480, 720, 60)], 480, 960);
    expect(notes).toEqual([{ start: 36, length: 6, pitch: 60 }]);
  });

  it('never makes a note shorter than half of a third', () => {
    const { notes } = quantizeNotes([note(0, 1, 60), note(480, 480, 62)], 480, 0);
    expect(notes.map((n) => n.length)).toEqual([2, 2]);
  });
});

describe('overlaps and duplicates', () => {
  it('joins two notes of one pitch and start, keeping the longer', () => {
    const result = normalizeNotes([
      { start: 0, length: 3, pitch: 60 },
      { start: 0, length: 6, pitch: 60 },
      { start: 0, length: 2, pitch: 62 },
    ]);
    expect(result.notes).toEqual([
      { start: 0, length: 6, pitch: 60 },
      { start: 0, length: 2, pitch: 62 },
    ]);
    expect(result.stats.merged).toBe(1);
  });

  it('ends a note where the same pitch starts again', () => {
    const result = normalizeNotes([
      { start: 0, length: 12, pitch: 60 },
      { start: 6, length: 3, pitch: 60 },
    ]);
    expect(result.notes).toEqual([
      { start: 0, length: 6, pitch: 60 },
      { start: 6, length: 3, pitch: 60 },
    ]);
    expect(result.stats.shortened).toBe(1);
  });

  it('leaves overlaps between different pitches alone', () => {
    const notes = [
      { start: 0, length: 12, pitch: 60 },
      { start: 6, length: 12, pitch: 64 },
    ];
    expect(normalizeNotes(notes).notes).toEqual(notes);
  });

  it('drops a note that a restart would leave shorter than the shortest note', () => {
    const result = normalizeNotes([
      { start: 2, length: 4, pitch: 60 },
      { start: 3, length: 4, pitch: 60 },
    ]);
    expect(result.notes).toEqual([{ start: 3, length: 4, pitch: 60 }]);
    expect(result.stats.dropped).toBe(1);
  });

  it('keeps a note that ends exactly where the next one starts', () => {
    const notes = [
      { start: 0, length: 6, pitch: 60 },
      { start: 6, length: 6, pitch: 60 },
    ];
    const result = normalizeNotes(notes);
    expect(result.notes).toEqual(notes);
    expect(result.stats).toEqual({ merged: 0, shortened: 0, dropped: 0 });
  });
});

describe('the 256 bar limit', () => {
  const bar = 48;

  it('counts the bars up to the last start', () => {
    expect(barsUsed(null, bar)).toBe(0);
    expect(barsUsed(0, bar)).toBe(1);
    expect(barsUsed(47, bar)).toBe(1);
    expect(barsUsed(48, bar)).toBe(2);
  });

  it('drops notes at or past bar 257 and ends the one that crosses', () => {
    const limit = 256 * bar;
    const result = cutNotesAtBar(
      [
        { start: 0, length: 6, pitch: 60 },
        { start: limit - 6, length: 12, pitch: 60 },
        { start: limit, length: 6, pitch: 60 },
        { start: limit + 100, length: 6, pitch: 60 },
      ],
      bar,
    );
    expect(result.cut).toBe(2);
    expect(result.notes.map((n) => [n.start, n.length])).toEqual([
      [0, 6],
      [limit - 6, 6],
    ]);
  });

  it('cuts drum hits the same way', () => {
    const result = cutHitsAtBar(
      [
        { start: 256 * bar - 1, row: 'kick' },
        { start: 256 * bar, row: 'kick' },
      ],
      bar,
    );
    expect(result.cut).toBe(1);
    expect(result.hits).toHaveLength(1);
  });
});

describe('drums', () => {
  it('maps the General MIDI percussion to the five rows, ride to open hi-hat', () => {
    const notes = [35, 36, 38, 40, 42, 44, 46, 51, 53, 59, 49, 57].map((pitch, i) => note(i * 480, i * 480 + 10, pitch, 9));
    const rows = convertDrums(notes, 480, 0).hits.map((h) => h.row);
    expect(rows).toEqual(['kick', 'kick', 'snare', 'snare', 'hihat', 'hihat', 'openHihat', 'openHihat', 'openHihat', 'openHihat', 'crash', 'crash']);
  });

  it('drops toms, side stick, tambourine and the rest, and counts them by note number', () => {
    const notes = [41, 41, 43, 54, 54, 54, 37, 52, 60].map((pitch, i) => note(i * 480, i * 480 + 10, pitch, 9));
    const result = convertDrums(notes, 480, 0);
    expect(result.hits).toEqual([]);
    expect(result.droppedTotal).toBe(9);
    expect(result.dropped).toEqual({ 41: 2, 43: 1, 54: 3, 37: 1, 52: 1, 60: 1 });
  });

  it('joins two hits of one row on one position, from any track, and keeps different rows', () => {
    const notes = [note(0, 10, 36, 9), note(2, 12, 35, 9), note(0, 10, 38, 9), note(480, 490, 36, 9)];
    const result = convertDrums(notes, 480, 0);
    expect(result.hits).toEqual([
      { start: 0, row: 'kick' },
      { start: 0, row: 'snare' },
      { start: 12, row: 'kick' },
    ]);
    expect(result.merged).toBe(1);
  });

  it('snaps hits to the grid and applies the pickup shift', () => {
    const result = convertDrums([note(160, 170, 36, 9), note(120, 130, 38, 9)], 480, 480);
    expect(result.hits).toEqual([
      { start: 12 + 3, row: 'snare' }, // (120 + 480) / 40 = 15
      { start: 12 + 4, row: 'kick' }, // (160 + 480) / 40 = 16
    ]);
  });
});

describe('moving notes into range', () => {
  it('knows the ranges: Keys C2 to C6, strings from the lowest open string to the top string plus frets', () => {
    expect(KEYS_PITCH_RANGE).toEqual({ low: 36, high: 84 });
    expect(stringRange('bass', 5)).toEqual({ low: 28, high: 48 });
    expect(stringRange('bass', 12)).toEqual({ low: 28, high: 55 });
    expect(stringRange('rhythm', 7)).toEqual({ low: 40, high: 71 });
    expect(stringRange('lead', 12)).toEqual({ low: 40, high: 76 });
  });

  it('moves a pitch by whole octaves and counts them', () => {
    const range = stringRange('rhythm', 5); // 40 to 69
    expect(foldPitch(55, range)).toEqual({ pitch: 55, octaves: 0 });
    expect(foldPitch(40, range)).toEqual({ pitch: 40, octaves: 0 });
    expect(foldPitch(69, range)).toEqual({ pitch: 69, octaves: 0 });
    expect(foldPitch(70, range)).toEqual({ pitch: 58, octaves: 1 });
    expect(foldPitch(100, range)).toEqual({ pitch: 64, octaves: 3 });
    expect(foldPitch(30, range)).toEqual({ pitch: 42, octaves: 1 });
    expect(foldPitch(10, range)).toEqual({ pitch: 46, octaves: 3 });
  });

  it('depends on the fret count: a note out of range at 5 frets fits at 12', () => {
    const notes = [{ start: 0, length: 6, pitch: 72 }];
    expect(foldIntoRange(notes, stringRange('rhythm', 5)).moved).toBe(1);
    expect(foldIntoRange(notes, stringRange('rhythm', 12)).moved).toBe(0);
    expect(foldIntoRange(notes, stringRange('rhythm', 5)).notes[0]?.pitch).toBe(60);
  });

  it('counts the notes moved, not the octaves, and keeps the rest unchanged', () => {
    const result = foldIntoRange(
      [
        { start: 0, length: 6, pitch: 20 },
        { start: 6, length: 6, pitch: 60 },
        { start: 12, length: 6, pitch: 100 },
      ],
      KEYS_PITCH_RANGE,
    );
    expect(result.moved).toBe(2);
    expect(result.notes.map((n) => n.pitch)).toEqual([44, 60, 76]);
  });

  it('joins notes that land on one another after the move', () => {
    const result = foldIntoRange(
      [
        { start: 0, length: 6, pitch: 48 },
        { start: 0, length: 6, pitch: 60 },
      ],
      { low: 36, high: 54 },
    );
    expect(result.notes).toEqual([{ start: 0, length: 6, pitch: 48 }]);
    expect(result.stats.merged).toBe(1);
  });
});

// ---- the eleven album files, against the prototype's numbers (fixtures/import.json) ----

interface InstrumentFixture {
  protoNotes: number;
  notes: number;
  moved: Record<string, number>;
  protoMoved: Record<string, number>;
  maxError: number;
}

interface AlbumFixture {
  song: string;
  bpm: number;
  protoBpm: number;
  otherTempos: number;
  meter: [number, number];
  shift: number;
  bars: number;
  mapping: Record<string, number[]>;
  skipped: number[];
  instruments: {
    drums: { hits: number; dropped: Record<string, number>; droppedTotal: number };
  } & Record<string, InstrumentFixture>;
}

const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/import.json'), 'utf8')) as Record<string, AlbumFixture>;
const midisFolder = join(__dirname, '../../../midis');

const INSTRUMENT_OF: Record<string, 'bass' | 'rhythm' | 'lead' | 'keys' | 'drums'> = {
  Drums: 'drums',
  Bass: 'bass',
  'Rhythm Guitar': 'rhythm',
  'Lead Guitar': 'lead',
  Keys: 'keys',
};

describe('the album files, against the prototype', () => {
  it('has the eleven files in the fixture', () => {
    expect(Object.keys(fixture)).toHaveLength(11);
  });

  for (const [short, expected] of Object.entries(fixture)) {
    const path = join(midisFolder, `Strokes (The) — ${short} [MIDIfind.com].mid`);
    describe.skipIf(!existsSync(path))(`${expected.song} (${short})`, () => {
      const read = readMidi(new Uint8Array(readFileSync(path)));
      if (!read.ok) throw new Error(read.reason);
      const midi = read.file;
      const timing = analyseTiming(midi);

      it('guesses the same mapping as the prototype', () => {
        const rows = guessMapping(midi);
        for (const [name, indexes] of Object.entries(expected.mapping)) {
          const id = INSTRUMENT_OF[name] as string;
          expect(rows.filter((r) => r.assignment === id).map((r) => r.index)).toEqual(indexes);
        }
        expect(rows.filter((r) => r.assignment === 'skip').map((r) => r.index)).toEqual([...expected.skipped].sort((a, b) => a - b));
      });

      it('finds the tempo, meter, pickup shift and extra tempos', () => {
        expect(timing.ok).toBe(true);
        if (!timing.ok) return;
        expect(timing.value.bpm).toBe(expected.bpm);
        expect(timing.value.bpm).toBe(expected.protoBpm);
        expect(timing.value.otherTempos).toBe(expected.otherTempos);
        expect([timing.value.meter.numerator, timing.value.meter.denominator]).toEqual(expected.meter);
        expect(timing.value.shiftTicks).toBe(expected.shift);
      });

      it('snaps every instrument to the same note and hit counts, with the same octave moves', () => {
        if (!timing.ok) throw new Error(timing.reason);
        const { shiftTicks, barTicks } = timing.value;
        const ppq = midi.ticksPerQuarter;
        const rows = guessMapping(midi);
        const barTwelfths = (barTicks / ppq) * 12;
        let lastStart = 0;

        const drumNotes = rows.filter((r) => r.assignment === 'drums').flatMap((r) => midi.tracks[r.index]?.notes ?? []);
        const drums = convertDrums(drumNotes, ppq, shiftTicks);
        expect(drums.hits).toHaveLength(expected.instruments.drums.hits);
        expect(drums.droppedTotal).toBe(expected.instruments.drums.droppedTotal);
        expect(Object.fromEntries(Object.entries(drums.dropped).map(([k, v]) => [k, v]))).toEqual(expected.instruments.drums.dropped);
        lastStart = Math.max(lastStart, ...drums.hits.map((h) => h.start));

        for (const [key, id] of [
          ['bass', 'bass'],
          ['rhythm', 'rhythm'],
          ['lead', 'lead'],
          ['keys', 'keys'],
        ] as const) {
          const want = expected.instruments[key];
          const row = rows.find((r) => r.assignment === id);
          expect(row === undefined, `${key} track`).toBe(want === undefined);
          if (!row || !want) continue;
          const quantized = quantizeNotes(midi.tracks[row.index]?.notes ?? [], ppq, shiftTicks);
          expect(quantized.notes).toHaveLength(want.notes);
          // the same-pitch rules only change the prototype's count by a few notes at most
          expect(want.protoNotes - want.notes).toBeGreaterThanOrEqual(0);
          expect(want.protoNotes - want.notes).toBeLessThanOrEqual(15);
          expect(quantized.maxError).toBeCloseTo(want.maxError, 9);
          expect(quantized.maxError).toBeLessThanOrEqual(1);
          lastStart = Math.max(lastStart, ...quantized.notes.map((n) => n.start));
          if (id === 'keys') {
            expect(foldIntoRange(quantized.notes, KEYS_PITCH_RANGE).moved).toBe(want.moved.keys);
          } else {
            for (const frets of [5, 7, 12]) {
              expect(foldIntoRange(quantized.notes, stringRange(id, frets)).moved, `${key} at ${frets} frets`).toBe(want.moved[String(frets)]);
            }
          }
        }
        expect(barsUsed(lastStart, barTwelfths)).toBe(expected.bars);
      });
    });
  }
});
