/**
 * Song lanes. Blocks snap to bars, never overlap, and may leave gaps. The song ends at the end of
 * the last block on any lane, and is 256 bars at most. A block is as long as its pattern.
 * See docs/patterns-and-song.md.
 */
import { INSTRUMENT_IDS, INSTRUMENT_LABELS, type InstrumentId } from './instruments';
import {
  blockBars,
  isActive,
  ok,
  refuse,
  updateInstrument,
  type Block,
  type Outcome,
  type Project,
} from './project';
import { ticksPerBar } from './time';

export const MAX_SONG_BARS = 256;

/** The bar after the last bar of a block. */
export function blockEnd(project: Project, id: InstrumentId, block: Block): number {
  return block.startBar + blockBars(project, id, block);
}

/** Whether a lane, given as blocks of (start, bars), has no overlap and stays within 256 bars. */
export function laneFits(spans: readonly { startBar: number; bars: number }[]): boolean {
  const sorted = spans.slice().sort((a, b) => a.startBar - b.startBar);
  let end = 0;
  for (const span of sorted) {
    if (span.startBar < end || span.startBar < 0) return false;
    end = span.startBar + span.bars;
    if (end > MAX_SONG_BARS) return false;
  }
  return true;
}

function sortedLane(blocks: readonly Block[]): Block[] {
  return blocks.slice().sort((a, b) => a.startBar - b.startBar);
}

/** The block that covers the bar, if any. */
export function blockAt(project: Project, id: InstrumentId, bar: number): Block | undefined {
  return project.instruments[id].lane.find((b) => bar >= b.startBar && bar < blockEnd(project, id, b));
}

/**
 * The block that is playing at a point of the song, given in ticks from the start of the song (what the
 * engine reports as `songTick`), or undefined in a gap. Instrument pages show this block's pattern
 * while the Song plays.
 */
export function blockAtTick(project: Project, id: InstrumentId, songTick: number): Block | undefined {
  if (!Number.isFinite(songTick) || songTick < 0) return undefined;
  return blockAt(project, id, Math.floor(songTick / ticksPerBar(project.meter)));
}

/** Whether a pattern of this many bars can start at the bar without overlapping or passing bar 256. */
function canPlace(project: Project, id: InstrumentId, bars: number, startBar: number, ignore?: Block): boolean {
  if (!Number.isInteger(startBar) || startBar < 0 || startBar + bars > MAX_SONG_BARS) return false;
  for (const other of project.instruments[id].lane) {
    if (other === ignore) continue;
    if (startBar < blockEnd(project, id, other) && other.startBar < startBar + bars) return false;
  }
  return true;
}

/** Places a pattern at a bar. Only active patterns can be placed; a pattern can be placed any number of times. */
export function placeBlock(project: Project, id: InstrumentId, pattern: number, startBar: number): Outcome {
  const instrument = project.instruments[id];
  const chosen = instrument.patterns[pattern];
  if (!chosen || pattern >= instrument.shownPatterns) return refuse('That pattern does not exist.');
  if (!isActive(chosen)) return refuse('A pattern with no notes cannot be placed.');
  if (!canPlace(project, id, chosen.bars, startBar)) {
    return refuse('A block cannot overlap another block or run past bar 256.');
  }
  return ok(updateInstrument(project, id, (i) => ({ ...i, lane: sortedLane([...i.lane, { pattern, startBar }]) })));
}

/** Moves the block that starts at `fromBar` so that it starts at `toBar`. */
export function moveBlock(project: Project, id: InstrumentId, fromBar: number, toBar: number): Outcome {
  const block = project.instruments[id].lane.find((b) => b.startBar === fromBar);
  if (!block) return refuse('There is no block there.');
  if (fromBar === toBar) return ok(project);
  if (!canPlace(project, id, blockBars(project, id, block), toBar, block)) {
    return refuse('A block cannot overlap another block or run past bar 256.');
  }
  return ok(
    updateInstrument(project, id, (i) => ({
      ...i,
      lane: sortedLane(i.lane.map((b) => (b === block ? { ...b, startBar: toBar } : b))),
    })),
  );
}

/** Removes the block that starts at the bar (select it and press Delete). */
export function removeBlock(project: Project, id: InstrumentId, startBar: number): Project {
  return updateInstrument(project, id, (i) => {
    const lane = i.lane.filter((b) => b.startBar !== startBar);
    return lane.length === i.lane.length ? i : { ...i, lane };
  });
}

