/**
 * Naming a chord from how long each note name sounds. Every set of notes gets a name (the user's
 * answer, 2026-11-09: "It's always a chord. It always has a name."): one note is named by its letter,
 * two notes a fifth apart are a power chord, a melody gets the chord it fits best. See docs/harmony.md.
 */
import { noteName, pitchClass, type Spelling } from './pitch';

/** A chord tone: its distance from the root in semitones, and how much leaving it out costs. */
interface Tone {
  interval: number;
  /** 1 for the root; less for a tone a chord may lack (the fifth costs little). */
  need: number;
}

/** Which tonic chord a type can stand for when the key is judged. */
export type Family = 'major' | 'minor' | 'either' | 'none';

export interface ChordType {
  /** What follows the root in the chord symbol: "" for major, "m7" and so on. */
  symbol: string;
  /** In words, for the tooltip. */
  name: string;
  tones: readonly Tone[];
  family: Family;
}

const t = (interval: number, need: number): Tone => ({ interval, need });
const ROOT = t(0, 1);
const MAJ3 = t(4, 0.5);
const MIN3 = t(3, 0.5);
const FIFTH = t(7, 0.15);
/** A tone that makes the chord what it is (a sixth, a seventh, an added note): it must be there to be named. */
const ADDED = 0.6;

/**
 * The chord types, simplest first within a kind. Where two types hold the same notes (Am7 and C6),
 * the bass note decides, and failing that the one listed first.
 */
const MAJOR: ChordType = { symbol: '', name: 'major', tones: [ROOT, MAJ3, FIFTH], family: 'major' };

export const CHORD_TYPES: readonly ChordType[] = [
  MAJOR,
  { symbol: 'm', name: 'minor', tones: [ROOT, MIN3, FIFTH], family: 'minor' },
  { symbol: '5', name: 'power chord', tones: [ROOT, t(7, 0.5)], family: 'either' },
  { symbol: 'sus4', name: 'suspended fourth', tones: [ROOT, t(5, 0.5), FIFTH], family: 'none' },
  { symbol: 'sus2', name: 'suspended second', tones: [ROOT, t(2, 0.5), FIFTH], family: 'none' },
  { symbol: 'dim', name: 'diminished', tones: [ROOT, MIN3, t(6, 0.5)], family: 'none' },
  { symbol: 'aug', name: 'augmented', tones: [ROOT, MAJ3, t(8, 0.5)], family: 'none' },
  { symbol: '7', name: 'dominant seventh', tones: [ROOT, MAJ3, FIFTH, t(10, ADDED)], family: 'none' },
  { symbol: 'm7', name: 'minor seventh', tones: [ROOT, MIN3, FIFTH, t(10, ADDED)], family: 'minor' },
  { symbol: 'maj7', name: 'major seventh', tones: [ROOT, MAJ3, FIFTH, t(11, ADDED)], family: 'major' },
  { symbol: 'm7♭5', name: 'half-diminished seventh', tones: [ROOT, MIN3, t(6, 0.5), t(10, ADDED)], family: 'none' },
  { symbol: 'dim7', name: 'diminished seventh', tones: [ROOT, MIN3, t(6, 0.5), t(9, ADDED)], family: 'none' },
  { symbol: 'm(maj7)', name: 'minor major seventh', tones: [ROOT, MIN3, FIFTH, t(11, ADDED)], family: 'minor' },
  { symbol: '7sus4', name: 'seventh suspended fourth', tones: [ROOT, t(5, 0.5), FIFTH, t(10, ADDED)], family: 'none' },
  { symbol: '6', name: 'major sixth', tones: [ROOT, MAJ3, FIFTH, t(9, ADDED)], family: 'major' },
  { symbol: 'm6', name: 'minor sixth', tones: [ROOT, MIN3, FIFTH, t(9, ADDED)], family: 'minor' },
  { symbol: 'add9', name: 'added ninth', tones: [ROOT, MAJ3, FIFTH, t(2, ADDED)], family: 'major' },
  { symbol: 'm(add9)', name: 'minor added ninth', tones: [ROOT, MIN3, FIFTH, t(2, ADDED)], family: 'minor' },
  { symbol: '9', name: 'dominant ninth', tones: [ROOT, MAJ3, FIFTH, t(10, ADDED), t(2, ADDED)], family: 'none' },
  { symbol: 'maj9', name: 'major ninth', tones: [ROOT, MAJ3, FIFTH, t(11, ADDED), t(2, ADDED)], family: 'major' },
  { symbol: 'm9', name: 'minor ninth', tones: [ROOT, MIN3, FIFTH, t(10, ADDED), t(2, ADDED)], family: 'minor' },
  { symbol: '6/9', name: 'six-nine', tones: [ROOT, MAJ3, FIFTH, t(9, ADDED), t(2, ADDED)], family: 'major' },
  { symbol: '11', name: 'eleventh', tones: [ROOT, FIFTH, t(10, ADDED), t(2, ADDED), t(5, ADDED)], family: 'none' },
  { symbol: 'm11', name: 'minor eleventh', tones: [ROOT, MIN3, FIFTH, t(10, ADDED), t(2, ADDED), t(5, ADDED)], family: 'minor' },
  { symbol: '13', name: 'thirteenth', tones: [ROOT, MAJ3, FIFTH, t(10, ADDED), t(2, ADDED), t(9, ADDED)], family: 'none' },
  { symbol: 'maj13', name: 'major thirteenth', tones: [ROOT, MAJ3, FIFTH, t(11, ADDED), t(2, ADDED), t(9, ADDED)], family: 'major' },
  { symbol: '', name: 'single note', tones: [ROOT], family: 'either' },
];

