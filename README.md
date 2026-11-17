# Folder Path Manager

A minimalist Electron desktop app for managing a list of Windows folder paths — add, select, delete, and import/export.

![monochrome UI](https://img.shields.io/badge/UI-monochrome-000?style=flat-square)

## Features

- **First-run setup** — asks for your Windows account username (e.g. `kuro`) to set the `C:\Users\<username>` base path.
- **Add folders** — via a native multi-select folder picker or by typing a path manually.
- **Multi-select** — checkboxes plus Select all / Clear.
- **Delete** — permanently removes selected folders from disk (with confirmation).
- **Import / Export** — JSON or plain text lists, merged and de-duplicated.
- **Monochrome UI** — clean white & black, square corners, modern spacing.

## Run

```bash
npm install
npm start
```

Requires Node.js 18+ and Windows.

## Data

Paths and username are stored in `config.json` inside Electron's user data directory.

## Project structure

```
folder-path-manager/
├── main.js        # Electron main process + IPC handlers
├── preload.js     # context bridge
├── renderer/
│   ├── index.html # UI (Tailwind via CDN)
│   └── app.js     # renderer logic
└── README.md
```

## License

MIT
