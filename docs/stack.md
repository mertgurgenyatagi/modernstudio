# Stack and tooling

## Stack

Decided on 2026-11-08. The user had no preference and no technical background, so the assistant recommended this and the user agreed.

- **Electron** for the desktop shell. Windows only. Delivered with an installer.
- **TypeScript** and **React** for the app.
- **Web Audio API** for all sound: scheduling notes, attack, decay and release on the recorded instrument sounds, the mixer, the level meters, and WAV export by rendering the whole song offline.
- The string layout editor and the Song timeline are custom drawings in the app.

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
- Recording is still open. Capturing system audio while the bridge plays the notes is the likely route. The final app plays the recorded files, so it does not need the bridge.
- Fallback, accepted by the user in questionnaire 16: a free General MIDI soundfont with the same four instrument names, if the Windows synth cannot be recorded exactly.

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
