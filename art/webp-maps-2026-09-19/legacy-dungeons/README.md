# Legacy dungeon interactive preview

Open `index.html` directly in a browser; no build or server is required. The optional local preview is at http://127.0.0.1:8765/art/webp-maps-2026-09-19/legacy-dungeons/index.html while the local server is running.

- **Atlas:** review all 24 nodes in each dungeon. Click any number for its name, stable revision ID and lore.
- **Explore:** begin at the entrance, resolve your current location and select a connected destination. Known paths emerge from region-themed fog.
- **Dialogue:** read observations or listen to speakers; some encounters can be resolved peacefully, challenged, or escaped.
- **Escape:** displayed percentage depends on the editable Dexterity value. Success retreats; failure starts the simulated fight.
- **Boss:** victory marks the dungeon cleared and removes discovery fog. Optional lore remains available.
- **Restart dungeon:** reset only the selected dungeon. Progress is kept in memory across tabs, not persisted after reload.

All original paintings remain unchanged. Nodes, routes and fog are independent code overlays. Desktop layout uses the original 3:2 paintings without cropping. Small screens allow horizontal map scrolling to keep markers usable, with dialogue below.

`LORE-AND-DESIGN.md` is the readable brief plus all 72 node scripts. `dungeons.json` contains stable IDs, normalized coordinates and road bends. `dungeons.js` supports opening the preview directly from disk. `build_data.py` produces both data forms and the narrative document.

## Visual and interaction verification

The built-in browser connection timed out. Playwright with local Edge supplied browser screenshots at a 1536×1024 viewport and a 390×844 mobile viewport. The full-page desktop images include the small footer below the viewport. `check-preview.cjs` verifies all three 24-node maps, peaceful dialogue, connected movement, each boss victory and cleared state, Dexterity math, successful/failed escape, defeat return, mobile document overflow and absence of browser errors.

The generated `ui-concept.png` and rendered atlas screenshots were visually inspected with view_image. Five design comparisons: charcoal/antique-gold palette, serif headings and dialogue, three tabs and active underline, uncropped map beside a lore panel, and location imagery with outlined actions. Preserved that visual direction while intentionally using smaller detail imagery to leave room for longer scripts. Functional additions to the concept are stable node IDs, progress/route captions, reset, draft-rule explanation and explicit combat-simulation labels. Atlas intentionally presents read-only lore; Explore presents travel and outcome controls. These differences support the requested review workflow. The concept's illustrative route numbers were replaced with the validated 24-node graphs.

Road review corrected routes initially crossing water or cliff faces: both mirror bridges follow their decks; the furnace viaduct connects from the upper platform rather than directly across the lava chasm; Briar routes follow its paired river bridges and upper sanctuary approach. These are manually traced conceptual routes, not navmesh or collision geometry.

## Scope

This is a design preview, as requested, not a playable-game integration. Lore is newly proposed. Fights use explicit simulated victory/defeat buttons; rewards and combat balance are deliberately not assigned. Runtime dialogue reuse, persistent dungeon-clear flags, save migration, encounter definitions and final escape balance belong to a later implementation pass. No existing art or game runtime files were replaced.
