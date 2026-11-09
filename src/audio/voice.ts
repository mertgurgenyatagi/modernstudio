/**
 * One sounding note: a recorded sample, played at a rate, through its own gain that shapes the
 * envelope. It takes any audio context, so the live engine and the offline render of the WAV export
 * (plan24 step 12) build their notes the same way.
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
  const plan = planEnvelope(envelope, holdSeconds);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  const gain = context.createGain();
  const [first, ...rest] = plan.points;
  gain.gain.setValueAtTime(first ? first.gain : 1, when);
  for (const point of rest) gain.gain.linearRampToValueAtTime(point.gain, when + point.time);
  source.connect(gain);
  gain.connect(destination);

  const naturalEnd = buffer.duration / rate;
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
