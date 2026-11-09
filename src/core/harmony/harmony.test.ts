import { describe, expect, it } from 'vitest';
import { createProject, setMuted, updatePattern, type KeysNote, type Project, type StringNote } from '../project';
import { placeBlock } from '../song';
import { must } from '../testing';
import { TICKS_PER_QUARTER } from '../time';
import { analyseSong, patternChord } from './analyse';
import { bestChord, chordLabel } from './chords';
import { keyName } from './pitch';

const Q = TICKS_PER_QUARTER;
const BAR = 4 * Q;
const [C, Cs, D, Eb, E, F, Fs, G, Ab, A, Bb, B] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** The symbol for notes given as [pitch class, weight], with the bass note. */
function chordOf(notes: [number, number][], bass: number | null = null): string {
  const weights = new Array<number>(12).fill(0);
  for (const [pc, w] of notes) weights[pc] = (weights[pc] ?? 0) + w;
  const id = bestChord(weights, bass ?? notes[0]?.[0] ?? null);
  return id === null ? '' : chordLabel(id, 'common').symbol;
}

const even = (...pcs: number[]): [number, number][] => pcs.map((pc) => [pc, 1]);

describe('naming a chord', () => {
  it('names triads, power chords and single notes', () => {
    expect(chordOf(even(C, E, G))).toBe('C');
    expect(chordOf(even(A, C, E))).toBe('Am');
    expect(chordOf(even(B, D, F))).toBe('Bdim');
    expect(chordOf(even(E, B))).toBe('E5');
    expect(chordOf(even(E))).toBe('E');
    expect(chordOf(even(C, E))).toBe('C');
    expect(chordOf(even(E, G))).toBe('Em');
    expect(chordOf(even(D, G, A))).toBe('Dsus4');
  });

  it('names sevenths, and lets the bass tell Am7 from C6', () => {
    expect(chordOf(even(C, E, G, Bb))).toBe('C7');
    expect(chordOf(even(F, A, C, E))).toBe('Fmaj7');
    expect(chordOf(even(A, C, E, G), A)).toBe('Am7');
    expect(chordOf(even(C, E, G, A), C)).toBe('C6');
    expect(chordOf(even(B, D, F, A))).toBe('Bm7♭5');
  });

  it('ignores a short passing note, and names a whole scale as some chord', () => {
    expect(chordOf([...even(C, E, G), [D, 0.15]])).toBe('C');
    expect(chordOf(even(C, D, E, F, G, A, B))).not.toBe('');
  });
});

describe('spelling a key', () => {
  it('uses the spelling with fewer accidentals', () => {
    expect(keyName({ tonic: Cs, mode: 'major' })).toBe('D♭ major');
    expect(keyName({ tonic: Ab, mode: 'minor' })).toBe('G♯ minor');
    expect(keyName({ tonic: Fs, mode: 'major' })).toBe('F♯ major');
    expect(keyName({ tonic: Eb, mode: 'minor' })).toBe('E♭ minor');
    expect(keyName({ tonic: Bb, mode: 'minor' })).toBe('B♭ minor');
  });
});

// ---- Songs on Keys: one pattern per bar, each a list of [pitch, start, length] ----

type Hit = [pitch: number, start: number, length: number];
const held = (pitches: number[], start = 0, length = BAR): Hit[] => pitches.map((p) => [p, start, length]);

function song(bars: Hit[][], project: Project = createProject()): Project {
  let p = project;
  bars.forEach((hits, bar) => {
    p = updatePattern(p, 'keys', bar, (pattern) => ({ ...pattern, notes: hits.map(([pitch, start, length]): KeysNote => ({ pitch, start, length })) }));
    p = must(placeBlock(p, 'keys', bar, bar));
  });
  return p;
}

const chordsOf = (project: Project) => analyseSong(project).chords.map((c) => [c.symbol, c.start / Q, c.end / Q]);

describe('the song', () => {
  it('finds C major and its chords in I IV V I', () => {
    const harmony = analyseSong(song([held([48, 52, 55, 60]), held([41, 53, 57, 60]), held([43, 55, 59, 62]), held([48, 52, 55, 60])]));
    expect(harmony.keyName).toBe('C major');
    expect(harmony.chords.map((c) => c.symbol)).toEqual(['C', 'F', 'G', 'C']);
    expect(harmony.chords.map((c) => c.start)).toEqual([0, BAR, 2 * BAR, 3 * BAR]);
  });

  it('finds A minor in i iv V i, which shares its notes with C major', () => {
    const harmony = analyseSong(song([held([45, 57, 60, 64]), held([50, 57, 62, 65]), held([40, 56, 59, 64]), held([45, 57, 60, 64])]));
    expect(harmony.keyName).toBe('A minor');
    expect(harmony.chords.map((c) => c.symbol)).toEqual(['Am', 'Dm', 'E', 'Am']);
  });

  it('changes chord in the middle of a bar when the harmony does', () => {
    const bar = [...held([48, 52, 55], 0, 2 * Q), ...held([43, 50, 55, 59], 2 * Q, 2 * Q)];
    expect(chordsOf(song([bar]))).toEqual([
      ['C', 0, 2],
      ['G', 2, 4],
    ]);
  });

  it('does not change chord for a passing note, and lets a short strum ring to the next chord', () => {
    const passing = [...held([48, 52, 55]), [74, Q, Q / 4] as Hit];
    const strum = held([43, 55, 59, 62], 0, Q / 4);
    expect(chordsOf(song([passing, strum, held([48, 52, 55])]))).toEqual([
      ['C', 0, 4],
      ['G', 4, 8],
      ['C', 8, 12],
    ]);
  });

  it('leaves out the drums and muted instruments, and has no key with nothing to hear', () => {
    expect(analyseSong(createProject()).keyName).toBe('');
    const muted = setMuted(song([held([48, 52, 55])]), 'keys', true);
    expect(analyseSong(muted)).toMatchObject({ keyName: '', chords: [] });
  });

  it('spells chords as the key does', () => {
    // D♭ major: D♭, G♭, A♭, D♭.
    const harmony = analyseSong(song([held([49, 53, 56]), held([54, 58, 61]), held([56, 60, 63]), held([49, 53, 56])]));
    expect(harmony.keyName).toBe('D♭ major');
    expect(harmony.chords.map((c) => c.symbol)).toEqual(['D♭', 'G♭', 'A♭', 'D♭']);
  });
});

describe('the chord of a pattern', () => {
  const fretted = (frets: [string: number, fret: number][]): Project =>
    updatePattern(createProject(), 'rhythm', 0, (pattern) => ({
      ...pattern,
      notes: frets.map(([string, fret]): StringNote => ({ string, fret, start: 0, length: BAR })),
    }));

  it('names an open E power chord, and E major once the G♯ is added', () => {
    expect(patternChord(fretted([[0, 0], [1, 2], [2, 2]]), 'rhythm', 0, null)?.symbol).toBe('E5');
    expect(patternChord(fretted([[0, 0], [1, 2], [2, 2], [3, 1]]), 'rhythm', 0, null)?.symbol).toBe('E');
  });

  it('is null for an empty pattern', () => {
    expect(patternChord(createProject(), 'lead', 0, null)).toBeNull();
  });
});
