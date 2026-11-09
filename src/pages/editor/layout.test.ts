import { describe, expect, it } from 'vitest';
import { bigRowStep, drumsLayout, keysLayout, rowHeight, stringsLayout } from './layout';

describe('the drums rows', () => {
  const layout = drumsLayout();

  it('are crash at the top down to kick at the bottom', () => {
    expect(layout.rows.map((r) => r.label)).toEqual(['Crash', 'Open hi-hat', 'Hi-hat', 'Snare', 'Kick']);
  });

  it('map a hit to its row and back, with no length', () => {
    expect(layout.rowOf({ row: 'kick', start: 0 })).toBe(4);
    expect(layout.noteOn(0, 12, 99)).toEqual({ row: 'crash', start: 12 });
    expect(layout.noteOn(5, 0, 0)).toBeNull();
    expect(layout.soundOf({ row: 'snare', start: 0 })).toEqual({ kind: 'drum', row: 'snare' });
  });
});

describe('the string rows', () => {
  it('run string by string, lowest first, the open string then the frets', () => {
    const bass = stringsLayout('bass', 5);
    expect(bass.rows).toHaveLength(4 * 6);
    expect(bass.rows.slice(0, 7).map((r) => r.label)).toEqual(['E1', '1', '2', '3', '4', '5', 'A1']);
    expect(bass.rows[0]).toMatchObject({ tinted: true, divider: false, strong: true });
    expect(bass.rows[6]).toMatchObject({ tinted: true, divider: true });
    expect(bass.rows[1]).toMatchObject({ tinted: false, divider: false, strong: false });
    expect(stringsLayout('rhythm', 12).rows).toHaveLength(6 * 13);
  });

  it('map a note to its row and back, and hide a note above the fret count', () => {
    const lead = stringsLayout('lead', 7);
    const note = { string: 2, fret: 3, start: 6, length: 6 };
    expect(lead.rowOf(note)).toBe(2 * 8 + 3);
    expect(lead.noteOn(19, 6, 6)).toEqual(note);
    expect(lead.rowOf({ string: 0, fret: 9, start: 0, length: 3 })).toBeNull();
    expect(lead.noteOn(48, 0, 3)).toBeNull();
    expect(lead.soundOf(note)).toEqual({ kind: 'pitch', pitch: 50 + 3 });
    expect(lead.textOf(note)).toBe('3');
  });

  it('moves a whole string with Shift and an arrow key', () => {
    expect(bigRowStep(stringsLayout('rhythm', 7))).toBe(8);
    expect(bigRowStep(stringsLayout('bass', 12))).toBe(13);
  });
});

describe('the key rows', () => {
  const layout = keysLayout();

  it('are C6 down to C2, with the Cs labelled and a line above each octave but the top one', () => {
    expect(layout.rows).toHaveLength(49);
    expect(layout.rows[0]).toMatchObject({ label: 'C6', divider: false });
    expect(layout.rows[12]).toMatchObject({ label: 'C5', divider: true, strong: true });
    expect(layout.rows[1]).toMatchObject({ label: '', tinted: false });
    expect(layout.rows[2]).toMatchObject({ tinted: true });
  });

  it('map a note to its row and back', () => {
    expect(layout.rowOf({ pitch: 60, start: 0, length: 12 })).toBe(24);
    expect(layout.noteOn(24, 0, 12)).toEqual({ pitch: 60, start: 0, length: 12 });
    expect(layout.rowOf({ pitch: 30, start: 0, length: 12 })).toBeNull();
    expect(bigRowStep(layout)).toBe(12);
  });
});

describe('row heights', () => {
  it('share the room, kept between the limits', () => {
    const keys = keysLayout();
    expect(rowHeight(keys, 49 * 20)).toBe(20);
    expect(rowHeight(keys, 400)).toBe(16);
    expect(rowHeight(keys, 5000)).toBe(24);
    expect(rowHeight(drumsLayout(), 430)).toBe(72);
    expect(rowHeight(drumsLayout(), 300)).toBe(60);
    expect(rowHeight(drumsLayout(), 0)).toBe(28);
  });
});
