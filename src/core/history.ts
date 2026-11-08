/**
 * Undo: a history of whole-project snapshots. They share most of their data, since edits copy only
 * what changed. There is no redo. An import starts a new project with an empty history
 * (docs/editing-and-project.md).
 */
import { INSTRUMENT_IDS } from './instruments';
import type { Instrument, Project } from './project';

/** How many steps back Undo goes (an assumption; the docs set no limit). */
export const HISTORY_LIMIT = 1000;

export interface History {
  /** Older projects, oldest first. */
  past: readonly Project[];
  present: Project;
  /** The coalescing key of the last commit, so a slider drag becomes one step. */
  lastKey: string | null;
}

/** A history with nothing to undo. */
export function newHistory(project: Project): History {
  return { past: [], present: project, lastKey: null };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

/**
 * Records an edit. An edit that changed nothing (same object) adds no step. Successive edits with the
 * same `coalesceKey` (a slider being dragged) replace the present instead of adding a step each.
 */
export function commit(history: History, project: Project, coalesceKey?: string): History {
  if (project === history.present) return history;
  if (coalesceKey !== undefined && coalesceKey === history.lastKey) {
    return { ...history, present: project };
  }
  const past = [...history.past, history.present];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { past, present: project, lastKey: coalesceKey ?? null };
}

/** Changes the project without a step: for choices such as the selected pattern, which Undo leaves alone. */
export function replacePresent(history: History, project: Project): History {
  return project === history.present ? history : { ...history, present: project, lastKey: null };
}

/**
 * Steps back one edit. The selected pattern of each instrument, and how many patterns are shown,
 * stay as they are now: they are choices, not edits.
 */
export function undo(history: History): History {
  const previous = history.past[history.past.length - 1];
  if (!previous) return history;
  const instruments = { ...previous.instruments };
  for (const id of INSTRUMENT_IDS) {
    const now = history.present.instruments[id];
    const then = previous.instruments[id];
    if (now.selectedPattern !== then.selectedPattern || now.shownPatterns > then.shownPatterns) {
      const merged: Instrument = {
        ...then,
        selectedPattern: now.selectedPattern,
        shownPatterns: Math.max(then.shownPatterns, now.shownPatterns),
      };
      instruments[id] = merged;
    }
  }
  return { past: history.past.slice(0, -1), present: { ...previous, instruments }, lastKey: null };
}
