# Battlefield — packaged game verification

The approved original header/footer composition now uses four fixed perspective bands: enemy back (A), enemy front (B), extra combatants (C), and player (D). Core leaves C empty without collapsing its space. Current enables enemy occupancy there; version 1 does not enable player placement in C. The player starts in the leftmost player cell.

The player artwork and combatant mini HUDs are approximately 50% larger than the approved visual preview. The player HUD sits above the character. Default enemy artwork retains its previous size; crowded or narrow layouts fit within the available space. Floor shadows follow visible artwork width, independently of HUD width. Combat Log and Reaction controls remain fixed when the hand size changes. The ground and skyline preserve their aspect ratio, and the hand/footer use a continuous background.

## Captured artifact

- Source: `3e980a5247b0d208a3a6191f59f642121bd53acb`
- Build: `0.7.1.1534`
- Runtime digest: `c313774932`
- Standalone SHA-256: `0625bd8a7bf70e1d9362ca93bae5be481c180d549e5843e61467c31f43bd83e9`
- Both profiles below run in this same packaged HTML using `gameProfile=core` or `gameProfile=current`. The Current-default branch changes only the author JSON and two generated profile files.

Both CI previews succeeded: [Core build](https://github.com/cehinds/AshenSpire/actions/runs/38864935043/artifacts/12030613040), source `3e980a524`, and [Current build](https://github.com/cehinds/AshenSpire/actions/runs/38864981000/artifacts/12030766286), source `6e84e9700`. Latest Pages publication remains unverified. The [browser result and measured bounds](summary.json) record the passing packaged-game checks.

| Desktop | Widescreen | Tablet | Phone |
| --- | --- | --- | --- |
| [1440 × 900](1440-combat.png) | [1920 × 1080](1920-combat.png) | [1024 × 768](1024-combat.png) | [390 × 844](390-combat.png) |

Crowded encounter fixtures use seven real enemies through normal combat initialization: [Core: C stays empty](core-seven-1440.png), [Current: C is occupied](current-seven-1440.png), and [Current on a phone](current-seven-390.png). These fixtures are interaction checks, not new campaign encounters.

## Reproduce

After building the standalone, run `tests/battlefield-layout.browser.mjs` with Playwright and Chromium available. Set `BASE_URL` to your local server, `BATTLEFIELD_ENTRY=AshenSpire.html`, and optionally `PLAYWRIGHT_MODULE`, `CHROME`, and `BATTLEFIELD_OUT`. The test uses actual input and normal shot initialization; it never freezes the DOM or mutates combat state.

The checks cover four viewport sizes with three- and five-card hands, the requested independent scale ratios, unchanged ordinary enemy size, the player HUD above the artwork, reachable cards/footer, fixed Log/Reaction controls, Core/Current occupancy, and desktop/phone Inspect and Strike targeting of the extra-row enemy. The authored Reaver fixture has a five-card hand maximum; oversized invalid poses are not used as evidence.

See the [formation module guide](../../../../../engine/modules/formation/guide.md) for the occupancy flag and the [implementation notes](../../../../design/battlefield-options-2026-10-16/IMPLEMENTATION.md) for layout configuration. This gallery verifies the listed UI and targeting paths; it does not claim a complete three-act playthrough.
