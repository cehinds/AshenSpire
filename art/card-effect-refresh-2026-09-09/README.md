# Card effect art refresh

First batch: `slash`, `shieldBash`, `starbolt`, `bloodSlash`, six authored frames each.
The shared `COMBAT_EFFECT_ART` registry supplies combat, Pose Studio and the galleries.
Card tags, actual-payment selection, sizes, directions, timing, auras and other effects retain their existing behavior.

Run `node pose-studio/server.mjs`, then open `/art/card-effect-refresh-2026-09-09/index.html` for synchronized before/after playback, individual frames, four directions, light/dark backgrounds and the current card assignments. Use the Studio link to compose these effects with poses and aura layers.

The selected raw plates and exact built-in imagegen prompts are in `sources.json`.
Initial transparency requests produced painted checkerboards and were rejected. The selected plates use green matte instead; no green is authored into these four effect palettes. The exporter extracts that matte, removes edge spill, uses fixed 3-by-2 cells and one shared scale, and exports 256px lossless RGBA WebP. Blood's matte extraction preserves its red palette without yellow fringes. Frames are not individually resized to their bounds, preserving anticipation and dissipation.

Rebuild with `node tools/card-effect-art-build.mjs` (requires Sharp, also found in `build/animation-tools/node_modules`). The full `tools/combat-effects-ship.mjs` exporter applies this refresh last, so a full rebuild retains it. `export-audit.json` records nonempty silhouettes, transparent margins and absence of green spill for every frame. Original frames remain under `before/` for comparison and rollback; runtime paths stay stable.

This is artwork only: low-resource fallback, retained guards, powers, mana/stamina tiers, status reactions and outlines remain owned by the existing combat rules. The card list in the gallery resolves the live registry at the printed card costs; discounts and actual payment receipts can still select a different variant in combat.
