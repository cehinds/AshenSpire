# AshenSpire

<!-- feature-preview:start -->
## Feature preview — JSON-driven game profiles

The same runtime supports two authored configurations. **Product core** includes its required bundled modules and keeps optional gameplay packages off where the core has a fallback. **Current game** preserves the full legacy configuration.

- **Product core:** [Play on Pages (publication pending)](https://cehinds.github.io/AshenSpire/branches/Feature/json-game-modules/latest/) · [exact standalone artifact](https://github.com/cehinds/AshenSpire/actions/runs/38701086476/artifacts/11955653884) · [build run](https://github.com/cehinds/AshenSpire/actions/runs/38701086476)
- **Current game:** [Play on Pages (publication pending)](https://cehinds.github.io/AshenSpire/branches/Feature/json-game-current-preview/latest/) · [exact standalone artifact](https://github.com/cehinds/AshenSpire/actions/runs/38701086793/artifacts/11956237379) · [build run](https://github.com/cehinds/AshenSpire/actions/runs/38701086793)

The combat captures below are from build 0.7.1.1538, digest `4c1356f8c0`. Capture details, including title and rest screens, are in [the profile evidence folder](docs/preview/features/json-game-modules/README.md).

**Product core — combat**

| Mobile · 390×844 | Desktop · 1440×900 | Wide · 1920×1080 | Tablet · 820×1180 |
| --- | --- | --- | --- |
| ![Product core mobile combat](docs/preview/features/json-game-modules/core/mobile-combat.png) | ![Product core desktop combat](docs/preview/features/json-game-modules/core/desktop-combat.png) | ![Product core wide combat](docs/preview/features/json-game-modules/core/wide-combat.png) | ![Product core tablet combat](docs/preview/features/json-game-modules/core/tablet-combat.png) |

**Current game — combat**

| Mobile · 390×844 | Desktop · 1440×900 | Wide · 1920×1080 | Tablet · 820×1180 |
| --- | --- | --- | --- |
| ![Current game mobile combat](docs/preview/features/json-game-modules/current/mobile-combat.png) | ![Current game desktop combat](docs/preview/features/json-game-modules/current/desktop-combat.png) | ![Current game wide combat](docs/preview/features/json-game-modules/current/wide-combat.png) | ![Current game tablet combat](docs/preview/features/json-game-modules/current/tablet-combat.png) |

The current profile's 390-pixel combat capture is visually crowded. Public Pages availability and the existing release gallery were not verified in this pass; the local standalone captures and successful build artifacts are verified.
<!-- feature-preview:end -->

A browser roguelike: build a character, explore a seeded world, and fight with cards.

> **AI-made game.** The original game code, design, writing, artwork and music
> are created by AI under human direction. Third-party fonts and software are
> exceptions; some asset records still need confirmation. [AI acknowledgement and credits](#legal-and-credits).

[Play](#play-and-download) · [Screenshots](#screenshots) · [Features](#features) · [Guides](#guides)

## Play and download

Choose **Test** for the latest promoted game. Badges show the full **published**
build number and link to its history. Play and HTML follow that channel's latest build.

<!-- readme-sync:channels -->
| Channel | Published build / history | Play | Download |
| --- | --- | --- | --- |
| **Test** — promoted | [![Test build](https://cehinds.github.io/AshenSpire/test/latest/build.svg)](https://cehinds.github.io/AshenSpire/test/) | [Play Test](https://cehinds.github.io/AshenSpire/test/latest/) | [HTML](https://cehinds.github.io/AshenSpire/test/latest/download/AshenSpire.html) |
| Dev — integration | [![Dev build](https://cehinds.github.io/AshenSpire/dev/latest/build.svg)](https://cehinds.github.io/AshenSpire/dev/) | [Play Dev](https://cehinds.github.io/AshenSpire/dev/latest/) | [HTML](https://cehinds.github.io/AshenSpire/dev/latest/download/AshenSpire.html) |
| Release — candidate | [![Release build](https://cehinds.github.io/AshenSpire/release/latest/build.svg)](https://cehinds.github.io/AshenSpire/release/) | [Play Release](https://cehinds.github.io/AshenSpire/release/latest/) | [HTML](https://cehinds.github.io/AshenSpire/release/latest/download/AshenSpire.html) |
| Main — earlier stable | [![Main build](https://cehinds.github.io/AshenSpire/main/latest/build.svg)](https://cehinds.github.io/AshenSpire/main/) | [Play Main](https://cehinds.github.io/AshenSpire/main/latest/) | [HTML](https://cehinds.github.io/AshenSpire/main/latest/download/AshenSpire.html) |
<!-- /readme-sync:channels -->

**Windows:** [Release installer / build chooser](https://github.com/cehinds/AshenSpire/releases/download/installer-release/AshenSpire-Setup.exe)
· [Installer build number](https://github.com/cehinds/AshenSpire/releases/tag/installer-release)
· [Installation guide](desktop/windows/README.md).
The chooser identifies the selected game build; its installer can be newer than the hosted Test badge.

**Feature branches:** pushed `Feature/*`, `feature/*`, `fix/*` and `chore/*` branches are built on push and publish to `https://cehinds.github.io/AshenSpire/branches/<branch>/latest/` when the Pages workflow completes; a pull request is not required. Branch previews play in a sandbox and do not keep progress. The build is also available from its [Actions run](https://github.com/cehinds/AshenSpire/actions/workflows/feature-preview.yml).

**JSON profile verification (not a published preview):** source branches are [`Feature/json-game-modules`](https://github.com/cehinds/AshenSpire/tree/Feature/json-game-modules) and [`Feature/json-game-current-preview`](https://github.com/cehinds/AshenSpire/tree/Feature/json-game-current-preview). Final source build `0.7.1.1539` (digest `f6930be11b`, source `ec08a6ca9`) passed the configured CI gates; its [core-profile artifact](https://github.com/cehinds/AshenSpire/actions/runs/38703926669/artifacts/11957243379) is available. Current-default JSON build `0.7.1.1535` (digest `e83c1c0ad6`, source `a330ee248`) has its [CI artifact](https://github.com/cehinds/AshenSpire/actions/runs/38703962043/artifacts/11957851105). These artifacts are for verification and do not mean a playable preview was deployed. Profile implementation status and limitations are in [the JSON modules handoff](docs/ai/json-game-modules/README.md). Gallery captures remain from build 1,538 before final nonvisual fixes; they were not recaptured for 1,539.

[All builds](https://cehinds.github.io/AshenSpire/) · [Workbench](https://cehinds.github.io/AshenSpire/workbench/) · [ZIP artifacts](https://github.com/cehinds/AshenSpire/actions/workflows/dev-preview.yml) · [Changelog](CHANGELOG.md).
Publication can lag source changes. For ZIPs, open a successful run and download its named build artifact.

## Screenshots

Latest published Release candidate **0.7.1.1060**, captured 2026-10-08 UTC.
[Play this exact build](https://cehinds.github.io/AshenSpire/release/1060/) · [Capture details](docs/preview/releases/0.7.1.1060/README.md).
Dev/Test can contain newer features. Select an image to view its full size.

| Create a character | Explore a route |
| --- | --- |
| ![Character creation with four classes and Reaver starting statistics](docs/preview/releases/0.7.1.1060/creation.png) | ![Pale Marches map with a revealed route and encounter nodes](docs/preview/releases/0.7.1.1060/map.png) |
| **Fight with cards** | **Visit shops and improve equipment** |
| ![Combat with enemy intentions and four cards in hand](docs/preview/releases/0.7.1.1060/combat.png) | ![Merchant relics, equipment categories and services](docs/preview/releases/0.7.1.1060/shop.png) |

<details>
<summary>Phone combat — 390 × 844</summary>

![Phone combat with enemy intentions, cards and turn controls](docs/preview/releases/0.7.1.1060/combat-phone.png)

</details>

## Features

Checked items are implemented; build channels and older saves can differ.

- [x] Four classes: Reaver, Rogue, Starseer, Herald
- [x] Seeded exploration, encounters, shops and bosses
- [x] Card combat with enemy intentions, equipment and statuses
- [x] Deck building, skill training, attributes and rewards
- [x] Saved runs, offline play and phone layouts
- [x] Optional LAN co-op
- [x] Alternative appearance by default; optional Classic appearance with the debug flag on
- [ ] Complete 1.0 release acceptance — [remaining work](docs/FINISH.md)

## Guides

[Getting started and project links](docs/PROJECT-GUIDE.md) · [Contributing](CONTRIBUTING.md)
· [Game rules](SPEC.md) · [Development](DEVELOPER.md) · [Credits](CREDITS.md).

## Legal and credits

**“Ashen Spire was built by AI under human direction.”** Anthropic Claude and
OpenAI ChatGPT/Codex created the original game work under the owner's direction.
The [full AI acknowledgement](src/content/aiDisclosure.js) describes code,
writing, generated art and synthesized music. No AI model runs while you play.

**Not AI-made by this project:** bundled fonts are third-party work under
[SIL OFL 1.1](asset-data/fonts/OFL.txt); system emoji come from your OS/browser;
Electron and its dependencies have their own licences. The project's
[MIT code licence](LICENSE) does not replace those licences.

**Rights review remains open:** [CREDITS.md](CREDITS.md#ai-authorship-and-third-party-exceptions)
identifies unrecorded flask/landmark sources and incomplete sprite/map rights.
AI authorship is not a guarantee that every asset's provenance or licence is cleared.
No FromSoftware assets or affiliation are claimed.
