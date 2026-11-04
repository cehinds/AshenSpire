# Release candidate 0.7.1.1060 screenshots

Real browser captures of the latest published Release-channel build at capture
time. This remains a development release candidate; these images do not certify
the release acceptance gates.

- Channel and version: `release`, `0.7.1.1060`.
- Source commit: [`0de2379c95a2eea974b8dbd75d830d3eb03e6583`](https://github.com/cehinds/AshenSpire/commit/0de2379c95a2eea974b8dbd75d830d3eb03e6583).
- Published build: <https://cehinds.github.io/AshenSpire/release/1060/>.
- Successful publication: [preview run 37691228624](https://github.com/cehinds/AshenSpire/actions/runs/37691228624).
- Captured: 2026-10-08 UTC, headless Microsoft Edge on Windows.
- Desktop: 1440 × 1000, device scale 1; phone viewport: 390 × 844, device scale 1.
- [Manifest](manifest.json): individual URLs, viewports, page evidence, and image SHA-256 hashes.

## Capture states

| Image | Published game state | Aspect illustrated |
| --- | --- | --- |
| `creation.png` | `?shot=customize` | Classes and starting character choices |
| `map.png` | `?shot=map&shotWalk=5` | Exploration with a posed five-step route |
| `combat.png` | `?shot=combat` | Enemy intentions and weapon/class cards |
| `shop.png` | `?shot=shop` | Merchant relics and service categories |
| `combat-phone.png` | `?shot=combat` at 390 × 844 | Phone combat layout |

The published game's existing `shot` states pose reproducible screens in an
ephemeral screenshot save. The route pose and merchant inventory are showcase
states, not evidence that a run was played to that point. No game source, art,
or UI was changed for these captures.

## Refreshing the gallery

1. Check the Release history for its latest published full version and commit.
   Pin the numeric build URL rather than photographing the moving `latest` alias.
2. Open that published build with the states above in a clean browser profile,
   at the recorded viewport sizes. Wait for the requested screen, loaded and
   decoded visible images, and painted combatants before taking each screenshot.
3. Inspect the actual PNGs. Store the new set under its own full-version folder,
   record provenance and hashes, and change the root README's captions and paths.
4. Verify the root README renders the images and that Release history still
   identifies the selected build. Follow CONTRIBUTING.md's README screenshot rule.
