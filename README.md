# EVA POS Desktop

A desktop Point of Sale (POS) application built with Electron, React, TypeScript, and SQLite.

## Project Structure

```
eva-pos-desktop/
├── electron/          # Electron main process and preload scripts
│   ├── main.ts        # Main Electron process
│   └── preload.ts     # Preload script for secure IPC
├── renderer/          # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx    # Main React component
│   │   ├── main.tsx   # React entry point
│   │   └── ...
│   ├── index.html     # HTML template
│   └── vite.config.ts # Vite configuration
├── package.json       # Root package.json with scripts
└── tsconfig.json      # Root TypeScript config
```

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

This will:
- Start the Vite dev server on http://localhost:5174
- Launch Electron in development mode

### Build

```bash
npm run build
```

This will:
- Build the React renderer with Vite
- Compile the Electron main process TypeScript files
- Output production-ready files

## Technology Stack

- **Electron**: Desktop application shell
- **React**: UI framework
- **TypeScript**: Type safety
- **Vite**: Fast frontend bundler
- **SQLite (better-sqlite3)**: Local database

## License

MIT

