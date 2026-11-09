import { describe, expect, it } from 'vitest';
import { KEYS_RANGE } from '../../core/instruments';
import type { KeysNote } from '../../core/project';
import { KEY_ROWS, hiddenOutOfRange, isBlackKey, keyLabel, keyNotesAt, keyRowIndex, startScrollTop } from './keyRoll';

describe('key rows', () => {
  it('runs from C6 at the top to C2 at the bottom: 49 rows', () => {
    expect(KEY_ROWS).toHaveLength(49);
    expect(KEY_ROWS[0]).toBe(KEYS_RANGE.high);
    expect(KEY_ROWS[KEY_ROWS.length - 1]).toBe(KEYS_RANGE.low);
    expect(KEY_ROWS[0]).toBe(84);
    expect(KEY_ROWS.at(-1)).toBe(36);
  });

  it('maps a pitch to its row and back', () => {
    for (let i = 0; i < KEY_ROWS.length; i++) expect(keyRowIndex(KEY_ROWS[i]!)).toBe(i);
    expect(keyRowIndex(60)).toBe(24);
    expect(keyRowIndex(35)).toBeNull();
    expect(keyRowIndex(85)).toBeNull();
    expect(keyRowIndex(60.5)).toBeNull();
  });

  it('tints the black keys', () => {
    const black = KEY_ROWS.filter(isBlackKey);
    expect(black).toHaveLength(20);
    expect(isBlackKey(61)).toBe(true);
    expect(isBlackKey(60)).toBe(false);
    expect(isBlackKey(70)).toBe(true);
    expect(isBlackKey(71)).toBe(false);
  });
});

describe('row labels', () => {
  it('labels every C and nothing else', () => {
    const labelled = KEY_ROWS.filter((p) => keyLabel(p) !== '');
    expect(labelled.map(keyLabel)).toEqual(['C6', 'C5', 'C4', 'C3', 'C2']);
    expect(keyLabel(60)).toBe('C4');
    expect(keyLabel(61)).toBe('');
    expect(keyLabel(59)).toBe('');
  });
});

describe('notes on screen', () => {
  const notes: KeysNote[] = [
    { pitch: 60, start: 0, length: 12 },
    { pitch: 60, start: 48, length: 12 },
    { pitch: 62, start: 0, length: 12 },
  ];
  it('picks the notes of a pitch that start inside the shown pattern', () => {
    expect(keyNotesAt(notes, 60, 48)).toEqual([notes[0]]);
    expect(keyNotesAt(notes, 60, 96)).toEqual([notes[0], notes[1]]);
    expect(keyNotesAt(notes, 61, 96)).toEqual([]);
  });
  it('counts notes outside the range as hidden', () => {
    expect(hiddenOutOfRange(notes)).toBe(0);
    expect(hiddenOutOfRange([...notes, { pitch: 20, start: 0, length: 12 }, { pitch: 90, start: 0, length: 12 }])).toBe(2);
  });
});

describe('the starting scroll', () => {
  it('centres middle C when the roll is taller than the view', () => {
    const rowPx = 20;
    const top = startScrollTop(rowPx, 200, KEY_ROWS.length);
    // the C4 row occupies 480..500; its middle, 490, sits in the middle of the view (100 below the top)
    expect(top).toBe(390);
    expect(top).toBeLessThanOrEqual(keyRowIndex(60)! * rowPx);
    expect(top + 200).toBeGreaterThanOrEqual((keyRowIndex(60)! + 1) * rowPx);
  });
  it('never scrolls past either end', () => {
    expect(startScrollTop(20, 5000, 49)).toBe(0);
    expect(startScrollTop(20, 200, 49)).toBeLessThanOrEqual(49 * 20 - 200);
  });
  it('is 0 for a view that is not measured yet', () => {
    expect(startScrollTop(0, 200, 49)).toBe(0);
    expect(startScrollTop(20, 0, 49)).toBe(0);
  });
});