/** How many (root, type) pairs there are: the states the song's chord search moves between. */
export const CHORD_COUNT = 12 * CHORD_TYPES.length;

/** A chord as a number, root * CHORD_TYPES.length + type, so scores fit in flat arrays. */
export type ChordId = number;

export const chordRoot = (id: ChordId): number => Math.floor(id / CHORD_TYPES.length);
export const chordType = (id: ChordId): ChordType => CHORD_TYPES[id % CHORD_TYPES.length] ?? MAJOR;

// ---- Scoring ----

/** Each part of the score, tuned by hand on the cases in harmony.test.ts. */
const OUTSIDE_COST = 1; // per unit of weight on notes outside the chord
const MISSING_COST = 1; // times a missing tone's need
const BASS_BONUS = 0.08; // when the lowest note is the root
const EXTRA_TONE_COST = 0.03; // per tone past three, so a near-tie goes to the simpler chord
export const KEY_BONUS = 0.04; // when every tone of the chord is in the song's key

/**
 * How well a chord fits note weights that add up to 1 (12 of them, by pitch class). A tone counts as
 * fully there once it holds half of its fair share of the weight, and partly below that.
 */
export function scoreChord(weights: ArrayLike<number>, bass: number | null, id: ChordId, scale?: ReadonlySet<number>): number {
  const root = chordRoot(id);
  const type = chordType(id);
  const fair = 0.5 / type.tones.length;
  let inside = 0;
  let missing = 0;
  let inKey = true;
  for (const tone of type.tones) {
    const pc = (root + tone.interval) % 12;
    const w = weights[pc] ?? 0;
    inside += w;
    if (w < fair) missing += tone.need * (1 - w / fair);
    if (scale && !scale.has(pc)) inKey = false;
  }
  let score = inside - OUTSIDE_COST * (1 - inside) - MISSING_COST * missing - EXTRA_TONE_COST * Math.max(0, type.tones.length - 3);
  if (bass === root) score += BASS_BONUS;
  if (scale && inKey) score += KEY_BONUS;
  return score;
}

/** Weights by pitch class made to add up to 1, or null when nothing sounds. */
export function normalize(weights: ArrayLike<number>): number[] | null {
  let total = 0;
  for (let pc = 0; pc < 12; pc += 1) total += weights[pc] ?? 0;
  if (!(total > 0)) return null;
  return Array.from({ length: 12 }, (_, pc) => (weights[pc] ?? 0) / total);
}

/** The best chord for weights by pitch class (any scale; they are normalized here), or null when nothing sounds. */
export function bestChord(weights: ArrayLike<number>, bass: number | null, scale?: ReadonlySet<number>): ChordId | null {
  const w = normalize(weights);
  if (!w) return null;
  let best = 0;
  let bestScore = -Infinity;
  for (let id = 0; id < CHORD_COUNT; id += 1) {
    const score = scoreChord(w, bass, id, scale);
    if (score > bestScore + 1e-9) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

// ---- Names ----

export interface ChordLabel {
  /** "C♯m", "A♭", "Am7". */
  symbol: string;
  /** "C♯ minor", "A♭ single note". */
  name: string;
  /** The chord's notes, root first: "A C E G". */
  tones: string;
  root: number;
  family: Family;
}

export function chordLabel(id: ChordId, spelling: Spelling): ChordLabel {
  const root = chordRoot(id);
  const type = chordType(id);
  const rootName = noteName(root, spelling);
  return {
    symbol: `${rootName}${type.symbol}`,
    name: `${rootName} ${type.name}`,
    tones: type.tones.map((tone) => noteName(pitchClass(root + tone.interval), spelling)).join(' '),
    root,
    family: type.family,
  };
}
