// The bridge between the window and the main process: one narrow, typed function per command
// (the types are shared with the renderer in src/core/fileBridge.ts). Export commands are added here.
import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS, type FileCommand, type FilesBridge, type StudioBridge } from '../../src/core/fileBridge';

/** Listens to a channel the main process sends on, and returns the function that stops listening. */
function listen<T extends unknown[]>(channel: string, listener: (...args: T) => void): () => void {
  const handler = (_event: unknown, ...args: unknown[]) => listener(...(args as T));
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const files: FilesBridge = {
  loadLast: () => ipcRenderer.invoke(CHANNELS.loadLast),
  open: () => ipcRenderer.invoke(CHANNELS.open),
  save: (path, text, suggestedName) => ipcRenderer.invoke(CHANNELS.save, path, text, suggestedName),
  saveAs: (text, suggestedName) => ipcRenderer.invoke(CHANNELS.saveAs, text, suggestedName),
  exportWav: (bytes, suggestedName) => ipcRenderer.invoke(CHANNELS.exportWav, bytes, suggestedName),
  exportMidi: (bytes, suggestedName) => ipcRenderer.invoke(CHANNELS.exportMidi, bytes, suggestedName),
  confirmDiscard: (name) => ipcRenderer.invoke(CHANNELS.confirmDiscard, name),
  setDirty: (dirty) => ipcRenderer.send(CHANNELS.setDirty, dirty),
  closeWindow: () => ipcRenderer.send(CHANNELS.closeWindow),
  onCommand: (listener) => listen<[FileCommand]>(CHANNELS.command, listener),
  onCloseRequested: (listener) => listen<[]>(CHANNELS.closeRequested, listener),
};

const studio: StudioBridge = { files };
contextBridge.exposeInMainWorld('studio', studio);
