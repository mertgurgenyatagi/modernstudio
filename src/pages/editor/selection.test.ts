import { describe, expect, it } from 'vitest';
import type { Note } from '../../core/project';
import { drumsLayout, keysLayout, stringsLayout } from './layout';
import { groupRowShift, groupShift, movedGroup, notesInRect, resizedGroup, shownNotes } from './selection';

const keys = keysLayout();

describe('what the editor shows', () => {
  it('leaves out notes past the end or with no row, and cuts a long note at the end', () => {
    const notes: Note[] = [
      { pitch: 60, start: 0, length: 12 },
      { pitch: 60, start: 36, length: 24 },
      { pitch: 60, start: 48, length: 12 },
      { pitch: 20, start: 0, length: 12 },
    ];
    const shown = shownNotes(notes, keys, 48, 'sixteenth');
    expect(shown.map((s) => [s.start, s.width])).toEqual([
      [0, 12],
      [36, 12],
    ]);
  });

  it('draws a drum hit one step of the chosen value wide', () => {
    const shown = shownNotes([{ row: 'kick', start: 12 }], drumsLayout(), 48, 'quarter');
    expect(shown[0]).toMatchObject({ row: 4, start: 12, width: 12 });
  });
});

describe('the selection rectangle', () => {
  const shown = shownNotes(
    [
      { pitch: 60, start: 0, length: 12 }, // row 24
      { pitch: 62, start: 12, length: 6 }, // row 22
      { pitch: 72, start: 24, length: 12 }, // row 12
    ],
    keys,
    48,
    'sixteenth',
  );

  it('takes every note it touches, drawn either way', () => {
    expect(notesInRect(shown, { from: 6, to: 14, top: 22, bottom: 24 }).map((s) => s.start)).toEqual([0, 12]);
    expect(notesInRect(shown, { from: 14, to: 6, top: 24, bottom: 22 }).map((s) => s.start)).toEqual([0, 12]);
    expect(notesInRect(shown, { from: 0, to: 48, top: 0, bottom: 13 }).map((s) => s.start)).toEqual([24]);
    expect(notesInRect(shown, { from: 12, to: 12, top: 24, bottom: 24 })).toEqual([]);
  });
});

describe('moving a group', () => {
  const group: Note[] = [
    { pitch: 60, start: 0, length: 12 },
    { pitch: 64, start: 12, length: 12 },
  ];

  it('snaps the held note to the note value and moves the rest the same way', () => {
    expect(groupShift(group, group[0]!, 13, 'quarter', 48)).toBe(12);
    expect(groupShift(group, group[0]!, 4, 'sixteenth', 48)).toBe(3);
  });

  it('stops at either end of the pattern', () => {
    expect(groupShift(group, group[0]!, -30, 'quarter', 48)).toBe(0);
    expect(groupShift(group, group[0]!, 40, 'quarter', 48)).toBe(24);
    expect(groupShift(group, group[1]!, 47, 'sixteenth', 48)).toBe(24);
  });

  it('keeps every note on the grid when the notes sit on different grids', () => {
    // A third (4) and a 16th (3): moving by a 16th would put the third note on 7, off the grid.
    const mixed: Note[] = [
      { pitch: 60, start: 3, length: 3 },
      { pitch: 62, start: 4, length: 2 },
    ];
    const shift = groupShift(mixed, mixed[0]!, 6, 'sixteenth', 48);
    expect(shift).not.toBe(3);
    for (const n of mixed) expect([0, 2, 3, 4, 6, 8, 9, 10]).toContain((n.start + shift) % 12);
  });

  it('moves across rows, held back at the top and the bottom', () => {
    expect(groupRowShift([3, 10], -5, 49)).toBe(-3);
    expect(groupRowShift([3, 10], 50, 49)).toBe(38);
    expect(groupRowShift([3, 10], 2.4, 49)).toBe(2);
  });

  it('rebuilds each note on its new row: a string note can move to the next string', () => {
    const rhythm = stringsLayout('rhythm', 7);
    const shown = shownNotes([{ string: 0, fret: 7, start: 0, length: 3 }], rhythm, 48, 'sixteenth');
    expect(movedGroup(shown, rhythm, 3, 1)).toEqual([{ string: 1, fret: 0, start: 3, length: 3 }]);
    expect(movedGroup(shown, rhythm, 0, 100)).toBeNull();
    const drums = drumsLayout();
    const hits = shownNotes([{ row: 'snare', start: 0 }], drums, 48, 'sixteenth');
    expect(movedGroup(hits, drums, 12, 1)).toEqual([{ row: 'kick', start: 12 }]);
  });
});

describe('resizing a group', () => {
  it('drags every right edge by the same amount, each kept inside the pattern', () => {
    const group: Note[] = [
      { pitch: 60, start: 0, length: 12 },
      { pitch: 64, start: 36, length: 12 },
      { row: 'kick', start: 0 },
    ];
    expect(resizedGroup(group, 12, 'quarter', 48)).toEqual([
      { pitch: 60, start: 0, length: 24 },
      { pitch: 64, start: 36, length: 12 },
      { row: 'kick', start: 0 },
    ]);
  });
});
