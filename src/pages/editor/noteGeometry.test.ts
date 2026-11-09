import { describe, expect, it } from 'vitest';
import type { Pattern, StringNote } from '../../core/project';
import {
  clickStart,
  fretRows,
  fretChangeLine,
  hiddenAboveFret,
  hiddenAcrossPatterns,
  movedStart,
  newNoteLength,
  notesAt,
  pitchName,
  pxToTicks,
  resizedLength,
  stringNames,
} from './noteGeometry';

describe('fretRows', () => {
  it('has the open string and then one row per fret', () => {
    expect(fretRows(5)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(fretRows(7)).toHaveLength(8);
    expect(fretRows(12)).toHaveLength(13);
    expect(fretRows(12)[12]).toBe(12);
  });
});

describe('pitch names', () => {
  it('names middle C as C4 and the open strings as the docs do', () => {
    expect(pitchName(60)).toBe('C4');
    expect(pitchName(61)).toBe('C#4');
    expect(stringNames('bass')).toEqual(['E1', 'A1', 'D2', 'G2']);
    expect(stringNames('lead')).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    expect(stringNames('rhythm')).toEqual(stringNames('lead'));
  });
});

describe('clicks', () => {
  it('turns pixels into ticks and into the start of the step under the click', () => {
    expect(pxToTicks(42, 14)).toBe(3);
    expect(pxToTicks(10, 0)).toBe(0);
    expect(clickStart(0, 14, 'sixteenth', 48)).toBe(0);
    expect(clickStart(41, 14, 'sixteenth', 48)).toBe(0);
    expect(clickStart(43, 14, 'sixteenth', 48)).toBe(3);
    expect(clickStart(14 * 13, 14, 'quarter', 48)).toBe(12);
    expect(clickStart(14 * 5, 14, 'third', 48)).toBe(4);
  });

  it('keeps a click past the right edge or left of the grid inside the pattern', () => {
    expect(clickStart(-20, 14, 'sixteenth', 48)).toBe(0);
    expect(clickStart(9999, 14, 'sixteenth', 48)).toBe(45);
  });

  it('gives a new note one step of the value, cut short at the end of the pattern', () => {
    expect(newNoteLength(0, 'sixteenth', 48)).toBe(3);
    expect(newNoteLength(0, 'whole', 48)).toBe(48);
    expect(newNoteLength(24, 'whole', 36)).toBe(12);
    expect(newNoteLength(44, 'third', 48)).toBe(4);
    expect(newNoteLength(46, 'halfThird', 48)).toBe(2);
  });
});

describe('moving a note', () => {
  it('snaps to the nearest line of the note value', () => {
    expect(movedStart(0, 3, 4, 'sixteenth', 48)).toBe(3);
    expect(movedStart(0, 3, 1, 'sixteenth', 48)).toBe(0);
    expect(movedStart(12, 12, -12, 'quarter', 48)).toBe(0);
    expect(movedStart(0, 4, 5, 'third', 48)).toBe(4);
  });

  it('stops at the start and at the end of the pattern', () => {
    expect(movedStart(3, 3, -100, 'sixteenth', 48)).toBe(0);
    expect(movedStart(3, 3, 100, 'sixteenth', 48)).toBe(45);
    expect(movedStart(0, 12, 100, 'sixteenth', 48)).toBe(36);
  });

  it('keeps the note where it was when no valid place results', () => {
    // 7 is not a grid position, so a note that starts there cannot be a result of anything snapped.
    expect(movedStart(3, 5, 0, 'sixteenth', 48)).toBe(3);
  });
});

describe('resizing a note', () => {
  it('snaps the length to a whole number of the note value, at least one', () => {
    expect(resizedLength(0, 3, 3, 'sixteenth', 48)).toBe(6);
    expect(resizedLength(0, 6, -3, 'sixteenth', 48)).toBe(3);
    expect(resizedLength(0, 3, -30, 'sixteenth', 48)).toBe(3);
    expect(resizedLength(0, 12, 14, 'quarter', 48)).toBe(24);
    expect(resizedLength(0, 4, 4, 'third', 48)).toBe(8);
  });

  it('never goes below half of a third', () => {
    for (const value of ['whole', 'half', 'quarter', 'sixteenth', 'third', 'halfThird'] as const) {
      expect(resizedLength(0, 12, -1000, value, 48)).toBeGreaterThanOrEqual(2);
    }
  });

  it('stops at the end of the pattern', () => {
    expect(resizedLength(40, 3, 100, 'sixteenth', 48)).toBe(8);
    expect(resizedLength(24, 12, 100, 'whole', 36)).toBe(12);
  });

  it('ends on the grid, trying the nearest line for the end when the length does not', () => {
    // Starts at 3 (a 16th line); a third longer would end at 7, which is not a grid position, so the
    // end goes to the nearest third line that is one (8) and the length is 5.
    const length = resizedLength(3, 3, 4, 'third', 48);
    expect(length).toBe(5);
    expect([0, 2, 3, 4, 6, 8, 9, 10]).toContain((3 + length) % 12);
  });
});

describe('what is on screen', () => {
  const notes: StringNote[] = [
    { string: 0, fret: 0, start: 0, length: 3 },
    { string: 0, fret: 5, start: 12, length: 3 },
    { string: 0, fret: 9, start: 24, length: 3 },
    { string: 1, fret: 5, start: 12, length: 3 },
    { string: 1, fret: 5, start: 60, length: 3 },
  ];

  it('shows the notes of one string and fret inside the pattern', () => {
    expect(notesAt(notes, 0, 5, 7, 48)).toEqual([notes[1]]);
    expect(notesAt(notes, 1, 5, 7, 48)).toEqual([notes[3]]);
    expect(notesAt(notes, 1, 5, 7, 96)).toHaveLength(2);
  });

  it('hides notes above the fret count and counts them', () => {
    expect(notesAt(notes, 0, 9, 7, 48)).toEqual([]);
    expect(notesAt(notes, 0, 9, 12, 48)).toEqual([notes[2]]);
    expect(hiddenAboveFret(notes, 7)).toBe(1);
    expect(hiddenAboveFret(notes, 5)).toBe(1);
    expect(hiddenAboveFret(notes, 4)).toBe(4);
    expect(hiddenAboveFret(notes, 12)).toBe(0);
  });
});

describe('lowering the fret count', () => {
  const note = (fret: number): StringNote => ({ string: 0, fret, start: 0, length: 12 });
  const patterns: Pattern[] = [
    { bars: 1, notes: [note(2), note(9)] },
    { bars: 1, notes: [] },
    { bars: 2, notes: [note(12), note(8), note(3)] },
  ];

  it('counts the notes and the patterns they are in across all patterns', () => {
    expect(hiddenAcrossPatterns(patterns, 7)).toEqual({ notes: 3, patterns: 2 });
    expect(hiddenAcrossPatterns(patterns, 5)).toEqual({ notes: 3, patterns: 2 });
    expect(hiddenAcrossPatterns(patterns, 8)).toEqual({ notes: 2, patterns: 2 });
    expect(hiddenAcrossPatterns(patterns, 12)).toEqual({ notes: 0, patterns: 0 });
  });

  it('says nothing when nothing is hidden, and counts words right otherwise', () => {
    expect(fretChangeLine({ notes: 0, patterns: 0 }, 12)).toBe('');
    expect(fretChangeLine({ notes: 1, patterns: 1 }, 7)).toContain('1 note is now above fret 7, in 1 pattern');
    expect(fretChangeLine({ notes: 3, patterns: 2 }, 5)).toContain('3 notes are now above fret 5, in 2 patterns');
  });
});
