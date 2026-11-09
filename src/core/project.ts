/**
 * The project: what is saved to a file and what Undo steps through. Every function here is pure.
 * An edit returns a new project, sharing whatever did not change, and returns the same object when
 * nothing changed, so the history can skip it. Edits that a rule can refuse return an Outcome.
 */
import {
  FRET_COUNT_DEFAULT,
  INSTRUMENT_IDS,
  LEVEL_MAX,
  LEVEL_MIN,
  PATTERNS_MAX,
  PATTERNS_SHOWN_DEFAULT,
  PATTERNS_SHOWN_STEP,
  TRANSPOSE_MAX,
  isStringInstrument,
  type DrumRow,
  type FretCount,
  type InstrumentId,
} from './instruments';
import { BPM_DEFAULT, clampBpm, patternTicks, type Meter, type PatternBars } from './time';

// ---- Types ----

/** A drum hit. It has no length: it plays for the full duration of its sound. */
export interface DrumNote {
  row: DrumRow;
  /** Start in ticks from the start of the pattern. */
  start: number;
}

/** A note on a string (bass and both guitars). Its pitch is the open string plus the fret. */
export interface StringNote {
  /** 0 is the lowest string, at the top of the string cards. */
  string: number;
  fret: number;
  start: number;
  length: number;
}

/** A note on Keys, by MIDI pitch (C4 = 60). */
export interface KeysNote {
  pitch: number;
  start: number;
  length: number;
}

export type Note = DrumNote | StringNote | KeysNote;

/**
 * A pattern. Its notes may reach past its length: notes outside a shortened pattern are kept, and
 * come back when the pattern is lengthened again. A pattern is active once it has a note.
 */
export interface Pattern {
  bars: PatternBars;
  notes: Note[];
  /** An optional name, set by double-clicking the pattern number. Absent when the pattern has none. */
  name?: string;
}

/** The longest pattern name, in characters. */
export const PATTERN_NAME_MAX = 24;

/** One Song block: a pattern placed at a bar. Its length is the pattern's length in bars. */
export interface Block {
  /** Index into the instrument's patterns, 0 based. */
  pattern: number;
  /** The bar it starts at, 0 based. */
  startBar: number;
}

export interface Instrument {
  /** 0 to 100. */
  volume: number;
  muted: boolean;
  /** Attack, decay and release, each 0 to 100 with no units. */
  attack: number;
  decay: number;
  release: number;
  /** Always PATTERNS_MAX patterns. */
  patterns: Pattern[];
  /** How many patterns are shown: 20, then 40 and so on up to 120. */
  shownPatterns: number;
  /** Index of the pattern last selected for this instrument. */
  selectedPattern: number;
  /** The Song lane, sorted by start bar, never overlapping. */
  lane: Block[];
  /** Bass and the guitars only; null for Drums and Keys. Notes on frets above it are kept, hidden. */
  fretCount: FretCount | null;
  /**
   * Keys only: how many semitones the whole instrument sounds above (or, negative, below) what is
   * written, -24 to 24. 0 for every other instrument. The notes stay as written; the sound, the WAV
   * export and the MIDI export move.
   */
  transpose: number;
}

export interface Project {
  bpm: number;
  meter: Meter;
  /** 0 to 100. */
  masterVolume: number;
  instruments: Record<InstrumentId, Instrument>;
}

export type Outcome = { ok: true; project: Project } | { ok: false; reason: string };

export const ok = (project: Project): Outcome => ({ ok: true, project });
export const refuse = (reason: string): Outcome => ({ ok: false, reason });

// ---- Defaults ----

/**
 * Defaults are assumptions, recorded in docs/open-items.md. Envelope 0 means the recorded sound
 * unshaped; the audio engine (plan24 step 4) gives the numbers their meaning.
 */
export const VOLUME_DEFAULT = 80;
export const MASTER_VOLUME_DEFAULT = 80;
export const ENVELOPE_DEFAULT = 0;

export function createPattern(): Pattern {
  return { bars: 1, notes: [] };
}

