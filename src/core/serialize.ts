/**
 * The saved shape of a project: JSON with a version number, and a parser that checks everything
 * before it lets a file become a project. A file that does not check out is refused with a reason.
 */
import {
  FRET_COUNTS,
  FRET_MAX,
  INSTRUMENT_IDS,
  LEVEL_MAX,
  LEVEL_MIN,
  PATTERNS_MAX,
  PATTERNS_SHOWN_STEP,
  TRANSPOSE_MAX,
  isStringInstrument,
  type FretCount,
  type InstrumentId,
} from './instruments';
import { noteProblem } from './patterns';
import { PATTERN_NAME_MAX, cleanPatternName, type Block, type Instrument, type Note, type Pattern, type Project } from './project';
import { laneFits } from './song';
import { BPM_MAX, BPM_MIN, METERS, MAX_PATTERN_BARS, PATTERN_BARS, patternTicks, type Meter, type PatternBars } from './time';

/**
 * Where a saved note may lie: anywhere inside the longest pattern of the longest bar. A project in 3/4
 * can hold notes placed in 4/4, hidden past the shorter bar until the meter is switched back.
 */
const NOTE_LIMIT_TICKS = patternTicks('4/4', MAX_PATTERN_BARS);

export const FILE_FORMAT = 'modernstudio';
export const FILE_VERSION = 1;

export interface ProjectFile {
  format: typeof FILE_FORMAT;
  version: number;
  project: Project;
}

export type ParseResult = { ok: true; project: Project } | { ok: false; reason: string };

export function serializeProject(project: Project): string {
  const file: ProjectFile = { format: FILE_FORMAT, version: FILE_VERSION, project };
  return JSON.stringify(file);
}

class Bad extends Error {}

function bad(where: string, what: string): never {
  throw new Bad(`${where}: ${what}`);
}

function record(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) bad(where, 'expected an object');
  return value as Record<string, unknown>;
}

function whole(value: unknown, where: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    bad(where, `expected a whole number from ${min} to ${max}`);
  }
  return value as number;
}

function level(value: unknown, where: string): number {
  return whole(value, where, LEVEL_MIN, LEVEL_MAX);
}

function oneOf<T extends string | number>(value: unknown, allowed: readonly T[], where: string): T {
  if (!allowed.includes(value as T)) bad(where, `expected one of ${allowed.join(', ')}`);
  return value as T;
}

function parseNote(id: InstrumentId, value: unknown, where: string): Note {
  const raw = record(value, where);
  const note = raw as unknown as Note;
  // Hidden notes may lie anywhere inside the longest pattern, and on any fret the editor can show.
  const problem = noteProblem(id, note, { end: NOTE_LIMIT_TICKS, maxFret: FRET_MAX });
  if (problem) bad(where, problem);
  const keys = Object.keys(raw).sort().join(',');
  const expected = ['row,start', 'fret,length,start,string', 'length,pitch,start'];
  if (!expected.includes(keys)) bad(where, 'unexpected fields');
  return note;
}

function parsePattern(id: InstrumentId, value: unknown, where: string): Pattern {
  const raw = record(value, where);
  const bars = oneOf<PatternBars>(raw.bars, PATTERN_BARS, `${where}.bars`);
  if (!Array.isArray(raw.notes)) bad(`${where}.notes`, 'expected a list');
  const notes = (raw.notes as unknown[]).map((n, i) => parseNote(id, n, `${where}.notes[${i}]`));
  if (raw.name === undefined) return { bars, notes };
  if (typeof raw.name !== 'string' || raw.name === '' || cleanPatternName(raw.name) !== raw.name) {
    bad(`${where}.name`, `expected a name of 1 to ${PATTERN_NAME_MAX} characters, trimmed`);
  }
  return { bars, notes, name: raw.name };
}

