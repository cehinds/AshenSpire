# AshenSpire guides

[Back to play links, build numbers and screenshots](../README.md)

## Play locally or offline

Install Node.js 22, clone the repository, then run:

```sh
node tools/fetch-art.mjs --pack common
node tools/launch.mjs
```

The launcher opens `http://localhost:8080`. No root `npm install` is required.
Use `run.bat` or `./run.sh` as an alternative. LAN co-op needs the launcher.
For offline solo play, open the light-art HTML download, or select
**Download & saves → Make available offline** in the hosted game.

[Distribution](../dist/README.md) · [Windows installation](../desktop/windows/README.md)
· [Build versions](versioning.md) · [Build/check commands](../DEVELOPER.md)

## Rules and roadmap

[Game specification](../SPEC.md) · [Combat/equipment rules](COMBAT-EQUIPMENT-RULES.md)
· [Balance](BALANCE.md) · [Implementation boundaries](SPEC-RECONCILE.md)
· [Release acceptance](FINISH.md) · [Project board](https://github.com/users/cehinds/projects/4)

## Development and design

[Contributing](../CONTRIBUTING.md) · [Delivery workflow](FEATURE-DELIVERY-LOOP.md)
· [QA guide](QA-TESTING.md) · [Architecture map](ARCHITECTURE-MAP.md)
· [Current dev inventory](ARCHITECTURE-CURRENT-DEV.md)

[Component catalog](COMPONENT-CATALOG.md) · [Visual catalog](component-catalog.html)
· [Folding trays](tray-gallery.html) · [Armoury design](ARMOURY-LAYOUT-BRIEF.md)
· [Player polish kit](design/player-polish-asset-kit-2026-10-02/README.md)

## Art and related projects

[Art sources and releases](https://github.com/cehinds/AshenSpire-art)
· [Classic, alternative and shared display art](../assets-display/README.md)
· [Credits and provenance](../CREDITS.md)
· [Alternative Combat Studio](https://github.com/cehinds/AshenSpire/blob/alternative/dev/docs/design/COMBAT-STUDIO-ALTERNATIVE.md)
· [Unity project](https://github.com/cehinds/AshenSpire-Unity)

`art-release.json` pins compatible high, light and common packs. Hosted Test,
Release and Main normally use high art; HTML downloads use light art.
Phone Auto mode chooses light art. Combat Studio drafts remain authoring work
until explicitly integrated into the game.

## Earlier visual QA

These images are historical evidence, rather than current release screenshots:

[Title](preview/title.png) · [Map](preview/map.png) · [Combat](preview/combat.png)
· [Armoury](preview/armoury-simple-equipment-1440.png)
· [Phone cards](preview/armoury-simple-cards-390.png)
· [Title layout](preview/title-menu-wide-1440x900.png)
· [Catalog audit](preview/menu-control-audit.md)
