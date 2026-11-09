/**
 * Reads a standard MIDI file (format 0 or 1) into tracks of notes plus the tempo and meter events.
 * Pure: bytes in, a result out, no file access. A port of tools/midi-prototype/midilib.py, which
 * the tests compare it with. Everything the app does not use (controllers, pitch bend, aftertouch,
 * lyrics, markers, key signatures, system messages) is read past and dropped.
 * See docs/midi-import.md.
 */

export interface MidiNote {
  /** Start and end in file ticks. A note that is never switched off ends where its track ends. */
  start: number;
  end: number;
  pitch: number;
  /** 0 based: MIDI channel 10 is 9. */
  channel: number;
  velocity: number;
}

export interface MidiProgram {
  tick: number;
  channel: number;
  /** 0 to 127: the General MIDI number minus 1. */
  program: number;
}

export interface MidiTrack {
  /** The first track-name event, or an empty string. */
  name: string;
  /** Sorted by start, then end, then pitch. */
  notes: MidiNote[];
  programs: MidiProgram[];
}

export interface MidiTempo {
  tick: number;
  microsPerQuarter: number;
}

export interface MidiTimeSignature {
  tick: number;
  numerator: number;
  denominator: number;
}

export interface MidiFile {
  format: 0 | 1;
  /** Ticks per quarter note. */
  ticksPerQuarter: number;
  tracks: MidiTrack[];
  /** From every track, sorted by tick. */
  tempos: MidiTempo[];
  timeSignatures: MidiTimeSignature[];
  /** The tick of the last event of any kind, track-end events included. */
  endTick: number;
}

export type ReadResult = { ok: true; file: MidiFile } | { ok: false; reason: string };

/** Thrown inside the reader when the data runs out; turned into a refusal or a short track. */
class OutOfData extends Error {}

class Cursor {
  position: number;
  constructor(
    readonly bytes: Uint8Array,
    start: number,
    readonly end: number,
  ) {
    this.position = start;
  }

  get done(): boolean {
    return this.position >= this.end;
  }

  byte(): number {
    if (this.position >= this.end) throw new OutOfData();
    return this.bytes[this.position++] as number;
  }

  /** The next byte without taking it. */
  peek(): number {
    if (this.position >= this.end) throw new OutOfData();
    return this.bytes[this.position] as number;
  }

  /** A variable-length quantity: seven bits per byte, the high bit set on all but the last. */
  vlq(): number {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const b = this.byte();
      value = value * 128 + (b & 0x7f);
      if ((b & 0x80) === 0) return value;
    }
    throw new OutOfData();
  }

  take(count: number): Uint8Array {
    if (this.position + count > this.end) throw new OutOfData();
    const out = this.bytes.subarray(this.position, this.position + count);
    this.position += count;
    return out;
  }
}

function u16(bytes: Uint8Array, at: number): number {
  return ((bytes[at] as number) << 8) | (bytes[at + 1] as number);
}

function u32(bytes: Uint8Array, at: number): number {
  return (bytes[at] as number) * 0x1000000 + (((bytes[at + 1] as number) << 16) | ((bytes[at + 2] as number) << 8) | (bytes[at + 3] as number));
}

function latin1(bytes: Uint8Array): string {
  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);
  return text;
}

function isTag(bytes: Uint8Array, at: number, tag: string): boolean {
  for (let i = 0; i < 4; i++) if (bytes[at + i] !== tag.charCodeAt(i)) return false;
  return true;
}

interface TrackRead {
  track: MidiTrack;
  tempos: MidiTempo[];
  timeSignatures: MidiTimeSignature[];
  endTick: number;
}

