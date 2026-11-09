import { describe, expect, it } from 'vitest';
import manifestJson from '../assets/sounds/manifest.json';
import { DRUM_ROWS, KEYS_RANGE, TUNING } from './instruments';
import {
  SOUND_SET_OF,
  chooseSample,
  drumSample,
  holdSeconds,
  nearestSample,
  playbackRate,
  type SoundManifest,
} from './samples';

const manifest = manifestJson as unknown as SoundManifest;

describe('the manifest', () => {
  it('has a sample set for every instrument', () => {
    for (const [id, set] of Object.entries(SOUND_SET_OF)) {
      expect(manifest.instruments[set].samples.length, id).toBeGreaterThan(0);
      expect(manifest.instruments[set].usedBy).toContain(id);
    }
  });

  it('has one drum sample per row', () => {
    for (const row of DRUM_ROWS) expect(drumSample(manifest.instruments.drums.samples, row).row).toBe(row);
  });
});

describe('choosing a sample', () => {
  const guitar = manifest.instruments.guitar.samples;

  it('plays a recorded note as it is', () => {
    const { sample, rate } = chooseSample(guitar, 52);
    expect(sample.pitch).toBe(52);
    expect(rate).toBe(1);
  });

  it('shifts the nearest sample by at most a semitone inside the recorded range', () => {
    for (let pitch = 40; pitch <= 76; pitch += 1) {
      const { sample, rate } = chooseSample(guitar, pitch);
      expect(Math.abs(sample.pitch - pitch)).toBeLessThanOrEqual(1);
      expect(rate).toBeGreaterThan(2 ** (-1 / 12) - 1e-9);
      expect(rate).toBeLessThan(2 ** (1 / 12) + 1e-9);
    }
  });

  it('shifts up an octave by doubling the rate', () => {
    expect(playbackRate(40, 52)).toBeCloseTo(2);
    expect(playbackRate(52, 40)).toBeCloseTo(0.5);
  });

  it('covers every pitch the instruments can play', () => {
    const lowest = (id: 'bass' | 'rhythm') => TUNING[id][0]!;
    for (const [id, set, low, high] of [
      ['bass', 'bass', lowest('bass'), TUNING.bass[3]! + 12],
      ['rhythm', 'guitar', lowest('rhythm'), TUNING.rhythm[5]! + 12],
      ['keys', 'keys', KEYS_RANGE.low, KEYS_RANGE.high],
    ] as const) {
      for (let pitch = low; pitch <= high; pitch += 1) {
        const { sample } = chooseSample(manifest.instruments[set].samples, pitch);
        expect(Math.abs(sample.pitch - pitch), `${id} ${pitch}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('takes the lower sample on a tie and the end sample outside the range', () => {
    const samples = manifest.instruments.bass.samples;
    expect(nearestSample(samples, 29.5).pitch).toBe(28);
    expect(nearestSample(samples, 10).pitch).toBe(28);
    expect(nearestSample(samples, 99).pitch).toBe(55);
  });
});

describe('holding a note', () => {
  const sample = { file: 'x', pitch: 60, covers: [60], heldSeconds: 4, seconds: 4.7 };

  it('holds a short note for its own length', () => {
    expect(holdSeconds(0.5, sample, 1)).toBe(0.5);
  });

  it('releases a long note when the recorded key went up', () => {
    expect(holdSeconds(10, sample, 1)).toBe(4);
    expect(holdSeconds(10, sample, 2)).toBe(2);
  });
});