// ---- Several blocks at once (a selection) ----

/** A block as the Song page points at it: its lane and the bar it starts at. */
export interface BlockRef {
  instrument: InstrumentId;
  startBar: number;
}

/** A block to place: a pattern of an instrument at a bar. */
export interface BlockPlacement extends BlockRef {
  pattern: number;
}

function laneWord(id: InstrumentId): string {
  return `the ${INSTRUMENT_LABELS[id]} lane`;
}

function barsWord(from: number, bars: number): string {
  return bars === 1 ? `Bar ${from + 1}` : `Bars ${from + 1} to ${from + bars}`;
}

/**
 * Places several blocks as one edit (a paste): all of them or none. The reason of a refusal names the
 * first lane and bars that are taken, or says the song would pass bar 256.
 */
export function placeBlocks(project: Project, placements: readonly BlockPlacement[]): Outcome {
  let next = project;
  for (const p of placements) {
    const instrument = next.instruments[p.instrument];
    const chosen = instrument.patterns[p.pattern];
    if (!chosen || p.pattern >= instrument.shownPatterns) return refuse('That pattern does not exist.');
    if (!isActive(chosen)) return refuse('A pattern with no notes cannot be placed.');
    if (!Number.isInteger(p.startBar) || p.startBar < 0) return refuse('A block cannot start before bar 1.');
    if (p.startBar + chosen.bars > MAX_SONG_BARS) return refuse('That would run past bar 256.');
    if (!canPlace(next, p.instrument, chosen.bars, p.startBar)) {
      return refuse(`${barsWord(p.startBar, chosen.bars)} ${chosen.bars === 1 ? 'is' : 'are'} taken in ${laneWord(p.instrument)}.`);
    }
    next = updateInstrument(next, p.instrument, (i) => ({
      ...i,
      lane: sortedLane([...i.lane, { pattern: p.pattern, startBar: p.startBar }]),
    }));
  }
  return ok(next);
}

/** The blocks the refs point at, with their instrument; refs that point at nothing are left out. */
export function blocksOf(project: Project, refs: readonly BlockRef[]): BlockPlacement[] {
  const out: BlockPlacement[] = [];
  for (const ref of refs) {
    const block = project.instruments[ref.instrument].lane.find((b) => b.startBar === ref.startBar);
    if (block) out.push({ instrument: ref.instrument, startBar: block.startBar, pattern: block.pattern });
  }
  return out;
}

/** Removes several blocks as one edit (Delete on a selection, or a cut). */
export function removeBlocks(project: Project, refs: readonly BlockRef[]): Project {
  let next = project;
  for (const ref of refs) next = removeBlock(next, ref.instrument, ref.startBar);
  return next;
}

/**
 * Moves several blocks by the same number of bars as one edit, keeping their places relative to
 * each other. Refused if one would overlap a block that is not moving, or leave bars 1 to 256.
 */
export function moveBlocks(project: Project, refs: readonly BlockRef[], deltaBars: number): Outcome {
  const moving = blocksOf(project, refs);
  if (moving.length === 0) return refuse('There is no block there.');
  if (deltaBars === 0) return ok(project);
  const lifted = removeBlocks(project, moving);
  return placeBlocks(
    lifted,
    moving.map((b) => ({ ...b, startBar: b.startBar + deltaBars })),
  );
}

/** The bars a group of blocks covers: from the first start to the last end. */
export function groupSpan(project: Project, blocks: readonly BlockPlacement[]): { start: number; end: number } | null {
  if (blocks.length === 0) return null;
  let start = Infinity;
  let end = 0;
  for (const b of blocks) {
    start = Math.min(start, b.startBar);
    end = Math.max(end, b.startBar + (project.instruments[b.instrument].patterns[b.pattern]?.bars ?? 1));
  }
  return { start, end };
}

/** The song's length in bars: the end of the last block on any lane, 0 when the lanes are empty. */
export function songBars(project: Project): number {
  let end = 0;
  for (const id of INSTRUMENT_IDS) {
    for (const block of project.instruments[id].lane) end = Math.max(end, blockEnd(project, id, block));
  }
  return end;
}
