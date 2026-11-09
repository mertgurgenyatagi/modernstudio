import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { FRET_COUNTS, INSTRUMENT_LABELS, TUNING, type FretCount, type StringInstrumentId } from '../core/instruments';
import { addNote, noteKey, replaceNote } from '../core/patterns';
import { setFretCount, type StringNote } from '../core/project';
import { patternTicks, ticksPerBar } from '../core/time';
import { useStudio } from '../state/Studio';
import { EnvelopeStrip } from './editor/EnvelopeStrip';
import { beatMarks, describeStart, playheadPx } from './editor/grid';
import {
  clickStart,
  fretRows,
  hiddenAboveFret,
  newNoteLength,
  notesAt,
  stringNames,
} from './editor/noteGeometry';
import { PatternBank } from './editor/PatternBank';
import { LengthChoice, NoteValueChoice, ShowWholeButton } from './editor/Tools';
import { useNoteDrag } from './editor/useNoteDrag';
import { useTryEdit } from './editor/useTryEdit';
import './guitar.css';

const GUITARS: readonly StringInstrumentId[] = ['bass', 'rhythm', 'lead'];

const isStringNote = (note: unknown): note is StringNote => typeof note === 'object' && note !== null && 'string' in note;

/** A position and a width in ticks, which the stylesheet turns into pixels (see guitar.css). */
function at(start: number, width: number): CSSProperties {
  return { '--s': start, '--w': width } as CSSProperties;
}

