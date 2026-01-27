// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // === 窗口控制 (最小化/最大化/关闭) ===
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // === 异步通信 (用于通知) ===
  send: (channel, data) => ipcRenderer.send(channel, data),

  // === 同步通信 (核心：用于保存数据到硬盘) ===
  sendSync: (channel, data) => ipcRenderer.sendSync(channel, data),

  // === 事件监听 ===
  on: (channel, func) => {
    // 过滤一下合法的 channel，防止任意监听 (可选安全措施)
    // const validChannels = ['window-maximized', 'window-unmaximized'];
    // if (validChannels.includes(channel)) {
      const subscription = (event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    // }
  }
});