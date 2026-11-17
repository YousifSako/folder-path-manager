const API = window.api;

let state = {
  username: '',
  paths: [],
  meta: {},
  selected: new Set(),
  firstRun: true,
  stats: {},
  lastChanged: {},
  searchQuery: '',
  sortMode: 'name',
  sortDesc: false,
  groupMode: 'none',
  ctxPath: null
};

const els = {
  userBadge: document.getElementById('userBadge'),
  userBadgeName: document.getElementById('userBadgeName'),
  statTotal: document.getElementById('statTotal'),
  statSelected: document.getElementById('statSelected'),
  statSize: document.getElementById('statSize'),
  listContainer: document.getElementById('listContainer'),
  emptyState: document.getElementById('emptyState'),
  groupsContainer: document.getElementById('groupsContainer'),
  noMatch: document.getElementById('noMatch'),
  activeCount: document.getElementById('activeCount'),
  selectedCount: document.getElementById('selectedCount'),
  btnDelete: document.getElementById('btnDelete'),
  btnAdd: document.getElementById('btnAdd'),
  btnImport: document.getElementById('btnImport'),
  btnExport: document.getElementById('btnExport'),
  btnSelectAll: document.getElementById('btnSelectAll'),
  btnClearSel: document.getElementById('btnClearSel'),
  searchInput: document.getElementById('searchInput'),
  sortSelect: document.getElementById('sortSelect'),
  groupSelect: document.getElementById('groupSelect'),
  sortDesc: document.getElementById('sortDesc'),
  firstRunModal: document.getElementById('firstRunModal'),
  usernameInput: document.getElementById('usernameInput'),
  btnSaveUser: document.getElementById('btnSaveUser'),
  btnSkipUser: document.getElementById('btnSkipUser'),
  addPathModal: document.getElementById('addPathModal'),
  btnBrowse: document.getElementById('btnBrowse'),
  manualPathInput: document.getElementById('manualPathInput'),
  btnCancelAdd: document.getElementById('btnCancelAdd'),
  btnConfirmAdd: document.getElementById('btnConfirmAdd'),
  dryRunModal: document.getElementById('dryRunModal'),
  dryCount: document.getElementById('dryCount'),
  drySize: document.getElementById('drySize'),
  dryList: document.getElementById('dryList'),
  confirmCheck: document.getElementById('confirmCheck'),
  btnCancelDry: document.getElementById('btnCancelDry'),
  btnConfirmDry: document.getElementById('btnConfirmDry'),
  ctxMenu: document.getElementById('ctxMenu'),
  ctxRemove: document.getElementById('ctxRemove'),
};

