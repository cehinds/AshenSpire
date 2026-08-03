# Desktop wrapper spike — Electron vs Tauri, measured

*Rune Falk, 2026-08-03. Branch `spike/desktop-wrapper` off `dev` (`70d35e2`). Game under
test: `dist/AshenSpire.html` (1.8 MB, self-contained), loaded byte-identical by both
wrappers — the probe lives in the wrapper (Electron preload / Tauri initialization
script), never in the game file.*

**Verdict first: no web-runtime-unclearable defect found. The stay-vanilla-web engine
ruling stands.** Both wrappers pass all five checks; both produced a working Linux
executable. The falsifier did not fire.

## The measured table

| Check | Electron 43.2.0 | Tauri 2.11.5 (webkit2gtk 2.52.3) |
|---|---|---|
| 1. Boot → playable (title buttons rendered) | **623–1209 ms** warm, 5 samples (first-ever launch 8492 ms — one-time profile/cache creation) | **982–1114 ms**, 4 samples |
| 2. Fullscreen toggle | enter ok, leave ok (`win.isFullScreen()` verified both edges) | enter ok, leave ok (`window.is_fullscreen()` verified both edges) |
| 3. Gamepad API | `navigator.getGamepads` is a function; `ongamepadconnected` present | same — both present |
| 4. Saves across restart | **survived**: sentinel written run 1, read back run 2; on disk in `<userData>/Local Storage/leveldb/` (Chromium LevelDB; default userData = `~/.config/AshenSpire`, `%APPDATA%\AshenSpire` on Windows) | **survived**: same protocol; on disk in `~/.local/share/com.falk.ashenspire/localstorage/tauri_localhost_0.localstorage` (WebKit SQLite, keyed by app identifier) |
| 5. Clean quit | exit code 0, both runs | exit code 0, both runs |

Sentinel physically verified in both stores (`strings` shows `spike_persist` /
`rune-spike-sentinel` in the LevelDB log and the SQLite file). Because the profile
directory is app-owned, "user clears browser data" — the standing worry about
localStorage saves on the web — does not exist in either wrapper: nothing but the app
(or a deliberate file deletion) touches that directory.

## The executables

- **Tauri**: `desktop/tauri/src-tauri/target/release/ashen-spire-tauri` — **13 MB single
  binary, game embedded at compile time**. Proven standalone: a copy run from a bare
  directory boots to playable and reads the existing save. Runtime dependency: system
  webkit2gtk/GTK3 (present on mainstream desktop Linux; on Windows it would be WebView2
  instead).
- **Electron**: `desktop/electron/build/AshenSpire-linux-x64/AshenSpire` — **313 MB
  directory** (bundled Chromium), produced by `@electron/packager`. Smoke-tested end to
  end: boots, reads the save written by the dev-mode run, exits 0.
- Dev mode: `cd desktop/electron && npm install && npm start`.
- Re-run everything: `desktop/electron/run-spike.sh` / `desktop/tauri/run-spike.sh`
  (each does write-run → restart → read-run and prints the JSON evidence).

## How it was measured (re-runnable)

Runner records epoch-ms before spawn (`SPIKE_T0`); probe polls the DOM at 16 ms until a
visible `<button>` matching /climb|continue|new/i exists (title screen's "BEGIN A
CLIMB" — confirmed against headless Chromium reference dump), then reports
`Date.now() - T0` plus API presence, does the localStorage write/read
(`SPIKE_MODE=write|read`), drives fullscreen on→off with both edges verified
wrapper-side, then requests quit; runner records exit code. Probe code is
check-for-check identical across wrappers.

## Boundaries — named, not cleared

- **Headless container, no window manager.** Fullscreen verified at window-state level;
  the pixel resize (innerWidth change) is not observable without a WM. Real-desktop
  fullscreen unverified here.
- **Gamepad: API presence only.** No physical pad in the container; actual input events
  untested in both wrappers. WebKitGTK's gamepad *input* path is the one I'd trust
  least — test with a real pad before shipping the Tauri route.
- **Timing is container timing.** Xvfb, no GPU (`disableHardwareAcceleration` /
  `WEBKIT_DISABLE_DMABUF_RENDERER=1`), software rendering. Numbers are valid
  Electron-vs-Tauri comparisons on the same box, not desktop absolutes. Render
  performance (fps in combat) was not measured — headless numbers would be noise.
- **Audio untested** — no audio device in the container.
- **`--no-sandbox` and root are container artifacts**, not needed on a real desktop.
- **Windows packaging — reported, not attempted** (no wine hacks, per assignment):
  - *Electron*: `@electron/packager --platform=win32` cross-packages from Linux without
    wine (it downloads the prebuilt win32 Electron and swaps in the app); embedding a
    custom .exe icon (rcedit) and code signing need wine or a real Windows machine;
    an NSIS installer (electron-builder) needs wine. Steam needs only the packaged
    directory, so the honest path is: package win32 on Linux unsigned/default-icon, or
    run the one packaging step on a Windows runner (e.g. GitHub Actions
    `windows-latest`).
  - *Tauri*: Linux→Windows cross-build is not officially supported (cargo-xwin route is
    experimental); the honest path is building on a Windows runner. Windows Tauri rides
    WebView2 — preinstalled on current Win10/11, bundler can carry the bootstrapper —
    which also means the Windows engine is Chromium-family, not WebKitGTK, so
    Linux-Tauri behavior does not fully predict Windows-Tauri behavior. Electron ships
    the same Chromium everywhere.

## Read for the decision (one paragraph, not a ruling — that's Marina's)

Both wrappers clear the spike. They differ on cost, not capability: Tauri is 13 MB and
fast to ship but its engine varies per OS (WebKitGTK on Linux, WebView2 on Windows) —
the game would need testing per engine, which is the thing stay-vanilla-web exists to
avoid paying twice. Electron is 313 MB but is *the same Chromium the game already runs
in*, everywhere — for a $3.00 Steam title whose whole engine premise is "one web
runtime, one behavior," Electron is the wrapper that keeps that premise true.
