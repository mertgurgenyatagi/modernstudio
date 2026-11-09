/**
 * The Song page's geometry: bars to pixels and back. Pure, so it is tested without a window.
 * Pixels are measured from the left edge of a lane's track (the name column is not counted).
 */
import { MAX_SONG_BARS } from '../../core/song';
import { ticksPerBar, type Meter } from '../../core/time';

/**
 * The width of one bar. Sixteen bars (768 px) and the name column fit the default 960 px window; a
 * wider window shows more bars, a narrower one scrolls sideways inside the lanes.
 */
export const BAR_PX = 48;

export const barToPx = (bar: number): number => bar * BAR_PX;

/** The bar under a pixel position, 0 based, kept inside the song (0 to 255). */
export function barFromPx(px: number): number {
  if (!Number.isFinite(px)) return 0;
  return Math.min(MAX_SONG_BARS - 1, Math.max(0, Math.floor(px / BAR_PX)));
}

/** The width of a block (or the ghost) of this many bars. */
export const blockWidthPx = (bars: number): number => bars * BAR_PX;

/**
 * Where the brush's ghost block starts: at the bar under the pointer. The ghost is not moved to make
 * it fit; if it would overlap or pass bar 256 it is drawn as refused instead (`placeBlock` says so).
 */
export const ghostStartBar = barFromPx;

/**
 * Where a dragged block would land. `grabPx` is how far from the block's left edge it was picked up,
 * so the block stays under the pointer. It snaps to the nearest bar line and stays inside bars 0 to 256.
 */
export function dropBar(pointerPx: number, grabPx: number, bars: number): number {
  const latest = Math.max(0, MAX_SONG_BARS - bars);
  if (!Number.isFinite(pointerPx)) return 0;
  return Math.min(latest, Math.max(0, Math.round((pointerPx - grabPx) / BAR_PX)));
}

/** The playhead's x position for a tick counted from the start of the song. */
export function songTickToPx(songTick: number, meter: Meter): number {
  return (Math.max(0, songTick) / ticksPerBar(meter)) * BAR_PX;
}

/** The bar number shown in the readout (1 based) for a tick counted from the start of the song. */
export function barNumberAtTick(songTick: number, meter: Meter): number {
  return Math.floor(Math.max(0, songTick) / ticksPerBar(meter)) + 1;
}

/** The width of the scrolling area: all 256 bars. */
export const SONG_WIDTH_PX = MAX_SONG_BARS * BAR_PX;
