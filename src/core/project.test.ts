import { describe, expect, it } from 'vitest';
import {
  DRUM_ROWS,
  FRET_COUNT_DEFAULT,
  INSTRUMENT_IDS,
  PATTERNS_MAX,
  PATTERNS_SHOWN_DEFAULT,
  TUNING,
} from './instruments';
import { addNote, setPatternBars } from './patterns';
import {
  canOpenMorePatterns,
  createProject,
  isActive,
  openMorePatterns,
  selectPattern,
  setBpm,
  setEnvelope,
  setFretCount,
  setMasterVolume,
  setMeter,
  setMuted,
  setVolume,
  showPatterns,
  type Project,
} from './project';
import { must } from './testing';

describe('a new project', () => {
  const project = createProject();

  it('is 120 BPM in 4/4 and empty', () => {
    expect(project.bpm).toBe(120);
    expect(project.meter).toBe('4/4');
    for (const id of INSTRUMENT_IDS) {
      const instrument = project.instruments[id];
      expect(instrument.patterns).toHaveLength(PATTERNS_MAX);
      expect(instrument.patterns.some(isActive)).toBe(false);
      expect(instrument.patterns.every((p) => p.bars === 1)).toBe(true);
      expect(instrument.shownPatterns).toBe(PATTERNS_SHOWN_DEFAULT);
      expect(instrument.selectedPattern).toBe(0);
      expect(instrument.lane).toEqual([]);
      expect(instrument.muted).toBe(false);
    }
  });

  it('has the five instruments, with a fret count only on the bass and the guitars', () => {
    expect(INSTRUMENT_IDS).toEqual(['drums', 'bass', 'rhythm', 'lead', 'keys']);
    expect(project.instruments.drums.fretCount).toBeNull();
    expect(project.instruments.keys.fretCount).toBeNull();
    for (const id of ['bass', 'rhythm', 'lead'] as const) {
      expect(project.instruments[id].fretCount).toBe(FRET_COUNT_DEFAULT);
    }
  });

  it('gives the drums five rows and the strings the decided tuning', () => {
    expect(DRUM_ROWS).toEqual(['kick', 'snare', 'hihat', 'openHihat', 'crash']);
    expect(TUNING.bass).toEqual([28, 33, 38, 43]);
    expect(TUNING.rhythm).toEqual([40, 45, 50, 55, 59, 64]);
    expect(TUNING.lead).toEqual(TUNING.rhythm);
  });

  it('does not share patterns between instruments or between patterns', () => {
    expect(project.instruments.bass.patterns[0]).not.toBe(project.instruments.bass.patterns[1]);
    expect(project.instruments.bass.patterns[0]?.notes).not.toBe(project.instruments.lead.patterns[0]?.notes);
  });
});

describe('settings', () => {
  it('keep BPM a whole number from 40 to 300', () => {
    const p = createProject();
    expect(setBpm(p, 200).bpm).toBe(200);
    expect(setBpm(p, 5).bpm).toBe(40);
    expect(setBpm(p, 1000).bpm).toBe(300);
    expect(setBpm(p, 120)).toBe(p);
  });

  it('keep volumes and the envelope from 0 to 100, one setting per instrument', () => {
    const p = createProject();
    expect(setMasterVolume(p, 150).masterVolume).toBe(100);
    const v = setVolume(p, 'bass', -4);
    expect(v.instruments.bass.volume).toBe(0);
    expect(v.instruments.lead.volume).toBe(p.instruments.lead.volume);
    const e = setEnvelope(p, 'keys', { attack: 30, release: 101 });
    expect(e.instruments.keys).toMatchObject({ attack: 30, decay: 0, release: 100 });
    expect(setEnvelope(p, 'keys', {})).toBe(p);
    expect(setMuted(p, 'drums', true).instruments.drums.muted).toBe(true);
    expect(setMuted(p, 'drums', false)).toBe(p);
  });

  it('share what did not change', () => {
    const p = createProject();
    const next = setVolume(p, 'bass', 10);
    expect(next.instruments.drums).toBe(p.instruments.drums);
    expect(next.instruments.bass.patterns).toBe(p.instruments.bass.patterns);
  });

  it('set the fret count of the bass and guitars only (5, 7 or 12)', () => {
    const p = createProject();
    expect(setFretCount(p, 'rhythm', 12).instruments.rhythm.fretCount).toBe(12);
    expect(setFretCount(p, 'bass', 5).instruments.bass.fretCount).toBe(5);
    expect(setFretCount(p, 'keys', 12)).toBe(p);
    expect(setFretCount(p, 'drums', 12)).toBe(p);
  });

  it('keep notes on frets above a lowered fret count, hidden', () => {
    let p = setFretCount(createProject(), 'lead', 12);
    p = must(addNote(p, 'lead', 0, { string: 0, fret: 11, start: 0, length: 12 }));
    p = setFretCount(p, 'lead', 5);
    expect(p.instruments.lead.patterns[0]?.notes).toHaveLength(1);
    expect(addNote(p, 'lead', 0, { string: 0, fret: 11, start: 12, length: 12 }).ok).toBe(false);
    p = setFretCount(p, 'lead', 12);
    expect(p.instruments.lead.patterns[0]?.notes).toHaveLength(1);
  });
});

