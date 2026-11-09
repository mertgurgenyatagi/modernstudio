import { useEffect, useRef, useState } from 'react';
import type { InstrumentId } from '../../core/instruments';
import { copyNotes } from '../../core/patterns';
import { isActive } from '../../core/project';
import { useStudio } from '../../state/Studio';
import { copyResult, copyTargets, type CopyMode } from './copy';
import { useTryEdit } from './useTryEdit';
import './editor.css';

/**
 * "Copy notes to…": copies the notes of the selected pattern into another pattern of the instrument,
 * as one Undo step. A panel under the button lists the shown patterns and asks whether the target's
 * notes are replaced (the default) or kept with the new ones added. The result, or the reason for a
 * refusal, goes to the page's quiet line through `onResult`.
 */
export function CopyNotes({ id, onResult }: { id: InstrumentId; onResult: (text: string) => void }) {
  const { project } = useStudio();
  const tryEdit = useTryEdit();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CopyMode>('replace');
  const boxRef = useRef<HTMLDivElement>(null);

  const instrument = project.instruments[id];
  const source = instrument.selectedPattern;
  const sourceHasNotes = isActive(instrument.patterns[source] ?? { bars: 1, notes: [] });

  // Escape or a press outside closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const copyTo = (to: number) => {
    const reason = tryEdit((p) => copyNotes(p, id, source, to, mode));
    onResult(reason ?? copyResult(to, mode, sourceHasNotes));
    setOpen(false);
  };

  return (
    <div className="copy" ref={boxRef}>
      <button type="button" className="tool-whole" aria-expanded={open} onClick={() => setOpen(!open)}>
        Copy notes to…
      </button>
      {open && (
        <div className="copy-panel" role="group" aria-label={`Copy the notes of pattern ${source + 1} to`}>
          <div className="tool-buttons copy-mode" role="radiogroup" aria-label="What happens to the notes already there">
            <button type="button" role="radio" aria-checked={mode === 'replace'} onClick={() => setMode('replace')}>
              Replace
            </button>
            <button type="button" role="radio" aria-checked={mode === 'add'} onClick={() => setMode('add')}>
              Add
            </button>
          </div>
          <div className="bank-numbers">
            {copyTargets(instrument).map((target) => (
              <button
                key={target.index}
                type="button"
                className={target.active ? 'bank-number active' : 'bank-number'}
                disabled={target.source}
                aria-label={`Pattern ${target.index + 1}${target.source ? ', copied from' : target.active ? '' : ', empty'}`}
                onClick={() => copyTo(target.index)}
              >
                {target.index + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
