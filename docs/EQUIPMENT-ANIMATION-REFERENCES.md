# Equipment animation reference component

Equipped hands select art by **class + armour + right weapon group + left weapon group**, optionally constrained by the derived grip mode. This is presentation data; it changes no damage, card grant, attribute requirement, or save format.

Author `content/config/ui/presentation/equipmentAnimations.json`, then run `node tools/config-build.mjs`. Do not edit the generated config module. The resolver is `src/model/equipmentAnimation.js`.

## Component structure

- `weaponGroups`: explicit catalog item IDs grouped by motion family. Catalog IDs, not artwork aliases, select the group. For example Shortbow uses a dagger art alias but belongs to `bow`.
- `bindings`: ordered right/left groups, class and armour select a `setId`. `empty` is a real hand state. An optional `grip` is one of `one`, `two`, `dual`; a specific grip wins over the same generic pairing. Reversing hands is a separate binding.
- `motionProfiles`: shared weapon motion containing timing, clips, references and pose roles. All greatsword outfits use `greatswordTwoHand`; changing it updates every class.
- `sets`: outfit-specific frames with a `motionProfile` reference, or self-contained frames/clips/references/poseRoles. Explicit set fields override the profile. Optional `authoredEquipment` records the painted right/left groups when ordered equipment selectors share one canonical depiction; it does not change equipment mechanics.
- `supportedHandItems`: optional profile/set constraints with nonempty `right` and `left` arrays of known item IDs. A group match outside those authored hand items falls back instead of drawing incompatible weapon shapes.
- `frames`: reusable WebP file references and bounds on the painted renderer's virtual 640-pixel canvas, with floor at 600. The approved source images are 512px with floor at 480 and scale proportionally.
- `clips`: ordered frame IDs, a per-frame duration and a zero-based impact index. Repeating a frame is allowed and meaningful.
- `references`: semantic slots pointing to clips. A slot can be `null` to delegate to existing class presentation.
- `poseRoles`: adapts existing engine presentation names such as `hit`, `power`, `gorefire`, and `bulwark` to semantic reference slots.

Reference slots: idle, attack, defend, buff, hurt, cast, stanceActivate, stanceDeactivate, aggressiveStance, defensiveStance, conversation, portrait, menu, detail, dodge, victory, defeat, revive. The last four are extension slots where this initial set has no new art; existing presentation remains in charge. A reference does not invent a gameplay event or add a new event dispatcher.

## Single-dagger bindings

All four classes and 35 catalog armor entries select `daggerSingle` only for
right group `dagger`, left group `empty`, grip `one`. Both Dagger and Parrying
Dagger belong to this existing animation group. Reversed hands, dual daggers,
mixed off-hand groups and the Shortbow's old dagger art alias do not select it.
The 32 skins share Ready → ATK01–ATK07 → Ready at 100ms per step, with impact
at ATK05 (500ms). Conversation has its own full-body pose; portrait is separate.
Every character pose is free of baked aura/particles. No equipment rules change.

The [single-dagger gallery](../art/dagger-outfits-2026-09-19/index.html) filters
by class, switches skins without changing the current pose, compares outfits
in sync, and lets a reviewer reorder frames and copy proposed timing JSON.
PNG sources and WebP export/anchor validation remain in that art directory.

## Greatsword bindings

All four classes and all 35 catalog armor entries select their own greatsword appearance when one hand holds the greatsword group and the other is empty. Either ordered hand combination is supported. The 32 distinct appearances share one motion profile; the three catalog art aliases reuse their matching outfit frames. The default Reaver retains set ID `reaverGreatsword`. The shared approved attack is:

`STANCE-READY → ATK-07 → ATK-04 → ATK-02 → ATK-03 → ATK-05 → ATK-01 → ATK-04 → STANCE-READY`

Normal timing is 100ms per step (900ms total), impact at ATK-05 (500ms). Combat speed scales both frame and impact timing. Defend, hurt, casting, self buff, aggressive/defensive rest states, stance entry/exit, conversation, equipment view and portrait have separate references. The ready and portrait files are reused intentionally for conversation/menu and detail.

The component is derived from the authoritative loadout each render. Equipping a shield, changing weapon group, swapping hands, or changing armour recomputes the applicable selection. No match delegates to the existing class artwork; unknown item IDs never silently count as an empty hand. The combat art cache includes the resolved set and grip so mid-fight equipment changes rebuild the correct figure.

Animated style plays the selected clips. Rendered style uses the selected still image, and classic/sigil retain their existing presentation. Reduced motion and lightweight rendering retain their existing motion suppression.

