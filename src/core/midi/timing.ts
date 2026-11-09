/**
 * Tempo, meter and pickup bars of a file (docs/midi-import.md, "Tempo and meter"). Pure.
 * The app has one BPM and one meter for the whole song, so the dominant ones are used and the rest
 * is reported. Time is measured over the span from the first note to the end of the last.
 */
import { BPM_DEFAULT, clampBpm } from '../time';
import type { MidiFile } from './read';
import { refuse, succeed, type Result } from './types';

export interface ImportMeter {
  numerator: 3 | 4;
  denominator: 4;
}

export interface Timing {
  bpm: number;
  /** Other tempos that sound in the span and are ignored. */
  otherTempos: number;
  meter: ImportMeter;
  /** Length of one bar in file ticks. */
  barTicks: number;
  /** Ticks to add to every position so that the first full bar of the main meter starts on a bar line. */
  shiftTicks: number;
  /** Sentences for the import report: what was ignored or moved. */
  notes: string[];
}

export interface Span {
  start: number;
  end: number;
}

/** From the first note start to the last note end over all tracks; null when the file has no notes. */
export function noteSpan(file: MidiFile): Span | null {
  let start = Infinity;
  let end = -Infinity;
  for (const track of file.tracks) {
    for (const note of track.notes) {
      if (note.start < start) start = note.start;
      if (note.end > end) end = note.end;
    }
  }
  return start === Infinity ? null : { start, end };
}

interface Segment {
  start: number;
  end: number;
}

/** 500000 microseconds a quarter, the MIDI default. */
const DEFAULT_MICROS = 500000;

function bpmOf(microsPerQuarter: number): number {
  return Math.round(60e6 / microsPerQuarter);
}

/** The dominant tempo in the span, rounded to a whole BPM and clamped, and how many other tempos sound there. */
export function dominantTempo(file: MidiFile, span: Span): { bpm: number; otherTempos: number; clamped: boolean } {
  const events = file.tempos.length > 0 ? [...file.tempos].sort((a, b) => a.tick - b.tick) : [{ tick: 0, microsPerQuarter: DEFAULT_MICROS }];
  // A later event at the same tick replaces an earlier one.
  const steps: { tick: number; micros: number }[] = [];
  const first = events[0];
  if (first && first.tick > 0) steps.push({ tick: 0, micros: DEFAULT_MICROS });
  for (const event of events) {
    const last = steps[steps.length - 1];
    if (last && last.tick === event.tick) last.micros = event.microsPerQuarter;
    else steps.push({ tick: event.tick, micros: event.microsPerQuarter });
  }

  const weight = new Map<number, number>();
  steps.forEach((step, i) => {
    const from = Math.max(step.tick, span.start);
    const to = Math.min(steps[i + 1]?.tick ?? Infinity, span.end);
    if (to <= from) return;
    const bpm = bpmOf(step.micros);
    weight.set(bpm, (weight.get(bpm) ?? 0) + (to - from));
  });

  let best: number | null = null;
  let bestWeight = 0;
  for (const [bpm, w] of weight) {
    if (w > bestWeight) {
      best = bpm;
      bestWeight = w;
    }
  }
  const raw = best ?? BPM_DEFAULT;
  const bpm = clampBpm(raw);
  return { bpm, otherTempos: Math.max(0, weight.size - 1), clamped: bpm !== raw };
}

function meterName(numerator: number, denominator: number): string {
  return `${numerator}/${denominator}`;
}

interface MeterSegment extends Segment {
  numerator: number;
  denominator: number;
}

