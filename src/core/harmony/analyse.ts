/**
 * The key of the song, the chords along the Song, and the chord of one pattern. Pure, and fast enough
 * to run after every edit: a full song of 256 bars is about a thousand beats. See docs/harmony.md.
 *
 * What is heard is what counts: the pitched instruments (not the drums), not the muted ones, the
 * sounding pitch of Keys, and only the notes playback plays (inside the pattern, on frets that exist).
 */
import { INSTRUMENT_IDS, INSTRUMENT_KIND, type InstrumentId } from '../instruments';
import { audibleNotes } from '../playback';
import type { Project } from '../project';
import { songBars } from '../song';
import { TICKS_PER_QUARTER, ticksPerBar } from '../time';
import { CHORD_COUNT, KEY_BONUS, bestChord, chordLabel, chordRoot, chordType, normalize, scoreChord, type ChordLabel } from './chords';
import { findKey } from './key';
import { keyName, keyScale, keySpelling, pitchClass, type Key } from './pitch';

/** A pitched note in ticks: from the start of its pattern, or of the song. */
export interface SoundingNote {
  pitch: number;
  start: number;
  end: number;
}

function pitched(project: Project, id: InstrumentId, pattern: number, offset: number): SoundingNote[] {
  const out: SoundingNote[] = [];
  for (const note of audibleNotes(project, id, pattern)) {
    if (note.sound.kind !== 'pitch' || note.lengthTicks <= 0) continue;
    const start = offset + note.tick;
    out.push({ pitch: note.sound.pitch, start, end: start + note.lengthTicks });
  }
  return out;
}

/** Every pitched note the Song plays, each block counted each time it is placed. */
export function songNotes(project: Project): SoundingNote[] {
  const bar = ticksPerBar(project.meter);
  const out: SoundingNote[] = [];
  for (const id of INSTRUMENT_IDS) {
    const instrument = project.instruments[id];
    if (INSTRUMENT_KIND[id] === 'drums' || instrument.muted) continue;
    for (const block of instrument.lane) out.push(...pitched(project, id, block.pattern, block.startBar * bar));
  }
  return out;
}

// ---- One pattern ----

/**
 * The chord of every note in a pattern, weighed by how long each sounds, with the lowest note as the
 * bass. Null for a pattern with no notes to hear. Spelled as the song's key spells, if it has one.
 */
export function patternChord(project: Project, id: InstrumentId, pattern: number, key: Key | null): ChordLabel | null {
  const notes = pitched(project, id, pattern, 0);
  if (notes.length === 0) return null;
  const weights = new Array<number>(12).fill(0);
  let lowest = Infinity;
  for (const note of notes) {
    const pc = pitchClass(note.pitch);
    weights[pc] = at(weights, pc) + note.end - note.start;
    lowest = Math.min(lowest, note.pitch);
  }
  const chord = bestChord(weights, pitchClass(lowest));
  return chord === null ? null : chordLabel(chord, keySpelling(key));
}

// ---- The song ----

/** A chord along the Song, in ticks from the start of the song. */
export interface ChordSpan extends ChordLabel {
  start: number;
  end: number;
}

export interface SongHarmony {
  key: Key | null;
  /** "A minor", or "" when nothing pitched plays. */
  keyName: string;
  /** A key that came close, by name, or "". */
  closeKeyName: string;
  chords: ChordSpan[];
}

/** A number from an array, 0 past its end (the arrays here are sized so that never happens). */
const at = (xs: ArrayLike<number>, i: number): number => xs[i] ?? 0;

const NO_HARMONY: SongHarmony = { key: null, keyName: '', closeKeyName: '', chords: [] };

/** The extra state of the chord search: nothing sounds. It wins only over a long silence. */
const SILENT = CHORD_COUNT;
const STATES = CHORD_COUNT + 1;
/** A beat with no note: a little for "silent", nothing for any chord, so a chord rings on over a short rest. */
const SILENT_IN_REST = 0.1;
/** A beat with notes is never silent. */
const SILENT_IN_NOTES = -1;

/**
 * What changing chord costs at the start of a beat: least on the first beat of a bar, more on the
 * middle of a 4/4 bar, most on any other beat. A passing note does not pay for a change; a real change
 * in the middle of a bar does.
 */
function changeCost(beat: number, beatsPerBar: number): number {
  const inBar = beat % beatsPerBar;
  if (inBar === 0) return 0.1;
  if (beatsPerBar === 4 && inBar === 2) return 0.3;
  return 0.5;
}

/** The weights of each beat by pitch class (the time each note sounds within it), and its lowest pitch. */
function beatWeights(notes: readonly SoundingNote[], beats: number) {
  const weights = new Float64Array(beats * 12);
  const lowest = new Array<number>(beats).fill(Infinity);
  for (const note of notes) {
    const first = Math.max(0, Math.floor(note.start / TICKS_PER_QUARTER));
    const last = Math.min(beats - 1, Math.ceil(note.end / TICKS_PER_QUARTER) - 1);
    for (let beat = first; beat <= last; beat += 1) {
      const overlap = Math.min(note.end, (beat + 1) * TICKS_PER_QUARTER) - Math.max(note.start, beat * TICKS_PER_QUARTER);
      if (overlap <= 0) continue;
      const cell = beat * 12 + pitchClass(note.pitch);
      weights[cell] = at(weights, cell) + overlap;
      lowest[beat] = Math.min(lowest[beat] ?? Infinity, note.pitch);
    }
  }
  return { weights, lowest };
}

