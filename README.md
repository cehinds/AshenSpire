# AshenSpire

<!-- feature-preview:start -->
## Feature preview — Review character stat card

[Feature Play route](https://cehinds.github.io/AshenSpire/branches/Feature/updateCharacterCreation/latest/) · [Current build run](https://github.com/cehinds/AshenSpire/actions/runs/38696812396) · [Download backup](https://github.com/cehinds/AshenSpire/actions/runs/38696812396/artifacts/11954500967) · [Four Review screenshots and wireframes](docs/preview/features/update-character-creation/review-character-card/README.md)

**Current build passed; Pages publication is pending.** Public delivery was verified for the prior compact-layout build `652574f013`; the route is not yet verified for the new character stat card revision. Feature previews are sandboxed; progress is not saved. Press **Enter** on the startup screen.

Opened Review now gives the character stat card the same 2:3 shape as the equipment cards (165.5 × 248.25 px on mobile; 180 × 270 px at the other three sizes). Captured **0.7.1.1520 / `a12edfdd78`**, source `6d88c4d641`, 2026-10-14 (America/Anchorage). Review loadout is open in each screenshot.

| Mobile · 390 × 844 | Tablet · 1024 × 768 |
| --- | --- |
| ![Mobile opened Review character stat and equipment cards](docs/preview/features/update-character-creation/review-character-card/review-mobile-390x844.png) | ![Tablet opened Review character stat and equipment cards](docs/preview/features/update-character-creation/review-character-card/review-tablet-1024x768.png) |
| Desktop · 1440 × 900 | Widescreen · 1920 × 1080 |
| ![Desktop opened Review character stat and equipment cards](docs/preview/features/update-character-creation/review-character-card/review-desktop-1440x900.png) | ![Widescreen opened Review character stat and equipment cards](docs/preview/features/update-character-creation/review-character-card/review-wide-1920x1080.png) |

[Prior compact-layout matrix: 36 screenshots and wireframes](docs/preview/features/update-character-creation/README.md) remains evidence for **`652574f013`**, source `f6801043c9`; it is not recaptured or relabeled as the current revision.

**Feature branch only:** remove this section and its feature gallery before merging to `dev`. See [the delivery protocol](CONTRIBUTING.md#feature-branch-previews).
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

**Feature branches:** every `feature/*`, `fix/*` or `chore/*` branch with an open pull request into `dev`, named with ASCII letters, digits, `.`, `_`, `-` and `/` only, has a build at `https://cehinds.github.io/AshenSpire/branches/<branch>/latest/`, which plays in a sandbox and does not keep progress (open ones are listed on [All builds](https://cehinds.github.io/AshenSpire/)); the pull request links it.

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
