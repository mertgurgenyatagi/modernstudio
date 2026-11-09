import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareLane } from './build';
import { limitPatterns, patternsNeeded, tileLane, type LaneItem } from './chunk';
import { guessMapping } from './guess';
import { readMidi } from './read';
import { analyseTiming } from './timing';

const BAR = 48; // 4/4 in twelfths

/** A note at a bar and an offset inside it. */
function hit(bar: number, offset: number, key: number | string = 'kick', length = 0): LaneItem {
  return { start: bar * BAR + offset, length, key };
}

describe('tiling a lane', () => {
  it('has no blocks for an empty lane', () => {
    const t = tileLane([], BAR);
    expect(t).toMatchObject({ bars: 0, blocks: [], patterns: [], clipped: 0 });
  });

  it('turns one repeated bar into one pattern and covers eight bars with one block', () => {
    const items = Array.from({ length: 8 }, (_, bar) => hit(bar, 0));
    const t = tileLane(items, BAR);
    expect(t.patterns).toHaveLength(1);
    expect(t.patterns[0]).toMatchObject({ bars: 8 });
    expect(t.blocks).toEqual([{ startBar: 0, bars: 8, pattern: 0 }]);
  });

  it('prefers the longer block on an exact tie', () => {
    // Four identical bars cost the same as one 4-bar pattern or a 1-bar pattern four times over; longer wins.
    const t = tileLane(Array.from({ length: 4 }, (_, bar) => hit(bar, 0)), BAR);
    expect(t.blocks).toEqual([{ startBar: 0, bars: 4, pattern: 0 }]);
  });

  it('leaves empty bars as a gap in the lane', () => {
    // Nine empty bars between two single hits: no block can hold both, so the lane has two blocks and a gap.
    const t = tileLane([hit(0, 0), hit(10, 0)], BAR);
    expect(t.bars).toBe(11);
    expect(t.blocks).toHaveLength(2);
    const [first, second] = t.blocks;
    expect(first!.startBar).toBeLessThanOrEqual(0);
    expect(first!.startBar + first!.bars).toBeLessThan(second!.startBar);
    expect(second!.startBar).toBeGreaterThan(first!.startBar + first!.bars);
    expect(second!.startBar + second!.bars).toBeGreaterThan(10);
  });

  it('numbers patterns in the order they are first used', () => {
    // Eight bars apart, so that each hit is a block of its own; the two snare blocks are the same pattern.
    const t = tileLane([hit(7, 0, 'snare'), hit(15, 0, 'kick'), hit(23, 0, 'snare')], BAR);
    expect(t.blocks.map((b) => b.pattern)).toEqual([0, 1, 0]);
    expect(t.patterns.map((p) => p.items[0]?.key)).toEqual(['snare', 'kick']);
  });

  it('cuts a note that runs past the end of its block and counts it', () => {
    // A long note at the end of bar 0, then a gap bar: the note is cut at the bar line.
    const t = tileLane([hit(0, 40, 60, 20), hit(2, 0, 62, 4)], BAR);
    expect(t.patterns[0]?.items).toEqual([{ start: 40, length: 8, key: 60 }]);
    expect(t.clipped).toBe(1);
  });

  it('keeps a note that runs across bars inside a longer block whole', () => {
    // Bar 0 and bar 1 differ, so one 2-bar pattern is cheaper than two 1-bar ones (cost 7 against 14).
    const t = tileLane([hit(0, 40, 60, 20), hit(1, 0, 62, 4)], BAR);
    expect(t.blocks).toEqual([{ startBar: 0, bars: 2, pattern: 0 }]);
    expect(t.patterns[0]?.items[0]).toEqual({ start: 40, length: 20, key: 60 });
    expect(t.clipped).toBe(0);
  });

  it('reuses a pattern that repeats among different bars', () => {
    // A B A B A B A B, each bar different from the other but repeating: the 2-bar AB pattern wins.
    const items: LaneItem[] = [];
    for (let bar = 0; bar < 8; bar += 1) items.push(hit(bar, 0, bar % 2 === 0 ? 'kick' : 'snare'));
    const t = tileLane(items, BAR);
    expect(t.patterns).toHaveLength(1);
    expect(t.patterns[0]?.bars).toBe(8);
  });

  it('handles a lane that does not fill the last block', () => {
    const t = tileLane(Array.from({ length: 3 }, (_, bar) => hit(bar, 0)), BAR);
    expect(t.blocks.reduce((sum, b) => sum + b.bars, 0)).toBe(3);
    expect(t.blocks.every((b) => [1, 2, 4, 8].includes(b.bars))).toBe(true);
  });

  it('counts the patterns a lane needs', () => {
    expect(patternsNeeded([hit(7, 0, 'kick'), hit(15, 0, 'snare'), hit(23, 0, 'kick')], BAR)).toBe(2);
  });
});

