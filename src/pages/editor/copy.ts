/**
 * The pure side of "Copy notes to…": which patterns the picker offers and what the quiet line says
 * afterwards. The copy itself is `copyNotes` in src/core/patterns.ts.
 */
import { isActive, type Instrument } from '../../core/project';

/** What happens to the notes the target pattern already has. Replace is the default (docs/open-items.md). */
export type CopyMode = 'replace' | 'add';

export interface CopyTarget {
  /** 0 based index into the instrument's patterns. */
  index: number;
  /** Whether the pattern has notes. */
  active: boolean;
  /** The pattern being copied from, which cannot be its own target. */
  source: boolean;
}

/** The patterns the picker offers: every shown pattern, in order, the selected one marked as the source. */
export function copyTargets(instrument: Instrument): CopyTarget[] {
  return instrument.patterns.slice(0, instrument.shownPatterns).map((pattern, index) => ({
    index,
    active: isActive(pattern),
    source: index === instrument.selectedPattern,
  }));
}

/** The quiet line after a copy. `to` is 0 based; the words use the pattern numbers the user sees. */
export function copyResult(to: number, mode: CopyMode, sourceHasNotes: boolean): string {
  const number = to + 1;
  if (!sourceHasNotes) {
    return mode === 'replace' ? `Pattern ${number} emptied: the pattern copied from has no notes.` : `Nothing to add: the pattern copied from has no notes.`;
  }
  return mode === 'replace' ? `Copied to pattern ${number}, replacing its notes.` : `Added to pattern ${number}.`;
}