export function createInstrument(id: InstrumentId): Instrument {
  return {
    volume: VOLUME_DEFAULT,
    muted: false,
    attack: ENVELOPE_DEFAULT,
    decay: ENVELOPE_DEFAULT,
    release: ENVELOPE_DEFAULT,
    patterns: Array.from({ length: PATTERNS_MAX }, createPattern),
    shownPatterns: PATTERNS_SHOWN_DEFAULT,
    selectedPattern: 0,
    lane: [],
    fretCount: isStringInstrument(id) ? FRET_COUNT_DEFAULT : null,
    transpose: 0,
  };
}

/** A new project: 120 BPM, 4/4, empty. */
export function createProject(): Project {
  const instruments = {} as Record<InstrumentId, Instrument>;
  for (const id of INSTRUMENT_IDS) instruments[id] = createInstrument(id);
  return { bpm: BPM_DEFAULT, meter: '4/4', masterVolume: MASTER_VOLUME_DEFAULT, instruments };
}

// ---- Reading ----

export function isActive(pattern: Pattern): boolean {
  return pattern.notes.length > 0;
}

/** How many bars a Song block of this pattern covers. */
export function blockBars(project: Project, id: InstrumentId, block: Block): number {
  return project.instruments[id].patterns[block.pattern]?.bars ?? 1;
}

/** The ticks the selected pattern's visible part covers. */
export function visibleTicks(project: Project, id: InstrumentId, pattern: number): number {
  const p = project.instruments[id].patterns[pattern];
  return patternTicks(project.meter, p?.bars ?? 1);
}

// ---- Building blocks for edits ----

export function updateInstrument(
  project: Project,
  id: InstrumentId,
  change: (instrument: Instrument) => Instrument,
): Project {
  const before = project.instruments[id];
  const after = change(before);
  if (after === before) return project;
  return { ...project, instruments: { ...project.instruments, [id]: after } };
}

export function updatePattern(
  project: Project,
  id: InstrumentId,
  index: number,
  change: (pattern: Pattern) => Pattern,
): Project {
  return updateInstrument(project, id, (instrument) => {
    const before = instrument.patterns[index];
    if (!before) return instrument;
    const after = change(before);
    if (after === before) return instrument;
    const patterns = instrument.patterns.slice();
    patterns[index] = after;
    return { ...instrument, patterns };
  });
}

export function clampLevel(value: number): number {
  if (!Number.isFinite(value)) return LEVEL_MIN;
  return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Math.round(value)));
}

// ---- Pattern names ----

/** A name as it is kept: trimmed, inner runs of spaces made one, cut to PATTERN_NAME_MAX. Empty means no name. */
export function cleanPatternName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, PATTERN_NAME_MAX).trim();
}

/** "Pattern 3" or, for a named pattern, "Pattern 3: Chorus". `index` is 0 based. */
export function patternLabel(pattern: Pattern | undefined, index: number): string {
  return pattern?.name ? `Pattern ${index + 1}: ${pattern.name}` : `Pattern ${index + 1}`;
}

/** Names a pattern; an empty name takes the name away. Not limited to active patterns. */
export function setPatternName(project: Project, id: InstrumentId, index: number, name: string): Project {
  const clean = cleanPatternName(name);
  return updatePattern(project, id, index, (pattern) => {
    if ((pattern.name ?? '') === clean) return pattern;
    if (clean === '') {
      return { bars: pattern.bars, notes: pattern.notes };
    }
    return { ...pattern, name: clean };
  });
}

// ---- Mixer and project settings ----

export function setBpm(project: Project, bpm: number): Project {
  const next = clampBpm(bpm);
  return next === project.bpm ? project : { ...project, bpm: next };
}

export function setMasterVolume(project: Project, value: number): Project {
  const next = clampLevel(value);
  return next === project.masterVolume ? project : { ...project, masterVolume: next };
}

export function setVolume(project: Project, id: InstrumentId, value: number): Project {
  const next = clampLevel(value);
  return updateInstrument(project, id, (i) => (i.volume === next ? i : { ...i, volume: next }));
}

