# AshenSpire

<!-- feature-preview:start -->
## Feature preview — JSON-driven game profiles

The same runtime supports two authored configurations. **Product core** includes its required bundled modules and keeps optional gameplay packages off where the core has a fallback. **Current game** preserves the full legacy configuration.

- **Product core:** [Play on Pages (latest publication unverified)](https://cehinds.github.io/AshenSpire/branches/Feature/json-game-modules/latest/) · [standalone build](https://github.com/cehinds/AshenSpire/actions/runs/38953953766/artifacts/12070470683) · [successful build run](https://github.com/cehinds/AshenSpire/actions/runs/38953953766)
- **Current game:** [Play on Pages (latest publication unverified)](https://cehinds.github.io/AshenSpire/branches/Feature/json-game-current-preview/latest/) · [standalone build](https://github.com/cehinds/AshenSpire/actions/runs/38953971025/artifacts/12069821640) · [successful build run](https://github.com/cehinds/AshenSpire/actions/runs/38953971025)

The deck editor’s animation sprite now sits lower so the head clears the preview border, while retaining its size and the description layout. [Fresh headroom screenshots](docs/preview/features/json-game-modules/deck-headroom/README.md).

The battlefield grid now uses thin, translucent lines and a saved **Grid** checkbox directly above Combat Log. Core’s unused middle row stays visible without enabling placement. [Grid screenshots and verification](docs/preview/features/json-game-modules/grid/README.md).

Desktop now uses the approved D layout with a wider fan, larger cards, a lower background, and three fixed footer groups. Cinders are visible, Core Settings follow enabled modules, rewards support reversible review, and Skills/Spells/Powers use Prepare. Core starters retain ten cards with two Defends, one Counter, and Draw. [Latest screenshots and verified builds](docs/preview/features/json-game-modules/desktop-footer/README.md).

The battlefield now preserves four depth bands, including the extra combatant row's space when Core disables occupancy. The player and mini HUDs are larger, the player HUD sits above the character, and Combat Log/Reaction controls stay fixed as the hand changes. [Battlefield screenshots and verification](docs/preview/features/json-game-modules/battlefield/README.md) · [Desktop](docs/preview/features/json-game-modules/battlefield/1440-combat.png) · [Widescreen](docs/preview/features/json-game-modules/battlefield/1920-combat.png) · [Phone](docs/preview/features/json-game-modules/battlefield/390-combat.png).

Desktop Strategize now uses a two-column **Reading Desk**: choosing a card updates a large inspection immediately, with the complete main description below its substantial face, visible without scrolling on desktop. Show animation is an optional checkbox; playback runs at half speed and can be paused. Equivalent owned and unlimited library entries share one count. Cancel and Escape review unsaved changes; Accept saves a valid deck, while a red count explains an invalid size. 

The runtime includes the 70-card base catalog and automatic area Sweeps. Rest uses a compact right sidebar on wide screens and keeps its painted scene in proportion; mobile retains scrolling services and a reachable Continue footer.

| | Desktop · 1440×900 | Wide · 1920×1080 | Tablet · 1024×768 | Mobile · 390×844 |
| --- | --- | --- | --- | --- |
| Strategize | ![Reading Desk desktop](docs/preview/features/json-game-modules/latest-ui/desktop-desk.png) | ![Reading Desk wide](docs/preview/features/json-game-modules/latest-ui/wide-desk.png) | ![Reading Desk tablet](docs/preview/features/json-game-modules/latest-ui/tablet-desk.png) | ![Reading Desk mobile inspection](docs/preview/features/json-game-modules/latest-ui/mobile-inspection.png) |
| Rest | ![Rest desktop sidebar](docs/preview/features/json-game-modules/latest-ui/desktop-rest.png) | ![Rest wide sidebar](docs/preview/features/json-game-modules/latest-ui/wide-rest.png) | ![Rest tablet](docs/preview/features/json-game-modules/latest-ui/tablet-rest.png) | ![Rest mobile](docs/preview/features/json-game-modules/latest-ui/mobile-rest.png) |

Adaptive-fit core source `367654085` and current source `8e548d580` both have successful CI builds. The affected Desk captures now use adaptive-fit source `367654085`, runtime `03196f4b63`; remaining captures use source `3abd51267`, runtime `b284ae955d`, all build `0.7.1.1534`. All six core descriptions passed at zero scroll at 1440×900 and 1366×768. Latest Pages publication remains unverified. [Combined standalone capture provenance and checks](docs/preview/features/json-game-modules/latest-ui/README.md) · [Paused animation preview](docs/preview/features/json-game-modules/latest-ui/desktop-animation-paused.png).

<details>
<summary>Earlier Dark veil, Mana, and Rest-start map evidence</summary>

The next locked class now wears the **Dark veil** treatment: a translucent charcoal veil and a large centered gold padlock, with its unlock note kept visible. Unlocked classes keep their existing presentation. Weapon arts and spells have a base cost of at least 1 MP; the Reaver starts with 1 MP, and Sundering Art displays 36 damage for 2 SP and 1 MP.

| Desktop · 1440×900 | Wide · 1920×1080 | Tablet · 1024×768 | Mobile · 390×844 |
| --- | --- | --- | --- |
| ![Dark veil on desktop](docs/preview/features/json-game-modules/dark-veil/desktop.png) | ![Dark veil wide](docs/preview/features/json-game-modules/dark-veil/wide.png) | ![Dark veil on tablet](docs/preview/features/json-game-modules/dark-veil/tablet.png) | ![Dark veil on mobile](docs/preview/features/json-game-modules/dark-veil/mobile.png) |

Fresh local captures use source `dad857421`, build `0.7.1.1534`, runtime `554f3a5be2`. [Dark veil capture provenance and cosmetic checks](docs/preview/features/json-game-modules/dark-veil/README.md) · [Sundering Art inspection](docs/preview/features/json-game-modules/dark-veil/desktop-sundering-art.png) · [Map after the initial Rest](docs/preview/features/json-game-modules/dark-veil/desktop-map.png).

</details>

<details>
<summary>Earlier Rest restoration and progressive class captures</summary>

Core Rest now uses the original full game's painted Shrine, run HUD, recovery preview, and service cards. Strategize, Smith, and Level Up open their existing review surfaces; cancelling keeps the visit untouched, and one confirmed service refills HP, MP, SP, and both flask pools. Class selection shows unlocked classes and the next class to earn; a fresh run shows Reaver and locked Starseer.

Core source `056668011` and current-profile source `f90fea869` have successful CI builds. Pages publication remains pending. Fresh local captures below use source `bed684518`, build `0.7.1.1534`, runtime `1c863b4f85`. [Rest restoration and browser evidence](docs/preview/features/json-game-modules/rest-ui/README.md).

| Desktop · 1440×900 | Wide · 1920×1080 | Tablet · 1024×768 | Mobile · 390×844 |
| --- | --- | --- | --- |
| ![Core Rest on desktop](docs/preview/features/json-game-modules/rest-ui/desktop-rest.png) | ![Core Rest wide](docs/preview/features/json-game-modules/rest-ui/wide-rest.png) | ![Core Rest on tablet](docs/preview/features/json-game-modules/rest-ui/tablet-rest.png) | ![Core Rest on mobile](docs/preview/features/json-game-modules/rest-ui/mobile-rest.png) |

| Progressive class selection | Reaver review |
| --- | --- |
| ![Reaver and next locked Starseer](docs/preview/features/json-game-modules/rest-ui/desktop-class.png) | ![Reaver starter deck review](docs/preview/features/json-game-modules/rest-ui/desktop-review.png) |

</details>

<details>
<summary>Earlier Settings update and capture provenance</summary>

Game rules and JSON imports now live in **Settings → General → Game rules**. New Game goes directly to character creation. **Settings → General → Display** offers Auto, Desktop (1440×900), Mobile (390×844), Widescreen (1920×1080), and Tablet (1024×768); switching views keeps the active fight and fits the selected layout inside the current window.

For this earlier Settings update, CI source revisions were core `eaa1581b9` and current `74804f13b`; both builds passed at the time of this record. Fresh local Settings captures from source `90c21acf0` (build `0.7.1.1534`) are recorded in [the Settings update evidence](docs/preview/features/json-game-modules/settings-update/README.md). Later changes preserve headless coordinate helpers and refine the capture script; the photographed interface is unchanged.

| Desktop · 1440×900 | Wide · 1920×1080 | Tablet · 1024×768 | Mobile · 390×844 |
| --- | --- | --- | --- |
| ![Desktop Display settings](docs/preview/features/json-game-modules/settings-update/desktop.png) | ![Wide Display settings](docs/preview/features/json-game-modules/settings-update/wide.png) | ![Tablet Display settings](docs/preview/features/json-game-modules/settings-update/tablet.png) | ![Mobile Display settings](docs/preview/features/json-game-modules/settings-update/mobile.png) |

</details>

<details>
<summary>Historical gallery — earlier configured flow before the Settings update</summary>

**Product core — configured flow**

| | Mobile · 390×844 | Desktop · 1440×900 | Wide · 1920×1080 | Tablet · 1024×768 |
| --- | --- | --- | --- | --- |
| Class | ![Core class selection on mobile](docs/preview/features/json-game-modules/final-core/mobile-class.png) | ![Core class selection on desktop](docs/preview/features/json-game-modules/final-core/desktop-class.png) | ![Core class selection wide](docs/preview/features/json-game-modules/final-core/wide-class.png) | ![Core class selection on tablet](docs/preview/features/json-game-modules/final-core/tablet-class.png) |
| Map | ![Core route map on mobile](docs/preview/features/json-game-modules/final-core/mobile-map.png) | ![Core route map on desktop](docs/preview/features/json-game-modules/final-core/desktop-map.png) | ![Core route map wide](docs/preview/features/json-game-modules/final-core/wide-map.png) | ![Core route map on tablet](docs/preview/features/json-game-modules/final-core/tablet-map.png) |
| Shop | ![Core merchant on mobile](docs/preview/features/json-game-modules/final-core/mobile-shop.png) | ![Core merchant on desktop](docs/preview/features/json-game-modules/final-core/desktop-shop.png) | ![Core merchant wide](docs/preview/features/json-game-modules/final-core/wide-shop.png) | ![Core merchant on tablet](docs/preview/features/json-game-modules/final-core/tablet-shop.png) |

The route map fits all four viewports. These local captures used the embedded low-resolution terrain fallback because detail tiles were not available from the local preview server; the map artwork appears soft. At the time of these earlier captures, Pages publication had not been verified. This historical gallery does not establish the status of the current preview links above.

</details>

The previous core/current combat captures remain in the [profile evidence folder](docs/preview/features/json-game-modules/README.md); the current profile’s mobile combat layout remains visually dense.
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

**JSON profile development:** source branches are [`Feature/json-game-modules`](https://github.com/cehinds/AshenSpire/tree/Feature/json-game-modules) and [`Feature/json-game-current-preview`](https://github.com/cehinds/AshenSpire/tree/Feature/json-game-current-preview). Current build and preview status appears in the feature block above. [Implementation notes and limitations](docs/ai/json-game-modules/README.md) · [Historical profile evidence](docs/preview/features/json-game-modules/README.md).

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
