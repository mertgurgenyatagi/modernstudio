import { describe, expect, it } from 'vitest';
import { addNote, setPatternBars } from './patterns';
import { createProject, type Project } from './project';
import {
  MAX_SONG_BARS,
  blockAt,
  blocksOf,
  groupSpan,
  laneFits,
  moveBlock,
  moveBlocks,
  placeBlock,
  placeBlocks,
  removeBlock,
  removeBlocks,
  songBars,
} from './song';
import { must } from './testing';

function withPatterns(): Project {
  let p = createProject();
  p = must(addNote(p, 'drums', 0, { row: 'kick', start: 0 }));
  p = must(addNote(p, 'drums', 1, { row: 'snare', start: 0 }));
  p = must(setPatternBars(p, 'drums', 1, 2));
  p = must(addNote(p, 'keys', 0, { pitch: 60, start: 0, length: 12 }));
  return p;
}

describe('placing blocks', () => {
  it('places an active pattern at a bar, any number of times', () => {
    let p = withPatterns();
    p = must(placeBlock(p, 'drums', 0, 0));
    p = must(placeBlock(p, 'drums', 0, 2));
    p = must(placeBlock(p, 'drums', 0, 5));
    expect(p.instruments.drums.lane).toEqual([
      { pattern: 0, startBar: 0 },
      { pattern: 0, startBar: 2 },
      { pattern: 0, startBar: 5 },
    ]);
  });

  it('refuses a pattern with no notes, and one that does not exist', () => {
    const p = withPatterns();
    expect(placeBlock(p, 'drums', 2, 0).ok).toBe(false);
    expect(placeBlock(p, 'drums', 20, 0).ok).toBe(false);
    expect(placeBlock(p, 'drums', -1, 0).ok).toBe(false);
  });

  it('never lets blocks overlap, and measures a block by its pattern length', () => {
    let p = withPatterns();
    p = must(placeBlock(p, 'drums', 1, 4)); // a 2-bar block: bars 4 and 5
    expect(placeBlock(p, 'drums', 0, 4).ok).toBe(false);
    expect(placeBlock(p, 'drums', 0, 5).ok).toBe(false);
    expect(placeBlock(p, 'drums', 1, 3).ok).toBe(false); // would cover bar 4
    expect(placeBlock(p, 'drums', 0, 3).ok).toBe(true);
    expect(placeBlock(p, 'drums', 0, 6).ok).toBe(true);
  });

  it('allows gaps, and keeps each lane apart', () => {
    let p = withPatterns();
    p = must(placeBlock(p, 'drums', 0, 0));
    p = must(placeBlock(p, 'drums', 0, 10));
    p = must(placeBlock(p, 'keys', 0, 0));
    expect(p.instruments.drums.lane).toHaveLength(2);
    expect(p.instruments.keys.lane).toHaveLength(1);
  });

  it('keeps the lane sorted whatever order blocks are placed in', () => {
    let p = withPatterns();
    p = must(placeBlock(p, 'drums', 0, 9));
    p = must(placeBlock(p, 'drums', 0, 1));
    p = must(placeBlock(p, 'drums', 0, 4));
    expect(p.instruments.drums.lane.map((b) => b.startBar)).toEqual([1, 4, 9]);
  });

  it('stops at 256 bars', () => {
    const p = withPatterns();
    expect(placeBlock(p, 'drums', 0, MAX_SONG_BARS - 1).ok).toBe(true);
    expect(placeBlock(p, 'drums', 0, MAX_SONG_BARS).ok).toBe(false);
    expect(placeBlock(p, 'drums', 1, MAX_SONG_BARS - 1).ok).toBe(false); // 2 bars
    expect(placeBlock(p, 'drums', 1, MAX_SONG_BARS - 2).ok).toBe(true);
    expect(placeBlock(p, 'drums', 0, -1).ok).toBe(false);
    expect(placeBlock(p, 'drums', 0, 1.5).ok).toBe(false);
  });
});

describe('moving and removing blocks', () => {
  it('moves a block to a free place, and not onto another block', () => {
    let p = withPatterns();
    p = must(placeBlock(p, 'drums', 0, 0));
    p = must(placeBlock(p, 'drums', 0, 3));
    p = must(moveBlock(p, 'drums', 0, 8));
    expect(p.instruments.drums.lane.map((b) => b.startBar)).toEqual([3, 8]);
    expect(moveBlock(p, 'drums', 8, 3).ok).toBe(false);
    expect(moveBlock(p, 'drums', 5, 6).ok).toBe(false); // no block there
  });

  it('moves a block by less than its own length without colliding with itself', () => {
    let p = withPatterns();
    p = must(placeBlock(p, 'drums', 1, 0)); // 2 bars
    p = must(moveBlock(p, 'drums', 0, 1));
    expect(p.instruments.drums.lane).toEqual([{ pattern: 1, startBar: 1 }]);
  });

  it('removes the block that starts at a bar', () => {
    let p = withPatterns();
    p = must(placeBlock(p, 'drums', 0, 0));
    p = must(placeBlock(p, 'drums', 0, 2));
    p = removeBlock(p, 'drums', 0);
    expect(p.instruments.drums.lane).toEqual([{ pattern: 0, startBar: 2 }]);
    expect(removeBlock(p, 'drums', 7)).toBe(p);
  });

  it('finds the block that covers a bar', () => {
    let p = withPatterns();
    p = must(placeBlock(p, 'drums', 1, 4));
    expect(blockAt(p, 'drums', 5)?.startBar).toBe(4);
    expect(blockAt(p, 'drums', 6)).toBeUndefined();
    expect(blockAt(p, 'drums', 3)).toBeUndefined();
  });
});

