/**
 * The state of the app window, as a reducer. It holds the project history (src/core/history.ts) and
 * the screen state the project model deliberately leaves out: the page, whether it is playing, the
 * metronome, isolate, the note value and so on. Pure, so it is tested without a window. Every change
 * to the project goes through an `edit`, which runs one of the model's pure functions and lands in the
 * history; nothing here changes a project by hand.
 */
import type { PlayRequest } from '../audio/engine';
import { commit, newHistory, replacePresent, undo, type History } from '../core/history';
import { INSTRUMENT_IDS, type InstrumentId } from '../core/instruments';
import { createProject, type Project } from '../core/project';
import type { ImportReport } from '../core/midi/build';
import { songBars, type BlockRef } from '../core/song';
import type { NoteValue } from '../core/time';
import type { BlockClipboard, NoteClipboard } from './clipboard';
import { EDITOR_VIEW_DEFAULT, SONG_BAR_PX_DEFAULT, SONG_BAR_PX_MAX, SONG_BAR_PX_MIN, type EditorView } from './view';

/** The seven tabs, in the order the user asked for (sweeping changes, 2026-11-09): the instruments, then the Song and the Mixer. */
export const PAGES = ['rhythm', 'lead', 'bass', 'drums', 'keys', 'song', 'mixer'] as const;
export type Page = (typeof PAGES)[number];

export const PAGE_LABELS: Record<Page, string> = {
  rhythm: 'Rhythm',
  lead: 'Lead',
  bass: 'Bass',
  drums: 'Drums',
  keys: 'Keys',
  song: 'Song',
  mixer: 'Mixer',
};

/** The instrument a page edits, or null for the Song and the Mixer. */
export function pageInstrument(page: Page): InstrumentId | null {
  return page === 'song' || page === 'mixer' ? null : page;
}

export interface AppState {
  history: History;
  page: Page;
  playing: boolean;
  metronome: boolean;
  /** Engine state, not project state: not saved, not undone. Only one at a time. */
  isolated: InstrumentId | null;
  /** The note value chosen on the instrument pages (the 16th is the one the designs show as chosen). */
  noteValue: NoteValue;
  /** How much of a pattern the instrument pages show across their width (horizontal zoom), shared by them. */
  editorView: EditorView;
  /** The width of a bar on the Song page, in pixels (its horizontal zoom). */
  songBarPx: number;
  /** The bar the Song page's playhead stands on, 0 based. Playback in Song mode starts here. */
  startBar: number;
  /** The selected Song blocks (Delete, copy, move). Not saved, not undone. */
  selectedBlocks: BlockRef[];
  /** Notes copied on an instrument page, and Song blocks copied on the Song page. Not saved, not undone. */
  noteClipboard: NoteClipboard | null;
  blockClipboard: BlockClipboard | null;
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
    editorView: EDITOR_VIEW_DEFAULT,
    songBarPx: SONG_BAR_PX_DEFAULT,
    startBar: 0,
    selectedBlocks: [],
    noteClipboard: null,
    blockClipboard: null,
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
  | { type: 'setEditorView'; view: EditorView }
  | { type: 'setSongBarPx'; px: number }
  | { type: 'setStartBar'; bar: number }
  | { type: 'selectBlocks'; blocks: BlockRef[] }
  | { type: 'setNoteClipboard'; clipboard: NoteClipboard | null }
  | { type: 'setBlockClipboard'; clipboard: BlockClipboard | null }
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

function sameBlocks(a: readonly BlockRef[], b: readonly BlockRef[]): boolean {
  return a.length === b.length && a.every((x, i) => x.instrument === b[i]?.instrument && x.startBar === b[i]?.startBar);
}

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
    case 'setEditorView': {
      const a = state.editorView;
      const b = action.view;
      return a.fit === b.fit && a.barsInView === b.barsInView ? state : { ...state, editorView: b };
    }
    case 'setSongBarPx': {
      const px = Number.isFinite(action.px) ? Math.min(SONG_BAR_PX_MAX, Math.max(SONG_BAR_PX_MIN, action.px)) : state.songBarPx;
      return px === state.songBarPx ? state : { ...state, songBarPx: px };
    }
    case 'setStartBar': {
      const bar = Number.isInteger(action.bar) && action.bar > 0 ? action.bar : 0;
      return bar === state.startBar ? state : { ...state, startBar: bar };
    }
    case 'selectBlocks':
      return sameBlocks(state.selectedBlocks, action.blocks) ? state : { ...state, selectedBlocks: action.blocks };
    case 'setNoteClipboard':
      return action.clipboard === state.noteClipboard ? state : { ...state, noteClipboard: action.clipboard };
    case 'setBlockClipboard':
      return action.clipboard === state.blockClipboard ? state : { ...state, blockClipboard: action.clipboard };
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
        selectedBlocks: [],
        // Copied blocks point at patterns by number, which are other patterns in another project.
        blockClipboard: null,
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
    case 'rhythm':
    case 'lead':
    case 'bass':
    case 'drums':
    case 'keys':
      return { mode: 'pattern', focus: state.page };
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
