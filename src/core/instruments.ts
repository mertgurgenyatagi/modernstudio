/** The five instruments and their fixed layouts. See docs/instrument-layouts.md. */

export const INSTRUMENT_IDS = ['drums', 'bass', 'rhythm', 'lead', 'keys'] as const;
export type InstrumentId = (typeof INSTRUMENT_IDS)[number];

export const INSTRUMENT_LABELS: Record<InstrumentId, string> = {
  drums: 'Drums',
  bass: 'Bass',
  rhythm: 'Rhythm Guitar',
  lead: 'Lead Guitar',
  keys: 'Keys',
};

/** Which kind of notes an instrument holds: hits on rows, string-and-fret notes, or pitched notes. */
export type InstrumentKind = 'drums' | 'strings' | 'keys';

export const INSTRUMENT_KIND: Record<InstrumentId, InstrumentKind> = {
  drums: 'drums',
  bass: 'strings',
  rhythm: 'strings',
  lead: 'strings',
  keys: 'keys',
};

export type StringInstrumentId = 'bass' | 'rhythm' | 'lead';

export function isStringInstrument(id: InstrumentId): id is StringInstrumentId {
  return INSTRUMENT_KIND[id] === 'strings';
}

/** Drum rows from bottom to top. Hits have no length. */
export const DRUM_ROWS = ['kick', 'snare', 'hihat', 'openHihat', 'crash'] as const;
export type DrumRow = (typeof DRUM_ROWS)[number];

/**
 * Open-string pitches as MIDI note numbers (C4 = 60), lowest string first, which is the top of the
 * string cards. Tuning cannot be changed.
 */
export const TUNING: Record<StringInstrumentId, readonly number[]> = {
  bass: [28, 33, 38, 43], // E1 A1 D2 G2
  rhythm: [40, 45, 50, 55, 59, 64], // E2 A2 D3 G3 B3 E4
  lead: [40, 45, 50, 55, 59, 64],
};

/** The fret counts a string instrument can show. Every string shows the open string plus this many frets. */
export const FRET_COUNTS = [5, 7, 12] as const;
export type FretCount = (typeof FRET_COUNTS)[number];
export const FRET_COUNT_DEFAULT: FretCount = 7;
export const FRET_MAX = 12;

/** The agreed Keys range, C2 to C6, as MIDI note numbers. */
export const KEYS_RANGE = { low: 36, high: 84 } as const;

/** Up to 120 patterns per instrument exist; 20 are shown, and more open 20 at a time. */
export const PATTERNS_MAX = 120;
export const PATTERNS_SHOWN_DEFAULT = 20;
export const PATTERNS_SHOWN_STEP = 20;

/** Volume, master volume and the envelope are all 0 to 100, with no units. */
export const LEVEL_MIN = 0;
export const LEVEL_MAX = 100;
