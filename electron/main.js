// electron/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// 修复 __dirname
const APP_ROOT = path.join(__dirname, '..');

// === 数据存储路径 ===
// Windows 下通常是: C:\Users\你的用户名\AppData\Roaming\game-planner\gp_data.json
const DATA_FILE = path.join(app.getPath('userData'), 'gp_data.json');

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(APP_ROOT, 'public/icon.ico'), 
    webPreferences: {
      contextIsolation: true, // 必须为 true，否则 preload 报错
      nodeIntegration: false,
      webSecurity: false,     // 必须为 false，否则无法跨域请求 AI 和加载本地图
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

// === 核心：硬盘读写接口 ===

// 1. 读取数据
ipcMain.on('load-data-sync', (event) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      event.returnValue = data;
    } else {
      event.returnValue = null; // 文件不存在，返回空
    }
  } catch (err) {
    console.error('Load Error:', err);
    event.returnValue = null;
  }
});

// 2. 保存数据
ipcMain.on('save-data-sync', (event, data) => {
  try {
    fs.writeFileSync(DATA_FILE, data);
    event.returnValue = true;
    // console.log('Data saved to:', DATA_FILE); // 调试用
  } catch (err) {
    console.error('Save Error:', err);
    event.returnValue = false;
  }
});

app.whenReady().then(createWindow);

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