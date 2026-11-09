/**
 * Turns a note of a timeline into a voice: picks the sample, the playback rate and the hold time.
 * Shared by the live engine and, later, the offline render of the WAV export.
 */
import type { EnvelopeSettings } from '../core/envelope';
import type { TimelineNote } from '../core/playback';
import { KEYS_TONE, SOUND_SET_OF, chooseSample, drumSample, holdSeconds, pitchFrequency, type SoundManifest } from '../core/samples';
import { startTone, startVoice, type Voice } from './voice';

function bufferOf(buffers: ReadonlyMap<string, AudioBuffer>, file: string): AudioBuffer {
  const buffer = buffers.get(file);
  if (!buffer) throw new Error(`The sound ${file} is not loaded.`);
  return buffer;
}

/**
 * Starts one note at time `when`. `secondsPerTick` gives the note its length in seconds at the
 * current tempo. A drum hit plays for the whole of its sound. Keys is a triangle wave held for the
 * note's whole length.
 */
export function startNote(
  context: BaseAudioContext,
  destination: AudioNode,
  buffers: ReadonlyMap<string, AudioBuffer>,
  manifest: SoundManifest,
  note: TimelineNote,
  envelope: EnvelopeSettings,
  secondsPerTick: number,
  when: number,
  onEnded?: () => void,
): Voice {
  if (note.instrument === 'keys') {
    if (note.sound.kind !== 'pitch') throw new Error('Keys was given a drum hit.');
    const wave = KEYS_TONE.wave;
    return startTone(context, destination, wave, pitchFrequency(note.sound.pitch), KEYS_TONE.peak, when, note.lengthTicks * secondsPerTick, envelope, onEnded);
  }
  const set = SOUND_SET_OF[note.instrument];
  if (note.sound.kind === 'drum') {
    const sample = drumSample(manifest.instruments.drums.samples, note.sound.row);
    const buffer = bufferOf(buffers, sample.file);
    return startVoice(context, destination, buffer, 1, when, buffer.duration, envelope, onEnded);
  }
  if (set === 'drums') throw new Error('A drum instrument was given a pitched note.');
  const { sample, rate } = chooseSample(manifest.instruments[set].samples, note.sound.pitch);
  const hold = holdSeconds(note.lengthTicks * secondsPerTick, sample, rate);
  return startVoice(context, destination, bufferOf(buffers, sample.file), rate, when, hold, envelope, onEnded);
}
