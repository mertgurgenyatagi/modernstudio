/**
 * The rows of each note editor, as pure data and functions so they are tested without a window. All
 * five instrument pages draw the same editor (NoteEditor.tsx); what differs is here: which rows there
 * are, top to bottom, what the label column says, and how a note maps to a row and back.
 *
 * - Drums: five rows, crash at the top and kick at the bottom. Hits have no length.
 * - Bass and the guitars: the string layout, lowest string at the top, each string the open string
 *   and then its frets downwards (docs/instrument-layouts.md). The string's name labels its open-string
 *   row, and a heavier line divides the strings.
 * - Keys: a piano roll, C6 at the top down to C2.
 */
import { TUNING, type DrumRow, type FretCount, type InstrumentId, type StringInstrumentId } from '../../core/instruments';
import type { Sound } from '../../core/playback';
import type { DrumNote, KeysNote, Note, StringNote } from '../../core/project';
import { DRUM_LABELS, DRUM_ROWS_TOP_DOWN } from './grid';
import { KEY_ROWS, isBlackKey, keyLabel, keyRowIndex } from './keyRoll';
import { fretRows, pitchName } from './noteGeometry';

export interface RowSpec {
  /** What the label column shows ('' for nothing). */
  label: string;
  /** The row in words, for a screen reader and a tooltip. */
  name: string;
  /** A tinted row: the open string, or a black key. */
  tinted: boolean;
  /** A heavier line above the row: a new string, or an octave (a C). */
  divider: boolean;
  /** The label is set in ink: a string's name, a C. */
  strong: boolean;
}

export type EditorKind = 'drums' | 'strings' | 'keys';

export interface EditorLayout {
  id: InstrumentId;
  kind: EditorKind;
  rows: RowSpec[];
  /** The width of the label column, in pixels. */
  labelPx: number;
  /** A row is never lower or taller than this, in pixels: it grows to fill the height in between. */
  rowMinPx: number;
  rowMaxPx: number;
  /** The row a note sits on, or null when the editor does not show it (above the fret count, outside C2 to C6). */
  rowOf: (note: Note) => number | null;
  /** The instrument's note on a row, at a start and a length (a drum hit ignores the length). */
  noteOn: (row: number, start: number, length: number) => Note | null;
  /** What a note sounds like, for playing it as it is placed. */
  soundOf: (note: Note) => Sound | null;
  /** The text inside a note: its fret on a string, nothing elsewhere. */
  textOf: (note: Note) => string;
}

const isHit = (note: Note): note is DrumNote => 'row' in note;
const isStringNote = (note: Note): note is StringNote => 'string' in note;
const isKeysNote = (note: Note): note is KeysNote => 'pitch' in note;

export function drumsLayout(): EditorLayout {
  return {
    id: 'drums',
    kind: 'drums',
    rows: DRUM_ROWS_TOP_DOWN.map((row) => ({ label: DRUM_LABELS[row], name: DRUM_LABELS[row], tinted: false, divider: false, strong: true })),
    labelPx: 84,
    rowMinPx: 28,
    rowMaxPx: 72,
    rowOf: (note) => (isHit(note) ? DRUM_ROWS_TOP_DOWN.indexOf(note.row) : null),
    noteOn: (row, start) => {
      const drum: DrumRow | undefined = DRUM_ROWS_TOP_DOWN[row];
      return drum === undefined ? null : { row: drum, start };
    },
    soundOf: (note) => (isHit(note) ? { kind: 'drum', row: note.row } : null),
    textOf: () => '',
  };
}

/** The layout of a string instrument at a fret count. Notes above the fret count have no row: they are kept, hidden. */
export function stringsLayout(id: StringInstrumentId, fretCount: FretCount): EditorLayout {
  const frets = fretRows(fretCount);
  const perString = frets.length;
  const tuning = TUNING[id];
  const rows: RowSpec[] = [];
  tuning.forEach((open, string) => {
    for (const fret of frets) {
      rows.push({
        label: fret === 0 ? pitchName(open) : String(fret),
        name: `${pitchName(open)} string, ${fret === 0 ? 'open' : `fret ${fret}`} (${pitchName(open + fret)})`,
        tinted: fret === 0,
        divider: fret === 0 && string > 0,
        strong: fret === 0,
      });
    }
  });
  return {
    id,
    kind: 'strings',
    rows,
    labelPx: 36,
    rowMinPx: 16,
    rowMaxPx: 26,
    rowOf: (note) => {
      if (!isStringNote(note) || note.fret > fretCount || note.string >= tuning.length) return null;
      return note.string * perString + note.fret;
    },
    noteOn: (row, start, length) => {
      if (row < 0 || row >= rows.length) return null;
      return { string: Math.floor(row / perString), fret: row % perString, start, length };
    },
    soundOf: (note) => {
      if (!isStringNote(note)) return null;
      const open = tuning[note.string];
      return open === undefined ? null : { kind: 'pitch', pitch: open + note.fret };
    },
    textOf: (note) => (isStringNote(note) ? String(note.fret) : ''),
  };
}

export function keysLayout(): EditorLayout {
  return {
    id: 'keys',
    kind: 'keys',
    rows: KEY_ROWS.map((pitch) => ({
      label: keyLabel(pitch),
      name: pitchName(pitch),
      tinted: isBlackKey(pitch),
      divider: keyLabel(pitch) !== '' && pitch !== KEY_ROWS[0],
      strong: keyLabel(pitch) !== '',
    })),
    labelPx: 36,
    rowMinPx: 16,
    rowMaxPx: 24,
    rowOf: (note) => (isKeysNote(note) ? keyRowIndex(note.pitch) : null),
    noteOn: (row, start, length) => {
      const pitch = KEY_ROWS[row];
      return pitch === undefined ? null : { pitch, start, length };
    },
    soundOf: (note) => (isKeysNote(note) ? { kind: 'pitch', pitch: note.pitch } : null),
    textOf: () => '',
  };
}

/**
 * How many rows Shift with an arrow key moves a note: an octave on Keys, a whole string (the same
 * fret, one string over) on a string instrument, one row on the drums.
 */
export function bigRowStep(layout: EditorLayout): number {
  if (layout.kind === 'keys') return 12;
  if (layout.kind === 'strings') return layout.rows.length / (TUNING[layout.id as StringInstrumentId]?.length ?? 1);
  return 1;
}

/** A row's height: the room shared out among the rows, kept between the layout's limits, in whole pixels. */
export function rowHeight(layout: EditorLayout, roomPx: number): number {
  const share = roomPx > 0 ? Math.floor(roomPx / layout.rows.length) : layout.rowMinPx;
  return Math.min(layout.rowMaxPx, Math.max(layout.rowMinPx, share));
}
