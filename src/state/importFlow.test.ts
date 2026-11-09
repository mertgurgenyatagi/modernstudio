import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { convertMidi } from '../core/midi/build';
import type { TrackGuess } from '../core/midi/guess';
import type { MidiFile, MidiNote, MidiTrack } from '../core/midi/read';
import { analyseTiming } from '../core/midi/timing';
import {
  IDLE,
  canConvert,
  changesText,
  loadMidi,
  midiName,
  panelShown,
  patternsText,
  previewMapping,
  reduceImport,
  refusalText,
  setAssignment,
  tracksFor,
  type ImportAction,
  type ImportStage,
  type LoadedMidi,
  type Preview,
  type PreviewCache,
} from './importFlow';

const PPQ = 480;
const BAR = PPQ * 4;

function note(start: number, end: number, pitch: number, channel = 0): MidiNote {
  return { start, end, pitch, channel, velocity: 100 };
}

function track(name: string, notes: MidiNote[], program?: number): MidiTrack {
  return { name, notes, programs: program === undefined ? [] : [{ tick: 0, channel: notes[0]?.channel ?? 0, program }] };
}

function fileOf(tracks: MidiTrack[]): MidiFile {
  const endTick = Math.max(0, ...tracks.flatMap((t) => t.notes.map((n) => n.end)));
  return { format: 1, ticksPerQuarter: PPQ, tracks, tempos: [], timeSignatures: [], endTick };
}

/** Eight bars of a kick on every beat, plus a hit on a tom (dropped), a bass line with one note too low, and a vocal line. */
const file = fileOf([
  track(
    'Drums',
    Array.from({ length: 32 }, (_, i) => note(i * PPQ, i * PPQ + 60, 36, 9)).concat([note(0, 60, 45, 9), note(PPQ, PPQ + 60, 45, 9)]),
  ),
  track('Bass', [...Array.from({ length: 8 }, (_, bar) => note(bar * BAR, bar * BAR + PPQ, 40)), note(BAR, BAR + PPQ, 20)], 33),
  track('Julian', [note(0, PPQ, 60), note(BAR * 4, BAR * 4 + PPQ, 64)]),
  track('Second bass', [note(0, PPQ, 43), note(BAR * 2, BAR * 2 + PPQ, 43)], 33),
]);

function loaded(): LoadedMidi {
  const timing = must2(analyseTiming(file));
  const rows: TrackGuess[] = file.tracks.map((t, index) => ({
    index,
    name: t.name,
    notes: t.notes.length,
    program: null,
    assignment: index === 0 ? 'drums' : index === 1 ? 'bass' : index === 2 ? 'keys' : 'skip',
  }));
  return { file, timing, rows };
}

function must2<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}

function run(state: ImportStage, ...actions: ImportAction[]): ImportStage {
  return actions.reduce(reduceImport, state);
}

