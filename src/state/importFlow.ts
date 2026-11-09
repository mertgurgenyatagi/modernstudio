/**
 * The MIDI import flow as a state machine, pure (docs/midi-import.md, "Import: the flow"). The stages are
 * choose file, reading, mapping, converting, done and refused. The functions here read a picked file into
 * a mapping, change a row's assignment, work out what each row and instrument would come to (the figures
 * the mapping step shows) and word the refusals. The screen (src/ui/ImportMapping.tsx) and the hook
 * (useMidiImport.ts) only carry these out; the main process reads the file and shows the dialogs.
 */
import { PATTERNS_MAX, INSTRUMENT_IDS, INSTRUMENT_LABELS, type FretCount, type InstrumentId } from '../core/instruments';
import { ticksPerBar } from '../core/time';
import { tileLane } from '../core/midi/chunk';
import { prepareLane, type ImportOutcome } from '../core/midi/build';
import { guessMapping, type Assignment, type TrackGuess } from '../core/midi/guess';
import { readMidi, type MidiFile } from '../core/midi/read';
import { analyseTiming, type Timing } from '../core/midi/timing';
import { refuse, succeed, type Result } from '../core/midi/types';

/** A file that was read and whose tempo and meter the app can hold: what the mapping step works on. */
export interface LoadedMidi {
  file: MidiFile;
  timing: Timing;
  /** One row per track that has notes, pre-filled by the guesses. */
  rows: TrackGuess[];
}

export type ImportStage =
  /** Not importing. */
  | { stage: 'idle' }
  /** The file dialog is open. */
  | { stage: 'choosing' }
  | { stage: 'reading'; name: string }
  | { stage: 'mapping'; name: string; loaded: LoadedMidi }
  | { stage: 'converting'; name: string; loaded: LoadedMidi }
  /** Converted; the outcome waits to become the open project and the report. */
  | { stage: 'done'; name: string; outcome: ImportOutcome }
  | { stage: 'refused'; reason: string };

export type ImportAction =
  | { type: 'start' }
  /** The dialog gave a file. */
  | { type: 'chosen'; name: string }
  | { type: 'read'; name: string; result: Result<LoadedMidi> }
  | { type: 'assign'; index: number; assignment: Assignment }
  | { type: 'convert' }
  | { type: 'converted'; name: string; result: Result<ImportOutcome> }
  /** Cancel, a dismissed refusal, or the end of a finished import: back to idle. */
  | { type: 'close' };

export const IDLE: ImportStage = { stage: 'idle' };

export function reduceImport(state: ImportStage, action: ImportAction): ImportStage {
  switch (action.type) {
    case 'start':
      return state.stage === 'idle' ? { stage: 'choosing' } : state;
    case 'chosen':
      return state.stage === 'choosing' ? { stage: 'reading', name: action.name } : state;
    case 'read':
      if (state.stage !== 'reading') return state;
      return action.result.ok
        ? { stage: 'mapping', name: action.name, loaded: action.result.value }
        : { stage: 'refused', reason: refusalText(action.name, action.result.reason) };
    case 'assign': {
      if (state.stage !== 'mapping') return state;
      const rows = setAssignment(state.loaded.rows, action.index, action.assignment);
      return rows === state.loaded.rows ? state : { ...state, loaded: { ...state.loaded, rows } };
    }
    case 'convert':
      return state.stage === 'mapping' && canConvert(state.loaded.rows) ? { stage: 'converting', name: state.name, loaded: state.loaded } : state;
    case 'converted':
      if (state.stage !== 'converting') return state;
      return action.result.ok
        ? { stage: 'done', name: action.name, outcome: action.result.value }
        : { stage: 'refused', reason: refusalText(action.name, action.result.reason) };
    case 'close':
      return state.stage === 'idle' || state.stage === 'converting' ? state : IDLE;
  }
}

/** True while the mapping panel is on screen (the panel stays up while converting, so "Converting…" shows). */
export function panelShown(state: ImportStage): boolean {
  return state.stage === 'reading' || state.stage === 'mapping' || state.stage === 'converting';
}

// ---- Reading a picked file ----

/** The name of a MIDI file without its extension, for the new project; "Imported song" if nothing is left. */
export function midiName(fileName: string): string {
  const parts = fileName.split(/[\\/]/);
  const base = parts[parts.length - 1] ?? fileName;
  const stem = base.replace(/\.midi?$/i, '').trim();
  return stem === '' ? 'Imported song' : stem;
}

/** Reads the bytes, checks tempo and meter, and fills in the guessed mapping. A refusal says why. */
export function loadMidi(bytes: Uint8Array): Result<LoadedMidi> {
  const read = readMidi(bytes);
  if (!read.ok) return refuse(read.reason);
  const timing = analyseTiming(read.file);
  if (!timing.ok) return refuse(timing.reason);
  const rows = guessMapping(read.file);
  if (rows.length === 0) return refuse('The file holds no notes, so there is nothing to import.');
  return succeed({ file: read.file, timing: timing.value, rows });
}

