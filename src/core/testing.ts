/** Helpers for the unit tests in this folder. */
import type { Outcome, Project } from './project';

/** The project of an edit that must succeed. */
export function must(outcome: Outcome): Project {
  if (!outcome.ok) throw new Error(`Expected the edit to succeed, but it was refused: ${outcome.reason}`);
  return outcome.project;
}
