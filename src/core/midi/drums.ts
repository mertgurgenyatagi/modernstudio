/**
 * Channel-10 notes to the five drum rows (docs/midi-import.md, "Drums"). Pure. A port of
 * drum_notes in tools/midi-prototype/pipeline.py. Everything the five rows do not cover is dropped
 * and counted, so the report can say what was lost.
 */
import { DRUM_ROWS, type DrumRow } from '../instruments';
import type { MidiNote } from './read';
import { snapTwelfths, toTwelfths } from './quantize';
import type { GridHit } from './types';

/** General MIDI percussion note to row. The ride cymbals go to the open hi-hat row. */
export const DRUM_MAP: Readonly<Record<number, DrumRow>> = {
  35: 'kick',
  36: 'kick',
  38: 'snare',
  40: 'snare',
  42: 'hihat',
  44: 'hihat',
  46: 'openHihat',
  51: 'openHihat',
  53: 'openHihat',
  59: 'openHihat',
  49: 'crash',
  57: 'crash',
};

export interface DrumConversion {
  /** Sorted by start, then row from kick up; two hits of one row at one position are one hit. */
  hits: GridHit[];
  /** The hits that fell onto no row, by General MIDI note number. */
  dropped: Record<number, number>;
  droppedTotal: number;
  /** Hits that landed on a position already taken by the same row. */
  merged: number;
}

/** Converts the notes of the drum tracks (several are merged) to hits on the grid. */
export function convertDrums(notes: readonly MidiNote[], ticksPerQuarter: number, shiftTicks: number): DrumConversion {
  const dropped: Record<number, number> = {};
  let droppedTotal = 0;
  let merged = 0;
  const seen = new Set<string>();
  const hits: GridHit[] = [];
  for (const note of notes) {
    const row = DRUM_MAP[note.pitch];
    if (row === undefined) {
      dropped[note.pitch] = (dropped[note.pitch] ?? 0) + 1;
      droppedTotal += 1;
      continue;
    }
    const start = snapTwelfths(toTwelfths(note.start, ticksPerQuarter, shiftTicks)).position;
    const key = `${start}:${row}`;
    if (seen.has(key)) {
      merged += 1;
      continue;
    }
    seen.add(key);
    hits.push({ start, row });
  }
  hits.sort((a, b) => a.start - b.start || DRUM_ROWS.indexOf(a.row) - DRUM_ROWS.indexOf(b.row));
  return { hits, dropped, droppedTotal, merged };
}
