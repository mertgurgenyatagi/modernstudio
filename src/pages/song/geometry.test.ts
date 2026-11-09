import { describe, expect, it } from 'vitest';
import { BAR_PX, SONG_WIDTH_PX, barFromPx, barNumberAtTick, barToPx, blockWidthPx, dropBar, ghostStartBar, songTickToPx } from './geometry';

describe('bars and pixels', () => {
  it('converts a bar to pixels and back', () => {
    expect(barToPx(0)).toBe(0);
    expect(barToPx(5)).toBe(5 * BAR_PX);
    expect(barFromPx(barToPx(5))).toBe(5);
    expect(barFromPx(barToPx(5) + BAR_PX - 1)).toBe(5);
    expect(barFromPx(barToPx(6))).toBe(6);
  });

  it('keeps a pixel inside the song', () => {
    expect(barFromPx(-30)).toBe(0);
    expect(barFromPx(SONG_WIDTH_PX + 500)).toBe(255);
    expect(barFromPx(Number.NaN)).toBe(0);
  });

  it('sixteen bars fit in 960 px with room for the name column', () => {
    expect(barToPx(16) + 128 + 2 * 16).toBeLessThanOrEqual(960);
  });

  it('draws a block as wide as its pattern', () => {
    expect(blockWidthPx(1)).toBe(BAR_PX);
    expect(blockWidthPx(4)).toBe(4 * BAR_PX);
  });

  it('puts the ghost at the bar under the pointer', () => {
    expect(ghostStartBar(3 * BAR_PX + 10)).toBe(3);
  });
});

describe('dropping a dragged block', () => {
  it('snaps to the nearest bar line, keeping the grab point', () => {
    // Picked up 10 px from the block's left edge, which started at bar 4.
    expect(dropBar(4 * BAR_PX + 10, 10, 2)).toBe(4);
    // Dragged 20 px right: less than half a bar, stays.
    expect(dropBar(4 * BAR_PX + 30, 10, 2)).toBe(4);
    // Dragged 30 px right: more than half a bar, moves one bar.
    expect(dropBar(4 * BAR_PX + 40, 10, 2)).toBe(5);
    // Dragged 30 px left of the start: 0.625 of a bar, so it moves one bar back.
    expect(dropBar(4 * BAR_PX - 20, 10, 2)).toBe(3);
  });

  it('never goes before bar 0 or past bar 256', () => {
    expect(dropBar(-500, 0, 1)).toBe(0);
    expect(dropBar(SONG_WIDTH_PX + 500, 0, 1)).toBe(255);
    expect(dropBar(SONG_WIDTH_PX + 500, 0, 8)).toBe(248);
    expect(dropBar(Number.NaN, 0, 8)).toBe(0);
  });
});

describe('the playhead', () => {
  it('moves one bar width per bar, for each meter', () => {
    expect(songTickToPx(0, '4/4')).toBe(0);
    expect(songTickToPx(48, '4/4')).toBe(BAR_PX);
    expect(songTickToPx(36, '3/4')).toBe(BAR_PX);
    expect(songTickToPx(24, '4/4')).toBe(BAR_PX / 2);
    expect(songTickToPx(-5, '4/4')).toBe(0);
  });

  it('reads the bar number, 1 based', () => {
    expect(barNumberAtTick(0, '4/4')).toBe(1);
    expect(barNumberAtTick(47, '4/4')).toBe(1);
    expect(barNumberAtTick(48, '4/4')).toBe(2);
    expect(barNumberAtTick(36, '3/4')).toBe(2);
  });
});
