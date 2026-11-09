import { describe, expect, it } from 'vitest';
import { instrumentGain, levelToGain, peakToMeter, smoothMeter } from './levels';
import { createProject, setMuted, setVolume } from './project';

describe('volume', () => {
  it('maps 0 to silence and 100 to the recorded level', () => {
    expect(levelToGain(0)).toBe(0);
    expect(levelToGain(100)).toBe(1);
    expect(levelToGain(50)).toBeCloseTo(0.25);
  });

  it('clamps strange input', () => {
    expect(levelToGain(-5)).toBe(0);
    expect(levelToGain(250)).toBe(1);
    expect(levelToGain(Number.NaN)).toBe(0);
  });
});

describe('mute and isolate', () => {
  it('plays an instrument at its volume', () => {
    const p = setVolume(createProject(), 'bass', 100);
    expect(instrumentGain(p, null, 'bass')).toBe(1);
  });

  it('silences a muted instrument', () => {
    const p = setMuted(createProject(), 'bass', true);
    expect(instrumentGain(p, null, 'bass')).toBe(0);
    expect(instrumentGain(p, null, 'keys')).toBeGreaterThan(0);
  });

  it('isolate silences every other instrument', () => {
    const p = createProject();
    expect(instrumentGain(p, 'lead', 'lead')).toBeGreaterThan(0);
    expect(instrumentGain(p, 'lead', 'drums')).toBe(0);
    expect(instrumentGain(p, 'lead', 'rhythm')).toBe(0);
  });

  it('keeps an instrument that is both muted and isolated silent', () => {
    const p = setMuted(createProject(), 'lead', true);
    expect(instrumentGain(p, 'lead', 'lead')).toBe(0);
  });
});

describe('level meter', () => {
  it('reads empty at silence and full at full scale', () => {
    expect(peakToMeter(0)).toBe(0);
    expect(peakToMeter(1)).toBe(1);
    expect(peakToMeter(0.0001)).toBe(0);
  });

  it('is on a dB scale', () => {
    expect(peakToMeter(10 ** (-30 / 20))).toBeCloseTo(0.5);
  });

  it('rises at once and falls slowly', () => {
    expect(smoothMeter(0.2, 0.8, 0.05)).toBe(0.8);
    expect(smoothMeter(0.8, 0.1, 0.1)).toBeCloseTo(0.55);
    expect(smoothMeter(0.3, 0.1, 1)).toBe(0.1);
  });
});
