import { describe, expect, it } from 'vitest';
import {
  DRUM_ROWS_TOP_DOWN,
  beatMarks,
  cellCount,
  cellStarts,
  describeStart,
  hitWidthTicks,
  isOnGrid,
  playheadPx,
  visibleHits,
} from './grid';

describe('cells', () => {
  it('has 16 sixteenths in a 4/4 bar and 12 in a 3/4 bar', () => {
    expect(cellCount(48, 'sixteenth')).toBe(16);
    expect(cellCount(36, 'sixteenth')).toBe(12);
  });

  it('has 12 thirds and 24 halves of a third per 4/4 bar', () => {
    expect(cellCount(48, 'third')).toBe(12);
    expect(cellCount(48, 'halfThird')).toBe(24);
  });

  it('scales with the pattern length', () => {
    expect(cellCount(48 * 8, 'sixteenth')).toBe(128);
  });

  it('lets the last whole-note step overhang a 3/4 bar', () => {
    expect(cellCount(36, 'whole')).toBe(1);
    expect(cellCount(72, 'whole')).toBe(2);
    expect(cellStarts(72, 'whole')).toEqual([0, 48]);
  });

  it('starts every step at a multiple of its size', () => {
    expect(cellStarts(24, 'third')).toEqual([0, 4, 8, 12, 16, 20]);
    expect(cellStarts(12, 'halfThird')).toEqual([0, 2, 4, 6, 8, 10]);
    expect(cellStarts(48, 'quarter')).toEqual([0, 12, 24, 36]);
  });

  it('only gives starts that are on the time grid', () => {
    for (const value of ['whole', 'half', 'quarter', 'sixteenth', 'third', 'halfThird'] as const) {
      for (const start of cellStarts(36 * 2, value)) expect([0, 2, 3, 4, 6, 8, 9, 10]).toContain(start % 12);
    }
  });
});

describe('hits', () => {
  it('knows which hits lie on the chosen value', () => {
    expect(isOnGrid(3, 'sixteenth')).toBe(true);
    expect(isOnGrid(4, 'sixteenth')).toBe(false);
    expect(isOnGrid(4, 'third')).toBe(true);
    expect(isOnGrid(4, 'halfThird')).toBe(true);
    expect(isOnGrid(12, 'quarter')).toBe(true);
    expect(isOnGrid(36, 'half')).toBe(false);
  });

  it('draws a hit on the grid as a whole step and a hit off it as a narrow mark', () => {
    expect(hitWidthTicks(3, 'sixteenth')).toBe(3);
    expect(hitWidthTicks(4, 'sixteenth')).toBe(2);
    expect(hitWidthTicks(8, 'third')).toBe(4);
  });

  it('keeps hits of one row that start inside the pattern', () => {
    const notes = [
      { row: 'kick' as const, start: 0 },
      { row: 'kick' as const, start: 47 },
      { row: 'kick' as const, start: 48 },
      { row: 'snare' as const, start: 12 },
    ];
    expect(visibleHits(notes, 'kick', 48).map((n) => n.start)).toEqual([0, 47]);
    expect(visibleHits(notes, 'snare', 48)).toHaveLength(1);
    expect(visibleHits(notes, 'crash', 48)).toEqual([]);
  });

  it('lists the rows from crash at the top to kick at the bottom', () => {
    expect(DRUM_ROWS_TOP_DOWN).toEqual(['crash', 'openHihat', 'hihat', 'snare', 'kick']);
  });
});

describe('beat marks', () => {
  it('numbers the beats of one 4/4 bar 1 to 4', () => {
    const marks = beatMarks('4/4', 1);
    expect(marks.map((m) => m.label)).toEqual(['1', '2', '3', '4']);
    expect(marks.map((m) => m.tick)).toEqual([0, 12, 24, 36]);
    expect(marks.filter((m) => m.barStart)).toHaveLength(1);
  });

  it('has three beats in 3/4', () => {
    expect(beatMarks('3/4', 1).map((m) => m.label)).toEqual(['1', '2', '3']);
  });

  it('labels several bars as bar.beat and marks each bar start', () => {
    const marks = beatMarks('4/4', 2);
    expect(marks.map((m) => m.label)).toEqual(['1.1', '1.2', '1.3', '1.4', '2.1', '2.2', '2.3', '2.4']);
    expect(marks[4]).toEqual({ tick: 48, label: '2.1', barStart: true });
  });
});

describe('words and playhead', () => {
  it('describes a start in bars and beats', () => {
    expect(describeStart(0, '4/4')).toBe('bar 1, beat 1');
    expect(describeStart(51, '4/4')).toBe('bar 2, beat 1 plus 3 twelfths');
    expect(describeStart(36, '3/4')).toBe('bar 2, beat 1');
  });

  it('places the playhead in proportion and keeps it inside the grid', () => {
    expect(playheadPx(24, 48, 600)).toBe(300);
    expect(playheadPx(-5, 48, 600)).toBe(0);
    expect(playheadPx(60, 48, 600)).toBe(600);
    expect(playheadPx(10, 0, 600)).toBe(0);
  });
});
