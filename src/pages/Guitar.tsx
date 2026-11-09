import { useMemo, useState } from 'react';
import { patternChord, songHarmony } from '../core/harmony/analyse';
import { FRET_COUNT_DEFAULT, INSTRUMENT_LABELS, type FretCount, type StringInstrumentId } from '../core/instruments';
import { setFretCount, type Note, type StringNote } from '../core/project';
import { useStudio } from '../state/Studio';
import { FretChoice, InstrumentBar } from './editor/InstrumentBar';
import { stringsLayout } from './editor/layout';
import { NoteEditor } from './editor/NoteEditor';
import { fretChangeLine, hiddenAboveFret, hiddenAcrossPatterns } from './editor/noteGeometry';

const isStringNote = (note: Note): note is StringNote => 'string' in note;

/**
 * Rhythm, Lead and Bass: one tab each (the user's sweeping changes, 2026-11-09), the same page. The
 * string layout: each string its open string and then its frets, lowest string at the top
 * (docs/instrument-layouts.md). The fret count sits in the settings bar.
 */
export function Guitar({ id }: { id: StringInstrumentId }) {
  const { project, dispatch } = useStudio();
  const [message, setMessage] = useState('');
  const instrument = project.instruments[id];
  const fretCount: FretCount = instrument.fretCount ?? FRET_COUNT_DEFAULT;
  const layout = useMemo(() => stringsLayout(id, fretCount), [id, fretCount]);
  const notes = (instrument.patterns[instrument.selectedPattern]?.notes ?? []).filter(isStringNote);
  const hidden = hiddenAboveFret(notes, fretCount);
  // The chord of every note in the pattern on screen, spelled as the song's key spells (docs/harmony.md).
  const chord = patternChord(project, id, instrument.selectedPattern, songHarmony(project).key);

  /** Sets the fret count. If notes in any pattern are now above it, the quiet line says so (Undo brings them back). */
  const changeFrets = (count: FretCount) => {
    dispatch({ type: 'edit', change: (p) => setFretCount(p, id, count) });
    setMessage(fretChangeLine(hiddenAcrossPatterns(instrument.patterns, count), count));
  };

  const hiddenLine = hidden === 0 ? '' : `${hidden} ${hidden === 1 ? 'note is' : 'notes are'} above fret ${fretCount}: hidden, kept.`;
  return (
    <section className="ipage" aria-label={INSTRUMENT_LABELS[id]}>
      <InstrumentBar id={id} message={message || hiddenLine} onMessage={setMessage}>
        <FretChoice fretCount={fretCount} onChange={changeFrets} />
        <p
          className="ibar-chord"
          title={chord ? `The chord of this pattern: ${chord.name}. ${chord.tones}` : 'The chord of this pattern: no notes yet'}
          aria-label={chord ? `Chord: ${chord.name}` : 'Chord: none, the pattern has no notes'}
        >
          {chord?.symbol ?? ''}
        </p>
      </InstrumentBar>
      <NoteEditor layout={layout} onMessage={setMessage} />
    </section>
  );
}
