# Stack and tooling

## Stack

Decided on 2026-11-08. The user had no preference and no technical background, so the assistant recommended this and the user agreed.

- **Electron** for the desktop shell. Windows only. Delivered with an installer.
- **TypeScript** and **React** for the app.
- **Web Audio API** for all sound: scheduling notes, attack, decay and release on the recorded instrument sounds, the mixer, the level meters, and WAV export by rendering the whole song offline.
- The string layout editor and the Song timeline are custom drawings in the app.

### As built (plan24 step 1)

- Versions on 2026-11-09: Electron 45, React 19, Vite 8 through `electron-vite` 6, Vitest 5, ESLint 10 with `typescript-eslint`. TypeScript is held at 6.0 (`~6.0.3`), not 7, because `typescript-eslint` does not support 7 yet. Raise it when it does.
- The three font faces ship inside the app as `@fontsource` packages, so the app works offline. Only the weights used are imported: Piazzolla 700, Golos Text 400 to 600, Fragment Mono 400.
- The window is sandboxed with context isolation. The preload script is built as CommonJS (`index.cjs`) because a sandboxed preload cannot be a module, although the rest of the package is ESM.
- `npm install` reports moderate-severity advisories in development tooling. None is shipped in the app (audited at the installer step, see below).

### Why

- Web Audio does the envelope shaping and the offline render the spec asks for, with no extra audio library.
- Web technology is the easiest place to build the custom editors.
- Electron covers the installer, save and open dialogs, reopening the last project, the unsaved-changes prompt, and a resizable window.
- The running app can be opened in the Playwright browser tool and checked.

### What was rejected

- Tauri: needs Rust, and the smaller size does not matter for a one-person app.
- C# and .NET: custom editors are much harder, and the UI cannot be tested in a browser.
- Godot: weaker UI and audio tools for a music editor.

### Known downside

The installed app is large (around 100 to 150 MB) and uses more memory than a native app. Accepted.

### Known risk

The plan is to record the chosen General MIDI sounds from the Windows synth into audio files. A web page can send notes to the Microsoft GS Wavetable Synth, but capturing its sound needs a separate method, such as capturing system audio. This is worked out in the audition tool, before the main app depends on it.

What the audition tool found (2026-11-08):

- Playing the synth is not possible from a web page. Chrome and Edge hide the Microsoft GS Wavetable Synth from Web MIDI on purpose (Chromium blocklisted it in 2015 after a crash bug, and Firefox does the same). Windows itself has it, and the browser lists no outputs for it.
- The audition tool plays it through a local Node script that calls the Windows MIDI API (winmm) through PowerShell. This works for playing. It has not been heard being recorded.
- Recording is solved (plan24 step 3, 2026-11-09): the bridge's PowerShell helper plays the notes while WASAPI loopback (`PyAudioWPatch`) captures the speakers' digital signal. Details in [sound.md](sound.md). The final app plays the recorded files, so it does not need the bridge.
- Fallback, accepted by the user in questionnaire 16: a free General MIDI soundfont with the same four instrument names. Not needed.

### As built (plan24 step 3)

- `tools/sounds/` holds the capture script (Python, `capture.py`), its requirements and the checker (`check.mjs`, run by `npm run check:sounds`). The Python venv and the raw takes are not committed.
- Python is a tool for regenerating the samples only. The app and its build do not need Python.

### As built (plan24 step 4)

- `src/audio/` is the only code that touches Web Audio. The sound files are bundled by Vite (`import.meta.glob`), read with XMLHttpRequest and decoded once at start. Details in [sound.md](sound.md).

### As built (plan24 step 20)

- The installer is made by `electron-builder` 26 from `electron-builder.yml`: NSIS, Windows x64, one-click and per user, app id `studio.modern.app`, no code signing and no icon. `npm run pack` builds an unpacked app into `release/win-unpacked/` (quick, to check what goes in) and `npm run dist` builds `release/modernstudio-setup-<version>.exe`. Both run `electron-vite build` first. The first run downloads the Electron zip and the NSIS tools.
- The package holds `out/` and `package.json` in an `app.asar`. React and the fonts are bundled into `out/`, so they are development dependencies and no `node_modules` is packed. `npm run check:package` fails if anything else would be in (and after a `pack` it checks the real `app.asar`).
- Advisories: `npm audit --omit=dev` finds none. The 15 moderate ones (`minimatch`) are in build and lint tools only. Details and the unchecked run-time points are in [open-items.md](open-items.md).

## Tooling installed

### Hallmark

A design skill for building web-style UI that does not look AI-generated.

- Source: https://github.com/Nutlope/hallmark, version 2.0.0, MIT licence, made by Together AI.
- Installed for this project only, at `.claude/skills/hallmark/`, by copying the repository's `skills/hallmark/` folder. Installed on 2026-11-08.
- The repository's own installer and its hook installer were not run. The hook installer edits `settings.json`, and it can be added later.
- Used as `/hallmark <prompt>`, `/hallmark redesign <path>` or `/hallmark audit <path>`. It does not act on an existing design unless it is named.
- It can use a Together AI image step only if `TOGETHER_API_KEY` is set. It is not set.
- The skill folder is not committed to git. To reinstall it, copy `skills/hallmark/` from the repository above into `.claude/skills/hallmark/`.
- Design and look are deferred, so it has not been used yet.
