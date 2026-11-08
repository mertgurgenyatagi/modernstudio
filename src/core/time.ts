/**
 * The time grid. Time is counted in ticks, and one quarter note is 12 ticks, because 12 divides
 * evenly into the 16th grid (3 ticks), the third grid (4 ticks) and the half-of-a-third grid
 * (2 ticks). See docs/midi-import.md and docs/time-and-notes.md.
 */

export const TICKS_PER_QUARTER = 12;

export type Meter = '4/4' | '3/4';
export const METERS: readonly Meter[] = ['4/4', '3/4'];

export const BPM_MIN = 40;
export const BPM_MAX = 300;
export const BPM_DEFAULT = 120;

export const NOTE_VALUES = ['whole', 'half', 'quarter', 'sixteenth', 'third', 'halfThird'] as const;
export type NoteValue = (typeof NOTE_VALUES)[number];

/** The length of each note value in ticks. A third is one third of a quarter, a triplet. */
export const NOTE_VALUE_TICKS: Record<NoteValue, number> = {
  whole: 4 * TICKS_PER_QUARTER,
  half: 2 * TICKS_PER_QUARTER,
  quarter: TICKS_PER_QUARTER,
  sixteenth: TICKS_PER_QUARTER / 4,
  third: TICKS_PER_QUARTER / 3,
  halfThird: TICKS_PER_QUARTER / 6,
};

/** The shortest note there is: half of a third. A note never has zero length. */
export const MIN_NOTE_TICKS = NOTE_VALUE_TICKS.halfThird;

/** Pattern lengths in bars: 1x, 2x, 4x, 8x. */
export const PATTERN_BARS = [1, 2, 4, 8] as const;
export type PatternBars = (typeof PATTERN_BARS)[number];
export const MAX_PATTERN_BARS = 8;

export function ticksPerBar(meter: Meter): number {
  return (meter === '4/4' ? 4 : 3) * TICKS_PER_QUARTER;
}

/** The ticks a pattern of this many bars covers. */
export function patternTicks(meter: Meter, bars: number): number {
  return ticksPerBar(meter) * bars;
}

/** Start positions that exist inside one beat, in ticks: the union of the 16th, third and half-of-a-third grids. */
const BEAT_POSITIONS: ReadonlySet<number> = new Set([0, 2, 3, 4, 6, 8, 9, 10]);

/** Whether a tick lies on the grid of some note value. Note starts and note ends must both be on it. */
export function isGridPosition(tick: number): boolean {
  if (!Number.isInteger(tick) || tick < 0) return false;
  return BEAT_POSITIONS.has(tick % TICKS_PER_QUARTER);
}

/** The start of the grid cell of the given note value that holds the tick. This is where a click lands. */
export function snapDown(tick: number, value: NoteValue): number {
  const size = NOTE_VALUE_TICKS[value];
  return Math.floor(tick / size) * size;
}

/** The nearest grid line of the given note value. Used for dragging. A tie goes to the earlier line. */
export function snapNearest(tick: number, value: NoteValue): number {
  const size = NOTE_VALUE_TICKS[value];
  const down = Math.floor(tick / size) * size;
  return tick - down > size / 2 ? down + size : down;
}

/** A dragged length, snapped to a whole number of the note value, at least one of it. */
export function snapLength(length: number, value: NoteValue): number {
  const size = NOTE_VALUE_TICKS[value];
  return Math.max(size, Math.round(length / size) * size);
}

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return BPM_DEFAULT;
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)));
}
