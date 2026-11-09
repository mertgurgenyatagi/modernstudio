import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INSTRUMENT_IDS, PATTERNS_MAX, TUNING, type InstrumentId } from '../instruments';
import { parseProject, serializeProject } from '../serialize';
import { laneFits } from '../song';
import { blockBars } from '../project';
import { convertMidi, patternsNeededFor, prepareLane, shownFor } from './build';
import { guessMapping, type TrackGuess } from './guess';
import { readMidi, type MidiFile, type MidiNote, type MidiTrack } from './read';
import { analyseTiming } from './timing';

const PPQ = 480;
const BAR = PPQ * 4;

function note(start: number, end: number, pitch: number, channel = 0): MidiNote {
  return { start, end, pitch, channel, velocity: 100 };
}

function track(name: string, notes: MidiNote[], program?: number): MidiTrack {
  return { name, notes, programs: program === undefined ? [] : [{ tick: 0, channel: notes[0]?.channel ?? 0, program }] };
}

function fileOf(tracks: MidiTrack[], extra: Partial<MidiFile> = {}): MidiFile {
  const endTick = Math.max(0, ...tracks.flatMap((t) => t.notes.map((n) => n.end)));
  return { format: 1, ticksPerQuarter: PPQ, tracks, tempos: [], timeSignatures: [], endTick, ...extra };
}

function rowsOf(file: MidiFile, assignments: Record<number, TrackGuess['assignment']>): TrackGuess[] {
  return file.tracks.map((t, index) => ({ index, name: t.name, notes: t.notes.length, program: null, assignment: assignments[index] ?? 'skip' }));
}

/** A one-bar drum pattern: kick on 1 and 3, snare on 2 and 4. */
function beat(bar: number): MidiNote[] {
  const at = (beatNo: number): number => bar * BAR + beatNo * PPQ;
  return [note(at(0), at(0) + 60, 36, 9), note(at(1), at(1) + 60, 38, 9), note(at(2), at(2) + 60, 36, 9), note(at(3), at(3) + 60, 38, 9)];
}

/** A bass bar: E1 (28) on beat 1 and G1 (31) on beat 3, each a quarter long. */
function bassBar(bar: number): MidiNote[] {
  const at = (beatNo: number): number => bar * BAR + beatNo * PPQ;
  return [note(at(0), at(1), 28), note(at(2), at(3), 31)];
}

describe('converting a made-up file', () => {
  const eight = (make: (bar: number) => MidiNote[]): MidiNote[] => Array.from({ length: 8 }, (_, bar) => make(bar)).flat();
  const file = fileOf([track('Drums', eight(beat)), track('Bass', eight(bassBar), 33), track('Julian', [note(0, PPQ, 60), note(BAR * 4, BAR * 4 + PPQ, 100)])], {
    tempos: [{ tick: 0, microsPerQuarter: 500000 }],
  });
  const mapping = rowsOf(file, { 0: 'drums', 1: 'bass', 2: 'keys' });

  it('builds a project from the mapping', () => {
    const result = convertMidi(file, mapping);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { project, report } = result.value;
    expect(project.bpm).toBe(120);
    expect(project.meter).toBe('4/4');
    // Eight identical bars are one 8-bar pattern and one block.
    const drums = project.instruments.drums;
    expect(drums.lane).toEqual([{ pattern: 0, startBar: 0 }]);
    expect(drums.patterns[0]?.bars).toBe(8);
    expect(drums.patterns[0]?.notes).toHaveLength(32);
    expect(drums.selectedPattern).toBe(0);
    expect(drums.shownPatterns).toBe(20);
    expect(report.instruments.drums).toMatchObject({ notes: 32, patterns: 1, blocks: 1, droppedTotal: 0, fretCount: null });
    expect(report.bars).toBe(8);
  });

  it('gives bass notes a string and a fret that make the right pitch', () => {
    const result = convertMidi(file, mapping);
    if (!result.ok) throw new Error(result.reason);
    const bass = result.value.project.instruments.bass;
    expect([5, 7, 12]).toContain(bass.fretCount);
    const first = bass.patterns[0]!.notes[0] as { string: number; fret: number; start: number; length: number };
    expect(TUNING.bass[first.string]! + first.fret).toBe(28);
    expect(first).toMatchObject({ start: 0, length: 12 });
    expect(result.value.report.instruments.bass?.sharedStringChords).toBe(0);
  });

  it('folds Keys into C2 to C6 and counts the moves', () => {
    const result = convertMidi(file, mapping);
    if (!result.ok) throw new Error(result.reason);
    const keys = result.value.project.instruments.keys;
    const pitches = keys.patterns.flatMap((p) => p.notes).map((n) => (n as { pitch: number }).pitch);
    expect(Math.max(...pitches)).toBeLessThanOrEqual(84);
    expect(result.value.report.instruments.keys?.octaveMoves).toBe(1);
  });

  it('leaves an instrument with no track empty and reports it as null', () => {
    const result = convertMidi(file, mapping);
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.report.instruments.lead).toBeNull();
    expect(result.value.project.instruments.lead.lane).toEqual([]);
    expect(result.value.project.instruments.lead.fretCount).toBe(7);
  });

  it('ignores a track set to Skip', () => {
    const result = convertMidi(file, rowsOf(file, { 0: 'drums' }));
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.report.instruments.bass).toBeNull();
    expect(result.value.project.instruments.bass.lane).toEqual([]);
  });

  it('merges two tracks for one instrument and drops exact duplicates', () => {
    const twin = fileOf([track('a', [note(0, PPQ, 60), note(PPQ, PPQ * 2, 62)]), track('b', [note(0, PPQ, 60), note(PPQ * 2, PPQ * 3, 64)])]);
    const result = convertMidi(twin, rowsOf(twin, { 0: 'keys', 1: 'keys' }));
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.report.instruments.keys?.notes).toBe(3);
    expect(result.value.report.instruments.keys?.tracks.map((t) => t.index)).toEqual([0, 1]);
  });

  it('produces a project that survives saving and the model rules', () => {
    const result = convertMidi(file, mapping);
    if (!result.ok) throw new Error(result.reason);
    const parsed = parseProject(serializeProject(result.value.project));
    expect(parsed.ok && parsed.project).toEqual(result.value.project);
  });
});

