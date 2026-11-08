import { describe, expect, it } from 'vitest';
import {
  BPM_MAX,
  BPM_MIN,
  MIN_NOTE_TICKS,
  NOTE_VALUES,
  NOTE_VALUE_TICKS,
  TICKS_PER_QUARTER,
  clampBpm,
  isGridPosition,
  patternTicks,
  snapDown,
  snapLength,
  snapNearest,
  ticksPerBar,
} from './time';

describe('note values', () => {
  it('measure the six values in twelfths of a quarter note', () => {
    expect(NOTE_VALUE_TICKS).toEqual({ whole: 48, half: 24, quarter: 12, sixteenth: 3, third: 4, halfThird: 2 });
    expect(NOTE_VALUES).toHaveLength(6);
    expect(TICKS_PER_QUARTER).toBe(12);
  });

  it('make a third one third of a quarter and half of a third the shortest note', () => {
    expect(NOTE_VALUE_TICKS.third * 3).toBe(NOTE_VALUE_TICKS.quarter);
    expect(MIN_NOTE_TICKS).toBe(NOTE_VALUE_TICKS.halfThird);
    expect(Math.min(...Object.values(NOTE_VALUE_TICKS))).toBe(MIN_NOTE_TICKS);
  });
});

describe('bars', () => {
  it('are four quarters in 4/4 and three in 3/4', () => {
    expect(ticksPerBar('4/4')).toBe(48);
    expect(ticksPerBar('3/4')).toBe(36);
    expect(patternTicks('3/4', 8)).toBe(288);
  });
});

describe('the grid', () => {
  it('allows the 16th, third and half-of-a-third positions inside a beat', () => {
    const allowed = [0, 2, 3, 4, 6, 8, 9, 10];
    for (let t = 0; t < 12; t++) expect(isGridPosition(t)).toBe(allowed.includes(t));
    expect(isGridPosition(24)).toBe(true);
    expect(isGridPosition(25)).toBe(false);
    expect(isGridPosition(-2)).toBe(false);
    expect(isGridPosition(2.5)).toBe(false);
  });

  it('puts every multiple of every note value on the grid', () => {
    for (const value of NOTE_VALUES) {
      for (let n = 0; n < 40; n++) expect(isGridPosition(n * NOTE_VALUE_TICKS[value])).toBe(true);
    }
  });
});

describe('snapping', () => {
  it('snaps down to the cell that holds the tick', () => {
    expect(snapDown(13, 'quarter')).toBe(12);
    expect(snapDown(11, 'sixteenth')).toBe(9);
    expect(snapDown(7, 'third')).toBe(4);
    expect(snapDown(5, 'halfThird')).toBe(4);
    expect(snapDown(47, 'whole')).toBe(0);
  });

  it('snaps to the nearest line, a tie going to the earlier one', () => {
    expect(snapNearest(7, 'quarter')).toBe(12);
    expect(snapNearest(6, 'quarter')).toBe(0);
    expect(snapNearest(5, 'quarter')).toBe(0);
    expect(snapNearest(11, 'third')).toBe(12);
  });

  it('snaps a length to a whole number of the value, never less than one', () => {
    expect(snapLength(0, 'quarter')).toBe(12);
    expect(snapLength(17, 'quarter')).toBe(12);
    expect(snapLength(19, 'quarter')).toBe(24);
    expect(snapLength(5, 'third')).toBe(4);
  });
});

describe('bpm', () => {
  it('is a whole number from 40 to 300', () => {
    expect(clampBpm(120.4)).toBe(120);
    expect(clampBpm(10)).toBe(BPM_MIN);
    expect(clampBpm(999)).toBe(BPM_MAX);
    expect(clampBpm(Number.NaN)).toBe(120);
  });
});
