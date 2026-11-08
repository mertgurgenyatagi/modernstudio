import { describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, canUndo, commit, newHistory, replacePresent, undo } from './history';
import { addNote } from './patterns';
import { createProject, selectPattern, setBpm, setMeter, setVolume, showPatterns } from './project';
import { must } from './testing';

describe('undo', () => {
  it('starts empty, and has nothing to undo', () => {
    const h = newHistory(createProject());
    expect(canUndo(h)).toBe(false);
    expect(undo(h)).toBe(h);
  });

  it('steps back one edit at a time', () => {
    const p0 = createProject();
    const p1 = setBpm(p0, 100);
    const p2 = setBpm(p1, 90);
    let h = commit(commit(newHistory(p0), p1), p2);
    expect(h.present.bpm).toBe(90);
    h = undo(h);
    expect(h.present.bpm).toBe(100);
    h = undo(h);
    expect(h.present.bpm).toBe(120);
    expect(canUndo(h)).toBe(false);
  });

  it('has no redo', () => {
    const source = Object.keys(newHistory(createProject()));
    expect(source).not.toContain('future');
  });

  it('skips an edit that changed nothing', () => {
    const p = createProject();
    const h = newHistory(p);
    expect(commit(h, p)).toBe(h);
    expect(commit(h, setBpm(p, 120))).toBe(h);
  });

  it('joins edits with the same key into one step, such as a slider drag', () => {
    const p0 = createProject();
    let h = newHistory(p0);
    for (const v of [70, 60, 50, 40]) h = commit(h, setVolume(h.present, 'bass', v), 'volume:bass');
    expect(h.past).toHaveLength(1);
    expect(h.present.instruments.bass.volume).toBe(40);
    h = commit(h, setVolume(h.present, 'lead', 10), 'volume:lead');
    expect(h.past).toHaveLength(2);
    h = commit(h, setBpm(h.present, 99));
    h = commit(h, setVolume(h.present, 'lead', 5), 'volume:lead');
    expect(h.past).toHaveLength(4);
    const back = undo(undo(undo(undo(h))));
    expect(back.present.instruments.bass.volume).toBe(p0.instruments.bass.volume);
  });

  it('restores notes deleted by a meter change (assumed: it is an edit like any other)', () => {
    let p = must(addNote(createProject(), 'drums', 0, { row: 'snare', start: 36 }));
    let h = newHistory(p);
    p = setMeter(p, '3/4');
    h = commit(h, p);
    expect(h.present.instruments.drums.patterns[0]?.notes).toHaveLength(0);
    h = undo(h);
    expect(h.present.meter).toBe('4/4');
    expect(h.present.instruments.drums.patterns[0]?.notes).toEqual([{ row: 'snare', start: 36 }]);
  });

  it('leaves the selected pattern and the patterns shown as they are', () => {
    const p0 = createProject();
    let h = newHistory(p0);
    h = commit(h, setBpm(h.present, 100));
    h = replacePresent(h, selectPattern(h.present, 'drums', 7));
    expect(h.past).toHaveLength(1);
    h = commit(h, showPatterns(h.present, 'drums', 40));
    h = undo(h);
    expect(h.present.bpm).toBe(100);
    expect(h.present.instruments.drums.selectedPattern).toBe(7);
    expect(h.present.instruments.drums.shownPatterns).toBe(40);
  });

  it('keeps at most HISTORY_LIMIT steps', () => {
    let h = newHistory(createProject());
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) h = commit(h, setBpm(h.present, 40 + (i % 2 === 0 ? 1 : 2)) );
    expect(h.past.length).toBe(HISTORY_LIMIT);
  });

  it('starts empty again for an imported project', () => {
    const imported = newHistory(setBpm(createProject(), 146));
    expect(canUndo(imported)).toBe(false);
  });
});
