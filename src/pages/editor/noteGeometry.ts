/**
 * The geometry of notes that have a length (the string cards of the Guitar page, and the piano roll
 * of Keys): where a click lands, how a drag moves or resizes a note, and which notes are on screen.
 * Pure functions on ticks (12 to a quarter note), so they are tested without a window. The width of a
 * tick on screen is decided in CSS; the pages measure it and pass it in where pixels come into it.
 */
import { FRET_MAX, TUNING, type StringInstrumentId } from '../../core/instruments';
import type { StringNote } from '../../core/project';
import { MIN_NOTE_TICKS, NOTE_VALUE_TICKS, isGridPosition, snapDown, snapNearest, snapLength, type NoteValue } from '../../core/time';

/** A pointer that moves less than this many pixels between press and release is a click, not a drag. */
export const DRAG_THRESHOLD_PX = 4;

/** The frets a card shows, top to bottom: the open string (0) and then the frets up to the count. */
export function fretRows(fretCount: number): number[] {
  const count = Math.min(Math.max(Math.floor(fretCount), 0), FRET_MAX);
  return Array.from({ length: count + 1 }, (_, i) => i);
}

/** Pixels to ticks, for a tick that is `tickPx` wide. */
export function pxToTicks(px: number, tickPx: number): number {
  return tickPx > 0 ? px / tickPx : 0;
}

/** The start of the step of the note value under a click at `x` pixels from the left edge of the grid. */
export function clickStart(x: number, tickPx: number, value: NoteValue, totalTicks: number): number {
  const tick = Math.min(Math.max(pxToTicks(x, tickPx), 0), Math.max(totalTicks - 1, 0));
  return snapDown(tick, value);
}

/** The length of a note placed by a click: one step of the note value, cut short at the pattern's end. */
export function newNoteLength(start: number, value: NoteValue, totalTicks: number): number {
  return Math.max(MIN_NOTE_TICKS, Math.min(NOTE_VALUE_TICKS[value], totalTicks - start));
}

/** A note is valid for the model when it starts and ends on the grid and lies inside the pattern. */
function fits(start: number, length: number, totalTicks: number): boolean {
  return start >= 0 && length >= MIN_NOTE_TICKS && start + length <= totalTicks && isGridPosition(start) && isGridPosition(start + length);
}

/**
 * Where a note starts after it is dragged `dxTicks` along: the nearest line of the note value, kept
 * inside the pattern with the length unchanged. If no valid place results (a note whose own length is
 * off the value's grid), the note stays where it was.
 */
export function movedStart(start: number, length: number, dxTicks: number, value: NoteValue, totalTicks: number): number {
  const wanted = snapNearest(start + dxTicks, value);
  const clamped = Math.min(Math.max(wanted, 0), Math.max(totalTicks - length, 0));
  if (fits(clamped, length, totalTicks)) return clamped;
  // The clamp may have left the grid; try the nearest line of the value that still fits.
  const size = NOTE_VALUE_TICKS[value];
  const lastLine = Math.floor((totalTicks - length) / size) * size;
  const inside = Math.min(Math.max(wanted, 0), Math.max(lastLine, 0));
  return fits(inside, length, totalTicks) ? inside : start;
}

/**
 * The length of a note after its right edge is dragged `dxTicks`: a whole number of the note value,
 * at least one of it (never below half of a third), cut at the pattern's end. If the end would not
 * land on the grid, the nearest grid line for the end is tried, and failing that the length is kept.
 */
export function resizedLength(start: number, length: number, dxTicks: number, value: NoteValue, totalTicks: number): number {
  const room = totalTicks - start;
  const byLength = Math.min(snapLength(length + dxTicks, value), room);
  if (fits(start, byLength, totalTicks)) return byLength;
  const byEnd = Math.min(snapNearest(start + length + dxTicks, value) - start, room);
  if (fits(start, byEnd, totalTicks)) return byEnd;
  return length;
}

/** The notes of a string at a fret that are on screen: inside the pattern and not above the fret count. */
export function notesAt(notes: readonly StringNote[], string: number, fret: number, fretCount: number, totalTicks: number): StringNote[] {
  if (fret > fretCount) return [];
  return notes.filter((n) => n.string === string && n.fret === fret && n.start < totalTicks);
}

/** How many notes sit on frets above the fret count. They are kept, hidden, and return when the count is raised. */
export function hiddenAboveFret(notes: readonly StringNote[], fretCount: number): number {
  return notes.filter((n) => n.fret > fretCount).length;
}

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** A MIDI pitch as a name, middle C (60) being C4: 28 is E1, 64 is E4. */
export function pitchName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${PITCH_NAMES[((midi % 12) + 12) % 12]}${octave}`;
}

/** The names of an instrument's open strings, lowest string first, which is the top card. */
export function stringNames(id: StringInstrumentId): string[] {
  return TUNING[id].map(pitchName);
}
