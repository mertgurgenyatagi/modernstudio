import { describe, expect, it } from 'vitest';
import { addNote } from '../../core/patterns';
import { createProject, selectPattern, type Project } from '../../core/project';
import { must } from '../../core/testing';
import { brushPattern, readyPatterns, stepBrush } from './brush';

function withReady(numbers: number[]): Project {
  let p = createProject();
  for (const n of numbers) p = must(addNote(p, 'drums', n, { row: 'kick', start: 0 }));
  return p;
}

describe('the brush', () => {
  it('lists only patterns with notes', () => {
    expect(readyPatterns(withReady([0, 3, 7]).instruments.drums)).toEqual([0, 3, 7]);
    expect(readyPatterns(createProject().instruments.drums)).toEqual([]);
  });

  it('holds the selected pattern when it is ready', () => {
    const p = selectPattern(withReady([0, 3, 7]), 'drums', 3);
    expect(brushPattern(p.instruments.drums)).toBe(3);
  });

  it('falls to the next ready pattern, then the one before, when the selection is empty', () => {
    expect(brushPattern(selectPattern(withReady([0, 3, 7]), 'drums', 1).instruments.drums)).toBe(3);
    expect(brushPattern(selectPattern(withReady([0, 3, 7]), 'drums', 9).instruments.drums)).toBe(7);
  });

  it('holds nothing when no pattern is ready', () => {
    expect(brushPattern(createProject().instruments.drums)).toBeNull();
    expect(stepBrush(createProject().instruments.drums, 1)).toBeNull();
  });

  it('steps over empty patterns and stops at the ends', () => {
    const p = selectPattern(withReady([0, 3, 7]), 'drums', 3);
    expect(stepBrush(p.instruments.drums, 1)).toBe(7);
    expect(stepBrush(p.instruments.drums, -1)).toBe(0);
    const first = selectPattern(p, 'drums', 0);
    expect(stepBrush(first.instruments.drums, -1)).toBeNull();
    const last = selectPattern(p, 'drums', 7);
    expect(stepBrush(last.instruments.drums, 1)).toBeNull();
  });
});
