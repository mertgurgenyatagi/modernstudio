import { describe, expect, it } from 'vitest';
import { addNote, setPatternBars } from '../../core/patterns';
import { createProject } from '../../core/project';
import { placeBlock } from '../../core/song';
import { must } from '../../core/testing';
import { patternChoices } from './menu';

describe('the patterns the menu offers', () => {
  it('lists the patterns with notes, and says which fit at the bar', () => {
    let p = must(addNote(createProject(), 'drums', 0, { row: 'kick', start: 0 }));
    p = must(addNote(p, 'drums', 3, { row: 'snare', start: 0 }));
    p = must(setPatternBars(p, 'drums', 3, 4));
    p = must(placeBlock(p, 'drums', 0, 6));
    expect(patternChoices(p, 'drums', 4)).toEqual([
      { index: 0, bars: 1, fits: true },
      { index: 3, bars: 4, fits: false },
    ]);
    expect(patternChoices(p, 'drums', 6).every((c) => !c.fits)).toBe(true);
    expect(patternChoices(p, 'bass', 0)).toEqual([]);
  });
});
