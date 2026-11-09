/**
 * Snapping notes to the app's grid (docs/midi-import.md, "Time grid"). Pure. A port of snap and
 * quantize in tools/midi-prototype/pipeline.py, plus the overlap, duplicate and 256-bar rules.
 * Positions are in ticks (twelfths of a quarter note).
 */
import { MIN_NOTE_TICKS, TICKS_PER_QUARTER } from '../time';
import type { MidiNote } from './read';
import type { GridHit, GridNote } from './types';

/** Song length limit: at most 256 bars are imported. */
export const MAX_BARS = 256;

/** Start positions inside a beat the app allows, in twelfths. */
const ALLOWED = [0, 2, 3, 4, 6, 8, 9, 10] as const;

/** The nearest allowed position to a position in twelfths (a float). A tie goes to the straight 16th position. */
export function snapTwelfths(position: number): { position: number; error: number } {
  const base = Math.floor(position / TICKS_PER_QUARTER) * TICKS_PER_QUARTER;
  let best = base;
  let bestDistance = Infinity;
  let bestStraight = false;
  for (const beat of [base - TICKS_PER_QUARTER, base, base + TICKS_PER_QUARTER]) {
    for (const offset of ALLOWED) {
      const candidate = beat + offset;
      const distance = Math.abs(position - candidate);
      const straight = offset % 3 === 0;
      if (distance < bestDistance || (distance === bestDistance && straight && !bestStraight)) {
        best = candidate;
        bestDistance = distance;
        bestStraight = straight;
      }
    }
  }
  return { position: best, error: bestDistance };
}

/** Converts file ticks, after the pickup shift, to twelfths. The same arithmetic as the prototype, so the same floats. */
export function toTwelfths(tick: number, ticksPerQuarter: number, shiftTicks: number): number {
  return (tick + shiftTicks) * (TICKS_PER_QUARTER / ticksPerQuarter);
}

export interface NormalizeStats {
  /** Notes of one pitch and one start that were joined into one. */
  merged: number;
  /** Notes that were cut short because the same pitch starts again before they end. */
  shortened: number;
  /** Notes that would have been shorter than the shortest note once cut, and were dropped. */
  dropped: number;
}

/**
 * Applies the same-pitch rules: two notes with one pitch and start become one (the longer stays); a
 * note that is still sounding when the same pitch starts again ends there; if that leaves it
 * shorter than the shortest note it is dropped. The result is sorted by start, then pitch.
 */
export function normalizeNotes(notes: readonly GridNote[]): { notes: GridNote[]; stats: NormalizeStats } {
  const byPitch = new Map<number, GridNote[]>();
  for (const note of notes) {
    const list = byPitch.get(note.pitch);
    if (list) list.push(note);
    else byPitch.set(note.pitch, [note]);
  }
  const stats: NormalizeStats = { merged: 0, shortened: 0, dropped: 0 };
  const out: GridNote[] = [];
  for (const list of byPitch.values()) {
    list.sort((a, b) => a.start - b.start || b.length - a.length);
    const unique: GridNote[] = [];
    for (const note of list) {
      const last = unique[unique.length - 1];
      if (last && last.start === note.start) stats.merged += 1;
      else unique.push(note);
    }
    unique.forEach((note, i) => {
      const next = unique[i + 1];
      if (next && note.start + note.length > next.start) {
        const length = next.start - note.start;
        if (length < MIN_NOTE_TICKS) {
          stats.dropped += 1;
          return;
        }
        stats.shortened += 1;
        out.push({ start: note.start, length, pitch: note.pitch });
        return;
      }
      out.push(note);
    });
  }
  out.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  return { notes: out, stats };
}

export interface QuantizeResult {
  notes: GridNote[];
  stats: NormalizeStats;
  /** The largest distance a note start moved, in twelfths. */
  maxError: number;
}

/** Snaps pitched notes of a file to the grid and applies the same-pitch rules. */
export function quantizeNotes(notes: readonly MidiNote[], ticksPerQuarter: number, shiftTicks: number): QuantizeResult {
  let maxError = 0;
  const snapped: GridNote[] = notes.map((note) => {
    const start = snapTwelfths(toTwelfths(note.start, ticksPerQuarter, shiftTicks));
    const end = snapTwelfths(toTwelfths(note.end, ticksPerQuarter, shiftTicks));
    if (start.error > maxError) maxError = start.error;
    return { start: start.position, length: Math.max(MIN_NOTE_TICKS, end.position - start.position), pitch: note.pitch };
  });
  const { notes: normalized, stats } = normalizeNotes(snapped);
  return { notes: normalized, stats, maxError };
}

/** How many bars hold the notes: from bar 1 to the bar of the last start. 0 when there are none. */
export function barsUsed(lastStart: number | null, barTicks: number): number {
  return lastStart === null ? 0 : Math.floor(lastStart / barTicks) + 1;
}

/** Cuts a lane at the bar limit: notes starting at or after it go, notes crossing it end there. */
export function cutNotesAtBar(notes: readonly GridNote[], barTicks: number, maxBars: number = MAX_BARS): { notes: GridNote[]; cut: number } {
  const limit = barTicks * maxBars;
  const out: GridNote[] = [];
  let cut = 0;
  for (const note of notes) {
    if (note.start >= limit) cut += 1;
    else out.push(note.start + note.length > limit ? { ...note, length: limit - note.start } : note);
  }
  return { notes: out, cut };
}

/** The same cut for drum hits: those at or after the limit go. */
export function cutHitsAtBar(hits: readonly GridHit[], barTicks: number, maxBars: number = MAX_BARS): { hits: GridHit[]; cut: number } {
  const limit = barTicks * maxBars;
  const kept = hits.filter((hit) => hit.start < limit);
  return { hits: kept, cut: hits.length - kept.length };
}