/** The time signatures as consecutive segments from tick 0 (4/4 until the first event), equal neighbours merged. */
function meterSegments(file: MidiFile, endTick: number): MeterSegment[] {
  const steps: { tick: number; numerator: number; denominator: number }[] = [];
  const first = file.timeSignatures[0];
  if (!first || first.tick > 0) steps.push({ tick: 0, numerator: 4, denominator: 4 });
  for (const sig of file.timeSignatures) {
    const last = steps[steps.length - 1];
    if (last && last.tick === sig.tick) {
      last.numerator = sig.numerator;
      last.denominator = sig.denominator;
    } else {
      steps.push({ tick: sig.tick, numerator: sig.numerator, denominator: sig.denominator });
    }
  }
  const out: MeterSegment[] = [];
  steps.forEach((step, i) => {
    const end = steps[i + 1]?.tick ?? Math.max(endTick, step.tick);
    const last = out[out.length - 1];
    if (last && last.numerator === step.numerator && last.denominator === step.denominator) last.end = end;
    else out.push({ start: step.tick, end, numerator: step.numerator, denominator: step.denominator });
  });
  return out;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Tempo, meter, pickup shift and the report notes for a file. A meter other than 4/4 and 3/4 is a refusal. */
export function analyseTiming(file: MidiFile): Result<Timing> {
  const span = noteSpan(file) ?? { start: 0, end: file.endTick };
  const tempo = dominantTempo(file, span);

  const segments = meterSegments(file, Math.max(file.endTick, span.end));
  const weight = new Map<string, number>();
  for (const seg of segments) {
    const from = Math.max(seg.start, span.start);
    const to = Math.min(seg.end, span.end);
    if (to <= from) continue;
    const key = meterName(seg.numerator, seg.denominator);
    weight.set(key, (weight.get(key) ?? 0) + (to - from));
  }
  let mainKey: string | null = null;
  let mainWeight = 0;
  for (const [key, w] of weight) {
    if (w > mainWeight) {
      mainKey = key;
      mainWeight = w;
    }
  }
  // The first stretch of the dominant meter marks where the main meter begins.
  const main =
    segments.find((s) => meterName(s.numerator, s.denominator) === mainKey) ?? segments[0] ?? { start: 0, end: 0, numerator: 4, denominator: 4 };
  if (main.denominator !== 4 || (main.numerator !== 4 && main.numerator !== 3)) {
    return refuse(
      `This song is mostly in ${meterName(main.numerator, main.denominator)}. The app has only 4/4 and 3/4, so the song cannot be imported.`,
    );
  }

  const meter: ImportMeter = { numerator: main.numerator, denominator: 4 };
  const barTicks = file.ticksPerQuarter * meter.numerator;
  const shiftTicks = (barTicks - (main.start % barTicks)) % barTicks;
  const notes: string[] = [];

  const beats = (ticks: number): string => plural(Math.round((ticks / file.ticksPerQuarter) * 100) / 100, 'beat', 'beats');
  if (tempo.otherTempos > 0) {
    notes.push(`${plural(tempo.otherTempos, 'other tempo', 'other tempos')} in the file ${tempo.otherTempos === 1 ? 'is' : 'are'} ignored; the song plays at ${tempo.bpm} BPM throughout.`);
  }
  if (tempo.clamped) notes.push(`The tempo is outside the range of the app and was set to ${tempo.bpm} BPM.`);
  if (shiftTicks > 0) {
    notes.push(`The file starts with ${beats(main.start)} before the first full ${meterName(meter.numerator, 4)} bar. Everything is moved ${beats(shiftTicks)} later, so that bar lands on a bar line.`);
  }
  for (const seg of segments) {
    if (seg.start < main.start) continue; // the lead-in before the main meter, already reported as the shift
    if (meterName(seg.numerator, seg.denominator) === meterName(meter.numerator, 4)) continue;
    if (seg.start >= span.end || seg.end <= span.start) continue;
    const bar = Math.floor((seg.start + shiftTicks) / barTicks) + 1;
    const drift = (seg.end - seg.start) % barTicks;
    const where = `A ${meterName(seg.numerator, seg.denominator)} section starts in bar ${bar} and is ignored`;
    notes.push(drift === 0 ? `${where}; it lasts whole bars, so the bar lines after it are not affected.` : `${where}: every bar line after it is ${beats(drift)} off.`);
  }

  return succeed({ bpm: tempo.bpm, otherTempos: tempo.otherTempos, meter, barTicks, shiftTicks, notes });
}
