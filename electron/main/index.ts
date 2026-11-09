import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import { APP_NAME, DEFAULT_WINDOW } from '../../src/core/constants';
import { guardClosing, registerFileHandlers } from './files';
import { installMenu } from './menu';

function createWindow(): void {
  const win = new BrowserWindow({
    title: APP_NAME,
    // 960 by 540 is the area inside the frame, so every page can rely on it.
    width: DEFAULT_WINDOW.width,
    height: DEFAULT_WINDOW.height,
    useContentSize: true,
    resizable: true,
    maximizable: true,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#f5f3ef',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  guardClosing(win);

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(() => {
  registerFileHandlers();
  installMenu(Boolean(process.env['ELECTRON_RENDERER_URL']));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
