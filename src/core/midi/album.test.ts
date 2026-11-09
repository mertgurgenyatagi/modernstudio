/**
 * The whole import, end to end, on the eleven album files (plan24 step 18): from the bytes in midis/
 * through readMidi, the guessed mapping and convertMidi, then everything the finished project must do:
 * pass the model's checks, match the prototype's figures, play the notes of the source, survive a MIDI
 * export and a read back, and survive saving to JSON. Any difference is a failure here and is recorded in
 * docs/open-items.md, not hidden.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INSTRUMENT_IDS, INSTRUMENT_LABELS, type InstrumentId } from '../instruments';
import { blockBars } from '../project';
import { songPlan } from '../playback';
import { parseProject, serializeProject } from '../serialize';
import { laneFits } from '../song';
import { convertMidi, prepareLane } from './build';
import { DRUM_NOTE, EXPORT_CHANNEL, EXPORT_TICKS_PER_QUARTER, exportMidi } from './export';
import { guessMapping } from './guess';
import { readMidi } from './read';
import { reportLines } from './reportLines';
import { analyseTiming } from './timing';

interface ImportFixture {
  bpm: number;
  otherTempos: number;
  meter: [number, number];
  bars: number;
}
interface LaneFixture {
  patterns: number;
  blocks: number;
  blockList: [number, number][];
}

const here = __dirname;
const imports = JSON.parse(readFileSync(join(here, 'fixtures/import.json'), 'utf8')) as Record<string, ImportFixture>;
const chunks = JSON.parse(readFileSync(join(here, 'fixtures/chunk.json'), 'utf8')) as Record<string, Record<string, LaneFixture>>;
const midisFolder = join(here, '../../../midis');
const SCALE = EXPORT_TICKS_PER_QUARTER / 12;

let lanes = 0;
let blocks = 0;
let eightBarBlocks = 0;
let mostPatterns = 0;

describe('the album, from the bytes to the exported file', () => {
  for (const short of Object.keys(imports)) {
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
      const tracksOf = (id: InstrumentId): number[] => mapping.filter((row) => row.assignment === id).map((row) => row.index);
      const mapped = INSTRUMENT_IDS.filter((id) => report.instruments[id] !== null);

      it("has the prototype's tempo, meter, bars, patterns and blocks per lane", () => {
        const want = imports[short]!;
        expect(report.bpm).toBe(want.bpm);
        expect(project.bpm).toBe(want.bpm);
        expect(report.otherTempos).toBe(want.otherTempos);
        expect(report.meter).toBe(`${want.meter[0]}/${want.meter[1]}`);
        expect(project.meter).toBe(report.meter);
        expect(report.bars).toBe(want.bars);
        for (const id of INSTRUMENT_IDS) {
          const lane = chunks[short]![id];
          if (!lane) continue;
          const got = report.instruments[id]!;
          expect(got.patterns, id).toBe(lane.patterns);
          expect(got.blocks, id).toBe(lane.blocks);
          expect(project.instruments[id].lane.map((b) => [b.startBar, blockBars(project, id, b)]), id).toEqual(lane.blockList);
          lanes += 1;
          blocks += lane.blocks;
          eightBarBlocks += lane.blockList.filter(([, length]) => length === 8).length;
          mostPatterns = Math.max(mostPatterns, lane.patterns);
        }
      });

      it("passes the model's checks and saves to JSON and parses back equal", () => {
        for (const id of INSTRUMENT_IDS) {
          const instrument = project.instruments[id];
          expect(laneFits(instrument.lane.map((b) => ({ startBar: b.startBar, bars: blockBars(project, id, b) }))), id).toBe(true);
          expect(instrument.patterns.length).toBe(120);
        }
        const parsed = parseProject(serializeProject(project));
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.project).toEqual(project);
        expect(serializeProject(parsed.project)).toBe(serializeProject(project));
      });

      it('plays the same notes as the quantized source, per instrument, by pitch and position', () => {
        const plan = songPlan(project, 0).loop;
        for (const id of mapped) {
          const source = prepareLane(read.file, timing.value, id, tracksOf(id)).items;
          const want = source.map((n) => `${n.start},${n.key}`).sort();
          const played = plan.notes.filter((n) => n.instrument === id);
          const got = played.map((n) => `${n.tick},${n.sound.kind === 'drum' ? n.sound.row : n.sound.pitch}`).sort();
          expect(got, id).toEqual(want);
          // A note may be cut at the end of its block, never lengthened.
          const longest = new Map(source.map((n) => [`${n.start},${n.key}`, n.length]));
          for (const n of played) {
            if (n.sound.kind === 'drum') continue;
            expect(n.lengthTicks, `${id} ${n.tick}`).toBeLessThanOrEqual(longest.get(`${n.tick},${n.sound.pitch}`)!);
          }
        }
      });

      it('exports to MIDI and reads back with the same pitches and times', () => {
        const exported = exportMidi(project);
        expect(exported.ok).toBe(true);
        if (!exported.ok) return;
        const back = readMidi(exported.bytes);
        expect(back.ok).toBe(true);
        if (!back.ok) return;
        expect(back.file.ticksPerQuarter).toBe(EXPORT_TICKS_PER_QUARTER);
        expect(Math.round(60_000_000 / back.file.tempos[0]!.microsPerQuarter)).toBe(project.bpm);
        expect(back.file.timeSignatures[0]).toMatchObject({ numerator: timing.value.meter.numerator, denominator: 4 });
        const plan = songPlan(project, 0).loop;
        for (const id of INSTRUMENT_IDS) {
          const track = back.file.tracks.find((t) => t.name === INSTRUMENT_LABELS[id]);
          expect(track, id).toBeDefined();
          const got = track!.notes.map((n) => `${n.start},${n.pitch},${n.channel}`).sort();
          const want = plan.notes
            .filter((n) => n.instrument === id)
            .map((n) => `${n.tick * SCALE},${n.sound.kind === 'drum' ? DRUM_NOTE[n.sound.row] : n.sound.pitch},${EXPORT_CHANNEL[id]}`)
            .sort();
          expect(got, id).toEqual(want);
        }
      });

      it('has a report that reads cleanly', () => {
        const view = reportLines(report);
        const text = [view.headline, ...view.notes, ...view.rows.flatMap((r) => [r.source, ...r.facts, ...r.warnings])].join('\n');
        expect(text).not.toMatch(/undefined|NaN|null|\[object/);
        expect(view.rows.filter((r) => r.mapped)).toHaveLength(mapped.length);
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
});
