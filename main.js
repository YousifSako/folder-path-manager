const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const DATA_FILE = path.join(app.getPath('userData'), 'config.json');

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      return {
        username: data.username || '',
        paths: Array.isArray(data.paths) ? data.paths : [],
        firstRun: !data.username
      };
    }
  } catch (e) {
    console.error('loadData error', e);
  }
  return { username: '', paths: [], firstRun: true };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('saveData error', e);
  }
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 820,
    minHeight: 560,
    backgroundColor: '#0b1326',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',
      symbolColor: '#0a0a0a'
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC ----------

ipcMain.handle('get-config', () => {
  const data = loadData();
  return {
    username: data.username,
    paths: data.paths,
    firstRun: data.firstRun,
    suggestedUsername: os.userInfo().username,
    hostname: os.hostname()
  };
});

ipcMain.handle('set-username', (event, username) => {
  const data = loadData();
  data.username = (username || '').trim();
  saveData({ username: data.username, paths: data.paths });
  return { ok: true, username: data.username };
});

ipcMain.handle('pick-folder', async () => {
  const data = loadData();
  const defaultPath = data.username ? `C:\\Users\\${data.username}` : undefined;
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Select folder(s) to add',
    defaultPath,
    properties: ['openDirectory', 'multiSelections']
  });
  if (res.canceled || !res.filePaths || res.filePaths.length === 0) return { canceled: true, paths: [] };
  return { canceled: false, paths: res.filePaths };
});

ipcMain.handle('add-paths', (event, newPaths) => {
  const data = loadData();
  const set = new Set(data.paths);
  for (const p of newPaths) {
    if (p && !set.has(p)) {
      set.add(p);
      data.paths.push(p);
    }
  }
  saveData({ username: data.username, paths: data.paths });
  return { ok: true, paths: data.paths };
});

ipcMain.handle('remove-paths', (event, toRemove) => {
  const data = loadData();
  const removeSet = new Set(toRemove);
  data.paths = data.paths.filter(p => !removeSet.has(p));
  saveData({ username: data.username, paths: data.paths });
  return { ok: true, paths: data.paths };
});

ipcMain.handle('delete-folders', async (event, toDelete) => {
  const results = [];
  for (const p of toDelete) {
    try {
      if (fs.existsSync(p)) {
        fs.rmSync(p, { recursive: true, force: true });
      }
      results.push({ path: p, ok: true });
    } catch (e) {
      results.push({ path: p, ok: false, error: e.message });
    }
  }
  const data = loadData();
  const delSet = new Set(toDelete);
  data.paths = data.paths.filter(p => !delSet.has(p));
  saveData({ username: data.username, paths: data.paths });
  return { ok: true, results, paths: data.paths };
});

ipcMain.handle('export-list', async (event) => {
  const data = loadData();
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Export folder path list',
    defaultPath: path.join(app.getPath('documents'), 'folder-paths.json'),
    filters: [
      { name: 'JSON', extensions: ['json'] },
      { name: 'Text', extensions: ['txt'] }
    ]
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  try {
    const ext = path.extname(res.filePath).toLowerCase();
    if (ext === '.txt') {
      fs.writeFileSync(res.filePath, data.paths.join('\r\n'), 'utf8');
    } else {
      fs.writeFileSync(res.filePath, JSON.stringify({ username: data.username, paths: data.paths, exportedAt: new Date().toISOString() }, null, 2), 'utf8');
    }
    return { ok: true, filePath: res.filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('import-list', async (event) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Import folder path list',
    properties: ['openFile'],
    filters: [
      { name: 'JSON / Text', extensions: ['json', 'txt'] }
    ]
  });
  if (res.canceled || !res.filePaths || res.filePaths.length === 0) return { canceled: true };
  const filePath = res.filePaths[0];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    let imported = [];
    if (filePath.toLowerCase().endsWith('.json')) {
      const obj = JSON.parse(raw);
      if (Array.isArray(obj)) imported = obj;
      else if (Array.isArray(obj.paths)) imported = obj.paths;
    } else {
      imported = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }
    const data = loadData();
    const set = new Set(data.paths);
    for (const p of imported) {
      if (p && !set.has(p)) {
        set.add(p);
        data.paths.push(p);
      }
    }
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj.username === 'string' && !data.username) data.username = obj.username;
    } catch {}
    saveData({ username: data.username, paths: data.paths });
    return { ok: true, paths: data.paths, count: imported.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('open-path', (event, p) => {
  shell.openPath(p);
  return { ok: true };
});