function parseInstrument(id: InstrumentId, value: unknown, where: string): Instrument {
  const raw = record(value, where);
  if (typeof raw.muted !== 'boolean') bad(`${where}.muted`, 'expected true or false');
  if (!Array.isArray(raw.patterns) || raw.patterns.length !== PATTERNS_MAX) {
    bad(`${where}.patterns`, `expected ${PATTERNS_MAX} patterns`);
  }
  const patterns = (raw.patterns as unknown[]).map((p, i) => parsePattern(id, p, `${where}.patterns[${i}]`));

  const shownPatterns = whole(raw.shownPatterns, `${where}.shownPatterns`, PATTERNS_SHOWN_STEP, PATTERNS_MAX);
  if (shownPatterns % PATTERNS_SHOWN_STEP !== 0) bad(`${where}.shownPatterns`, 'expected a multiple of 20');
  const selectedPattern = whole(raw.selectedPattern, `${where}.selectedPattern`, 0, shownPatterns - 1);

  if (!Array.isArray(raw.lane)) bad(`${where}.lane`, 'expected a list');
  const lane: Block[] = (raw.lane as unknown[]).map((b, i) => {
    const block = record(b, `${where}.lane[${i}]`);
    return {
      pattern: whole(block.pattern, `${where}.lane[${i}].pattern`, 0, shownPatterns - 1),
      startBar: whole(block.startBar, `${where}.lane[${i}].startBar`, 0, 255),
    };
  });
  if (!laneFits(lane.map((b) => ({ startBar: b.startBar, bars: patterns[b.pattern]?.bars ?? 1 })))) {
    bad(`${where}.lane`, 'blocks overlap or pass bar 256');
  }
  lane.sort((a, b) => a.startBar - b.startBar);

  let fretCount: FretCount | null = null;
  if (isStringInstrument(id)) fretCount = oneOf<FretCount>(raw.fretCount, FRET_COUNTS, `${where}.fretCount`);
  else if (raw.fretCount !== null) bad(`${where}.fretCount`, 'expected null');

  // Files saved before Keys could be transposed have no transpose: that is 0. Only Keys can have one.
  const transpose = raw.transpose === undefined ? 0 : whole(raw.transpose, `${where}.transpose`, -TRANSPOSE_MAX, TRANSPOSE_MAX);
  if (id !== 'keys' && transpose !== 0) bad(`${where}.transpose`, 'only Keys can be transposed');

  return {
    volume: level(raw.volume, `${where}.volume`),
    muted: raw.muted,
    attack: level(raw.attack, `${where}.attack`),
    decay: level(raw.decay, `${where}.decay`),
    release: level(raw.release, `${where}.release`),
    patterns,
    shownPatterns,
    selectedPattern,
    lane,
    fretCount,
    transpose,
  };
}

/** Reads a saved project. Never throws: a bad file comes back as `{ ok: false, reason }`. */
export function parseProject(text: string): ParseResult {
  try {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, reason: 'This is not a modernstudio file: it is not valid JSON.' };
    }
    const file = record(json, 'file');
    if (file.format !== FILE_FORMAT) return { ok: false, reason: 'This is not a modernstudio file.' };
    if (typeof file.version !== 'number' || !Number.isInteger(file.version) || file.version < 1) {
      return { ok: false, reason: 'This file has no valid version number.' };
    }
    if (file.version > FILE_VERSION) {
      return { ok: false, reason: `This file was saved by a newer modernstudio (file version ${file.version}).` };
    }
    const raw = record(file.project, 'project');
    const meter = oneOf<Meter>(raw.meter, METERS, 'project.meter');
    const instruments = record(raw.instruments, 'project.instruments');
    const parsed = {} as Record<InstrumentId, Instrument>;
    for (const id of INSTRUMENT_IDS) {
      parsed[id] = parseInstrument(id, instruments[id], `project.instruments.${id}`);
    }
    return {
      ok: true,
      project: {
        bpm: whole(raw.bpm, 'project.bpm', BPM_MIN, BPM_MAX),
        meter,
        masterVolume: level(raw.masterVolume, 'project.masterVolume'),
        instruments: parsed,
      },
    };
  } catch (error) {
    if (error instanceof Bad) return { ok: false, reason: `The file is damaged (${error.message}).` };
    throw error;
  }
}
