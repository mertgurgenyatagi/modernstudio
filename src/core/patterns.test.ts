import { describe, expect, it } from 'vitest';
import { addNote, addNotes, copyNotes, noteKey, pitchOf, removeNote, removeNotes, replaceNote, replaceNotes, setPatternBars } from './patterns';
import { createProject, isActive, setFretCount, type Note } from './project';
import { placeBlock } from './song';
import { must } from './testing';

describe('placing notes', () => {
  it('makes a pattern active with its first note', () => {
    const p = createProject();
    expect(isActive(p.instruments.drums.patterns[0]!)).toBe(false);
    const next = must(addNote(p, 'drums', 0, { row: 'snare', start: 12 }));
    expect(isActive(next.instruments.drums.patterns[0]!)).toBe(true);
    expect(p.instruments.drums.patterns[0]?.notes).toHaveLength(0);
  });

  it('puts drum hits on five rows with no length', () => {
    const p = createProject();
    expect(addNote(p, 'drums', 0, { row: 'crash', start: 0 }).ok).toBe(true);
    expect(addNote(p, 'drums', 0, { row: 'ride' as never, start: 0 }).ok).toBe(false);
    expect(addNote(p, 'drums', 0, { row: 'kick', start: 0, length: 12 } as Note).ok).toBe(false);
    expect(addNote(p, 'drums', 0, { pitch: 60, start: 0, length: 12 }).ok).toBe(false);
  });

  it('allows every start on the grid, and none off it', () => {
    const p = createProject();
    for (const start of [0, 2, 3, 4, 6, 8, 9, 10, 12, 45]) {
      expect(addNote(p, 'drums', 0, { row: 'kick', start }).ok).toBe(true);
    }
    for (const start of [1, 5, 7, 11, 13, 47]) {
      expect(addNote(p, 'drums', 0, { row: 'kick', start }).ok).toBe(false);
    }
  });

  it('keeps notes inside the visible pattern', () => {
    const p = createProject();
    expect(addNote(p, 'drums', 0, { row: 'kick', start: 48 }).ok).toBe(false);
    expect(addNote(p, 'drums', 0, { row: 'kick', start: -3 }).ok).toBe(false);
    expect(addNote(p, 'keys', 0, { pitch: 60, start: 36, length: 24 }).ok).toBe(false);
    expect(addNote(p, 'keys', 0, { pitch: 60, start: 36, length: 12 }).ok).toBe(true);
    const longer = must(setPatternBars(p, 'drums', 0, 2));
    expect(addNote(longer, 'drums', 0, { row: 'kick', start: 48 }).ok).toBe(true);
  });

  it('measures the bar by the meter', () => {
    const three = { ...createProject(), meter: '3/4' as const };
    expect(addNote(three, 'drums', 0, { row: 'kick', start: 36 }).ok).toBe(false);
    expect(addNote(three, 'drums', 0, { row: 'kick', start: 33 }).ok).toBe(true);
  });

  it('requires a length of at least half of a third, ending on the grid', () => {
    const p = createProject();
    expect(addNote(p, 'keys', 0, { pitch: 60, start: 0, length: 2 }).ok).toBe(true);
    expect(addNote(p, 'keys', 0, { pitch: 60, start: 0, length: 1 }).ok).toBe(false);
    expect(addNote(p, 'keys', 0, { pitch: 60, start: 0, length: 0 }).ok).toBe(false);
    expect(addNote(p, 'keys', 0, { pitch: 60, start: 0, length: 5 }).ok).toBe(false); // ends at 5
    expect(addNote(p, 'keys', 0, { pitch: 60, start: 0, length: 4 }).ok).toBe(true); // a third
  });

  it('keeps Keys notes in C2 to C6', () => {
    const p = createProject();
    expect(addNote(p, 'keys', 0, { pitch: 36, start: 0, length: 12 }).ok).toBe(true);
    expect(addNote(p, 'keys', 0, { pitch: 84, start: 0, length: 12 }).ok).toBe(true);
    expect(addNote(p, 'keys', 0, { pitch: 35, start: 0, length: 12 }).ok).toBe(false);
    expect(addNote(p, 'keys', 0, { pitch: 85, start: 0, length: 12 }).ok).toBe(false);
  });

  it('puts string notes on a string that exists and a fret that is shown', () => {
    const p = createProject(); // 7 frets
    expect(addNote(p, 'bass', 0, { string: 3, fret: 7, start: 0, length: 12 }).ok).toBe(true);
    expect(addNote(p, 'bass', 0, { string: 4, fret: 0, start: 0, length: 12 }).ok).toBe(false);
    expect(addNote(p, 'rhythm', 0, { string: 5, fret: 0, start: 0, length: 12 }).ok).toBe(true);
    expect(addNote(p, 'rhythm', 0, { string: -1, fret: 0, start: 0, length: 12 }).ok).toBe(false);
    expect(addNote(p, 'rhythm', 0, { string: 0, fret: 8, start: 0, length: 12 }).ok).toBe(false);
    expect(addNote(setFretCount(p, 'rhythm', 12), 'rhythm', 0, { string: 0, fret: 12, start: 0, length: 12 }).ok).toBe(true);
    expect(addNote(p, 'rhythm', 0, { row: 'kick', start: 0 }).ok).toBe(false);
  });

  it('allows chords, also two notes on one string, and refuses only an exact duplicate', () => {
    let p = createProject();
    p = must(addNote(p, 'rhythm', 0, { string: 0, fret: 0, start: 0, length: 12 }));
    p = must(addNote(p, 'rhythm', 0, { string: 1, fret: 2, start: 0, length: 12 }));
    p = must(addNote(p, 'rhythm', 0, { string: 0, fret: 3, start: 0, length: 12 }));
    expect(p.instruments.rhythm.patterns[0]?.notes).toHaveLength(3);
    const again = addNote(p, 'rhythm', 0, { string: 0, fret: 3, start: 0, length: 6 });
    expect(again.ok).toBe(false);
  });

  it('refuses a pattern that is not shown', () => {
    expect(addNote(createProject(), 'drums', 20, { row: 'kick', start: 0 }).ok).toBe(false);
    expect(addNote(createProject(), 'drums', -1, { row: 'kick', start: 0 }).ok).toBe(false);
  });

  it('gives each string note the pitch of its open string plus the fret', () => {
    expect(pitchOf('bass', { string: 0, fret: 0, start: 0, length: 12 })).toBe(28);
    expect(pitchOf('rhythm', { string: 4, fret: 3, start: 0, length: 12 })).toBe(62);
    expect(pitchOf('keys', { pitch: 60, start: 0, length: 12 })).toBe(60);
    expect(pitchOf('drums', { row: 'kick', start: 0 })).toBeUndefined();
  });

  it('tells notes apart by what and when', () => {
    expect(noteKey({ row: 'kick', start: 0 })).not.toBe(noteKey({ row: 'snare', start: 0 }));
    expect(noteKey({ pitch: 60, start: 0, length: 12 })).toBe(noteKey({ pitch: 60, start: 0, length: 24 }));
  });
});

