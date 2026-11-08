import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_WINDOW } from './constants';

describe('default window', () => {
  it('is 960 by 540, as decided in docs/design.md', () => {
    expect(DEFAULT_WINDOW).toEqual({ width: 960, height: 540 });
  });
});

describe('design tokens', () => {
  const css = readFileSync(join(__dirname, '../styles/tokens.css'), 'utf8');

  it('holds every decided colour at its decided value', () => {
    const decided: Record<string, string> = {
      '--color-paper': 'oklch(96.5% 0.006 90)',
      '--color-paper-2': 'oklch(99% 0.004 90)',
      '--color-paper-3': 'oklch(94% 0.006 90)',
      '--color-ink': 'oklch(18% 0.006 90)',
      '--color-muted': 'oklch(44% 0.006 90)',
      '--color-rule': 'oklch(79% 0.006 90)',
      '--color-accent': 'oklch(18% 0.006 90)',
      '--color-accent-ink': 'oklch(97% 0.005 90)',
      '--color-focus': 'oklch(18% 0.006 90)',
    };
    for (const [name, value] of Object.entries(decided)) {
      expect(css).toContain(`${name}: ${value};`);
    }
  });

  it('holds the three decided font faces', () => {
    expect(css).toContain("--font-display: 'Piazzolla'");
    expect(css).toContain("--font-body: 'Golos Text'");
    expect(css).toContain("--font-outlier: 'Fragment Mono'");
  });
});
