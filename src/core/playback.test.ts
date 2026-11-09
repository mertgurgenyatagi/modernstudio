import { describe, expect, it } from 'vitest';
import { addNote, setPatternBars } from './patterns';
import { metronomeClicks, patternPlan, songPlan } from './playback';
import { createProject, selectPattern, setFretCount, setMeter, type Project } from './project';
import { placeBlock } from './song';
import { must } from './testing';

/** A drum beat (kick on 1, snare on 3 of 4/4), a bass note on the open E string, and a Keys chord. */
function band(): Project {
  let p = createProject();
  p = must(addNote(p, 'drums', 0, { row: 'kick', start: 0 }));
  p = must(addNote(p, 'drums', 0, { row: 'snare', start: 24 }));
  p = must(addNote(p, 'bass', 0, { string: 0, fret: 0, start: 0, length: 12 }));
  p = must(addNote(p, 'keys', 0, { pitch: 60, start: 0, length: 24 }));
  return p;
}

describe('the metronome', () => {
  it('clicks every beat and accents the first of the bar', () => {
    const p = createProject();
    const clicks = metronomeClicks(p, 96);
    expect(clicks.map((c) => c.tick)).toEqual([0, 12, 24, 36, 48, 60, 72, 84]);
    expect(clicks.filter((c) => c.accent).map((c) => c.tick)).toEqual([0, 48]);
  });

  it('counts three beats to the bar in 3/4', () => {
    const p = setMeter(createProject(), '3/4');
    expect(metronomeClicks(p, 72).filter((c) => c.accent).map((c) => c.tick)).toEqual([0, 36]);
  });
});

describe('Pattern mode', () => {
  it('loops the selected pattern of the focused instrument, one bar long', () => {
    const plan = patternPlan(band(), 'drums');
    expect(plan.mode).toBe('pattern');
    expect(plan.first).toBe(plan.loop);
    expect(plan.loop.lengthTicks).toBe(48);
    expect(plan.loop.clicks).toHaveLength(4);
  });

  it('plays the other instruments along, each with its selected pattern', () => {
    const plan = patternPlan(band(), 'drums');
    expect(plan.loop.notes.map((n) => [n.instrument, n.tick])).toEqual([
      ['drums', 0],
      ['bass', 0],
      ['keys', 0],
      ['drums', 24],
    ]);
  });

  it('turns strings and frets into pitches, and gives drum hits no length', () => {
    let p = band();
    p = must(addNote(p, 'rhythm', 0, { string: 2, fret: 5, start: 12, length: 12 })); // D3 + 5 = 55
    const notes = patternPlan(p, 'rhythm').loop.notes;
    expect(notes.find((n) => n.instrument === 'rhythm')?.sound).toEqual({ kind: 'pitch', pitch: 55 });
    expect(notes.find((n) => n.instrument === 'bass')?.sound).toEqual({ kind: 'pitch', pitch: 28 });
    const drum = notes.find((n) => n.sound.kind === 'drum');
    expect(drum?.lengthTicks).toBe(0);
  });

  it('repeats a shorter pattern to fill the loop and cuts a longer one at its end', () => {
    let p = band();
    p = must(setPatternBars(p, 'keys', 0, 2));
    p = must(addNote(p, 'keys', 0, { pitch: 64, start: 60, length: 12 }));
    // Focus on the 2-bar Keys pattern: the 1-bar drum pattern plays twice.
    const longer = patternPlan(p, 'keys').loop;
    expect(longer.lengthTicks).toBe(96);
    expect(longer.notes.filter((n) => n.instrument === 'drums').map((n) => n.tick)).toEqual([0, 24, 48, 72]);
    // Focus on the 1-bar drum pattern: the Keys note in bar 2 is not played.
    const shorter = patternPlan(p, 'drums').loop;
    expect(shorter.notes.filter((n) => n.instrument === 'keys')).toHaveLength(1);
  });

  it('follows the pattern selected for each instrument', () => {
    let p = band();
    p = must(addNote(p, 'drums', 3, { row: 'crash', start: 0 }));
    p = selectPattern(p, 'drums', 3);
    const drums = patternPlan(p, 'bass').loop.notes.filter((n) => n.instrument === 'drums');
    expect(drums.map((n) => n.sound)).toEqual([{ kind: 'drum', row: 'crash' }]);
  });

  it('does not play notes hidden by a shortened pattern or a lowered fret count', () => {
    let p = band();
    p = setFretCount(p, 'bass', 12);
    p = must(setPatternBars(p, 'bass', 0, 2));
    p = must(addNote(p, 'bass', 0, { string: 1, fret: 7, start: 60, length: 12 })); // in bar 2
    p = must(addNote(p, 'bass', 0, { string: 1, fret: 12, start: 12, length: 12 }));
    p = must(setPatternBars(p, 'bass', 0, 1)); // the bar-2 note is now hidden
    p = setFretCount(p, 'bass', 7); // fret 12 is now hidden
    const bass = patternPlan(p, 'bass').loop.notes.filter((n) => n.instrument === 'bass');
    expect(bass.map((n) => n.tick)).toEqual([0]);
  });

  it('cuts a note that runs past the end of the pattern', () => {
    let p = createProject();
    p = must(setPatternBars(p, 'keys', 0, 2));
    p = must(addNote(p, 'keys', 0, { pitch: 60, start: 36, length: 24 })); // ends in bar 2
    p = must(setPatternBars(p, 'keys', 0, 1)); // the note now runs past the end
    const keys = patternPlan(p, 'keys').loop.notes;
    expect(keys).toHaveLength(1);
    expect(keys[0]?.lengthTicks).toBe(12);
  });

  it('plays an empty pattern as a bar of silence', () => {
    const plan = patternPlan(createProject(), 'keys');
    expect(plan.loop.notes).toEqual([]);
    expect(plan.loop.lengthTicks).toBe(48);
  });
});

