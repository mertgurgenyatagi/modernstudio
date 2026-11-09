/**
 * The piano roll of the Keys page as pure functions, so it is tested without a window: which pitches
 * are rows, which rows are black keys, which rows carry a label, which notes are on screen, and where
 * the roll starts scrolled. The geometry of a note's length and drag is shared with the Guitar page
 * (noteGeometry.ts).
 */
import { KEYS_RANGE } from '../../core/instruments';
import type { KeysNote } from '../../core/project';
import { pitchName } from './noteGeometry';

/** The middle C that the roll first shows. */
export const MIDDLE_C = 60;

/** The pitches of the rows, top to bottom: C6 at the top, C2 at the bottom (a piano roll, high up). 49 rows. */
export const KEY_ROWS: readonly number[] = Array.from(
  { length: KEYS_RANGE.high - KEYS_RANGE.low + 1 },
  (_, i) => KEYS_RANGE.high - i,
);

/** The row of a pitch, 0 being the top row; null for a pitch outside the range or not a whole number. */
export function keyRowIndex(pitch: number): number | null {
  if (!Number.isInteger(pitch) || pitch < KEYS_RANGE.low || pitch > KEYS_RANGE.high) return null;
  return KEYS_RANGE.high - pitch;
}

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

/** Whether the pitch is a black key (C#, D#, F#, G#, A#). Those rows are tinted. */
export function isBlackKey(pitch: number): boolean {
  return BLACK_KEYS.has(((pitch % 12) + 12) % 12);
}

/**
 * The label of a row: every C is labelled (C2 to C6), the other rows carry none (assumed; docs/open-items.md).
 */
export function keyLabel(pitch: number): string {
  return ((pitch % 12) + 12) % 12 === 0 ? pitchName(pitch) : '';
}

/** The notes of one pitch that are on screen: those that start inside the shown pattern. */
export function keyNotesAt(notes: readonly KeysNote[], pitch: number, totalTicks: number): KeysNote[] {
  return notes.filter((n) => n.pitch === pitch && n.start < totalTicks);
}

/** Notes outside C2 to C6 cannot be placed by hand (an import never makes them); any that exist would have no row. */
export function hiddenOutOfRange(notes: readonly KeysNote[]): number {
  return notes.filter((n) => keyRowIndex(n.pitch) === null).length;
}

/**
 * How far the roll is scrolled down when the page opens, so that middle C is in the middle of the view
 * (the octave around it is in view), without scrolling past either end. All lengths in pixels.
 */
export function startScrollTop(rowPx: number, viewPx: number, rowCount: number): number {
  if (rowPx <= 0 || viewPx <= 0) return 0;
  const index = keyRowIndex(MIDDLE_C) ?? 0;
  const wanted = (index + 0.5) * rowPx - viewPx / 2;
  const most = Math.max(rowCount * rowPx - viewPx, 0);
  return Math.min(Math.max(wanted, 0), most);
}
