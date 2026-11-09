import { describe, expect, it } from 'vitest';
import { PlayCursor } from './cursor';
import type { Plan, Timeline } from './playback';

// At 120 BPM a quarter note (12 ticks) lasts 0.5 s, so a tick lasts 1/24 s.
const TICK = 1 / 24;

function note(tick: number, pitch = 60) {
  return { tick, instrument: 'keys' as const, sound: { kind: 'pitch' as const, pitch }, lengthTicks: 12 };
}

function timeline(lengthTicks: number, ticks: number[], offsetTicks = 0): Timeline {
  return { offsetTicks, lengthTicks, notes: ticks.map((t) => note(t)), clicks: [] };
}

function loopPlan(lengthTicks: number, ticks: number[]): Plan {
  const t = timeline(lengthTicks, ticks);
  return { mode: 'pattern', first: t, loop: t };
}

const times = (items: { time: number }[]) => items.map((i) => Number(i.time.toFixed(6)));

describe('handing out events', () => {
  it('gives each event its time on the clock, and only once', () => {
    const cursor = new PlayCursor(loopPlan(48, [0, 24]), 10, 120);
    expect(times(cursor.pull(10.5))).toEqual([10]);
    expect(cursor.pull(10.5)).toEqual([]);
    expect(times(cursor.pull(11.5))).toEqual([11]);
  });

  it('does not hand out an event before the window reaches it', () => {
    const cursor = new PlayCursor(loopPlan(48, [0, 24]), 0, 120);
    expect(times(cursor.pull(0.4))).toEqual([0]);
    expect(times(cursor.pull(0.9))).toEqual([]);
    expect(times(cursor.pull(1.1))).toEqual([1]);
  });

  it('loops without a gap', () => {
    const cursor = new PlayCursor(loopPlan(48, [0, 24]), 0, 120);
    expect(times(cursor.pull(4.5))).toEqual([0, 1, 2, 3, 4]);
  });

  it('plays the first pass, then the loop', () => {
    const plan: Plan = { mode: 'song', first: timeline(24, [0], 24), loop: timeline(48, [0, 36]) };
    const cursor = new PlayCursor(plan, 0, 120);
    // First pass is 24 ticks (1 s); loop passes start at 1 s and 3 s.
    expect(times(cursor.pull(5))).toEqual([0, 1, 1 + 36 * TICK, 3, 3 + 36 * TICK]);
  });

  it('hands out clicks and notes together, the note first on the same tick', () => {
    const t: Timeline = { offsetTicks: 0, lengthTicks: 24, notes: [note(12)], clicks: [{ tick: 0, accent: true }, { tick: 12, accent: false }] };
    const cursor = new PlayCursor({ mode: 'pattern', first: t, loop: t }, 0, 120);
    expect(cursor.pull(0.9).map((i) => i.kind)).toEqual(['click', 'note', 'click']);
  });

  it('has nothing to give for a plan of zero length', () => {
    const cursor = new PlayCursor(loopPlan(0, []), 0, 120);
    expect(cursor.finished).toBe(true);
    expect(cursor.pull(100)).toEqual([]);
  });
});

describe('changing the tempo', () => {
  it('speeds up from the moment of the change', () => {
    const cursor = new PlayCursor(loopPlan(48, [0, 24]), 0, 120);
    expect(times(cursor.pull(0.6))).toEqual([0]);
    cursor.setBpm(240, 0.6); // from here a tick lasts half as long
    // The tick at 0.6 s is 14.4. The event at tick 24 is 9.6 ticks later: 9.6 / 48 = 0.2 s.
    expect(times(cursor.pull(1))).toEqual([0.8]);
    // Tick 48 (the loop start) is 24 ticks after tick 24: 0.5 s later.
    expect(times(cursor.pull(1.4))).toEqual([1.3]);
  });
});

describe('replacing the plan', () => {
  it('carries on from where it is, without repeating what was handed out', () => {
    const cursor = new PlayCursor(loopPlan(96, [0, 24, 48, 72]), 0, 120);
    expect(times(cursor.pull(1.2))).toEqual([0, 1]);
    cursor.replacePlan(loopPlan(96, [0, 24, 30, 72])); // the event at tick 48 became tick 30
    // Only what came after 1.2 s is taken from the new plan: tick 30 (1.25 s) and tick 72 (3 s).
    expect(times(cursor.pull(4))).toEqual([30 * TICK, 3]);
  });

  it('picks up an edited loop from the next pass', () => {
    const cursor = new PlayCursor(loopPlan(48, [0]), 0, 120);
    expect(times(cursor.pull(2.1))).toEqual([0, 2]);
    cursor.replacePlan(loopPlan(48, [12]));
    expect(times(cursor.pull(4.6))).toEqual([2.5, 4.5]);
  });

  it('stops when the new plan is empty', () => {
    const cursor = new PlayCursor(loopPlan(48, [0]), 0, 120);
    cursor.pull(1);
    cursor.replacePlan(loopPlan(0, []));
    expect(cursor.finished).toBe(true);
    expect(cursor.pull(10)).toEqual([]);
  });
});

describe('the playhead', () => {
  it('follows the clock inside a pass', () => {
    const cursor = new PlayCursor(loopPlan(48, [0]), 10, 120);
    cursor.pull(10.1);
    expect(cursor.position(10).tick).toBeCloseTo(0);
    expect(cursor.position(10.5).tick).toBeCloseTo(12);
  });

  it('wraps at the end of the loop, even when the cursor has already scheduled the next pass', () => {
    const cursor = new PlayCursor(loopPlan(48, [0]), 0, 120);
    cursor.pull(2.05); // schedules into the second pass (starts at 2 s)
    expect(cursor.position(1.9).tick).toBeCloseTo(45.6);
    expect(cursor.position(2.5).tick).toBeCloseTo(12);
  });

  it('counts the first pass of Song mode from the bar it started at', () => {
    const plan: Plan = { mode: 'song', first: timeline(48, [0], 96), loop: timeline(144, [0]) };
    const cursor = new PlayCursor(plan, 0, 120);
    cursor.pull(0.1);
    expect(cursor.position(0.5)).toMatchObject({ phase: 'first', tick: 12, songTick: 108 });
    cursor.pull(2.5);
    expect(cursor.position(2.5)).toMatchObject({ phase: 'loop', tick: 12, songTick: 12 });
  });
});