/** How every chord scores on every beat, scaled by how much sounds there (a lone short note says little). */
function beatScores(weights: Float64Array, lowest: readonly number[], beats: number): Float32Array {
  const scores = new Float32Array(beats * STATES);
  for (let beat = 0; beat < beats; beat += 1) {
    const row = beat * STATES;
    const w = normalize(weights.subarray(beat * 12, beat * 12 + 12));
    if (!w) {
      scores[row + SILENT] = SILENT_IN_REST;
      continue;
    }
    let total = 0;
    for (let pc = 0; pc < 12; pc += 1) total += at(weights, beat * 12 + pc);
    const confidence = Math.min(1, total / TICKS_PER_QUARTER);
    const low = lowest[beat] ?? Infinity;
    const bass = Number.isFinite(low) ? pitchClass(low) : null;
    for (let id = 0; id < CHORD_COUNT; id += 1) scores[row + id] = confidence * scoreChord(w, bass, id);
    scores[row + SILENT] = SILENT_IN_NOTES;
  }
  return scores;
}

/** The chord of each beat: the path through the beats with the best total score, less the cost of each change. */
function chordPath(scores: Float32Array, beats: number, beatsPerBar: number, bonus: Float32Array | null): Int32Array {
  const emit = (beat: number, state: number) =>
    at(scores, beat * STATES + state) + (bonus && state < CHORD_COUNT && at(scores, beat * STATES + SILENT) < 0 ? at(bonus, state) : 0);
  let previous = new Float64Array(STATES);
  let current = new Float64Array(STATES);
  for (let s = 0; s < STATES; s += 1) previous[s] = emit(0, s);
  const changed = new Uint8Array(beats * STATES);
  const cameFrom = new Int32Array(beats);
  for (let beat = 1; beat < beats; beat += 1) {
    let best = 0;
    for (let s = 1; s < STATES; s += 1) if (at(previous, s) > at(previous, best)) best = s;
    cameFrom[beat] = best;
    const change = at(previous, best) - changeCost(beat, beatsPerBar);
    for (let s = 0; s < STATES; s += 1) {
      if (change > at(previous, s)) {
        current[s] = change + emit(beat, s);
        changed[beat * STATES + s] = 1;
      } else {
        current[s] = at(previous, s) + emit(beat, s);
      }
    }
    [previous, current] = [current, previous];
  }
  const path = new Int32Array(beats);
  let state = 0;
  for (let s = 1; s < STATES; s += 1) if (at(previous, s) > at(previous, state)) state = s;
  for (let beat = beats - 1; beat >= 0; beat -= 1) {
    path[beat] = state;
    if (beat > 0 && changed[beat * STATES + state]) state = at(cameFrom, beat);
  }
  return path;
}

/** Beats with the same chord joined into spans; silent stretches left out. */
function spansOf(path: Int32Array): { id: number; start: number; end: number }[] {
  const out: { id: number; start: number; end: number }[] = [];
  for (let beat = 0; beat < path.length; beat += 1) {
    const id = at(path, beat);
    const last = out[out.length - 1];
    if (last && last.id === id && last.end === beat) last.end = beat + 1;
    else if (id !== SILENT) out.push({ id, start: beat, end: beat + 1 });
  }
  return out;
}

/**
 * The key and the chords of the song. Chords are found first without a key; the key is found from
 * the notes and those chords; then the chords are found again leaning a little towards the key, and
 * spelled as the key spells.
 */
export function analyseSong(project: Project): SongHarmony {
  const notes = songNotes(project);
  if (notes.length === 0) return NO_HARMONY;
  const beatsPerBar = ticksPerBar(project.meter) / TICKS_PER_QUARTER;
  const beats = songBars(project) * beatsPerBar;
  if (beats === 0) return NO_HARMONY;
  const { weights, lowest } = beatWeights(notes, beats);
  const scores = beatScores(weights, lowest, beats);

  const total = new Array<number>(12).fill(0);
  for (let i = 0; i < weights.length; i += 1) total[i % 12] = at(total, i % 12) + at(weights, i);
  const firstPass = spansOf(chordPath(scores, beats, beatsPerBar, null));
  const found = findKey(
    total,
    firstPass.map((span) => ({ root: chordRoot(span.id), family: chordType(span.id).family, length: span.end - span.start })),
  );
  if (!found) return NO_HARMONY;

  const scale = keyScale(found.key);
  const bonus = new Float32Array(CHORD_COUNT);
  for (let id = 0; id < CHORD_COUNT; id += 1) {
    const root = chordRoot(id);
    if (chordType(id).tones.every((tone) => scale.has((root + tone.interval) % 12))) bonus[id] = KEY_BONUS;
  }
  const spelling = keySpelling(found.key);
  const chords = spansOf(chordPath(scores, beats, beatsPerBar, bonus)).map((span) => ({
    ...chordLabel(span.id, spelling),
    start: span.start * TICKS_PER_QUARTER,
    end: span.end * TICKS_PER_QUARTER,
  }));
  return {
    key: found.key,
    keyName: keyName(found.key),
    closeKeyName: found.close ? keyName(found.close) : '',
    chords,
  };
}

// ---- Kept between edits ----

/** What the analysis reads: when none of it changed (a volume knob turned, a pattern selected), the last answer stands. */
function inputsOf(project: Project): unknown[] {
  const parts: unknown[] = [project.meter];
  for (const id of INSTRUMENT_IDS) {
    const i = project.instruments[id];
    parts.push(i.lane, i.patterns, i.muted, i.fretCount, i.transpose);
  }
  return parts;
}

let last: { inputs: unknown[]; harmony: SongHarmony } | null = null;

/** analyseSong, remembered: the Song page and the instrument pages ask for it on every render. */
export function songHarmony(project: Project): SongHarmony {
  const inputs = inputsOf(project);
  if (last && last.inputs.every((part, i) => part === inputs[i])) return last.harmony;
  last = { inputs, harmony: analyseSong(project) };
  return last.harmony;
}
