const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { CollabServer } = require('./collab-server');
const { MainProcessCollabClientManager } = require('./collab-client');
const { LanDiscoveryService } = require('./lan-discovery');
const { StorageGuard } = require('./storage-guard');

// 测试/沙箱可用环境变量覆盖 userData，避免端到端验证碰真实数据
if (process.env.GP_USER_DATA_DIR) {
  app.setPath('userData', process.env.GP_USER_DATA_DIR);
}
// 端到端测试可通过环境变量开启 CDP 远程调试（生产不设即无效）
if (process.env.GP_REMOTE_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.GP_REMOTE_DEBUG_PORT);
  app.commandLine.appendSwitch('remote-allow-origins', '*');
}

const APP_ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(app.getPath('userData'), 'gp_data.json');
const BACKUP_DIR = path.join(app.getPath('userData'), 'backups');

const storageGuard = new StorageGuard({ dataFile: DATA_FILE, backupDir: BACKUP_DIR });
// 本次进程内是否发生过「损坏回退」，渲染端启动时查询并提示用户
let storageRecoveryInfo = null;

let win = null;
const collabServer = new CollabServer();
const collabClientManager = new MainProcessCollabClientManager();
const lanDiscovery = new LanDiscoveryService(() => ({
  deviceName: os.hostname(),
  service: collabServer.getServiceInfo(),
  rooms: collabServer.getRoomsSummary(),
}));

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
    // vite-plugin-electron 注入实际端口；vite 在 5173 被占时会自动换端口
    win.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
  }
}

ipcMain.on('load-data-sync', (event) => {
  try {
    const { raw, recoveredFrom } = storageGuard.load();
    if (recoveredFrom) {
      storageRecoveryInfo = { recoveredFrom, at: Date.now() };
    }
    event.returnValue = raw;
  } catch (err) {
    console.error('Load Error:', err);
    event.returnValue = null;
  }
});

ipcMain.on('save-data-sync', (event, data) => {
  try {
    const result = storageGuard.save(data);
    if (!result.ok) console.error('Save refused/failed:', result.error);
    event.returnValue = result.ok;
  } catch (err) {
    console.error('Save Error:', err);
    event.returnValue = false;
  }
});

// ===== 备份与恢复（渲染端设置页使用） =====
ipcMain.handle('storage:get-recovery-info', () => {
  const info = storageRecoveryInfo;
  storageRecoveryInfo = null;
  return info;
});

ipcMain.handle('storage:list-backups', () => storageGuard.listBackups());

ipcMain.handle('storage:snapshot-now', () => storageGuard.snapshotNow());

ipcMain.handle('storage:restore-backup', (_event, payload) => {
  return storageGuard.restoreBackup(payload && payload.file);
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

ipcMain.handle('collab:proxy-connect', (event, payload) => {
  return collabClientManager.connect(event.sender, payload);
});

ipcMain.handle('collab:proxy-send', (_event, payload) => {
  return collabClientManager.send(payload.clientId, payload.type, payload.payload);
});

ipcMain.handle('collab:proxy-disconnect', (_event, payload) => {
  return collabClientManager.disconnect(payload.clientId);
});

ipcMain.handle('collab:discover-lan-rooms', async () => {
  try {
    return await lanDiscovery.discover();
  } catch (error) {
    console.error('LAN discovery failed:', error);
    return [];
  }
});

app.whenReady().then(async () => {
  // 每日备份：主数据完好时每天首启做一份（损坏场景交给 load 的回退流程）
  storageGuard.makeStartupBackup();

  try {
    await collabServer.start();
    await lanDiscovery.start();
  } catch (error) {
    console.error('Failed to bootstrap collaboration services:', error);
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
