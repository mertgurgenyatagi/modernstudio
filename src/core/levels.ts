/**
 * What the 0 to 100 volume numbers mean, and how a measured level becomes a meter reading.
 * Volume and master volume are shown as 0 to 100 with no units (docs/page-designs.md); the audio
 * engine turns them into a gain here. Pure, so it is tested without a window.
 */
import { LEVEL_MAX, LEVEL_MIN, type InstrumentId } from './instruments';
import type { Project } from './project';

/**
 * Volume 0 to 100 as a gain from 0 to 1. A squared curve, so that the lower half of the slider is
 * not the loudest half of the range to the ear. 100 plays the recorded sample at its recorded level.
 */
export function levelToGain(level: number): number {
  const clamped = Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Number.isFinite(level) ? level : 0));
  return (clamped / LEVEL_MAX) ** 2;
}

/**
 * The gain an instrument plays at, mute and isolate included. Isolate mutes every other instrument.
 * An instrument that is both muted and isolated stays muted: isolate only silences the others.
 */
export function instrumentGain(project: Project, isolated: InstrumentId | null, id: InstrumentId): number {
  const instrument = project.instruments[id];
  if (instrument.muted) return 0;
  if (isolated !== null && isolated !== id) return 0;
  return levelToGain(instrument.volume);
}

/** The floor of the level meter, in dB. Anything quieter reads as empty. */
export const METER_FLOOR_DB = -60;

/** A peak sample value (0 to 1) as a meter reading from 0 (empty) to 1 (full scale), on a dB scale. */
export function peakToMeter(peak: number): number {
  if (!(peak > 0)) return 0;
  const db = 20 * Math.log10(peak);
  return Math.min(1, Math.max(0, (db - METER_FLOOR_DB) / -METER_FLOOR_DB));
}

/** How fast the meter falls: full scale to empty in 0.4 seconds. */
export const METER_FALL_PER_SECOND = 2.5;

/** A meter that rises at once and falls slowly. `dt` is the seconds since the previous reading. */
export function smoothMeter(previous: number, reading: number, dt: number): number {
  if (reading >= previous) return reading;
  return Math.max(reading, previous - Math.max(0, dt) * METER_FALL_PER_SECOND);
}
