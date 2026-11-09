import type { CSSProperties, RefObject } from 'react';
import { beatMarks } from './grid';

/** A position and a width in ticks, which the stylesheet turns into pixels (see noteEditor.css). */
export function at(start: number, width: number): CSSProperties {
  return { '--s': start, '--w': width } as CSSProperties;
}

/** The beat numbers above the rows of a note editor (Guitar and Keys). Sticks to the top of the scrolling area. */
export function Ruler({ marks, rulerRef }: { marks: ReturnType<typeof beatMarks>; rulerRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="ruler-row">
      <div className="ruler-spacer" aria-hidden="true" />
      <div className="ruler" ref={rulerRef} aria-hidden="true">
        {marks.map((mark) => (
          <span key={mark.tick} className={mark.barStart ? 'tick-label bar-start' : 'tick-label'} style={at(mark.tick, 12)}>
            {mark.label}
          </span>
        ))}
      </div>
    </div>
  );
}
