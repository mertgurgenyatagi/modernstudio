import { describe, expect, it } from 'vitest';
import {
  EDITOR_VIEW_DEFAULT,
  anchoredScroll,
  barNumberEvery,
  barsShown,
  fitSongBarPx,
  isFitting,
  tickWidth,
  toggleFit,
  wheelFactor,
  zoomSongBarPx,
  zoomView,
} from './view';

describe('the instrument pages zoom', () => {
  it('shows one bar across the width by default, never more than the pattern', () => {
    expect(barsShown(EDITOR_VIEW_DEFAULT, 4)).toBe(1);
    expect(barsShown({ fit: false, barsInView: 8 }, 2)).toBe(2);
    expect(barsShown({ fit: true, barsInView: 1 }, 8)).toBe(8);
  });

  it('zooms out up to the whole pattern and in down to a beat of 4/4', () => {
    expect(zoomView(EDITOR_VIEW_DEFAULT, 4, 2)).toEqual({ fit: false, barsInView: 2 });
    expect(zoomView({ fit: false, barsInView: 2 }, 4, 4).barsInView).toBe(4);
    expect(zoomView(EDITOR_VIEW_DEFAULT, 1, 2).barsInView).toBe(1);
    expect(zoomView(EDITOR_VIEW_DEFAULT, 4, 1 / 8).barsInView).toBe(0.25);
    // Zooming from "fit" starts from the whole pattern and ends fit.
    expect(zoomView({ fit: true, barsInView: 1 }, 8, 0.5)).toEqual({ fit: false, barsInView: 4 });
  });

  it('has a Fit button that fits the whole pattern and goes back to one bar', () => {
    const on = toggleFit(EDITOR_VIEW_DEFAULT);
    expect(on.fit).toBe(true);
    expect(isFitting(on, 8)).toBe(true);
    expect(toggleFit(on)).toEqual({ fit: false, barsInView: 1 });
    expect(isFitting(EDITOR_VIEW_DEFAULT, 4)).toBe(false);
    expect(isFitting({ fit: false, barsInView: 4 }, 4)).toBe(true);
  });

  it('turns bars and pixels into the width of a tick', () => {
    expect(tickWidth(960, 1, 48)).toBe(20);
    expect(tickWidth(960, 2, 48)).toBe(10);
    expect(tickWidth(0, 1, 48)).toBe(0);
  });
});

describe('zooming with the wheel', () => {
  it('zooms in on wheeling up and out on wheeling down, by a little per notch', () => {
    expect(wheelFactor(-100)).toBeLessThan(1);
    expect(wheelFactor(100)).toBeGreaterThan(1);
    expect(wheelFactor(100) * wheelFactor(-100)).toBeCloseTo(1, 10);
    expect(wheelFactor(0)).toBe(1);
  });

  it('keeps the point under the pointer where it is', () => {
    // A tick 30 under a pointer 200 px from the left; ticks are now 10 px wide.
    expect(anchoredScroll(30, 200, 10)).toBe(100);
    expect(anchoredScroll(5, 200, 10)).toBe(0);
  });
});

describe('the Song zoom', () => {
  it('keeps a bar between 4 and 192 px', () => {
    expect(zoomSongBarPx(48, 2)).toBe(24);
    expect(zoomSongBarPx(48, 0.5)).toBe(96);
    expect(zoomSongBarPx(8, 4)).toBe(4);
    expect(zoomSongBarPx(150, 0.5)).toBe(192);
  });

  it('fits the whole song, and at least sixteen bars', () => {
    expect(fitSongBarPx(800, 0)).toBe(50);
    expect(fitSongBarPx(800, 99)).toBe(8);
  });

  it('numbers fewer bars when they are narrow', () => {
    expect(barNumberEvery(48)).toBe(1);
    expect(barNumberEvery(20)).toBe(2);
    expect(barNumberEvery(8)).toBe(4);
    expect(barNumberEvery(4)).toBe(8);
  });
});
