/**
 * The application menu. File holds New, Open, Save and Save As with their shortcuts. The menu stays
 * hidden until Alt is pressed (the window is made with autoHideMenuBar), but the shortcuts work all
 * the time. A click sends the command to the window, which owns the project and asks about unsaved changes.
 */
import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron';
import { CHANNELS, type FileCommand } from '../../src/core/fileBridge';

function send(command: FileCommand, focused: BrowserWindow | undefined): void {
  const win = focused ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  win?.webContents.send(CHANNELS.command, command);
}

export function installMenu(development: boolean): void {
  const file: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      { label: 'New', accelerator: 'CmdOrCtrl+N', click: (_item, win) => send('new', win as BrowserWindow | undefined) },
      { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: (_item, win) => send('open', win as BrowserWindow | undefined) },
      { type: 'separator' },
      { label: 'Save', accelerator: 'CmdOrCtrl+S', click: (_item, win) => send('save', win as BrowserWindow | undefined) },
      { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: (_item, win) => send('saveAs', win as BrowserWindow | undefined) },
      { type: 'separator' },
      { role: 'quit', label: 'Exit' },
    ],
  };
  const template: MenuItemConstructorOptions[] = [file];
  // Reload and the developer tools, only while developing.
  if (development) template.push({ label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }] });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
