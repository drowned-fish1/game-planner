const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // 最小化
  minimize: () => ipcRenderer.send('window-minimize'),
  // 最大化/还原
  maximize: () => ipcRenderer.send('window-maximize'),
  // 关闭
  close: () => ipcRenderer.send('window-close'),
  // 监听最大化状态变化
  on: (channel, func) => {
    const validChannels = ['window-maximized', 'window-unmaximized'];
    if (validChannels.includes(channel)) {
      // 剥离 event 对象，只传递参数，防止安全警告
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});