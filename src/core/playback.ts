/**
 * What plays, and when. Turns a project into timelines of notes and metronome clicks, in ticks, for
 * Pattern mode and for Song mode. No sound and no clock are in here: the cursor (cursor.ts) walks a
 * plan against a clock, and the audio engine (src/audio/) makes the sound. See docs/patterns-and-song.md.
 */
import {
  FRET_MAX,
  INSTRUMENT_IDS,
  INSTRUMENT_KIND,
  TUNING,
  isStringInstrument,
  type DrumRow,
  type InstrumentId,
} from './instruments';
import { visibleTicks, type DrumNote, type KeysNote, type Project, type StringNote } from './project';
import { blockEnd, songBars } from './song';
import { TICKS_PER_QUARTER, ticksPerBar } from './time';

/** What a note asks the sampler for: a drum row, or a MIDI pitch. */
export type Sound = { kind: 'drum'; row: DrumRow } | { kind: 'pitch'; pitch: number };

export interface TimelineNote {
  /** Ticks from the start of the timeline. */
  tick: number;
  instrument: InstrumentId;
  sound: Sound;
  /** 0 for a drum hit, which plays for the full duration of its sound. */
  lengthTicks: number;
}

export interface Click {
  tick: number;
  /** The first beat of a bar. */
  accent: boolean;
}

export interface Timeline {
  /** Where this timeline starts in the song, in ticks (0 unless Song mode starts from a later bar). */
  offsetTicks: number;
  lengthTicks: number;
  /** Sorted by tick. */
  notes: TimelineNote[];
  clicks: Click[];
}

export type PlayMode = 'pattern' | 'song';

/**
 * A first pass, then a loop. In Pattern mode they are the same timeline. In Song mode the first
 * pass starts at the bar the user clicked, and the loop starts again from the beginning of the song.
 */
export interface Plan {
  mode: PlayMode;
  first: Timeline;
  loop: Timeline;
}

/** The notes of one pattern that can be heard: inside the visible length, and on frets that exist. */
function audibleNotes(project: Project, id: InstrumentId, index: number): TimelineNote[] {
  const instrument = project.instruments[id];
  const pattern = instrument.patterns[index];
  if (!pattern) return [];
  const visible = visibleTicks(project, id, index);
  const out: TimelineNote[] = [];
  const kind = INSTRUMENT_KIND[id];
  for (const note of pattern.notes) {
    if (note.start >= visible) continue;
    if (kind === 'drums') {
      out.push({ tick: note.start, instrument: id, sound: { kind: 'drum', row: (note as DrumNote).row }, lengthTicks: 0 });
    } else if (kind === 'strings' && isStringInstrument(id)) {
      const n = note as StringNote;
      const open = TUNING[id][n.string];
      if (open === undefined || n.fret > (instrument.fretCount ?? FRET_MAX)) continue;
      const lengthTicks = Math.min(n.length, visible - n.start);
      out.push({ tick: n.start, instrument: id, sound: { kind: 'pitch', pitch: open + n.fret }, lengthTicks });
    } else {
      const n = note as KeysNote;
      const lengthTicks = Math.min(n.length, visible - n.start);
      out.push({ tick: n.start, instrument: id, sound: { kind: 'pitch', pitch: n.pitch }, lengthTicks });
    }
  }
  return out;
}

function byTick(a: { tick: number }, b: { tick: number }): number {
  return a.tick - b.tick;
}

/** One click on every beat, the first beat of each bar accented. */
export function metronomeClicks(project: Project, lengthTicks: number): Click[] {
  const bar = ticksPerBar(project.meter);
  const clicks: Click[] = [];
  for (let tick = 0; tick < lengthTicks; tick += TICKS_PER_QUARTER) clicks.push({ tick, accent: tick % bar === 0 });
  return clicks;
}

/**
 * Pattern mode: the selected pattern of `focus` loops, and every other instrument plays the pattern
 * last selected for it along with it. A shorter pattern repeats to fill the loop; a longer one is cut
 * at the end of the loop (assumed; docs/open-items.md).
 */
export function patternPlan(project: Project, focus: InstrumentId): Plan {
  const loopTicks = visibleTicks(project, focus, project.instruments[focus].selectedPattern);
  const notes: TimelineNote[] = [];
  for (const id of INSTRUMENT_IDS) {
    const instrument = project.instruments[id];
    const index = instrument.selectedPattern;
    const period = visibleTicks(project, id, index);
    const own = audibleNotes(project, id, index);
    for (let offset = 0; offset < loopTicks; offset += period) {
      for (const note of own) {
        if (offset + note.tick < loopTicks) notes.push({ ...note, tick: offset + note.tick });
      }
    }
  }
  notes.sort(byTick);
  const timeline: Timeline = { offsetTicks: 0, lengthTicks: loopTicks, notes, clicks: metronomeClicks(project, loopTicks) };
  return { mode: 'pattern', first: timeline, loop: timeline };
}

/** The notes of every lane from `startBar` to `endBar`, with ticks counted from `startBar`. */
function songTimeline(project: Project, startBar: number, endBar: number): Timeline {
  const bar = ticksPerBar(project.meter);
  const from = startBar * bar;
  const lengthTicks = Math.max(0, (endBar - startBar) * bar);
  const notes: TimelineNote[] = [];
  for (const id of INSTRUMENT_IDS) {
    const instrument = project.instruments[id];
    for (const block of instrument.lane) {
      if (blockEnd(project, id, block) <= startBar || block.startBar >= endBar) continue;
      for (const note of audibleNotes(project, id, block.pattern)) {
        // A note that began before the start bar is not played: the song starts from the clicked bar.
        const tick = block.startBar * bar + note.tick - from;
        if (tick >= 0 && tick < lengthTicks) notes.push({ ...note, tick });
      }
    }
  }
  notes.sort(byTick);
  return { offsetTicks: from, lengthTicks, notes, clicks: metronomeClicks(project, lengthTicks) };
}

/**
 * Song mode from `startBar` (0 plays from the beginning). The song ends at the end of the last
 * block of any lane; after it, playback goes back to the beginning. A start at or past the end of the
 * song, or in an empty song, plays from the beginning (an empty song is a zero-length plan).
 */
export function songPlan(project: Project, startBar = 0): Plan {
  const end = songBars(project);
  const start = Number.isInteger(startBar) && startBar > 0 && startBar < end ? startBar : 0;
  const loop = songTimeline(project, 0, end);
  const first = start === 0 ? loop : songTimeline(project, start, end);
  return { mode: 'song', first, loop };
}
