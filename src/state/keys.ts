/** Keyboard rules that need no window to test. */

/** The few facts about the focused element that decide whether a key press is typing. */
export interface KeyTarget {
  tagName: string;
  type?: string;
  isContentEditable?: boolean;
}

/** Input types that take no typed text: Space must reach the transport, not the field. */
const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image']);

/** The facts of a key press that decide a shortcut. */
export interface KeyPress {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

/**
 * The letter of a Ctrl shortcut (Ctrl+Z, Ctrl+C and so on), lower case, or null when Ctrl is not held
 * or Alt is. The letter is read from the key the layout gives, and from the key's place on the board
 * when the layout gives no Latin letter.
 */
export function commandLetter(press: KeyPress): string | null {
  if (!(press.ctrlKey || press.metaKey) || press.altKey) return null;
  if (/^[a-z]$/i.test(press.key)) return press.key.toLowerCase();
  const match = /^Key([A-Z])$/.exec(press.code);
  return match?.[1] ? match[1].toLowerCase() : null;
}

/** Whether the focused element is somewhere the user types, where Space must stay a space. */
export function isTypingTarget(target: KeyTarget | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.has((target.type ?? 'text').toLowerCase());
  return false;
}
