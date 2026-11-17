const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const chokidar = require('chokidar');

const DATA_FILE = path.join(app.getPath('userData'), 'config.json');

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      return {
        username: data.username || '',
        paths: Array.isArray(data.paths) ? data.paths : [],
        meta: (data.meta && typeof data.meta === 'object') ? data.meta : {},
        firstRun: !data.username
      };
    }
  } catch (e) { console.error('loadData error', e); }
  return { username: '', paths: [], meta: {}, firstRun: true };
}
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      username: data.username || '',
      paths: data.paths || [],
      meta: data.meta || {}
    }, null, 2), 'utf8');
  } catch (e) { console.error('saveData error', e); }
}

const statsCache = new Map();
function computeStats(target) {
  let size = 0, count = 0;
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      try {
        if (e.isDirectory() && !e.isSymbolicLink()) walk(full);
        else { const st = fs.statSync(full); size += st.size; count += 1; }
      } catch {}
    }
  }
  try {
    if (fs.existsSync(target)) {
      const st = fs.statSync(target);
      if (st.isDirectory()) walk(target);
      else { size = st.size; count = 1; }
    }
  } catch {}
  return { size, count };
}
function getStats(target) {
  if (statsCache.has(target)) {
    const c = statsCache.get(target);
    if (c && !c.computing) return c;
  }
  const entry = { size: 0, count: 0, computing: true };
  statsCache.set(target, entry);
  const res = computeStats(target);
  entry.size = res.size; entry.count = res.count; entry.computing = false;
  statsCache.set(target, entry);
  return entry;
}

const watchers = new Map();
function startWatch(p) {
  if (watchers.has(p)) return;
  try {
    const w = chokidar.watch(p, { ignoreInitial: true, depth: 2, persistent: true });
    const notify = (evt, fp) => {
      statsCache.delete(p);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('folder-changed', { path: p, event: evt, file: fp, time: Date.now() });
      }
    };
    w.on('all', notify);
    watchers.set(p, w);
  } catch (e) { console.error('watch error', e); }
}
function stopWatch(p) {
  const w = watchers.get(p);
  if (w) { try { w.close(); } catch {} watchers.delete(p); }
}

let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#ffffff',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#ffffff', symbolColor: '#0a0a0a' },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  const data = loadData();
  for (const p of data.paths) startWatch(p);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => {
  for (const w of watchers.values()) { try { w.close(); } catch {} }
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-config', () => {
  const data = loadData();
  return {
    username: data.username,
    paths: data.paths,
    meta: data.meta,
    firstRun: data.firstRun,
    suggestedUsername: os.userInfo().username,
    hostname: os.hostname()
  };
});

ipcMain.handle('set-username', (event, username) => {
  const data = loadData();
  data.username = (username || '').trim();
  saveData(data);
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
  const now = Date.now();
  for (const p of newPaths) {
    if (p && !set.has(p)) {
      set.add(p);
      data.paths.push(p);
      if (!data.meta[p]) data.meta[p] = { addedAt: now };
      else if (!data.meta[p].addedAt) data.meta[p].addedAt = now;
      startWatch(p);
    }
  }
  saveData(data);
  return { ok: true, paths: data.paths, meta: data.meta };
});

ipcMain.handle('remove-paths', (event, toRemove) => {
  const data = loadData();
  const removeSet = new Set(toRemove);
  data.paths = data.paths.filter(p => !removeSet.has(p));
  for (const p of toRemove) { delete data.meta[p]; stopWatch(p); statsCache.delete(p); }
  saveData(data);
  return { ok: true, paths: data.paths, meta: data.meta };
});

ipcMain.handle('reorder-paths', (event, newOrder) => {
  const data = loadData();
  const set = new Set(data.paths);
  const ordered = newOrder.filter(p => set.has(p));
  for (const p of data.paths) if (!ordered.includes(p)) ordered.push(p);
  data.paths = ordered;
  saveData(data);
  return { ok: true, paths: data.paths };
});

ipcMain.handle('dry-run-delete', (event, targets) => {
  const items = [];
  let totalSize = 0, totalCount = 0;
  for (const p of targets) {
    if (!fs.existsSync(p)) { items.push({ path: p, missing: true }); continue; }
    let entries = [];
    try { entries = fs.readdirSync(p, { withFileTypes: true }); } catch {}
    for (const e of entries) {
      const full = path.join(p, e.name);
      const st = getStats(full);
      items.push({ path: full, name: e.name, isDir: e.isDirectory(), size: st.size, count: st.count });
      totalSize += st.size;
      totalCount += (e.isDirectory() ? st.count : 1);
    }
  }
  return { ok: true, items, totalSize, totalCount };
});

ipcMain.handle('delete-contents', async (event, targets) => {
  const results = [];
  for (const p of targets) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        const entries = fs.readdirSync(p, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(p, e.name);
          await shell.trashItem(full);
        }
      }
      statsCache.delete(p);
      results.push({ path: p, ok: true });
    } catch (e) {
      results.push({ path: p, ok: false, error: e.message });
    }
  }
  return { ok: true, results };
});

ipcMain.handle('get-stats', (event, targets) => {
  const out = {};
  for (const p of targets) out[p] = getStats(p);
  return { ok: true, stats: out };
});

ipcMain.handle('reveal-in-explorer', (event, p) => {
  try {
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      shell.openPath(p);
    } else {
      shell.showItemInFolder(p);
    }
  } catch {}
  return { ok: true };
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
      fs.writeFileSync(res.filePath, JSON.stringify({ paths: data.paths, exportedAt: new Date().toISOString() }, null, 2), 'utf8');
    }
    return { ok: true, filePath: res.filePath };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('import-list', async (event) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Import folder path list',
    properties: ['openFile'],
    filters: [{ name: 'JSON / Text', extensions: ['json', 'txt'] }]
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
    const now = Date.now();
    for (const p of imported) {
      if (p && !set.has(p)) {
        set.add(p);
        data.paths.push(p);
        if (!data.meta[p]) data.meta[p] = { addedAt: now };
        startWatch(p);
      }
    }
    saveData(data);
    return { ok: true, paths: data.paths, meta: data.meta, count: imported.length };
  } catch (e) { return { ok: false, error: e.message }; }
});
