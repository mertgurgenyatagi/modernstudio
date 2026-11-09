/**
 * Shared types of the MIDI importer (docs/midi-import.md). Positions and lengths are in the app's ticks
 * (twelfths of a quarter note, see time.ts); pitches are MIDI note numbers (C4 = 60).
 */
import type { DrumRow } from '../instruments';

/** A refusal is a value with a message the app can show, never an exception. */
export type Result<T> = { ok: true; value: T } | { ok: false; reason: string };

export function succeed<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function refuse<T = never>(reason: string): Result<T> {
  return { ok: false, reason };
}

/** A pitched note on the importer's grid. */
export interface GridNote {
  /** Twelfths from the start of bar 1 (after the pickup shift). */
  start: number;
  /** At least 2 twelfths. */
  length: number;
  pitch: number;
}

/** A drum hit on the importer's grid. Hits have no length. */
export interface GridHit {
  start: number;
  row: DrumRow;
}
