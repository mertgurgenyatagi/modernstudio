/**
 * One sounding note: a recorded sample played at a rate, or Keys' generated triangle wave, through its
 * own gain that shapes the envelope. It takes any audio context, so the live engine and the offline
 * render of the WAV export (plan24 step 12) build their notes the same way.
 */
import { planEnvelope, type EnvelopeSettings } from '../core/envelope';

export interface Voice {
  /** Fades the note out quickly from time `at`, on the context's clock. Used when playback stops. */
  stop(at: number): void;
}

/** The fade used when playback is stopped, so that nothing is cut with a click. */
const STOP_FADE_SECONDS = 0.03;

/**
 * Starts a voice at time `when`.
 * @param holdSeconds how long the key is held, in seconds of output (the release follows it)
 * @param rate playback rate of the sample, to reach the pitch
 */
export function startVoice(
  context: BaseAudioContext,
  destination: AudioNode,
  buffer: AudioBuffer,
  rate: number,
  when: number,
  holdSeconds: number,
  envelope: EnvelopeSettings,
  onEnded?: () => void,
): Voice {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  return playSource(context, destination, source, buffer.duration / rate, 1, when, holdSeconds, envelope, onEnded);
}

/**
 * Starts a generated tone (Keys' triangle wave) at time `when`. It has no end of its own, so it
 * sounds for as long as the key is held, then through the release.
 * @param peak the top of the wave, which sets how loud it is
 */
export function startTone(
  context: BaseAudioContext,
  destination: AudioNode,
  wave: OscillatorType,
  frequency: number,
  peak: number,
  when: number,
  holdSeconds: number,
  envelope: EnvelopeSettings,
  onEnded?: () => void,
): Voice {
  const source = context.createOscillator();
  source.type = wave;
  source.frequency.value = frequency;
  return playSource(context, destination, source, Infinity, peak, when, holdSeconds, envelope, onEnded);
}

/** Shapes a started source with the envelope and schedules its end. `level` scales the whole curve. */
function playSource(
  context: BaseAudioContext,
  destination: AudioNode,
  source: AudioScheduledSourceNode,
  naturalEnd: number,
  level: number,
  when: number,
  holdSeconds: number,
  envelope: EnvelopeSettings,
  onEnded?: () => void,
): Voice {
  const plan = planEnvelope(envelope, holdSeconds);
  const gain = context.createGain();
  const [first, ...rest] = plan.points;
  gain.gain.setValueAtTime((first ? first.gain : 1) * level, when);
  for (const point of rest) gain.gain.linearRampToValueAtTime(point.gain * level, when + point.time);
  source.connect(gain);
  gain.connect(destination);

  source.start(when);
  source.stop(when + Math.min(plan.end, naturalEnd) + 0.01);
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
    onEnded?.();
  };

  return {
    stop(at) {
      gain.gain.cancelScheduledValues(at);
      gain.gain.setTargetAtTime(0, at, STOP_FADE_SECONDS / 3);
      try {
        source.stop(at + STOP_FADE_SECONDS * 2);
      } catch {
        // Already stopped: nothing to do.
      }
    },
  };
}
