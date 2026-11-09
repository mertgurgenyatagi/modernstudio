import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { addNote, removeNote } from '../core/patterns';
import type { DrumNote, Note } from '../core/project';
import { NOTE_VALUE_TICKS, patternTicks, ticksPerBar } from '../core/time';
import { useStudio } from '../state/Studio';
import { CopyNotes } from './editor/CopyNotes';
import { EnvelopeStrip } from './editor/EnvelopeStrip';
import { PatternBank } from './editor/PatternBank';
import { LengthChoice, NoteValueChoice, ShowWholeButton } from './editor/Tools';
import { useTryEdit } from './editor/useTryEdit';
import {
  DRUM_LABELS,
  DRUM_ROWS_TOP_DOWN,
  beatMarks,
  cellStarts,
  describeStart,
  hitWidthTicks,
  isOnGrid,
  playheadPx,
  visibleHits,
} from './editor/grid';
import './drums.css';

const isHit = (note: Note): note is DrumNote => 'row' in note;

/** A position and a width in ticks, which the stylesheet turns into pixels (see drums.css). */
function at(start: number, width: number): CSSProperties {
  return { '--s': start, '--w': width } as CSSProperties;
}

/** The Pad machine (docs/page-designs.md): one panel, every step of the grid a pad you press. */
export function Drums() {
  const { state, project, dispatch, engine } = useStudio();
  const tryEdit = useTryEdit();
  const [note, setNote] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  const instrument = project.instruments.drums;
  const selected = instrument.selectedPattern;
  const pattern = instrument.patterns[selected];
  const bars = pattern?.bars ?? 1;
  const total = patternTicks(project.meter, bars);
  const value = state.noteValue;
  const size = NOTE_VALUE_TICKS[value];

  const starts = useMemo(() => cellStarts(total, value), [total, value]);
  const marks = useMemo(() => beatMarks(project.meter, bars), [project.meter, bars]);
  const hits = useMemo(() => (pattern?.notes ?? []).filter(isHit), [pattern]);

  // The playhead follows the engine while this page's own loop is playing. It is moved straight on the
  // element, once per animation frame, so the page is not redrawn. The view does not scroll to follow it.
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const playhead = playheadRef.current;
      const grid = gridRef.current;
      if (playhead && grid) {
        const request = engine.playingRequest;
        const position = request && request.mode === 'pattern' && request.focus === 'drums' ? engine.position() : null;
        if (position) {
          playhead.style.display = 'block';
          playhead.style.transform = `translateX(${playheadPx(position.tick, total, grid.offsetWidth)}px)`;
        } else {
          playhead.style.display = 'none';
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [engine, total]);

  const place = (row: DrumNote['row'], start: number) => {
    setNote(tryEdit((p) => addNote(p, 'drums', selected, { row, start })) ?? '');
  };

  const remove = (hit: DrumNote) => {
    setNote('');
    dispatch({ type: 'edit', change: (p) => removeNote(p, 'drums', selected, hit) });
  };

  const gridStyle = { '--total': total, '--bar-ticks': ticksPerBar(project.meter) } as CSSProperties;

  return (
    <section className="drums" aria-labelledby="drums-title">
      <div className="drums-head">
        <h1 id="drums-title">Drums</h1>
        <p className="editor-note" role="status">
          {note}
        </p>
      </div>

      <div className="panel">
        <div className="panel-bank">
          <PatternBank id="drums" />
        </div>

        <div className="panel-tools">
          <LengthChoice id="drums" onRefused={setNote} />
          <NoteValueChoice id="drums" />
          <ShowWholeButton />
          <CopyNotes id="drums" onResult={setNote} />
        </div>

        <div className="pads">
          <div className="pad-names" aria-hidden="true">
            <div className="pad-names-head" />
            {DRUM_ROWS_TOP_DOWN.map((row) => (
              <div key={row} className="pad-name">
                {DRUM_LABELS[row]}
              </div>
            ))}
          </div>
          <div className="pad-viewport">
            <div className={state.showWholePattern ? 'pad-grid whole' : 'pad-grid'} ref={gridRef} style={gridStyle}>
              <div className="beat-marks" aria-hidden="true">
                {marks.map((mark) => (
                  <span key={mark.tick} className={mark.barStart ? 'beat bar-start' : 'beat'} style={at(mark.tick, 12)}>
                    {mark.label}
                  </span>
                ))}
              </div>
              {DRUM_ROWS_TOP_DOWN.map((row) => (
                <div key={row} className="pad-row" role="group" aria-label={DRUM_LABELS[row]}>
                  {starts.map((start) => (
                    <button
                      key={start}
                      type="button"
                      className="pad"
                      style={at(start, size)}
                      aria-label={`${DRUM_LABELS[row]}, ${describeStart(start, project.meter)}`}
                      onClick={() => place(row, start)}
                    />
                  ))}
                  {visibleHits(hits, row, total).map((hit) => (
                    <button
                      key={hit.start}
                      type="button"
                      className={isOnGrid(hit.start, value) ? 'hit' : 'hit off-grid'}
                      style={at(hit.start, hitWidthTicks(hit.start, value))}
                      aria-pressed="true"
                      aria-label={`${DRUM_LABELS[row]} hit, ${describeStart(hit.start, project.meter)}. Press to remove.`}
                      onClick={() => remove(hit)}
                    />
                  ))}
                </div>
              ))}
              <div className="pad-playhead" ref={playheadRef} aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="panel-envelope">
          <EnvelopeStrip id="drums" />
        </div>
      </div>
    </section>
  );
}
