/**
 * The envelope: what attack, decay and release (each 0 to 100, no units) mean in seconds, and the
 * breakpoints of the gain curve for one note. Decided in plan24 step 4 (docs/sound.md).
 *
 * - Each setting runs 0 to 2 seconds on a squared curve, so small values are fine steps.
 * - 0 for all three leaves the recorded sound as it is (apart from a 20 ms fade at the end of a
 *   note, so that cutting a note short does not click).
 * - Attack is a fade-in from silence. Decay is a fall from full level to half level, which is then
 *   held. With decay 0 the level stays at full. Release is the fade-out after the note ends.
 */
import { LEVEL_MAX, LEVEL_MIN } from './instruments';

export interface EnvelopeSettings {
  attack: number;
  decay: number;
  release: number;
}

export const ENVELOPE_MAX_SECONDS = 2;
/** The level the decay falls to, when decay is above 0. */
export const SUSTAIN_LEVEL = 0.5;
/** The shortest fade-out, so that no note is cut with a click. */
export const MIN_RELEASE_SECONDS = 0.02;

/** A 0 to 100 envelope setting as seconds. */
export function envelopeSeconds(setting: number): number {
  const clamped = Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Number.isFinite(setting) ? setting : 0));
  return (clamped / LEVEL_MAX) ** 2 * ENVELOPE_MAX_SECONDS;
}

export interface EnvelopePoint {
  /** Seconds from the start of the note. */
  time: number;
  gain: number;
}

export interface EnvelopePlan {
  /** Straight ramps between these points; times strictly increase, the first is at 0 and the last has gain 0. */
  points: EnvelopePoint[];
  /** When the note falls silent, in seconds from its start. */
  end: number;
}

/**
 * The gain curve of one note held for `holdSeconds` (from pressing the key to letting go). The
 * release starts from whatever level the note had reached, even if the attack was not finished.
 */
export function planEnvelope(settings: EnvelopeSettings, holdSeconds: number): EnvelopePlan {
  const attack = envelopeSeconds(settings.attack);
  const decay = envelopeSeconds(settings.decay);
  const release = Math.max(MIN_RELEASE_SECONDS, envelopeSeconds(settings.release));
  const hold = Math.max(0, holdSeconds);

  const levelAt = (t: number): number => {
    if (t < attack) return t / attack;
    if (decay > 0 && t < attack + decay) return 1 - (1 - SUSTAIN_LEVEL) * ((t - attack) / decay);
    return decay > 0 ? SUSTAIN_LEVEL : 1;
  };

  const points: EnvelopePoint[] = [{ time: 0, gain: levelAt(0) }];
  const add = (time: number): void => {
    const last = points[points.length - 1];
    if (last && time > last.time) points.push({ time, gain: levelAt(time) });
  };
  if (attack < hold) add(attack);
  if (attack + decay < hold) add(attack + decay);
  add(hold);
  const last = points[points.length - 1];
  const releaseStart = last ? last.time : 0;
  // A note of zero length: the key goes up at once, from the level at time 0.
  const releaseFrom = Math.max(releaseStart, hold);
  if (releaseFrom > releaseStart) points.push({ time: releaseFrom, gain: levelAt(releaseFrom) });
  points.push({ time: releaseFrom + release, gain: 0 });
  return { points, end: releaseFrom + release };
}
