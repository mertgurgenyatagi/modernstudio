/**
 * The state of the app window, as a reducer. It holds the project history (src/core/history.ts) and
 * the screen state the project model deliberately leaves out: the page, whether it is playing, the
 * metronome, isolate, the note value and so on. Pure, so it is tested without a window. Every change
 * to the project goes through an `edit`, which runs one of the model's pure functions and lands in the
 * history; nothing here changes a project by hand.
 */
import type { PlayRequest } from '../audio/engine';
import { commit, newHistory, replacePresent, undo, type History } from '../core/history';
import { INSTRUMENT_IDS, type InstrumentId, type StringInstrumentId } from '../core/instruments';
import { createProject, type Project } from '../core/project';
import type { ImportReport } from '../core/midi/build';
import { songBars } from '../core/song';
import type { NoteValue } from '../core/time';

export const PAGES = ['mixer', 'song', 'drums', 'guitar', 'keys'] as const;
export type Page = (typeof PAGES)[number];

export const PAGE_LABELS: Record<Page, string> = {
  mixer: 'Mixer',
  song: 'Song',
  drums: 'Drums',
  guitar: 'Guitar',
  keys: 'Keys',
};

export interface AppState {
  history: History;
  page: Page;
  playing: boolean;
  metronome: boolean;
  /** Engine state, not project state: not saved, not undone. Only one at a time. */
  isolated: InstrumentId | null;
  /** The note value chosen on the instrument pages (the 16th is the one the designs show as chosen). */
  noteValue: NoteValue;
  showWholePattern: boolean;
  /** Which of Bass, Rhythm Guitar and Lead Guitar the Guitar page shows. */
  guitar: StringInstrumentId;
  /** The bar the Song page's playhead stands on, 0 based. Playback in Song mode starts here. */
  startBar: number;
  /** The Song page's brush: which instrument's lane a click places into. */
  brush: InstrumentId;
  /** The Song block that Delete removes: its lane and start bar. Not saved, not undone. */
  selectedBlock: { instrument: InstrumentId; startBar: number } | null;
  /** Set when the recorded sounds could not be loaded. */
  soundsError: string | null;
  /** The file the project is saved in, or null for a project that has not been saved yet. */
  filePath: string | null;
  /** The project as last saved or opened. "Unsaved changes" means the present project differs from it (core/fileState.ts). */
  savedProject: Project;
  /** A quiet line about a file command (it could not be opened or saved), or null. Not saved, not undone. */
  notice: string | null;
  /** The name of a project that has no file yet: a MIDI import is named after its MIDI file. Null means "Untitled". */
  draftName: string | null;
  /** What the last MIDI import did, waiting to be shown (step 18). Null for any project that was not just imported. Not saved, not undone. */
  importReport: ImportReport | null;
}

export function initialState(project: Project = createProject()): AppState {
  return {
    history: newHistory(project),
    page: 'mixer',
    playing: false,
    metronome: false,
    isolated: null,
    noteValue: 'sixteenth',
    showWholePattern: false,
    guitar: 'bass',
    startBar: 0,
    brush: 'drums',
    selectedBlock: null,
    soundsError: null,
    filePath: null,
    savedProject: project,
    notice: null,
    draftName: null,
    importReport: null,
  };
}

/** What a MIDI import adds to `replaceProject`: a name, "never saved", and the report. */
export interface ReplaceOptions {
  /** The name of a project with no file (shown in the title and offered when saving). */
  name?: string | null;
  /** The project is not on disk: it counts as having unsaved changes until the first Save. */
  unsaved?: boolean;
  report?: ImportReport | null;
}

export type Action =
  /** A project edit through the model's pure functions. The same `key` in a row is one Undo step (a slider drag). */
  | { type: 'edit'; change: (project: Project) => Project; key?: string }
  /** A choice that Undo leaves alone, such as the selected pattern. */
  | { type: 'select'; change: (project: Project) => Project }
  /** The next edit with the same key starts a new Undo step. */
  | { type: 'endDrag' }
  | { type: 'undo' }
  | { type: 'setPage'; page: Page }
  | { type: 'toggleIsolate'; id: InstrumentId }
  | { type: 'setMetronome'; on: boolean }
  | { type: 'setNoteValue'; value: NoteValue }
  | { type: 'setShowWholePattern'; on: boolean }
  | { type: 'setGuitar'; id: StringInstrumentId }
  | { type: 'setStartBar'; bar: number }
  | { type: 'setBrush'; id: InstrumentId }
  | { type: 'selectBlock'; block: { instrument: InstrumentId; startBar: number } | null }
  | { type: 'started' }
  | { type: 'stopped' }
  | { type: 'soundsFailed'; message: string }
  /** New, Open and (later) MIDI import: a different project, with a new history, no playback and the playhead at the start. */
  | { type: 'replaceProject'; project: Project; path: string | null; options?: ReplaceOptions }
  /** The import report was read and closed. */
  | { type: 'dismissReport' }
  /** The project was written to `path`: that is now the saved state. `project` is what was written, not necessarily the present one. */
  | { type: 'saved'; path: string; project: Project }
  | { type: 'setNotice'; message: string | null };