describe('the flow stages', () => {
  it('goes idle, choosing, reading, mapping', () => {
    let s = run(IDLE, { type: 'start' });
    expect(s.stage).toBe('choosing');
    s = run(s, { type: 'chosen', name: 'Soma' });
    expect(s).toEqual({ stage: 'reading', name: 'Soma' });
    s = run(s, { type: 'read', name: 'Soma', result: { ok: true, value: loaded() } });
    expect(s.stage).toBe('mapping');
    expect(panelShown(s)).toBe(true);
  });

  it('ignores actions that do not fit the stage', () => {
    expect(run(IDLE, { type: 'chosen', name: 'x' })).toBe(IDLE);
    expect(run(IDLE, { type: 'convert' })).toBe(IDLE);
    expect(run(IDLE, { type: 'close' })).toBe(IDLE);
    const choosing = run(IDLE, { type: 'start' });
    expect(run(choosing, { type: 'start' })).toBe(choosing);
    expect(run(choosing, { type: 'read', name: 'x', result: { ok: true, value: loaded() } })).toBe(choosing);
  });

  it('cancels from the dialog, the reading and the mapping, with nothing kept', () => {
    expect(run(IDLE, { type: 'start' }, { type: 'close' })).toBe(IDLE);
    expect(run(IDLE, { type: 'start' }, { type: 'chosen', name: 'a' }, { type: 'close' })).toBe(IDLE);
    const mapping = run(IDLE, { type: 'start' }, { type: 'chosen', name: 'a' }, { type: 'read', name: 'a', result: { ok: true, value: loaded() } });
    expect(run(mapping, { type: 'close' })).toBe(IDLE);
  });

  it('refuses a file that could not be read, with the file name and the reason', () => {
    const s = run(IDLE, { type: 'start' }, { type: 'chosen', name: 'odd' }, { type: 'read', name: 'odd', result: { ok: false, reason: 'This is not a MIDI file.' } });
    expect(s).toEqual({ stage: 'refused', reason: 'odd was not imported. This is not a MIDI file.' });
    expect(panelShown(s)).toBe(false);
    expect(run(s, { type: 'close' })).toBe(IDLE);
  });

  it('goes through converting to done, and cannot be closed while converting', () => {
    const mapping = run(IDLE, { type: 'start' }, { type: 'chosen', name: 'a' }, { type: 'read', name: 'a', result: { ok: true, value: loaded() } });
    const converting = run(mapping, { type: 'convert' });
    expect(converting.stage).toBe('converting');
    expect(panelShown(converting)).toBe(true);
    expect(run(converting, { type: 'close' })).toBe(converting);
    const outcome = must2(convertMidi(file, loaded().rows));
    const done = run(converting, { type: 'converted', name: 'a', result: { ok: true, value: outcome } });
    expect(done.stage).toBe('done');
    expect(run(done, { type: 'close' })).toBe(IDLE);
  });

  it('turns a refusal from the conversion into a refused stage', () => {
    const mapping = run(IDLE, { type: 'start' }, { type: 'chosen', name: 'a' }, { type: 'read', name: 'a', result: { ok: true, value: loaded() } });
    const s = run(mapping, { type: 'convert' }, { type: 'converted', name: 'a', result: { ok: false, reason: 'Nothing to import.' } });
    expect(s).toEqual({ stage: 'refused', reason: 'a was not imported. Nothing to import.' });
  });

  it('does not convert when every track is on Skip', () => {
    const l = loaded();
    const allSkip: LoadedMidi = { ...l, rows: l.rows.map((r) => ({ ...r, assignment: 'skip' })) };
    const mapping: ImportStage = { stage: 'mapping', name: 'a', loaded: allSkip };
    expect(run(mapping, { type: 'convert' })).toBe(mapping);
  });
});

describe('the mapping rows', () => {
  it('changes one row and leaves the others', () => {
    const rows = loaded().rows;
    const next = setAssignment(rows, 3, 'lead');
    expect(next.find((r) => r.index === 3)?.assignment).toBe('lead');
    expect(next.filter((r) => r.index !== 3)).toEqual(rows.filter((r) => r.index !== 3));
    expect(rows.find((r) => r.index === 3)?.assignment).toBe('skip');
  });

  it('gives back the same rows when nothing changes', () => {
    const rows = loaded().rows;
    expect(setAssignment(rows, 1, 'bass')).toBe(rows);
    expect(setAssignment(rows, 99, 'lead')).toBe(rows);
  });

  it('lets two tracks go to one instrument', () => {
    const rows = setAssignment(loaded().rows, 3, 'bass');
    expect(tracksFor(rows, 'bass')).toEqual([1, 3]);
  });

  it('can convert when at least one track is mapped', () => {
    expect(canConvert(loaded().rows)).toBe(true);
    expect(canConvert(loaded().rows.map((r) => ({ ...r, assignment: 'skip' as const })))).toBe(false);
    expect(canConvert([])).toBe(false);
  });

  it('updates the assignment through the reducer, only in the mapping stage', () => {
    const mapping: ImportStage = { stage: 'mapping', name: 'a', loaded: loaded() };
    const s = run(mapping, { type: 'assign', index: 3, assignment: 'rhythm' });
    expect(s.stage === 'mapping' && tracksFor(s.loaded.rows, 'rhythm')).toEqual([3]);
    expect(run(IDLE, { type: 'assign', index: 3, assignment: 'rhythm' })).toBe(IDLE);
    expect(run(mapping, { type: 'assign', index: 0, assignment: 'drums' })).toBe(mapping);
  });
});

