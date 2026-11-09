/**
 * Selecting and moving several notes at once in a note editor: the rectangle drawn by dragging over
 * empty space, a selection moved in time and across rows, a selection made longer or shorter. Pure,
 * on ticks and row numbers, so it is tested without a window. The model checks the result again
 * (replaceNotes in src/core/patterns.ts), so nothing here can put a wrong note into a project.
 */
import { noteKey } from '../../core/patterns';
import type { Note } from '../../core/project';
import { NOTE_VALUE_TICKS, isGridPosition, snapNearest, type NoteValue } from '../../core/time';
import { hitWidthTicks } from './grid';
import type { EditorLayout } from './layout';
import { resizedLength } from './noteGeometry';

/** A note as the editor draws it: its row and the ticks it covers on screen. */
export interface Shown {
  note: Note;
  key: string;
  row: number;
  start: number;
  /** The ticks it is drawn across: its length cut at the pattern's end, or a drum hit's pad. */
  width: number;
}

/**
 * The notes the editor shows: on a row of the layout and starting inside the pattern. A note that
 * runs past the end is drawn up to the end. `value` decides how wide a drum hit is drawn.
 */
export function shownNotes(notes: readonly Note[], layout: EditorLayout, total: number, value: NoteValue): Shown[] {
  const out: Shown[] = [];
  for (const note of notes) {
    const row = layout.rowOf(note);
    if (row === null || note.start >= total) continue;
    const width = 'length' in note ? Math.min(note.length, total - note.start) : hitWidthTicks(note.start, value);
    out.push({ note, key: noteKey(note), row, start: note.start, width });
  }
  return out;
}

/** A rectangle over the grid, in ticks (from, to) and rows (top, bottom, both included). */
export interface Rect {
  from: number;
  to: number;
  top: number;
  bottom: number;
}

/** The notes a rectangle touches: any part of the note inside it counts. */
export function notesInRect(shown: readonly Shown[], rect: Rect): Shown[] {
  const from = Math.min(rect.from, rect.to);
  const to = Math.max(rect.from, rect.to);
  const top = Math.min(rect.top, rect.bottom);
  const bottom = Math.max(rect.top, rect.bottom);
  return shown.filter((s) => s.row >= top && s.row <= bottom && s.start < to && s.start + s.width > from);
}

/** The end of a note for the purpose of keeping it inside the pattern: a drum hit only has to start inside. */
function lastTick(note: Note): number {
  return 'length' in note ? note.start + note.length : note.start + 1;
}

function onGrid(note: Note): boolean {
  return isGridPosition(note.start) && (!('length' in note) || isGridPosition(note.start + note.length));
}

/**
 * How far a group can be moved in time when the note the pointer holds is dragged to `wanted` ticks:
 * the held note lands on the nearest line of the note value it can, every note stays inside the
 * pattern and on the grid. 0 (no move) when nothing better fits.
 */
export function groupShift(notes: readonly Note[], held: Note, wanted: number, value: NoteValue, total: number): number {
  if (notes.length === 0) return 0;
  const step = NOTE_VALUE_TICKS[value];
  const low = -Math.min(...notes.map((n) => n.start));
  const high = total - Math.max(...notes.map(lastTick));
  if (high < low) return 0;
  const target = snapNearest(wanted, value);
  let best = 0;
  let bestDistance = Math.abs(held.start - wanted);
  // Walk the lines of the note value outwards from the target; the nearest that fits wins.
  for (let k = 0; k * step <= total + step; k += 1) {
    for (const line of k === 0 ? [target] : [target - k * step, target + k * step]) {
      const shift = line - held.start;
      if (shift < low || shift > high) continue;
      if (!notes.every((n) => onGrid({ ...n, start: n.start + shift }))) continue;
      const distance = Math.abs(line - wanted);
      if (distance < bestDistance || (distance === bestDistance && Math.abs(shift) < Math.abs(best))) {
        best = shift;
        bestDistance = distance;
      }
    }
    if (bestDistance <= k * step) break;
  }
  return best;
}

/** How far a group can be moved across rows: `wanted` rows, held back so every note stays on a row. */
export function groupRowShift(rows: readonly number[], wanted: number, rowCount: number): number {
  if (rows.length === 0) return 0;
  const low = -Math.min(...rows);
  const high = rowCount - 1 - Math.max(...rows);
  return Math.min(high, Math.max(low, Math.round(wanted)));
}

/** The group moved by `shift` ticks and `rowShift` rows, each note rebuilt on its new row; null if a note has no row. */
export function movedGroup(shown: readonly Shown[], layout: EditorLayout, shift: number, rowShift: number): Note[] | null {
  const out: Note[] = [];
  for (const s of shown) {
    const length = 'length' in s.note ? s.note.length : 0;
    const note = layout.noteOn(s.row + rowShift, s.start + shift, length);
    if (!note) return null;
    out.push(note);
  }
  return out;
}

/** The group with each note's right edge dragged `dxTicks`, snapped to the note value and kept inside the pattern. */
export function resizedGroup(notes: readonly Note[], dxTicks: number, value: NoteValue, total: number): Note[] {
  return notes.map((n) => ('length' in n ? { ...n, length: resizedLength(n.start, n.length, dxTicks, value, total) } : n));
}
