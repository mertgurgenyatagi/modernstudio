/**
 * Fit at the default window, 960 by 540 (docs/design.md), checked without a browser (docs/fit.md).
 * Since the sweeping changes of 2026-11-09 nothing shows a scrollbar, so every page must fit.
 *
 * What is read from the code: the row and lane heights (layout.ts, song/geometry.ts) and the zoom
 * (src/state/view.ts), which the pages compute in pixels from the room they have. What is estimated
 * by hand: the height of a bar of buttons, a line of text, and the width of the small buttons (the
 * mono face is about 0.6 em a character). Those estimates are the numbers in `EST` below; they are
 * reasoning, not measurements. Nothing here opens a window.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_WINDOW } from '../core/constants';
import { EDITOR_VIEW_DEFAULT, barsShown, tickWidth } from '../state/view';
import { drumsLayout, keysLayout, rowHeight, stringsLayout } from './editor/layout';
import { CHORDS_PX, LANE_MIN_PX, NAME_PX, TIMELINE_PX, laneHeight } from './song/geometry';

const REM = 16;
const W = DEFAULT_WINDOW.width;
const H = DEFAULT_WINDOW.height;

/** Hand estimates in pixels, at the 16 px root size. */
const EST = {
  topBar: 44, // tabs 0.8 + 0.65 rem padding and a 0.9 rem line, transport 0.4 rem padding and a 30 px button, 1 px rule
  notice: 29, // a one line notice: 0.4 rem padding top and bottom and a 0.85 rem line
  settingsBar: 38, // 1.6 rem buttons, 0.35 rem padding above and below, a 1 px rule
  ruler: 22, // the bar and beat numbers of an editor (NoteEditor.tsx)
  h1: 28, // 1.6 rem Piazzolla at line-height 1.1
  button: 25, // 0.35 rem padding top and bottom, a 0.85 rem line, two 1 px borders
  monoChar: 0.6 * 0.72 * REM, // one character of the small buttons
  rule: 1,
};

const file = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const page = H - EST.topBar; // 496
const pageWithNotice = page - EST.notice; // 467

/** The width of a small button with this text: its characters, 0.3 rem of padding each side, a 1 px border. */
const small = (text: string) => text.length * EST.monoChar + 2 * 0.3 * REM + 1;

describe('the default window', () => {
  it('is 960 by 540 inside the frame', () => {
    expect([W, H]).toEqual([960, 540]);
    expect(page).toBe(496);
    expect(pageWithNotice).toBe(467);
  });
});

describe('the instrument pages', () => {
  const editor = page - EST.settingsBar - EST.ruler;
  const editorWithNotice = pageWithNotice - EST.settingsBar - EST.ruler;

  it('have their settings in one row at 960 wide, the frets and the chord included', () => {
    const pattern = small('‹') + Math.max(small('120'), 2.3 * REM) + small('›');
    const length = ['1×', '2×', '4×', '8×'].map(small).reduce((a, b) => a + b);
    const values = ['1/1', '1/2', '1/4', '1/16', '1/8T', '1/16T'].map(small).reduce((a, b) => a + b);
    const frets = 32 + ['5', '7', '12'].map(small).reduce((a, b) => a + b);
    const chord = small('F♯m7'); // a common four-character name; longer ones are cut at 4.2 rem (editor.css)
    const zoom = ['−', '+', 'Fit'].map(small).reduce((a, b) => a + b);
    const knobs = 4 * (24 + 0.3 * REM + 1.5 * REM) + 3 * 0.5 * REM;
    const quietLine = 3 * REM; // the least the quiet line keeps before the bar wraps
    const gaps = 7 * 0.6 * REM; // eight groups, seven gaps
    const padding = 2 * 0.75 * REM;
    expect(pattern + length + values + frets + chord + zoom + knobs + quietLine + gaps + padding).toBeLessThanOrEqual(W);
  });

  it('give the five drum rows all the room they need, with or without a notice', () => {
    const rowPx = rowHeight(drumsLayout(), editor);
    expect(5 * rowPx).toBeLessThanOrEqual(editor);
    expect(5 * rowHeight(drumsLayout(), editorWithNotice)).toBeLessThanOrEqual(editorWithNotice);
    expect(rowPx).toBeGreaterThanOrEqual(56);
  });

  it('show a whole bass at 5 frets, and scroll a guitar or the keys with the wheel', () => {
    const bass = stringsLayout('bass', 5);
    expect(bass.rows.length * rowHeight(bass, editor)).toBeLessThanOrEqual(editor);
    const rhythm = stringsLayout('rhythm', 7);
    expect(rhythm.rows.length * rowHeight(rhythm, editor)).toBeGreaterThan(editor);
    // At least two whole strings of a guitar at 7 frets are in view.
    expect(Math.floor(editor / rowHeight(rhythm, editor))).toBeGreaterThanOrEqual(2 * 8);
    const keys = keysLayout();
    expect(Math.floor(editor / rowHeight(keys, editor))).toBeGreaterThanOrEqual(24); // two octaves
  });

  it('fill the width with one bar by default: a 16th at least 50 px wide on the drums', () => {
    for (const layout of [drumsLayout(), stringsLayout('lead', 7), keysLayout()]) {
      const tick = tickWidth(W - layout.labelPx, barsShown(EDITOR_VIEW_DEFAULT, 4), 48);
      expect(3 * tick).toBeGreaterThanOrEqual(50);
      expect(tick * 48 + layout.labelPx).toBeLessThanOrEqual(W);
    }
  });
});

describe('the Song page', () => {
  it('fits its five lanes under the settings bar, the bar numbers and the chords, with or without a notice', () => {
    const room = page - EST.settingsBar - TIMELINE_PX - CHORDS_PX;
    const lane = laneHeight(room);
    expect(5 * lane).toBeLessThanOrEqual(room);
    expect(lane).toBeGreaterThanOrEqual(80);
    const roomWithNotice = pageWithNotice - EST.settingsBar - TIMELINE_PX - CHORDS_PX;
    expect(5 * laneHeight(roomWithNotice)).toBeLessThanOrEqual(roomWithNotice);
    expect(laneHeight(roomWithNotice)).toBeGreaterThan(LANE_MIN_PX);
  });

  it('shows sixteen bars of 48 px beside the name column', () => {
    expect(NAME_PX + 16 * 48).toBeLessThanOrEqual(W);
  });
});

describe('the Mixer page', () => {
  it('fits with the three file buttons in their own row, and a notice', () => {
    const css = file('./mixer.css');
    const row = parseFloat(/height:\s*([\d.]+)rem;\s*border-bottom/.exec(css)?.[1] ?? '0') * REM;
    expect(row).toBeCloseTo(3.1 * REM, 5);
    const actions = /\.mixer-actions\s*\{[^}]*margin-top:\s*([\d.]+)rem;[^}]*padding-top:\s*([\d.]+)rem;/.exec(css);
    const actionsRow = (parseFloat(actions?.[1] ?? '0') + parseFloat(actions?.[2] ?? '0')) * REM + EST.rule + EST.button;
    expect(actionsRow).toBeGreaterThan(2 * REM); // well clear of the master's slider
    const padding = (0.9 + 1) * REM;
    const head = EST.h1 + 0.6 * REM; // the heading and the song fields share a row at 960
    const thead = 27;
    expect(padding + head + thead + 6 * row + actionsRow).toBeLessThanOrEqual(pageWithNotice);
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
