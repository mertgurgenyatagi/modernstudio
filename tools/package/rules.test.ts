import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyFilesRules, findProblems, readFilesRules } from './rules.mjs';

const repo = [
  'package.json',
  'out/main/index.js',
  'out/preload/index.cjs',
  'out/renderer/index.html',
  'out/renderer/assets/index-abc.js',
  'out/renderer/assets/index-abc.js.map',
  'out/renderer/assets/bass_28-x.wav',
  'out/renderer/assets/piazzolla-x.woff2',
  'docs/README.md',
  'midis/song.mid',
  'tools/midi-prototype/pipeline.py',
  'questionnaires/q1.html',
  'src/core/model.ts',
  'src/core/model.test.ts',
  'src/core/midi/fixtures/chunk.json',
  'electron/main/index.ts',
  '.claude/settings.json',
  '.serena/project.yml',
  'README.md',
];

describe('the package rules', () => {
  const rules = readFilesRules(readFileSync('electron-builder.yml', 'utf8'));

  it('reads the files list of electron-builder.yml', () => {
    expect(rules).toContain('out/**');
    expect(rules).toContain('package.json');
  });

  it('keeps the build and package.json and nothing else', () => {
    const kept = applyFilesRules(rules, repo);
    expect(kept).toEqual([
      'package.json',
      'out/main/index.js',
      'out/preload/index.cjs',
      'out/renderer/index.html',
      'out/renderer/assets/index-abc.js',
      'out/renderer/assets/bass_28-x.wav',
      'out/renderer/assets/piazzolla-x.woff2',
    ]);
    expect(findProblems(kept)).toEqual([]);
  });

  it('flags everything the app does not run', () => {
    const paths = findProblems(repo).map((p) => p.path);
    for (const p of [
      'docs/README.md',
      'midis/song.mid',
      'tools/midi-prototype/pipeline.py',
      'questionnaires/q1.html',
      'src/core/model.ts',
      'src/core/model.test.ts',
      'src/core/midi/fixtures/chunk.json',
      'electron/main/index.ts',
      '.claude/settings.json',
      '.serena/project.yml',
      'README.md',
      'out/renderer/assets/index-abc.js.map',
    ]) {
      expect(paths).toContain(p);
    }
    expect(paths).not.toContain('out/renderer/index.html');
  });

  it('flags tests, fixtures and node_modules even inside out/, and reads asar-style paths', () => {
    const paths = findProblems([
      '/out/renderer/x.test.js',
      '/out/fixtures/a.json',
      '/node_modules/react/index.js',
      '/out/main/index.js',
      '/package.json',
    ]).map((p) => p.path);
    expect(paths).toEqual(['out/renderer/x.test.js', 'out/fixtures/a.json', 'node_modules/react/index.js']);
  });

  it('has no production dependencies, so no node_modules is packed', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies?: object };
    expect(Object.keys(pkg.dependencies ?? {})).toEqual([]);
  });
});
