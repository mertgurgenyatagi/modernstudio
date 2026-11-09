/**
 * The brush of the Song page: which pattern the chosen instrument would place. Only active patterns
 * can be placed, so the stepper skips empty ones (docs/page-designs.md). Pure.
 */
import { isActive, type Instrument } from '../../core/project';

/** The numbers (0 based) of the shown patterns that have notes, in order. */
export function readyPatterns(instrument: Instrument): number[] {
  const ready: number[] = [];
  for (let i = 0; i < instrument.shownPatterns; i += 1) {
    const pattern = instrument.patterns[i];
    if (pattern && isActive(pattern)) ready.push(i);
  }
  return ready;
}

/**
 * The pattern the brush holds: the selected pattern if it is ready, otherwise the next ready one,
 * otherwise the last one before it. Null when no pattern is ready.
 */
export function brushPattern(instrument: Instrument): number | null {
  const ready = readyPatterns(instrument);
  if (ready.length === 0) return null;
  if (ready.includes(instrument.selectedPattern)) return instrument.selectedPattern;
  return ready.find((n) => n > instrument.selectedPattern) ?? ready[ready.length - 1] ?? null;
}

/** The ready pattern before (-1) or after (+1) the brush's, or null at either end. */
export function stepBrush(instrument: Instrument, direction: -1 | 1): number | null {
  const current = brushPattern(instrument);
  if (current === null) return null;
  const ready = readyPatterns(instrument);
  const at = ready.indexOf(current);
  return ready[at + direction] ?? null;
}
