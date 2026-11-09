/**
 * The file commands of the main process: Open, Save, Save As, the "save changes?" dialog, the path of
 * the last project, and holding back closing while there are unsaved changes. The dialogs and the
 * writing are not exercised by the unit tests (they need a window); the pure parts they rely on
 * (src/core/fileState.ts and settings.ts) are.
 */
import { randomBytes } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { APP_NAME } from '../../src/core/constants';
import {
  CHANNELS,
  type DiscardChoice,
  type LoadLastResult,
  type OpenedFile,
  type OpenResult,
  type SaveResult,
} from '../../src/core/fileBridge';
import { FILE_EXTENSION, baseName, ensureExtension, hasProjectExtension, projectName } from '../../src/core/fileState';
import { parseSettings, serializeSettings } from '../../src/core/settings';
import { MIDI_EXTENSION, ensureMidiExtension } from '../../src/core/midi/export';
import { WAV_EXTENSION, ensureWavExtension } from '../../src/core/wav';

const FILTERS = [{ name: `${APP_NAME} project`, extensions: [FILE_EXTENSION] }];

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

async function readLastProject(): Promise<string | null> {
  const text = await readFile(settingsPath(), 'utf8').catch(() => null);
  return parseSettings(text).lastProject;
}

/** Remembers the project to reopen at start. A failure to write the settings is not worth bothering the user with. */
async function rememberProject(path: string): Promise<void> {
  try {
    await writeFileAtomic(settingsPath(), serializeSettings({ lastProject: path }));
  } catch {
    // The project itself was written; only the reopening at start is lost.
  }
}

