import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readMidi, type MidiFile } from './read';

/** A MIDI file from a header and the bytes of each track. */
function file(format: number, division: number, ...tracks: number[][]): Uint8Array {
  const out: number[] = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, format, 0, tracks.length, division >> 8, division & 0xff];
  for (const body of tracks) {
    out.push(0x4d, 0x54, 0x72, 0x6b, (body.length >>> 24) & 0xff, (body.length >>> 16) & 0xff, (body.length >>> 8) & 0xff, body.length & 0xff, ...body);
  }
  return Uint8Array.from(out);
}

function read(bytes: Uint8Array): MidiFile {
  const result = readMidi(bytes);
  if (!result.ok) throw new Error(result.reason);
  return result.file;
}

const END = [0x00, 0xff, 0x2f, 0x00];

describe('reading a file', () => {
  it('reads notes, the track name, the tempo and the meter', () => {
    const body = [
      0x00, 0xff, 0x03, 0x04, 0x42, 0x61, 0x73, 0x73, // name "Bass"
      0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, // 500000 microseconds: 120 BPM
      0x00, 0xff, 0x58, 0x04, 0x03, 0x02, 0x18, 0x08, // 3/4
      0x00, 0xc1, 0x21, // program 33 on channel 2
      0x00, 0x91, 0x28, 0x64, // note on, channel 2, E2
      0x60, 0x81, 0x28, 0x00, // note off 96 ticks later
      ...END,
    ];
    const midi = read(file(1, 96, body));
    expect(midi.format).toBe(1);
    expect(midi.ticksPerQuarter).toBe(96);
    expect(midi.tempos).toEqual([{ tick: 0, microsPerQuarter: 500000 }]);
    expect(midi.timeSignatures).toEqual([{ tick: 0, numerator: 3, denominator: 4 }]);
    expect(midi.tracks).toHaveLength(1);
    expect(midi.tracks[0]?.name).toBe('Bass');
    expect(midi.tracks[0]?.programs).toEqual([{ tick: 0, channel: 1, program: 33 }]);
    expect(midi.tracks[0]?.notes).toEqual([{ start: 0, end: 96, pitch: 40, channel: 1, velocity: 100 }]);
    expect(midi.endTick).toBe(96);
  });

  it('understands running status and a note on with velocity 0 as a note off', () => {
    const body = [
      0x00, 0x90, 0x3c, 0x50, // note on, C4
      0x10, 0x40, 0x50, // running status: note on, E4
      0x10, 0x3c, 0x00, // running status: velocity 0, C4 off at 32
      0x10, 0x40, 0x00, // E4 off at 48
      ...END,
    ];
    const notes = read(file(0, 480, body)).tracks[0]?.notes;
    expect(notes).toEqual([
      { start: 0, end: 32, pitch: 60, channel: 0, velocity: 80 },
      { start: 16, end: 48, pitch: 64, channel: 0, velocity: 80 },
    ]);
  });

  it('reads multi-byte delta times', () => {
    // 0x8140 = 192
    const body = [0x00, 0x90, 0x3c, 0x40, 0x81, 0x40, 0x80, 0x3c, 0x00, ...END];
    expect(read(file(0, 480, body)).tracks[0]?.notes[0]).toMatchObject({ start: 0, end: 192 });
  });

  it('pairs repeated notes of one pitch first in, first out', () => {
    const body = [
      0x00, 0x90, 0x3c, 0x40, // on at 0
      0x04, 0x90, 0x3c, 0x40, // on again at 4
      0x04, 0x80, 0x3c, 0x00, // off at 8: ends the first
      0x04, 0x80, 0x3c, 0x00, // off at 12: ends the second
      ...END,
    ];
    expect(read(file(0, 480, body)).tracks[0]?.notes.map((n) => [n.start, n.end])).toEqual([
      [0, 8],
      [4, 12],
    ]);
  });

  it('ends a note that is never switched off where its track ends', () => {
    const body = [0x00, 0x90, 0x3c, 0x40, 0x20, 0xff, 0x2f, 0x00];
    expect(read(file(0, 480, body)).tracks[0]?.notes).toEqual([{ start: 0, end: 32, pitch: 60, channel: 0, velocity: 64 }]);
  });

  it('skips what it does not use: controllers, pitch bend, aftertouch, sysex, lyrics, key signatures', () => {
    const body = [
      0x00, 0xb0, 0x07, 0x64, // volume
      0x00, 0xe0, 0x00, 0x40, // pitch bend
      0x00, 0xd0, 0x10, // channel pressure
      0x00, 0xa0, 0x3c, 0x10, // key pressure
      0x00, 0xf0, 0x03, 0x01, 0x02, 0xf7, // sysex
      0x00, 0xff, 0x05, 0x02, 0x68, 0x69, // lyric "hi"
      0x00, 0xff, 0x59, 0x02, 0x00, 0x00, // key signature
      0x00, 0x90, 0x3c, 0x40,
      0x08, 0x80, 0x3c, 0x00,
      ...END,
    ];
    const midi = read(file(0, 480, body));
    expect(midi.tracks[0]?.notes).toHaveLength(1);
    expect(midi.tracks[0]?.programs).toEqual([]);
  });

  it('collects tempos and meters from every track, in time order, and keeps empty tracks', () => {
    const conductor = [0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, 0x60, 0xff, 0x51, 0x03, 0x03, 0xd0, 0x90, ...END];
    const other = [0x30, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08, ...END];
    const midi = read(file(1, 480, conductor, other));
    expect(midi.tracks).toHaveLength(2);
    expect(midi.tempos.map((t) => t.tick)).toEqual([0, 96]);
    expect(midi.tempos[1]?.microsPerQuarter).toBe(250000);
    expect(midi.timeSignatures).toEqual([{ tick: 48, numerator: 4, denominator: 4 }]);
  });

  it('keeps what it read from a track that ends in the middle of an event', () => {
    const body = [0x00, 0x90, 0x3c, 0x40, 0x10, 0x80, 0x3c, 0x00, 0x10, 0x90];
    const notes = read(file(0, 480, body)).tracks[0]?.notes;
    expect(notes).toEqual([{ start: 0, end: 16, pitch: 60, channel: 0, velocity: 64 }]);
  });
});

