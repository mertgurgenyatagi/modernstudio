/** Keyboard rules that need no window to test. */

/** The few facts about the focused element that decide whether a key press is typing. */
export interface KeyTarget {
  tagName: string;
  type?: string;
  isContentEditable?: boolean;
}

/** Input types that take no typed text: Space must reach the transport, not the field. */
const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image']);

/** Whether the focused element is somewhere the user types, where Space must stay a space. */
export function isTypingTarget(target: KeyTarget | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.has((target.type ?? 'text').toLowerCase());
  return false;
}
