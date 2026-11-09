/**
 * Moving notes into an instrument's range by whole octaves (docs/midi-import.md, "Pitch range").
 * Pure. A port of fold in tools/midi-prototype/fretting.py and fold_keys in report.py. The range of a
 * string instrument depends on its fret count, which is chosen in the fingering step.
 */
import { KEYS_RANGE, TUNING, type StringInstrumentId } from '../instruments';
import { normalizeNotes, type NormalizeStats } from './quantize';
import type { GridNote } from './types';

export interface PitchRange {
  low: number;
  high: number;
}

export const KEYS_PITCH_RANGE: PitchRange = { low: KEYS_RANGE.low, high: KEYS_RANGE.high };

/** The lowest open string up to the highest string at the given fret. Bass E1 to G2 + frets; guitars E2 to E4 + frets. */
export function stringRange(instrument: StringInstrumentId, fretCount: number): PitchRange {
  const tuning = TUNING[instrument];
  return { low: tuning[0] as number, high: (tuning[tuning.length - 1] as number) + fretCount };
}

/** The pitch moved by whole octaves into the range, and how many octaves it moved. */
export function foldPitch(pitch: number, range: PitchRange): { pitch: number; octaves: number } {
  let folded = pitch;
  let octaves = 0;
  while (folded > range.high) {
    folded -= 12;
    octaves += 1;
  }
  while (folded < range.low) {
    folded += 12;
    octaves += 1;
  }
  return { pitch: folded, octaves };
}

export interface FoldResult {
  notes: GridNote[];
  /** Notes that were moved at least one octave. */
  moved: number;
  /** Same-pitch rules applied again, because a moved note can land on another. */
  stats: NormalizeStats;
}

/** Moves every note into the range, one note at a time, and re-applies the same-pitch rules. */
export function foldIntoRange(notes: readonly GridNote[], range: PitchRange): FoldResult {
  let moved = 0;
  const folded = notes.map((note) => {
    const result = foldPitch(note.pitch, range);
    if (result.octaves > 0) moved += 1;
    return result.octaves > 0 ? { ...note, pitch: result.pitch } : note;
  });
  const { notes: normalized, stats } = normalizeNotes(folded);
  return { notes: normalized, moved, stats };
}

/** How many notes would move an octave in a range, without changing them. */
export function countOutside(notes: readonly GridNote[], range: PitchRange): number {
  return notes.filter((n) => n.pitch < range.low || n.pitch > range.high).length;
}
