/**
 * The words of the import report (docs/midi-import.md, "Import: the flow", item 5). Pure: it turns the
 * report data that `convertMidi` returns into plain, short lines, so the wording can be tested and the
 * screen (src/ui/ImportReport.tsx) only lays them out.
 */
import { INSTRUMENT_IDS, INSTRUMENT_LABELS, type InstrumentId } from '../instruments';
import { MAX_BARS } from './quantize';
import type { ImportReport, InstrumentReport } from './build';

/** General MIDI percussion names, for the hits the five rows do not cover. */
const GM_DRUM_NAMES: Readonly<Record<number, string>> = {
  27: 'high-Q',
  28: 'slap',
  29: 'scratch push',
  30: 'scratch pull',
  31: 'sticks',
  32: 'square click',
  33: 'metronome click',
  34: 'metronome bell',
  35: 'bass drum 2',
  37: 'side stick',
  39: 'hand clap',
  41: 'low floor tom',
  43: 'high floor tom',
  45: 'low tom',
  47: 'low-mid tom',
  48: 'high-mid tom',
  50: 'high tom',
  52: 'Chinese cymbal',
  54: 'tambourine',
  55: 'splash cymbal',
  56: 'cowbell',
  58: 'vibraslap',
  60: 'high bongo',
  61: 'low bongo',
  62: 'mute high conga',
  63: 'open high conga',
  64: 'low conga',
  65: 'high timbale',
  66: 'low timbale',
  67: 'high agogo',
  68: 'low agogo',
  69: 'cabasa',
  70: 'maracas',
  71: 'short whistle',
  72: 'long whistle',
  73: 'short guiro',
  74: 'long guiro',
  75: 'claves',
  76: 'high wood block',
  77: 'low wood block',
  78: 'mute cuica',
  79: 'open cuica',
  80: 'mute triangle',
  81: 'open triangle',
};

export function drumSoundName(note: number): string {
  return GM_DRUM_NAMES[note] ?? `sound ${note}`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** One instrument's row of the report. */
export interface ReportRow {
  id: InstrumentId;
  label: string;
  /** False for an instrument that got no track. */
  mapped: boolean;
  /** "Track: Julian" or "Tracks: Guitar 1, Guitar 2"; empty for an instrument with no track. */
  source: string;
  /** Short facts, in a fixed order: notes, octave moves or dropped hits, frets, patterns and blocks. */
  facts: string[];
  /** Things the user should notice: a cut, hits dropped, chords on one string. */
  warnings: string[];
}

export interface ReportView {
  /** "96 BPM · 4/4 · 57 bars". */
  headline: string;
  /** Sentences about tempo, meter, the pickup and the 256-bar limit. */
  notes: string[];
  rows: ReportRow[];
}

/** "54 tambourine ×79, 41 low floor tom ×3": the dropped hits by sound, the most frequent first. */
export function droppedText(dropped: Readonly<Record<number, number>>): string {
  return Object.entries(dropped)
    .map(([note, count]) => ({ note: Number(note), count }))
    .sort((a, b) => b.count - a.count || a.note - b.note)
    .map(({ note, count }) => `${drumSoundName(note)} ×${count}`)
    .join(', ');
}

function trackName(track: { index: number; name: string }): string {
  return track.name.trim() === '' ? `Track ${track.index + 1}` : track.name.trim();
}

function rowOf(id: InstrumentId, report: InstrumentReport | null): ReportRow {
  const label = INSTRUMENT_LABELS[id];
  if (report === null) return { id, label, mapped: false, source: '', facts: ['no track'], warnings: [] };

  const source = `${report.tracks.length === 1 ? 'Track' : 'Tracks'}: ${report.tracks.map(trackName).join(', ')}`;
  const facts: string[] = [];
  const warnings: string[] = [];
  if (id === 'drums') {
    facts.push(plural(report.notes, 'hit', 'hits'));
    if (report.droppedTotal > 0) warnings.push(`${plural(report.droppedTotal, 'hit', 'hits')} left out, no row for them: ${droppedText(report.dropped)}.`);
    else facts.push('no hits dropped');
  } else {
    facts.push(plural(report.notes, 'note', 'notes'));
    facts.push(report.octaveMoves === 0 ? 'no octave moves' : `${plural(report.octaveMoves, 'note', 'notes')} moved an octave`);
  }
  if (report.fretCount !== null) facts.push(`${report.fretCount} frets`);
  facts.push(plural(report.patterns, 'pattern', 'patterns'), plural(report.blocks, 'block', 'blocks'));
  if (report.sharedStringChords > 0) {
    warnings.push(`${plural(report.sharedStringChords, 'chord', 'chords')} could not be played on separate strings and ${report.sharedStringChords === 1 ? 'shares' : 'share'} one.`);
  }
  if (report.clippedNotes > 0) warnings.push(`${plural(report.clippedNotes, 'note', 'notes')} cut short at the end of a block.`);
  warnings.push(...report.warnings);
  return { id, label, mapped: true, source, facts, warnings };
}

/** The whole report as lines. */
export function reportLines(report: ImportReport): ReportView {
  const headline = `${report.bpm} BPM · ${report.meter} · ${plural(report.bars, 'bar', 'bars')}`;
  const notes = [...report.timingNotes, ...report.warnings];
  if (report.bars >= MAX_BARS && !report.warnings.some((w) => w.includes(String(MAX_BARS)))) {
    notes.push(`The song fills all ${MAX_BARS} bars the app holds.`);
  }
  return { headline, notes, rows: INSTRUMENT_IDS.map((id) => rowOf(id, report.instruments[id])) };
}
