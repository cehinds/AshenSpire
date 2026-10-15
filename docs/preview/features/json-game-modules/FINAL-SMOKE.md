# Final packaged smoke evidence

Captured 2026-10-15 with Chromium, Playwright and reduced motion. These are actual normal game flows through the packaged HTML, not `?shot=` fixtures. This supplements the earlier gallery; its other captures retain their original build provenance.

| Capture | Packaged build | Runtime source | Viewport |
| --- | --- | --- | --- |
| [Core Smith after Save / Continue](final-core-smith.png) | 0.7.1.1539, runtime digest `f6930be11b` | `ec08a6ca9` | 1280 × 720 |
| [Current default combat](final-current-combat.png) | 0.7.1.1535, runtime digest `e83c1c0ad6` | `a330ee248` | 1440 × 900 |

Full SHA-256 of the served packaged HTML at verification:

- Core: `29529ab0edccb34d5f2221e7e5fb8cb9493f45b84958f31a9368aac8d023bd0c` (80,345,697 bytes).
- Current: `ea1cbb5e1a11868f69e1f2d6019265dd210ad17f2ad69b2f367698263f47fd8b` (80,345,700 bytes).

## Core: passed

Opened the packaged game with `gameProfile=core`, entered New Game, selected Reaver and seed `3`, played the first fight through the card/target UI to victory in three turns, chose a mixed reward, travelled to the first rest and committed Smith. The free upgrade quote was visible. Then used Save Game, Save and Quit, Continue and reopened the same rest.

The durable save retained profile `core`, Greatsword upgrade tier 1, the consumed `smith` service for visit `1:n2_0`, HP 71/71, MP 2/2 and SP 3/3. The reopened rest still reported the visit complete and disabled the three service buttons. No browser page errors occurred.

## Current default: passed

Opened the separately compiled current-default packaged game without any profile query or injected preview flag. The New Game selector initially showed `current`. Completed the original creation flow, chose Rank 1 Crimson Cleave, used seed `3`, skipped the opening and chose the initial Iron Footing class-tree node. Reached the normal map and entered the first fight through its map controls.

The fight retained the current game's typed damage, legacy rating/stance details, reaction system and original starter cards: Gorefire Slash, Brace, Dodge Roll and Crimson Cleave. Dismissed the first-use tutorial before the combat capture. No browser page errors occurred.

Visual review found the controls and card faces readable in these captured states, with no blocking overlay or clipped action control. The current game's existing backdrop treatment remains visible; this smoke is functional verification, not a visual redesign.
