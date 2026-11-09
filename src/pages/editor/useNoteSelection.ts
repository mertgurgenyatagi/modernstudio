import { useCallback, useState } from 'react';

/**
 * The selected note of a note editor, as its key (see `noteKey`). The selection belongs to a scope,
 * the instrument and pattern on screen: when the scope changes the selection is gone, so a Delete
 * never reaches a note of another pattern that happens to share its key.
 */
export function useNoteSelection(scope: string): [string | null, (key: string | null) => void] {
  const [selection, setSelection] = useState<{ scope: string; key: string } | null>(null);
  const select = useCallback((key: string | null) => setSelection(key === null ? null : { scope, key }), [scope]);
  return [selection && selection.scope === scope ? selection.key : null, select];
}
