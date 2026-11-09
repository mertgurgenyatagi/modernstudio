import { describe, expect, it } from 'vitest';
import type { ImportReport, InstrumentReport } from './build';
import { droppedText, drumSoundName, reportLines } from './reportLines';

function instrument(extra: Partial<InstrumentReport> = {}): InstrumentReport {
  return {
    tracks: [{ index: 1, name: 'Julian' }],
    notes: 120,
    octaveMoves: 0,
    dropped: {},
    droppedTotal: 0,
    fretCount: null,
    patterns: 3,
    blocks: 9,
    patternsNeeded: 3,
    sharedStringChords: 0,
    cutNotes: 0,
    clippedNotes: 0,
    warnings: [],
    ...extra,
  };
}

const NONE = { drums: null, bass: null, rhythm: null, lead: null, keys: null };

function report(extra: Partial<ImportReport> = {}): ImportReport {
  return {
    bpm: 96,
    otherTempos: 0,
    meter: '4/4',
    bars: 57,
    timingNotes: [],
    instruments: NONE,
    warnings: [],
    ...extra,
  };
}

describe('the report lines', () => {
  it('puts tempo, meter and bars in one headline', () => {
    expect(reportLines(report()).headline).toBe('96 BPM · 4/4 · 57 bars');
    expect(reportLines(report({ bars: 1, meter: '3/4', bpm: 120 })).headline).toBe('120 BPM · 3/4 · 1 bar');
  });

  it('lists one row per instrument, in the order of the Mixer, and says so when there is no track', () => {
    const view = reportLines(report());
    expect(view.rows.map((r) => r.label)).toEqual(['Drums', 'Bass', 'Rhythm Guitar', 'Lead Guitar', 'Keys']);
    expect(view.rows.every((r) => !r.mapped && r.facts[0] === 'no track' && r.source === '')).toBe(true);
  });

  it('names the track, the notes, the octave moves, the frets, the patterns and the blocks', () => {
    const view = reportLines(report({ instruments: { ...NONE, rhythm: instrument({ notes: 1358, octaveMoves: 471, fretCount: 7, patterns: 12, blocks: 14 }) } }));
    const row = view.rows[2]!;
    expect(row.source).toBe('Track: Julian');
    expect(row.facts).toEqual(['1358 notes', '471 notes moved an octave', '7 frets', '12 patterns', '14 blocks']);
    expect(row.warnings).toEqual([]);
  });

  it('uses singular words for one, says "no octave moves" for none, and names unnamed tracks by number', () => {
    const keys = instrument({ notes: 1, patterns: 1, blocks: 1, tracks: [{ index: 3, name: ' ' }, { index: 4, name: 'Pad' }] });
    const row = reportLines(report({ instruments: { ...NONE, keys } })).rows[4]!;
    expect(row.source).toBe('Tracks: Track 4, Pad');
    expect(row.facts).toEqual(['1 note', 'no octave moves', '1 pattern', '1 block']);
  });

  it('counts dropped drum hits by sound, the most frequent first', () => {
    expect(droppedText({ 54: 79, 41: 3, 56: 79 })).toBe('tambourine ×79, cowbell ×79, low floor tom ×3');
    expect(drumSoundName(999)).toBe('sound 999');
    const dropping = instrument({ notes: 675, dropped: { 54: 79 }, droppedTotal: 79 });
    const row = reportLines(report({ instruments: { ...NONE, drums: dropping } })).rows[0]!;
    expect(row.facts).toEqual(['675 hits', '3 patterns', '9 blocks']);
    expect(row.warnings).toEqual(['79 hits left out, no row for them: tambourine ×79.']);
    const none = reportLines(report({ instruments: { ...NONE, drums: instrument({ notes: 8 }) } })).rows[0]!;
    expect(none.facts).toContain('no hits dropped');
  });

  it("warns about chords on one string, clipped notes and the instrument's own warnings", () => {
    const cut = 'This part needs 143 patterns and 120 fit, so it is cut at bar 200 (30 notes left out).';
    const bass = instrument({ fretCount: 5, sharedStringChords: 1, clippedNotes: 2, warnings: [cut] });
    const row = reportLines(report({ instruments: { ...NONE, bass } })).rows[1]!;
    expect(row.warnings).toEqual(['1 chord could not be played on separate strings and shares one.', '2 notes cut short at the end of a block.', cut]);
  });

  it('carries the timing notes and the general warnings, and a cut at bar 256', () => {
    const view = reportLines(
      report({
        bars: 256,
        timingNotes: ['2 other tempos in the file are ignored; the song plays at 96 BPM throughout.', 'A 5/4 section starts in bar 9 and is ignored: every bar line after it is 1 beat off.'],
        warnings: ['The song passes bar 256; the rest is cut.'],
      }),
    );
    expect(view.headline).toBe('96 BPM · 4/4 · 256 bars');
    expect(view.notes).toHaveLength(3);
    expect(view.notes[1]).toContain('bar 9');
    expect(view.notes[2]).toContain('256');
  });

  it('says a song that exactly fills 256 bars does so, without a cut', () => {
    expect(reportLines(report({ bars: 256 })).notes).toEqual(['The song fills all 256 bars the app holds.']);
  });
});