function readTrack(bytes: Uint8Array, start: number, end: number): TrackRead {
  const cursor = new Cursor(bytes, start, end);
  const tempos: MidiTempo[] = [];
  const timeSignatures: MidiTimeSignature[] = [];
  const programs: MidiProgram[] = [];
  const notes: MidiNote[] = [];
  /** Notes switched on and not yet off, first in first out per channel and pitch, as the prototype pairs them. */
  const open = new Map<number, { start: number; velocity: number }[]>();
  let name = '';
  let named = false;
  let tick = 0;
  let status = 0;

  try {
    while (!cursor.done) {
      tick += cursor.vlq();
      const first = cursor.peek();
      if (first === 0xff) {
        cursor.byte();
        const type = cursor.byte();
        const data = cursor.take(cursor.vlq());
        if (type === 0x03 && !named && data.length > 0) {
          name = latin1(data);
          named = true;
        } else if (type === 0x51 && data.length === 3) {
          tempos.push({ tick, microsPerQuarter: ((data[0] as number) << 16) | ((data[1] as number) << 8) | (data[2] as number) });
        } else if (type === 0x58 && data.length >= 2) {
          timeSignatures.push({ tick, numerator: data[0] as number, denominator: 2 ** (data[1] as number) });
        } else if (type === 0x2f) {
          break;
        }
        continue;
      }
      if (first === 0xf0 || first === 0xf7) {
        cursor.byte();
        cursor.take(cursor.vlq());
        continue;
      }
      if (first & 0x80) {
        status = first;
        cursor.byte();
      } else if (status === 0) {
        // Data with no status byte before it: the track is damaged from here on.
        break;
      }
      const high = status & 0xf0;
      const channel = status & 0x0f;
      if (high === 0xc0 || high === 0xd0) {
        const value = cursor.byte();
        if (high === 0xc0) programs.push({ tick, channel, program: value });
        continue;
      }
      if (high === 0xf0) {
        // A system common message with no length we know: stop reading this track.
        break;
      }
      const a = cursor.byte();
      const b = cursor.byte();
      const key = channel * 128 + a;
      if (high === 0x90 && b > 0) {
        const queue = open.get(key);
        if (queue) queue.push({ start: tick, velocity: b });
        else open.set(key, [{ start: tick, velocity: b }]);
      } else if (high === 0x80 || high === 0x90) {
        const queue = open.get(key);
        const began = queue?.shift();
        if (began) notes.push({ start: began.start, end: tick, pitch: a, channel, velocity: began.velocity });
      }
    }
  } catch (error) {
    // The track ends in the middle of an event. Keep what was read, as most players do.
    if (!(error instanceof OutOfData)) throw error;
  }

  for (const [key, queue] of open) {
    for (const began of queue) {
      notes.push({ start: began.start, end: tick, pitch: key % 128, channel: Math.floor(key / 128), velocity: began.velocity });
    }
  }
  notes.sort((x, y) => x.start - y.start || x.end - y.end || x.pitch - y.pitch || x.channel - y.channel || x.velocity - y.velocity);
  return { track: { name, notes, programs }, tempos, timeSignatures, endTick: tick };
}

/** Reads the bytes of a MIDI file. A file the app cannot use comes back as a reason, never as an exception. */
export function readMidi(bytes: Uint8Array): ReadResult {
  if (bytes.length < 14 || !isTag(bytes, 0, 'MThd')) return { ok: false, reason: 'This is not a MIDI file.' };
  const headerLength = u32(bytes, 4);
  if (headerLength < 6) return { ok: false, reason: 'This is not a MIDI file (the header is damaged).' };
  const format = u16(bytes, 8);
  const trackCount = u16(bytes, 10);
  const division = u16(bytes, 12);
  if (format === 2) return { ok: false, reason: 'This MIDI file is format 2 (separate songs in one file), which the app cannot read.' };
  if (format !== 0 && format !== 1) return { ok: false, reason: `This MIDI file has an unknown format (${format}).` };
  if (division & 0x8000) return { ok: false, reason: 'This MIDI file counts time in SMPTE frames, not in beats, which the app cannot read.' };
  if (division === 0) return { ok: false, reason: 'This MIDI file has a time division of 0.' };

  const tracks: MidiTrack[] = [];
  const tempos: MidiTempo[] = [];
  const timeSignatures: MidiTimeSignature[] = [];
  let endTick = 0;
  let at = 8 + headerLength;
  let seen = 0;
  while (seen < trackCount && at + 8 <= bytes.length) {
    if (!isTag(bytes, at, 'MTrk')) {
      // Junk between chunks: step over it a byte at a time, as the prototype does.
      at += 1;
      continue;
    }
    const length = u32(bytes, at + 4);
    const dataStart = at + 8;
    const dataEnd = Math.min(bytes.length, dataStart + length);
    const read = readTrack(bytes, dataStart, dataEnd);
    tracks.push(read.track);
    tempos.push(...read.tempos);
    timeSignatures.push(...read.timeSignatures);
    endTick = Math.max(endTick, read.endTick);
    at = dataStart + length;
    seen += 1;
  }
  if (tracks.length === 0) return { ok: false, reason: 'This MIDI file has no tracks.' };

  tempos.sort((x, y) => x.tick - y.tick);
  timeSignatures.sort((x, y) => x.tick - y.tick);
  return {
    ok: true,
    file: { format: format as 0 | 1, ticksPerQuarter: division, tracks, tempos, timeSignatures, endTick },
  };
}
