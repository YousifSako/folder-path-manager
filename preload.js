const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  setUsername: (username) => ipcRenderer.invoke('set-username', username),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  addPaths: (paths) => ipcRenderer.invoke('add-paths', paths),
  removePaths: (paths) => ipcRenderer.invoke('remove-paths', paths),
  reorderPaths: (order) => ipcRenderer.invoke('reorder-paths', order),
  dryRunDelete: (paths) => ipcRenderer.invoke('dry-run-delete', paths),
  deleteContents: (paths) => ipcRenderer.invoke('delete-contents', paths),
  getStats: (paths) => ipcRenderer.invoke('get-stats', paths),
  revealInExplorer: (p) => ipcRenderer.invoke('reveal-in-explorer', p),
  exportList: () => ipcRenderer.invoke('export-list'),
  importList: () => ipcRenderer.invoke('import-list'),
  onFolderChanged: (cb) => ipcRenderer.on('folder-changed', (e, data) => cb(data))
});
