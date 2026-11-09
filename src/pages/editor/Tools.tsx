import type { InstrumentId } from '../../core/instruments';
import { setPatternBars } from '../../core/patterns';
import { NOTE_VALUES, PATTERN_BARS, type NoteValue } from '../../core/time';
import { useStudio } from '../../state/Studio';
import { useTryEdit } from './useTryEdit';
import './editor.css';

export const NOTE_VALUE_LABELS: Record<NoteValue, string> = {
  whole: 'Whole',
  half: 'Half',
  quarter: 'Quarter',
  sixteenth: '16th',
  third: 'Third',
  halfThird: 'Half of a third',
};

/** Length of the selected pattern: 1x, 2x, 4x or 8x. A refusal (a Song block would overlap) is passed on to `onRefused`. */
export function LengthChoice({ id, onRefused }: { id: InstrumentId; onRefused: (reason: string) => void }) {
  const { project } = useStudio();
  const tryEdit = useTryEdit();
  const instrument = project.instruments[id];
  const bars = instrument.patterns[instrument.selectedPattern]?.bars ?? 1;
  return (
    <div className="tool-group">
      <span className="tool-label" id={`length-${id}`}>
        Length
      </span>
      <div className="tool-buttons tool-length" role="radiogroup" aria-labelledby={`length-${id}`}>
        {PATTERN_BARS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={bars === n}
            onClick={() => {
              const reason = tryEdit((p) => setPatternBars(p, id, instrument.selectedPattern, n));
              if (reason) onRefused(reason);
            }}
          >
            {n}x
          </button>
        ))}
      </div>
    </div>
  );
}

/** The note value that the next placed note has. Screen state, shared by the instrument pages. */
export function NoteValueChoice({ id }: { id: InstrumentId }) {
  const { state, dispatch } = useStudio();
  return (
    <div className="tool-group">
      <span className="tool-label" id={`value-${id}`}>
        Note value
      </span>
      <div className="tool-buttons tool-values" role="radiogroup" aria-labelledby={`value-${id}`}>
        {NOTE_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={state.noteValue === value}
            onClick={() => dispatch({ type: 'setNoteValue', value })}
          >
            {NOTE_VALUE_LABELS[value]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A button that stays pressed while on: the whole pattern is fitted in the view. */
export function ShowWholeButton() {
  const { state, dispatch } = useStudio();
  return (
    <button
      type="button"
      className="tool-whole"
      aria-pressed={state.showWholePattern}
      onClick={() => dispatch({ type: 'setShowWholePattern', on: !state.showWholePattern })}
    >
      Show whole pattern
    </button>
  );
}
