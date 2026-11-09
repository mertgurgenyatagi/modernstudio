import { describe, expect, it } from 'vitest';
import { ENVELOPE_MAX_SECONDS, MIN_RELEASE_SECONDS, SUSTAIN_LEVEL, envelopeSeconds, planEnvelope } from './envelope';

const flat = { attack: 0, decay: 0, release: 0 };

describe('envelope settings', () => {
  it('maps 0 to 0 seconds and 100 to two seconds, on a squared curve', () => {
    expect(envelopeSeconds(0)).toBe(0);
    expect(envelopeSeconds(100)).toBe(ENVELOPE_MAX_SECONDS);
    expect(envelopeSeconds(50)).toBeCloseTo(0.5);
    expect(envelopeSeconds(-3)).toBe(0);
    expect(envelopeSeconds(1000)).toBe(ENVELOPE_MAX_SECONDS);
  });
});

describe('the gain curve', () => {
  it('leaves the sound unshaped with all settings at 0, apart from a short fade at the end', () => {
    const plan = planEnvelope(flat, 1);
    expect(plan.points).toEqual([
      { time: 0, gain: 1 },
      { time: 1, gain: 1 },
      { time: 1 + MIN_RELEASE_SECONDS, gain: 0 },
    ]);
    expect(plan.end).toBeCloseTo(1 + MIN_RELEASE_SECONDS);
  });

  it('fades in over the attack', () => {
    const plan = planEnvelope({ ...flat, attack: 50 }, 2); // 0.5 s
    expect(plan.points[0]).toEqual({ time: 0, gain: 0 });
    expect(plan.points[1]).toEqual({ time: 0.5, gain: 1 });
  });

  it('falls to the sustain level over the decay and holds it', () => {
    const plan = planEnvelope({ attack: 0, decay: 50, release: 0 }, 2); // decay 0.5 s
    expect(plan.points[0]).toEqual({ time: 0, gain: 1 });
    expect(plan.points[1]).toEqual({ time: 0.5, gain: SUSTAIN_LEVEL });
    expect(plan.points[2]).toEqual({ time: 2, gain: SUSTAIN_LEVEL });
  });

  it('releases over the release time, so a note can ring on past its length', () => {
    const plan = planEnvelope({ ...flat, release: 50 }, 1); // release 0.5 s
    expect(plan.end).toBeCloseTo(1.5);
    expect(plan.points[plan.points.length - 1]).toEqual({ time: 1.5, gain: 0 });
  });

  it('starts the release from the level reached when the key goes up during the attack', () => {
    const plan = planEnvelope({ attack: 50, decay: 0, release: 50 }, 0.25); // attack 0.5 s, held 0.25 s
    const held = plan.points.find((p) => p.time === 0.25);
    expect(held?.gain).toBeCloseTo(0.5);
    expect(plan.end).toBeCloseTo(0.75);
  });

  it('keeps times strictly increasing, even for a note of zero length', () => {
    for (const hold of [0, 0.001, 0.5, 3]) {
      for (const settings of [flat, { attack: 100, decay: 100, release: 100 }, { attack: 20, decay: 0, release: 5 }]) {
        const { points } = planEnvelope(settings, hold);
        expect(points[0]?.time).toBe(0);
        for (let i = 1; i < points.length; i += 1) {
          expect(points[i]!.time).toBeGreaterThan(points[i - 1]!.time);
        }
        expect(points[points.length - 1]?.gain).toBe(0);
      }
    }
  });
});