describe('refusals', () => {
  it('names a meter the app does not have', () => {
    const odd = fileOf([track('a', [note(0, PPQ * 12, 60)])], { timeSignatures: [{ tick: 0, numerator: 6, denominator: 8 }] });
    const result = convertMidi(odd, rowsOf(odd, { 0: 'keys' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('6/8');
  });

  it('refuses when the chosen tracks hold nothing the app can use', () => {
    const tom = fileOf([track('Kit', [note(0, 60, 41, 9)])]);
    const result = convertMidi(tom, rowsOf(tom, { 0: 'drums' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/no notes/);
  });

  it('refuses when nothing is mapped', () => {
    const f = fileOf([track('a', [note(0, PPQ, 60)])]);
    expect(convertMidi(f, rowsOf(f, {})).ok).toBe(false);
  });
});

describe('the limits', () => {
  it('cuts at bar 256 and says so', () => {
    const f = fileOf([track('a', [note(0, PPQ, 60), note(BAR * 255, BAR * 255 + PPQ, 62), note(BAR * 256, BAR * 256 + PPQ, 64)])]);
    const result = convertMidi(f, rowsOf(f, { 0: 'keys' }));
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.report.instruments.keys?.cutNotes).toBe(1);
    expect(result.value.report.warnings.join(' ')).toContain('256');
    expect(result.value.report.bars).toBe(256);
    expect(laneFits(result.value.project.instruments.keys.lane.map((b) => ({ startBar: b.startBar, bars: blockBars(result.value.project, 'keys', b) })))).toBe(true);
  });

  it('opens patterns in steps of 20 for what an instrument needs', () => {
    expect(shownFor(0)).toBe(20);
    expect(shownFor(20)).toBe(20);
    expect(shownFor(21)).toBe(40);
    expect(shownFor(500)).toBe(PATTERNS_MAX);
  });

  it('reports how many patterns a lane needs', () => {
    // 32 different notes eight bars apart: 32 patterns (the 120 limit itself is tested on the tiling in chunk.test.ts;
    // within 256 bars a lane cannot need more than 120, since a block holds up to 8 bars).
    const notes = Array.from({ length: 32 }, (_, i) => note(i * 8 * BAR, i * 8 * BAR + PPQ, 36 + i));
    const f = fileOf([track('a', notes)]);
    const result = convertMidi(f, rowsOf(f, { 0: 'keys' }));
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.report.instruments.keys).toMatchObject({ patternsNeeded: 32, patterns: 32, cutNotes: 0 });
    expect(result.value.project.instruments.keys.shownPatterns).toBe(40);
  });
});

// ---- the eleven album files, end to end ----

interface LaneFixture {
  patterns: number;
  blocks: number;
  blockList: [number, number][];
  patternBars: number[];
  fretCount?: number;
  sharedStringChords?: number;
}

const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/chunk.json'), 'utf8')) as Record<string, Record<string, LaneFixture>>;
const midisFolder = join(__dirname, '../../../midis');

let lanes = 0;
let blocks = 0;
let eightBarBlocks = 0;
let mostPatterns = 0;

describe('the album files, end to end', () => {
  for (const [short, wanted] of Object.entries(fixture)) {
    const path = join(midisFolder, `Strokes (The) — ${short} [MIDIfind.com].mid`);
    describe.skipIf(!existsSync(path))(short, () => {
      const read = readMidi(new Uint8Array(readFileSync(path)));
      if (!read.ok) throw new Error(read.reason);
      const timing = analyseTiming(read.file);
      if (!timing.ok) throw new Error(timing.reason);
      const mapping = guessMapping(read.file);
      const result = convertMidi(read.file, mapping);
      if (!result.ok) throw new Error(result.reason);
      const { project, report } = result.value;

      it('keeps the prototype\'s patterns, blocks, fret counts and same-string chords', () => {
        for (const id of INSTRUMENT_IDS) {
          const want = wanted[id];
          const got = report.instruments[id];
          if (!want) {
            expect(got === null || got.notes === 0).toBe(true);
            continue;
          }
          expect(got, id).not.toBeNull();
          expect(got!.patterns).toBe(want.patterns);
          expect(got!.blocks).toBe(want.blocks);
          expect(project.instruments[id].lane.map((b) => [b.startBar, blockBars(project, id, b)])).toEqual(want.blockList);
          expect(project.instruments[id].lane).toHaveLength(want.blocks);
          expect(project.instruments[id].patterns.slice(0, want.patterns).map((p) => p.bars)).toEqual(want.patternBars);
          if (want.fretCount !== undefined) expect(project.instruments[id].fretCount).toBe(want.fretCount);
          if (want.sharedStringChords !== undefined) expect(got!.sharedStringChords).toBe(want.sharedStringChords);
          lanes += 1;
          blocks += want.blocks;
          eightBarBlocks += want.blockList.filter(([, length]) => length === 8).length;
          mostPatterns = Math.max(mostPatterns, want.patterns);
        }
      }, 120000);

      it('rebuilds every lane from its patterns, blocks and fingerings with no difference', () => {
        const barTicks = 12 * timing.value.meter.numerator;
        for (const id of INSTRUMENT_IDS) {
          if (!report.instruments[id]) continue;
          const tracks = mapping.filter((row) => row.assignment === id).map((row) => row.index);
          const lane = prepareLane(read.file, timing.value, id, tracks);
          const want = lane.items.map((n) => `${n.start},${id === 'drums' ? 0 : n.length},${n.key}`).sort();
          const instrument = project.instruments[id];
          const got: string[] = [];
          for (const block of instrument.lane) {
            for (const n of instrument.patterns[block.pattern]!.notes) {
              const start = block.startBar * barTicks + n.start;
              if ('row' in n) got.push(`${start},0,${n.row}`);
              else if ('string' in n) got.push(`${start},${n.length},${TUNING[id as 'bass'][n.string]! + n.fret}`);
              else got.push(`${start},${n.length},${n.pitch}`);
            }
          }
          expect(got.sort(), id).toEqual(want);
        }
      }, 120000);

      it('is a valid project: it saves, parses back equal, and every lane fits', () => {
        const parsed = parseProject(serializeProject(project));
        expect(parsed.ok && parsed.project).toEqual(project);
        for (const id of INSTRUMENT_IDS) {
          const instrument = project.instruments[id];
          expect(laneFits(instrument.lane.map((b) => ({ startBar: b.startBar, bars: blockBars(project, id as InstrumentId, b) })))).toBe(true);
        }
        expect(project.bpm).toBe(report.bpm);
      });
    });
  }

  it('matches the document: 51 lanes, 679 blocks, 645 of them 8 bars long, the busiest lane 18 patterns', () => {
    if (!existsSync(midisFolder)) return;
    expect(lanes).toBe(51);
    expect(blocks).toBe(679);
    expect(eightBarBlocks).toBe(645);
    expect(mostPatterns).toBe(18);
  });

  it('counts the patterns for the mapping step without building a project', () => {
    const path = join(midisFolder, 'Strokes (The) — Is This it (2) [MIDIfind.com].mid');
    if (!existsSync(path)) return;
    const read = readMidi(new Uint8Array(readFileSync(path)));
    if (!read.ok) throw new Error(read.reason);
    const timing = analyseTiming(read.file);
    if (!timing.ok) throw new Error(timing.reason);
    const mapping = guessMapping(read.file);
    const drums = mapping.filter((r) => r.assignment === 'drums').map((r) => r.index);
    expect(patternsNeededFor(read.file, timing.value, 'drums', drums)).toBe(fixture['Is This it (2)']!.drums!.patterns);
  });
});
