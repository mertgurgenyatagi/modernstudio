# modernstudio

A minimalist, Windows-only music app. See [docs/README.md](docs/README.md) for the specification and handover, and [docs/plan24.md](docs/plan24.md) for the build plan.

## Running it

Needs Node.js 24 and npm. Once, in this folder:

```
npm install
```

Then:

| Command | What it does |
| --- | --- |
| `npm run dev` | Opens the app in a window, reloading as the code changes |
| `npm run build` | Builds the app into `out/` |
| `npm run typecheck` | Checks the TypeScript |
| `npm run lint` | Checks the code style |
| `npm test` | Runs the unit tests |
| `npm run check:sounds` | Checks the recorded sound files against their manifest |

## Folders

- `electron/main` and `electron/preload`: the desktop shell (window, files, dialogs).
- `src/`: the app itself. `src/core/` is plain logic with no screen, so it can be tested alone. `src/styles/` holds the decided palette and fonts.
- `docs/`: the specification. `midis/`: the MIDI files. `tools/`: the audition tool, the sound capture script (`tools/sounds/`, regenerates `src/assets/sounds/`) and the MIDI import prototype.
