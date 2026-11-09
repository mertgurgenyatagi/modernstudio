import { describe, expect, it } from 'vitest';
import { ensureExtension, hasProjectExtension, isDirty, projectName, windowTitle } from './fileState';
import { addNote, setPatternBars } from './patterns';
import { createProject, openMorePatterns, selectPattern, setBpm, setMasterVolume } from './project';
import { DEFAULT_SETTINGS, parseSettings, serializeSettings } from './settings';
import { parseProject, serializeProject } from './serialize';
import { placeBlock } from './song';
import { must } from './testing';

const saved = createProject();

describe('isDirty', () => {
  it('is false for the very same project', () => {
    expect(isDirty(saved, saved)).toBe(false);
  });

  it('is false for a project that reads back from its own file', () => {
    const parsed = parseProject(serializeProject(saved));
    expect(parsed.ok && isDirty(parsed.project, saved)).toBe(false);
  });

  it('is true after an edit, and false again when the edit is reversed', () => {
    const edited = setBpm(saved, 100);
    expect(isDirty(edited, saved)).toBe(true);
    expect(isDirty(setBpm(edited, 120), saved)).toBe(false);
  });

  it('counts master volume, notes, pattern length and Song blocks', () => {
    expect(isDirty(setMasterVolume(saved, 10), saved)).toBe(true);
    const withNote = must(addNote(saved, 'drums', 0, { row: 'kick', start: 0 }));
    expect(isDirty(withNote, saved)).toBe(true);
    expect(isDirty(must(setPatternBars(saved, 'bass', 0, 2)), saved)).toBe(true);
    const withKeysNote = must(addNote(saved, 'keys', 0, { pitch: 60, start: 0, length: 12 }));
    expect(isDirty(must(placeBlock(withKeysNote, 'keys', 0, 0)), withKeysNote)).toBe(true);
  });

  it('does not count choosing a pattern', () => {
    expect(isDirty(selectPattern(saved, 'drums', 3), saved)).toBe(false);
  });

  it('does not count opening more patterns once every shown one has a note', () => {
    let p = saved;
    for (let i = 0; i < 20; i++) p = must(addNote(p, 'drums', i, { row: 'kick', start: 0 }));
    const opened = must(openMorePatterns(p, 'drums'));
    expect(opened.instruments.drums.shownPatterns).toBe(40);
    expect(isDirty(opened, p)).toBe(false);
  });

  it('compares notes by value, not identity', () => {
    const a = must(addNote(saved, 'drums', 0, { row: 'kick', start: 0 }));
    const b = must(addNote(saved, 'drums', 0, { row: 'kick', start: 0 }));
    expect(a).not.toBe(b);
    expect(isDirty(a, b)).toBe(false);
  });
});

describe('names and titles', () => {
  it('names a project by its file, without the extension', () => {
    expect(projectName('C:\\songs\\demo.modernstudio')).toBe('demo');
    expect(projectName('/home/me/My Song.MODERNSTUDIO')).toBe('My Song');
    expect(projectName('C:\\songs\\odd.txt')).toBe('odd.txt');
    expect(projectName(null)).toBe('Untitled');
  });

  it('puts the name before the app name and marks unsaved changes', () => {
    expect(windowTitle('C:\\songs\\demo.modernstudio', false, 'modernstudio')).toBe('demo - modernstudio');
    expect(windowTitle('C:\\songs\\demo.modernstudio', true, 'modernstudio')).toBe('* demo - modernstudio');
    expect(windowTitle(null, true, 'modernstudio')).toBe('* Untitled - modernstudio');
  });

  it('adds the extension only when it is missing', () => {
    expect(hasProjectExtension('a.modernstudio')).toBe(true);
    expect(ensureExtension('a')).toBe('a.modernstudio');
    expect(ensureExtension('a.modernstudio')).toBe('a.modernstudio');
    expect(ensureExtension('a.MODERNSTUDIO')).toBe('a.MODERNSTUDIO');
  });
});

describe('settings', () => {
  it('reads the last project', () => {
    expect(parseSettings('{"lastProject":"C:\\\\songs\\\\a.modernstudio"}')).toEqual({ lastProject: 'C:\\songs\\a.modernstudio' });
  });

  it('gives the defaults for a missing, broken or odd file', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('[1,2]')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{}')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"lastProject":7}')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"lastProject":""}')).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips', () => {
    const settings = { lastProject: 'D:\\x\\y.modernstudio' };
    expect(parseSettings(serializeSettings(settings))).toEqual(settings);
  });
});
