# Equipment animation reference component

Equipped hands select art by **class + armour + right weapon group + left weapon group**, optionally constrained by the derived grip mode. This is presentation data; it changes no damage, card grant, attribute requirement, or save format.

Author `content/config/ui/presentation/equipmentAnimations.json`, then run `node tools/config-build.mjs`. Do not edit the generated config module. The resolver is `src/model/equipmentAnimation.js`.

## Component structure

- `weaponGroups`: explicit catalog item IDs grouped by motion family. Catalog IDs, not artwork aliases, select the group. For example Shortbow uses a dagger art alias but belongs to `bow`.
- `bindings`: ordered right/left groups, class and armour select a `setId`. `empty` is a real hand state. An optional `grip` is one of `one`, `two`, `dual`; a specific grip wins over the same generic pairing. Reversing hands is a separate binding.
- `sets`: reusable presentation components containing `frames`, `clips`, `references`, and `poseRoles`.
- `frames`: reusable WebP file references and bounds on the painted renderer's virtual 640-pixel canvas, with floor at 600. The approved source images are 512px with floor at 480 and scale proportionally.
- `clips`: ordered frame IDs, a per-frame duration and a zero-based impact index. Repeating a frame is allowed and meaningful.
- `references`: semantic slots pointing to clips. A slot can be `null` to delegate to existing class presentation.
- `poseRoles`: adapts existing engine presentation names such as `hit`, `power`, `gorefire`, and `bulwark` to semantic reference slots.

Reference slots: idle, attack, defend, buff, hurt, cast, stanceActivate, stanceDeactivate, aggressiveStance, defensiveStance, conversation, portrait, menu, detail, dodge, victory, defeat, revive. The last four are extension slots where this initial set has no new art; existing presentation remains in charge. A reference does not invent a gameplay event or add a new event dispatcher.

## Initial binding

Reaver, default armour, greatsword right / empty left selects `reaverGreatsword`. Its approved attack is:

`STANCE-READY → ATK-07 → ATK-04 → ATK-02 → ATK-03 → ATK-05 → ATK-01 → ATK-04 → STANCE-READY`

Normal timing is 100ms per step (900ms total), impact at ATK-05 (500ms). Combat speed scales both frame and impact timing. Defend, hurt, casting, self buff, aggressive/defensive rest states, stance entry/exit, conversation, equipment view and portrait have separate references. The ready and portrait files are reused intentionally for conversation/menu and detail.

The component is derived from the authoritative loadout each render. Equipping a shield, changing weapon group, swapping hands, or changing armour invalidates the applicable selection. No match delegates to the existing class artwork; unknown item IDs never silently count as an empty hand. The combat art cache includes the resolved set and grip so mid-fight equipment changes rebuild the correct figure.

Animated style plays the selected clips. Rendered style uses the selected still image, and classic/sigil retain their existing presentation. Reduced motion and lightweight rendering retain their existing motion suppression.

## Runtime and review boundaries

Only the approved Reaver set is activated by this change. The four-class review pack at `art/webp-pack-2026-09-19/` remains available for labeled pose feedback. Its other combinations are not implicitly approved or activated. Starseer ATK-02/ATK-03 have a separate known anatomy/staff-occlusion review.

Unit checks: `node tests/equipment-animation.test.mjs` (also in `tests/run-node.mjs`). Browser checks: serve the repository, set `ART_TEST_URL` if needed, then run `node tools/equipment-animation-browser.mjs` with Playwright available (or `PLAYWRIGHT_MODULE` pointing to an installed module) and `CHROME` if the browser is not detected.
