/**
 * The file state of a project, as pure functions: whether it has unsaved changes, what the window
 * title says, and the file name rules. The dialogs and the writing are in electron/main/files.ts.
 */
import { INSTRUMENT_IDS } from './instruments';
import type { Instrument, Project } from './project';

/** The extension of a saved project (assumed; docs/open-items.md). The content is the JSON of `serializeProject`. */
export const FILE_EXTENSION = 'modernstudio';

export const UNTITLED = 'Untitled';

/** Deep comparison of plain JSON data (patterns, notes, blocks). Shared objects are skipped at once. */
function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  return keys.every((key) => key in y && sameData(x[key], y[key]));
}

function sameInstrument(a: Instrument, b: Instrument): boolean {
  if (a === b) return true;
  // Which pattern is selected and how many are shown are choices, not edits (as for Undo), so they are not compared.
  return (
    a.volume === b.volume &&
    a.muted === b.muted &&
    a.attack === b.attack &&
    a.decay === b.decay &&
    a.release === b.release &&
    a.fretCount === b.fretCount &&
    sameData(a.patterns, b.patterns) &&
    sameData(a.lane, b.lane)
  );
}

/**
 * Whether the project differs from the one last saved. Choosing a pattern, or opening more patterns
 * (which only shows empty ones), is not an edit and does not count.
 */
export function isDirty(present: Project, saved: Project): boolean {
  if (present === saved) return false;
  if (present.bpm !== saved.bpm || present.meter !== saved.meter || present.masterVolume !== saved.masterVolume) return true;
  return INSTRUMENT_IDS.some((id) => !sameInstrument(present.instruments[id], saved.instruments[id]));
}

/** The last part of a path, either kind of separator. */
export function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}

/** The name of a project file without its extension: "C:\songs\demo.modernstudio" is "demo". */
export function projectName(path: string | null): string {
  if (path === null) return UNTITLED;
  const name = baseName(path);
  const suffix = `.${FILE_EXTENSION}`;
  const stem = name.toLowerCase().endsWith(suffix) ? name.slice(0, -suffix.length) : name;
  return stem === '' ? UNTITLED : stem;
}

/**
 * The name shown for a project: the file's name, or, for a project that has no file yet, the draft name
 * it was given (a MIDI import is named after its MIDI file), or "Untitled".
 */
export function displayName(path: string | null, draftName: string | null = null): string {
  if (path !== null) return projectName(path);
  return draftName !== null && draftName.trim() !== '' ? draftName : UNTITLED;
}

/** "demo - modernstudio", with a leading "* " while there are unsaved changes (assumed; docs/open-items.md). */
export function windowTitle(path: string | null, dirty: boolean, appName: string, draftName: string | null = null): string {
  return `${dirty ? '* ' : ''}${displayName(path, draftName)} - ${appName}`;
}

export function hasProjectExtension(path: string): boolean {
  return path.toLowerCase().endsWith(`.${FILE_EXTENSION}`);
}

/** Adds the extension when the chosen name has none of its own. */
export function ensureExtension(path: string): string {
  return hasProjectExtension(path) ? path : `${path}.${FILE_EXTENSION}`;
}
