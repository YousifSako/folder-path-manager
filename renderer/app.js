const API = window.api;

let state = {
  username: '',
  paths: [],
  selected: new Set(),
  firstRun: true
};

const els = {
  userBadge: document.getElementById('userBadge'),
  userBadgeName: document.getElementById('userBadgeName'),
  statTotal: document.getElementById('statTotal'),
  statSelected: document.getElementById('statSelected'),
  listContainer: document.getElementById('listContainer'),
  emptyState: document.getElementById('emptyState'),
  pathList: document.getElementById('pathList'),
  selectedCount: document.getElementById('selectedCount'),
  btnDelete: document.getElementById('btnDelete'),
  btnAdd: document.getElementById('btnAdd'),
  btnImport: document.getElementById('btnImport'),
  btnExport: document.getElementById('btnExport'),
  btnSelectAll: document.getElementById('btnSelectAll'),
  btnClearSel: document.getElementById('btnClearSel'),
  firstRunModal: document.getElementById('firstRunModal'),
  usernameInput: document.getElementById('usernameInput'),
  btnSaveUser: document.getElementById('btnSaveUser'),
  btnSkipUser: document.getElementById('btnSkipUser'),
  addPathModal: document.getElementById('addPathModal'),
  btnBrowse: document.getElementById('btnBrowse'),
  manualPathInput: document.getElementById('manualPathInput'),
  btnCancelAdd: document.getElementById('btnCancelAdd'),
  btnConfirmAdd: document.getElementById('btnConfirmAdd'),
  toast: document.getElementById('toast')
};

function toast(msg, ms = 2500) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.add('hidden'), ms);
}

function render() {
  els.statTotal.textContent = state.paths.length;
  els.statSelected.textContent = state.selected.size;
  els.selectedCount.textContent = state.selected.size;
  els.btnDelete.disabled = state.selected.size === 0;

  // user badge
  if (state.username) {
    els.userBadge.classList.remove('hidden');
    els.userBadge.classList.add('flex');
    els.userBadgeName.textContent = state.username;
  } else {
    els.userBadge.classList.add('hidden');
    els.userBadge.classList.remove('flex');
  }

  els.pathList.innerHTML = '';
  if (state.paths.length === 0) {
    els.emptyState.classList.remove('hidden');
    els.emptyState.classList.add('flex');
    return;
  }
  els.emptyState.classList.add('hidden');
  els.emptyState.classList.remove('flex');

  state.paths.forEach((p, idx) => {
    const li = document.createElement('li');
    const selected = state.selected.has(p);
    li.className = selected
      ? 'flex items-center gap-3 px-4 py-3 border border-ink bg-ink text-white ease cursor-pointer rounded-lg'
      : 'flex items-center gap-3 px-4 py-3 border border-line bg-white hover:bg-surface ease cursor-pointer rounded-lg';
    li.dataset.path = p;
    li.innerHTML = `
      <input type="checkbox" class="w-4 h-4 no-drag" ${selected ? 'checked' : ''} data-path="${escapeAttr(p)}"/>
      <span class="material-symbols-outlined text-[20px]">folder</span>
      <div class="flex-1 min-w-0">
        <div class="font-mono text-sm truncate ${selected ? 'text-white' : 'text-ink'}" title="${escapeAttr(p)}">${escapeHtml(p)}</div>
        <div class="text-xs ${selected ? 'text-white/60' : 'text-muted'}">Folder path #${idx + 1}</div>
      </div>
      <button class="no-drag p-1.5 border ${selected ? 'border-white/40 text-white hover:bg-white hover:text-ink' : 'border-line text-ink hover:bg-ink hover:text-white'} ease" data-action="open" data-path="${escapeAttr(p)}" title="Open in explorer">
        <span class="material-symbols-outlined text-[18px]">open_in_new</span>
      </button>
    `;
    // checkbox toggle
    const cb = li.querySelector('input[type="checkbox"]');
    cb.addEventListener('change', (e) => {
      if (e.target.checked) state.selected.add(p); else state.selected.delete(p);
      render();
    });
    // row click toggles selection
    li.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
      if (state.selected.has(p)) state.selected.delete(p); else state.selected.add(p);
      render();
    });
    const openBtn = li.querySelector('[data-action="open"]');
    openBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await API.openPath(p);
    });
    els.pathList.appendChild(li);
  });
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escapeAttr(s) {
  return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function loadConfig() {
  const cfg = await API.getConfig();
  state.username = cfg.username || '';
  state.paths = cfg.paths || [];
  state.firstRun = !!cfg.firstRun;
  if (els.usernameInput && cfg.hostname) {
    els.usernameInput.placeholder = cfg.hostname;
  }
  if (els.manualPathInput && cfg.hostname) {
    els.manualPathInput.placeholder = `C:\\Users\\${cfg.hostname}\\Documents\\myfolder`;
  }
  // prune selected to existing
  state.selected = new Set([...state.selected].filter(p => state.paths.includes(p)));
  if (state.firstRun) {
    els.usernameInput.value = cfg.suggestedUsername || '';
    els.firstRunModal.classList.remove('hidden');
    els.firstRunModal.classList.add('flex');
  }
  render();
}

// ---------- First-run modal ----------
els.btnSaveUser.addEventListener('click', async () => {
  const name = els.usernameInput.value.trim();
  if (name) {
    await API.setUsername(name);
    state.username = name;
  }
  els.firstRunModal.classList.add('hidden');
  els.firstRunModal.classList.remove('flex');
  state.firstRun = false;
  toast(name ? `Username set to ${name}` : 'Skipped username');
  render();
});
els.btnSkipUser.addEventListener('click', () => {
  els.firstRunModal.classList.add('hidden');
  els.firstRunModal.classList.remove('flex');
  state.firstRun = false;
  toast('Skipped username setup');
});

// ---------- Add path modal ----------
function openAddModal() {
  els.manualPathInput.value = '';
  els.addPathModal.classList.remove('hidden');
  els.addPathModal.classList.add('flex');
}
function closeAddModal() {
  els.addPathModal.classList.add('hidden');
  els.addPathModal.classList.remove('flex');
}
els.btnAdd.addEventListener('click', openAddModal);
els.btnCancelAdd.addEventListener('click', closeAddModal);
els.btnBrowse.addEventListener('click', async () => {
  const res = await API.pickFolder();
  if (res.canceled) return;
  if (res.paths && res.paths.length) {
    const r = await API.addPaths(res.paths);
    state.paths = r.paths;
    render();
    toast(`Added ${res.paths.length} folder(s)`);
    closeAddModal();
  }
});
els.btnConfirmAdd.addEventListener('click', async () => {
  const val = els.manualPathInput.value.trim();
  if (!val) { toast('Enter a path'); return; }
  const r = await API.addPaths([val]);
  state.paths = r.paths;
  render();
  toast('Folder added');
  closeAddModal();
});
els.manualPathInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') els.btnConfirmAdd.click();
});

