import type { InstrumentId } from '../../core/instruments';
import { canOpenMorePatterns, isActive, openMorePatterns, selectPattern } from '../../core/project';
import { useStudio } from '../../state/Studio';
import './editor.css';

/**
 * The instrument's patterns as numbered squares. A pattern with notes has an ink outline, an empty one
 * a grey outline (it can still be selected: a pattern becomes active when its first note is placed),
 * and the selected one is filled. Choosing a pattern is not an Undo step. Once every shown pattern has
 * notes, a "+20" square opens 20 more (up to 120); that is not an Undo step either.
 */
export function PatternBank({ id }: { id: InstrumentId }) {
  const { project, dispatch } = useStudio();
  const instrument = project.instruments[id];
  const shown = instrument.patterns.slice(0, instrument.shownPatterns);
  return (
    <div className="bank" role="group" aria-label="Pattern">
      <span className="bank-word" aria-hidden="true">
        Pattern
      </span>
      <div className="bank-numbers">
        {shown.map((pattern, index) => {
          const selected = index === instrument.selectedPattern;
          const classes = ['bank-number'];
          if (selected) classes.push('selected');
          else if (isActive(pattern)) classes.push('active');
          return (
            <button
              key={index}
              type="button"
              className={classes.join(' ')}
              aria-pressed={selected}
              aria-label={`Pattern ${index + 1}${isActive(pattern) ? '' : ', empty'}`}
              onClick={() => dispatch({ type: 'select', change: (p) => selectPattern(p, id, index) })}
            >
              {index + 1}
            </button>
          );
        })}
        {canOpenMorePatterns(project, id) && (
          <button
            type="button"
            className="bank-number more"
            aria-label="Open 20 more patterns"
            onClick={() =>
              dispatch({
                type: 'select',
                change: (p) => {
                  const outcome = openMorePatterns(p, id);
                  return outcome.ok ? outcome.project : p;
                },
              })
            }
          >
            +20
          </button>
        )}
      </div>
    </div>
  );
}
