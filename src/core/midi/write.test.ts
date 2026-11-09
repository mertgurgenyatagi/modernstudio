import { describe, expect, it } from 'vitest';
import { readMidi } from './read';
import { encodeMidi, vlqBytes, type MidiEvent } from './write';

describe('variable-length quantities', () => {
  it('writes the examples of the MIDI specification', () => {
    expect(vlqBytes(0)).toEqual([0x00]);
    expect(vlqBytes(0x40)).toEqual([0x40]);
    expect(vlqBytes(0x7f)).toEqual([0x7f]);
    expect(vlqBytes(0x80)).toEqual([0x81, 0x00]);
    expect(vlqBytes(0x2000)).toEqual([0xc0, 0x00]);
    expect(vlqBytes(0x3fff)).toEqual([0xff, 0x7f]);
    expect(vlqBytes(0x4000)).toEqual([0x81, 0x80, 0x00]);
    expect(vlqBytes(0x0fffffff)).toEqual([0xff, 0xff, 0xff, 0x7f]);
  });
});

describe('writing a file', () => {
  it('writes the header and one chunk per track', () => {
    const bytes = encodeMidi({ format: 1, ticksPerQuarter: 480, tracks: [[], []] });
    expect(Array.from(bytes.slice(0, 14))).toEqual([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 2, 0x01, 0xe0]);
    // Each empty track is a header, a length of 4 and the end-of-track event.
    expect(bytes).toHaveLength(14 + 2 * 12);
    expect(Array.from(bytes.slice(14, 26))).toEqual([0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 4, 0, 0xff, 0x2f, 0]);
  });

  it('reads back as written: names, tempo, meter, programs and notes', () => {
    const events: MidiEvent[] = [
      { tick: 0, kind: 'name', text: 'Rhythm Guitar' },
      { tick: 0, kind: 'tempo', microsPerQuarter: 500000 },
      { tick: 0, kind: 'timeSignature', numerator: 3, denominator: 4 },
      { tick: 0, kind: 'program', channel: 1, program: 26 },
      { tick: 0, kind: 'controller', channel: 1, controller: 7, value: 90 },
      { tick: 480, kind: 'noteOn', channel: 1, pitch: 52, velocity: 100 },
      { tick: 960, kind: 'noteOff', channel: 1, pitch: 52 },
    ];
    const result = readMidi(encodeMidi({ format: 1, ticksPerQuarter: 480, tracks: [events] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { file } = result;
    expect(file.ticksPerQuarter).toBe(480);
    expect(file.tracks[0]?.name).toBe('Rhythm Guitar');
    expect(file.tempos).toEqual([{ tick: 0, microsPerQuarter: 500000 }]);
    expect(file.timeSignatures).toEqual([{ tick: 0, numerator: 3, denominator: 4 }]);
    expect(file.tracks[0]?.programs).toEqual([{ tick: 0, channel: 1, program: 26 }]);
    expect(file.tracks[0]?.notes).toEqual([{ start: 480, end: 960, pitch: 52, channel: 1, velocity: 100 }]);
  });

  it('puts a note off before a note on at the same tick, so touching notes stay two notes', () => {
    const events: MidiEvent[] = [
      { tick: 0, kind: 'noteOn', channel: 0, pitch: 40, velocity: 100 },
      { tick: 120, kind: 'noteOn', channel: 0, pitch: 40, velocity: 100 },
      { tick: 120, kind: 'noteOff', channel: 0, pitch: 40 },
      { tick: 240, kind: 'noteOff', channel: 0, pitch: 40 },
    ];
    const result = readMidi(encodeMidi({ format: 1, ticksPerQuarter: 480, tracks: [events] }));
    if (!result.ok) throw new Error(result.reason);
    expect(result.file.tracks[0]?.notes.map((n) => [n.start, n.end])).toEqual([
      [0, 120],
      [120, 240],
    ]);
  });

  it('survives a track of many thousands of events', () => {
    const events: MidiEvent[] = [];
    for (let i = 0; i < 60000; i++) {
      events.push({ tick: i * 10, kind: 'noteOn', channel: 0, pitch: 40 + (i % 12), velocity: 100 });
      events.push({ tick: i * 10 + 5, kind: 'noteOff', channel: 0, pitch: 40 + (i % 12) });
    }
    const result = readMidi(encodeMidi({ format: 1, ticksPerQuarter: 480, tracks: [events] }));
    if (!result.ok) throw new Error(result.reason);
    expect(result.file.tracks[0]?.notes).toHaveLength(60000);
  });

  it('keeps data bytes in range', () => {
    const events: MidiEvent[] = [{ tick: 0, kind: 'controller', channel: 0, controller: 7, value: 300 }];
    const bytes = encodeMidi({ format: 1, ticksPerQuarter: 480, tracks: [events] });
    expect(Array.from(bytes.slice(23, 26))).toEqual([0xb0, 7, 127]);
  });
});
