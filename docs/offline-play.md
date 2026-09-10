# Download and play offline

- Open **Download & saves** from Title or Settings while online.
- **Check for updates**, then **Download released game**. When ready, choose
  **Save game file**. On a computer,
  double-click the downloaded HTML file to open it in your browser.
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
reads the main/latest feed and pins its numbered build URL, validates the byte
count, and downloads that HTML. Publishing this metadata requires the normal
Pages pipeline; a development preview does not publish a release.

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
