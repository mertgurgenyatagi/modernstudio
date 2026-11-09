/**
 * The Song page's geometry: bars, lanes and pixels, at any zoom. Pure, so it is tested without a
 * window. Pixels are measured from the top left of the lanes (the name column and the bar numbers
 * are not counted). The width of a bar is the zoom (`barPx`, src/state/view.ts).
 */
import { INSTRUMENT_IDS, type InstrumentId } from '../../core/instruments';
import { blockBars, type Project } from '../../core/project';
import { MAX_SONG_BARS, type BlockRef } from '../../core/song';
import { ticksPerBar, type Meter } from '../../core/time';

/** The name column at the left, and the bar numbers on top, in pixels. */
export const NAME_PX = 112;
export const TIMELINE_PX = 24;

/** A lane shares the height with the others, between these limits, in pixels. */
export const LANE_MIN_PX = 40;
export const LANE_MAX_PX = 104;

/** The five lanes' height for the room below the bar numbers: they fill it, within the limits. */
export function laneHeight(roomPx: number): number {
  const share = Math.floor(roomPx / INSTRUMENT_IDS.length);
  return Math.min(LANE_MAX_PX, Math.max(LANE_MIN_PX, share));
}

/** The bar under a pixel position, 0 based, kept inside the song (0 to 255). */
export function barFromPx(px: number, barPx: number): number {
  if (!Number.isFinite(px) || barPx <= 0) return 0;
  return Math.min(MAX_SONG_BARS - 1, Math.max(0, Math.floor(px / barPx)));
}

/** The lane under a pixel height, or null outside the lanes. */
export function laneFromPx(py: number, laneH: number): InstrumentId | null {
  if (!Number.isFinite(py) || py < 0 || laneH <= 0) return null;
  return INSTRUMENT_IDS[Math.floor(py / laneH)] ?? null;
}

/** How many bars a drag of `dxPx` moves a block: to the nearest bar line. */
export function dragBars(dxPx: number, barPx: number): number {
  if (!Number.isFinite(dxPx) || barPx <= 0) return 0;
  return Math.round(dxPx / barPx);
}

/** The playhead's x position for a tick counted from the start of the song. */
export function songTickToPx(songTick: number, meter: Meter, barPx: number): number {
  return (Math.max(0, songTick) / ticksPerBar(meter)) * barPx;
}

/** The bar number shown in the readout (1 based) for a tick counted from the start of the song. */
export function barNumberAtTick(songTick: number, meter: Meter): number {
  return Math.floor(Math.max(0, songTick) / ticksPerBar(meter)) + 1;
}

/** Every how many bars a line is drawn, so the lines never crowd closer than 6 px. */
export function barLineEvery(barPx: number): number {
  let every = 1;
  while (every * barPx < 6 && every < 64) every *= 2;
  return every;
}

export interface PxRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The blocks a rectangle drawn over the lanes touches, in lane order. */
export function blocksInRect(project: Project, rect: PxRect, barPx: number, laneH: number): BlockRef[] {
  const left = Math.min(rect.x0, rect.x1);
  const right = Math.max(rect.x0, rect.x1);
  const top = Math.min(rect.y0, rect.y1);
  const bottom = Math.max(rect.y0, rect.y1);
  const out: BlockRef[] = [];
  INSTRUMENT_IDS.forEach((id, lane) => {
    if (bottom < lane * laneH || top >= (lane + 1) * laneH) return;
    for (const block of project.instruments[id].lane) {
      const x = block.startBar * barPx;
      const end = (block.startBar + blockBars(project, id, block)) * barPx;
      if (x <= right && end > left) out.push({ instrument: id, startBar: block.startBar });
    }
  });
  return out;
}
