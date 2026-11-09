import { useRef, useState, type ReactNode } from 'react';
import { FRET_COUNTS, type FretCount, type InstrumentId } from '../../core/instruments';
import { setPatternBars } from '../../core/patterns';
import { canOpenMorePatterns, isActive, openMorePatterns, selectPattern, setEnvelope, setVolume, VOLUME_DEFAULT, ENVELOPE_DEFAULT, type Project } from '../../core/project';
import { NOTE_VALUES, PATTERN_BARS, type NoteValue } from '../../core/time';
import { useStudio } from '../../state/Studio';
import { BUTTON_ZOOM, isFitting, toggleFit, zoomView } from '../../state/view';
import { Knob } from '../../ui/Knob';
import { useDismiss } from '../../ui/useDismiss';
import { useTryEdit } from './useTryEdit';
import '../../ui/controls.css';
import './editor.css';

/** The note values as the buttons show them (a third is an eighth-note triplet), and in full for the tooltip. */
export const NOTE_VALUE_SHORT: Record<NoteValue, string> = {
  whole: '1/1',
  half: '1/2',
  quarter: '1/4',
  sixteenth: '1/16',
  third: '1/8T',
  halfThird: '1/16T',
};

export const NOTE_VALUE_NAMES: Record<NoteValue, string> = {
  whole: 'Whole',
  half: 'Half',
  quarter: 'Quarter',
  sixteenth: '16th',
  third: 'Third (a third of a beat)',
  halfThird: 'Half of a third',
};

/**
 * The one bar of settings above every instrument editor (the user's sweeping changes, 2026-11-09:
 * small buttons that know their place, so the instrument takes the page). Left to right: the
 * pattern, its length, the note value, anything the page adds (the frets), the zoom, the quiet line,
 * and the envelope as four knobs.
 */
