/**
 * Fit at the default window, 960 by 540 (docs/design.md), checked without a browser (docs/fit.md).
 *
 * What is read from the source: the sizes in the CSS files (a row height, a column width, the formula
 * of a lane or pad height) and the geometry code (BAR_PX, MAX_TICK_PX, the key rows). What is
 * estimated by hand: the height of a line of text (font size times line height), a button (its padding
 * plus a line) and the other things CSS lays out by itself. Those estimates are the numbers in
 * `EST` below and in docs/fit.md; they are reasoning, not measurements. Nothing here opens a window.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_WINDOW } from '../core/constants';
import { KEY_ROWS } from './editor/keyRoll';
import { MAX_TICK_PX } from './editor/grid';
import { barToPx } from './song/geometry';

const REM = 16;
const W = DEFAULT_WINDOW.width;
const H = DEFAULT_WINDOW.height;

/** Hand estimates in pixels, at the 16 px root size. Each is a font size times a line height, plus padding and borders. */
const EST = {
  topBar: 44, // tabs 0.8 + 0.65 rem padding and a 0.9 rem line, transport 0.4 rem padding and a 30 px button, 1 px rule
  notice: 29, // a one line notice: 0.4 rem padding top and bottom and a 0.85 rem line
  h1: 28, // 1.6 rem Piazzolla at line-height 1.1
  button: 25, // 0.3 rem padding top and bottom, a 0.85 rem line, two 1 px borders
  scrollbar: 15, // a classic scrollbar on a box that scrolls sideways
  rule: 1,
};

const file = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const remOf = (text: string) => parseFloat(text) * REM;

/** The first `--name: value;` in a CSS file. */
function cssVar(css: string, name: string): string {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(css);
  if (!match?.[1]) throw new Error(`${name} not found`);
  return match[1].trim();
}

/** Evaluates `clamp(Arem, calc((100vh - Brem) / N), Crem)` for a window height. */
function clampOfHeight(css: string, name: string, vh: number): number {
  const match = /clamp\(([\d.]+)rem,\s*calc\(\(100vh - ([\d.]+)rem\)\s*\/\s*(\d+)\),\s*([\d.]+)rem\)/.exec(cssVar(css, name));
  if (!match) throw new Error(`${name} is not a clamp of the window height`);
  const [lo, minus, divisor, hi] = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
  return Math.min(Math.max((vh - minus * REM) / divisor, lo * REM), hi * REM);
}

const page = H - EST.topBar; // 496
const pageWithNotice = page - EST.notice; // 467

describe('the default window', () => {
  it('is 960 by 540 inside the frame', () => {
    expect([W, H]).toEqual([960, 540]);
    expect(page).toBe(496);
    expect(pageWithNotice).toBe(467);
  });
});

describe('the Song page', () => {
  const css = file('./song.css');
  const nameW = remOf(cssVar(css, '--name-w'));
  const laneH = clampOfHeight(css, '--lane-h', H);

  it('shows sixteen bars beside the name column without a sideways scroll of the page', () => {
    const padding = 2 * REM; // 1 rem each side
    expect(padding + nameW + barToPx(16)).toBeLessThanOrEqual(W);
  });

  it('keeps all five lanes in view, even with a notice, a wrapped toolbar and a sideways scrollbar', () => {
    const padding = (0.6 + 0.5) * REM;
    const toolbarWrapped = 2 * EST.h1 + 0.6 * REM; // the worst case: the toolbar on two lines
    const timeline = 1.9 * REM;
    const box = timeline + 5 * laneH + EST.scrollbar + 2 * EST.rule;
    expect(padding + toolbarWrapped + box).toBeLessThanOrEqual(pageWithNotice);
    // And the normal case leaves room to spare.
    expect(padding + EST.h1 + 0.6 * REM + box).toBeLessThan(pageWithNotice - 25);
  });

  it('lets a block of 1.7 rem figures sit in a lane at the least height', () => {
    expect(laneH).toBeGreaterThanOrEqual(3.4 * REM);
    expect(laneH - 2 * 0.4 * REM).toBeGreaterThan(1.7 * REM + 8);
  });

  it('keeps a lane between its limits at other heights', () => {
    expect(clampOfHeight(css, '--lane-h', 400)).toBe(3.4 * REM);
    expect(clampOfHeight(css, '--lane-h', 1200)).toBe(5.5 * REM);
  });
});