// ---------- helpers ----------
function toast(msg, ms = 2800) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.add('hidden'), ms);
}
function formatBytes(b) {
  if (b == null) return '—';
  if (b === 0) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return (b / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1) + ' ' + sizes[i];
}
function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escapeAttr(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ---------- data ----------
async function loadConfig() {
  const cfg = await API.getConfig();
  state.username = cfg.username || '';
  state.paths = cfg.paths || [];
  state.meta = cfg.meta || {};
  state.firstRun = !!cfg.firstRun;
  if (els.usernameInput && cfg.hostname) els.usernameInput.placeholder = cfg.hostname;
  if (els.manualPathInput && cfg.hostname) els.manualPathInput.placeholder = `C:\\Users\\${cfg.hostname}\\Documents\\myfolder`;
  // prune selected
  state.selected = new Set([...state.selected].filter(p => state.paths.includes(p)));
  if (state.firstRun) {
    els.usernameInput.value = cfg.suggestedUsername || '';
    els.firstRunModal.classList.remove('hidden');
    els.firstRunModal.classList.add('flex');
  }
  await refreshStats();
  API.onFolderChanged((data) => {
    state.lastChanged[data.path] = data.time;
    // invalidate stats
    API.getStats([data.path]).then(r => { if (r.ok) { state.stats[data.path] = r.stats[data.path]; render(); updateOverview(); } });
    toast(`Change detected in ${data.path.split(/[\\\\/]/).pop()}`);
  });
  render();
  updateOverview();
}

async function refreshStats() {
  if (state.paths.length === 0) { state.stats = {}; return; }
  const r = await API.getStats(state.paths);
  if (r.ok) state.stats = r.stats || {};
}

function addedAt(p) { return (state.meta[p] && state.meta[p].addedAt) || 0; }
function sizeOf(p) { return (state.stats[p] && state.stats[p].size) || 0; }
function countOf(p) { return (state.stats[p] && state.stats[p].count) || 0; }

// ---------- filtering/sorting/grouping ----------
function filteredPaths() {
  const q = state.searchQuery.trim().toLowerCase();
  let list = state.paths.slice();
  if (q) {
    list = list.filter(p => p.toLowerCase().includes(q) || p.toLowerCase().split(/[\\\\/]/).some(seg => seg.includes(q)));
  }
  // sort
  list.sort((a, b) => {
    let cmp = 0;
    if (state.sortMode === 'name') cmp = a.toLowerCase().localeCompare(b.toLowerCase());
    else if (state.sortMode === 'date') cmp = addedAt(a) - addedAt(b);
    else if (state.sortMode === 'size') cmp = sizeOf(a) - sizeOf(b);
    return state.sortDesc ? -cmp : cmp;
  });
  return list;
}
function groupKey(p) {
  if (state.groupMode === 'drive') return (p.match(/^([a-zA-Z]:)/) || ['', 'Other'])[1].toUpperCase() + '\\';
  if (state.groupMode === 'parent') {
    const parts = p.split(/[\\\\/]/).filter(Boolean);
    return parts.length > 1 ? parts.slice(0, -1).join('\\') : '(root)';
  }
  return null;
}

// ---------- render ----------
function updateOverview() {
  els.statTotal.textContent = state.paths.length;
  els.statSelected.textContent = state.selected.size;
  els.selectedCount.textContent = state.selected.size;
  els.btnDelete.disabled = state.selected.size === 0;
  let total = 0;
  for (const p of state.paths) total += sizeOf(p);
  els.statSize.textContent = formatBytes(total);
}

function render() {
  updateOverview();
  // user badge
  if (state.username) {
    els.userBadge.classList.remove('hidden'); els.userBadge.classList.add('flex');
    els.userBadgeName.textContent = state.username;
  } else {
    els.userBadge.classList.add('hidden'); els.userBadge.classList.remove('flex');
  }

  const list = filteredPaths();
  els.groupsContainer.innerHTML = '';
  if (state.paths.length === 0) {
    els.emptyState.classList.remove('hidden'); els.emptyState.classList.add('flex');
    if (els.noMatch) els.noMatch.classList.add('hidden');
    return;
  }
  els.emptyState.classList.add('hidden'); els.emptyState.classList.remove('flex');
  els.activeCount.textContent = state.paths.length + ' active';

  if (list.length === 0) {
    if (els.noMatch) els.noMatch.classList.remove('hidden');
    return;
  }
  if (els.noMatch) els.noMatch.classList.add('hidden');

  // group
  const groups = new Map();
  for (const p of list) {
    const key = groupKey(p);
    if (key === null) {
      if (!groups.has('__none__')) groups.set('__none__', []);
      groups.get('__none__').push(p);
    } else {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
  }

  const isGrouped = state.groupMode !== 'none';
  for (const [key, items] of groups) {
    const wrapper = document.createElement('div');
    wrapper.className = 'mb-6';
    if (isGrouped && key !== '__none__') {
      const header = document.createElement('div');
      header.className = 'text-[11px] uppercase tracking-[0.12em] text-muted font-semibold mb-2 px-1';
      header.textContent = key;
      wrapper.appendChild(header);
    }
    const ul = document.createElement('ul');
    ul.className = 'space-y-2';
    ul.dataset.group = key;
    for (const p of items) ul.appendChild(renderRow(p));
    wrapper.appendChild(ul);
    els.groupsContainer.appendChild(wrapper);
  }
}

function renderRow(p) {
  const li = document.createElement('div');
  const selected = state.selected.has(p);
  li.className = selected
    ? 'flex items-center gap-3 px-3 py-2 rounded-lg border border-primary bg-surface-container-low/70 transition-all group cursor-pointer'
    : 'flex items-center gap-3 px-3 py-2 rounded-lg border border-outline bg-surface-container-lowest transition-all hover:border-primary hover:shadow-xs group cursor-pointer';
  li.dataset.path = p;
  li.draggable = true;

  const lc = state.lastChanged[p];
  const lcText = lc ? new Date(lc).toLocaleTimeString() : '';
  const name = p.split(/[\\\\/]/).filter(Boolean).pop() || p;

  li.innerHTML = `
    <span class="material-symbols-outlined flex-shrink-0 text-outline-variant group-hover:text-secondary cursor-grab no-drag text-[18px]" title="Drag to reorder">drag_indicator</span>
    <input type="checkbox" class="flex-shrink-0 w-4 h-4 rounded border-outline text-primary focus:ring-0 cursor-pointer no-drag" ${selected ? 'checked' : ''} data-path="${escapeAttr(p)}"/>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2 min-w-0">
        <span class="font-headline-md text-on-surface truncate" title="${escapeAttr(p)}">${escapeHtml(name)}</span>
        ${lc ? `<span class="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0 text-caption"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>${lcText}</span>` : ''}
      </div>
    </div>
    <div class="flex items-center gap-3 flex-shrink-0">
      <span class="font-label-sm text-on-surface font-medium bg-surface-container px-1.5 py-0.5 rounded">${formatBytes(sizeOf(p))}</span>
      <span class="text-caption text-secondary">${countOf(p)} files</span>
      <button class="h-7 w-7 rounded-lg border border-surface-variant bg-surface-container-lowest hover:bg-surface-variant text-secondary hover:text-on-surface flex items-center justify-center transition-colors no-drag" data-action="open" title="Open folder">
        <span class="material-symbols-outlined !text-[16px]">folder_open</span>
      </button>
    </div>
  `;

  const cb = li.querySelector('input[type="checkbox"]');
  cb.addEventListener('change', (e) => {
    if (e.target.checked) state.selected.add(p); else state.selected.delete(p);
    render();
  });
  li.addEventListener('click', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.closest('button') || e.target.closest('.cursor-grab')) return;
    if (state.selected.has(p)) state.selected.delete(p); else state.selected.add(p);
    render();
  });
  li.querySelector('[data-action="open"]').addEventListener('click', (e) => { e.stopPropagation(); API.revealInExplorer(p); });

  li.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', p); li.classList.add('dragging'); });
  li.addEventListener('dragend', () => li.classList.remove('dragging'));
  li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('drag-over'); });
  li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
  li.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    state.ctxPath = p;
    els.ctxMenu.style.left = e.clientX + 'px';
    els.ctxMenu.style.top = e.clientY + 'px';
    els.ctxMenu.classList.remove('hidden');
  });

  return li;
}