## Sword and shield bindings

The separate `swordShield` profile uses `STANCE-READY → DEFEND → ATK-07 → BUFF-NO-AURA → ATK-02 → ATK-03 → ATK-04 → ATK-05 → ATK-05 → STANCE-DEFENSIVE → STANCE-READY`, with 100ms frames and impact at 700ms. All attack frames are aura-free; the separate Buff action retains its effect. Its own frames preserve each of the 32 appearances across 35 armor entries. Both ordered sword/shield combinations select it. Paintings depict a right-hand sword and left-hand shield; reverse equipment intentionally shares that canonical artwork, without a mirror or a claim of separately painted swapped hands. Each set records this in `authoredEquipment`.

Shield defense, hurt, cast, buff, ready/aggressive/defensive stances, conversation and portrait have references. The gallery and exporter live at `art/sword-shield-outfits-2026-09-19/`; `attack-sequence.json` supplies the attack order, frame duration and impact index when exporting. Other weapon families and non-attack sword/shield references are preserved. Greatsword order and timing remain independent.

## Twin-sword bindings

The `twinSword` profile covers all 35 armor entries with 32 appearances. It selects the existing `sword`/`sword` groups with `dual` grip and constrains the authored hands to right `straightSword` / left `katana`. The legal reverse assignment keeps existing presentation. No item requirements or dual-wield mechanics change.

All appearances share `STANCE-READY → ATK-01 → ATK-02 → ATK-03 → ATK-04 → ATK-05 → ATK-06 → ATK-07 → STANCE-READY`, 120ms steps, impact at 480ms. Sixteen poses include separate conversation and portrait art; all full-body poses retain two swords without baked effects. Change the profile to update every outfit. The [workshop](../art/twin-sword-reference-2026-09-19/index.html) edits sequence candidates and compares class/armor appearances.

Validation: `node tests/twin-sword-animation.test.mjs`, `node tools/twin-sword-animation-browser.mjs`, and the pack's `validate.py` and `test_extraction.py`. Screenshots and browser results live in the pack's `qa/` directory.

## Unarmed bindings

Both hands empty selects the shared `unarmed` profile across all 35 armor entries and 32 appearances. The physical attack uses Ready, ATK-01 through ATK-07, then Ready, at 140ms per frame (1260ms total). Its primary impact is ATK-05 at 700ms. All skins share this choreography, with one scale per body suite and the same foot anchor. Normal gauntlets remain part of armor; weapons, labels and baked effects are absent.

The physical fragment owns idle, attack, defense, hurt, stances and noncombat views. Cast and buff initially use its empty-hand stills. A separate magic fragment can replace only cast/buff and append `MAGIC-` frames to those same sets. `tools/unarmed-animation-import.mjs` composes either import order, validates live catalog coverage, and preserves unrelated profiles and settings. Spell-tagged attack cards and the explicit `source:spell` origin choose cast when unarmed, including guard-first spell attacks; Ranged plus a spell tag keeps projectile movement while using the casting gesture. Physical attacks retain punches, powers use buff, and explicit action animation overrides retain precedence.

Solo and co-op derive the selected clip before dispatch and use its duration for stage playback. Solo's presentation timeline uses the selected impact time; co-op retains its existing authoritative receipt handling. Combat speed scales clip duration and impact together. This presentation routing changes no engine damage, card behavior, equipment or save data.

Source masters, labeled sheets, editable synchronized preview, provenance and export scripts are in `art/unarmed-reference-2026-09-19/`. Run `node --test tests/unarmed-animation.test.mjs` for importer ownership, routing, timing and complete runtime asset coverage.

## Runtime and review boundaries

The greatsword suites for all class/armor entries are activated. The catalog currently reports the legacy `one` grip for a lone native greatsword; its two-handed visual does not alter that mechanical rule. Both native and prototype two-handed grips select the suite, while an occupied opposite hand does not. New art and synchronized previews are in `art/greatsword-outfits-2026-09-19/`. The four-class review pack at `art/webp-pack-2026-09-19/` remains available for labeled pose feedback. Its other combinations are not implicitly approved or activated. Starseer ATK-02/ATK-03 have a separate known anatomy/staff-occlusion review.

Unit checks: `node tests/equipment-animation.test.mjs` (also in `tests/run-node.mjs`). Browser checks: serve the repository, set `ART_TEST_URL` if needed, then run `node tools/equipment-animation-browser.mjs` with Playwright available (or `PLAYWRIGHT_MODULE` pointing to an installed module) and `CHROME` if the browser is not detected.
