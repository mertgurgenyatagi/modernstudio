import { useEffect, useMemo, useRef, useState } from 'react';
import { INSTRUMENT_IDS, INSTRUMENT_LABELS, type InstrumentId } from '../core/instruments';
import type { Assignment, TrackGuess } from '../core/midi/guess';
import type { MidiFile } from '../core/midi/read';
import {
  ASSIGNMENTS,
  assignmentLabel,
  canConvert,
  changesText,
  patternsText,
  previewMapping,
  type ImportStage,
  type LoadedMidi,
  type Preview,
  type PreviewCache,
} from '../state/importFlow';
import './import.css';

/** The short words on the six-way choice; the full instrument name is the button's accessible name. */
const SHORT: Record<Assignment, string> = { drums: 'Drums', bass: 'Bass', rhythm: 'Rhythm', lead: 'Lead', keys: 'Keys', skip: 'Skip' };

interface Props {
  stage: ImportStage;
  onAssign: (index: number, assignment: Assignment) => void;
  onConvert: () => void;
  onCancel: () => void;
}

/**
 * The mapping step of a MIDI import: a panel over the Mixer (not a window of its own) that lists the
 * file's tracks with the guessed instrument for each, changeable, and what each choice would come to.
 * Designed by the assistant (docs/page-designs.md): the panel is at most the window's height less a
 * margin, and only the track list scrolls inside it, so Import and Cancel are always in view at 960 by 540.
 */
export function ImportMapping({ stage, onAssign, onConvert, onCancel }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const converting = stage.stage === 'converting';
  const shown = stage.stage === 'reading' || stage.stage === 'mapping' || converting;

  // Escape cancels (not while converting); Tab stays inside the panel.
  useEffect(() => {
    if (!shown) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !converting) {
        event.preventDefault();
        onCancel();
      }
      if (event.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !panelRef.current.contains(active))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shown, converting, onCancel]);

  if (!shown) return null;
  const loaded = stage.stage === 'mapping' || stage.stage === 'converting' ? stage.loaded : null;
  const { name } = stage;

  return (
    <div className="import-scrim">
      <div className="import-panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="import-title">
        <header className="import-head">
          <h2 id="import-title">Import MIDI</h2>
          <p className="import-file" title={name}>
            {name}
          </p>
        </header>
        {loaded === null ? (
          <p className="import-wait" role="status">
            Reading…
          </p>
        ) : (
          <MappingBody loaded={loaded} busy={converting} onAssign={onAssign} onConvert={onConvert} onCancel={onCancel} />
        )}
      </div>
    </div>
  );
}

function MappingBody({
  loaded,
  busy,
  onAssign,
  onConvert,
  onCancel,
}: {
  loaded: LoadedMidi;
  busy: boolean;
  onAssign: Props['onAssign'];
  onConvert: Props['onConvert'];
  onCancel: Props['onCancel'];
}) {
  const { file, timing, rows } = loaded;
  // What each choice comes to is worked out once per combination of tracks, and kept while the user changes
  // the mapping. The file never changes while this panel is up (a new import starts from idle), so the cache lives as long as the panel.
  const [cache] = useState<PreviewCache>(() => new Map());
  const preview = useMemo(() => previewMapping(file, timing, rows, cache), [file, timing, rows, cache]);
  const importRef = useRef<HTMLButtonElement>(null);
  useEffect(() => importRef.current?.focus(), []);

  return (
    <>
      <p className="import-time">
        {timing.bpm} BPM, {timing.meter.numerator}/4. Send each track to an instrument, or skip it.
      </p>
      <dl className="import-summary" aria-label="What each instrument would get">
        {INSTRUMENT_IDS.map((id) => (
          <SummaryCell key={id} id={id} preview={preview.instruments[id]} />
        ))}
      </dl>
      <ul className="import-tracks" aria-label="Tracks">
        {rows.map((row) => (
          <TrackRow key={row.index} row={row} file={file} preview={preview.rows.get(row.index) ?? null} disabled={busy} onAssign={onAssign} />
        ))}
      </ul>
      <footer className="import-foot">
        <button type="button" className="import-button primary" ref={importRef} disabled={busy || !canConvert(rows)} aria-busy={busy} onClick={onConvert}>
          {busy ? 'Converting…' : 'Import'}
        </button>
        <button type="button" className="import-button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        {!canConvert(rows) && <span className="import-hint">Send at least one track to an instrument.</span>}
      </footer>
    </>
  );
}

function SummaryCell({ id, preview }: { id: InstrumentId; preview: Preview | null }) {
  const warn = preview !== null && !preview.fits;
  return (
    <div className={`import-cell${preview === null ? ' none' : ''}${warn ? ' warn' : ''}`}>
      <dt>{INSTRUMENT_LABELS[id]}</dt>
      <dd>
        {preview === null ? 'no track' : patternsText(preview)}
        {preview?.fretCount != null && <span className="import-frets">{preview.fretCount} frets</span>}
      </dd>
    </div>
  );
}

/** "ch 10 · program 34": where the track plays and what it asks for; empty parts are left out. */
function trackFacts(row: TrackGuess, file: MidiFile): string {
  const channel = file.tracks[row.index]?.notes[0]?.channel;
  const parts = [channel === undefined ? null : `ch ${channel + 1}`, row.program === null ? null : `program ${row.program + 1}`, `${row.notes} notes`];
  return parts.filter((p) => p !== null).join(' · ');
}

function TrackRow({
  row,
  file,
  preview,
  disabled,
  onAssign,
}: {
  row: TrackGuess;
  file: MidiFile;
  preview: Preview | null;
  disabled: boolean;
  onAssign: Props['onAssign'];
}) {
  const label = row.name.trim() === '' ? `Track ${row.index + 1}` : row.name;
  const id = row.assignment === 'skip' ? null : row.assignment;
  return (
    <li className={`import-row${row.assignment === 'skip' ? ' skipped' : ''}`}>
      <div className="import-track">
        <span className="import-name" title={label}>
          {label}
        </span>
        <span className="import-facts">
          {trackFacts(row, file)}
          {preview !== null && id !== null && (
            <span className={preview.fits ? undefined : 'warn'}>
              {' → '}
              {patternsText(preview)}, {changesText(id, preview)}
            </span>
          )}
        </span>
      </div>
      <div className="import-choice" role="radiogroup" aria-label={`Instrument for ${label}`}>
        {ASSIGNMENTS.map((assignment) => (
          <button
            key={assignment}
            type="button"
            role="radio"
            aria-checked={row.assignment === assignment}
            aria-label={assignmentLabel(assignment)}
            disabled={disabled}
            onClick={() => onAssign(row.index, assignment)}
          >
            {SHORT[assignment]}
          </button>
        ))}
      </div>
    </li>
  );
}
