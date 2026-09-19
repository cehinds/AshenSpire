# Playable legacy dungeons

The dungeon integration is merged into local `dev`. `AshenSpire-LegacyPreview.html`
at the repository root is a compiled external-art preview (0.7.1.241), using
the repository's `assets/` folder. It is separate from the normal build aliases
so concurrent settings/build work remains intact.

Map revision: the shared game HUD, Potions, orientation strip, map frame,
location tray and Back/Enter controls now surround the authored map. Circular
markers keep equal width/height at desktop, mobile and zoomed sizes. Entrances
are on the road in front of each gate, with their connecting roads preserved.
Fog is darker and textured like smoke; brown haze is confined to the roads.
The standard standalone build aliases were also refreshed for this revision.

Revised checks: all three desktop maps and the 390 × 844 mobile map passed
circle geometry, zoom, visible Enter control, selection without immediate
travel, Back/Enter, dialogue and saved travel checks, with zero page errors.
Dungeon, map selection/tray and shared HUD tests passed. All six packaging
checks passed. Screenshots are in `runtime-screenshots/` beside this document.

Open through the local game server:

- `/AshenSpire-LegacyPreview.html?shot=map&shotDungeon=BS` — Briar Sanctum
- `/AshenSpire-LegacyPreview.html?shot=map&shotDungeon=HM` — Hall of Mirrors
- `/AshenSpire-LegacyPreview.html?shot=map&shotDungeon=FC` — Furnace Chapel
- `/AshenSpire-LegacyPreview.html` — normal game, with persistent saves

The `shot` links use temporary memory saves and start a fresh preview on reload.
They use real combat, dialogue, rewards and dungeon progression, not the earlier
simulator. In normal single-player play, the matching boss entrance opens its
dungeon in the Climb or, where that boss is authored, World Journey. Separate
co-op session orchestration is outside this integration.

Each dungeon has 24 locations, two entrance roads, connected cross routes,
unique lore and four paired scene paintings, including a dedicated boss arena.
The floor is drawn first, the background above it, and actors/interface above
both. Escape uses 40 + 3 × (Dexterity − 10), clamped to 10–85 percent. Failed
escape starts combat; successful escape retreats without resolving the node.
Decisions, escape rolls, combat checkpoints and reward claims persist in normal
saves. Boss victory clears the fog and enables leaving to resume progression.

Validation completed on 2026-09-19:

- `node tests/legacy-dungeon.mjs`: all three graphs, encounter references,
  24 layer assets, save round trips, escape boundaries, one-time rewards,
  revisit protection and boss clears passed.
- `node tests/run-node.mjs`: full regression runner exited 0.
- `node tools/launch.mjs --build-only`: standalone and external-art builds passed.
- `node tools/verify-shipped.mjs`: all six packaging checks passed.
- Playwright with installed Edge (Browser plugin not available): all three
  entrance-to-boss routes, shared dialogue, combat, rewards, saved cleared
  state and leaving the dungeon passed; zero page errors. The 390 × 844 map
  had no horizontal overflow. Screenshots inspected at desktop and mobile sizes.

Combat transition checks used one-health enemies in memory-only test sessions,
then played real attacks through the UI. This proves victory/reward integration,
not encounter balance. Normal gameplay retains the authored enemy statistics.
The first lightweight preview server failed a module request; validation used
the game's own server and compiled build instead.

Content home: `content/source/legacyDungeons.json`. Its generated module ships
through the standard content builder. Runtime logic is headless in
`src/model/legacyDungeon.js`; the shared W4 dialogue and combat surfaces select
the same scene plates. The component catalog includes the new composition.
