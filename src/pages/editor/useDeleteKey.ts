import { useEffect } from 'react';
import { isTypingTarget } from '../../state/keys';

/**
 * Runs `onDelete` when Delete is pressed, except while typing in a field. Pass null when there is
 * nothing to delete, and the key is left alone.
 */
export function useDeleteKey(onDelete: (() => void) | null): void {
  useEffect(() => {
    if (!onDelete) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' || isTypingTarget(event.target as HTMLElement | null)) return;
      event.preventDefault();
      onDelete();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDelete]);
}