// ---------- modals ----------
function openAddModal() { els.manualPathInput.value = ''; els.addPathModal.classList.remove('hidden'); els.addPathModal.classList.add('flex'); }
function closeAddModal() { els.addPathModal.classList.add('hidden'); els.addPathModal.classList.remove('flex'); }
els.btnAdd.addEventListener('click', openAddModal);
els.btnCancelAdd.addEventListener('click', closeAddModal);
els.btnBrowse.addEventListener('click', async () => {
  const res = await API.pickFolder();
  if (res.canceled) return;
  if (res.paths && res.paths.length) {
    const r = await API.addPaths(res.paths);
    if (r.ok) { state.paths = r.paths; state.meta = r.meta || state.meta; await refreshStats(); render(); toast(`Added ${res.paths.length} folder(s)`); closeAddModal(); }
  }
});
els.btnConfirmAdd.addEventListener('click', async () => {
  const val = els.manualPathInput.value.trim();
  if (!val) { toast('Enter a path'); return; }
  const r = await API.addPaths([val]);
  if (r.ok) { state.paths = r.paths; state.meta = r.meta || state.meta; await refreshStats(); render(); toast('Folder added'); closeAddModal(); }
});
els.manualPathInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') els.btnConfirmAdd.click(); });

// first-run / account
els.btnSaveUser.addEventListener('click', async () => {
  const name = els.usernameInput.value.trim();
  if (name) { await API.setUsername(name); state.username = name; }
  els.firstRunModal.classList.add('hidden'); els.firstRunModal.classList.remove('flex');
  state.firstRun = false;
  toast(name ? `Username set to ${name}` : 'Skipped username');
  render();
});
els.btnSkipUser.addEventListener('click', () => {
  els.firstRunModal.classList.add('hidden'); els.firstRunModal.classList.remove('flex');
  state.firstRun = false;
  toast('Skipped username setup');
});
els.userBadge.addEventListener('click', () => {
  els.usernameInput.value = state.username || '';
  els.firstRunModal.classList.remove('hidden'); els.firstRunModal.classList.add('flex');
});

