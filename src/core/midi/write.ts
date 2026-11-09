/**
 * Writes a standard MIDI file. Pure: events in, bytes out. The events carry absolute ticks; the
 * writer sorts them, turns them into delta times and closes every track. Only what the app writes is
 * supported (notes, programs, controllers, track names, tempo, meter). See docs/midi-import.md.
 */

export type MidiEvent =
  | { tick: number; kind: 'name'; text: string }
  | { tick: number; kind: 'tempo'; microsPerQuarter: number }
  | { tick: number; kind: 'timeSignature'; numerator: number; denominator: number }
  | { tick: number; kind: 'program'; channel: number; program: number }
  | { tick: number; kind: 'controller'; channel: number; controller: number; value: number }
  | { tick: number; kind: 'noteOn'; channel: number; pitch: number; velocity: number }
  | { tick: number; kind: 'noteOff'; channel: number; pitch: number };

export interface MidiOut {
  format: 0 | 1;
  ticksPerQuarter: number;
  /** One list of events per track. */
  tracks: readonly (readonly MidiEvent[])[];
  /** Every track ends no earlier than this tick, so the file keeps its length when the last bars are silent. */
  lengthTicks?: number;
}

/** Settings first, then note-offs, then note-ons: a note that ends where the next begins stays two notes. */
function order(event: MidiEvent): number {
  switch (event.kind) {
    case 'name':
    case 'tempo':
    case 'timeSignature':
      return 0;
    case 'program':
    case 'controller':
      return 1;
    case 'noteOff':
      return 2;
    case 'noteOn':
      return 3;
  }
}

/** A variable-length quantity as bytes. */
export function vlqBytes(value: number): number[] {
  let rest = Math.max(0, Math.floor(value));
  const out = [rest & 0x7f];
  rest = Math.floor(rest / 128);
  while (rest > 0) {
    out.unshift((rest & 0x7f) | 0x80);
    rest = Math.floor(rest / 128);
  }
  return out;
}

function data7(value: number): number {
  return Math.max(0, Math.min(127, Math.round(value)));
}

function eventBytes(event: MidiEvent): number[] {
  switch (event.kind) {
    case 'name': {
      const text = Array.from(event.text, (ch) => ch.charCodeAt(0) & 0xff);
      return [0xff, 0x03, ...vlqBytes(text.length), ...text];
    }
    case 'tempo': {
      const t = Math.max(1, Math.min(0xffffff, Math.round(event.microsPerQuarter)));
      return [0xff, 0x51, 0x03, (t >> 16) & 0xff, (t >> 8) & 0xff, t & 0xff];
    }
    case 'timeSignature':
      return [0xff, 0x58, 0x04, event.numerator, Math.round(Math.log2(event.denominator)), 24, 8];
    case 'program':
      return [0xc0 | (event.channel & 0x0f), data7(event.program)];
    case 'controller':
      return [0xb0 | (event.channel & 0x0f), data7(event.controller), data7(event.value)];
    case 'noteOn':
      return [0x90 | (event.channel & 0x0f), data7(event.pitch), data7(event.velocity)];
    case 'noteOff':
      return [0x80 | (event.channel & 0x0f), data7(event.pitch), 0];
  }
}

function trackBytes(events: readonly MidiEvent[], lengthTicks: number): number[] {
  const sorted = events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.tick - b.event.tick || order(a.event) - order(b.event) || a.index - b.index);
  const body: number[] = [];
  let last = 0;
  for (const { event } of sorted) {
    const tick = Math.max(last, Math.round(event.tick));
    body.push(...vlqBytes(tick - last), ...eventBytes(event));
    last = tick;
  }
  body.push(...vlqBytes(Math.max(0, Math.round(lengthTicks) - last)), 0xff, 0x2f, 0x00);
  return body;
}

function u32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function u16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

/** The bytes of a MIDI file. */
export function encodeMidi(midi: MidiOut): Uint8Array {
  const out: number[] = [0x4d, 0x54, 0x68, 0x64, ...u32(6), ...u16(midi.format), ...u16(midi.tracks.length), ...u16(midi.ticksPerQuarter)];
  for (const track of midi.tracks) {
    const body = trackBytes(track, midi.lengthTicks ?? 0);
    out.push(0x4d, 0x54, 0x72, 0x6b, ...u32(body.length));
    // A loop, not a spread: a long track has hundreds of thousands of bytes, too many for one call.
    for (const b of body) out.push(b);
  }
  return Uint8Array.from(out);
}
