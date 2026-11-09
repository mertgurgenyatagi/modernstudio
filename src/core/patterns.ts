/**
 * Notes and patterns. See docs/patterns-and-song.md, docs/time-and-notes.md and
 * docs/instrument-layouts.md.
 */
import {
  DRUM_ROWS,
  FRET_MAX,
  INSTRUMENT_KIND,
  KEYS_RANGE,
  TUNING,
  isStringInstrument,
  type InstrumentId,
} from './instruments';
import {
  blockBars,
  ok,
  refuse,
  updatePattern,
  visibleTicks,
  type KeysNote,
  type Note,
  type Outcome,
  type Pattern,
  type Project,
  type StringNote,
} from './project';
import { laneFits } from './song';
import { MIN_NOTE_TICKS, isGridPosition, type PatternBars } from './time';

// ---- Reading notes ----

/** Whether the note has a length. Drum hits do not. */
export function hasLength(note: Note): note is StringNote | KeysNote {
  return 'length' in note;
}

/** The end of a note in ticks. A drum hit ends where it starts. */
export function noteEnd(note: Note): number {
  return hasLength(note) ? note.start + note.length : note.start;
}

/** The MIDI pitch of a string note or a Keys note, or undefined for a drum hit. */
export function pitchOf(id: InstrumentId, note: Note): number | undefined {
  if ('pitch' in note) return note.pitch;
  if ('string' in note && isStringInstrument(id)) {
    const open = TUNING[id][note.string];
    return open === undefined ? undefined : open + note.fret;
  }
  return undefined;
}

/**
 * Identifies a note inside its pattern. Two notes with the same key are the same note: the same
 * row at the same time, the same string and fret at the same time, or the same pitch at the same time.
 */
export function noteKey(note: Note): string {
  if ('row' in note) return `d:${note.row}:${note.start}`;
  if ('string' in note) return `s:${note.string}:${note.fret}:${note.start}`;
  return `k:${note.pitch}:${note.start}`;
}

// ---- Checking notes ----

export interface NoteLimits {
  /** Notes must start before and end at or before this tick. */
  end: number;
  /** The highest fret a string note may sit on. */
  maxFret: number;
}

/**
 * Why a note is not valid for the instrument, or null when it is. Starts and ends are on the grid,
 * a length is at least half of a third, and the note belongs to the instrument's layout.
 */
export function noteProblem(id: InstrumentId, note: Note, limits: NoteLimits): string | null {
  const kind = INSTRUMENT_KIND[id];
  if (!Number.isInteger(note.start) || note.start < 0) return 'A note starts at a whole tick, not before the pattern.';
  if (note.start >= limits.end) return 'A note must start inside the pattern.';
  if (!isGridPosition(note.start)) return 'A note must start on the grid.';

  if (kind === 'drums') {
    if (!('row' in note)) return 'Drums hold drum hits.';
    if (!(DRUM_ROWS as readonly string[]).includes(note.row)) return 'That drum row does not exist.';
    if ('length' in note) return 'A drum hit has no length.';
    return null;
  }

  if (!('length' in note)) return 'This instrument holds notes with a length.';
  if (!Number.isInteger(note.length) || note.length < MIN_NOTE_TICKS) return 'A note is at least half of a third long.';
  const end = note.start + note.length;
  if (end > limits.end) return 'A note must end inside the pattern.';
  if (!isGridPosition(end)) return 'A note must end on the grid.';

  if (kind === 'strings') {
    if (!('string' in note) || !isStringInstrument(id)) return 'This instrument holds string and fret notes.';
    if (!Number.isInteger(note.string) || note.string < 0 || note.string >= TUNING[id].length) {
      return 'That string does not exist.';
    }
    if (!Number.isInteger(note.fret) || note.fret < 0 || note.fret > limits.maxFret) return 'That fret does not exist.';
    return null;
  }

  if (!('pitch' in note)) return 'Keys holds pitched notes.';
  if (!Number.isInteger(note.pitch) || note.pitch < KEYS_RANGE.low || note.pitch > KEYS_RANGE.high) {
    return 'Keys plays C2 to C6.';
  }
  return null;
}

