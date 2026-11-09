import { describe, expect, it } from 'vitest';
import { addNote, setPatternBars } from './patterns';
import { createProject, setBpm, setFretCount, setMeter, setMuted, showPatterns, type Project } from './project';
import { FILE_FORMAT, FILE_VERSION, parseProject, serializeProject } from './serialize';
import { placeBlock } from './song';
import { must } from './testing';

function busy(): Project {
  let p = setBpm(createProject(), 146);
  p = setMeter(p, '3/4');
  p = setFretCount(p, 'lead', 12);
  p = setMuted(p, 'keys', true);
  p = must(addNote(p, 'drums', 0, { row: 'kick', start: 0 }));
  p = must(addNote(p, 'drums', 0, { row: 'openHihat', start: 9 }));
  p = must(addNote(p, 'lead', 3, { string: 5, fret: 12, start: 4, length: 4 }));
  p = must(addNote(p, 'keys', 0, { pitch: 84, start: 0, length: 36 }));
  p = must(setPatternBars(p, 'keys', 0, 8));
  p = must(addNote(p, 'keys', 0, { pitch: 40, start: 200, length: 12 }));
  p = must(placeBlock(p, 'drums', 0, 4));
  p = must(placeBlock(p, 'drums', 0, 0));
  p = showPatterns(p, 'bass', 30);
  return p;
}

describe('saving', () => {
  it('writes JSON with a format name and a version number', () => {
    const file = JSON.parse(serializeProject(createProject())) as Record<string, unknown>;
    expect(file.format).toBe(FILE_FORMAT);
    expect(file.version).toBe(FILE_VERSION);
    expect(file.version).toBe(1);
    expect(file.project).toBeDefined();
  });

  it('round-trips a new project and a busy one exactly', () => {
    for (const p of [createProject(), busy()]) {
      const back = parseProject(serializeProject(p));
      expect(back.ok).toBe(true);
      if (back.ok) expect(back.project).toEqual(p);
    }
  });

  it('keeps notes a switch to 3/4 hid, even past the end of the longest 3/4 pattern', () => {
    let p = must(setPatternBars(createProject(), 'drums', 0, 8));
    p = must(addNote(p, 'drums', 0, { row: 'kick', start: 372 })); // the last beat of bar 8 in 4/4
    p = setMeter(p, '3/4'); // 8 bars of 3/4 end at 288
    const back = parseProject(serializeProject(p));
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.project).toEqual(p);
  });
});

describe('opening', () => {
  function edited(change: (project: Record<string, any>) => void): string { // eslint-disable-line @typescript-eslint/no-explicit-any
    const file = JSON.parse(serializeProject(busy())) as { project: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
    change(file.project);
    return JSON.stringify(file);
  }

  function refusedWith(text: string): string {
    const result = parseProject(text);
    expect(result.ok).toBe(false);
    return result.ok ? '' : result.reason;
  }

  it('refuses text that is not JSON, or JSON that is not a project file', () => {
    expect(refusedWith('not json')).toMatch(/not valid JSON/);
    expect(refusedWith('[]')).toMatch(/damaged/);
    expect(refusedWith('{"format":"other","version":1,"project":{}}')).toMatch(/not a modernstudio file/);
    expect(refusedWith('null')).toMatch(/damaged/);
  });

  it('refuses a missing, invalid or newer version', () => {
    expect(refusedWith(JSON.stringify({ format: FILE_FORMAT, project: {} }))).toMatch(/version/);
    expect(refusedWith(JSON.stringify({ format: FILE_FORMAT, version: 0, project: {} }))).toMatch(/version/);
    expect(refusedWith(JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION + 1, project: {} }))).toMatch(/newer/);
  });

  it('refuses a BPM, meter or volume out of range', () => {
    expect(refusedWith(edited((p) => (p.bpm = 39)))).toMatch(/bpm/);
    expect(refusedWith(edited((p) => (p.bpm = 120.5)))).toMatch(/bpm/);
    expect(refusedWith(edited((p) => (p.meter = '6/8')))).toMatch(/meter/);
    expect(refusedWith(edited((p) => (p.masterVolume = 101)))).toMatch(/masterVolume/);
    expect(refusedWith(edited((p) => (p.instruments.bass.volume = -1)))).toMatch(/bass.volume/);
    expect(refusedWith(edited((p) => (p.instruments.bass.attack = 'x')))).toMatch(/attack/);
  });

  it('refuses a missing instrument or the wrong number of patterns', () => {
    expect(refusedWith(edited((p) => delete p.instruments.keys))).toMatch(/keys/);
    expect(refusedWith(edited((p) => p.instruments.drums.patterns.pop()))).toMatch(/120 patterns/);
    expect(refusedWith(edited((p) => (p.instruments.drums.patterns[0].bars = 3)))).toMatch(/bars/);
  });

  it('refuses a note the layout cannot hold', () => {
    expect(refusedWith(edited((p) => (p.instruments.drums.patterns[0].notes[0].row = 'ride')))).toMatch(/row/);
    expect(refusedWith(edited((p) => (p.instruments.drums.patterns[0].notes[0].start = 1)))).toMatch(/grid/);
    expect(refusedWith(edited((p) => (p.instruments.keys.patterns[0].notes[0].pitch = 20)))).toMatch(/C2 to C6/);
    expect(refusedWith(edited((p) => (p.instruments.lead.patterns[3].notes[0].string = 6)))).toMatch(/string/);
    expect(refusedWith(edited((p) => (p.instruments.lead.patterns[3].notes[0].fret = 13)))).toMatch(/fret/);
    expect(refusedWith(edited((p) => (p.instruments.lead.patterns[3].notes[0].extra = 1)))).toMatch(/unexpected/);
    expect(refusedWith(edited((p) => p.instruments.drums.patterns[0].notes.push({ row: 'kick', start: 400 })))).toMatch(/inside/);
  });

  it('refuses a lane that overlaps or points at a pattern that is not shown', () => {
    expect(refusedWith(edited((p) => p.instruments.drums.lane.push({ pattern: 0, startBar: 4 })))).toMatch(/overlap/);
    expect(refusedWith(edited((p) => p.instruments.drums.lane.push({ pattern: 20, startBar: 9 })))).toMatch(/pattern/);
    expect(refusedWith(edited((p) => (p.instruments.drums.lane[0].startBar = 256)))).toMatch(/startBar/);
  });

  it('refuses a fret count on Keys or a wrong one on a guitar', () => {
    expect(refusedWith(edited((p) => (p.instruments.keys.fretCount = 7)))).toMatch(/fretCount/);
    expect(refusedWith(edited((p) => (p.instruments.bass.fretCount = 9)))).toMatch(/fretCount/);
    expect(refusedWith(edited((p) => (p.instruments.bass.fretCount = null)))).toMatch(/fretCount/);
  });

  it('refuses a selected pattern that is not shown, and a shown count that is not a multiple of 20', () => {
    expect(refusedWith(edited((p) => (p.instruments.drums.selectedPattern = 20)))).toMatch(/selectedPattern/);
    expect(refusedWith(edited((p) => (p.instruments.drums.shownPatterns = 25)))).toMatch(/multiple of 20/);
  });

  it('sorts a lane that was saved out of order', () => {
    const result = parseProject(edited((p) => p.instruments.drums.lane.reverse()));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.project.instruments.drums.lane.map((b) => b.startBar)).toEqual([0, 4]);
  });
});
