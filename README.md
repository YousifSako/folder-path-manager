# Folder Path Manager

A minimalist Electron desktop app for managing a list of Windows folder paths - add, select, delete contents, and import/export.

## Features

- **First-run setup** - asks for your Windows account username (e.g. `yourname`) to set the `C:\Users\<username>` base path.
- **Add folders** - via a native multi-select folder picker or by typing a path manually.
- **Multi-select** - checkboxes plus Select all / Clear.
- **Delete contents** - moves the *contents* of selected folders to the Recycle Bin, keeping the folders and their paths.
- **Dry-run preview** - see what will be removed and total size before deleting, with a confirmation checkbox.
- **Import / Export** - JSON or plain text lists of paths only, merged and de-duplicated.
- **Search, sort & group** - filter by name, sort by name/date/size, group by drive or parent.
- **Folder stats** - size and file count per row, computed and cached.
- **Drag-and-drop reorder** - persist custom order.
- **Watch folders** - chokidar watches for changes, shows "changed" indicator.
- **Right-click** - context menu with "Remove from list".
- **Changeable username** - click the username badge anytime.
- **Monochrome UI** - clean slate theme, rounded corners, modern spacing.

## Run

```bash
npm install
npm start
```

Requires Node.js 18+ and Windows.

## How to use

1. Launch the app. On first run, enter your Windows account username and click **Save** (or Skip).
2. Click **Add Folder** to pick folders with the file browser, or type a path manually.
3. Use the checkboxes to select one or many folders. Use **Select all** / **Clear** for bulk selection.
4. Click **Delete Contents** to preview and clear the contents of selected folders (moved to Recycle Bin).
5. Use **Import** / **Export** to save or load your path list (JSON or TXT).
6. Right-click an item to remove it from the list.

## Data

Paths and username are stored in `config.json` inside Electron's user data directory.

## Project structure

```
folder-path-manager/
|-- main.js        # Electron main process + IPC handlers
|-- preload.js     # context bridge
|-- renderer/
|   |-- index.html # UI (Tailwind via CDN, Stitch design)
|   |-- app.js     # renderer logic
|-- README.md
|-- LICENSE
```

## License

MIT