describe('the limit of 120 patterns', () => {
  /** 150 different notes, each eight bars after the last, so that no block can hold two of them. */
  const lane: LaneItem[] = Array.from({ length: 150 }, (_, i) => ({ start: i * 8 * BAR + (i % 40), length: 2, key: 36 + Math.floor(i / 40) }));

  it('needs more than 120 and says how many', () => {
    expect(tileLane(lane, BAR).patterns.length).toBe(150);
  });

  it('cuts the lane at the first block that needs pattern 121', () => {
    const tiling = tileLane(lane, BAR);
    const limited = limitPatterns(tiling, 120);
    expect(limited.tiling.patterns).toHaveLength(120);
    expect(limited.tiling.blocks).toHaveLength(120);
    expect(limited.cutAtBar).toBe(960);
    expect(limited.tiling.blocks.every((b) => b.pattern < 120)).toBe(true);
  });

  it('changes nothing when everything fits', () => {
    const tiling = tileLane([hit(0, 0)], BAR);
    expect(limitPatterns(tiling, 120)).toEqual({ tiling, cutAtBar: null });
  });
});

// ---- the eleven album files, against the prototype (fixtures/chunk.json) ----

interface LaneFixture {
  notes: number;
  bars: number;
  patterns: number;
  blocks: number;
  blockList: [number, number][];
  patternBars: number[];
  clipped: number;
  hash: string;
}

const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/chunk.json'), 'utf8')) as Record<string, Record<string, LaneFixture>>;
const midisFolder = join(__dirname, '../../../midis');

function hashOf(patterns: readonly { items: readonly LaneItem[] }[]): string {
  return createHash('sha1')
    .update(patterns.map((p) => p.items.map((n) => `${n.start},${n.length},${n.key}`).join(';')).join('|'))
    .digest('hex');
}

describe('the album files, against the prototype', () => {
  it('has the eleven files in the fixture, 51 lanes in all', () => {
    expect(Object.keys(fixture)).toHaveLength(11);
    expect(Object.values(fixture).reduce((a, e) => a + Object.keys(e).length, 0)).toBe(51);
  });

  for (const [short, lanes] of Object.entries(fixture)) {
    const path = join(midisFolder, `Strokes (The) — ${short} [MIDIfind.com].mid`);
    describe.skipIf(!existsSync(path))(short, () => {
      const read = readMidi(new Uint8Array(readFileSync(path)));
      if (!read.ok) throw new Error(read.reason);
      const timing = analyseTiming(read.file);
      if (!timing.ok) throw new Error(timing.reason);
      const rows = guessMapping(read.file);
      const barTicks = 12 * timing.value.meter.numerator;

      for (const [id, want] of Object.entries(lanes)) {
        it(`${id}: the same patterns, blocks and cuts`, () => {
          const tracks = rows.filter((r) => r.assignment === id).map((r) => r.index);
          const lane = prepareLane(read.file, timing.value, id as 'drums', tracks);
          const tiling = tileLane(lane.items, barTicks);
          expect(lane.items).toHaveLength(want.notes);
          expect(tiling.bars).toBe(want.bars);
          expect(tiling.patterns).toHaveLength(want.patterns);
          expect(tiling.blocks).toHaveLength(want.blocks);
          expect(tiling.blocks.map((b) => [b.startBar, b.bars])).toEqual(want.blockList);
          expect(tiling.patterns.map((p) => p.bars)).toEqual(want.patternBars);
          expect(tiling.clipped).toBe(want.clipped);
          expect(hashOf(tiling.patterns)).toBe(want.hash);
        }, 60000);
      }
    });
  }
});
