import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { NoteValue } from '../../core/time';
import { DRAG_THRESHOLD_PX, movedStart, pxToTicks, resizedLength } from './noteGeometry';

/**
 * A drag that ends over another element would otherwise be followed by a click on whatever holds both
 * ends (the row, which places a note). The click that comes straight after the release is stopped.
 */
function swallowNextClick(): void {
  const stop = (event: Event) => event.stopPropagation();
  window.addEventListener('click', stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
}

export type DragMode = 'move' | 'resize';

export interface Span {
  start: number;
  length: number;
}

/** The note being dragged and where it would land if the pointer were let go now. */
export interface DragPreview extends Span {
  key: string;
}

interface Options<N extends Span> {
  /** The note value the drag snaps to. */
  value: NoteValue;
  /** The ticks the shown pattern covers. */
  total: number;
  /** The pointer was let go after a real drag, and the note ended up somewhere else. */
  onCommit: (note: N, next: Span) => void;
  /** The pointer was pressed and let go without moving: a click on the note. */
  onClick: (note: N) => void;
}

/**
 * Dragging a note that has a length, shared by the Guitar and Keys pages: the body of a note moves
 * it, its right edge lengthens or shortens it, both snapped to the note value (noteGeometry.ts).
 * While dragging, `preview` says where the note would land, so the page can draw it there; the
 * model is changed once, on release. Listeners are on the window, so a drag that leaves the note
 * (or the card) carries on.
 */
export function useNoteDrag<N extends Span>(options: Options<N>) {
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const begin = useCallback((event: ReactPointerEvent, note: N, key: string, mode: DragMode, tickPx: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const x0 = event.clientX;
    let moved = false;
    let last: Span = { start: note.start, length: note.length };

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - x0;
      if (!moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
      moved = true;
      const { value, total } = latest.current;
      const ticks = pxToTicks(dx, tickPx);
      last =
        mode === 'move'
          ? { start: movedStart(note.start, note.length, ticks, value, total), length: note.length }
          : { start: note.start, length: resizedLength(note.start, note.length, ticks, value, total) };
      setPreview({ key, ...last });
    };

    const end = (commit: boolean) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      setPreview(null);
      if (moved) swallowNextClick();
      if (!commit) return;
      if (!moved) latest.current.onClick(note);
      else if (last.start !== note.start || last.length !== note.length) latest.current.onCommit(note, last);
    };
    const onUp = () => end(true);
    const onCancel = () => end(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }, []);

  return { preview, begin };
}
