const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vortex', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  chooseFolder: () => ipcRenderer.invoke('choose-folder'),
  openFolder: (path) => ipcRenderer.send('open-folder', path),

  fetchInfo: (url) => ipcRenderer.invoke('fetch-info', url),

  startDownload: (opts) => ipcRenderer.invoke('start-download', opts),

  cancelDownload: (id) => ipcRenderer.send('cancel-download', id),

  onProgress: (cb) =>
    ipcRenderer.on('download-progress', (_, data) => cb(data)),

  removeProgressListener: () =>
    ipcRenderer.removeAllListeners('download-progress')
});