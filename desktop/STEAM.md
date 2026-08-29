# Ashen Spire on Steam — the upload shape

*Rune Falk, 2026-08-06, on `feature/electron-package`. Wrapper ruled by Marina:
Electron (grounds in her ruling; spike evidence in `spike/desktop-wrapper`'s
`desktop/FINDINGS.md`). This doc is the path from a packaged directory to a
playable Steam install. Money and account facts live here and only here.*

## What exists after `desktop/electron/` packaging

- `build/AshenSpire-linux-x64/` — Linux build; entry executable `AshenSpire`.
- `build/AshenSpire-win32-x64/` — Windows build; entry executable `AshenSpire.exe`.
  Cross-packaged from Linux without wine, therefore **unsigned** and carrying the
  stock Electron icon (embedding a custom .exe icon needs rcedit under wine or a
  Windows machine — cosmetic, not blocking).
- The game (`dist/AshenSpire.html`) rides inside `resources/app.asar` in both,
  byte-identical to the repo dist it was packaged from (verify:
  `npx @electron/asar extract-file <build>/resources/app.asar dist-embed/AshenSpire.html`
  then `sha256sum` against `dist/AshenSpire.html`).
- Saves: Chromium profile localStorage — `%APPDATA%\AshenSpire` on Windows,
  `~/.config/AshenSpire` on Linux. App-owned; no browser-clearing hazard.

## Steamworks shape (one app, two depots)

1. **App**: one Steamworks appid for Ashen Spire. Registering it is the **Steam
   Direct fee: USD 100 per app**, paid once at registration, recoupable by Valve
   once the app passes USD 1,000 adjusted gross revenue. Price point USD 3.00 is
   set later on the store page, independent of the fee.
2. **Depots**: two — `<appid>1` Windows content = the *contents* of
   `AshenSpire-win32-x64/`, `<appid>2` Linux content = the *contents* of
   `AshenSpire-linux-x64/`. Depot = the directory's contents, not the directory.
3. **Launch options**: one per OS. Windows → `AshenSpire.exe` (OS filter Windows);
   Linux → `AshenSpire` (OS filter SteamOS + Linux). No arguments needed.
4. **Upload**: `steamcmd` with an `app_build` VDF naming both depots, or the
   Steamworks web uploader for builds this small. Each upload lands on a branch;
   nothing ships until a build is **set live on `default`** — that last click is
   Constantine's, in Steamworks, every release.
5. **Steam client config**: nothing exotic — no DRM wrapper step, no launch
   scripts. (Steam's optional DRM wrap is known-hostile to Electron executables;
   skip it. The $3 title's copy protection is its price.)

## What Constantine does, in order

1. Steamworks partner account + pay the app fee (item 1 above) → appid exists.
2. Fill store page (name, assets, price) at leisure — parallel to builds.
3. We hand him the two packaged directories (or the VDFs + steamcmd line ready
   to run); upload happens from any machine with steamcmd.
4. **The one-boot check, and it is his**: install from Steam on a real Windows
   machine and boot to the title screen once before setting live. Our win32
   build is cross-packaged and spike-verified only at the Chromium level —
   *no family session has ever executed AshenSpire.exe on real Windows.* That
   named boundary closes only in his hands (or a Windows CI runner later).
   SmartScreen may warn on the unsigned exe outside Steam; installs *through*
   Steam don't hit SmartScreen, which is why the check is "install from Steam,"
   not "double-click the exe."
5. Set the build live on `default`.

## Boundaries this doc inherits, unclosed

- Unsigned Windows executable; stock icon (cosmetic path named above).
- Steam Overlay + Steam Input over Electron: expected fine, **untested** — falls
  out of the same one-boot check.
- macOS: no depot, deliberately out of scope at $3.00 unless ruled otherwise.
