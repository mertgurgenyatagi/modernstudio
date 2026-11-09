import { describe, expect, it } from 'vitest';
import { canUndo } from '../core/history';
import { isDirty } from '../core/fileState';
import type { ImportReport } from '../core/midi/build';
import { addNote, setPatternBars } from '../core/patterns';
import { selectPattern, setBpm, setMasterVolume, setMeter, setMuted, setVolume } from '../core/project';
import { moveBlock, placeBlock } from '../core/song';
import { must } from '../core/testing';
import { initialState, longestSelected, playRequestFor, reduce, type Action, type AppState } from './appState';

function run(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reduce, state);
}

const volume = (value: number, key = 'volume:drums'): Action => ({
  type: 'edit',
  change: (p) => setVolume(p, 'drums', value),
  key,
});

describe('edits and Undo', () => {
  it('sends a project edit through the history', () => {
    const s = run(initialState(), { type: 'edit', change: (p) => setBpm(p, 100) });
    expect(s.history.present.bpm).toBe(100);
    expect(canUndo(s.history)).toBe(true);
  });

  it('adds no step for an edit that changes nothing', () => {
    const s0 = initialState();
    const s = run(s0, { type: 'edit', change: (p) => setBpm(p, 120) });
    expect(s).toBe(s0);
  });

  it('undoes one edit at a time, and has no redo', () => {
    let s = run(initialState(), { type: 'edit', change: (p) => setBpm(p, 100) }, { type: 'edit', change: (p) => setBpm(p, 90) });
    s = run(s, { type: 'undo' });
    expect(s.history.present.bpm).toBe(100);
    s = run(s, { type: 'undo' }, { type: 'undo' });
    expect(s.history.present.bpm).toBe(120);
    expect(canUndo(s.history)).toBe(false);
  });

  it('makes a slider drag one step, and the next drag another', () => {
    let s = run(initialState(), volume(70), volume(60), volume(50));
    expect(s.history.past).toHaveLength(1);
    s = run(s, { type: 'endDrag' }, volume(40), volume(30));
    expect(s.history.past).toHaveLength(2);
    expect(run(s, { type: 'undo' }).history.present.instruments.drums.volume).toBe(50);
  });

  it('keeps a master drag and an instrument drag apart', () => {
    const s = run(initialState(), volume(70), { type: 'edit', change: (p) => setMasterVolume(p, 50), key: 'master' });
    expect(s.history.past).toHaveLength(2);
  });

  it('puts mute through the history', () => {
    const s = run(initialState(), { type: 'edit', change: (p) => setMuted(p, 'bass', true) });
    expect(s.history.present.instruments.bass.muted).toBe(true);
    expect(run(s, { type: 'undo' }).history.present.instruments.bass.muted).toBe(false);
  });

  it('does not put a selection through the history', () => {
    const s = run(initialState(), { type: 'select', change: (p) => selectPattern(p, 'drums', 3) });
    expect(s.history.present.instruments.drums.selectedPattern).toBe(3);
    expect(canUndo(s.history)).toBe(false);
  });

  it('does nothing on Undo with no history', () => {
    const s0 = initialState();
    expect(reduce(s0, { type: 'undo' })).toBe(s0);
  });
});

describe('isolate', () => {
  it('isolates one instrument and switches it off again on a second press', () => {
    let s = run(initialState(), { type: 'toggleIsolate', id: 'bass' });
    expect(s.isolated).toBe('bass');
    s = run(s, { type: 'toggleIsolate', id: 'bass' });
    expect(s.isolated).toBeNull();
  });

  it('allows only one at a time: isolating another replaces the first', () => {
    const s = run(initialState(), { type: 'toggleIsolate', id: 'bass' }, { type: 'toggleIsolate', id: 'keys' });
    expect(s.isolated).toBe('keys');
  });

  it('is not an edit: Undo does not step through it', () => {
    const s = run(initialState(), { type: 'toggleIsolate', id: 'bass' });
    expect(canUndo(s.history)).toBe(false);
  });
});

