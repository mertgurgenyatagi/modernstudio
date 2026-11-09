import { describe, expect, it } from 'vitest';
import { addNote } from '../core/patterns';
import { createProject, type Note } from '../core/project';
import { placeBlock } from '../core/song';
import { must } from '../core/testing';
import {
  afterBlockPaste,
  afterNotePaste,
  blocksStartingAt,
  canPasteNotes,
  copyBlocksToClipboard,
  copyNotesToClipboard,
  noteSpan,
  pasteShift,
  shiftNotes,
  spanUnit,
} from './clipboard';

describe('copied notes', () => {
  const phrase: Note[] = [
    { pitch: 60, start: 0, length: 3 },
    { pitch: 62, start: 3, length: 3 },
    { pitch: 64, start: 6, length: 3 },
  ];

  it('reach from the first start to the last end, rounded up to a beat or a longer note value', () => {
    expect(noteSpan(phrase, 3, spanUnit(3))).toBe(12);
    expect(noteSpan([{ pitch: 60, start: 0, length: 48 }], 3, spanUnit(3))).toBe(48);
    expect(noteSpan([{ pitch: 60, start: 0, length: 18 }], 24, spanUnit(24))).toBe(24);
    expect(noteSpan([], 3, 12)).toBe(0);
    // A drum hit counts as one step of the chosen value.
    expect(noteSpan([{ row: 'kick', start: 0 }, { row: 'kick', start: 9 }], 3, 12)).toBe(12);
    expect(noteSpan([{ row: 'kick', start: 0 }, { row: 'kick', start: 12 }], 3, 12)).toBe(24);
  });

  it('paste right after themselves in their own pattern, and in place in another, then end to end', () => {
    let clip = copyNotesToClipboard('keys', 0, phrase, 3);
    expect(clip.span).toBe(12);
    expect(pasteShift(clip, 0)).toBe(12);
    expect(pasteShift(clip, 5)).toBe(0);
    clip = afterNotePaste(clip, 0, 12);
    expect(pasteShift(clip, 0)).toBe(24);
    clip = afterNotePaste(clip, 5, 0);
    expect(pasteShift(clip, 5)).toBe(12);
    // Back in the pattern they came from, a paste goes right after the copied notes again.
    expect(pasteShift(clip, 0)).toBe(12);
  });

  it('leave out notes that would fall outside the pattern', () => {
    expect(shiftNotes(phrase, 12, 48)).toEqual({
      notes: phrase.map((n) => ({ ...n, start: n.start + 12 })),
      dropped: 0,
    });
    const late = shiftNotes(phrase, 44, 48);
    expect(late.notes).toEqual([{ pitch: 60, start: 44, length: 3 }]);
    expect(late.dropped).toBe(2);
    expect(shiftNotes([{ row: 'kick', start: 36 }], 12, 48)).toEqual({ notes: [], dropped: 1 });
    expect(shiftNotes([{ row: 'kick', start: 35 }], 12, 48).dropped).toBe(0);
  });

  it('go to the same instrument, and between the two guitars', () => {
    expect(canPasteNotes('keys', 'keys')).toBe(true);
    expect(canPasteNotes('rhythm', 'lead')).toBe(true);
    expect(canPasteNotes('lead', 'rhythm')).toBe(true);
    expect(canPasteNotes('bass', 'rhythm')).toBe(false);
    expect(canPasteNotes('drums', 'keys')).toBe(false);
  });
});

describe('copied blocks', () => {
  function song() {
    let p = must(addNote(createProject(), 'drums', 0, { row: 'kick', start: 0 }));
    p = must(addNote(p, 'keys', 0, { pitch: 60, start: 0, length: 12 }));
    p = must(placeBlock(p, 'drums', 0, 2));
    p = must(placeBlock(p, 'keys', 0, 3));
    return p;
  }

  it('paste right after the group, then end to end', () => {
    const p = song();
    let clip = copyBlocksToClipboard(p, [
      { instrument: 'drums', pattern: 0, startBar: 2 },
      { instrument: 'keys', pattern: 0, startBar: 3 },
    ]);
    expect(clip).toMatchObject({ start: 2, span: 2, nextStart: 4 });
    if (!clip) return;
    expect(blocksStartingAt(clip, clip.nextStart)).toEqual([
      { instrument: 'drums', pattern: 0, startBar: 4 },
      { instrument: 'keys', pattern: 0, startBar: 5 },
    ]);
    clip = afterBlockPaste(clip, 4);
    expect(clip.nextStart).toBe(6);
    clip = afterBlockPaste(clip, 20);
    expect(clip.nextStart).toBe(22);
  });

  it('need at least one block', () => {
    expect(copyBlocksToClipboard(song(), [])).toBeNull();
  });
});
