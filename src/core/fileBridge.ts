/**
 * What the window can ask of the main process, and the channel names both sides use. Types and
 * names only, so the preload script, the main process and the renderer agree. One narrow function per
 * command (electron/preload exposes it as `window.studio.files`).
 */

export const CHANNELS = {
  loadLast: 'files:load-last',
  open: 'files:open',
  save: 'files:save',
  saveAs: 'files:save-as',
  exportWav: 'files:export-wav',
  exportMidi: 'files:export-midi',
  chooseMidi: 'files:choose-midi',
  confirmDiscard: 'files:confirm-discard',
  setDirty: 'files:set-dirty',
  closeWindow: 'files:close-window',
  command: 'files:command',
  closeRequested: 'files:close-requested',
} as const;

/** The File menu commands, sent from the menu and the shortcuts to the window. */
export type FileCommand = 'new' | 'open' | 'save' | 'saveAs';

/** What the file at a path held, as text. The renderer checks it with `parseProject`. */
export interface OpenedFile {
  kind: 'opened';
  path: string;
  text: string;
}

export type LoadLastResult = OpenedFile | { kind: 'none'; notice?: string };
export type OpenResult = OpenedFile | { kind: 'cancelled' } | { kind: 'error'; message: string };
export type SaveResult = { kind: 'saved'; path: string } | { kind: 'cancelled' } | { kind: 'error'; message: string };

/** A MIDI file picked to import: its name (with extension) and its bytes. */
export type ChooseMidiResult = { kind: 'chosen'; name: string; bytes: Uint8Array } | { kind: 'cancelled' } | { kind: 'error'; message: string };

/** The largest MIDI file the app will read (a song is a few tens of kilobytes). */
export const MIDI_IMPORT_MAX_BYTES = 16 * 1024 * 1024;

/** The three answers of the "save changes?" dialog. */
export type DiscardChoice = 'save' | 'discard' | 'cancel';

export interface FilesBridge {
  /** The last project the app saved or opened, read at start. */
  loadLast(): Promise<LoadLastResult>;
  /** Shows the Open dialog. */
  open(): Promise<OpenResult>;
  /** Saves to `path`, or asks where when `path` is null. */
  save(path: string | null, text: string, suggestedName: string): Promise<SaveResult>;
  /** Always asks where. */
  saveAs(text: string, suggestedName: string): Promise<SaveResult>;
  /** Asks where, then writes the bytes of a WAV file there. `suggestedName` is the file name with its extension. */
  exportWav(bytes: Uint8Array, suggestedName: string): Promise<SaveResult>;
  /** Asks where, then writes the bytes of a MIDI file there. `suggestedName` is the file name with its extension. */
  exportMidi(bytes: Uint8Array, suggestedName: string): Promise<SaveResult>;
  /** Shows the Open dialog for a `.mid` or `.midi` file and reads it. Nothing is remembered. */
  chooseMidi(): Promise<ChooseMidiResult>;
  /** The native "Save changes to …?" dialog. */
  confirmDiscard(name: string): Promise<DiscardChoice>;
  /** Tells the main process whether there are unsaved changes, so it can hold back closing. */
  setDirty(dirty: boolean): void;
  /** Closes the window for good, past the unsaved-changes check (the window has already asked). */
  closeWindow(): void;
  /** A File menu command or shortcut was used. Returns the function that stops listening. */
  onCommand(listener: (command: FileCommand) => void): () => void;
  /** The user tried to close the window while there are unsaved changes. */
  onCloseRequested(listener: () => void): () => void;
}

export interface StudioBridge {
  files: FilesBridge;
}
