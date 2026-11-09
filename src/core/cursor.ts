/**
 * The play cursor: walks a plan (playback.ts) against a clock and hands out, a little ahead of time,
 * the notes and clicks that are due. It knows nothing about audio; the engine gives it the time and
 * plays what it returns. Times are seconds on whatever clock the caller uses (the audio clock).
 *
 * The cursor counts ticks continuously from the start of playback. It plays the plan's first pass,
 * then the loop again and again. Tempo can change while it runs, and the plan can be replaced (the
 * project was edited), both without a gap.
 */
import { TICKS_PER_QUARTER } from './time';
import type { Click, Plan, PlayMode, Timeline, TimelineNote } from './playback';

export type CursorItem =
  | { kind: 'note'; time: number; note: TimelineNote }
  | { kind: 'click'; time: number; click: Click };

interface Item {
  tick: number;
  note?: TimelineNote;
  click?: Click;
}

interface Pass {
  phase: 'first' | 'loop';
  /** The continuous tick at which this pass began. */
  base: number;
  length: number;
  offsetTicks: number;
}

/** Notes and clicks of a timeline as one list in order; at the same tick a note comes before a click. */
function itemsOf(timeline: Timeline): Item[] {
  const items: Item[] = [
    ...timeline.notes.map((note): Item => ({ tick: note.tick, note })),
    ...timeline.clicks.map((click): Item => ({ tick: click.tick, click })),
  ];
  return items.sort((a, b) => a.tick - b.tick);
}

function secondsPerTick(bpm: number): number {
  return 60 / bpm / TICKS_PER_QUARTER;
}

export class PlayCursor {
  private plan: Plan;
  private phase: 'first' | 'loop' = 'first';
  private base = 0;
  private items: Item[];
  private index = 0;
  private anchorTime: number;
  private anchorTick = 0;
  private spt: number;
  private scheduledUntil: number;
  private passes: Pass[] = [];
  private done = false;

  constructor(plan: Plan, startTime: number, bpm: number) {
    this.plan = plan;
    this.anchorTime = startTime;
    this.scheduledUntil = startTime;
    this.spt = secondsPerTick(bpm);
    this.items = itemsOf(plan.first);
    this.enterPass();
  }

  get mode(): PlayMode {
    return this.plan.mode;
  }

  /** True when there is nothing to play: the song is empty. */
  get finished(): boolean {
    return this.done;
  }

  private timeline(): Timeline {
    return this.phase === 'first' ? this.plan.first : this.plan.loop;
  }

  private enterPass(): void {
    const timeline = this.timeline();
    if (timeline.lengthTicks <= 0) {
      this.done = true;
      return;
    }
    this.passes.push({ phase: this.phase, base: this.base, length: timeline.lengthTicks, offsetTicks: timeline.offsetTicks });
    if (this.passes.length > 3) this.passes.shift();
  }

  private timeOfTick(tick: number): number {
    return this.anchorTime + (tick - this.anchorTick) * this.spt;
  }

  private tickAtTime(time: number): number {
    return this.anchorTick + (time - this.anchorTime) / this.spt;
  }

  /** Moves from the end of one pass to the start of the next. */
  private advance(): void {
    this.base += this.timeline().lengthTicks;
    this.phase = 'loop';
    this.items = itemsOf(this.plan.loop);
    this.index = 0;
    this.enterPass();
  }

  /**
   * Everything that is due before `until` and was not handed out before, in time order. Call it
   * repeatedly with a clock that moves on.
   */
  pull(until: number): CursorItem[] {
    const out: CursorItem[] = [];
    while (!this.done) {
      const item = this.items[this.index];
      if (!item) {
        if (this.timeOfTick(this.base + this.timeline().lengthTicks) >= until) break;
        this.advance();
        continue;
      }
      const time = this.timeOfTick(this.base + item.tick);
      if (time >= until) break;
      if (item.note) out.push({ kind: 'note', time, note: item.note });
      else if (item.click) out.push({ kind: 'click', time, click: item.click });
      this.index += 1;
    }
    this.scheduledUntil = Math.max(this.scheduledUntil, until);
    return out;
  }

  /** Changes the tempo from `now` on. What was already handed out keeps its time. */
  setBpm(bpm: number, now: number): void {
    this.anchorTick = this.tickAtTime(now);
    this.anchorTime = now;
    this.spt = secondsPerTick(bpm);
  }

  /**
   * Swaps in a new plan (the project was edited). Playback carries on from where it is: what was
   * already handed out is not handed out again, and the rest comes from the new plan.
   */
  replacePlan(plan: Plan): void {
    if (this.done) return;
    this.plan = plan;
    const timeline = this.timeline();
    if (timeline.lengthTicks <= 0) {
      this.done = true;
      return;
    }
    const current = this.passes[this.passes.length - 1];
    if (current) {
      current.length = timeline.lengthTicks;
      current.offsetTicks = timeline.offsetTicks;
    }
    this.items = itemsOf(timeline);
    const resume = this.tickAtTime(this.scheduledUntil);
    const next = this.items.findIndex((item) => this.base + item.tick >= resume - 1e-9);
    this.index = next === -1 ? this.items.length : next;
  }

  /**
   * Where the playhead is at time `now`: the tick inside the pass being heard, and the same tick
   * counted from the start of the song (Song mode; the first pass may start at a later bar).
   */
  position(now: number): { phase: 'first' | 'loop'; tick: number; songTick: number } {
    const abs = Math.max(0, this.tickAtTime(now));
    for (let i = this.passes.length - 1; i >= 0; i -= 1) {
      const pass = this.passes[i];
      if (pass && abs >= pass.base) {
        const tick = Math.min(abs - pass.base, pass.length);
        return { phase: pass.phase, tick, songTick: pass.offsetTicks + tick };
      }
    }
    const first = this.passes[0];
    return { phase: first?.phase ?? 'first', tick: 0, songTick: first?.offsetTicks ?? 0 };
  }
}
