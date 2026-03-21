const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { CollabServer } = require('./collab-server');

const APP_ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(app.getPath('userData'), 'gp_data.json');

let win = null;
const collabServer = new CollabServer();

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(APP_ROOT, 'public/icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
  });

  if (app.isPackaged) {
    win.loadFile(path.join(APP_ROOT, 'dist/index.html'));
  } else {
    win.loadURL('http://localhost:5173');
  }
}

ipcMain.on('load-data-sync', (event) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      event.returnValue = fs.readFileSync(DATA_FILE, 'utf-8');
      return;
    }
    event.returnValue = null;
  } catch (err) {
    console.error('Load Error:', err);
    event.returnValue = null;
  }
});

ipcMain.on('save-data-sync', (event, data) => {
  try {
    fs.writeFileSync(DATA_FILE, data);
    event.returnValue = true;
  } catch (err) {
    console.error('Save Error:', err);
    event.returnValue = false;
  }
});

ipcMain.handle('collab:get-service-info', async () => {
  try {
    return await collabServer.start();
  } catch (error) {
    console.error('Collaboration server start failed:', error);
    return {
      ready: false,
      port: null,
      wsPath: '/ws',
      addresses: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

app.whenReady().then(async () => {
  try {
    await collabServer.start();
  } catch (error) {
    console.error('Failed to bootstrap collaboration server:', error);
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