describe('patterns shown', () => {
  it('select only a shown pattern', () => {
    const p = createProject();
    expect(selectPattern(p, 'bass', 19).instruments.bass.selectedPattern).toBe(19);
    expect(selectPattern(p, 'bass', 20)).toBe(p);
    expect(selectPattern(p, 'bass', -1)).toBe(p);
  });

  it('open 20 more once all 20 shown patterns are active, up to 120', () => {
    let p = createProject();
    expect(canOpenMorePatterns(p, 'drums')).toBe(false);
    expect(openMorePatterns(p, 'drums').ok).toBe(false);
    for (let i = 0; i < 20; i++) p = must(addNote(p, 'drums', i, { row: 'kick', start: 0 }));
    expect(canOpenMorePatterns(p, 'drums')).toBe(true);
    p = must(openMorePatterns(p, 'drums'));
    expect(p.instruments.drums.shownPatterns).toBe(40);
    expect(canOpenMorePatterns(p, 'drums')).toBe(false);
  });

  it('are opened by an import as far as it needs, in steps of 20', () => {
    const p = createProject();
    expect(showPatterns(p, 'keys', 18)).toBe(p);
    expect(showPatterns(p, 'keys', 21).instruments.keys.shownPatterns).toBe(40);
    expect(showPatterns(p, 'keys', 500).instruments.keys.shownPatterns).toBe(120);
  });

  it('are active once they have a note', () => {
    const p = must(addNote(createProject(), 'keys', 3, { pitch: 60, start: 0, length: 12 }));
    expect(isActive(p.instruments.keys.patterns[3]!)).toBe(true);
    expect(isActive(p.instruments.keys.patterns[2]!)).toBe(false);
  });
});

describe('switching the meter', () => {
  function withNotes(): Project {
    let p = createProject();
    p = must(addNote(p, 'drums', 0, { row: 'kick', start: 0 }));
    p = must(addNote(p, 'drums', 0, { row: 'snare', start: 36 })); // beat 4 of 4/4
    p = must(addNote(p, 'bass', 0, { string: 0, fret: 0, start: 24, length: 24 })); // runs to the end of the bar
    return p;
  }

  it('leaves notes where they are when the bar gets longer', () => {
    const p = setMeter(must(addNote(createProject(), 'drums', 0, { row: 'kick', start: 30 })), '3/4');
    expect(p.instruments.drums.patterns[0]?.notes).toEqual([{ row: 'kick', start: 30 }]);
    const back = setMeter(p, '4/4');
    expect(back.meter).toBe('4/4');
    expect(back.instruments.drums.patterns[0]?.notes).toEqual([{ row: 'kick', start: 30 }]);
  });

  it('deletes notes that fall outside the shorter bar, for good', () => {
    const three = setMeter(withNotes(), '3/4');
    expect(three.meter).toBe('3/4');
    expect(three.instruments.drums.patterns[0]?.notes).toEqual([{ row: 'kick', start: 0 }]);
    const back = setMeter(three, '4/4');
    expect(back.instruments.drums.patterns[0]?.notes).toEqual([{ row: 'kick', start: 0 }]);
  });

  it('shortens a note that runs past the new end', () => {
    const three = setMeter(withNotes(), '3/4');
    expect(three.instruments.bass.patterns[0]?.notes).toEqual([{ string: 0, fret: 0, start: 24, length: 12 }]);
  });

  it('keeps positions in a longer pattern, where the note moves to another bar line', () => {
    let p = must(setPatternBars(createProject(), 'keys', 0, 2));
    p = must(addNote(p, 'keys', 0, { pitch: 60, start: 40, length: 12 })); // bar 1 of 4/4
    const three = setMeter(p, '3/4'); // now 4 ticks into bar 2
    expect(three.instruments.keys.patterns[0]?.notes).toEqual([{ pitch: 60, start: 40, length: 12 }]);
  });

  it('deletes notes hidden past the end of a shortened pattern when they fall beyond the new bar', () => {
    let p = must(setPatternBars(createProject(), 'drums', 0, 2));
    p = must(addNote(p, 'drums', 0, { row: 'kick', start: 60 })); // bar 2
    p = must(setPatternBars(p, 'drums', 0, 1)); // kept, hidden
    expect(p.instruments.drums.patterns[0]?.notes).toHaveLength(1);
    p = setMeter(p, '3/4');
    expect(p.instruments.drums.patterns[0]?.notes).toHaveLength(0);
  });

  it('is a no-op for the same meter, and shares unchanged instruments', () => {
    const p = withNotes();
    expect(setMeter(p, '4/4')).toBe(p);
    const three = setMeter(p, '3/4');
    expect(three.instruments.keys).toBe(p.instruments.keys);
  });
});
