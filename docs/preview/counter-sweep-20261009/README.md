# Selected counter and sweep clips

Four default characters use the eight choices recorded in the owner selection file. Reaver uses counter 03 and sweep 01; Starseer uses counter 01 and sweep 01; Herald uses counter 01 and sweep 03; Rogue uses counter 03 and sweep 05.

Each action plays stance, contact, recovery and the existing ready frame in 55/60/65/80 ms. The stage scales this through the existing animation pace. Steel slashes, arcane staff trails, gold palm impacts and paired dagger trails use separate transparent layers at contact and recovery. Idle, interruption, reduced motion and reduced flashes clear those layers. The body silhouette alone continues to drive auras, damage flashes and HUD geometry.

Confirmed counter and physical sweep cards select their new held player stance; the next turn resets that selection through the existing ledger. Defeat still takes priority. Enemy intent projection is unchanged. Solo, co-op and deck previews share the same stage and sequence data. The original idle, attack, defend and casting image files and catalogs remain unchanged.

The art repository retains PNG sources, exact generation prompts, SVG effects, four portable Sprite Workshop projects, the selection JSON and the labeled Play/Pause/Step/Reset preview in `art/player-counter-sweep-2026-10-09/`. The asset release is pinned by `art-release.json`; `src/content/playerCounterSweepSprites.js` records the high-export hashes and shared 512px registration for 256px raster exports.

## Verification

`validation.json` records eight runtime-stage browser checks with no page or asset errors. `contact.png` and `stances.png` capture actual game stage rendering; `phone.png` records the same stage at a 390px viewport. These are a controlled runtime-component harness, not evidence of a full playthrough or physical-phone acceptance. Unit tests cover all eight selections, pacing, original-ready return, effect cleanup, interruption, reduced settings, card-preview routing and independent co-op stance state.