export function InstrumentBar({
  id,
  message,
  onMessage,
  children,
}: {
  id: InstrumentId;
  message: string;
  onMessage: (text: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="ibar" role="toolbar" aria-label="Pattern and instrument settings">
      <PatternPicker id={id} />
      <LengthChoice id={id} onMessage={onMessage} />
      <ValueChoice />
      {children}
      <ZoomButtons id={id} />
      <p className="ibar-note" role="status" title={message}>
        {message}
      </p>
      <EnvelopeKnobs id={id} />
    </div>
  );
}

/**
 * The pattern: the number of the selected one between a previous and a next arrow. The number opens
 * all the shown patterns as a grid, a pattern with notes outlined in ink; "+20" opens more once every
 * shown pattern has notes. Choosing a pattern is not an Undo step.
 */
function PatternPicker({ id }: { id: InstrumentId }) {
  const { project, dispatch } = useStudio();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useDismiss(open, boxRef, () => setOpen(false));
  const instrument = project.instruments[id];
  const selected = instrument.selectedPattern;
  const shown = instrument.patterns.slice(0, instrument.shownPatterns);
  const choose = (index: number) => dispatch({ type: 'select', change: (p) => selectPattern(p, id, index) });
  const more = () =>
    dispatch({
      type: 'select',
      change: (p) => {
        const outcome = openMorePatterns(p, id);
        return outcome.ok ? outcome.project : p;
      },
    });

  return (
    <div className="pick" ref={boxRef}>
      <button type="button" className="ibtn pick-step" aria-label="Previous pattern" title="Previous pattern" disabled={selected === 0} onClick={() => choose(selected - 1)}>
        ‹
      </button>
      <button
        type="button"
        className="ibtn pick-number"
        aria-expanded={open}
        aria-label={`Pattern ${selected + 1}. Choose a pattern`}
        title={`Pattern ${selected + 1}`}
        onClick={() => setOpen(!open)}
      >
        {selected + 1}
      </button>
      <button
        type="button"
        className="ibtn pick-step"
        aria-label="Next pattern"
        title="Next pattern"
        disabled={selected >= instrument.shownPatterns - 1}
        onClick={() => choose(selected + 1)}
      >
        ›
      </button>
      {open && (
        <div className="pick-panel" role="group" aria-label="Patterns">
          {shown.map((pattern, index) => {
            const classes = ['pick-cell'];
            if (index === selected) classes.push('selected');
            else if (isActive(pattern)) classes.push('active');
            return (
              <button
                key={index}
                type="button"
                className={classes.join(' ')}
                aria-pressed={index === selected}
                aria-label={`Pattern ${index + 1}${isActive(pattern) ? '' : ', empty'}`}
                onClick={() => {
                  choose(index);
                  setOpen(false);
                }}
              >
                {index + 1}
              </button>
            );
          })}
          {canOpenMorePatterns(project, id) && (
            <button type="button" className="pick-cell more" aria-label="Open 20 more patterns" title="Open 20 more patterns" onClick={more}>
              +20
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The pattern's length: 1, 2, 4 or 8 bars. A refusal (a Song block would overlap) shows on the quiet line. */
function LengthChoice({ id, onMessage }: { id: InstrumentId; onMessage: (text: string) => void }) {
  const { project } = useStudio();
  const tryEdit = useTryEdit();
  const instrument = project.instruments[id];
  const bars = instrument.patterns[instrument.selectedPattern]?.bars ?? 1;
  return (
    <div className="seg" role="radiogroup" aria-label="Pattern length">
      {PATTERN_BARS.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={bars === n}
          title={`${n} ${n === 1 ? 'bar' : 'bars'} long`}
          onClick={() => {
            const reason = tryEdit((p) => setPatternBars(p, id, instrument.selectedPattern, n));
            onMessage(reason ?? '');
          }}
        >
          {n}×
        </button>
      ))}
    </div>
  );
}

/** The note value the next note gets, and the grid the lines show and notes snap to. Shared by the instrument pages. */
function ValueChoice() {
  const { state, dispatch } = useStudio();
  return (
    <div className="seg" role="radiogroup" aria-label="Note value">
      {NOTE_VALUES.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={state.noteValue === value}
          aria-label={NOTE_VALUE_NAMES[value]}
          title={NOTE_VALUE_NAMES[value]}
          onClick={() => dispatch({ type: 'setNoteValue', value })}
        >
          {NOTE_VALUE_SHORT[value]}
        </button>
      ))}
    </div>
  );
}

/** The fret count of a string instrument: 5, 7 or 12. */
export function FretChoice({ fretCount, onChange }: { fretCount: FretCount; onChange: (count: FretCount) => void }) {
  return (
    <div className="seg seg-labelled" role="radiogroup" aria-label="Frets">
      <span className="seg-word" aria-hidden="true">
        Frets
      </span>
      {FRET_COUNTS.map((count) => (
        <button key={count} type="button" role="radio" aria-checked={fretCount === count} title={`${count} frets`} onClick={() => onChange(count)}>
          {count}
        </button>
      ))}
    </div>
  );
}

/** Zoom out, zoom in, and Fit (the whole pattern across the width, the old "Show whole pattern"). Ctrl with the wheel zooms too. */
function ZoomButtons({ id }: { id: InstrumentId }) {
  const { state, project, dispatch } = useStudio();
  const instrument = project.instruments[id];
  const bars = instrument.patterns[instrument.selectedPattern]?.bars ?? 1;
  const view = state.editorView;
  return (
    <div className="seg" role="group" aria-label="Zoom">
      <button type="button" aria-label="Zoom out" title="Zoom out (Ctrl and the wheel)" onClick={() => dispatch({ type: 'setEditorView', view: zoomView(view, bars, BUTTON_ZOOM) })}>
        −
      </button>
      <button type="button" aria-label="Zoom in" title="Zoom in (Ctrl and the wheel)" onClick={() => dispatch({ type: 'setEditorView', view: zoomView(view, bars, 1 / BUTTON_ZOOM) })}>
        +
      </button>
      <button
        type="button"
        aria-pressed={isFitting(view, bars)}
        title="Show the whole pattern"
        onClick={() => dispatch({ type: 'setEditorView', view: toggleFit(view) })}
      >
        Fit
      </button>
    </div>
  );
}

/** Volume, attack, decay and release of the instrument, 0 to 100 each. Volume is the Mixer's volume (the same Undo key). */
function EnvelopeKnobs({ id }: { id: InstrumentId }) {
  const { project, dispatch } = useStudio();
  const instrument = project.instruments[id];
  const endDrag = () => dispatch({ type: 'endDrag' });
  const knobs: { key: string; label: string; name: string; value: number; fallback: number; set: (v: number) => (p: Project) => Project }[] = [
    { key: 'volume', label: 'Vol', name: 'Volume', value: instrument.volume, fallback: VOLUME_DEFAULT, set: (v) => (p) => setVolume(p, id, v) },
    { key: 'attack', label: 'Att', name: 'Attack', value: instrument.attack, fallback: ENVELOPE_DEFAULT, set: (v) => (p) => setEnvelope(p, id, { attack: v }) },
    { key: 'decay', label: 'Dec', name: 'Decay', value: instrument.decay, fallback: ENVELOPE_DEFAULT, set: (v) => (p) => setEnvelope(p, id, { decay: v }) },
    { key: 'release', label: 'Rel', name: 'Release', value: instrument.release, fallback: ENVELOPE_DEFAULT, set: (v) => (p) => setEnvelope(p, id, { release: v }) },
  ];
  return (
    <div className="ibar-knobs" role="group" aria-label="Envelope">
      {knobs.map((k) => (
        <Knob
          key={k.key}
          label={k.label}
          name={k.name}
          value={k.value}
          defaultValue={k.fallback}
          onChange={(v) => dispatch({ type: 'edit', change: k.set(v), key: `${k.key}:${id}` })}
          onGrab={endDrag}
        />
      ))}
    </div>
  );
}
