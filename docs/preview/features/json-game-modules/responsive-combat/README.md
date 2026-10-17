# Responsive combat preview

Native standalone builds, captured at phone 390×844, tablet 820×1180, tablet landscape 1024×768, and desktop 1440×900. Screenshots use real game rendering and interactions; no substituted HUD or sprite overlays.

Core source `872af5122`, local build `0.7.1.1539`, runtime `1521a2232a`. Current source `4baaf15da`, local build `0.7.1.1535`, runtime `c6e0293fd9`. Local capture date: 2026-10-17. CI build ordinals may differ from local build counters.

## Preview builds

- [Core standalone preview](https://github.com/cehinds/AshenSpire/actions/runs/38989926062/artifacts/12084523482) — successful CI for `872af5122`.
- [Current standalone preview](https://github.com/cehinds/AshenSpire/actions/runs/38989927501/artifacts/12084274056) — successful CI for `4baaf15da`.

Download and extract the ZIP, then open `AshenSpire.html`. Each build adapts to phone, tablet, and desktop. Pages publication is not verified.

![Core and Current overview](overview.png)

## Implemented behavior

- Device-specific sizing preserves shared positioning relationships: inline header HP, relics underneath, Cinders below shield/menu, and centered upper Turn.
- Sprites fit their grid cells; mini HP follows cell width with 2px inset. Ground follows back-row shadows and extends behind the hand.
- Cards fan with the center highest, overlap with hand size, and stay above the other layers. Footer backing fades upward; Grid, Combat Log, and Reaction remain accessible.
- Selected detail HUD keeps its original style, sits beside the combatant, and shares its selection color. The grouped info button sits outside its left edge. Intent remains over the sprite; unselected intent sits 5px above HP.
- Card matchup colors apply to eligible targets. Multiple actions share a centered intent row, with perceived damage above each action.
- Info click, HUD double-click/double-tap, and a 500ms hold open native inspection. HP, Poise, intent, status, and inspect-card components retain individual tooltips.
- Status symbols use centered glyphs with small counts fixed at the lower right. Card style symbols and labels use the approved colors and trim.
- Paint order: cards; info/intent/damage/floaters; UI; sprite effects; combatants; grid; ground; props; sky.

## Screenshot collection

### Core

| Device | Unselected | Player selected |
|---|---|---|
| Phone | ![core Phone](core/mobile.png) | ![core Phone selected](core/mobile-selected.png) |
| Tablet portrait | ![core Tablet portrait](core/tablet.png) | ![core Tablet portrait selected](core/tablet-selected.png) |
| Tablet landscape | ![core Tablet landscape](core/tablet-landscape.png) | ![core Tablet landscape selected](core/tablet-landscape-selected.png) |
| Desktop | ![core Desktop](core/desktop.png) | ![core Desktop selected](core/desktop-selected.png) |

### Current

| Device | Unselected | Player selected |
|---|---|---|
| Phone | ![current Phone](current/mobile.png) | ![current Phone selected](current/mobile-selected.png) |
| Tablet portrait | ![current Tablet portrait](current/tablet.png) | ![current Tablet portrait selected](current/tablet-selected.png) |
| Tablet landscape | ![current Tablet landscape](current/tablet-landscape.png) | ![current Tablet landscape selected](current/tablet-landscape-selected.png) |
| Desktop | ![current Desktop](current/desktop.png) | ![current Desktop selected](current/desktop-selected.png) |

## Interaction examples

The following captures are from the immediately preceding UI builds (`6313e6448` Core / `2d1fed43c` Current); the only subsequent change raised tablet shield/menu and Cinders by 10px. They document unchanged interaction behavior.

| Profile | Eligible targets | Native inspection | Card component tooltip |
|---|---|---|---|
| Core phone | ![Core targets](core/mobile-attack-eligible.png) | ![Core inspector](core/mobile-native-inspector.png) | ![Core tooltip](core/mobile-card-component-tooltip.png) |
| Current phone | ![Current targets](current/mobile-attack-eligible.png) | ![Current inspector](current/mobile-native-inspector.png) | ![Current tooltip](current/mobile-card-component-tooltip.png) |

## Verification

- 105 profile/save-migration tests passed for each profile; 39 focused formation, floor, fan, readout, and HUD tests passed.
- Nine native interaction checks passed at all four viewport sizes for both profiles (72 checks): info, double-click, hold, movement cancellation, double-tap, HP and Poise tooltips, eligible targets, and card inspection with actual title hover. Four inspect-card tooltip targets were attached.
- No browser page errors or document overflow in the final eight viewport/profile captures.
- Measured sprite envelopes stay inside lanes by at least 6px; mini HP inset is 2px within subpixel rounding. Three eligible phone panels no longer overlap.
- Broad fast suite remains red on failures reproduced at starting revision `c9f6b4628`: armament fixture, Litany expectation, existing pixel-write/status/export/copy audits, attack-source audit, and a Starseer discard simulation. Introduced pixel-write findings were fixed; six pre-existing findings remain. This preview is not a claim that the full repository gate passes.

Existing low-resolution embedded battlefield artwork remains visibly soft; this work changes placement and layering, not asset resolution.
