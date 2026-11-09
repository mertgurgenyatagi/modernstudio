import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { INSTRUMENT_IDS, INSTRUMENT_LABELS, type InstrumentId } from '../core/instruments';
import { blockBars, selectPattern, type Block } from '../core/project';
import { blockAt, moveBlock, placeBlock, removeBlock, songBars } from '../core/song';
import { ticksPerBar } from '../core/time';
import { isTypingTarget } from '../state/keys';
import { useStudio } from '../state/Studio';
import { brushPattern, stepBrush } from './song/brush';
import {
  BAR_PX,
  SONG_WIDTH_PX,
  barFromPx,
  barNumberAtTick,
  barToPx,
  blockWidthPx,
  dropBar,
  ghostStartBar,
  songTickToPx,
} from './song/geometry';
import './song.css';

/** A block being dragged: where it was picked up and where it would land now. */
interface Drag {
  instrument: InstrumentId;
  startBar: number;
  bars: number;
  /** How far from the block's left edge the pointer took hold. */
  grabPx: number;
  target: number;
}

const BAR_NUMBERS = Array.from({ length: 256 }, (_, i) => i + 1);

/** The pointer's x position inside a lane's track, which accounts for the sideways scroll. */
function trackX(event: { clientX: number }, track: HTMLElement): number {
  return event.clientX - track.getBoundingClientRect().left;
}