// ---------- Import / Export ----------
els.btnImport.addEventListener('click', async () => {
  const r = await API.importList();
  if (r.canceled) return;
  if (r.ok) {
    state.paths = r.paths;
    render();
    toast(`Imported ${r.count} path(s)`);
  } else {
    toast('Import failed: ' + (r.error || 'unknown'));
  }
});
els.btnExport.addEventListener('click', async () => {
  const r = await API.exportList();
  if (r.canceled) return;
  if (r.ok) toast('Exported to ' + r.filePath);
  else toast('Export failed: ' + (r.error || 'unknown'));
});

// ---------- Selection helpers ----------
els.btnSelectAll.addEventListener('click', () => {
  state.paths.forEach(p => state.selected.add(p));
  render();
});
els.btnClearSel.addEventListener('click', () => {
  state.selected.clear();
  render();
});

// ---------- Delete ----------
els.btnDelete.addEventListener('click', async () => {
  const toDelete = [...state.selected];
  if (toDelete.length === 0) return;
  const confirmMsg = `This will permanently delete ${toDelete.length} folder(s) from disk:\n\n${toDelete.join('\n')}\n\nContinue?`;
  if (!confirm(confirmMsg)) return;
  const r = await API.deleteFolders(toDelete);
  if (r.ok) {
    state.paths = r.paths;
    state.selected.clear();
    render();
    const failed = r.results.filter(x => !x.ok);
    if (failed.length) {
      toast(`Deleted with ${failed.length} error(s)`);
    } else {
      toast(`Deleted ${toDelete.length} folder(s)`);
    }
  } else {
    toast('Delete failed');
  }
});

// init
loadConfig();
