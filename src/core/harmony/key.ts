/**
 * Finding the song's key: how long each note name sounds, compared with the profile of every major and
 * minor key (the Krumhansl method, with the profiles Albrecht and Shanahan drew from a corpus in
 * 2013), then nudged towards the key whose home chord the song dwells on, starts on and ends on. That
 * nudge is what tells C major from A minor, which share their notes. See docs/harmony.md.
 */
import type { Family } from './chords';
import type { Key, Mode } from './pitch';

/** The weight of each scale step in the key, from its tonic up. */
const PROFILES: Record<Mode, readonly number[]> = {
  major: [0.238, 0.006, 0.111, 0.006, 0.137, 0.094, 0.016, 0.214, 0.009, 0.08, 0.008, 0.081],
  minor: [0.22, 0.006, 0.104, 0.123, 0.019, 0.103, 0.012, 0.214, 0.062, 0.022, 0.061, 0.052],
};

/** How much the home chord counts beside the note profile. */
const DWELL_WEIGHT = 0.2; // times the share of the song's chord time spent on the home chord
const EDGE_WEIGHT = 0.05; // for starting on the home chord, and again for ending on it
/** Within this of the winner, the next key is named in the tooltip as close. */
const CLOSE = 0.05;

/** A chord of the song as the key finder needs it. */
export interface KeyChord {
  root: number;
  family: Family;
  /** In ticks. */
  length: number;
}

export interface KeyResult {
  key: Key;
  /** A key that came close, or null. */
  close: Key | null;
}

function correlation(a: readonly number[], b: readonly number[]): number {
  const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = (a[i] ?? 0) - ma;
    const y = (b[i] ?? 0) - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

const isHome = (chord: KeyChord, key: Key) =>
  chord.root === key.tonic && (chord.family === 'either' || chord.family === key.mode);

/**
 * The key for weights by pitch class (how long each sounds) and the song's chords in order. Null when
 * nothing sounds.
 */
export function findKey(weights: readonly number[], chords: readonly KeyChord[]): KeyResult | null {
  if (!weights.some((w) => w > 0)) return null;
  const chordTime = chords.reduce((s, c) => s + c.length, 0);
  const scored: { key: Key; score: number }[] = [];
  for (const mode of ['major', 'minor'] as const) {
    for (let tonic = 0; tonic < 12; tonic += 1) {
      const key: Key = { tonic, mode };
      const profile = Array.from({ length: 12 }, (_, pc) => PROFILES[mode][(pc - tonic + 12) % 12] ?? 0);
      let score = correlation(weights, profile);
      if (chordTime > 0) {
        const dwell = chords.reduce((s, c) => s + (isHome(c, key) ? c.length : 0), 0) / chordTime;
        score += DWELL_WEIGHT * dwell;
        const opening = chords[0];
        const closing = chords[chords.length - 1];
        if (opening && isHome(opening, key)) score += EDGE_WEIGHT;
        if (closing && isHome(closing, key)) score += EDGE_WEIGHT;
      }
      scored.push({ key, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const [first, second] = scored;
  if (!first) return null;
  return { key: first.key, close: second && first.score - second.score < CLOSE ? second.key : null };
}