export function setMuted(project: Project, id: InstrumentId, muted: boolean): Project {
  return updateInstrument(project, id, (i) => (i.muted === muted ? i : { ...i, muted }));
}

export function setEnvelope(
  project: Project,
  id: InstrumentId,
  change: Partial<Pick<Instrument, 'attack' | 'decay' | 'release'>>,
): Project {
  return updateInstrument(project, id, (i) => {
    const next = {
      attack: change.attack === undefined ? i.attack : clampLevel(change.attack),
      decay: change.decay === undefined ? i.decay : clampLevel(change.decay),
      release: change.release === undefined ? i.release : clampLevel(change.release),
    };
    if (next.attack === i.attack && next.decay === i.decay && next.release === i.release) return i;
    return { ...i, ...next };
  });
}

/** Keys only: transposes the whole instrument by whole semitones, kept within -24 to 24. */
export function setTranspose(project: Project, id: InstrumentId, semitones: number): Project {
  if (id !== 'keys' || !Number.isFinite(semitones)) return project;
  const next = Math.min(TRANSPOSE_MAX, Math.max(-TRANSPOSE_MAX, Math.round(semitones)));
  return updateInstrument(project, id, (i) => (i.transpose === next ? i : { ...i, transpose: next }));
}

/** Bass and the guitars only. Notes on frets above the new count are kept, and hidden. */
export function setFretCount(project: Project, id: InstrumentId, fretCount: FretCount): Project {
  if (!isStringInstrument(id)) return project;
  return updateInstrument(project, id, (i) => (i.fretCount === fretCount ? i : { ...i, fretCount }));
}

/** Selecting a pattern is not an edit that Undo steps through; see history.ts. */
export function selectPattern(project: Project, id: InstrumentId, index: number): Project {
  const instrument = project.instruments[id];
  if (!Number.isInteger(index) || index < 0 || index >= instrument.shownPatterns) return project;
  return updateInstrument(project, id, (i) => (i.selectedPattern === index ? i : { ...i, selectedPattern: index }));
}

/** The hidden control: shown once all shown patterns are active, and not once all 120 are shown. */
export function canOpenMorePatterns(project: Project, id: InstrumentId): boolean {
  const instrument = project.instruments[id];
  if (instrument.shownPatterns >= PATTERNS_MAX) return false;
  return instrument.patterns.slice(0, instrument.shownPatterns).every(isActive);
}

/** Opens 20 more patterns (assumed step), up to 120. Refused until every shown pattern is active. */
export function openMorePatterns(project: Project, id: InstrumentId): Outcome {
  if (!canOpenMorePatterns(project, id)) return refuse('More patterns open once every shown pattern has a note.');
  return ok(
    updateInstrument(project, id, (i) => ({
      ...i,
      shownPatterns: Math.min(PATTERNS_MAX, i.shownPatterns + PATTERNS_SHOWN_STEP),
    })),
  );
}

/** For an import, which opens the extra patterns by itself. Rounds up to a multiple of 20, at most 120. */
export function showPatterns(project: Project, id: InstrumentId, count: number): Project {
  const wanted = Math.min(PATTERNS_MAX, Math.ceil(count / PATTERNS_SHOWN_STEP) * PATTERNS_SHOWN_STEP);
  return updateInstrument(project, id, (i) => (wanted <= i.shownPatterns ? i : { ...i, shownPatterns: wanted }));
}

/**
 * Changes the meter. Notes keep their positions and nothing is deleted: switching to a shorter bar
 * hides the notes that now fall outside their pattern, as a shortened pattern does, and they come
 * back when the meter is switched back (the user's sweeping changes, 2026-11-09, overturning
 * questionnaire 16). A note that runs past the new end is cut short where it plays and where it is
 * drawn, and keeps its length.
 */
export function setMeter(project: Project, meter: Meter): Project {
  if (meter === project.meter) return project;
  return { ...project, meter };
}