/** The limits for placing a note by hand: inside the visible pattern and on a fret that is shown. */
function placingLimits(project: Project, id: InstrumentId, pattern: number): NoteLimits {
  return {
    end: visibleTicks(project, id, pattern),
    maxFret: project.instruments[id].fretCount ?? FRET_MAX,
  };
}

function patternExists(project: Project, id: InstrumentId, pattern: number): boolean {
  const instrument = project.instruments[id];
  return Number.isInteger(pattern) && pattern >= 0 && pattern < instrument.shownPatterns;
}

// ---- Editing notes ----

/** Places a note. It becomes the pattern's first note and so makes the pattern active. */
export function addNote(project: Project, id: InstrumentId, pattern: number, note: Note): Outcome {
  if (!patternExists(project, id, pattern)) return refuse('That pattern does not exist.');
  const problem = noteProblem(id, note, placingLimits(project, id, pattern));
  if (problem) return refuse(problem);
  const key = noteKey(note);
  const existing = project.instruments[id].patterns[pattern];
  if (existing?.notes.some((n) => noteKey(n) === key)) return refuse('A note is already there.');
  return ok(updatePattern(project, id, pattern, (p) => ({ ...p, notes: [...p.notes, note] })));
}

/** Removes the note with the same key as the given one. The pattern stays as it is, empty if that was its last note. */
export function removeNote(project: Project, id: InstrumentId, pattern: number, note: Note): Project {
  const key = noteKey(note);
  return updatePattern(project, id, pattern, (p) => {
    const notes = p.notes.filter((n) => noteKey(n) !== key);
    return notes.length === p.notes.length ? p : { ...p, notes };
  });
}

/** Replaces one note by another: moving it, or dragging it longer or shorter. */
export function replaceNote(project: Project, id: InstrumentId, pattern: number, from: Note, to: Note): Outcome {
  if (!patternExists(project, id, pattern)) return refuse('That pattern does not exist.');
  const problem = noteProblem(id, to, placingLimits(project, id, pattern));
  if (problem) return refuse(problem);
  const fromKey = noteKey(from);
  const toKey = noteKey(to);
  const notes = project.instruments[id].patterns[pattern]?.notes ?? [];
  if (!notes.some((n) => noteKey(n) === fromKey)) return refuse('There is no such note.');
  if (toKey !== fromKey && notes.some((n) => noteKey(n) === toKey)) return refuse('A note is already there.');
  return ok(
    updatePattern(project, id, pattern, (p) => ({
      ...p,
      notes: p.notes.map((n) => (noteKey(n) === fromKey ? to : n)),
    })),
  );
}

// ---- Editing several notes at once (a selection) ----

/**
 * Places several notes as one edit (a paste or a duplicate). A note that is already there is
 * skipped, so pasting twice in one place changes nothing; any other problem refuses the whole edit.
 */
export function addNotes(project: Project, id: InstrumentId, pattern: number, notes: readonly Note[]): Outcome {
  if (!patternExists(project, id, pattern)) return refuse('That pattern does not exist.');
  const limits = placingLimits(project, id, pattern);
  for (const note of notes) {
    const problem = noteProblem(id, note, limits);
    if (problem) return refuse(problem);
  }
  const existing = project.instruments[id].patterns[pattern]?.notes ?? [];
  const keys = new Set(existing.map(noteKey));
  const extra: Note[] = [];
  for (const note of notes) {
    const key = noteKey(note);
    if (keys.has(key)) continue;
    keys.add(key);
    extra.push(note);
  }
  if (extra.length === 0) return ok(project);
  return ok(updatePattern(project, id, pattern, (p) => ({ ...p, notes: [...p.notes, ...extra] })));
}

/** Removes several notes as one edit (Delete on a selection, or a cut). */
export function removeNotes(project: Project, id: InstrumentId, pattern: number, notes: readonly Note[]): Project {
  const keys = new Set(notes.map(noteKey));
  return updatePattern(project, id, pattern, (p) => {
    const kept = p.notes.filter((n) => !keys.has(noteKey(n)));
    return kept.length === p.notes.length ? p : { ...p, notes: kept };
  });
}