describe('refusing a file', () => {
  it('refuses something that is not a MIDI file', () => {
    const result = readMidi(new TextEncoder().encode('RIFF....WAVEfmt '));
    expect(result.ok).toBe(false);
    expect(readMidi(new Uint8Array(0)).ok).toBe(false);
  });

  it('refuses format 2 and says so', () => {
    const result = readMidi(file(2, 480, END));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/format 2/);
  });

  it('refuses a time division in SMPTE frames and says so', () => {
    const result = readMidi(file(1, 0xe728, END));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/SMPTE/);
  });

  it('refuses a file with a header and no tracks', () => {
    expect(readMidi(file(1, 480)).ok).toBe(false);
  });
});

// ---- the eleven album files, against what the Python prototype reads ----

interface Fixture {
  song: string;
  format: number;
  ppq: number;
  tempos: number;
  timeSignatures: number[][];
  tracks: { name: string; notes: number; channels: number[]; checksum: number }[];
}

/** The same number as tools/midi-prototype/dump_reader.py: it changes if any start, end, pitch or channel changes. */
function checksum(notes: MidiFile['tracks'][number]['notes']): number {
  let total = 0;
  for (const n of notes) total = (total * 31 + n.start * 7 + n.end * 3 + n.pitch * 5 + n.channel) % 1000000007;
  return total;
}

const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/reader.json'), 'utf8')) as Record<string, Fixture>;
const midisFolder = join(__dirname, '../../../midis');

describe('the album files', () => {
  for (const [short, expected] of Object.entries(fixture)) {
    const path = join(midisFolder, `Strokes (The) — ${short} [MIDIfind.com].mid`);
    it.skipIf(!existsSync(path))(`reads ${expected.song} (${short}) as the prototype does`, () => {
      const midi = read(new Uint8Array(readFileSync(path)));
      expect(midi.format).toBe(expected.format);
      expect(midi.ticksPerQuarter).toBe(expected.ppq);
      expect(midi.tempos).toHaveLength(expected.tempos);
      expect(midi.timeSignatures.map((t) => [t.tick, t.numerator, t.denominator])).toEqual(expected.timeSignatures);
      expect(midi.tracks.map((t) => t.name)).toEqual(expected.tracks.map((t) => t.name));
      expect(midi.tracks.map((t) => t.notes.length)).toEqual(expected.tracks.map((t) => t.notes));
      expect(midi.tracks.map((t) => [...new Set(t.notes.map((n) => n.channel))].sort((a, b) => a - b))).toEqual(
        expected.tracks.map((t) => t.channels),
      );
      expect(midi.tracks.map((t) => checksum(t.notes))).toEqual(expected.tracks.map((t) => t.checksum));
    });
  }

  it('has the eleven files in the fixture', () => {
    expect(Object.keys(fixture)).toHaveLength(11);
  });
});
