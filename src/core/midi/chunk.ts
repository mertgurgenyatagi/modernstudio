/**
 * Cutting a lane into patterns and Song blocks (docs/midi-import.md, "Patterns and the Song lanes"). Pure.
 * A port of tools/midi-prototype/chunk.py with the same weights: every bar is either empty (a gap, free)
 * or covered by exactly one stretch of 1, 2, 4 or 8 bars. A stretch costs 1 for the block, plus 6 if its
 * notes are not already a pattern, where "already a pattern" means it was used at least twice in the round
 * before. Up to 8 rounds, until the tiling stops changing; ties go to the longer block.
 * Positions are in twelfths of a quarter note, as everywhere in the importer.
 */

/** A note or drum hit of a lane. A hit has length 0 and a row for its key; a note has a pitch. */
export interface LaneItem {
  start: number;
  length: number;
  key: number | string;
}

/** The notes of one stretch, relative to its start, with lengths cut at its end. */
export interface Signature {
  /** Length of the stretch in bars: 1, 2, 4 or 8. */
  bars: number;
  items: LaneItem[];
  /** Two stretches with the same id hold the same notes and are the same length. */
  id: string;
}

export interface TileBlock {
  startBar: number;
  bars: number;
  /** Index into `patterns`, 0 based, numbered in the order of first use. */
  pattern: number;
}

export interface Tiling {
  /** Bars from bar 1 to the last bar with a note start. */
  bars: number;
  blocks: TileBlock[];
  patterns: Signature[];
  /** Notes that run past the end of their block and are cut there. */
  clipped: number;
}

/** Block lengths the app has, in bars. */
const LENGTHS = [1, 2, 4, 8] as const;
/** The weights of the document. */
const BLOCK_COST = 1;
const PATTERN_COST = 6;
const ROUNDS = 8;

function compareKeys(a: number | string, b: number | string): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

export function compareItems(a: LaneItem, b: LaneItem): number {
  return a.start - b.start || a.length - b.length || compareKeys(a.key, b.key);
}

class Lane {
  readonly bars: number;
  private readonly byBar = new Map<number, LaneItem[]>();
  private readonly memo = new Map<number, Signature>();

  constructor(
    items: readonly LaneItem[],
    private readonly barTicks: number,
  ) {
    let last = -1;
    for (const item of items) {
      const bar = Math.floor(item.start / barTicks);
      if (bar > last) last = bar;
      const list = this.byBar.get(bar);
      if (list) list.push(item);
      else this.byBar.set(bar, [item]);
    }
    this.bars = last + 1;
  }

  isEmpty(bar: number): boolean {
    return (this.byBar.get(bar)?.length ?? 0) === 0;
  }

  signature(bar: number, bars: number): Signature {
    const memoKey = bar * 16 + bars;
    const known = this.memo.get(memoKey);
    if (known) return known;
    const base = bar * this.barTicks;
    const end = (bar + bars) * this.barTicks;
    const items: LaneItem[] = [];
    for (let i = bar; i < bar + bars; i += 1) {
      for (const item of this.byBar.get(i) ?? []) {
        items.push({ start: item.start - base, length: item.length > 0 ? Math.min(item.length, end - item.start) : 0, key: item.key });
      }
    }
    items.sort(compareItems);
    const signature: Signature = { bars, items, id: `${bars}|${items.map((n) => `${n.start},${n.length},${n.key}`).join(';')}` };
    this.memo.set(memoKey, signature);
    return signature;
  }

  /** Notes that start in the stretch and run past its end. */
  clippedIn(bar: number, bars: number): number {
    const end = (bar + bars) * this.barTicks;
    let count = 0;
    for (let i = bar; i < bar + bars; i += 1) {
      for (const item of this.byBar.get(i) ?? []) if (item.length > 0 && item.start + item.length > end) count += 1;
    }
    return count;
  }
}

