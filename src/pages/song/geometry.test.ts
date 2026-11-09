import { describe, expect, it } from 'vitest';
import { addNote, setPatternBars } from '../../core/patterns';
import { createProject } from '../../core/project';
import { placeBlock } from '../../core/song';
import { must } from '../../core/testing';
import {
  LANE_MAX_PX,
  LANE_MIN_PX,
  barFromPx,
  barLineEvery,
  barNumberAtTick,
  blocksInRect,
  dragBars,
  laneFromPx,
  laneHeight,
  songTickToPx,
} from './geometry';

describe('bars, lanes and pixels', () => {
  it('finds the bar under a pixel at any zoom, kept inside the song', () => {
    expect(barFromPx(5 * 48, 48)).toBe(5);
    expect(barFromPx(5 * 48 + 47, 48)).toBe(5);
    expect(barFromPx(100, 10)).toBe(10);
    expect(barFromPx(-30, 48)).toBe(0);
    expect(barFromPx(1e6, 48)).toBe(255);
    expect(barFromPx(Number.NaN, 48)).toBe(0);
  });

  it('finds the lane under a pixel, Drums at the top', () => {
    expect(laneFromPx(0, 80)).toBe('drums');
    expect(laneFromPx(85, 80)).toBe('bass');
    expect(laneFromPx(399, 80)).toBe('keys');
    expect(laneFromPx(400, 80)).toBeNull();
    expect(laneFromPx(-1, 80)).toBeNull();
  });

  it('shares the height among the five lanes, within the limits', () => {
    expect(laneHeight(430)).toBe(86);
    expect(laneHeight(100)).toBe(LANE_MIN_PX);
    expect(laneHeight(2000)).toBe(LANE_MAX_PX);
  });

  it('moves a dragged block to the nearest bar line', () => {
    expect(dragBars(20, 48)).toBe(0);
    expect(dragBars(30, 48)).toBe(1);
    expect(dragBars(-30, 48)).toBe(-1);
    expect(dragBars(Number.NaN, 48)).toBe(0);
  });

  it('thins the bar lines when bars are narrow', () => {
    expect(barLineEvery(48)).toBe(1);
    expect(barLineEvery(4)).toBe(2);
    expect(barLineEvery(1)).toBe(8);
  });
});

describe('the selection rectangle', () => {
  it('takes the blocks it touches in the lanes it crosses', () => {
    let p = must(addNote(createProject(), 'drums', 0, { row: 'kick', start: 0 }));
    p = must(setPatternBars(p, 'drums', 0, 2));
    p = must(addNote(p, 'bass', 0, { string: 0, fret: 0, start: 0, length: 12 }));
    p = must(placeBlock(p, 'drums', 0, 0)); // bars 1 and 2
    p = must(placeBlock(p, 'drums', 0, 4)); // bars 5 and 6
    p = must(placeBlock(p, 'bass', 0, 1));
    // 48 px bars, 80 px lanes: from the middle of bar 2 in Drums down into Bass, to the start of bar 3.
    expect(blocksInRect(p, { x0: 70, y0: 40, x1: 100, y1: 120 }, 48, 80)).toEqual([
      { instrument: 'drums', startBar: 0 },
      { instrument: 'bass', startBar: 1 },
    ]);
    expect(blocksInRect(p, { x0: 300, y0: 300, x1: 190, y1: 10 }, 48, 80)).toEqual([{ instrument: 'drums', startBar: 4 }]);
  });
});

describe('the playhead', () => {
  it('moves one bar width per bar, for each meter and zoom', () => {
    expect(songTickToPx(0, '4/4', 48)).toBe(0);
    expect(songTickToPx(48, '4/4', 48)).toBe(48);
    expect(songTickToPx(36, '3/4', 20)).toBe(20);
    expect(songTickToPx(24, '4/4', 48)).toBe(24);
    expect(songTickToPx(-5, '4/4', 48)).toBe(0);
  });

  it('reads the bar number, 1 based', () => {
    expect(barNumberAtTick(0, '4/4')).toBe(1);
    expect(barNumberAtTick(47, '4/4')).toBe(1);
    expect(barNumberAtTick(48, '4/4')).toBe(2);
    expect(barNumberAtTick(36, '3/4')).toBe(2);
  });
});
