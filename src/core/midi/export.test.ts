import { describe, expect, it } from 'vitest';
import { addNote } from '../patterns';
import { createProject, setBpm, setFretCount, setMasterVolume, setMeter, setVolume, type Project } from '../project';
import { placeBlock } from '../song';
import { must } from '../testing';
import {
  DRUM_HIT_TICKS,
  EMPTY_SONG_REASON,
  EXPORT_CHANNEL,
  EXPORT_PROGRAM,
  channelVolume,
  ensureMidiExtension,
  exportMidi,
  midiFileName,
} from './export';
import { readMidi, type MidiFile } from './read';

function exported(project: Project): MidiFile {
  const made = exportMidi(project);
  if (!made.ok) throw new Error(made.reason);
  const read = readMidi(made.bytes);
  if (!read.ok) throw new Error(read.reason);
  return read.file;
}

/** A song with something on every instrument: a bar of drums, a bass line, a guitar chord, keys. */
function songProject(): Project {
  let p = createProject();
  p = must(addNote(p, 'drums', 0, { row: 'kick', start: 0 }));
  p = must(addNote(p, 'drums', 0, { row: 'snare', start: 12 }));
  p = must(addNote(p, 'drums', 0, { row: 'hihat', start: 12 }));
  p = must(addNote(p, 'bass', 0, { string: 0, fret: 3, start: 0, length: 24 }));
  p = must(addNote(p, 'rhythm', 0, { string: 1, fret: 2, start: 6, length: 12 }));
  p = must(addNote(p, 'lead', 0, { string: 5, fret: 0, start: 0, length: 12 }));
  p = must(addNote(p, 'keys', 0, { pitch: 60, start: 24, length: 12 }));
  for (const id of ['drums', 'bass', 'rhythm', 'lead', 'keys'] as const) p = must(placeBlock(p, id, 0, 1));
  return p;
}

