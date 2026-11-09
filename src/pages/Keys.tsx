import { useMemo, useState } from 'react';
import { INSTRUMENT_LABELS } from '../core/instruments';
import type { KeysNote, Note } from '../core/project';
import { useStudio } from '../state/Studio';
import { InstrumentBar } from './editor/InstrumentBar';
import { MIDDLE_C, hiddenOutOfRange, keyRowIndex } from './editor/keyRoll';
import { keysLayout } from './editor/layout';
import { NoteEditor } from './editor/NoteEditor';

const isKeysNote = (note: Note): note is KeysNote => 'pitch' in note;

/** Keys, for vocals: a regular piano roll from C6 at the top to C2, opening on middle C. */
export function Keys() {
  const { project } = useStudio();
  const [message, setMessage] = useState('');
  const layout = useMemo(() => keysLayout(), []);
  const instrument = project.instruments.keys;
  const hidden = hiddenOutOfRange((instrument.patterns[instrument.selectedPattern]?.notes ?? []).filter(isKeysNote));
  const hiddenLine = hidden === 0 ? '' : `${hidden} ${hidden === 1 ? 'note is' : 'notes are'} outside C2 to C6: hidden, kept.`;
  return (
    <section className="ipage" aria-label={INSTRUMENT_LABELS.keys}>
      <InstrumentBar id="keys" message={message || hiddenLine} onMessage={setMessage} />
      <NoteEditor layout={layout} onMessage={setMessage} startRow={keyRowIndex(MIDDLE_C) ?? 0} />
    </section>
  );
}
