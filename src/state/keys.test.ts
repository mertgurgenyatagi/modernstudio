import { describe, expect, it } from 'vitest';
import { commandLetter, isTypingTarget } from './keys';

describe('isTypingTarget', () => {
  it('is typing in text fields', () => {
    expect(isTypingTarget({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'number' })).toBe(true);
    expect(isTypingTarget({ tagName: 'input' })).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('is not typing on sliders, buttons and the page', () => {
    expect(isTypingTarget({ tagName: 'INPUT', type: 'range' })).toBe(false);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTypingTarget({ tagName: 'BODY' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('commandLetter', () => {
  const press = (key: string, code: string, ctrlKey = true, altKey = false) => ({ key, code, ctrlKey, metaKey: false, altKey });

  it('reads the letter of a Ctrl shortcut', () => {
    expect(commandLetter(press('z', 'KeyZ'))).toBe('z');
    expect(commandLetter(press('C', 'KeyC'))).toBe('c');
  });

  it('reads the letter from the place of the key when the layout gives no Latin letter', () => {
    expect(commandLetter(press('ч', 'KeyX'))).toBe('x');
  });

  it('is nothing without Ctrl, with Alt, or for a key that is not a letter', () => {
    expect(commandLetter(press('z', 'KeyZ', false))).toBeNull();
    expect(commandLetter(press('z', 'KeyZ', true, true))).toBeNull();
    expect(commandLetter(press('ArrowUp', 'ArrowUp'))).toBeNull();
  });
});