describe('editing notes', () => {
  it('removes a note and leaves an empty pattern, which can not be placed afterwards', () => {
    let p = must(addNote(createProject(), 'keys', 0, { pitch: 60, start: 0, length: 12 }));
    p = removeNote(p, 'keys', 0, { pitch: 60, start: 0, length: 12 });
    expect(p.instruments.keys.patterns[0]?.notes).toHaveLength(0);
    expect(isActive(p.instruments.keys.patterns[0]!)).toBe(false);
    expect(placeBlock(p, 'keys', 0, 0).ok).toBe(false);
    expect(removeNote(p, 'keys', 0, { pitch: 60, start: 0, length: 12 })).toBe(p);
  });

  it('drags a note longer or shorter, or moves it', () => {
    let p = must(addNote(createProject(), 'keys', 0, { pitch: 60, start: 0, length: 12 }));
    p = must(replaceNote(p, 'keys', 0, { pitch: 60, start: 0, length: 12 }, { pitch: 60, start: 0, length: 36 }));
    expect(p.instruments.keys.patterns[0]?.notes).toEqual([{ pitch: 60, start: 0, length: 36 }]);
    p = must(replaceNote(p, 'keys', 0, { pitch: 60, start: 0, length: 36 }, { pitch: 64, start: 12, length: 12 }));
    expect(p.instruments.keys.patterns[0]?.notes).toEqual([{ pitch: 64, start: 12, length: 12 }]);
    expect(replaceNote(p, 'keys', 0, { pitch: 64, start: 12, length: 12 }, { pitch: 64, start: 12, length: 40 }).ok).toBe(false);
    expect(replaceNote(p, 'keys', 0, { pitch: 1, start: 0, length: 12 }, { pitch: 64, start: 0, length: 12 }).ok).toBe(false);
  });

  it('refuses to move a note onto another note', () => {
    let p = must(addNote(createProject(), 'drums', 0, { row: 'kick', start: 0 }));
    p = must(addNote(p, 'drums', 0, { row: 'kick', start: 12 }));
    expect(replaceNote(p, 'drums', 0, { row: 'kick', start: 0 }, { row: 'kick', start: 12 }).ok).toBe(false);
  });
});

