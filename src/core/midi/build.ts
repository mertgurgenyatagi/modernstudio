/**
 * The whole import: a read MIDI file and a mapping become a finished Project plus the figures of the
 * report (docs/midi-import.md, "Import: conversion"). Pure. It joins the pieces of steps 13 to 15
 * (timing, grid, drums, range, fingering) with the tiling of chunk.ts, and does the fingering once per
 * distinct pattern, so that identical bars come out with identical strings and frets.
 */
import {
  FRET_COUNT_DEFAULT,
  INSTRUMENT_IDS,
  PATTERNS_MAX,
  PATTERNS_SHOWN_DEFAULT,
  PATTERNS_SHOWN_STEP,
  TUNING,
  isStringInstrument,
  type DrumRow,
  type FretCount,
  type InstrumentId,
} from '../instruments';
import { createPattern, createProject, type Note, type Pattern, type Project } from '../project';
import { ticksPerBar, type Meter, type PatternBars } from '../time';
import { limitPatterns, tileLane, type LaneItem, type Signature, type Tiling } from './chunk';
import { convertDrums } from './drums';
import { chooseFretCount, fingerTrack } from './fretting';
import type { Assignment, TrackGuess } from './guess';
import { barsUsed, cutHitsAtBar, cutNotesAtBar, MAX_BARS, quantizeNotes } from './quantize';
import { foldIntoRange, KEYS_PITCH_RANGE, stringRange } from './range';
import type { MidiFile, MidiNote } from './read';
import { analyseTiming, type Timing } from './timing';
import { refuse, succeed, type GridNote, type Result } from './types';

/** One instrument's lane, ready to be cut into patterns. */
export interface PreparedLane {
  /** Notes (or hits, with length 0) on the grid, after snapping, the 256-bar cut and folding into range. */
  items: LaneItem[];
  /** Notes moved by whole octaves into the range. */
  octaveMoves: number;
  /** Drum hits that fell on no row, by General MIDI note number. */
  dropped: Record<number, number>;
  droppedTotal: number;
  /** Notes or hits at or after bar 257, cut off. */
  cutAtLimit: number;
  /** Bass and guitars: the chosen fret count; null for Drums and Keys. */
  fretCount: FretCount | null;
}

function notesOf(file: MidiFile, tracks: readonly number[]): MidiNote[] {
  return tracks.flatMap((index) => file.tracks[index]?.notes ?? []);
}

function itemOfNote(note: GridNote): LaneItem {
  return { start: note.start, length: note.length, key: note.pitch };
}

/**
 * One instrument's notes on the importer's grid: snapped, cut at bar 256, and folded into the range
 * (for Bass and the guitars at the fret count that `chooseFretCount` picks for the whole track).
 * Several tracks are merged; notes of one pitch and start become one.
 */
export function prepareLane(file: MidiFile, timing: Timing, id: InstrumentId, tracks: readonly number[]): PreparedLane {
  const barTicks = ticksPerBar(timing.meter.numerator === 3 ? '3/4' : '4/4');
  const notes = notesOf(file, tracks);

  if (id === 'drums') {
    const converted = convertDrums(notes, file.ticksPerQuarter, timing.shiftTicks);
    const cut = cutHitsAtBar(converted.hits, barTicks, MAX_BARS);
    return {
      items: cut.hits.map((hit) => ({ start: hit.start, length: 0, key: hit.row })),
      octaveMoves: 0,
      dropped: converted.dropped,
      droppedTotal: converted.droppedTotal,
      cutAtLimit: cut.cut,
      fretCount: null,
    };
  }

  const quantized = quantizeNotes(notes, file.ticksPerQuarter, timing.shiftTicks);
  const cut = cutNotesAtBar(quantized.notes, barTicks, MAX_BARS);
  if (id === 'keys') {
    const folded = foldIntoRange(cut.notes, KEYS_PITCH_RANGE);
    return { items: folded.notes.map(itemOfNote), octaveMoves: folded.moved, dropped: {}, droppedTotal: 0, cutAtLimit: cut.cut, fretCount: null };
  }
  if (!isStringInstrument(id)) throw new Error(`No lane for ${id}`);
  const fretCount = cut.notes.length > 0 ? (chooseFretCount(cut.notes, TUNING[id]).fretCount as FretCount) : FRET_COUNT_DEFAULT;
  const folded = foldIntoRange(cut.notes, stringRange(id, fretCount));
  return { items: folded.notes.map(itemOfNote), octaveMoves: folded.moved, dropped: {}, droppedTotal: 0, cutAtLimit: cut.cut, fretCount };
}

