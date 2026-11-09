/**
 * What the Song page's right-click menu offers on an empty bar of a lane: the instrument's patterns
 * that have notes (only those can be placed), each with whether it fits there. Pure.
 */
import type { InstrumentId } from '../../core/instruments';
import { isActive, type Project } from '../../core/project';
import { placeBlock } from '../../core/song';

export interface PatternChoice {
  /** 0 based. */
  index: number;
  bars: number;
  /** Placing it at the bar would not overlap a block or pass bar 256. */
  fits: boolean;
}

export function patternChoices(project: Project, id: InstrumentId, bar: number): PatternChoice[] {
  const instrument = project.instruments[id];
  const out: PatternChoice[] = [];
  for (let index = 0; index < instrument.shownPatterns; index += 1) {
    const pattern = instrument.patterns[index];
    if (!pattern || !isActive(pattern)) continue;
    out.push({ index, bars: pattern.bars, fits: placeBlock(project, id, index, bar).ok });
  }
  return out;
}
