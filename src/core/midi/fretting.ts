/**
 * Strings and frets for the MIDI importer (docs/midi-import.md, "Strings and frets"). Pure. A port of
 * tools/midi-prototype/fretting.py with the same weights and the same order of arithmetic, so the same
 * floats come out and the same fingering is chosen: chord grouping, the cheapest 24 arrangements per
 * chord, Viterbi over the chords with a per-survivor ringing check, and the choice of fret count.
 * Positions and lengths are in twelfths of a quarter note (see types.ts).
 */
import { FRET_COUNTS } from '../instruments';
import { foldPitch } from './range';
import type { GridNote } from './types';

/** How many arrangements are kept per chord. */
export const KEPT_ARRANGEMENTS = 24;

/** One note placed on the strings: `string` indexes the tuning, lowest string first. */
export interface Placement {
  string: number;
  fret: number;
}

export interface FingeredNote {
  start: number;
  length: number;
  string: number;
  fret: number;
}

/** The figures the report and the fret count choice need. Same meaning as `metrics` in the prototype. */
export interface FingerMetrics {
  /** Notes placed. */
  notes: number;
  /** Chords (distinct starts). */
  groups: number;
  /** Share of notes on an open string. */
  openShare: number;
  /** Share of notes above fret 7. */
  highShare: number;
  /** Chords with two notes on one string. */
  sharedStringChords: number;
  /** Chords whose fretted notes span more than 4 frets. */
  wideChords: number;
  /** Average change of hand position between chords that start within a beat of each other. */
  handMove: number;
  /** Notes that start on a string that is still ringing. */
  ringingClashes: number;
}

export interface FingerResult {
  notes: FingeredNote[];
  /** Input notes that had to be moved by an octave to fit this fret count. */
  folded: number;
  metrics: FingerMetrics;
}

type Arrangement = readonly Placement[];
interface Scored {
  cost: number;
  arrangement: Arrangement;
}

/** The (string, fret) ways to play a pitch. */
function options(pitch: number, tuning: readonly number[], fretCount: number): Placement[] {
  const out: Placement[] = [];
  tuning.forEach((open, string) => {
    const fret = pitch - open;
    if (fret >= 0 && fret <= fretCount) out.push({ string, fret });
  });
  return out;
}

/** The cost of one arrangement of one chord: the group cost table of the document. */
function localCost(arrangement: Arrangement): number {
  const frets = arrangement.filter((p) => p.fret > 0).map((p) => p.fret);
  const strings = arrangement.map((p) => p.string).sort((a, b) => a - b);
  const distinct = new Set(strings).size;
  let cost = 0;
  if (frets.length >= 2) {
    const span = Math.max(...frets) - Math.min(...frets);
    cost += 2.0 * Math.max(0, span - 3) + 8.0 * Math.max(0, span - 4);
  }
  if (frets.length > 0) cost += 0.15 * (frets.reduce((a, b) => a + b, 0) / frets.length);
  if (arrangement.length >= 3) cost += 0.4 * ((strings[strings.length - 1]! - strings[0]! + 1) - distinct);
  cost += 40.0 * (strings.length - distinct);
  return cost;
}

/** Above this many combinations, a chord that cannot take distinct strings is searched with a beam instead. */
const PRODUCT_LIMIT = 20000;
const BEAM_WIDTH = 200;

/** Every combination with one option per note, when no distinct-strings arrangement exists. */
function sharedStringCombos(per: readonly Placement[][]): Placement[][] {
  let size = 1;
  for (const list of per) size *= list.length;
  if (size <= PRODUCT_LIMIT) {
    let combos: Placement[][] = [[]];
    for (const list of per) combos = combos.flatMap((combo) => list.map((option) => [...combo, option]));
    return combos;
  }
  // Too many to list (a very wide chord): keep the partial combinations with the fewest shared strings, then the lowest frets.
  const rank = (combo: readonly Placement[]): number => {
    const distinct = new Set(combo.map((p) => p.string)).size;
    return (combo.length - distinct) * 1000 + combo.reduce((a, p) => a + p.fret, 0);
  };
  let beam: Placement[][] = [[]];
  for (const list of per) {
    const next = beam.flatMap((combo) => list.map((option) => [...combo, option]));
    next.sort((a, b) => rank(a) - rank(b));
    beam = next.slice(0, BEAM_WIDTH);
  }
  return beam;
}

const cache = new Map<string, Scored[]>();
const CACHE_LIMIT = 20000;

/**
 * The cheapest arrangements of one chord (`pitches` low to high): each note on its own string if that is
 * possible at all, else strings may be shared. Sorted by cost, ties in the order they were generated.
 */