/** What the mapping step shows for one instrument: how many patterns the lane would need. */
export function patternsNeededFor(file: MidiFile, timing: Timing, id: InstrumentId, tracks: readonly number[]): number {
  const barTicks = ticksPerBar(timing.meter.numerator === 3 ? '3/4' : '4/4');
  return tileLane(prepareLane(file, timing, id, tracks).items, barTicks).patterns.length;
}

// ---- The report ----

export interface InstrumentReport {
  tracks: { index: number; name: string }[];
  /** Notes (hits for Drums) on the lane before any cut. */
  notes: number;
  octaveMoves: number;
  /** Drum hits left out, by General MIDI note number. */
  dropped: Record<number, number>;
  droppedTotal: number;
  fretCount: FretCount | null;
  /** Patterns used in the project, and blocks in the lane. */
  patterns: number;
  blocks: number;
  /** Patterns the lane needed before the limit of 120. */
  patternsNeeded: number;
  /** Chords with two notes on one string, over the distinct patterns (guitars and Bass). */
  sharedStringChords: number;
  /** Notes cut because the song passes bar 256 or the patterns ran out. */
  cutNotes: number;
  /** Notes cut short at the end of their block. */
  clippedNotes: number;
  warnings: string[];
}

export interface ImportReport {
  bpm: number;
  otherTempos: number;
  meter: Meter;
  /** Bars from bar 1 to the last note start of any lane. */
  bars: number;
  /** What was ignored or moved in tempo, meter and pickup (sentences). */
  timingNotes: string[];
  /** Null for an instrument that got no track. */
  instruments: Record<InstrumentId, InstrumentReport | null>;
  warnings: string[];
}

export interface ImportOutcome {
  project: Project;
  report: ImportReport;
}

// ---- Building the project ----

function noteOfItem(id: InstrumentId, item: LaneItem): Note {
  if (id === 'drums') return { row: item.key as DrumRow, start: item.start };
  return { pitch: item.key as number, start: item.start, length: item.length };
}

/** Strings and frets for one pattern: the fingering search runs on the pattern alone. */
function fingerPattern(id: InstrumentId, signature: Signature, fretCount: FretCount): { notes: Note[]; sharedStringChords: number } {
  const notes: GridNote[] = signature.items.map((item) => ({ start: item.start, length: item.length, pitch: item.key as number }));
  const result = fingerTrack(notes, TUNING[id as 'bass' | 'rhythm' | 'lead'], fretCount);
  const placed: Note[] = result.notes
    .map((n) => ({ string: n.string, fret: n.fret, start: n.start, length: n.length }))
    .sort((a, b) => a.start - b.start || a.string - b.string);
  return { notes: placed, sharedStringChords: result.metrics.sharedStringChords };
}

function patternOf(id: InstrumentId, signature: Signature, fretCount: FretCount | null): { pattern: Pattern; shared: number } {
  if (isStringInstrument(id)) {
    const fingered = fingerPattern(id, signature, fretCount ?? FRET_COUNT_DEFAULT);
    return { pattern: { bars: signature.bars as PatternBars, notes: fingered.notes }, shared: fingered.sharedStringChords };
  }
  const notes = signature.items.map((item) => noteOfItem(id, item));
  return { pattern: { bars: signature.bars as PatternBars, notes }, shared: 0 };
}

/** The smallest number of shown patterns, in steps of 20, that holds `used` patterns. */
export function shownFor(used: number): number {
  return Math.min(PATTERNS_MAX, Math.max(PATTERNS_SHOWN_DEFAULT, Math.ceil(used / PATTERNS_SHOWN_STEP) * PATTERNS_SHOWN_STEP));
}

function tracksOf(rows: readonly TrackGuess[], id: InstrumentId): TrackGuess[] {
  return rows.filter((row) => (row.assignment as Assignment) === id);
}

