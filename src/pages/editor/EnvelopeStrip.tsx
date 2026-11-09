import type { InstrumentId } from '../../core/instruments';
import { setEnvelope, setVolume } from '../../core/project';
import { useStudio } from '../../state/Studio';
import { LevelSlider } from '../../ui/LevelSlider';
import './editor.css';

/**
 * Volume, Attack, Decay and Release of one instrument: a name, a number and a slider each, on the
 * 0 to 100 scale with no unit. One setting each, never per pattern or per note. Volume is the same
 * setting as on the Mixer, so it uses the same Undo key. A slider drag is one Undo step.
 */
export function EnvelopeStrip({ id }: { id: InstrumentId }) {
  const { project, dispatch } = useStudio();
  const instrument = project.instruments[id];
  const endDrag = () => dispatch({ type: 'endDrag' });
  const cells = [
    { key: 'volume', label: 'Volume', value: instrument.volume, set: (v: number) => (p: typeof project) => setVolume(p, id, v) },
    { key: 'attack', label: 'Attack', value: instrument.attack, set: (v: number) => (p: typeof project) => setEnvelope(p, id, { attack: v }) },
    { key: 'decay', label: 'Decay', value: instrument.decay, set: (v: number) => (p: typeof project) => setEnvelope(p, id, { decay: v }) },
    { key: 'release', label: 'Release', value: instrument.release, set: (v: number) => (p: typeof project) => setEnvelope(p, id, { release: v }) },
  ];
  return (
    <div className="envelope">
      {cells.map((cell) => (
        <div key={cell.key} className="envelope-cell">
          <div className="envelope-head">
            <span>{cell.label}</span>
            <output className="figure">{cell.value}</output>
          </div>
          <LevelSlider
            label={`${cell.label}`}
            value={cell.value}
            onChange={(v) => dispatch({ type: 'edit', change: cell.set(v), key: `${cell.key}:${id}` })}
            onGrabChange={endDrag}
          />
        </div>
      ))}
    </div>
  );
}
