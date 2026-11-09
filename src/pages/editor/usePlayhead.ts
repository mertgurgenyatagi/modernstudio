import { useEffect, useRef, type RefObject } from 'react';
import type { InstrumentId } from '../../core/instruments';
import { useStudio } from '../../state/Studio';
import { playheadPx } from './grid';

/**
 * The playhead of a note editor (Guitar and Keys). It follows the engine while this instrument's own
 * pattern loop is playing. It is moved straight on the element once per animation frame, so the page is
 * not redrawn. The view does not scroll to follow it. `rulerRef` is the beat ruler, which is exactly
 * `total` ticks wide; the returned ref goes on the playhead element.
 */
export function usePlayhead(id: InstrumentId, total: number, rulerRef: RefObject<HTMLDivElement | null>) {
  const { engine } = useStudio();
  const playheadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const playhead = playheadRef.current;
      const ruler = rulerRef.current;
      if (playhead && ruler) {
        const request = engine.playingRequest;
        const position = request && request.mode === 'pattern' && request.focus === id ? engine.position() : null;
        if (position) {
          playhead.style.display = 'block';
          playhead.style.transform = `translateX(${playheadPx(position.tick, total, ruler.offsetWidth)}px)`;
        } else {
          playhead.style.display = 'none';
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [engine, id, total, rulerRef]);
  return playheadRef;
}