/**
 * Converts a file with a mapping into a project. A refusal (a meter the app does not have, nothing mapped,
 * no notes) is a value with a message, never an exception. Mapping rows that say Skip are ignored; an
 * instrument with no track stays empty; two tracks for one instrument are merged.
 */
export function convertMidi(file: MidiFile, mapping: readonly TrackGuess[]): Result<ImportOutcome> {
  const timingResult = analyseTiming(file);
  if (!timingResult.ok) return refuse(timingResult.reason);
  const timing = timingResult.value;
  const meter: Meter = timing.meter.numerator === 3 ? '3/4' : '4/4';
  const barTicks = ticksPerBar(meter);

  let project = createProject();
  project = { ...project, bpm: timing.bpm, meter };
  const reports = {} as Record<InstrumentId, InstrumentReport | null>;
  const warnings: string[] = [];
  let lastStart: number | null = null;
  let anyNotes = false;
  let passed256 = false;

  for (const id of INSTRUMENT_IDS) {
    const rows = tracksOf(mapping, id);
    if (rows.length === 0) {
      reports[id] = null;
      continue;
    }
    const lane = prepareLane(file, timing, id, rows.map((row) => row.index));
    const tiling: Tiling = tileLane(lane.items, barTicks);
    const limited = limitPatterns(tiling, PATTERNS_MAX);
    const kept = limited.tiling;

    const instrumentWarnings: string[] = [];
    if (lane.cutAtLimit > 0) {
      passed256 = true;
      instrumentWarnings.push(`${lane.cutAtLimit} ${lane.cutAtLimit === 1 ? 'note' : 'notes'} after bar ${MAX_BARS} ${lane.cutAtLimit === 1 ? 'was' : 'were'} cut.`);
    }
    let cutByPatterns = 0;
    if (limited.cutAtBar !== null) {
      const from = limited.cutAtBar * barTicks;
      cutByPatterns = lane.items.filter((item) => item.start >= from).length;
      instrumentWarnings.push(
        `This part needs ${tiling.patterns.length} patterns and ${PATTERNS_MAX} fit, so it is cut at bar ${limited.cutAtBar + 1} (${cutByPatterns} ${cutByPatterns === 1 ? 'note' : 'notes'} left out).`,
      );
    }

    const patterns: Pattern[] = Array.from({ length: PATTERNS_MAX }, createPattern);
    let shared = 0;
    kept.patterns.forEach((signature, i) => {
      const built = patternOf(id, signature, lane.fretCount);
      patterns[i] = built.pattern;
      shared += built.shared;
    });
    if (lane.items.length > 0) anyNotes = true;
    for (const item of lane.items) if (lastStart === null || item.start > lastStart) lastStart = item.start;

    const base = project.instruments[id];
    project = {
      ...project,
      instruments: {
        ...project.instruments,
        [id]: {
          ...base,
          patterns,
          shownPatterns: shownFor(kept.patterns.length),
          selectedPattern: 0,
          lane: kept.blocks.map((block) => ({ pattern: block.pattern, startBar: block.startBar })),
          fretCount: lane.fretCount ?? base.fretCount,
        },
      },
    };

    reports[id] = {
      tracks: rows.map((row) => ({ index: row.index, name: row.name })),
      notes: lane.items.length,
      octaveMoves: lane.octaveMoves,
      dropped: lane.dropped,
      droppedTotal: lane.droppedTotal,
      fretCount: lane.fretCount,
      patterns: kept.patterns.length,
      blocks: kept.blocks.length,
      patternsNeeded: tiling.patterns.length,
      sharedStringChords: shared,
      cutNotes: lane.cutAtLimit + cutByPatterns,
      clippedNotes: kept.clipped,
      warnings: instrumentWarnings,
    };
  }

  if (!anyNotes) return refuse('The tracks chosen hold no notes that the app can use, so there is nothing to import.');
  if (passed256) warnings.push(`The song passes bar ${MAX_BARS}; the rest is cut.`);

  return succeed({
    project,
    report: {
      bpm: timing.bpm,
      otherTempos: timing.otherTempos,
      meter,
      bars: barsUsed(lastStart, barTicks),
      timingNotes: timing.notes,
      instruments: reports,
      warnings,
    },
  });
}