/** The String cards (docs/page-designs.md): Bass, Rhythm Guitar and Lead Guitar, one card per string. */
export function Guitar() {
  const { state, project, dispatch, engine } = useStudio();
  const tryEdit = useTryEdit();
  const [message, setMessage] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  const id = state.guitar;
  const instrument = project.instruments[id];
  const fretCount: FretCount = instrument.fretCount ?? 7;
  const selected = instrument.selectedPattern;
  const pattern = instrument.patterns[selected];
  const bars = pattern?.bars ?? 1;
  const total = patternTicks(project.meter, bars);
  const value = state.noteValue;

  const notes = useMemo(() => (pattern?.notes ?? []).filter(isStringNote), [pattern]);
  const marks = useMemo(() => beatMarks(project.meter, bars), [project.meter, bars]);
  const names = stringNames(id);
  const frets = fretRows(fretCount);
  const hidden = hiddenAboveFret(notes, fretCount);

  const { preview, begin } = useNoteDrag<StringNote>({
    value,
    total,
    onClick: (note) => {
      setMessage('');
      setSelectedKey(noteKey(note));
    },
    onCommit: (note, next) => {
      const to: StringNote = { ...note, start: next.start, length: next.length };
      const reason = tryEdit((p) => replaceNote(p, id, selected, note, to));
      setMessage(reason ?? '');
      if (!reason) setSelectedKey(noteKey(to));
    },
  });

  // The playhead follows the engine while this page's own loop is playing. It is moved straight on the
  // element once per animation frame, so the page is not redrawn. The view does not scroll to follow it.
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
  }, [engine, id, total]);

  /** The width of a tick on screen, measured from the beat ruler, which is exactly `total` ticks wide. */
  const tickPx = () => (rulerRef.current && total > 0 ? rulerRef.current.getBoundingClientRect().width / total : 0);

  const place = (event: ReactMouseEvent<HTMLDivElement>, string: number, fret: number) => {
    const px = tickPx();
    if (px <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const start = clickStart(event.clientX - rect.left, px, value, total);
    const note: StringNote = { string, fret, start, length: newNoteLength(start, value, total) };
    const reason = tryEdit((p) => addNote(p, id, selected, note));
    setMessage(reason ?? '');
    setSelectedKey(reason ? null : noteKey(note));
  };

  const chooseGuitar = (next: StringInstrumentId) => {
    setMessage('');
    setSelectedKey(null);
    dispatch({ type: 'setGuitar', id: next });
  };

  const gridStyle = { '--total': total, '--bar-ticks': ticksPerBar(project.meter) } as CSSProperties;
  const hiddenLine =
    hidden === 0 ? '' : `${hidden} ${hidden === 1 ? 'note is' : 'notes are'} on frets above ${fretCount}: hidden, kept, back when frets are raised.`;

  return (
    <section className="guitar" aria-labelledby="guitar-title">
      <div className="guitar-main">
        <div className="guitar-head">
          <h1 id="guitar-title">{INSTRUMENT_LABELS[id]}</h1>
          <p className="editor-note" role="status">
            {message || hiddenLine}
          </p>
        </div>

        <PatternBank id={id} />

        <div className="guitar-tools">
          <LengthChoice id={id} onRefused={setMessage} />
          <NoteValueChoice id={id} />
        </div>

        <div className="cards-scroll">
          <div className={state.showWholePattern ? 'cards whole' : 'cards'} style={gridStyle}>
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

            {names.map((name, string) => (
              <section key={string} className="card" aria-label={`String ${name}`}>
                <header className="card-head">
                  <span className="card-name">{name}</span>
                  <span className="card-sub">open string</span>
                </header>
                {frets.map((fret) => (
                  <div key={fret} className={fret === 0 ? 'fret-line open' : 'fret-line'}>
                    <div className="fret-label figure">{fret}</div>
                    <div
                      className="fret-row"
                      role="group"
                      aria-label={`${name}, fret ${fret}`}
                      onClick={(event) => place(event, string, fret)}
                    >
                      {notesAt(notes, string, fret, fretCount, total).map((note) => {
                        const key = noteKey(note);
                        const live = preview && preview.key === key ? preview : note;
                        const classes = ['note'];
                        if (key === selectedKey) classes.push('selected');
                        if (preview && preview.key === key) classes.push('dragging');
                        return (
                          <div
                            key={key}
                            className={classes.join(' ')}
                            style={at(live.start, live.length)}
                            role="button"
                            tabIndex={0}
                            aria-pressed={key === selectedKey}
                            aria-label={`${name}, fret ${fret}, ${describeStart(live.start, project.meter)}`}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') setSelectedKey(key);
                            }}
                            onPointerDown={(event) => begin(event, note, key, 'move', tickPx())}
                          >
                            <span className="note-fret figure">{note.fret}</span>
                            <span
                              className="note-grip"
                              aria-hidden="true"
                              onPointerDown={(event) => begin(event, note, key, 'resize', tickPx())}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            ))}
            <div className="cards-playhead" ref={playheadRef} aria-hidden="true" />
          </div>
        </div>
      </div>

      <aside className="guitar-side" aria-label="Instrument settings">
        <div className="side-group">
          <span className="tool-label" id="guitar-choice-label">
            Instrument
          </span>
          <div className="side-buttons" role="radiogroup" aria-labelledby="guitar-choice-label">
            {GUITARS.map((guitar) => (
              <button
                key={guitar}
                type="button"
                role="radio"
                aria-checked={id === guitar}
                onClick={() => chooseGuitar(guitar)}
              >
                {INSTRUMENT_LABELS[guitar]}
                <span className="side-sub">{TUNING[guitar].length} strings</span>
              </button>
            ))}
          </div>
        </div>

        <div className="side-group">
          <span className="tool-label" id="guitar-frets-label">
            Frets
          </span>
          <div className="side-frets" role="radiogroup" aria-labelledby="guitar-frets-label">
            {FRET_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                role="radio"
                aria-checked={fretCount === count}
                onClick={() => dispatch({ type: 'edit', change: (p) => setFretCount(p, id, count) })}
              >
                {count}
              </button>
            ))}
          </div>
          <ShowWholeButton />
        </div>

        <div className="side-group side-envelope">
          <span className="tool-label">Envelope</span>
          <EnvelopeStrip id={id} />
        </div>
      </aside>
    </section>
  );
}
