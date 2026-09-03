# Windows Compatibility Audit

Audited on 2026-09-03 against the codebase as of commit `dec9f4e`. Scope: `main.js`, all of `src/*.js`, `src/styles.css`. Goal: identify anything that assumes macOS and would need attention before running/shipping this app on Windows.

## Verdict

The app is built entirely on cross-platform Electron/Node/Chromium APIs — no native modules, no shelled-out macOS binaries, no AppleScript. It should run on Windows close to as-is. One real behavioral gap and a couple of cosmetic mismatches were found; nothing structural.

## Confirmed gap (behavioral, not a crash)

- **`overlayWindow` and `baselinePreviewWindow`** (`main.js`) call:
  - `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`
  - `setAlwaysOnTop(true, 'screen-saver')`

  Both are macOS-oriented. Electron doesn't error on Windows, it silently no-ops the "stay visible across virtual desktops / over full-screen apps" part. Practical effect: on Windows, the smoke-test overlay could get hidden if the user switches virtual desktops or focuses a full-screen app mid-run, whereas on macOS it persists. Plain always-on-top, frameless mode, and drag regions still work fine on Windows.

  **Fix if/when needed:** branch on `process.platform` and use a Windows-appropriate always-on-top level (Windows only supports a simple on/off, no level), and accept that all-workspaces visibility just won't apply there.

## Cosmetic-only (no functional risk)

- **Window controls** (`.window-controls` in `styles.css` / `start.html`): styled and positioned like macOS traffic lights (top-left, colored dots, close red / minimize yellow). Would work identically on Windows but reads as conventionally "wrong" there — Windows users expect ✕ / ─ glyphs in the top-right corner.
- **Font stacks** already degrade correctly and need no changes:
  - Body: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` — Windows skips the two unrecognized mac font names and lands on `"Segoe UI"`, the correct native choice.
  - Editor textarea: `ui-monospace, "SF Mono", Menlo, monospace` — worst case on Windows it falls through to the generic `monospace` keyword, still a monospace font, just a different one.

## Confirmed clean

- No native modules, no `child_process`/`exec`/`spawn`, no AppleScript/osascript.
- No hardcoded `/`-style paths — all file I/O goes through `path.join`.
- No Cmd-key-specific keyboard handling (no `metaKey`/`CmdOrCtrl` assumptions).
- Screenshot capture (`desktopCapturer`), file dialogs (`dialog.*`), and `shell.openPath` / `shell.openExternal` / `shell.showItemInFolder` are all standard cross-platform Electron APIs.
- The one `process.platform !== 'darwin'` check (in the `window-all-closed` handler) is the standard correct cross-platform Electron boilerplate — quit on last window closed for Windows/Linux, stay running for macOS — not a bug, leave as-is.

## Not code, but relevant

There is no packaging config in this repo (`package.json` has no `build` block, no `electron-builder`/`electron-forge` dependency). Today, "running on Windows" means `npm start` from source there. Producing an actual distributable `.exe` would require adding a packager and a Windows build target — a separate, additive task, not a blocker for functional compatibility.

## Suggested next steps (not yet done)

1. Branch the two `setVisibleOnAllWorkspaces` / `setAlwaysOnTop` calls on `process.platform` if the Windows behavioral gap above matters in practice.
2. Reposition/restyle the window controls for Windows convention (top-right, ✕/─) if shipping to Windows users, ideally behind a `process.platform` check so macOS keeps its current look.
3. Add an `electron-builder` (or similar) config with a `win` target when ready to produce a distributable build.