export function chordArrangements(pitches: readonly number[], tuning: readonly number[], fretCount: number): Scored[] {
  const key = `${tuning.join(',')}|${fretCount}|${pitches.join(',')}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const per = pitches.map((p) => options(p, tuning, fretCount));
  if (per.some((list) => list.length === 0)) throw new Error(`No string can play pitch ${pitches[per.findIndex((l) => l.length === 0)]}`);

  let out: Placement[][] = [];
  const used = new Set<number>();
  const current: Placement[] = [];
  const recurse = (i: number): void => {
    if (i === per.length) {
      out.push([...current]);
      return;
    }
    for (const option of per[i]!) {
      if (used.has(option.string)) continue;
      current.push(option);
      used.add(option.string);
      recurse(i + 1);
      used.delete(option.string);
      current.pop();
    }
  };
  recurse(0);
  if (out.length === 0) out = sharedStringCombos(per);

  const scored = out.map((arrangement) => ({ cost: localCost(arrangement), arrangement }));
  scored.sort((a, b) => a.cost - b.cost);
  const kept = scored.slice(0, KEPT_ARRANGEMENTS);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, kept);
  return kept;
}

/** The average fret of the fretted notes, or the previous position when the chord is all open strings. */
function handPosition(arrangement: Arrangement, previous: number | null): number | null {
  let sum = 0;
  let count = 0;
  for (const p of arrangement) {
    if (p.fret > 0) {
      sum += p.fret;
      count += 1;
    }
  }
  return count > 0 ? sum / count : previous;
}

interface Chord {
  start: number;
  pitches: number[];
  lengths: number[];
}

interface Survivor {
  cost: number;
  position: number | null;
  /** String -> the twelfth at which it stops ringing, for the best path into this arrangement. */
  ringing: Map<number, number>;
  back: number | null;
  arrangement: Arrangement;
}

/** Groups notes by start; inside a chord a repeated pitch keeps its longest length, and pitches run low to high. */
function groupChords(notes: readonly GridNote[], tuning: readonly number[], fretCount: number): { chords: Chord[]; folded: number } {
  const range = { low: tuning[0]!, high: tuning[tuning.length - 1]! + fretCount };
  let folded = 0;
  const byStart = new Map<number, Map<number, number>>();
  for (const note of notes) {
    const result = foldPitch(note.pitch, range);
    if (result.octaves > 0) folded += 1;
    let chord = byStart.get(note.start);
    if (!chord) {
      chord = new Map();
      byStart.set(note.start, chord);
    }
    chord.set(result.pitch, Math.max(chord.get(result.pitch) ?? 0, note.length));
  }
  const chords = [...byStart.keys()]
    .sort((a, b) => a - b)
    .map((start) => {
      const entries = [...byStart.get(start)!.entries()].sort((a, b) => a[0] - b[0]);
      return { start, pitches: entries.map((e) => e[0]), lengths: entries.map((e) => e[1]) };
    });
  return { chords, folded };
}

/** Weight of the move between two chords: 1 within a beat, then falling to a floor of 0.25. */
function gapFactor(gap: number): number {
  return gap <= 12 ? 1.0 : Math.max(0.25, 1.0 / (1 + (gap - 12) / 24.0));
}

const mean = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0) / values.length;

/**
 * Gives every note a string and a fret. Notes outside the range of the fret count are first moved by
 * octaves. The chords are searched with Viterbi; the result lists the notes chord by chord, low pitch first.
 */
export function fingerTrack(notes: readonly GridNote[], tuning: readonly number[], fretCount: number): FingerResult {
  const { chords, folded } = groupChords(notes, tuning, fretCount);
  const layers: Survivor[][] = [];
  let previous: Survivor[] | null = null;

  chords.forEach((chord, gi) => {
    const s = chord.start;
    const layer: Survivor[] = [];
    for (const { cost: local, arrangement } of chordArrangements(chord.pitches, tuning, fretCount)) {
      if (previous === null) {
        layer.push({ cost: local, position: handPosition(arrangement, null), ringing: new Map(), back: null, arrangement });
        continue;
      }
      const fac = gapFactor(s - chords[gi - 1]!.start);
      const frettedNow = arrangement.filter((p) => p.fret > 0).map((p) => p.fret);
      const nowPosition = frettedNow.length > 0 ? mean(frettedNow) : null;
      const nowString = mean(arrangement.map((p) => p.string));
      let bestCost = 0;
      let bestIndex = -1;
      previous.forEach((from, pi) => {
        let total = from.cost + local;
        if (nowPosition !== null && from.position !== null) total += fac * Math.abs(nowPosition - from.position);
        total += 0.35 * Math.abs(nowString - mean(from.arrangement.map((p) => p.string))) * fac;
        for (const p of arrangement) {
          const end = from.ringing.get(p.string);
          if (end !== undefined && end > s) total += 12.0;
        }
        if (bestIndex < 0 || total < bestCost) {
          bestCost = total;
          bestIndex = pi;
        }
      });
      const from = previous[bestIndex]!;
      const ringing = new Map<number, number>();
      for (const [string, end] of from.ringing) if (end > s) ringing.set(string, end);
      layer.push({ cost: bestCost, position: handPosition(arrangement, from.position), ringing, back: bestIndex, arrangement });
    }
    // this chord's own notes ring from now on (an arrangement follows the pitch order of the chord)
    for (const survivor of layer) {
      survivor.arrangement.forEach((p, k) => {
        const end = s + chord.lengths[k]!;
        survivor.ringing.set(p.string, Math.max(survivor.ringing.get(p.string) ?? 0, end));
      });
    }
    layers.push(layer);
    previous = layer;
  });

  const result: FingeredNote[] = [];
  if (layers.length > 0) {
    const last = layers[layers.length - 1]!;
    let j = 0;
    last.forEach((survivor, i) => {
      if (survivor.cost < last[j]!.cost) j = i;
    });
    const chosen: Arrangement[] = new Array<Arrangement>(layers.length);
    for (let gi = layers.length - 1; gi >= 0; gi -= 1) {
      const survivor = layers[gi]![j]!;
      chosen[gi] = survivor.arrangement;
      j = survivor.back ?? 0;
    }
    chords.forEach((chord, gi) => {
      chosen[gi]!.forEach((p, k) => {
        result.push({ start: chord.start, length: chord.lengths[k]!, string: p.string, fret: p.fret });
      });
    });
  }
  return { notes: result, folded, metrics: measureFingering(result) };
}

/** The figures of a fingering (the prototype's `metrics`). */
export function measureFingering(placed: readonly FingeredNote[]): FingerMetrics {
  const byStart = new Map<number, FingeredNote[]>();
  for (const note of placed) {
    const list = byStart.get(note.start);
    if (list) list.push(note);
    else byStart.set(note.start, [note]);
  }
  const starts = [...byStart.keys()].sort((a, b) => a - b);
  let sharedStringChords = 0;
  let wideChords = 0;
  let moved = 0;
  let moves = 0;
  let lastPosition: number | null = null;
  let lastStart = 0;
  let ringingClashes = 0;
  const ringing = new Map<number, number>();
  for (const s of starts) {
    const chord = byStart.get(s)!;
    if (new Set(chord.map((n) => n.string)).size < chord.length) sharedStringChords += 1;
    const frets = chord.filter((n) => n.fret > 0).map((n) => n.fret);
    if (frets.length >= 2 && Math.max(...frets) - Math.min(...frets) > 4) wideChords += 1;
    if (frets.length > 0) {
      const position = mean(frets);
      if (lastPosition !== null && s - lastStart <= 12) {
        moved += Math.abs(position - lastPosition);
        moves += 1;
      }
      lastPosition = position;
      lastStart = s;
    }
    for (const n of chord) if ((ringing.get(n.string) ?? 0) > s) ringingClashes += 1;
    for (const n of chord) ringing.set(n.string, Math.max(ringing.get(n.string) ?? 0, s + n.length));
  }
  const count = placed.length;
  return {
    notes: count,
    groups: starts.length,
    openShare: count === 0 ? 0 : placed.filter((n) => n.fret === 0).length / count,
    highShare: count === 0 ? 0 : placed.filter((n) => n.fret > 7).length / count,
    sharedStringChords,
    wideChords,
    handMove: moved / Math.max(1, moves),
    ringingClashes,
  };
}

/** What a fret count costs: 3 per note moved an octave, 2 per chord with two notes on one string, 1 per ringing clash. */
export function fretCountPenalty(result: FingerResult): number {
  return 3 * result.folded + 2 * result.metrics.sharedStringChords + result.metrics.ringingClashes;
}

export interface FretCountChoice {
  fretCount: number;
  /** The penalty at each fret count tried. */
  penalties: Record<number, number>;
  /** The fingering at the chosen count, so a caller need not run it again. */
  result: FingerResult;
}

/**
 * Runs the search at 5, 7 and 12 frets and takes the smallest count whose penalty is within
 * `max(1, 0.2% of the notes)` of the best.
 */
export function chooseFretCount(notes: readonly GridNote[], tuning: readonly number[]): FretCountChoice {
  const runs = FRET_COUNTS.map((fretCount) => {
    const result = fingerTrack(notes, tuning, fretCount);
    return { fretCount: fretCount as number, result, penalty: fretCountPenalty(result) };
  });
  const tolerance = Math.max(1, 0.002 * notes.length);
  const best = Math.min(...runs.map((r) => r.penalty));
  const chosen = runs.find((r) => r.penalty <= best + tolerance) ?? runs[runs.length - 1]!;
  return {
    fretCount: chosen.fretCount,
    penalties: Object.fromEntries(runs.map((r) => [r.fretCount, r.penalty])),
    result: chosen.result,
  };
}
