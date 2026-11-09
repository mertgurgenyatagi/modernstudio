/**
 * The WAV export: renders the whole Song offline, faster than real time, and returns the WAV file.
 *
 * It builds its notes exactly as the live engine does (the same plan from src/core/playback.ts, the
 * same startNote), into the same chain: voice -> instrument gain -> master gain -> output. What differs
 * is what the export is defined to leave out (docs/editing-and-project.md): mute and isolate are
 * ignored, so every instrument plays at its volume, and the metronome is not rendered. The master
 * volume applies, there is no normalising, and a tail after the last bar lets releases ring out.
 *
 * Runs in Chromium only (OfflineAudioContext), so no unit test reaches it; the pure parts it relies
 * on (the plan, the length, the WAV writer) are tested.
 */
import { INSTRUMENT_IDS, type InstrumentId } from '../core/instruments';
import { levelToGain } from '../core/levels';
import { songPlan } from '../core/playback';
import type { Project } from '../core/project';
import { TICKS_PER_QUARTER } from '../core/time';
import { WAV_CHANNELS, WAV_SAMPLE_RATE, encodeWav, renderFrames } from '../core/wav';
import { startNote } from './notes';
import { loadBuffers, manifest } from './soundFiles';

/** Thrown when the Song has no blocks: there is nothing to render. */
export class EmptySongError extends Error {
  constructor() {
    super('The Song has no blocks');
  }
}

/** Renders the Song of `project` to the bytes of a WAV file (16-bit, stereo, 44.1 kHz). */
export async function renderSongToWav(project: Project): Promise<Uint8Array> {
  const frames = renderFrames(project, WAV_SAMPLE_RATE);
  if (frames <= 0) throw new EmptySongError();

  const context = new OfflineAudioContext(WAV_CHANNELS, frames, WAV_SAMPLE_RATE);
  const buffers = await loadBuffers(context);

  const master = context.createGain();
  master.gain.value = levelToGain(project.masterVolume);
  master.connect(context.destination);
  const gains = new Map<InstrumentId, GainNode>();
  for (const id of INSTRUMENT_IDS) {
    const gain = context.createGain();
    gain.gain.value = levelToGain(project.instruments[id].volume); // mute and isolate are ignored on purpose
    gain.connect(master);
    gains.set(id, gain);
  }

  const secondsPerTick = 60 / project.bpm / TICKS_PER_QUARTER;
  const plan = songPlan(project, 0);
  for (const note of plan.first.notes) {
    const gain = gains.get(note.instrument);
    if (!gain) continue;
    startNote(context, gain, buffers, manifest, note, project.instruments[note.instrument], secondsPerTick, note.tick * secondsPerTick);
  }

  const rendered = await context.startRendering();
  const channels: Float32Array[] = [];
  for (let channel = 0; channel < rendered.numberOfChannels; channel += 1) channels.push(rendered.getChannelData(channel));
  return encodeWav(channels, rendered.sampleRate);
}