/** Writes a temporary file beside the target and renames it over, so a failed write never destroys the old file. */
export async function writeFileAtomic(path: string, text: string | Uint8Array): Promise<void> {
  const temporary = `${path}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    await writeFile(temporary, text, typeof text === 'string' ? 'utf8' : undefined);
    await rename(temporary, path);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function windowOf(event: IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(event.sender) ?? undefined;
}

function isText(value: unknown): value is string {
  return typeof value === 'string';
}

function isProjectPath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !value.includes('\0') && hasProjectExtension(value);
}

async function readProject(path: string): Promise<OpenedFile | { kind: 'error'; message: string }> {
  try {
    return { kind: 'opened', path, text: await readFile(path, 'utf8') };
  } catch (error) {
    return { kind: 'error', message: messageOf(error) };
  }
}

async function loadLast(): Promise<LoadLastResult> {
  const path = await readLastProject();
  if (path === null) return { kind: 'none' };
  const result = await readProject(path);
  if (result.kind === 'opened') return result;
  const name = baseName(path);
  return { kind: 'none', notice: `The last project, ${name}, could not be opened (${result.message}). Starting a new project.` };
}

async function open(win: BrowserWindow | undefined): Promise<OpenResult> {
  const options = { title: 'Open project', filters: FILTERS, properties: ['openFile' as const] };
  const chosen = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
  const path = chosen.filePaths[0];
  if (chosen.canceled || path === undefined) return { kind: 'cancelled' };
  const result = await readProject(path);
  if (result.kind === 'opened') {
    await rememberProject(path);
    return result;
  }
  return { kind: 'error', message: `${baseName(path)} could not be read: ${result.message}` };
}

async function writeProject(path: string, text: string): Promise<SaveResult> {
  try {
    await writeFileAtomic(path, text);
  } catch (error) {
    return { kind: 'error', message: `${baseName(path)} could not be saved: ${messageOf(error)}` };
  }
  await rememberProject(path);
  return { kind: 'saved', path };
}

async function saveAs(win: BrowserWindow | undefined, text: string, suggestedName: string): Promise<SaveResult> {
  const options = {
    title: 'Save project',
    defaultPath: join(app.getPath('documents'), `${suggestedName}.${FILE_EXTENSION}`),
    filters: FILTERS,
  };
  const chosen = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
  if (chosen.canceled || !chosen.filePath) return { kind: 'cancelled' };
  return writeProject(ensureExtension(chosen.filePath), text);
}

/** Asks where to put the WAV export and writes it. The export does not change the project, so it is not remembered. */
async function exportWav(win: BrowserWindow | undefined, bytes: Uint8Array, suggestedName: string): Promise<SaveResult> {
  const options = {
    title: 'Export WAV',
    defaultPath: join(app.getPath('documents'), baseName(suggestedName)),
    filters: [{ name: 'WAV audio', extensions: [WAV_EXTENSION] }],
  };
  const chosen = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
  if (chosen.canceled || !chosen.filePath) return { kind: 'cancelled' };
  const path = ensureWavExtension(chosen.filePath);
  try {
    await writeFileAtomic(path, bytes);
  } catch (error) {
    return { kind: 'error', message: `${baseName(path)} could not be exported: ${messageOf(error)}` };
  }
  return { kind: 'saved', path };
}

/** Asks where to put the MIDI export and writes it. Like the WAV export, it is not remembered and does not change the project. */
async function exportMidi(win: BrowserWindow | undefined, bytes: Uint8Array, suggestedName: string): Promise<SaveResult> {
  const options = {
    title: 'Export MIDI',
    defaultPath: join(app.getPath('documents'), baseName(suggestedName)),
    filters: [{ name: 'MIDI file', extensions: [MIDI_EXTENSION, 'midi'] }],
  };
  const chosen = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
  if (chosen.canceled || !chosen.filePath) return { kind: 'cancelled' };
  const path = ensureMidiExtension(chosen.filePath);
  try {
    await writeFileAtomic(path, bytes);
  } catch (error) {
    return { kind: 'error', message: `${baseName(path)} could not be exported: ${messageOf(error)}` };
  }
  return { kind: 'saved', path };
}

async function confirmDiscard(win: BrowserWindow | undefined, name: string): Promise<DiscardChoice> {
  const options = {
    type: 'warning' as const,
    title: APP_NAME,
    message: `Save changes to "${name}"?`,
    detail: 'Your changes will be lost if you do not save them.',
    buttons: ['Save', "Don't save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  };
  const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
  return response === 0 ? 'save' : response === 1 ? 'discard' : 'cancel';
}

/** Per window: whether the window holds unsaved changes (told by the window), and whether it may close now. */
const dirtyWindows = new WeakSet<BrowserWindow>();
const closeAllowed = new WeakSet<BrowserWindow>();

/** Holds back closing while there are unsaved changes: the window is asked, and closes itself when the user has chosen. */
export function guardClosing(win: BrowserWindow): void {
  win.on('close', (event) => {
    if (closeAllowed.has(win) || !dirtyWindows.has(win) || win.webContents.isDestroyed() || win.webContents.isCrashed()) return;
    event.preventDefault();
    win.webContents.send(CHANNELS.closeRequested);
  });
}

/** Registers the handlers the preload script calls. Call once, before the first window. */
export function registerFileHandlers(): void {
  ipcMain.handle(CHANNELS.loadLast, () => loadLast());
  ipcMain.handle(CHANNELS.open, (event) => open(windowOf(event)));
  ipcMain.handle(CHANNELS.save, async (event, path: unknown, text: unknown, suggestedName: unknown): Promise<SaveResult> => {
    if (!isText(text) || !isText(suggestedName)) return { kind: 'error', message: 'The project could not be read for saving.' };
    if (path === null) return saveAs(windowOf(event), text, suggestedName);
    if (!isProjectPath(path)) return { kind: 'error', message: 'That is not a project file path.' };
    return writeProject(path, text);
  });
  ipcMain.handle(CHANNELS.saveAs, (event, text: unknown, suggestedName: unknown): Promise<SaveResult> | SaveResult => {
    if (!isText(text) || !isText(suggestedName)) return { kind: 'error', message: 'The project could not be read for saving.' };
    return saveAs(windowOf(event), text, suggestedName);
  });
  ipcMain.handle(CHANNELS.exportWav, (event, bytes: unknown, suggestedName: unknown): Promise<SaveResult> | SaveResult => {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0 || !isText(suggestedName)) {
      return { kind: 'error', message: 'The audio could not be read for exporting.' };
    }
    return exportWav(windowOf(event), bytes, suggestedName);
  });
  ipcMain.handle(CHANNELS.exportMidi, (event, bytes: unknown, suggestedName: unknown): Promise<SaveResult> | SaveResult => {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0 || !isText(suggestedName)) {
      return { kind: 'error', message: 'The MIDI file could not be read for exporting.' };
    }
    return exportMidi(windowOf(event), bytes, suggestedName);
  });
  ipcMain.handle(CHANNELS.confirmDiscard, (event, name: unknown) => confirmDiscard(windowOf(event), isText(name) ? name : projectName(null)));
  ipcMain.on(CHANNELS.setDirty, (event, dirty: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (dirty === true) dirtyWindows.add(win);
    else dirtyWindows.delete(win);
  });
  ipcMain.on(CHANNELS.closeWindow, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    closeAllowed.add(win);
    win.close();
  });
}