describe('the figures beside each row', () => {
  it('counts notes, octave moves, dropped hits and patterns per row and per instrument', () => {
    const l = loaded();
    const p = previewMapping(l.file, l.timing, l.rows);
    const drums = p.rows.get(0);
    expect(drums?.droppedHits).toBe(2);
    expect(drums?.notes).toBe(32);
    expect(drums?.patterns).toBe(1);
    expect(drums?.fits).toBe(true);
    const bass = p.rows.get(1);
    expect(bass?.octaveMoves).toBe(1); // the note at pitch 20 is moved up into the range
    expect(p.rows.has(3)).toBe(false); // Skip has no figures
    expect(p.instruments.rhythm).toBeNull();
    expect(p.instruments.drums).toBe(drums);
  });

  it('shows a merged instrument as a whole and each of its rows alone', () => {
    const l = loaded();
    const rows = setAssignment(l.rows, 3, 'bass');
    const p = previewMapping(l.file, l.timing, rows);
    const whole = p.instruments.bass;
    expect(whole?.notes).toBeGreaterThan(p.rows.get(1)?.notes ?? Infinity);
    expect(p.rows.get(3)?.notes).toBe(2);
  });

  it('reuses what it has already worked out', () => {
    const l = loaded();
    const cache: PreviewCache = new Map();
    const first = previewMapping(l.file, l.timing, l.rows, cache);
    const again = previewMapping(l.file, l.timing, l.rows, cache);
    expect(again.instruments.bass).toBe(first.instruments.bass);
    expect(cache.size).toBe(3);
  });

  it('words the figures, and "needs 143, 120 fit" for a lane that is too long', () => {
    const fits: Preview = { notes: 10, octaveMoves: 0, droppedHits: 0, patterns: 1, fits: true, fretCount: 5 };
    expect(patternsText(fits)).toBe('1 pattern');
    expect(patternsText({ ...fits, patterns: 14 })).toBe('14 patterns');
    expect(patternsText({ ...fits, patterns: 143, fits: false })).toBe('needs 143, 120 fit');
    expect(changesText('bass', fits)).toBe('no octave moves');
    expect(changesText('bass', { ...fits, octaveMoves: 1 })).toBe('1 note moved an octave');
    expect(changesText('keys', { ...fits, octaveMoves: 12 })).toBe('12 notes moved an octave');
    expect(changesText('drums', fits)).toBe('no hits dropped');
    expect(changesText('drums', { ...fits, droppedHits: 225 })).toBe('225 hits dropped');
  });
});

describe('reading a picked file', () => {
  it('names the project after the file without its extension', () => {
    expect(midiName('Strokes (The) — Is This it (2) [MIDIfind.com].mid')).toBe('Strokes (The) — Is This it (2) [MIDIfind.com]');
    expect(midiName('song.MIDI')).toBe('song');
    expect(midiName('C:\\songs\\a.mid')).toBe('a');
    expect(midiName('.mid')).toBe('Imported song');
    expect(midiName('no extension')).toBe('no extension');
  });

  it('words a refusal with the file name first', () => {
    expect(refusalText('Soma', 'This song is mostly in 6/8.')).toBe('Soma was not imported. This song is mostly in 6/8.');
  });

  it('refuses bytes that are not a MIDI file', () => {
    const result = loadMidi(new Uint8Array([1, 2, 3, 4]));
    expect(result.ok).toBe(false);
  });

  const album = join(__dirname, '..', '..', 'midis');
  const cops = join(album, 'Strokes (The) — New York City Cops (4) [MIDIfind.com].mid');
  it.skipIf(!existsSync(cops))('reads New York City Cops with its nine tracks guessed, and figures for each mapped row', () => {
    const l = must2(loadMidi(new Uint8Array(readFileSync(cops))));
    expect(l.rows.length).toBeGreaterThanOrEqual(9);
    expect(canConvert(l.rows)).toBe(true);
    const p = previewMapping(l.file, l.timing, l.rows);
    for (const row of l.rows) expect(p.rows.has(row.index)).toBe(row.assignment !== 'skip');
    const outcome = must2(convertMidi(l.file, l.rows));
    expect(outcome.project.bpm).toBe(l.timing.bpm);
    expect(p.instruments.drums?.patterns).toBe(outcome.report.instruments.drums?.patterns);
  });
});