describe('pattern length', () => {
  it('can be 1x, 2x, 4x or 8x, and changed after notes are placed', () => {
    let p = must(addNote(createProject(), 'drums', 0, { row: 'kick', start: 0 }));
    for (const bars of [2, 4, 8, 1] as const) {
      p = must(setPatternBars(p, 'drums', 0, bars));
      expect(p.instruments.drums.patterns[0]?.bars).toBe(bars);
    }
    expect(p.instruments.drums.patterns[0]?.notes).toHaveLength(1);
  });

  it('keeps notes outside a shortened pattern, and brings them back when it is lengthened', () => {
    let p = must(setPatternBars(createProject(), 'keys', 0, 4));
    p = must(addNote(p, 'keys', 0, { pitch: 60, start: 100, length: 12 }));
    p = must(setPatternBars(p, 'keys', 0, 1));
    expect(p.instruments.keys.patterns[0]?.notes).toEqual([{ pitch: 60, start: 100, length: 12 }]);
    expect(isActive(p.instruments.keys.patterns[0]!)).toBe(true);
    p = must(setPatternBars(p, 'keys', 0, 4));
    expect(p.instruments.keys.patterns[0]?.notes).toEqual([{ pitch: 60, start: 100, length: 12 }]);
  });

  it('refuses a longer pattern that would overlap the next block in the Song', () => {
    let p = must(addNote(createProject(), 'drums', 0, { row: 'kick', start: 0 }));
    p = must(placeBlock(p, 'drums', 0, 0));
    p = must(placeBlock(p, 'drums', 0, 1));
    expect(setPatternBars(p, 'drums', 0, 2).ok).toBe(false);
    p = must(setPatternBars(createProject(), 'drums', 1, 1));
    expect(p.instruments.drums.patterns[1]?.bars).toBe(1);
  });

  it('allows a longer pattern when the lane has room, and a shorter one always', () => {
    let p = must(addNote(createProject(), 'drums', 0, { row: 'kick', start: 0 }));
    p = must(placeBlock(p, 'drums', 0, 0));
    p = must(placeBlock(p, 'drums', 0, 4));
    p = must(setPatternBars(p, 'drums', 0, 4)); // bars 0-3, then the block at 4
    expect(setPatternBars(p, 'drums', 0, 8).ok).toBe(false);
    p = must(setPatternBars(p, 'drums', 0, 1));
    expect(p.instruments.drums.lane).toHaveLength(2);
  });

  it('refuses a longer pattern that would pass bar 256', () => {
    let p = must(addNote(createProject(), 'drums', 0, { row: 'kick', start: 0 }));
    p = must(placeBlock(p, 'drums', 0, 255));
    expect(setPatternBars(p, 'drums', 0, 2).ok).toBe(false);
  });
});