describe('the Drums page', () => {
  const css = file('./drums.css');
  const toolsW = remOf(/grid-template-columns:\s*([\d.]+rem) minmax/.exec(css)?.[1] ?? '0');
  const rowH = clampOfHeight(css, '--row-h', H);
  // The tools column: Length in one row, Note value in three (the last wraps), Show whole pattern, Copy notes.
  const toolsColumn = 2 * 0.6 * REM + 43.8 + 116 + 24.4 + 24.4 + 3 * 0.6 * REM;
  const padsColumn = 2 * 0.5 * REM + 1.4 * REM + 5 * rowH;
  const bank = 2 * 0.5 * REM + 2 * 1.65 * REM + 0.25 * REM + EST.rule; // two rows of numbers (20 shown)
  const envelope = 56;

  it('has the panel inside the page, so the page does not scroll as a whole (20 patterns, a notice)', () => {
    const above = (0.6 + 0.75) * REM + (1.6 * 1.1 * REM + 0.5 * REM); // padding, then the heading
    const total = above + 2 * 2 + bank + Math.max(toolsColumn, padsColumn) + envelope;
    expect(total).toBeLessThanOrEqual(pageWithNotice);
  });

  it('keeps one bar of 16th pads at least 36 px wide', () => {
    const viewport = W - 2 * REM - 2 * 2 - toolsW - 5.4 * REM - 1.6 * REM;
    const tick = Math.min(MAX_TICK_PX, viewport / 48);
    expect(3 * tick).toBeGreaterThanOrEqual(36);
  });

  it('keeps a row between 2 and 3.4 rem', () => {
    expect(rowH).toBeGreaterThanOrEqual(2 * REM);
    expect(rowH).toBeLessThanOrEqual(3.4 * REM);
  });
});

describe('the note editors (Guitar and Keys)', () => {
  const css = file('./editor/noteEditor.css');
  const rowPx = remOf(cssVar(css, '--row-h'));
  const labelW = remOf(cssVar(css, '--label-w'));
  const sideW = remOf(/grid-template-columns:\s*minmax\(0, 1fr\) ([\d.]+rem)/.exec(css)?.[1] ?? '0');
  const cardHead = 0.4 * REM + 1.05 * 1.2 * REM + 2 * EST.rule;
  const cardGap = 0.6 * REM;
  const ruler = 1.4 * REM;
  const cardHeight = (frets: number) => cardHead + (frets + 1) * (rowPx + EST.rule) + cardGap;

  // What sits above the scrolling box in the main column: padding, the heading, the pattern bank (two
  // rows of numbers), and the tools row (one row, or two when it wraps), with 0.5 rem between them.
  const above = (toolsRows: number, headingLines: number) =>
    0.5 * REM + headingLines * 24.6 + (2 * 1.65 * REM + 0.25 * REM) + toolsRows * 44 + (toolsRows - 1) * 0.4 * REM + 3 * 0.5 * REM;

  it('fits one bar of either meter, with the label column, inside the scrolling box', () => {
    const box = W - sideW - 2 * REM;
    for (const barTicks of [48, 36]) {
      const tick = Math.min(MAX_TICK_PX, (box - labelW - 2) / barTicks);
      expect(tick).toBeGreaterThanOrEqual(12);
      expect(labelW + 2 + tick * barTicks).toBeLessThanOrEqual(box);
    }
  });

  it('leaves the scrolling box at least 200 px in the worst case (a notice, a wrapped tools row, a two line heading)', () => {
    expect(pageWithNotice - above(2, 2)).toBeGreaterThanOrEqual(200);
  });

  it('shows at least one whole 5 or 7 fret card in the usual case, and almost one at 12 frets', () => {
    const view = page - above(1, 1) - ruler; // no notice, one row of tools
    expect(view).toBeGreaterThanOrEqual(cardHeight(5));
    expect(view).toBeGreaterThanOrEqual(cardHeight(7));
    expect(view / cardHeight(12)).toBeGreaterThan(0.9);
  });

  it('has the card heights docs/fit.md quotes', () => {
    expect(Math.round(cardHeight(5))).toBe(169);
    expect(Math.round(cardHeight(7))).toBe(213);
    expect(Math.round(cardHeight(12))).toBe(322);
  });

  it('has a piano roll of 49 rows about 1070 px tall, which scrolls inside its box', () => {
    expect(KEY_ROWS).toHaveLength(49);
    const roll = 49 * (rowPx + EST.rule);
    expect(Math.round(roll)).toBe(1068);
    expect(roll).toBeGreaterThan(page - above(1, 1));
  });
});

describe('the Mixer page', () => {
  it('fits with the three buttons of the footer row stacked in the master row, and a notice', () => {
    const css = file('./mixer.css');
    const row = remOf(/height:\s*([\d.]+rem);\s*border-bottom/.exec(css)?.[1] ?? '0');
    expect(row).toBeCloseTo(3.1 * REM, 5);
    const padding = (0.9 + 1) * REM;
    const head = EST.h1 + 0.6 * REM; // the heading and the song fields share a row at 960
    const thead = 27;
    const stacked = 3 * (EST.button + 2) + 4 * 4; // three 6.8 rem buttons in the 128 px of two tick columns, one per line
    const footer = Math.max(row, stacked);
    expect(padding + head + thead + 5 * row + footer).toBeLessThanOrEqual(pageWithNotice);
  });
});

describe('the import panels', () => {
  it('leave room for several rows of the list beside the fixed parts, with Close and Import in view', () => {
    const panel = H - 2 * REM; // the scrim keeps a 1 rem margin
    const fixed = 28.8 + 23.8 + 30.7 + 45.5 + 41.2; // padding, heading, tempo line, summary, footer
    const rowHeight = 48;
    expect(Math.floor((panel - fixed) / rowHeight)).toBeGreaterThanOrEqual(6);
    const reportFixed = 28.8 + 23.8 + 32.8 + 6.4 + 5.5 * REM + 41.2; // the notes at their largest
    expect(panel - reportFixed).toBeGreaterThanOrEqual(4 * REM); // the report's list keeps its minimum height
  });
});
