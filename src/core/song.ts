/**
 * Song lanes. Blocks snap to bars, never overlap, and may leave gaps. The song ends at the end of
 * the last block on any lane, and is 256 bars at most. A block is as long as its pattern.
 * See docs/patterns-and-song.md.
 */
import { INSTRUMENT_IDS, type InstrumentId } from './instruments';
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

/** The song's length in bars: the end of the last block on any lane, 0 when the lanes are empty. */
export function songBars(project: Project): number {
  let end = 0;
  for (const id of INSTRUMENT_IDS) {
    for (const block of project.instruments[id].lane) end = Math.max(end, blockEnd(project, id, block));
  }
  return end;
}
