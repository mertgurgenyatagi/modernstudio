import { useCallback } from 'react';
import type { Outcome, Project } from '../../core/project';
import { useStudio } from '../../state/Studio';

/**
 * Runs an edit that a rule can refuse. Returns the reason when the model refuses, so the page can say
 * why in a quiet line, and null when the edit went through (and landed in the Undo history).
 *
 * The edit is checked against the project on screen, then applied to the latest project inside the
 * reducer, so two quick edits in a row both land.
 */
export function useTryEdit(): (change: (project: Project) => Outcome, key?: string) => string | null {
  const { project, dispatch } = useStudio();
  return useCallback(
    (change, key) => {
      const outcome = change(project);
      if (!outcome.ok) return outcome.reason;
      dispatch({
        type: 'edit',
        change: (p) => {
          const again = change(p);
          return again.ok ? again.project : p;
        },
        key,
      });
      return null;
    },
    [project, dispatch],
  );
}