// import/export
els.btnImport.addEventListener('click', async () => {
  const r = await API.importList();
  if (r.canceled) return;
  if (r.ok) { state.paths = r.paths; state.meta = r.meta || state.meta; await refreshStats(); render(); toast(`Imported ${r.count} path(s)`); }
  else toast('Import failed: ' + (r.error || 'unknown'));
});
els.btnExport.addEventListener('click', async () => {
  const r = await API.exportList();
  if (r.canceled) return;
  if (r.ok) toast('Exported to ' + r.filePath);
  else toast('Export failed: ' + (r.error || 'unknown'));
});

// search/sort/group
els.searchInput.addEventListener('input', (e) => { state.searchQuery = e.target.value; render(); });
els.sortSelect.addEventListener('change', (e) => { state.sortMode = e.target.value; render(); });
els.groupSelect.addEventListener('change', (e) => { state.groupMode = e.target.value; render(); });
els.sortDesc.addEventListener('change', (e) => { state.sortDesc = e.target.checked; render(); });

els.ctxRemove.addEventListener('click', async () => {
  const p = state.ctxPath;
  els.ctxMenu.classList.add('hidden');
  if (!p) return;
  const r = await API.removePaths([p]);
  if (r.ok) { state.paths = r.paths; state.meta = r.meta || state.meta; state.selected.delete(p); await refreshStats(); render(); toast('Removed from list'); }
});
document.addEventListener('click', () => { els.ctxMenu.classList.add('hidden'); });
document.addEventListener('contextmenu', (e) => {
  // hide if not on a row
  if (!e.target.closest('[data-path]')) els.ctxMenu.classList.add('hidden');
});
els.btnClearSel.addEventListener('click', () => { state.selected.clear(); render(); });

// delete with dry-run + checkbox
let pendingDelete = [];
els.btnDelete.addEventListener('click', async () => {
  const toDelete = [...state.selected];
  if (toDelete.length === 0) return;
  pendingDelete = toDelete;
  const dr = await API.dryRunDelete(toDelete);
  if (!dr.ok) { toast('Preview failed'); return; }
  els.dryCount.textContent = dr.totalCount;
  els.drySize.textContent = formatBytes(dr.totalSize);
  els.dryList.innerHTML = '';
  for (const it of dr.items) {
    const li = document.createElement('li');
    li.className = 'flex justify-between gap-2 py-0.5';
    li.innerHTML = `<span class="truncate">${escapeHtml(it.missing ? it.path + ' (missing)' : (it.name || it.path))}</span><span class="text-muted">${it.missing ? '' : formatBytes(it.size)}</span>`;
    els.dryList.appendChild(li);
  }
  els.confirmCheck.checked = false;
  els.btnConfirmDry.disabled = true;
  els.dryRunModal.classList.remove('hidden'); els.dryRunModal.classList.add('flex');
});
els.confirmCheck.addEventListener('change', () => { els.btnConfirmDry.disabled = !els.confirmCheck.checked; });
els.btnCancelDry.addEventListener('click', () => { els.dryRunModal.classList.add('hidden'); els.dryRunModal.classList.remove('flex'); pendingDelete = []; });
els.btnConfirmDry.addEventListener('click', async () => {
  els.btnConfirmDry.disabled = true;
  const r = await API.deleteContents(pendingDelete);
  els.dryRunModal.classList.add('hidden'); els.dryRunModal.classList.remove('flex');
  if (r.ok) {
    state.selected.clear();
    await refreshStats();
    render();
    const failed = r.results.filter(x => !x.ok);
    toast(failed.length ? `Cleared with ${failed.length} error(s)` : `Cleared contents of ${pendingDelete.length} folder(s)`);
  } else toast('Delete failed');
  pendingDelete = [];
});

// init
loadConfig();