describe('song length', () => {
  it('is 0 for empty lanes and ends at the last block on any lane', () => {
    let p = withPatterns();
    expect(songBars(p)).toBe(0);
    p = must(placeBlock(p, 'drums', 0, 0));
    expect(songBars(p)).toBe(1);
    p = must(placeBlock(p, 'keys', 0, 9));
    expect(songBars(p)).toBe(10);
    p = must(placeBlock(p, 'drums', 1, 20)); // 2 bars: bars 20 and 21
    expect(songBars(p)).toBe(22);
  });

  it('follows the pattern when its length changes', () => {
    let p = withPatterns();
    p = must(placeBlock(p, 'drums', 1, 0));
    expect(songBars(p)).toBe(2);
    p = must(setPatternBars(p, 'drums', 1, 8));
    expect(songBars(p)).toBe(8);
  });
});

describe('laneFits', () => {
  it('accepts a clean lane and refuses overlap, a negative start and passing 256', () => {
    expect(laneFits([])).toBe(true);
    expect(laneFits([{ startBar: 0, bars: 2 }, { startBar: 2, bars: 1 }])).toBe(true);
    expect(laneFits([{ startBar: 0, bars: 2 }, { startBar: 1, bars: 1 }])).toBe(false);
    expect(laneFits([{ startBar: -1, bars: 1 }])).toBe(false);
    expect(laneFits([{ startBar: 255, bars: 2 }])).toBe(false);
    expect(laneFits([{ startBar: 254, bars: 2 }])).toBe(true);
  });
});

describe('several blocks at once', () => {
  function laid(): Project {
    let p = withPatterns();
    p = must(placeBlock(p, 'drums', 0, 0)); // bar 1
    p = must(placeBlock(p, 'drums', 1, 1)); // bars 2 and 3
    p = must(placeBlock(p, 'keys', 0, 0));
    return p;
  }

  it('moves a group across lanes by the same number of bars, as one edit', () => {
    const p = must(
      moveBlocks(laid(), [
        { instrument: 'drums', startBar: 0 },
        { instrument: 'drums', startBar: 1 },
        { instrument: 'keys', startBar: 0 },
      ], 4),
    );
    expect(p.instruments.drums.lane).toEqual([
      { pattern: 0, startBar: 4 },
      { pattern: 1, startBar: 5 },
    ]);
    expect(p.instruments.keys.lane).toEqual([{ pattern: 0, startBar: 4 }]);
  });

  it('lets the blocks of a group pass over each other, but not over a block that stays', () => {
    const shifted = must(moveBlocks(laid(), [{ instrument: 'drums', startBar: 0 }, { instrument: 'drums', startBar: 1 }], 1));
    expect(shifted.instruments.drums.lane.map((b) => b.startBar)).toEqual([1, 2]);
    const blocked = moveBlocks(laid(), [{ instrument: 'drums', startBar: 0 }], 1);
    expect(blocked).toEqual({ ok: false, reason: 'Bar 2 is taken in the Drums lane.' });
    expect(moveBlocks(laid(), [{ instrument: 'keys', startBar: 0 }], -1)).toEqual({ ok: false, reason: 'A block cannot start before bar 1.' });
  });

  it('places a group all or nothing, and names the taken bars', () => {
    const p = laid();
    const pasted = placeBlocks(p, [
      { instrument: 'drums', pattern: 1, startBar: 3 },
      { instrument: 'keys', pattern: 0, startBar: 3 },
    ]);
    expect(must(pasted).instruments.drums.lane.map((b) => b.startBar)).toEqual([0, 1, 3]);
    const refused = placeBlocks(p, [
      { instrument: 'keys', pattern: 0, startBar: 5 },
      { instrument: 'drums', pattern: 1, startBar: 2 },
    ]);
    expect(refused).toEqual({ ok: false, reason: 'Bars 3 to 4 are taken in the Drums lane.' });
    expect(placeBlocks(p, [{ instrument: 'keys', pattern: 0, startBar: MAX_SONG_BARS }])).toEqual({
      ok: false,
      reason: 'That would run past bar 256.',
    });
  });

  it('removes a group, and reads the span of a group', () => {
    const p = laid();
    const group = blocksOf(p, [{ instrument: 'drums', startBar: 1 }, { instrument: 'keys', startBar: 0 }, { instrument: 'bass', startBar: 7 }]);
    expect(group).toEqual([
      { instrument: 'drums', startBar: 1, pattern: 1 },
      { instrument: 'keys', startBar: 0, pattern: 0 },
    ]);
    expect(groupSpan(p, group)).toEqual({ start: 0, end: 3 });
    expect(groupSpan(p, [])).toBeNull();
    const left = removeBlocks(p, group);
    expect(left.instruments.drums.lane).toEqual([{ pattern: 0, startBar: 0 }]);
    expect(left.instruments.keys.lane).toEqual([]);
  });
});
