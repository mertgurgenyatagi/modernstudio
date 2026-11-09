import { useEffect, useRef, type RefObject } from 'react';

/**
 * Closes a small panel (a menu, the pattern picker) when Escape is pressed, or the pointer goes down
 * or the wheel turns anywhere outside `ref`, or the window loses the focus. Does nothing while `open`
 * is false.
 */
export function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void): void {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      latest.current();
    };
    const onPointerDown = (event: Event) => {
      if (ref.current && !ref.current.contains(event.target as Node)) latest.current();
    };
    const onBlur = () => latest.current();
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('wheel', onPointerDown, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('wheel', onPointerDown, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [open, ref]);
}