describe('Song mode', () => {
  function song(): Project {
    let p = band();
    p = must(placeBlock(p, 'drums', 0, 0));
    p = must(placeBlock(p, 'drums', 0, 1));
    p = must(placeBlock(p, 'keys', 0, 2)); // the song ends at bar 3
    return p;
  }

  it('lays out the blocks of every lane, and ends at the last block', () => {
    const plan = songPlan(song());
    expect(plan.mode).toBe('song');
    expect(plan.first).toBe(plan.loop);
    expect(plan.loop.lengthTicks).toBe(3 * 48);
    expect(plan.loop.notes.map((n) => [n.instrument, n.tick])).toEqual([
      ['drums', 0],
      ['drums', 24],
      ['drums', 48],
      ['drums', 72],
      ['keys', 96],
    ]);
    expect(plan.loop.clicks).toHaveLength(12);
  });

  it('starts from the clicked bar, then loops from the beginning', () => {
    const plan = songPlan(song(), 1);
    expect(plan.first.offsetTicks).toBe(48);
    expect(plan.first.lengthTicks).toBe(2 * 48);
    expect(plan.first.notes.map((n) => [n.instrument, n.tick])).toEqual([
      ['drums', 0],
      ['drums', 24],
      ['keys', 48],
    ]);
    expect(plan.loop.lengthTicks).toBe(3 * 48);
    expect(plan.loop.offsetTicks).toBe(0);
  });

  it('leaves gaps silent', () => {
    let p = band();
    p = must(placeBlock(p, 'drums', 0, 0));
    p = must(placeBlock(p, 'drums', 0, 3));
    const ticks = songPlan(p).loop.notes.map((n) => n.tick);
    expect(ticks).toEqual([0, 24, 144, 168]);
    expect(songPlan(p).loop.lengthTicks).toBe(4 * 48);
  });

  it('plays a multi-bar block from the middle without the notes that began before the start bar', () => {
    let p = band();
    p = must(setPatternBars(p, 'keys', 0, 4));
    p = must(addNote(p, 'keys', 0, { pitch: 67, start: 100, length: 12 })); // bar 2 of the pattern
    p = must(placeBlock(p, 'keys', 0, 0));
    const plan = songPlan(p, 2);
    expect(plan.first.notes.map((n) => n.sound)).toEqual([{ kind: 'pitch', pitch: 67 }]);
    expect(plan.first.notes[0]?.tick).toBe(4);
  });

  it('starts from the beginning when the start bar is at or past the end of the song', () => {
    const plan = songPlan(song(), 3);
    expect(plan.first).toBe(plan.loop);
    expect(songPlan(song(), 99).first.offsetTicks).toBe(0);
  });

  it('is a plan of zero length when the song is empty', () => {
    const plan = songPlan(createProject());
    expect(plan.loop.lengthTicks).toBe(0);
    expect(plan.loop.notes).toEqual([]);
  });

  it('follows the meter', () => {
    const p = setMeter(song(), '3/4');
    expect(songPlan(p).loop.lengthTicks).toBe(3 * 36);
  });
});
