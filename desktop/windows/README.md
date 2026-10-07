# Windows installer

`AshenSpire-Setup-<version>.exe` installs the game for the current user (no
administrator prompt) into `%LOCALAPPDATA%\Programs\Ashen Spire`, with Start menu
and optional desktop shortcuts and an entry under *Installed apps*.

## Getting it

- **Download:** `https://github.com/cehinds/AshenSpire/releases/download/installer-<branch>/AshenSpire-Setup.exe`
  for `test`, `release` or `main` — the rolling `installer-<branch>` prerelease,
  replaced by every push to that branch.
- **CI:** Actions → *windows installer* → the `windows-installer-<commit>`
  artifact. It runs on every push to `test`, `release` and `main`, on pull
  requests that touch `desktop/`, and by hand (*Run workflow*) on any branch.
- **Locally** (Linux or Windows): Node 22, NSIS 3 (`apt install nsis` /
  `choco install nsis`), network for `npx @electron/packager` and Electron:

  ```
  node desktop/windows/build-installer.mjs
  ```

  Output: `build/windows-installer/AshenSpire-Setup-<version>.exe` (ignored by git).
  `--web <dir>` reuses a web edition built with
  `node tools/bundle.mjs --external-art --out <dir>` (without `--light`);
  `--stage-only` stops before packaging.

## The install screen

| Component | |
|---|---|
| Ashen Spire (required) | the game with its standard (light) art, fonts, music and map tiles — ~160 MB download, the installer itself |
| High-resolution art | ticked by default; downloaded during the install from the pinned art release (`art-release.json` → `packs.high`, ~194 MB) |
| Desktop shortcut | |

Unticked, the game plays on the light art. Running the installer again with the
box ticked adds the art; unticking it there removes it. An upgrade keeps the
earlier choice and does not download art that is already installed.

The next page has a **Choose game and high-quality art versions** button.
The game selectors list **test**, **release**, **main**, and **dev** and up to
five available successful installer builds per branch. Each version is read
from the exact build commit. **Download this game installer** opens that exact
GitHub artifact; GitHub sign-in is required. Unzip and run the downloaded
installer to install that game version and its matching art. Expired artifacts,
failed builds and pull-request previews are excluded. A branch with no available
installer says so. This installer continues to install its own bundled game,
whose version and branch are shown above the selectors.

The chooser shows the current installed art, the release required by this game,
and the latest published art version after checking GitHub. Branch and version
selectors use the public `cehinds/AshenSpire-art` catalog; a release is offered
for download only when the selected branch contains its commit. Branches with
unpublished work do not have a new packaged version until an art release is
published. **Refresh branches and art versions** updates the catalog.

**Use this high-quality art for installation** selects the matching game pack.
Other versions can be saved with **Download this art separately**, which opens
Save As and checks the archive's SHA-256 before replacing an existing download.
It does not install the game or change an existing game's art. The pinned pack
remains available when the catalog is offline; actual downloads need network.
Closing the chooser leaves the component checkbox unchanged unless you pressed
the installation button. Silent installs continue to use the pinned pack.

Both the installer page and chooser disclose: **The artwork is completely
AI-generated with OpenAI ChatGPT under human direction.** Fonts and other
third-party assets retain their credited licenses. The art repository's
`CREDITS.md` records provenance and rights.

## How it works

- **The game** is the web edition (`tools/bundle.mjs --external-art`, high
  default tier), shown by the Electron wrapper in `desktop/electron/`. The wrapper
  serves `game\` at the fixed origin `https://ashenspire.invalid/`, answered from
  disk and never from the network, because the edition loads its packs over
  http(s) only. A fixed origin keeps saves (`%APPDATA%\AshenSpire`) across launches
  and upgrades.
- **Light vs. high art**: the HTML pins the `light`, `common` and `high` indexes.
  The installer carries `light` and `common` with their objects; the high index
  waits in `install-data\hd-index\`. While it is missing from `game\packs\` the
  game loads light (`src/ui/assetPacks.js` falls back high → light).
- **The download** (`fetch-hd-art.ps1`, Windows PowerShell 5.1): fetches the zip,
  checks its pinned sha256, writes every high object the index lists after
  checking its sha256, and copies the high index in **last**, so a failed or
  cancelled download leaves a working light install. Exit codes: 2 network,
  3 zip mismatch, 4 object mismatch, 5 other; any failure shows a message and the
  install still completes.
- **The chooser** (`art-options.ps1`, Windows Forms / PowerShell 5.1) discovers
  branches and public releases through `art-releases.ps1`. It checks release
  ancestry and restricts download URLs to the art repository. Installation
  remains pinned to the game's verified indexes; a different release cannot
  silently bypass those checks. The installed art tag is recorded in the
  existing uninstall registry entry. Older installs show their version as
  unrecorded until upgraded.
- **Prune**: the last step deletes objects no installed index lists (unticked
  art, an older version's files).
- **Uninstall** removes exactly the installed files and asks before deleting saves.

## Not yet covered

- The `.exe` files are **unsigned**: SmartScreen shows "Windows protected your
  PC" → *More info* → *Run anyway*. Signing needs a code-signing certificate.
- Stock Electron and NSIS icons (no game icon exists yet).
- x64 only. Android and iOS are separate work.