/** The quiet line for a refused import. */
export function refusalText(name: string, reason: string): string {
  return `${name} was not imported. ${reason}`;
}

// ---- The mapping ----

export const ASSIGNMENTS: readonly Assignment[] = [...INSTRUMENT_IDS, 'skip'];

export function assignmentLabel(assignment: Assignment): string {
  return assignment === 'skip' ? 'Skip' : INSTRUMENT_LABELS[assignment];
}

/** A row's new assignment. The same array comes back when nothing changes, so a reducer can tell. */
export function setAssignment(rows: readonly TrackGuess[], index: number, assignment: Assignment): TrackGuess[] {
  const row = rows.find((r) => r.index === index);
  if (!row || row.assignment === assignment) return rows as TrackGuess[];
  return rows.map((r) => (r.index === index ? { ...r, assignment } : r));
}

/** The import can run when at least one track is sent to an instrument. */
export function canConvert(rows: readonly TrackGuess[]): boolean {
  return rows.some((row) => row.assignment !== 'skip');
}

/** The tracks (their indexes in the file) sent to one instrument. */
export function tracksFor(rows: readonly TrackGuess[], id: InstrumentId): number[] {
  return rows.filter((row) => row.assignment === id).map((row) => row.index);
}

// ---- What a row or an instrument would come to ----

/** What the conversion would do to a lane: the figures the mapping step shows beside the choices. */
export interface Preview {
  /** Notes (hits for Drums) on the lane after snapping, the 256-bar cut and the octave folding. */
  notes: number;
  /** Notes moved by whole octaves into the instrument's range (at its fret count). */
  octaveMoves: number;
  /** Drum hits that fall on no row of the app. */
  droppedHits: number;
  /** Patterns the lane needs. */
  patterns: number;
  /** False when the lane needs more patterns than the app has (120). */
  fits: boolean;
  fretCount: FretCount | null;
}

/** Results by instrument and tracks, kept while the user changes the mapping, so a change recomputes only what it touched. */
export type PreviewCache = Map<string, Preview>;

export function previewLane(file: MidiFile, timing: Timing, id: InstrumentId, tracks: readonly number[], cache?: PreviewCache): Preview {
  const key = `${id}:${tracks.join(',')}`;
  const known = cache?.get(key);
  if (known) return known;
  const lane = prepareLane(file, timing, id, tracks);
  const barTicks = ticksPerBar(timing.meter.numerator === 3 ? '3/4' : '4/4');
  const patterns = tileLane(lane.items, barTicks).patterns.length;
  const preview: Preview = {
    notes: lane.items.length,
    octaveMoves: lane.octaveMoves,
    droppedHits: lane.droppedTotal,
    patterns,
    fits: patterns <= PATTERNS_MAX,
    fretCount: lane.fretCount,
  };
  cache?.set(key, preview);
  return preview;
}

export interface MappingPreview {
  /** Per track index; only tracks that are not on Skip. */
  rows: Map<number, Preview>;
  /** Per instrument, over all the tracks sent to it; null for an instrument with no track. */
  instruments: Record<InstrumentId, Preview | null>;
}

export function previewMapping(file: MidiFile, timing: Timing, rows: readonly TrackGuess[], cache?: PreviewCache): MappingPreview {
  const perRow = new Map<number, Preview>();
  const instruments = {} as Record<InstrumentId, Preview | null>;
  for (const id of INSTRUMENT_IDS) {
    const tracks = tracksFor(rows, id);
    if (tracks.length === 0) {
      instruments[id] = null;
      continue;
    }
    const whole = previewLane(file, timing, id, tracks, cache);
    instruments[id] = whole;
    for (const index of tracks) perRow.set(index, tracks.length === 1 ? whole : previewLane(file, timing, id, [index], cache));
  }
  return { rows: perRow, instruments };
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "143 patterns needed, 120 fit" when the lane is too long for the app. Empty when it fits. */
export function patternsWarning(preview: Preview): string {
  return preview.fits ? '' : `needs ${preview.patterns}, ${PATTERNS_MAX} fit`;
}

/** The patterns figure of a row: "14 patterns", or the warning. */
export function patternsText(preview: Preview): string {
  return preview.fits ? plural(preview.patterns, 'pattern', 'patterns') : patternsWarning(preview);
}

/** What the conversion changes in the notes: octave moves for pitched parts, dropped hits for Drums. */
export function changesText(id: InstrumentId, preview: Preview): string {
  if (id === 'drums') return preview.droppedHits === 0 ? 'no hits dropped' : `${plural(preview.droppedHits, 'hit', 'hits')} dropped`;
  return preview.octaveMoves === 0 ? 'no octave moves' : `${plural(preview.octaveMoves, 'note', 'notes')} moved an octave`;
}