function sameBlocks(a: readonly { startBar: number; bars: number }[] | null, b: readonly { startBar: number; bars: number }[]): boolean {
  return a !== null && a.length === b.length && a.every((x, i) => x.startBar === b[i]!.startBar && x.bars === b[i]!.bars);
}

/** Cuts a lane (notes sorted or not) into blocks and the distinct patterns they use. `barTicks` is one bar in twelfths. */
export function tileLane(items: readonly LaneItem[], barTicks: number): Tiling {
  const lane = new Lane(items, barTicks);
  const n = lane.bars;
  let used = new Map<string, number>();
  let previous: { startBar: number; bars: number }[] | null = null;
  let blocks: { startBar: number; bars: number }[] = [];

  for (let round = 0; round < ROUNDS; round += 1) {
    const best: number[] = new Array<number>(n + 1).fill(Infinity);
    const back: ({ from: number; bars: number } | null)[] = new Array<{ from: number; bars: number } | null>(n + 1).fill(null);
    best[0] = 0;
    for (let b = 0; b < n; b += 1) {
      const here = best[b]!;
      if (here === Infinity) continue;
      if (lane.isEmpty(b) && here < best[b + 1]!) {
        best[b + 1] = here;
        back[b + 1] = { from: b, bars: 0 };
      }
      for (const length of LENGTHS) {
        if (b + length > n) break;
        const signature = lane.signature(b, length);
        if (signature.items.length === 0) continue;
        const known = round > 0 ? (used.get(signature.id) ?? 0) >= 2 : false;
        let cost = here + BLOCK_COST + (known ? 0 : PATTERN_COST);
        cost -= 1e-6 * length; // longer blocks win exact ties
        if (cost < best[b + length]!) {
          best[b + length] = cost;
          back[b + length] = { from: b, bars: length };
        }
      }
    }
    blocks = [];
    for (let end = n; end > 0; ) {
      const step = back[end]!;
      if (step.bars > 0) blocks.push({ startBar: step.from, bars: step.bars });
      end = step.from;
    }
    blocks.reverse();
    if (sameBlocks(previous, blocks)) break;
    previous = blocks;
    used = new Map();
    for (const block of blocks) {
      const id = lane.signature(block.startBar, block.bars).id;
      used.set(id, (used.get(id) ?? 0) + 1);
    }
  }

  const index = new Map<string, number>();
  const patterns: Signature[] = [];
  let clipped = 0;
  const tiled: TileBlock[] = blocks.map((block) => {
    const signature = lane.signature(block.startBar, block.bars);
    let pattern = index.get(signature.id);
    if (pattern === undefined) {
      pattern = patterns.length;
      index.set(signature.id, pattern);
      patterns.push(signature);
    }
    clipped += lane.clippedIn(block.startBar, block.bars);
    return { startBar: block.startBar, bars: block.bars, pattern };
  });
  return { bars: n, blocks: tiled, patterns, clipped };
}

/** How many distinct patterns a lane needs. */
export function patternsNeeded(items: readonly LaneItem[], barTicks: number): number {
  return tileLane(items, barTicks).patterns.length;
}

export interface Limited {
  tiling: Tiling;
  /** The bar the lane was cut at because the patterns ran out, or null when everything fits. */
  cutAtBar: number | null;
}

/**
 * Keeps at most `limit` patterns. Patterns are numbered by first use, so the lane is cut at the first
 * block that would need one more than the limit, and everything from there on is dropped.
 */
export function limitPatterns(tiling: Tiling, limit: number): Limited {
  if (tiling.patterns.length <= limit) return { tiling, cutAtBar: null };
  const stop = tiling.blocks.findIndex((block) => block.pattern >= limit);
  const cutAtBar = tiling.blocks[stop]!.startBar;
  return {
    tiling: { ...tiling, blocks: tiling.blocks.slice(0, stop), patterns: tiling.patterns.slice(0, limit) },
    cutAtBar,
  };
}
