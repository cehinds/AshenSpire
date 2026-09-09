# Card effect art refresh

First batch: `slash`, `shieldBash`, `starbolt`, `bloodSlash`, six authored frames each.

Effects use 72% base opacity for these four refreshed sets. Weapon trails now attach to the casting combatant, with a rear plane beneath its silhouette and a feathered front plane across the weapon. Shield bashes attach to the shield. Projectile cast effects and release origins use the hand or staff. Confirmed hit impacts remain on recipients; blood debuffs are still target-local. Existing aura treatment is unchanged.

`src/content/combatEffectAnchors.js` owns the 640px-canvas attachment points for all 16 painted outfits and their attack / shield-bash poses, plus plane masks and sizes. `src/ui/combatantEffectLayers.js` follows the current pose inside its canvas, inheriting facing, lunge and zoom. Solo and co-op share this renderer. Unknown art retains the prior effect placement instead of assuming a weapon position. Authored Studio sequences retain their explicit clip positions.

Settings → Game → **Show played card animation** is saved and OFF by default, including existing saves without the setting. Enabling it adds the optional card flight; character effects play independently. `cardEffectLayers.js` supplies the optional card-flight planes only.

Run `node pose-studio/server.mjs`, then open `/art/card-effect-refresh-2026-09-09/index.html`. The gallery shows six effect frames synchronized with the matching character poses, outfit selection, both facings, independent front/rear visibility, opacity, effect size and attachment markers. Card reference is off by default. All geometry is previewed with the same renderer as combat. `tools/card-effect-layers-check.mjs` validates attachments, actual activations, default-off/opt-in behavior, cleanup, reduced motion and narrow layouts.

The selected raw plates and exact built-in imagegen prompts are in `sources.json`.
Initial transparency requests produced painted checkerboards and were rejected. The selected plates use green matte instead; no green is authored into these four effect palettes. The exporter extracts that matte, removes edge spill, uses fixed 3-by-2 cells and one shared scale, and exports 256px lossless RGBA WebP. Blood's matte extraction preserves its red palette without yellow fringes. Frames are not individually resized to their bounds, preserving anticipation and dissipation.

Rebuild with `node tools/card-effect-art-build.mjs` (requires Sharp, also found in `build/animation-tools/node_modules`). The full `tools/combat-effects-ship.mjs` exporter applies this refresh last, so a full rebuild retains it. `export-audit.json` records nonempty silhouettes, transparent margins and absence of green spill for every frame. Original frames remain under `before/` for comparison and rollback; runtime paths stay stable.

This is artwork only: low-resource fallback, retained guards, powers, mana/stamina tiers, status reactions and outlines remain owned by the existing combat rules. The card list in the gallery resolves the live registry at the printed card costs; discounts and actual payment receipts can still select a different variant in combat.
