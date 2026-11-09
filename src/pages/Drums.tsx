import { useMemo, useState } from 'react';
import { InstrumentBar } from './editor/InstrumentBar';
import { drumsLayout } from './editor/layout';
import { NoteEditor } from './editor/NoteEditor';

/**
 * The Drums: five rows of pads, crash at the top and kick at the bottom, one pad per step of the
 * chosen note value. A click on a pad places a hit and a click on a hit takes it away; hits can be
 * selected, moved, copied and pasted like the notes of the other pages.
 */
export function Drums() {
  const [message, setMessage] = useState('');
  const layout = useMemo(() => drumsLayout(), []);
  return (
    <section className="ipage" aria-label="Drums">
      <InstrumentBar id="drums" message={message} onMessage={setMessage} />
      <NoteEditor layout={layout} onMessage={setMessage} />
    </section>
  );
}
