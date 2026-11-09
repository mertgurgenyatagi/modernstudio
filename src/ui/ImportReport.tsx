import { useEffect, useMemo, useRef } from 'react';
import type { ImportReport as ImportReportData } from '../core/midi/build';
import { reportLines } from '../core/midi/reportLines';
import './import.css';

interface Props {
  report: ImportReportData;
  /** The name the new project has (the MIDI file's name). */
  name: string;
  onClose: () => void;
}

/**
 * The import report: a panel over the new project, shown once after an import and dismissed with Close or
 * Escape. Designed by the assistant (docs/page-designs.md): same frame as the mapping step; the header, the
 * notes and the footer keep their size and only the list of instruments scrolls, so Close stays in view at
 * 960 by 540. The words come from `reportLines` (pure, tested).
 */
export function ImportReport({ report, name, onClose }: Props) {
  const view = useMemo(() => reportLines(report), [report]);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => closeRef.current?.focus(), []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab') {
        // The only control is Close: keep the focus on it.
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="import-scrim">
      <div className="import-panel" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <header className="import-head">
          <h2 id="report-title">Import report</h2>
          <p className="import-file" title={name}>
            {name}
          </p>
        </header>
        <p className="report-headline">{view.headline}</p>
        {view.notes.length > 0 && (
          <ul className="report-notes" aria-label="Notes">
            {view.notes.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
        <ul className="report-rows" aria-label="Instruments">
          {view.rows.map((row) => (
            <li key={row.id} className={`report-row${row.mapped ? '' : ' none'}`}>
              <div className="report-who">
                <span className="report-label">{row.label}</span>
                {row.source !== '' && (
                  <span className="report-source" title={row.source}>
                    {row.source}
                  </span>
                )}
              </div>
              <div className="report-what">
                <p className="report-facts">{row.facts.join(' · ')}</p>
                {row.warnings.map((line, i) => (
                  <p key={i} className="report-warning">
                    {line}
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <footer className="import-foot">
          <button type="button" className="import-button primary" ref={closeRef} onClick={onClose}>
            Close
          </button>
          <span className="import-hint">The report shows once. The project is new and not saved yet.</span>
        </footer>
      </div>
    </div>
  );
}
