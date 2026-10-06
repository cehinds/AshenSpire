# AshenSpire

A browser roguelike with card combat, equipment, skill training, exploration, and optional LAN co-op.

- **[Play / download builds](https://cehinds.github.io/AshenSpire/)** · [Changelog](CHANGELOG.md) · [Windows installer](https://github.com/cehinds/AshenSpire/actions/workflows/windows-installer.yml?query=branch%3Atest).
- **Development preview.** Release acceptance: [FINISH](docs/FINISH.md). The title screen and build history identify the version you are playing.

## Play and download

- **Test — latest promoted game; full QA:** [Play](https://cehinds.github.io/AshenSpire/test/latest/) · [HTML](https://cehinds.github.io/AshenSpire/test/latest/download/AshenSpire.html) · [Build zip](https://github.com/cehinds/AshenSpire/actions/workflows/dev-preview.yml?query=branch%3Atest) · [Build numbers / history](https://cehinds.github.io/AshenSpire/test/).
- **Dev — integration:** [Play](https://cehinds.github.io/AshenSpire/dev/latest/) · [HTML](https://cehinds.github.io/AshenSpire/dev/latest/download/AshenSpire.html) · [Build zip](https://github.com/cehinds/AshenSpire/actions/workflows/dev-preview.yml?query=branch%3Adev) · [Build numbers / history](https://cehinds.github.io/AshenSpire/dev/).
- **Release — owner-selected candidate:** [Play](https://cehinds.github.io/AshenSpire/release/latest/) · [HTML](https://cehinds.github.io/AshenSpire/release/latest/download/AshenSpire.html) · [Build zip](https://github.com/cehinds/AshenSpire/actions/workflows/dev-preview.yml?query=branch%3Arelease) · [Build numbers / history](https://cehinds.github.io/AshenSpire/release/).
- **Main — stable:** [Play](https://cehinds.github.io/AshenSpire/main/latest/) · [HTML](https://cehinds.github.io/AshenSpire/main/latest/download/AshenSpire.html) · [Build zip](https://github.com/cehinds/AshenSpire/actions/workflows/dev-preview.yml?query=branch%3Amain) · [Build numbers / history](https://cehinds.github.io/AshenSpire/main/).
- **GitHub downloads:** sign in, open a successful run, download `<branch>-standalone-<commit>`, unzip, and open its HTML file. Retention: dev 14 days, test 30, release/main 90.
- **Hosted builds:** publication can lag the branch; use the build zip if a hosted link is unavailable.
- **Build numbers:** `<major>.<minor>.<candidate>.<build>`; the counter resets with each candidate. Compare the full version. [Versioning](docs/versioning.md).
- **Windows:** download `windows-installer-<commit>`, unzip, and run `AshenSpire-Setup-<version>.exe`. Installs for your user; choose game builds and compatible optional high-resolution art in the version chooser. [Installer guide](desktop/windows/README.md).

## Alternative branch previews

- **[Alternative previews and build numbers](https://cehinds.github.io/AshenSpire/#alternative-previews)** — separate from the primary channels, with each published build's full version and commit.
- **Alternative dev:** ![Published build](https://cehinds.github.io/AshenSpire/alternative/dev/latest/build.svg) · [Play](https://cehinds.github.io/AshenSpire/alternative/dev/latest/) · [HTML](https://cehinds.github.io/AshenSpire/alternative/dev/latest/download/AshenSpire.html) · [Build zip](https://github.com/cehinds/AshenSpire/actions/workflows/dev-preview.yml?query=branch%3Aalternative%2Fdev) · [Build numbers / history](https://cehinds.github.io/AshenSpire/alternative/dev/).
- **Alternative test:** ![Published build](https://cehinds.github.io/AshenSpire/alternative/test/latest/build.svg) · [Play](https://cehinds.github.io/AshenSpire/alternative/test/latest/) · [HTML](https://cehinds.github.io/AshenSpire/alternative/test/latest/download/AshenSpire.html) · [Build zip](https://github.com/cehinds/AshenSpire/actions/workflows/dev-preview.yml?query=branch%3Aalternative%2Ftest) · [Build numbers / history](https://cehinds.github.io/AshenSpire/alternative/test/).
- **Combat Studio:** the current alternative adds isolated authoring previews and layered art. Download its `alternative-*-preview-<commit>` artifact; the studio is under `workbench/docs/design/combat-depth-2026-10-05/`. [Branch guide](https://github.com/cehinds/AshenSpire/blob/alternative/dev/docs/design/COMBAT-STUDIO-ALTERNATIVE.md). Saved layouts are not yet bound to live combat.
- **Updates:** primary `dev → test` promotions sync existing alternative dev/test pairs. Alternative changes are protected; overlapping edits stop for review. Alternative dev uses development checks; alternative test uses the full test pipelines. [Sync status](https://github.com/cehinds/AshenSpire/actions/workflows/sync-alternatives.yml).
- Preview URLs appear after their first successful publication. History pages show actual published numbers; a source branch alone is not a published preview.

## Local, offline, art, and Unity

- **Local:** install Node.js 22, clone, run `node tools/fetch-art.mjs --pack common`, then `node tools/launch.mjs`, `run.bat`, or `./run.sh`. Opens `http://localhost:8080`; no root `npm install`. Options: `--no-open`, `--port <n>`, `--build-only`, `--full-art`.
- **Offline:** double-click the light-art HTML download, or use **Download & saves → Make available offline** in the hosted game. LAN co-op needs the Node server. [Distribution guide](dist/README.md).
- **Art:** [AshenSpire-art](https://github.com/cehinds/AshenSpire-art) holds masters and shared assets; [art releases](https://github.com/cehinds/AshenSpire-art/releases) supply high, light, and common packs. `art-release.json` pins compatibility. Dev uses light art; current test/release/main web builds use high art. HTML downloads use light art; phones choose light in Auto mode.
- **Unity:** [AshenedSpire](https://github.com/cehinds/AshenSpire-Unity) has its own [playable builds](https://cehinds.github.io/AshenSpire-Unity/) and [milestones](https://github.com/cehinds/AshenSpire-Unity/blob/dev/docs/Unity-Milestones.md).

## Gameplay

- **Classes:** Reaver, Rogue, Starseer, or Herald. Choose gear and attributes, or Quick start with the recommended Reaver.
- **Journey:** seeded regions, encounters, shops, quests, and bosses. Custom Climb offers Sealed, Draft, and Endless rules.
- **Combat:** cards spend Stamina and sometimes Mana or HP. Enemy intents preview attacks; ratings, Poise, Ward, weight, and statuses shape outcomes. Inspect cards for current rules.
- **Hand:** default draws are four cards; Retain cards stay and other unplayed cards shuffle back. Capacity defaults to fifteen. Settings can change these rules.
- **Equipment and deck:** weapons lend attacks and techniques; owned cards move between deck and sideboard outside combat. Sealed/Draft preserve their dealt pools.
- **Progression:** XP unlocks attributes and rewards. Books teach track and cross-class lessons; class books grant XP and reusable class cards.
- **Services:** markets trade goods, smiths improve equipment, masters train skills, and rest services restore resources. Collect rewards after combat.
- **Co-op and saves:** LAN play shares routes and fights. Runs autosave; older saves may retain earlier rule snapshots.
- **Exact rules:** [SPEC](SPEC.md) · [Developer guide](DEVELOPER.md) · [Combat and equipment contract](docs/COMBAT-EQUIPMENT-RULES.md) · [Implementation boundaries](docs/SPEC-RECONCILE.md) · [Balance measurements](docs/BALANCE.md). Design contracts can include unimplemented work.

## Screenshots

- [Title](docs/preview/title.png) · [Map](docs/preview/map.png) · [Combat](docs/preview/combat.png) · [Game page](https://cehinds.github.io/AshenSpire/AshenSpire.html).
- **Armoury:** [Equipment](docs/preview/armoury-simple-equipment-1440.png) · [Character](docs/preview/armoury-simple-character-1440.png) · [Inventory](docs/preview/armoury-simple-inventory-1440.png) · [Cards](docs/preview/armoury-simple-cards-1440.png) · [Phone cards](docs/preview/armoury-simple-cards-390.png).
- **Title flow:** [Folded wide](docs/preview/startup-folded-wide-1440x900.png) · [Folded phone](docs/preview/startup-folded-mobile-390x844.png) · [Title wide](docs/preview/title-menu-wide-1440x900.png) · [Load phone](docs/preview/title-load-mobile-390x844.png).
- **Catalog QA:** [Title family](docs/preview/component-catalog-title-wide-1440x900.png) · [Startup family](docs/preview/component-catalog-startup-mobile-390x844.png) · [Class sprites](docs/preview/class-sprites.svg) · [Menu control audit](docs/preview/menu-control-audit.md).
- Screenshots carry their captured build stamp. Inspect regenerated images before committing them.

## UI library and design

- [Player polish asset kit](docs/design/player-polish-asset-kit-2026-10-02/index.html) · [Integration guide](docs/design/player-polish-asset-kit-2026-10-02/README.md).
- [Player polish inspiration](docs/design/player-polish-2026-10-01/index.html) · [Design notes](docs/design/player-polish-2026-10-01/README.md).
- [Visual component catalog](https://cehinds.github.io/AshenSpire/docs/component-catalog.html) · [Source](docs/component-catalog.html) · [Markdown catalog](docs/COMPONENT-CATALOG.md).
- [Folding Tray gallery](docs/tray-gallery.html) · [Tray contract](docs/TRAY-COMPONENTS.md).
- [Component architecture](docs/COMPONENT-MODEL-ARCHITECTURE.md) · [Armoury layout](docs/ARMOURY-LAYOUT-BRIEF.md) · [Asset-component index](docs/ASSET-COMPONENTS.md).
- UI changes update both catalogs and include component IDs plus the catalog link in the PR summary.

## Contributing and roadmap

- **Branch flow:** `feature/* → dev → test → release → main`. Sessions merge reviewed, green work into dev and promote to test; release/main remain owner-controlled. Existing `alternative/…/dev → alternative/…/test` pairs receive compatible promoted updates.
- [Contributing rules](CONTRIBUTING.md) · [Build and test commands](DEVELOPER.md) · [Architecture map](docs/ARCHITECTURE-MAP.md) · [Current dev snapshot](docs/ARCHITECTURE-CURRENT-DEV.md).
- [QA testing](docs/QA-TESTING.md) · [Feature delivery loop](docs/FEATURE-DELIVERY-LOOP.md) · [Smith modal design](docs/qa/2026-08-25-smith-modal-design.md).
- [Project board](https://github.com/users/cehinds/projects/4) · [Status and daily briefs](https://github.com/cehinds/AshenSpire/issues/183).
- **Code layout:** `src/content/` holds data, `src/engine/` rules, `src/model/` schemas, `src/ui/` rendering, `styles/` CSS, `tests/` checks, and `docs/` contracts. Adding a card should touch one content file.
- **Roadmap:** combat and run loop shipped; content is core implemented; polish and release acceptance remain open. [Acceptance tracking](docs/FINISH.md) · [Milestone criteria](SPEC.md).

## Legal and credits

- Code: [MIT license](LICENSE). Original fan-inspired work; no FromSoftware assets, music, or proper nouns, and no affiliation with FromSoftware or Bandai Namco.
- “Ashen Spire was built by AI under human direction.” Anthropic Claude assisted with code and writing; OpenAI ChatGPT generated artwork. The [AI disclosure](src/content/aiDisclosure.js) records the full account, including synthesized music. [Credits](CREDITS.md) records sources, rights, and provenance gaps; bundled lore fonts use SIL OFL.
