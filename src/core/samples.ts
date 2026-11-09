/**
 * Choosing which recorded sample plays a note. The files and `manifest.json` come from plan24 step 3
 * (docs/sound.md). A pitched sample is played faster or slower to reach the note, at most about one
 * semitone for notes inside the recorded range.
 */
import type { DrumRow, InstrumentId } from './instruments';

export interface PitchedSample {
  /** Path relative to `src/assets/sounds/`. */
  file: string;
  /** The MIDI note that was recorded. */
  pitch: number;
  /** The notes this sample is meant for. */
  covers: number[];
  /** How long the key was held while recording, in seconds. */
  heldSeconds: number;
  /** The length of the file in seconds. */
  seconds: number;
}

export interface DrumSample {
  file: string;
  row: DrumRow;
  midiNote: number;
  seconds: number;
}

export interface SoundManifest {
  version: number;
  sampleRate: number;
  instruments: {
    bass: PitchedSet;
    guitar: PitchedSet;
    drums: { kind: 'drums'; usedBy: InstrumentId[]; samples: DrumSample[] };
  };
}

interface PitchedSet {
  kind: 'pitched';
  usedBy: InstrumentId[];
  samples: PitchedSample[];
}

/** The folders of recorded files. The two guitars share one set. Keys has none: it is a generated tone. */
export type SoundSetName = 'bass' | 'guitar' | 'drums';

export const SOUND_SET_OF: Record<Exclude<InstrumentId, 'keys'>, SoundSetName> = {
  drums: 'drums',
  bass: 'bass',
  rhythm: 'guitar',
  lead: 'guitar',
};

/**
 * Keys is not recorded: it is a triangle wave made by the audio engine, so a note can be held as long
 * as it is and any pitch is exact. `peak` is the wave's top: a triangle's RMS is its peak over the
 * square root of 3, so 0.1732 is -20 dBFS RMS, the loudness every recorded sample was levelled to
 * (docs/sound.md), which keeps volume 100 meaning the same for every instrument.
 */
export const KEYS_TONE = { wave: 'triangle', peak: 0.1 * Math.sqrt(3) } as const;

/** The frequency in hertz of a MIDI note (A4 = 69 = 440 Hz). */
export function pitchFrequency(pitch: number): number {
  return 440 * 2 ** ((pitch - 69) / 12);
}

/** The sample whose recorded pitch is nearest to the wanted pitch (the lower one on a tie). */
export function nearestSample(samples: readonly PitchedSample[], pitch: number): PitchedSample {
  let best: PitchedSample | undefined;
  for (const sample of samples) {
    if (!best) {
      best = sample;
      continue;
    }
    const d = Math.abs(sample.pitch - pitch);
    const bestD = Math.abs(best.pitch - pitch);
    if (d < bestD || (d === bestD && sample.pitch < best.pitch)) best = sample;
  }
  if (!best) throw new Error('This instrument has no recorded samples.');
  return best;
}

/** How much faster the sample plays to reach the pitch: 2 to the power of the semitone distance over 12. */
export function playbackRate(samplePitch: number, pitch: number): number {
  return 2 ** ((pitch - samplePitch) / 12);
}

export interface PitchedChoice {
  sample: PitchedSample;
  rate: number;
}

export function chooseSample(samples: readonly PitchedSample[], pitch: number): PitchedChoice {
  const sample = nearestSample(samples, pitch);
  return { sample, rate: playbackRate(sample.pitch, pitch) };
}

/** The sample of a drum row. */
export function drumSample(samples: readonly DrumSample[], row: DrumRow): DrumSample {
  const sample = samples.find((s) => s.row === row);
  if (!sample) throw new Error(`There is no recorded sample for the drum row ${row}.`);
  return sample;
}

/**
 * How long a note is held before it is released, in seconds. A note longer than the key was held
 * while recording is released at that point: the sample has nothing left after it, and the Synth
 * Voice of Keys would otherwise run on to the end of the file (docs/sound.md). The rate shortens or
 * lengthens the sample, so the limit shifts with it.
 */
export function holdSeconds(noteSeconds: number, sample: PitchedSample, rate: number): number {
  return Math.max(0, Math.min(noteSeconds, sample.heldSeconds / rate));
}