describe('copying notes between patterns', () => {
  function two() {
    let p = createProject();
    p = must(addNote(p, 'drums', 0, { row: 'kick', start: 0 }));
    p = must(addNote(p, 'drums', 0, { row: 'snare', start: 12 }));
    p = must(addNote(p, 'drums', 1, { row: 'crash', start: 24 }));
    return p;
  }

  it('replaces the target notes by default', () => {
    const p = must(copyNotes(two(), 'drums', 0, 1));
    expect(p.instruments.drums.patterns[1]?.notes).toEqual(p.instruments.drums.patterns[0]?.notes);
    expect(p.instruments.drums.patterns[1]?.notes).toHaveLength(2);
  });

  it('can add to the target notes instead, dropping exact duplicates', () => {
    let p = must(copyNotes(two(), 'drums', 0, 1, 'add'));
    expect(p.instruments.drums.patterns[1]?.notes).toHaveLength(3);
    p = must(copyNotes(p, 'drums', 0, 1, 'add'));
    expect(p.instruments.drums.patterns[1]?.notes).toHaveLength(3);
  });

  it('copies into an empty pattern, which makes it active, and leaves the source alone', () => {
    const before = two();
    const p = must(copyNotes(before, 'drums', 0, 2));
    expect(isActive(p.instruments.drums.patterns[2]!)).toBe(true);
    expect(p.instruments.drums.patterns[0]).toBe(before.instruments.drums.patterns[0]);
  });

  it('keeps the target length, and refuses a pattern onto itself or one that does not exist', () => {
    const p = must(setPatternBars(two(), 'drums', 1, 4));
    const copied = must(copyNotes(p, 'drums', 0, 1));
    expect(copied.instruments.drums.patterns[1]?.bars).toBe(4);
    expect(copyNotes(p, 'drums', 0, 0).ok).toBe(false);
    expect(copyNotes(p, 'drums', 0, 30).ok).toBe(false);
  });
});

describe('several notes at once', () => {
  const chord: Note[] = [
    { pitch: 60, start: 0, length: 12 },
    { pitch: 64, start: 0, length: 12 },
    { pitch: 67, start: 0, length: 12 },
  ];

  it('adds a group as one edit, skipping notes that are already there', () => {
    const p = must(addNotes(createProject(), 'keys', 0, chord));
    expect(p.instruments.keys.patterns[0]?.notes).toEqual(chord);
    expect(must(addNotes(p, 'keys', 0, chord))).toBe(p);
    const more = must(addNotes(p, 'keys', 0, [chord[0]!, { pitch: 72, start: 12, length: 12 }]));
    expect(more.instruments.keys.patterns[0]?.notes).toHaveLength(4);
  });

  it('refuses the whole group when one note does not fit', () => {
    const bad = addNotes(createProject(), 'keys', 0, [chord[0]!, { pitch: 60, start: 48, length: 12 }]);
    expect(bad).toEqual({ ok: false, reason: 'A note must start inside the pattern.' });
  });

  it('removes a group', () => {
    const p = must(addNotes(createProject(), 'keys', 0, chord));
    expect(removeNotes(p, 'keys', 0, chord.slice(0, 2)).instruments.keys.patterns[0]?.notes).toEqual([chord[2]]);
    expect(removeNotes(p, 'keys', 0, [{ pitch: 50, start: 0, length: 12 }])).toBe(p);
  });

  it('moves a group in time and pitch, the notes passing over each other', () => {
    const p = must(addNotes(createProject(), 'keys', 0, chord));
    const up = chord.map((n) => ({ ...n, pitch: (n as { pitch: number }).pitch + 4, start: 12 }));
    expect(must(replaceNotes(p, 'keys', 0, chord, up)).instruments.keys.patterns[0]?.notes).toEqual(up);
    // 60 64 67 up a third: 64 lands where 64 was, which is moving too.
    const third = chord.map((n) => ({ ...n, pitch: (n as { pitch: number }).pitch + 4 }));
    expect(replaceNotes(p, 'keys', 0, chord, third).ok).toBe(true);
  });

  it('refuses a move onto a note that stays, or past the end, and changes nothing when nothing moves', () => {
    const p = must(addNotes(createProject(), 'keys', 0, chord));
    const onto = replaceNotes(p, 'keys', 0, [chord[0]!], [{ pitch: 64, start: 0, length: 12 }]);
    expect(onto).toEqual({ ok: false, reason: 'A note is already there.' });
    expect(replaceNotes(p, 'keys', 0, [chord[0]!], [{ pitch: 60, start: 40, length: 12 }]).ok).toBe(false);
    expect(must(replaceNotes(p, 'keys', 0, chord, chord))).toBe(p);
    expect(replaceNotes(p, 'keys', 0, [{ pitch: 50, start: 0, length: 12 }], [{ pitch: 51, start: 0, length: 12 }]).ok).toBe(false);
  });

  it('lengthens a group', () => {
    const p = must(addNotes(createProject(), 'keys', 0, chord));
    const long = chord.map((n) => ({ ...n, length: 24 }));
    expect(must(replaceNotes(p, 'keys', 0, chord, long)).instruments.keys.patterns[0]?.notes).toEqual(long);
  });
});
