/**
 * The geometry of a pattern editor, as pure functions so it can be tested without a window. All five
 * instrument pages share it (NoteEditor.tsx).
 *
 * Positions are ticks (12 to a quarter note). The screen width of a tick follows the zoom
 * (src/state/view.ts): by default one bar fills the width.
 */
import { DRUM_ROWS, type DrumRow } from '../../core/instruments';
import type { DrumNote } from '../../core/project';
import { MIN_NOTE_TICKS, NOTE_VALUE_TICKS, TICKS_PER_QUARTER, ticksPerBar, type Meter, type NoteValue } from '../../core/time';

/** Drum rows as the pads show them, top to bottom (the model lists them bottom to top). */
export const DRUM_ROWS_TOP_DOWN: readonly DrumRow[] = [...DRUM_ROWS].reverse();

export const DRUM_LABELS: Record<DrumRow, string> = {
  kick: 'Kick',
  snare: 'Snare',
  hihat: 'Hi-hat',
  openHihat: 'Open hi-hat',
  crash: 'Crash',
};

/** How many steps of the note value a pattern of this many ticks holds. The last one may overhang the end. */
export function cellCount(totalTicks: number, value: NoteValue): number {
  return Math.max(0, Math.ceil(totalTicks / NOTE_VALUE_TICKS[value]));
}

/** The start tick of every step of the note value, in order. */
export function cellStarts(totalTicks: number, value: NoteValue): number[] {
  const size = NOTE_VALUE_TICKS[value];
  return Array.from({ length: cellCount(totalTicks, value) }, (_, i) => i * size);
}

/** Whether a start lies on a step of the note value. A hit placed with another value can lie off it. */
export function isOnGrid(start: number, value: NoteValue): boolean {
  return start % NOTE_VALUE_TICKS[value] === 0;
}

/**
 * How wide a hit is drawn, in ticks: a whole step of the note value when it sits on the grid, and a
 * narrow mark (half of a third) when it does not, so that mixed straight and third hits stay readable.
 */
export function hitWidthTicks(start: number, value: NoteValue): number {
  return isOnGrid(start, value) ? NOTE_VALUE_TICKS[value] : MIN_NOTE_TICKS;
}

/** The hits that lie inside the visible pattern. Hits beyond a shortened pattern are kept but not drawn. */
export function visibleHits(notes: readonly DrumNote[], row: DrumRow, totalTicks: number): DrumNote[] {
  return notes.filter((n) => n.row === row && n.start < totalTicks);
}

export interface BeatMark {
  tick: number;
  label: string;
  /** The first beat of a bar, which gets the heavier line. */
  barStart: boolean;
}

/** The beat numbers above the grid. A pattern of several bars labels them "bar.beat" (2.3). */
export function beatMarks(meter: Meter, bars: number): BeatMark[] {
  const perBar = ticksPerBar(meter) / TICKS_PER_QUARTER;
  const marks: BeatMark[] = [];
  for (let bar = 1; bar <= bars; bar += 1) {
    for (let beat = 1; beat <= perBar; beat += 1) {
      marks.push({
        tick: ((bar - 1) * perBar + (beat - 1)) * TICKS_PER_QUARTER,
        label: bars > 1 ? `${bar}.${beat}` : String(beat),
        barStart: beat === 1,
      });
    }
  }
  return marks;
}

/**
 * The marks above the grid at a zoom: every beat while a beat is at least `MIN_BEAT_LABEL_PX` wide,
 * otherwise only the first beat of each bar, numbered by its bar.
 */
export function rulerMarks(meter: Meter, bars: number, tickPx: number): BeatMark[] {
  const marks = beatMarks(meter, bars);
  if (TICKS_PER_QUARTER * tickPx >= MIN_BEAT_LABEL_PX) return marks;
  const perBar = ticksPerBar(meter);
  return marks.filter((m) => m.barStart).map((m) => ({ ...m, label: String(m.tick / perBar + 1) }));
}

/** A beat narrower than this has no number of its own; the bars keep theirs. */
export const MIN_BEAT_LABEL_PX = 26;
/** Lines closer than this are left out, so a zoomed-out grid does not turn grey. */
export const MIN_LINE_GAP_PX = 5;

/**
 * The vertical lines of a grid, which follow the chosen note value (the user's sweeping changes,
 * 2026-11-09): `majorTicks` is the period of the lines in the rule colour (every step of a value of a
 * beat or longer, or every beat when the value is shorter), `minorTicks` the period of faint lines at
 * every step of a value shorter than a beat. 0 means no lines. The bar lines are always drawn, in ink.
 * The Drums pads show the steps themselves, so they ask for no faint lines (`withSteps` false).
 */
export function gridLines(value: NoteValue, tickPx: number, withSteps = true): { majorTicks: number; minorTicks: number } {
  const step = NOTE_VALUE_TICKS[value];
  const major = Math.max(TICKS_PER_QUARTER, step);
  const minor = withSteps && step < TICKS_PER_QUARTER ? step : 0;
  return {
    majorTicks: major * tickPx >= MIN_LINE_GAP_PX ? major : 0,
    minorTicks: minor > 0 && minor * tickPx >= MIN_LINE_GAP_PX ? minor : 0,
  };
}

/** Where a pad is, in words, for a screen reader: "bar 2, beat 3" and how far past the beat. */
export function describeStart(start: number, meter: Meter): string {
  const perBar = ticksPerBar(meter);
  const bar = Math.floor(start / perBar) + 1;
  const inBar = start % perBar;
  const beat = Math.floor(inBar / TICKS_PER_QUARTER) + 1;
  const past = inBar % TICKS_PER_QUARTER;
  return past === 0 ? `bar ${bar}, beat ${beat}` : `bar ${bar}, beat ${beat} plus ${past} twelfths`;
}

/** The playhead's x position inside a grid that is `gridPx` wide and covers `totalTicks`. */
export function playheadPx(tick: number, totalTicks: number, gridPx: number): number {
  if (totalTicks <= 0) return 0;
  return (Math.min(Math.max(tick, 0), totalTicks) / totalTicks) * gridPx;
}
