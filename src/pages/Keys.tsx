import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { INSTRUMENT_LABELS } from '../core/instruments';
import { addNote, noteKey, replaceNote } from '../core/patterns';
import type { KeysNote } from '../core/project';
import { patternTicks, ticksPerBar } from '../core/time';
import { useStudio } from '../state/Studio';
import { EnvelopeStrip } from './editor/EnvelopeStrip';
import { beatMarks, describeStart } from './editor/grid';
import { KEY_ROWS, hiddenOutOfRange, isBlackKey, keyLabel, keyNotesAt, startScrollTop } from './editor/keyRoll';
import { clickStart, newNoteLength, pitchName } from './editor/noteGeometry';
import { PatternBank } from './editor/PatternBank';
import { Ruler, at } from './editor/Ruler';
import { LengthChoice, NoteValueChoice, ShowWholeButton } from './editor/Tools';
import { useNoteDrag } from './editor/useNoteDrag';
import { usePlayhead } from './editor/usePlayhead';
import { useTryEdit } from './editor/useTryEdit';
import './editor/noteEditor.css';
import './keys.css';

const isKeysNote = (note: unknown): note is KeysNote => typeof note === 'object' && note !== null && 'pitch' in note;

/**
 * The Keys page: the Guitar page's two columns, pattern row, tools row and side panel, with the string
 * cards replaced by a regular piano roll, C6 at the top down to C2 (docs/open-items.md). A note is an
 * ink bar of its length on the row of its pitch; the drag rules are the Guitar page's.
 */
export function Keys() {
  const { state, project } = useStudio();
  const tryEdit = useTryEdit();
  const [message, setMessage] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const id = 'keys';
  const instrument = project.instruments[id];
  const selected = instrument.selectedPattern;
  const pattern = instrument.patterns[selected];
  const bars = pattern?.bars ?? 1;
  const total = patternTicks(project.meter, bars);
  const value = state.noteValue;

  const playheadRef = usePlayhead(id, total, rulerRef);
  const notes = useMemo(() => (pattern?.notes ?? []).filter(isKeysNote), [pattern]);
  const marks = useMemo(() => beatMarks(project.meter, bars), [project.meter, bars]);
  const hidden = hiddenOutOfRange(notes);

  // The roll opens with the octave around middle C in view. Once, when the page is first drawn.
  useLayoutEffect(() => {
    const box = scrollRef.current;
    const first = box?.querySelector<HTMLElement>('.key-line');
    if (!box || !first) return;
    const ruler = box.querySelector<HTMLElement>('.ruler-row')?.offsetHeight ?? 0;
    box.scrollTop = startScrollTop(first.offsetHeight, box.clientHeight - ruler, KEY_ROWS.length);
  }, []);

  const { preview, begin } = useNoteDrag<KeysNote>({
    value,
    total,
    onClick: (note) => {
      setMessage('');
      setSelectedKey(noteKey(note));
    },
    onCommit: (note, next) => {
      const to: KeysNote = { ...note, start: next.start, length: next.length };
      const reason = tryEdit((p) => replaceNote(p, id, selected, note, to));
      setMessage(reason ?? '');
      if (!reason) setSelectedKey(noteKey(to));
    },
  });

  /** The width of a tick on screen, measured from the beat ruler, which is exactly `total` ticks wide. */
  const tickPx = () => (rulerRef.current && total > 0 ? rulerRef.current.getBoundingClientRect().width / total : 0);

  const place = (event: ReactMouseEvent<HTMLDivElement>, pitch: number) => {
    const px = tickPx();
    if (px <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const start = clickStart(event.clientX - rect.left, px, value, total);
    const note: KeysNote = { pitch, start, length: newNoteLength(start, value, total) };
    const reason = tryEdit((p) => addNote(p, id, selected, note));
    setMessage(reason ?? '');
    setSelectedKey(reason ? null : noteKey(note));
  };

  const gridStyle = { '--total': total, '--bar-ticks': ticksPerBar(project.meter) } as CSSProperties;
  const hiddenLine = hidden === 0 ? '' : `${hidden} ${hidden === 1 ? 'note is' : 'notes are'} outside C2 to C6: hidden, kept.`;

  return (
    <section className="ne keys" aria-labelledby="keys-title">
      <div className="ne-main">
        <div className="ne-head">
          <h1 id="keys-title">{INSTRUMENT_LABELS[id]}</h1>
          <p className="editor-note" role="status">
            {message || hiddenLine}
          </p>
        </div>

        <PatternBank id={id} />

        <div className="ne-tools">
          <LengthChoice id={id} onRefused={setMessage} />
          <NoteValueChoice id={id} />
        </div>

        <div className="ne-scroll" ref={scrollRef}>
          <div className={state.showWholePattern ? 'ne-grid whole' : 'ne-grid'} style={gridStyle}>
            <Ruler marks={marks} rulerRef={rulerRef} />

            {KEY_ROWS.map((pitch) => {
              const label = keyLabel(pitch);
              const classes = ['key-line'];
              if (isBlackKey(pitch)) classes.push('black');
              if (label) classes.push('c-row');
              return (
                <div key={pitch} className={classes.join(' ')}>
                  <div className="key-label figure">{label}</div>
                  <div className="ne-row" role="group" aria-label={pitchName(pitch)} onClick={(event) => place(event, pitch)}>
                    {keyNotesAt(notes, pitch, total).map((note) => {
                      const key = noteKey(note);
                      const live = preview && preview.key === key ? preview : note;
                      const noteClasses = ['note'];
                      if (key === selectedKey) noteClasses.push('selected');
                      if (preview && preview.key === key) noteClasses.push('dragging');
                      return (
                        <div
                          key={key}
                          className={noteClasses.join(' ')}
                          style={at(live.start, live.length)}
                          role="button"
                          tabIndex={0}
                          aria-pressed={key === selectedKey}
                          aria-label={`${pitchName(pitch)}, ${describeStart(live.start, project.meter)}`}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') setSelectedKey(key);
                          }}
                          onPointerDown={(event) => begin(event, note, key, 'move', tickPx())}
                        >
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
              );
            })}
            <div className="ne-playhead" ref={playheadRef} aria-hidden="true" />
          </div>
        </div>
      </div>

      <aside className="ne-side" aria-label="Instrument settings">
        <div className="side-group">
          <span className="tool-label">View</span>
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
