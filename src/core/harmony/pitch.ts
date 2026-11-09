/**
 * Note names, keys and how they are spelled. A pitch class is 0 to 11, C = 0. See docs/harmony.md.
 */

export type Mode = 'major' | 'minor';

export interface Key {
  /** The pitch class of the home note. */
  tonic: number;
  mode: Mode;
}

/** Sharps, flats, or the common mix (C♯, E♭, F♯, A♭, B♭) used where a key has neither, and with no key. */
export type Spelling = 'sharps' | 'flats' | 'common';

const NAMES: Record<Spelling, readonly string[]> = {
  sharps: ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'],
  flats: ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'],
  common: ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'],
};

/** The pitch class of a MIDI pitch, or of any whole number of semitones. */
export function pitchClass(pitch: number): number {
  return ((Math.round(pitch) % 12) + 12) % 12;
}

export function noteName(pc: number, spelling: Spelling = 'common'): string {
  return NAMES[spelling][pitchClass(pc)] ?? '';
}

/** Major keys written with flats (F, B♭, E♭, A♭, D♭) and with sharps (G, D, A, E, B, F♯), by tonic. */
const FLAT_MAJORS: ReadonlySet<number> = new Set([5, 10, 3, 8, 1]);
const SHARP_MAJORS: ReadonlySet<number> = new Set([7, 2, 9, 4, 11, 6]);

/**
 * How a key spells its notes: the way with fewer accidentals, so D♭ major rather than C♯ major. A minor
 * key spells as its relative major, except that E♭ minor is preferred to D♯ minor.
 */
export function keySpelling(key: Key | null): Spelling {
  if (!key) return 'common';
  if (key.mode === 'minor' && key.tonic === 3) return 'flats';
  const major = key.mode === 'major' ? key.tonic : pitchClass(key.tonic + 3);
  if (FLAT_MAJORS.has(major)) return 'flats';
  if (SHARP_MAJORS.has(major)) return 'sharps';
  return 'common';
}

/** "A minor", "D♭ major". */
export function keyName(key: Key): string {
  return `${noteName(key.tonic, keySpelling(key))} ${key.mode}`;
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
/** Natural minor with the raised seventh as well, so the major V chord of a minor key counts as in the key. */
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10, 11];

/** The pitch classes that belong to a key. */
export function keyScale(key: Key): ReadonlySet<number> {
  const steps = key.mode === 'major' ? MAJOR_SCALE : MINOR_SCALE;
  return new Set(steps.map((step) => pitchClass(key.tonic + step)));
}