/** A meter change moves the bar lines under the playhead, so playback stops (the engine stops itself too). */
function stopOnMeterChange(before: AppState, after: AppState): AppState {
  if (after.playing && after.history.present.meter !== before.history.present.meter) return { ...after, playing: false };
  return after;
}

export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'edit': {
      const history = commit(state.history, action.change(state.history.present), action.key);
      return history === state.history ? state : stopOnMeterChange(state, { ...state, history });
    }
    case 'select': {
      const history = replacePresent(state.history, action.change(state.history.present));
      return history === state.history ? state : { ...state, history };
    }
    case 'endDrag':
      return state.history.lastKey === null ? state : { ...state, history: { ...state.history, lastKey: null } };
    case 'undo': {
      const history = undo(state.history);
      return history === state.history ? state : stopOnMeterChange(state, { ...state, history });
    }
    case 'setPage':
      return action.page === state.page ? state : { ...state, page: action.page };
    case 'toggleIsolate':
      return { ...state, isolated: state.isolated === action.id ? null : action.id };
    case 'setMetronome':
      return action.on === state.metronome ? state : { ...state, metronome: action.on };
    case 'setNoteValue':
      return action.value === state.noteValue ? state : { ...state, noteValue: action.value };
    case 'setShowWholePattern':
      return action.on === state.showWholePattern ? state : { ...state, showWholePattern: action.on };
    case 'setGuitar':
      return action.id === state.guitar ? state : { ...state, guitar: action.id };
    case 'setStartBar': {
      const bar = Number.isInteger(action.bar) && action.bar > 0 ? action.bar : 0;
      return bar === state.startBar ? state : { ...state, startBar: bar };
    }
    case 'setBrush':
      return action.id === state.brush ? state : { ...state, brush: action.id };
    case 'selectBlock': {
      const a = state.selectedBlock;
      const b = action.block;
      if (a === b || (a && b && a.instrument === b.instrument && a.startBar === b.startBar)) return state;
      return { ...state, selectedBlock: b };
    }
    case 'started':
      return state.playing ? state : { ...state, playing: true };
    case 'stopped':
      return state.playing ? { ...state, playing: false } : state;
    case 'soundsFailed':
      return { ...state, soundsError: action.message };
    case 'replaceProject':
      return {
        ...state,
        history: newHistory(action.project),
        playing: false,
        startBar: 0,
        selectedBlock: null,
        filePath: action.path,
        // An unsaved project (an import) is compared with an empty one, so it counts as changed until it is saved.
        savedProject: action.options?.unsaved ? createProject() : action.project,
        notice: null,
        draftName: action.path === null ? (action.options?.name ?? null) : null,
        importReport: action.options?.report ?? null,
      };
    case 'dismissReport':
      return state.importReport === null ? state : { ...state, importReport: null };
    case 'saved':
      return { ...state, filePath: action.path, savedProject: action.project, notice: null, draftName: null };
    case 'setNotice':
      return action.message === state.notice ? state : { ...state, notice: action.message };
  }
}

/**
 * What Play plays on each page. Instrument pages loop that instrument's selected pattern (with the
 * others' selected patterns beside it). The Song page plays the Song from the playhead. The Mixer
 * plays the Song if it has blocks and otherwise the selected patterns (assumed; docs/open-items.md).
 */
export function playRequestFor(state: AppState): PlayRequest {
  const project = state.history.present;
  switch (state.page) {
    case 'drums':
      return { mode: 'pattern', focus: 'drums' };
    case 'guitar':
      return { mode: 'pattern', focus: state.guitar };
    case 'keys':
      return { mode: 'pattern', focus: 'keys' };
    case 'song':
      return { mode: 'song', startBar: state.startBar };
    case 'mixer':
      return songBars(project) > 0
        ? { mode: 'song', startBar: state.startBar }
        : { mode: 'pattern', focus: longestSelected(project) };
  }
}

/** The instrument whose selected pattern is the longest, so that no pattern is cut short in the loop. Ties go to the first. */
export function longestSelected(project: Project): InstrumentId {
  let best: InstrumentId = INSTRUMENT_IDS[0];
  let bestBars = 0;
  for (const id of INSTRUMENT_IDS) {
    const instrument = project.instruments[id];
    const bars = instrument.patterns[instrument.selectedPattern]?.bars ?? 1;
    if (bars > bestBars) {
      best = id;
      bestBars = bars;
    }
  }
  return best;
}
