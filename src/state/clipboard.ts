/**
 * The two clipboards of the app, as pure functions so they are tested without a window: notes, copied
 * on an instrument page, and Song blocks, copied on the Song page. Neither is saved or undone.
 *
 * A paste goes "next to" what was copied (the user's sweeping changes, 2026-11-09): into the pattern
 * the notes came from, right after them; into another pattern, at the same places. Each further paste
 * goes right after the one before, so pressing Ctrl+V again and again lays copies end to end. Blocks
 * work the same way along the Song.
 */
import type { InstrumentId } from '../core/instruments';
import { noteEnd } from '../core/patterns';
import type { Note, Project } from '../core/project';
import { groupSpan, type BlockPlacement } from '../core/song';
import { TICKS_PER_QUARTER } from '../core/time';

export interface NoteClipboard {
  instrument: InstrumentId;
  /** The pattern the notes were copied from. */
  pattern: number;
  /** The notes as they were copied, at their own places. */
  notes: Note[];
  /** How far one copy reaches, in ticks: from the first start to the last end, rounded up (see `noteSpan`). */
  span: number;
  /** The pattern of the last paste and how far the next paste into it is shifted. */
  next: { pattern: number; shift: number };
}

/** Notes copied on one instrument can be pasted on the same one, and between the two guitars, which share a layout. */
export function canPasteNotes(from: InstrumentId, to: InstrumentId): boolean {
  if (from === to) return true;
  return (from === 'rhythm' || from === 'lead') && (to === 'rhythm' || to === 'lead');
}

/**
 * How far a group of notes reaches, rounded up to a whole number of `unit` ticks so that a copy laid
 * after it stays on the beat. A drum hit has no length, so it counts as one step of `stepTicks`.
 */
export function noteSpan(notes: readonly Note[], stepTicks: number, unit: number): number {
  if (notes.length === 0) return 0;
  let first = Infinity;
  let last = 0;
  for (const note of notes) {
    first = Math.min(first, note.start);
    last = Math.max(last, 'length' in note ? noteEnd(note) : note.start + stepTicks);
  }
  const reach = Math.max(last - first, 1);
  return Math.ceil(reach / unit) * unit;
}

/** The unit a copy is rounded to: a beat, or the chosen note value when it is longer than a beat. */
export function spanUnit(stepTicks: number): number {
  return Math.max(TICKS_PER_QUARTER, stepTicks);
}

export function copyNotesToClipboard(
  instrument: InstrumentId,
  pattern: number,
  notes: readonly Note[],
  stepTicks: number,
): NoteClipboard {
  const span = noteSpan(notes, stepTicks, spanUnit(stepTicks));
  return { instrument, pattern, notes: notes.slice(), span, next: { pattern, shift: span } };
}

/** How far the next paste into `pattern` is shifted: right after the last paste there, or after the copied notes, or not at all. */
export function pasteShift(clip: NoteClipboard, pattern: number): number {
  if (pattern === clip.next.pattern) return clip.next.shift;
  return pattern === clip.pattern ? clip.span : 0;
}

/** The clipboard after a paste into `pattern` at `shift`: the next one goes right after it. */
export function afterNotePaste(clip: NoteClipboard, pattern: number, shift: number): NoteClipboard {
  return { ...clip, next: { pattern, shift: shift + clip.span } };
}

/**
 * The notes moved along by `shift` ticks, and how many fell outside a pattern of `total` ticks (a
 * note must start inside it and, if it has a length, end inside it). Those are left out.
 */
export function shiftNotes(notes: readonly Note[], shift: number, total: number): { notes: Note[]; dropped: number } {
  const out: Note[] = [];
  let dropped = 0;
  for (const note of notes) {
    const moved = { ...note, start: note.start + shift };
    const end = 'length' in moved ? noteEnd(moved) : moved.start + 1;
    if (moved.start < 0 || end > total) dropped += 1;
    else out.push(moved);
  }
  return { notes: out, dropped };
}

// ---- Blocks ----

export interface BlockClipboard {
  /** The blocks as they were copied. */
  blocks: BlockPlacement[];
  /** The first bar of the group and how many bars it covers. */
  start: number;
  span: number;
  /** Where the next Ctrl+V puts the group's first bar. */
  nextStart: number;
}

export function copyBlocksToClipboard(project: Project, blocks: readonly BlockPlacement[]): BlockClipboard | null {
  const span = groupSpan(project, blocks);
  if (!span) return null;
  const length = span.end - span.start;
  return { blocks: blocks.slice(), start: span.start, span: length, nextStart: span.end };
}

/** The copied blocks moved so that the group starts at `startBar`, each in its own lane. */
export function blocksStartingAt(clip: BlockClipboard, startBar: number): BlockPlacement[] {
  const shift = startBar - clip.start;
  return clip.blocks.map((b) => ({ ...b, startBar: b.startBar + shift }));
}

/** The clipboard after a paste that put the group at `startBar`: the next one goes right after it. */
export function afterBlockPaste(clip: BlockClipboard, startBar: number): BlockClipboard {
  return { ...clip, nextStart: startBar + clip.span };
}
