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
    icon: path.join(APP_ROOT, 'public/icon.ico'), // 尝试加载图标
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // 如果你没有写 preload.js，这一行可以注释掉，或者保留也不影响
      preload: path.join(__dirname, 'preload.js'), 
    },
    // 隐藏默认的顶部菜单栏（文件、编辑...）
    autoHideMenuBar: true, 
  });

  // === 关键逻辑 ===
  // 如果是打包好的环境 (app.isPackaged 为 true)，就加载本地文件
  // 否则尝试加载本地开发服务器
  if (app.isPackaged) {
    // 这里对应 electron-builder 打包后的路径
    win.loadFile(path.join(APP_ROOT, 'dist/index.html'));
  } else {
    // 开发模式：默认 Vite 端口是 5173，如果你的不一样请修改
    win.loadURL('http://localhost:5173'); 
    // 开发模式下自动打开控制台 (F12)
    //win.webContents.openDevTools(); 
  }
}

// 应用程序准备好后创建窗口
app.whenReady().then(createWindow);

// 所有窗口关闭时退出应用 (Windows)
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
