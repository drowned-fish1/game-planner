// electron/main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

// 修复 __dirname 在某些环境下的问题
const APP_ROOT = path.join(__dirname, '..');

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(APP_ROOT, 'public/icon.ico'), 
    webPreferences: {
      // === 核心修改区域 ===
      
      // 1. 开启上下文隔离 (解决 "contextBridge API..." 报错)
      contextIsolation: true,
      
      // 2. 关闭 Node 集成 (配合 contextIsolation 使用的标准安全做法)
      nodeIntegration: false,
      
      // 3. 【关键】关闭 Web 安全策略 (彻底解决 CORS 跨域问题，允许请求 api.xiaomimimo.com)
      webSecurity: false, 
      
      // 4. 加载预加载脚本
      preload: path.join(__dirname, 'preload.js'), 
    },
    // 隐藏默认的顶部菜单栏
    autoHideMenuBar: true, 
  });

  // === 加载逻辑 ===
  if (app.isPackaged) {
    win.loadFile(path.join(APP_ROOT, 'dist/index.html'));
  } else {
    // 开发模式
    win.loadURL('http://localhost:5173'); 
    // win.webContents.openDevTools(); 
  }
}

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