export function Song() {
  const { state, project, dispatch, engine, seek } = useStudio();
  const [note, setNote] = useState('');
  const [hover, setHover] = useState<{ instrument: InstrumentId; bar: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const total = songBars(project);
  const brushInstrument = project.instruments[state.brush];
  const held = brushPattern(brushInstrument);
  const prev = stepBrush(brushInstrument, -1);
  const next = stepBrush(brushInstrument, 1);
  const heldBars = held === null ? 1 : (brushInstrument.patterns[held]?.bars ?? 1);
  const selected = state.selectedBlock;

  // The playhead and the readout follow the engine while playing, and stand at the start bar otherwise.
  // They are moved straight on the elements, once per animation frame, so the page is not redrawn.
  useEffect(() => {
    const perBar = ticksPerBar(project.meter);
    let frame = 0;
    const tick = () => {
      const position = state.playing ? engine.position() : null;
      const songTick = position ? position.songTick : state.startBar * perBar;
      if (playheadRef.current) playheadRef.current.style.transform = `translateX(${songTickToPx(songTick, project.meter)}px)`;
      if (readoutRef.current) readoutRef.current.textContent = String(barNumberAtTick(songTick, project.meter));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [engine, project.meter, state.playing, state.startBar]);

  // Delete removes the selected block (questionnaire 16: no button).
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' || isTypingTarget(event.target as HTMLElement | null)) return;
      event.preventDefault();
      dispatch({ type: 'edit', change: (p) => removeBlock(p, selected.instrument, selected.startBar) });
      dispatch({ type: 'selectBlock', block: null });
      setNote('');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, dispatch]);

  const place = (instrument: InstrumentId, bar: number) => {
    if (instrument !== state.brush) {
      // A click in another lane picks that lane for the brush; the next click places.
      dispatch({ type: 'setBrush', id: instrument });
      setNote('');
      return;
    }
    if (held === null) {
      setNote(`${INSTRUMENT_LABELS[instrument]} has no pattern with notes yet.`);
      return;
    }
    const outcome = placeBlock(project, instrument, held, bar);
    if (!outcome.ok) {
      setNote(outcome.reason);
      return;
    }
    setNote('');
    dispatch({
      type: 'edit',
      change: (p) => {
        const again = placeBlock(p, instrument, held, bar);
        return again.ok ? again.project : p;
      },
    });
    dispatch({ type: 'selectBlock', block: { instrument, startBar: bar } });
  };

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, instrument: InstrumentId, block: Block) => {
    if (event.button !== 0) return;
    const track = event.currentTarget.parentElement as HTMLElement;
    event.currentTarget.setPointerCapture(event.pointerId);
    dispatch({ type: 'selectBlock', block: { instrument, startBar: block.startBar } });
    setNote('');
    setDrag({
      instrument,
      startBar: block.startBar,
      bars: blockBars(project, instrument, block),
      grabPx: trackX(event, track) - barToPx(block.startBar),
      target: block.startBar,
    });
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const track = event.currentTarget.parentElement as HTMLElement;
    const target = dropBar(trackX(event, track), drag.grabPx, drag.bars);
    if (target !== drag.target) setDrag({ ...drag, target });
  };

  const endDrag = () => {
    if (!drag) return;
    const { instrument, startBar, target } = drag;
    setDrag(null);
    if (target === startBar) return;
    const outcome = moveBlock(project, instrument, startBar, target);
    if (!outcome.ok) {
      // The block snaps back, and the reason shows.
      setNote(outcome.reason);
      return;
    }
    setNote('');
    dispatch({
      type: 'edit',
      change: (p) => {
        const moved = moveBlock(p, instrument, startBar, target);
        return moved.ok ? moved.project : p;
      },
    });
    dispatch({ type: 'selectBlock', block: { instrument, startBar: target } });
  };

  const onTimelineKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowLeft') seek(Math.max(0, state.startBar - 1));
    else if (event.key === 'ArrowRight') seek(Math.min(255, state.startBar + 1));
    else return;
    event.preventDefault();
  };

  const ghostFits = (instrument: InstrumentId, bar: number) => held !== null && placeBlock(project, instrument, held, bar).ok;

  return (
    <section className="song" aria-labelledby="song-title" style={{ '--bar-px': `${BAR_PX}px` } as CSSProperties}>
      <div className="song-bar">
        <div className="song-where">
          <h1 id="song-title">Song</h1>
          <p className="song-readout">
            Bar <span ref={readoutRef}>{state.startBar + 1}</span>
            {total > 0 ? ` of ${total}` : ' · empty'}
          </p>
          <p className="song-note" role="status">
            {note}
          </p>
        </div>

        <div className="brush">
          <span className="brush-word" id="brush-label">
            Place
          </span>
          <div className="brush-choice" role="radiogroup" aria-labelledby="brush-label">
            {INSTRUMENT_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={state.brush === id}
                onClick={() => {
                  dispatch({ type: 'setBrush', id });
                  setNote('');
                }}
              >
                {INSTRUMENT_LABELS[id]}
              </button>
            ))}
          </div>
          <div className="stepper" role="group" aria-label="Pattern to place">
            <button
              type="button"
              aria-label="Previous pattern"
              disabled={prev === null}
              onClick={() => prev !== null && dispatch({ type: 'select', change: (p) => selectPattern(p, state.brush, prev) })}
            >
              ‹
            </button>
            <output className="stepper-number" aria-label="Pattern">
              {held === null ? '–' : held + 1}
            </output>
            <button
              type="button"
              aria-label="Next pattern"
              disabled={next === null}
              onClick={() => next !== null && dispatch({ type: 'select', change: (p) => selectPattern(p, state.brush, next) })}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <div className="song-scroll">
        <div className="song-grid" style={{ width: `calc(var(--name-w) + ${SONG_WIDTH_PX}px)` }}>
          <div className="song-row song-timeline-row">
            <div className="lane-name" />
            <button
              type="button"
              className="timeline"
              aria-label="Playhead. Click a bar number to move it; the arrow keys move it one bar."
              onClick={(event) => seek(barFromPx(trackX(event, event.currentTarget)))}
              onKeyDown={onTimelineKey}
            >
              {BAR_NUMBERS.map((n) => (
                <span key={n} className="timeline-bar" aria-hidden="true">
                  {n}
                </span>
              ))}
            </button>
          </div>

          <div className="song-lanes">
            {INSTRUMENT_IDS.map((id) => {
              const isBrush = state.brush === id;
              return (
                <div key={id} className="song-row">
                  <div className={isBrush ? 'lane-name brush-lane' : 'lane-name'}>
                    <span>{INSTRUMENT_LABELS[id]}</span>
                  </div>
                  <div
                    className="track"
                    onClick={(event) => place(id, barFromPx(trackX(event, event.currentTarget)))}
                    onPointerMove={(event) => {
                      if (!isBrush || drag) return;
                      const bar = ghostStartBar(trackX(event, event.currentTarget));
                      setHover(hover && hover.instrument === id && hover.bar === bar ? hover : { instrument: id, bar });
                    }}
                    onPointerLeave={() => setHover(null)}
                  >
                    {project.instruments[id].lane.map((block) => {
                      const dragging = drag !== null && drag.instrument === id && drag.startBar === block.startBar;
                      const bars = blockBars(project, id, block);
                      const at = dragging ? drag.target : block.startBar;
                      const refused = dragging && !moveBlock(project, id, block.startBar, at).ok;
                      const isSelected = selected?.instrument === id && selected.startBar === block.startBar;
                      const classes = ['block'];
                      if (isSelected) classes.push('selected');
                      if (dragging) classes.push('dragging');
                      if (refused) classes.push('refused');
                      return (
                        <button
                          key={block.startBar}
                          type="button"
                          className={classes.join(' ')}
                          style={{ left: barToPx(at), width: blockWidthPx(bars) }}
                          aria-pressed={isSelected}
                          aria-label={`${INSTRUMENT_LABELS[id]} pattern ${block.pattern + 1}, bar ${block.startBar + 1}, ${bars} ${bars === 1 ? 'bar' : 'bars'}`}
                          onClick={(event) => event.stopPropagation()}
                          onPointerDown={(event) => startDrag(event, id, block)}
                          onPointerMove={moveDrag}
                          onPointerUp={endDrag}
                          onPointerCancel={() => setDrag(null)}
                        >
                          {block.pattern + 1}
                        </button>
                      );
                    })}
                    {isBrush && !drag && hover && hover.instrument === id && held !== null && !blockAt(project, id, hover.bar) && (
                      <div
                        className={ghostFits(id, hover.bar) ? 'ghost' : 'ghost refused'}
                        style={{ left: barToPx(hover.bar), width: blockWidthPx(heldBars) }}
                        aria-hidden="true"
                      >
                        {held + 1}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="playhead" ref={playheadRef} aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
