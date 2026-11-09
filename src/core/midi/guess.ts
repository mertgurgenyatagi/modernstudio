/**
 * The pre-filled mapping of the mapping step: which instrument each track of a file is sent to.
 * Pure. A port of guess_mapping in tools/midi-prototype/pipeline.py, with one change the prototype
 * does not have: vocal tracks (by name, or by a General MIDI voice program) take Keys before any
 * busier non-vocal track. The rules are in docs/midi-import.md ("Mapping guesses").
 */
import type { InstrumentId } from '../instruments';
import type { MidiFile } from './read';

export type Assignment = InstrumentId | 'skip';

/** One row of the mapping step. Tracks with no notes are left out of the list. */
export interface TrackGuess {
  /** Position of the track in the file. */
  index: number;
  name: string;
  notes: number;
  /** The first program change of the track, 0 to 127, or null. */
  program: number | null;
  assignment: Assignment;
}

/** 'vocals' is a Keys track that is the song's voice: it takes Keys before any other Keys track. */
type Kind = 'drums' | 'bass' | 'vocals' | 'keys' | 'guitar';

const VOCAL_WORDS = ['vocal', 'voice', 'julian', 'julien', 'casablancas', 'singer', 'sang', 'lyric', 'choir'];
/** Short vocal words that must stand alone ("vox", "voz", "sing"), so that "Voxel" or "Single" do not count. */
const VOCAL_WORD_PATTERN = /\b(vox|voz|sing|singing)\b/;
/** General MIDI voice programs, zero based: Choir Aahs, Voice Oohs, Synth Voice, and Lead 6 (voice). */
const VOCAL_PROGRAMS = new Set([52, 53, 54, 85]);
/** MIDI channel 10, zero based. */
const DRUM_CHANNEL = 9;

interface Row {
  index: number;
  name: string;
  notes: number;
  bars: number;
  program: number | null;
  kind: Kind;
}

function isVocalName(name: string): boolean {
  return VOCAL_WORDS.some((word) => name.includes(word)) || VOCAL_WORD_PATTERN.test(name);
}

function kindOf(name: string, onlyDrumChannel: boolean, program: number | null): Kind {
  if (onlyDrumChannel) return 'drums';
  if (name.includes('bass') || name.includes('basse')) return 'bass';
  if (isVocalName(name)) return 'vocals';
  if (program !== null && program >= 32 && program <= 39) return 'bass';
  if (program !== null && program >= 24 && program <= 31) return 'guitar';
  if (program !== null && VOCAL_PROGRAMS.has(program)) return 'vocals';
  return 'keys';
}

/** Busiest first; the track with more bars of notes first among equals; the file's order after that. */
function busiestFirst(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => b.notes - a.notes || b.bars - a.bars);
}

/** The tracks of a file with notes, each with the instrument it is guessed to belong on. */
export function guessMapping(file: MidiFile): TrackGuess[] {
  const barTicks = file.ticksPerQuarter * 4;
  const rows: Row[] = [];
  file.tracks.forEach((track, index) => {
    if (track.notes.length === 0) return;
    const name = track.name.toLowerCase();
    const onlyDrums = track.notes.every((n) => n.channel === DRUM_CHANNEL);
    const program = track.programs[0]?.program ?? null;
    const bars = new Set(track.notes.map((n) => Math.floor(n.start / barTicks))).size;
    rows.push({ index, name: track.name, notes: track.notes.length, bars, program, kind: kindOf(name, onlyDrums, program) });
  });

  const assigned = new Map<number, Assignment>();
  for (const row of rows) assigned.set(row.index, 'skip');
  for (const row of rows.filter((r) => r.kind === 'drums')) assigned.set(row.index, 'drums');

  // One track for Bass: the busiest. One for Keys: the busiest vocal track, and only when the file has
  // none, the busiest other Keys track (Keys is the instrument for vocals). The others stay on Skip.
  const bass = busiestFirst(rows.filter((r) => r.kind === 'bass'))[0];
  if (bass) assigned.set(bass.index, 'bass');
  const vocals = busiestFirst(rows.filter((r) => r.kind === 'vocals'));
  const keys = vocals[0] ?? busiestFirst(rows.filter((r) => r.kind === 'keys'))[0];
  if (keys) assigned.set(keys.index, 'keys');

  // Guitars: a name wins over the busiest-first order.
  const guitars = busiestFirst(rows.filter((r) => r.kind === 'guitar'));
  const hasWord = (row: Row, words: string[]): boolean => words.some((w) => row.name.toLowerCase().includes(w));
  const named = guitars.filter((g) => hasWord(g, ['rhythm', 'rythm']));
  const leads = guitars.filter((g) => hasWord(g, ['lead']));
  const unnamed = guitars.filter((g) => !named.includes(g) && !leads.includes(g));
  const rhythm = (named.length > 0 ? named : unnamed.length > 0 ? unnamed : leads)[0];
  const rest = guitars.filter((g) => g !== rhythm);
  const restLeads = rest.filter((g) => leads.includes(g));
  const lead = (restLeads.length > 0 ? restLeads : rest)[0];
  if (rhythm) assigned.set(rhythm.index, 'rhythm');
  if (lead) assigned.set(lead.index, 'lead');

  return rows.map((row) => ({
    index: row.index,
    name: row.name,
    notes: row.notes,
    program: row.program,
    assignment: assigned.get(row.index) ?? 'skip',
  }));
}