describe('playing', () => {
  it('follows the engine', () => {
    let s = run(initialState(), { type: 'started' });
    expect(s.playing).toBe(true);
    s = run(s, { type: 'stopped' });
    expect(s.playing).toBe(false);
  });

  it('stops when the meter changes, but not when the tempo does', () => {
    let s = run(initialState(), { type: 'started' }, { type: 'edit', change: (p) => setBpm(p, 150) });
    expect(s.playing).toBe(true);
    s = run(s, { type: 'edit', change: (p) => setMeter(p, '3/4') });
    expect(s.playing).toBe(false);
  });

  it('stops when Undo brings the old meter back', () => {
    let s = run(initialState(), { type: 'edit', change: (p) => setMeter(p, '3/4') }, { type: 'started' });
    s = run(s, { type: 'undo' });
    expect(s.history.present.meter).toBe('4/4');
    expect(s.playing).toBe(false);
  });

  it('keeps the metronome and the playhead start across pages', () => {
    const s = run(initialState(), { type: 'setMetronome', on: true }, { type: 'setStartBar', bar: 5 }, { type: 'setPage', page: 'drums' });
    expect(s.metronome).toBe(true);
    expect(s.startBar).toBe(5);
    expect(s.page).toBe('drums');
  });

  it('keeps a bad start bar at the beginning', () => {
    expect(run(initialState(), { type: 'setStartBar', bar: -3 }).startBar).toBe(0);
    expect(run(initialState(), { type: 'setStartBar', bar: 1.5 }).startBar).toBe(0);
  });
});

describe('what Play plays', () => {
  const withSong = (): AppState => {
    const p0 = must(addNote(initialState().history.present, 'drums', 0, { row: 'kick', start: 0 }));
    return initialState(must(placeBlock(p0, 'drums', 0, 0)));
  };

  it('plays the selected patterns on the Mixer when the Song is empty', () => {
    expect(playRequestFor(initialState())).toEqual({ mode: 'pattern', focus: 'drums' });
  });

  it('plays the Song on the Mixer once it has a block, from the playhead', () => {
    expect(playRequestFor(withSong())).toEqual({ mode: 'song', startBar: 0 });
    expect(playRequestFor(run(withSong(), { type: 'setStartBar', bar: 3 }))).toEqual({ mode: 'song', startBar: 3 });
  });

  it('loops the instrument of the page on an instrument page', () => {
    expect(playRequestFor(run(withSong(), { type: 'setPage', page: 'keys' }))).toEqual({ mode: 'pattern', focus: 'keys' });
    expect(playRequestFor(run(initialState(), { type: 'setPage', page: 'drums' }))).toEqual({ mode: 'pattern', focus: 'drums' });
    expect(playRequestFor(run(initialState(), { type: 'setPage', page: 'guitar' }))).toEqual({ mode: 'pattern', focus: 'bass' });
    const lead = run(initialState(), { type: 'setPage', page: 'guitar' }, { type: 'setGuitar', id: 'lead' });
    expect(playRequestFor(lead)).toEqual({ mode: 'pattern', focus: 'lead' });
  });

  it('plays the Song on the Song page', () => {
    const s = run(initialState(), { type: 'setPage', page: 'song' }, { type: 'setStartBar', bar: 4 });
    expect(playRequestFor(s)).toEqual({ mode: 'song', startBar: 4 });
  });

  it('loops the longest selected pattern when playing patterns from the Mixer', () => {
    expect(longestSelected(initialState().history.present)).toBe('drums');
    const longer = must(setPatternBars(initialState().history.present, 'keys', 0, 4));
    expect(longestSelected(longer)).toBe('keys');
    expect(playRequestFor(initialState(longer))).toEqual({ mode: 'pattern', focus: 'keys' });
  });
});

describe('the Song page state', () => {
  it('chooses the brush instrument', () => {
    expect(initialState().brush).toBe('drums');
    expect(run(initialState(), { type: 'setBrush', id: 'keys' }).brush).toBe('keys');
  });

  it('selects a block, and deselects it', () => {
    const block = { instrument: 'bass', startBar: 4 } as const;
    const s = run(initialState(), { type: 'selectBlock', block });
    expect(s.selectedBlock).toEqual(block);
    expect(run(s, { type: 'selectBlock', block: { ...block } })).toBe(s);
    expect(run(s, { type: 'selectBlock', block: null }).selectedBlock).toBeNull();
  });

  it('moves a block through the history, and Undo moves it back', () => {
    let p = must(addNote(initialState().history.present, 'drums', 0, { row: 'kick', start: 0 }));
    p = must(placeBlock(p, 'drums', 0, 0));
    const s = run(initialState(p), {
      type: 'edit',
      change: (project) => must(moveBlock(project, 'drums', 0, 3)),
    });
    expect(s.history.present.instruments.drums.lane).toEqual([{ pattern: 0, startBar: 3 }]);
    expect(run(s, { type: 'undo' }).history.present.instruments.drums.lane).toEqual([{ pattern: 0, startBar: 0 }]);
  });
});

