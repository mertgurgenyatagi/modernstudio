import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useDismiss } from './useDismiss';
import './menu.css';

/**
 * A menu that opens where the right mouse button was pressed (`x`, `y` in window pixels), moved in if
 * it would stick out of the window. Escape, a press or the wheel outside, or a pick closes it.
 */
export function ContextMenu({ x, y, label, onClose, children }: { x: number; y: number; label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(true, ref, onClose);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    element.style.left = `${Math.max(4, Math.min(x, window.innerWidth - box.width - 4))}px`;
    element.style.top = `${Math.max(4, Math.min(y, window.innerHeight - box.height - 4))}px`;
    element.querySelector<HTMLElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [x, y]);
  return (
    <div ref={ref} className="menu" role="menu" aria-label={label} style={{ left: x, top: y }} onContextMenu={(event) => event.preventDefault()}>
      {children}
    </div>
  );
}
