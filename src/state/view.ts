/**
 * Horizontal zoom (the user's sweeping changes, 2026-11-09): how much of a pattern an instrument page
 * shows across its width, and how wide a bar is on the Song page. Pure, so it is tested without a
 * window. Screen state only: not saved, not undone.
 */

/** The instrument pages' view, shared by all of them as "Show whole pattern" was. */
export interface EditorView {
  /** The whole pattern fits the width, whatever its length (the old "Show whole pattern"). */
  fit: boolean;
  /** How many bars fill the width when not fitting: 1 is one bar, the default; 0.25 is one beat of 4/4. */
  barsInView: number;
}

export const EDITOR_VIEW_DEFAULT: EditorView = { fit: false, barsInView: 1 };
export const BARS_IN_VIEW_MIN = 0.25;
export const BARS_IN_VIEW_MAX = 8;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** How many bars fill the width for a pattern of `patternBars`: never more than the pattern. */
export function barsShown(view: EditorView, patternBars: number): number {
  if (view.fit) return patternBars;
  return clamp(view.barsInView, BARS_IN_VIEW_MIN, Math.max(patternBars, BARS_IN_VIEW_MIN));
}

/**
 * The view after zooming by `factor` from what is shown now: above 1 shows more bars (zooms out),
 * below 1 fewer (zooms in). Zooming ends "fit". At the pattern's full length it is fit again.
 */
export function zoomView(view: EditorView, patternBars: number, factor: number): EditorView {
  const now = barsShown(view, patternBars);
  const next = clamp(now * factor, BARS_IN_VIEW_MIN, Math.min(BARS_IN_VIEW_MAX, Math.max(patternBars, BARS_IN_VIEW_MIN)));
  return { fit: false, barsInView: next };
}

/** The Fit button: on fits the whole pattern; off goes back to one bar across the width. */
export function toggleFit(view: EditorView): EditorView {
  return view.fit ? { fit: false, barsInView: 1 } : { fit: true, barsInView: view.barsInView };
}

/** Whether the Fit button shows as pressed: the whole pattern is in view. */
export function isFitting(view: EditorView, patternBars: number): boolean {
  return view.fit || barsShown(view, patternBars) >= patternBars;
}

/** The width of a tick in pixels, when `bars` bars of `barTicks` fill `widthPx`. */
export function tickWidth(widthPx: number, bars: number, barTicks: number): number {
  if (widthPx <= 0 || bars <= 0 || barTicks <= 0) return 0;
  return widthPx / (bars * barTicks);
}

/**
 * Where to scroll so that the point under the pointer stays under it after a zoom: `at` is the
 * position in ticks (or bars) under the pointer, `offsetPx` how far the pointer is from the left edge
 * of the scrolling area, `unitPx` the new width of one tick (or bar).
 */
export function anchoredScroll(at: number, offsetPx: number, unitPx: number): number {
  return Math.max(0, at * unitPx - offsetPx);
}

/** One notch of the mouse wheel with Ctrl held zooms by this much; the buttons zoom by twice as much. */
export const WHEEL_ZOOM = 1.15;
export const BUTTON_ZOOM = 2;

/** The wheel's zoom factor: wheeling up (negative deltaY) zooms in, as in most programs. */
export function wheelFactor(deltaY: number): number {
  if (deltaY === 0) return 1;
  const notches = clamp(Math.abs(deltaY) / 100, 0.25, 3);
  return deltaY > 0 ? WHEEL_ZOOM ** notches : 1 / WHEEL_ZOOM ** notches;
}

// ---- The Song page ----

export const SONG_BAR_PX_DEFAULT = 48;
export const SONG_BAR_PX_MIN = 4;
export const SONG_BAR_PX_MAX = 192;

/** The width of a bar after zooming by `factor` (above 1 zooms out: bars get narrower). */
export function zoomSongBarPx(barPx: number, factor: number): number {
  return clamp(barPx / factor, SONG_BAR_PX_MIN, SONG_BAR_PX_MAX);
}

/** The width of a bar that fits the whole song (at least 16 bars, plus one to place after it) in `widthPx`. */
export function fitSongBarPx(widthPx: number, songBars: number): number {
  const bars = Math.max(16, songBars + 1);
  return clamp(widthPx / bars, SONG_BAR_PX_MIN, SONG_BAR_PX_MAX);
}

/** Every how many bars the timeline writes a number, so that the numbers never crowd (about 28 px apart at least). */
export function barNumberEvery(barPx: number): number {
  let every = 1;
  while (every * barPx < 28 && every < 64) every *= 2;
  return every;
}