describe('exporting the Song', () => {
  it('says there is nothing to export when no lane has a block', () => {
    const p = must(addNote(createProject(), 'drums', 0, { row: 'kick', start: 0 }));
    expect(exportMidi(p)).toEqual({ ok: false, reason: EMPTY_SONG_REASON });
    expect(exportMidi(createProject()).ok).toBe(false);
  });

  it('writes format 1 at 480 ticks per quarter: a conductor track and five named instrument tracks', () => {
    const midi = exported(songProject());
    expect(midi.format).toBe(1);
    expect(midi.ticksPerQuarter).toBe(480);
    expect(midi.tracks.map((t) => t.name)).toEqual(['modernstudio', 'Drums', 'Bass', 'Rhythm Guitar', 'Lead Guitar', 'Keys']);
  });

  it('writes the BPM and the meter', () => {
    let p = setBpm(songProject(), 93);
    let midi = exported(p);
    expect(midi.tempos).toEqual([{ tick: 0, microsPerQuarter: Math.round(60_000_000 / 93) }]);
    expect(midi.timeSignatures).toEqual([{ tick: 0, numerator: 4, denominator: 4 }]);
    p = setMeter(p, '3/4');
    midi = exported(p);
    expect(midi.timeSignatures).toEqual([{ tick: 0, numerator: 3, denominator: 4 }]);
  });

  it('gives each instrument its channel and program change', () => {
    const midi = exported(songProject());
    const ids = ['drums', 'bass', 'rhythm', 'lead', 'keys'] as const;
    ids.forEach((id, i) => {
      const track = midi.tracks[i + 1];
      expect(track?.programs).toEqual([{ tick: 0, channel: EXPORT_CHANNEL[id], program: EXPORT_PROGRAM[id] }]);
      for (const note of track?.notes ?? []) expect(note.channel).toBe(EXPORT_CHANNEL[id]);
    });
    // The values of docs/sound.md: Bass 33 on channel 1, guitars 26 on 2 and 3, Keys 54 on 4, Drums on 10.
    expect(EXPORT_CHANNEL).toEqual({ drums: 9, bass: 0, rhythm: 1, lead: 2, keys: 3 });
    expect(EXPORT_PROGRAM).toEqual({ drums: 0, bass: 33, rhythm: 26, lead: 26, keys: 54 });
  });

  it('writes pitches, positions and lengths of the Song, starting at bar 2 where the blocks were placed', () => {
    const midi = exported(songProject());
    const bar = 4 * 480;
    const [, drums, bass, rhythm, lead, keys] = midi.tracks;
    // Bass E1 string 0 fret 3 is G1 = 31. Start tick 0 of bar 2, 24 app ticks = 2 quarters.
    expect(bass?.notes).toEqual([{ start: bar, end: bar + 960, pitch: 31, channel: 0, velocity: 100 }]);
    // Rhythm string 1 (A2 = 45) fret 2 = B2 = 47, from app tick 6 (240 file ticks), 12 ticks = a quarter note.
    expect(rhythm?.notes).toEqual([{ start: bar + 240, end: bar + 240 + 480, pitch: 47, channel: 1, velocity: 100 }]);
    // Lead string 5 (E4 = 64) open.
    expect(lead?.notes).toEqual([{ start: bar, end: bar + 480, pitch: 64, channel: 2, velocity: 100 }]);
    expect(keys?.notes).toEqual([{ start: bar + 960, end: bar + 1440, pitch: 60, channel: 3, velocity: 100 }]);
    // Drums: kick 36 at the start, snare 38 and hi-hat 42 on the second beat, each a 16th long.
    expect(drums?.notes.map((n) => [n.start - bar, n.end - bar, n.pitch])).toEqual([
      [0, DRUM_HIT_TICKS, 36],
      [480, 480 + DRUM_HIT_TICKS, 38],
      [480, 480 + DRUM_HIT_TICKS, 42],
    ]);
  });

  it('writes the song from its first bar to the end of its last block, so the end is the end of the Song', () => {
    const midi = exported(songProject());
    // Two bars: one empty, one with the pattern.
    expect(midi.endTick).toBe(2 * 4 * 480);
  });

  it('cuts a drum hit that would run past the end of the Song', () => {
    let p = must(addNote(createProject(), 'drums', 0, { row: 'crash', start: 46 })); // the last grid position of a 4/4 bar (a half of a third before the end)
    p = must(placeBlock(p, 'drums', 0, 0));
    const hit = exported(p).tracks[1]?.notes[0];
    expect(hit?.pitch).toBe(49);
    expect(hit?.start).toBe(46 * 40);
    expect(hit?.end).toBe(4 * 480);
  });

  it('ends a drum hit where the next hit of the same row begins when they are closer than a 16th', () => {
    let p = createProject();
    p = must(addNote(p, 'drums', 0, { row: 'hihat', start: 0 }));
    p = must(addNote(p, 'drums', 0, { row: 'hihat', start: 2 })); // half of a third later: 80 file ticks
    p = must(placeBlock(p, 'drums', 0, 0));
    const notes = exported(p).tracks[1]?.notes ?? [];
    expect(notes.map((n) => [n.start, n.end])).toEqual([
      [0, 80],
      [80, 80 + DRUM_HIT_TICKS],
    ]);
  });

  it('does not write notes hidden by a lowered fret count, or beyond a shortened pattern', () => {
    let p = setFretCount(createProject(), 'bass', 12);
    p = must(addNote(p, 'bass', 0, { string: 0, fret: 9, start: 0, length: 12 }));
    p = must(addNote(p, 'bass', 0, { string: 1, fret: 1, start: 0, length: 12 }));
    p = must(placeBlock(p, 'bass', 0, 0));
    p = setFretCount(p, 'bass', 5);
    const notes = exported(p).tracks[2]?.notes ?? [];
    expect(notes.map((n) => n.pitch)).toEqual([34]);
  });

  it('ignores mute and the metronome: a muted instrument is still written', () => {
    const p = songProject();
    const muted = { ...p, instruments: { ...p.instruments, keys: { ...p.instruments.keys, muted: true } } };
    expect(exported(muted).tracks[5]?.notes).toHaveLength(1);
  });

  it('writes channel volume (controller 7) from the instrument volume and the master volume', () => {
    expect(channelVolume(100, 100)).toBe(127);
    expect(channelVolume(0, 100)).toBe(0);
    expect(channelVolume(50, 100)).toBe(64);
    expect(channelVolume(50, 50)).toBe(32);
    expect(channelVolume(500, -4)).toBe(0);
    let p = songProject();
    p = setMasterVolume(p, 50);
    p = setVolume(p, 'bass', 80);
    const made = exportMidi(p);
    if (!made.ok) throw new Error(made.reason);
    // Controller 7 for Bass: 0xB0, 7, round(0.8 * 0.5 * 127) = 51. Find it in the bytes.
    const bytes = Array.from(made.bytes);
    const found = bytes.some((b, i) => b === 0xb0 && bytes[i + 1] === 7 && bytes[i + 2] === 51);
    expect(found).toBe(true);
  });

  it('keeps notes of the same pitch on one channel from overlapping, so a read-back pairs them correctly', () => {
    let p = createProject();
    p = must(addNote(p, 'keys', 0, { pitch: 60, start: 0, length: 36 }));
    p = must(addNote(p, 'keys', 0, { pitch: 60, start: 12, length: 12 }));
    p = must(placeBlock(p, 'keys', 0, 0));
    const notes = exported(p).tracks[5]?.notes ?? [];
    expect(notes.map((n) => [n.start, n.end])).toEqual([
      [0, 480],
      [480, 960],
    ]);
  });

  it('reads back with the same pitches and timing as the Song has', () => {
    // Every note of the Song plan appears once, at 40 file ticks to an app tick.
    const midi = exported(songProject());
    const total = midi.tracks.reduce((sum, t) => sum + t.notes.length, 0);
    expect(total).toBe(3 + 1 + 1 + 1 + 1);
  });
});

describe('file names', () => {
  it('suggests the project name with .mid', () => {
    expect(midiFileName('demo')).toBe('demo.mid');
  });

  it('adds the extension only when the chosen name has neither .mid nor .midi', () => {
    expect(ensureMidiExtension('C:\\songs\\demo')).toBe('C:\\songs\\demo.mid');
    expect(ensureMidiExtension('C:\\songs\\demo.MID')).toBe('C:\\songs\\demo.MID');
    expect(ensureMidiExtension('demo.midi')).toBe('demo.midi');
  });
});