describe('files', () => {
  const other = () => must(addNote(initialState().history.present, 'drums', 0, { row: 'kick', start: 0 }));

  it('starts with no file and the new project as the saved one', () => {
    const s = initialState();
    expect(s.filePath).toBeNull();
    expect(s.savedProject).toBe(s.history.present);
    expect(s.notice).toBeNull();
  });

  it('replaces the project with a new history, no playback and the playhead at the start', () => {
    let s = run(
      initialState(),
      { type: 'edit', change: (p) => setBpm(p, 100) },
      { type: 'setStartBar', bar: 5 },
      { type: 'selectBlock', block: { instrument: 'bass', startBar: 2 } },
      { type: 'started' },
      { type: 'setNotice', message: 'old' },
    );
    const project = other();
    s = run(s, { type: 'replaceProject', project, path: 'songs/a.modernstudio' });
    expect(s.history.present).toBe(project);
    expect(canUndo(s.history)).toBe(false);
    expect(s.playing).toBe(false);
    expect(s.startBar).toBe(0);
    expect(s.selectedBlock).toBeNull();
    expect(s.filePath).toBe('songs/a.modernstudio');
    expect(s.savedProject).toBe(project);
    expect(s.notice).toBeNull();
  });

  it('opens an imported project as unsaved, named after its MIDI file, with the report waiting', () => {
    const project = other();
    const report = { bpm: 120 } as unknown as ImportReport;
    let s = run(initialState(), { type: 'replaceProject', project, path: null, options: { name: 'Soma (8)', unsaved: true, report } });
    expect(s.history.present).toBe(project);
    expect(canUndo(s.history)).toBe(false);
    expect(s.filePath).toBeNull();
    expect(s.draftName).toBe('Soma (8)');
    expect(s.importReport).toBe(report);
    expect(isDirty(s.history.present, s.savedProject)).toBe(true);
    s = run(s, { type: 'dismissReport' });
    expect(s.importReport).toBeNull();
    expect(s.draftName).toBe('Soma (8)');
    expect(run(s, { type: 'dismissReport' })).toBe(s);
  });

  it('forgets the draft name and the report when another project replaces it, and when it is saved', () => {
    const report = { bpm: 120 } as unknown as ImportReport;
    const imported = run(initialState(), { type: 'replaceProject', project: other(), path: null, options: { name: 'Soma (8)', unsaved: true, report } });
    const opened = run(imported, { type: 'replaceProject', project: other(), path: 'a.modernstudio' });
    expect(opened.draftName).toBeNull();
    expect(opened.importReport).toBeNull();
    expect(isDirty(opened.history.present, opened.savedProject)).toBe(false);
    const fresh = run(imported, { type: 'replaceProject', project: other(), path: null });
    expect(fresh.draftName).toBeNull();
    const saved = run(imported, { type: 'saved', path: 'soma.modernstudio', project: imported.history.present });
    expect(saved.draftName).toBeNull();
    expect(saved.filePath).toBe('soma.modernstudio');
    expect(isDirty(saved.history.present, saved.savedProject)).toBe(false);
  });

  it('keeps the screen choices when the project is replaced', () => {
    const s = run(initialState(), { type: 'setPage', page: 'keys' }, { type: 'setMetronome', on: true }, { type: 'replaceProject', project: other(), path: null });
    expect(s.page).toBe('keys');
    expect(s.metronome).toBe(true);
    expect(s.filePath).toBeNull();
  });

  it('marks what was written as saved, even when the project has changed since', () => {
    let s = run(initialState(), { type: 'edit', change: (p) => setBpm(p, 100) });
    const written = s.history.present;
    s = run(s, { type: 'edit', change: (p) => setBpm(p, 90) }, { type: 'saved', path: 'songs/b.modernstudio', project: written });
    expect(s.filePath).toBe('songs/b.modernstudio');
    expect(s.savedProject).toBe(written);
    expect(s.history.present.bpm).toBe(90);
    expect(canUndo(s.history)).toBe(true);
  });

  it('sets and clears the notice', () => {
    const s = run(initialState(), { type: 'setNotice', message: 'Could not save.' });
    expect(s.notice).toBe('Could not save.');
    expect(run(s, { type: 'setNotice', message: 'Could not save.' })).toBe(s);
    expect(run(s, { type: 'setNotice', message: null }).notice).toBeNull();
  });
});