/**
 * Replaces several notes by others as one edit: a selection moved or made longer. `to[i]` takes the
 * place of `from[i]`. Refused if a new note does not fit the layout or the pattern, lands on a note
 * that is not being moved, or two of the new notes are the same note.
 */
export function replaceNotes(
  project: Project,
  id: InstrumentId,
  pattern: number,
  from: readonly Note[],
  to: readonly Note[],
): Outcome {
  if (!patternExists(project, id, pattern)) return refuse('That pattern does not exist.');
  if (from.length !== to.length) return refuse('Every moved note needs a place.');
  const limits = placingLimits(project, id, pattern);
  for (const note of to) {
    const problem = noteProblem(id, note, limits);
    if (problem) return refuse(problem);
  }
  const notes = project.instruments[id].patterns[pattern]?.notes ?? [];
  const fromKeys = new Set(from.map(noteKey));
  const present = new Set(notes.map(noteKey));
  if (from.some((n) => !present.has(noteKey(n)))) return refuse('There is no such note.');
  const unchanged = from.every((n, i) => {
    const t = to[i];
    return t !== undefined && noteKey(t) === noteKey(n) && noteEnd(t) === noteEnd(n);
  });
  if (unchanged) return ok(project);
  const staying = new Set(notes.filter((n) => !fromKeys.has(noteKey(n))).map(noteKey));
  const toKeys = new Set<string>();
  for (const note of to) {
    const key = noteKey(note);
    if (staying.has(key) || toKeys.has(key)) return refuse('A note is already there.');
    toKeys.add(key);
  }
  return ok(
    updatePattern(project, id, pattern, (p) => ({
      ...p,
      notes: [...p.notes.filter((n) => !fromKeys.has(noteKey(n))), ...to],
    })),
  );
}

// ---- Editing patterns ----

/**
 * Sets a pattern's length to 1x, 2x, 4x or 8x, also after notes are placed. Notes outside a shorter
 * pattern are kept. Lengthening is refused if a Song block of the pattern would then overlap the
 * next block or pass bar 256, because editing a pattern changes every place it is used.
 */
export function setPatternBars(project: Project, id: InstrumentId, pattern: number, bars: PatternBars): Outcome {
  if (!patternExists(project, id, pattern)) return refuse('That pattern does not exist.');
  const instrument = project.instruments[id];
  const current = instrument.patterns[pattern];
  if (!current || current.bars === bars) return ok(project);
  if (bars > current.bars) {
    const spans = instrument.lane.map((b) => ({
      startBar: b.startBar,
      bars: b.pattern === pattern ? bars : blockBars(project, id, b),
    }));
    if (!laneFits(spans)) return refuse('A longer pattern would overlap the next block in the Song.');
  }
  return ok(updatePattern(project, id, pattern, (p) => ({ ...p, bars })));
}

/**
 * Copies the notes of one pattern into another of the same instrument. 'replace' (the default,
 * assumed) leaves the target with exactly the source's notes; 'add' keeps the target's notes and
 * adds the source's, dropping exact duplicates. The target keeps its own length. Hidden notes are
 * copied too.
 */
export function copyNotes(
  project: Project,
  id: InstrumentId,
  from: number,
  to: number,
  mode: 'replace' | 'add' = 'replace',
): Outcome {
  if (!patternExists(project, id, from) || !patternExists(project, id, to)) return refuse('That pattern does not exist.');
  if (from === to) return refuse('Pick a different pattern to copy into.');
  const source = project.instruments[id].patterns[from];
  if (!source) return refuse('That pattern does not exist.');
  return ok(
    updatePattern(project, id, to, (target): Pattern => {
      if (mode === 'replace') return { ...target, notes: source.notes.slice() };
      const keys = new Set(target.notes.map(noteKey));
      const extra = source.notes.filter((n) => !keys.has(noteKey(n)));
      return extra.length === 0 ? target : { ...target, notes: [...target.notes, ...extra] };
    }),
  );
}
