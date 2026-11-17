const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  setUsername: (username) => ipcRenderer.invoke('set-username', username),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  addPaths: (paths) => ipcRenderer.invoke('add-paths', paths),
  removePaths: (paths) => ipcRenderer.invoke('remove-paths', paths),
  deleteFolders: (paths) => ipcRenderer.invoke('delete-folders', paths),
  exportList: () => ipcRenderer.invoke('export-list'),
  importList: () => ipcRenderer.invoke('import-list'),
  openPath: (p) => ipcRenderer.invoke('open-path', p)
});
