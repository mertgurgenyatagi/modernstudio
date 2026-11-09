import { describe, expect, it } from 'vitest';
import { addNote } from '../../core/patterns';
import { createProject, type Project } from '../../core/project';
import { copyResult, copyTargets } from './copy';

function withNotes(patterns: number[]): Project {
  let project = createProject();
  for (const index of patterns) {
    const outcome = addNote(project, 'drums', index, { row: 'kick', start: 0 });
    if (!outcome.ok) throw new Error(outcome.reason);
    project = outcome.project;
  }
  return project;
}

describe('copyTargets', () => {
  it('offers every shown pattern, marking the active ones and the source', () => {
    const project = withNotes([0, 3]);
    const drums = project.instruments.drums;
    const targets = copyTargets({ ...drums, selectedPattern: 3 });
    expect(targets).toHaveLength(20);
    expect(targets.filter((t) => t.active).map((t) => t.index)).toEqual([0, 3]);
    expect(targets.filter((t) => t.source).map((t) => t.index)).toEqual([3]);
  });

  it('offers only the shown patterns', () => {
    const drums = createProject().instruments.drums;
    expect(copyTargets({ ...drums, shownPatterns: 40 })).toHaveLength(40);
  });
});

describe('copyResult', () => {
  it('uses the numbers the user sees, starting at 1', () => {
    expect(copyResult(4, 'replace', true)).toBe('Copied to pattern 5, replacing its notes.');
    expect(copyResult(0, 'add', true)).toBe('Added to pattern 1.');
  });

  it('says so when the source is empty', () => {
    expect(copyResult(1, 'replace', false)).toContain('emptied');
    expect(copyResult(1, 'add', false)).toContain('Nothing to add');
  });
});
