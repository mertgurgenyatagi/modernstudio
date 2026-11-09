import { useEffect, useRef } from 'react';
import type { AudioEngine, MeterId } from '../audio/engine';
import { INSTRUMENT_IDS, INSTRUMENT_LABELS, type InstrumentId } from '../core/instruments';
import { setBpm, setMasterVolume, setMeter, setMuted, setVolume } from '../core/project';
import { BPM_MAX, BPM_MIN, METERS } from '../core/time';
import { useStudio } from '../state/Studio';
import { useMidiExport } from '../state/useMidiExport';
import { useWavExport } from '../state/useWavExport';
import { LevelSlider } from '../ui/LevelSlider';
import { NumberField } from '../ui/NumberField';
import './mixer.css';

/** What a channel is doing: Playing, Muted, or Silent while another is isolated. */
function channelStatus(muted: boolean, isolated: InstrumentId | null, id: InstrumentId): 'Playing' | 'Muted' | 'Silent' {
  if (muted) return 'Muted';
  if (isolated !== null && isolated !== id) return 'Silent';
  return 'Playing';
}

/**
 * Moves the level meters from the engine's readings, once per animation frame, straight on the
 * elements, so that the page is not drawn again sixty times a second.
 */
function useMeters(engine: AudioEngine) {
  const elements = useRef(new Map<MeterId, HTMLElement>());
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const levels = engine.readLevels();
      for (const [id, element] of elements.current) element.style.transform = `scaleX(${levels[id]})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [engine]);
  return (id: MeterId) => (element: HTMLElement | null) => {
    if (element) elements.current.set(id, element);
    else elements.current.delete(id);
  };
}

export function Mixer() {
  const { state, project, dispatch, engine } = useStudio();
  const meterRef = useMeters(engine);
  const wav = useWavExport(project, state.filePath, dispatch);
  const exportMidi = useMidiExport(project, state.filePath, dispatch);
  const endDrag = () => dispatch({ type: 'endDrag' });
  const editBpm = (value: number) => dispatch({ type: 'edit', change: (p) => setBpm(p, value), key: 'bpm' });

  return (
    <section className="mixer" aria-labelledby="mixer-title">
      <div className="mixer-head">
        <h1 id="mixer-title">Mixer</h1>
        <div className="mixer-song">
          <div className="field">
            <span>BPM</span>
            <NumberField label="BPM" className="bpm-number" value={project.bpm} min={BPM_MIN} max={BPM_MAX} onCommit={editBpm} />
            <div className="bpm-slider">
              <LevelSlider label="BPM slider" value={project.bpm} min={BPM_MIN} max={BPM_MAX} onChange={editBpm} onGrabChange={endDrag} />
            </div>
          </div>
          <div className="field">
            <span id="meter-label">Meter</span>
            <div className="choice" role="radiogroup" aria-labelledby="meter-label">
              {METERS.map((meter) => (
                <button
                  key={meter}
                  type="button"
                  role="radio"
                  aria-checked={project.meter === meter}
                  onClick={() => dispatch({ type: 'edit', change: (p) => setMeter(p, meter) })}
                >
                  {meter}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <table className="ledger">
        <thead>
          <tr>
            <th scope="col">Instrument</th>
            <th scope="col">Volume</th>
            <th scope="col">Level</th>
            <th scope="col">Mute</th>
            <th scope="col">Isolate</th>
          </tr>
        </thead>
        <tbody>
          {INSTRUMENT_IDS.map((id) => {
            const instrument = project.instruments[id];
            const status = channelStatus(instrument.muted, state.isolated, id);
            return (
              <tr key={id} className={status === 'Playing' ? undefined : 'dim'}>
                <th scope="row" className="name">
                  <span className="name-text">{INSTRUMENT_LABELS[id]}</span>
                  <span className="status">{status}</span>
                </th>
                <td className="volume">
                  <LevelSlider
                    label={`${INSTRUMENT_LABELS[id]} volume`}
                    value={instrument.volume}
                    onChange={(value) => dispatch({ type: 'edit', change: (p) => setVolume(p, id, value), key: `volume:${id}` })}
                    onGrabChange={endDrag}
                  />
                  <output className="figure">{instrument.volume}</output>
                </td>
                <td className="level">
                  <div className="meter" aria-hidden="true">
                    <div className="meter-fill" ref={meterRef(id)} />
                  </div>
                </td>
                <td className="tick">
                  <button
                    type="button"
                    className="toggle"
                    aria-pressed={instrument.muted}
                    aria-label={`Mute ${INSTRUMENT_LABELS[id]}`}
                    onClick={() => dispatch({ type: 'edit', change: (p) => setMuted(p, id, !instrument.muted) })}
                  >
                    <span className="box" aria-hidden="true" />
                    <span className="toggle-word">Mute</span>
                  </button>
                </td>
                <td className="tick">
                  <button
                    type="button"
                    className="toggle"
                    aria-pressed={state.isolated === id}
                    aria-label={`Isolate ${INSTRUMENT_LABELS[id]}`}
                    onClick={() => dispatch({ type: 'toggleIsolate', id })}
                  >
                    <span className="box" aria-hidden="true" />
                    <span className="toggle-word">Isolate</span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="name">
              <span className="name-text">Master</span>
            </th>
            <td className="volume">
              <LevelSlider
                label="Master volume"
                value={project.masterVolume}
                onChange={(value) => dispatch({ type: 'edit', change: (p) => setMasterVolume(p, value), key: 'master' })}
                onGrabChange={endDrag}
              />
              <output className="figure">{project.masterVolume}</output>
            </td>
            <td className="level">
              <div className="meter" aria-hidden="true">
                <div className="meter-fill" ref={meterRef('master')} />
              </div>
            </td>
            <td className="export" colSpan={2}>
              <button type="button" className="action" disabled={wav.rendering} aria-busy={wav.rendering} onClick={() => void wav.exportWav()}>
                {wav.rendering ? 'Rendering…' : 'Export WAV'}
              </button>
              <button type="button" className="action" onClick={() => void exportMidi()}>
                Export MIDI
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
