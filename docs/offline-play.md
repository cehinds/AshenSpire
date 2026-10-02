# Download and play offline

- Open **Download & saves** from Title or Settings while online.
- Choose **Release**, **Test**, **Dev**, or **Main** in **Build branch**. Its latest
  published build is checked automatically. Choose **Download game**.
- In supported browsers, the save-location dialog opens immediately. Choose a
  file location; the progress bar tracks the transfer and the game saves there.
  Other browsers start a normal download automatically and control the location
  through their download settings. **Save game file** retries that browser save.
  On a computer,
  double-click the downloaded HTML file to open it in your browser.
- **Download a folder copy (zip)** (a newer build, the web edition, only) saves
  the same build as one folder: its game file beside the `packs/` and
  `objects/` folders it reads its light art, fonts, map tiles and music from
  (about 55 MB). Unzip it, keep the folder together, and double-click the
  `.html` file inside. A double-clicked folder uses the synthesized score.
  Every file is checked against the build's published checksums as it is
  added; anything that does not match stops the zip, and nothing is saved.
  An older build is one self-contained file, and the panel says so instead.
- Use **Export saves** in your online game and **Import saves** in the downloaded
  game to move your profile and all three slots. Import from Title; it previews
  the backup, asks before replacing saves, keeps a recovery copy, then reloads.
- Keep using the same file location and browser. Browser and file copies have
  separate storage. Export before moving files, changing browsers, or updating.
- Updates are manual downloads. Export your progress before opening a new build.
- Solo play supports offline use. Maps fall back to simpler built-in artwork.
  Online multiplayer and checking for updates require internet. Opening HTML
  files on phones varies by browser; this is not a phone app installer.

## Implementation

`src/content/offlinePlay.js` owns configuration. `tools/pages-site.mjs` writes
the actual artifact byte count into each build's existing JSON metadata. The UI
reads the selected branch's latest feed and pins its numbered build URL, validates the byte
count when supplied, and downloads that HTML. Older published metadata without
a byte count is supported; the size is measured after preparation. Opening the
panel checks the release automatically; **Check for updates** refreshes it.
A development preview does not publish a release. A feed exists only when
the Pages site has a `/<branch>/latest/build.json` for that branch. `dev` and
`test` builds are no longer committed, so the site has no Dev feed until the
Pages rebuild of uncommitted builds (#1360) is in; from then on the Dev feed
follows each deployed `dev` push. Until then, and whenever `/dev/latest/` is
absent, current `dev` builds come from the `dev-standalone-<commit>` workflow
artifact (DEVELOPER.md, *Run & test*).

Branch labels and feed URLs are configured in `src/content/offlinePlay.js`.
Files include the branch and version in their names. The native save picker runs
within the Download click's user activation, before fetching. Its writable stream
is closed only after byte validation and aborted on failure. Without the picker,
the game uses a Blob download. Progress uses metadata or response length when
available; unknown totals show an indeterminate bar and actual received MB.

The folder copy (docs/EXTERNAL-ASSETS-PLAN.md, *Step 7 as built*) is offered
when the feed says `shape: "pack"`. `src/model/offlineDownload.js` `releasedZip`
names it from the feed, and `assembleZip` fetches the numbered page, reads the
art pin from that page, finds the site's store through the page's
`asset-base.json`, and streams page, light and common indexes, their `.js`
twins, the font sidecar and every listed object into a store-only zip
(`src/model/zipStream.js`, the same bytes as `tools/zip.mjs`), hash-checking
each before it is written. `src/ui/offlineZipFlow.js` holds the screen's
logic (which box shows, the failure words, one save), so CI tests it without a
browser; `tools/pages-site.mjs` records the zip's exact size as `zipBytes`. It saves through the picker where there is one, and
a Blob download otherwise, like the single file.

`src/engine/saveTransfer.js` transfers only the profile and three run slots.
It validates in memory with the normal save manager, rejects unsupported or
corrupt data, writes a recovery copy before live changes, and rolls back storage
on write failure. Existing archives are untouched. Saved runs remain subject to
normal game-version compatibility; an older release may reject newer saves.

## Verification

Run `node tests/offline-play.test.mjs` for transfer validation and storage failure
cases. `node tools/offline-play-qa.mjs` exercises the real generated HTML with a
local release-feed fixture in an isolated browser profile. It downloads actual
files, compares game bytes, exports/imports a real run, disables the network,
opens the downloaded file, and captures desktop and phone-size screenshots in
`artifacts/offline-play/`. This fixture does not prove a deployed Pages release
or physical phone support.

`--offline-only` skips download verification and uses the local generated file
with a save fixture. It checks import, recovery, reload, map/combat entry, and
the blocked-storage guard without claiming to test a downloaded release.

`--live-release-check` verifies automatic release detection and preparation
against the published feed and HTML. It captures desktop and phone-width views,
but does not test the final file save.

`--download-controls-check` tests all branch selections, intermediate progress,
picker activation timing, cancellation, failed writes, and automatic fallback
download. It uses a throttled 1 MB fixture and controlled file handle, not the
native OS dialog. It captures desktop and phone-width progress screenshots.

`--zip` publishes `build/web` (from `node tools/launch.mjs --build-only`) into a
local copy of the Pages shape, has the game assemble its folder copy (the Blob
path, then a stubbed save-picker handle whose writes must match it byte for
byte), unzips it and checks every entry against the pin and the indexes, then
stops the server and plays the folder under `file://` with the network off:
light art, the lore faces and a title backdrop from the folder, then the same
import, map, combat and blocked-storage checks. It does not test a native save
dialog, a phone, or a browser other than Chromium.
