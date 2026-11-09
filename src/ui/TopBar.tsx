import { PAGES, PAGE_LABELS } from '../state/appState';
import { useStudio } from '../state/Studio';
import './topbar.css';

/** The one bar at the top of every page: the page switch at the left, the transport at the right. */
export function TopBar() {
  const { state, dispatch, canUndo, play, stop } = useStudio();
  return (
    <header className="topbar">
      <nav className="tabs" aria-label="Pages">
        {PAGES.map((page) => (
          <button
            key={page}
            type="button"
            className="tab"
            aria-current={state.page === page ? 'page' : undefined}
            onClick={() => dispatch({ type: 'setPage', page })}
          >
            {PAGE_LABELS[page]}
          </button>
        ))}
      </nav>
      <div className="transport" role="toolbar" aria-label="Transport">
        <button type="button" className="tbtn tbtn-primary" aria-pressed={state.playing} onClick={play}>
          Play
        </button>
        <button type="button" className="tbtn" onClick={stop}>
          Stop
        </button>
        <button
          type="button"
          className="tbtn"
          aria-pressed={state.metronome}
          onClick={() => dispatch({ type: 'setMetronome', on: !state.metronome })}
        >
          Metronome
        </button>
        <button type="button" className="tbtn" disabled={!canUndo} onClick={() => dispatch({ type: 'undo' })}>
          Undo
        </button>
      </div>
    </header>
  );
}
