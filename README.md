# Folder Path Manager (Electron)

A desktop app to manage a list of Windows folder paths: add, select (single/multiple), delete (removes the folder from disk), and export/import the list.

## Run

```bash
npm install
npm start
```

## Features

- First-run prompt for your Windows account username (e.g. `kuro`), used as the base `C:\Users\<username>` folder.
- Add folders via a native folder picker or by typing a path.
- Multi-select folders with checkboxes.
- Delete selected folders from disk (with confirmation).
- Export the list to JSON or TXT.
- Import a list from JSON or TXT.

Data is stored in the Electron user data directory (`config.json`).
