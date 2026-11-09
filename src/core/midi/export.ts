/**
 * MIDI export: the Song flattened into a standard MIDI file, format 1, 480 ticks per quarter note,
 * one conductor track and one track per instrument. It uses the same Song plan as playback, so what
 * is written is what is heard (hidden notes are left out), and like the WAV export it ignores mute and
 * isolate and leaves the metronome out. Strings and frets are not written, only pitches. Pure.
 * See docs/midi-import.md, "Export".
 */
import { INSTRUMENT_IDS, INSTRUMENT_LABELS, type DrumRow, type InstrumentId } from '../instruments';
import { songPlan, type TimelineNote } from '../playback';
import type { Project } from '../project';
import { songBars } from '../song';
import { TICKS_PER_QUARTER, ticksPerBar } from '../time';
import { encodeMidi, type MidiEvent } from './write';

/** Ticks per quarter note in the file. */
export const EXPORT_TICKS_PER_QUARTER = 480;
/** A file tick for each app tick (the app counts twelfths of a quarter note). */
const SCALE = EXPORT_TICKS_PER_QUARTER / TICKS_PER_QUARTER;
/** Every note is written with this velocity. */
export const EXPORT_VELOCITY = 100;
/** A drum hit has no length in the app; it is written as one 16th note (assumed; docs/open-items.md). */
export const DRUM_HIT_TICKS = EXPORT_TICKS_PER_QUARTER / 4;
export const MIDI_EXTENSION = 'mid';

/** The General MIDI drum note of each row. */
export const DRUM_NOTE: Record<DrumRow, number> = { kick: 36, snare: 38, hihat: 42, openHihat: 46, crash: 49 };

/** The channel (0 based; 9 is MIDI channel 10) and the program change value of each instrument ([sound.md](../../../docs/sound.md)). */
export const EXPORT_CHANNEL: Record<InstrumentId, number> = { drums: 9, bass: 0, rhythm: 1, lead: 2, keys: 3 };
export const EXPORT_PROGRAM: Record<InstrumentId, number> = { drums: 0, bass: 33, rhythm: 26, lead: 26, keys: 54 };

export type ExportResult = { ok: true; bytes: Uint8Array } | { ok: false; reason: string };

export const EMPTY_SONG_REASON = 'The Song has no blocks, so there is nothing to export.';

/** Controller 7 (channel volume) from the instrument's volume and the master volume, both 0 to 100: their product on the 0 to 127 scale. */
export function channelVolume(instrumentVolume: number, masterVolume: number): number {
  const level = (Math.max(0, Math.min(100, instrumentVolume)) / 100) * (Math.max(0, Math.min(100, masterVolume)) / 100);
  return Math.round(level * 127);
}

/** The suggested file name for the Save dialog: the project's name with the MIDI extension. */
export function midiFileName(projectName: string): string {
  return `${projectName}.${MIDI_EXTENSION}`;
}

/** Adds the .mid extension when the chosen name has neither .mid nor .midi. */
export function ensureMidiExtension(path: string): string {
  const lower = path.toLowerCase();
  return lower.endsWith('.mid') || lower.endsWith('.midi') ? path : `${path}.${MIDI_EXTENSION}`;
}

interface Span {
  start: number;
  end: number;
  pitch: number;
}

/**
 * The notes of one instrument as spans of file ticks. A note ends where the next note of the same
 * pitch begins if it would run into it, and two notes of one pitch starting together become one (the
 * longer), so every note-off matches the note-on it belongs to when the file is read back.
 */
function spansOf(notes: readonly TimelineNote[], isDrums: boolean, endTick: number): Span[] {
  const byPitch = new Map<number, Span[]>();
  for (const note of notes) {
    const pitch = note.sound.kind === 'drum' ? DRUM_NOTE[note.sound.row] : note.sound.pitch;
    const start = note.tick * SCALE;
    const length = isDrums ? DRUM_HIT_TICKS : note.lengthTicks * SCALE;
    const end = Math.min(endTick, start + Math.max(1, length));
    const list = byPitch.get(pitch);
    const span = { start, end: Math.max(end, start + 1), pitch };
    if (list) list.push(span);
    else byPitch.set(pitch, [span]);
  }
  const out: Span[] = [];
  for (const list of byPitch.values()) {
    list.sort((a, b) => a.start - b.start || b.end - a.end);
    let previous: Span | undefined;
    for (const span of list) {
      if (previous && span.start === previous.start) continue;
      if (previous && previous.end > span.start) previous.end = span.start;
      out.push(span);
      previous = span;
    }
  }
  return out;
}

/** The MIDI file of the Song, or the reason there is nothing to write. */
export function exportMidi(project: Project): ExportResult {
  const bars = songBars(project);
  if (bars <= 0) return { ok: false, reason: EMPTY_SONG_REASON };
  const plan = songPlan(project, 0).loop;
  const endTick = bars * ticksPerBar(project.meter) * SCALE;

  const [numerator, denominator] = project.meter === '3/4' ? [3, 4] : [4, 4];
  const conductor: MidiEvent[] = [
    { tick: 0, kind: 'name', text: 'modernstudio' },
    { tick: 0, kind: 'tempo', microsPerQuarter: 60_000_000 / project.bpm },
    { tick: 0, kind: 'timeSignature', numerator, denominator },
  ];

  const tracks: MidiEvent[][] = [conductor];
  for (const id of INSTRUMENT_IDS) {
    const channel = EXPORT_CHANNEL[id];
    const events: MidiEvent[] = [
      { tick: 0, kind: 'name', text: INSTRUMENT_LABELS[id] },
      { tick: 0, kind: 'program', channel, program: EXPORT_PROGRAM[id] },
      { tick: 0, kind: 'controller', channel, controller: 7, value: channelVolume(project.instruments[id].volume, project.masterVolume) },
    ];
    for (const span of spansOf(
      plan.notes.filter((note) => note.instrument === id),
      id === 'drums',
      endTick,
    )) {
      events.push({ tick: span.start, kind: 'noteOn', channel, pitch: span.pitch, velocity: EXPORT_VELOCITY });
      events.push({ tick: span.end, kind: 'noteOff', channel, pitch: span.pitch });
    }
    tracks.push(events);
  }

  return { ok: true, bytes: encodeMidi({ format: 1, ticksPerQuarter: EXPORT_TICKS_PER_QUARTER, tracks, lengthTicks: endTick }) };
}
