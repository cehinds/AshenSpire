# Card-design base handoff

**Scope: approved.** The user confirmed that both gameplay mechanics and visuals from `Feature/updateCharacterCreation` should become the base. This handoff inventories the source and proposes implementation defaults; it does not itself promote proposals into runtime content.

## Source and contents

- Origin branch: `Feature/updateCharacterCreation`.
- Design commits are on `worker/updateCharacterCreation/card-tag-design`.
- Current design-catalog commit: `fbee6162589ec2374664c19c4c78ee2795691d7e` (“Restore the game title fade in card previews”).
- Catalog introduction: `67aa99e5f9647a30f054ea818bb928c43e1513aa` (“Add read-only card and tag design catalog”).
- Preview publisher: `cecc2eff89986940858f0528d7d9aaf22ee54d55` (“Package card proposal preview for sandboxed Pages hosting”).
- Captured live-game source commit: `f7a24e0e39dd7823c15f89afd6023782526655d0`.
- Catalog files: `docs/design/card-tag-design/current-game.json`, `proposed-design.json`, and `all-cards-and-tags.json`.

The catalog keeps the **304-card live snapshot** in `currentGame` separate from **74 proposal entries**: 67 combat cards, 3 status-card entries, 2 services, and 2 rule templates. All proposal entries are marked `state: proposed` and `balanceUndecided: true`. Their SP/MP costs, rank, school, and stance are unassigned. Candidate IDs use the `proposed:card:*` namespace and are not production IDs. Most proposal display names are AI working labels; the catalog marks only Ward Armor, Grease, and Smite as user-explicit names. Paralysis and Restrained are user-request terms. Do not treat the 304-card snapshot as a replacement source for live cards.

The machine-readable [integration inventory](CARD-BASE-INTEGRATION-INVENTORY.json) preserves the full source descriptions for all 67 combat-card proposals and 3 supporting status-card entries, lists current effect opcodes/status IDs, and classifies each proposal by implementation workstream and semantic gap. The remaining four entries are preserved as service/rule-template proposals. It groups work into six content areas plus a shared presentation lane; implementation can be split into staged waves by dependency, starting with mappings expressible using current operations and ending with action-economy and targeting model extensions.

## What can be reused

The branch contains no changes to runtime card definitions or the game renderer. Its standalone in-game-look gallery imports existing `illustratedCardHtml`, `illustratedArtwork`, and `fitIllustratedCards` helpers and current styles, and adds reusable gallery presentation settings: `CARD_ART_SIMPLE` for simple art, plus `configureEffectBox` to narrow and center the effect-text area. The preview README documents the 360×540 design box changing from x30/y370/w300/h110 to x57/y383/w246/h84, with a three-line fit budget, 22–31 design-unit font bounds, and a 22-unit floor. `configurePreviewPresentation` also restores the existing dark `.card-title-fade` layer. These are gallery-level settings that could inform a later presentation change; they do not change the game renderer or production card styles. The gallery, audit, and captures remain useful as a visual review harness.

The standalone preview provides reusable presentation settings, but they remain gallery-level code until integrated into the game renderer: `CARD_ART_SIMPLE` mode and a narrowed, centered effect-text box with a three-line fit budget, 22–31 design-unit font bounds and a 22-unit floor. Preserve canonical references as art/visual references only; the preview README explicitly says they do not assign mechanics to proposals.

## Compatibility and unresolved mechanics

The three explicitly named card proposals are:

- `proposed:card:persistent-protection` — **Ward Armor** grants Persistent Block 4 and Persistent Barrier 4, replenished at the owner's turn start and consumed by matching damage. The damage threshold, physical/magical groups, and Barrier-to-Ward mapping are unresolved. Persistent Block/Barrier are not live statuses.
- `proposed:card:greased` — **Grease** applies Greased 3; adds prone chance and melee/reach accuracy penalty; a fire hit is unavoidable, deals 3× fire damage, applies Burn 3, and splashes 1.5× damage. Greased and this compound hit/splash behavior are not implemented; the splash basis is unresolved. Live `prone` and `burn` do not implement Greased.
- `proposed:card:divine-strike` — **Smite** deals weapon damage plus Divine damage, but both contributions are unquantified. Sacred damage exists and `divine` aliases to it, but the card effect model has no dynamic weapon-damage amount. `attack.weaponDamage` selects damage typing/components; it does not supply the proposed weapon-scaled effect.

Other proposal families also need rule work before they can become playable cards. The proposal's Poison is explicitly not the live Venom status; its lethal Blight differs from Crimson/Necrotic Blight; proposed Weak may require migration. Charm, Bind, Restrained, Foresight, Mirrors, Greased, Persistent Block, and Persistent Barrier are not live statuses. Live `evade`, `prone`, `burn`, `staggered`, and `paralysis` names do not implement every proposed behavior. In particular, generated Paralysis, Stagger, and Restrained cards entering an opponent's deck or hand have no matching lifecycle. A matching status name is not sufficient compatibility evidence.

## Safe integration boundary

No proposal is yet a complete, costed runtime card. The requested direction is approved, while the individual authoring defaults and exact values still need to be applied. Use the inventory's recommendations as a starting point: every spell and weapon art has at least 1 base MP; compare weapon-art damage to the current Smash baseline before assigning its cost; choose the smallest concrete values that preserve each stated effect and fit current core power. An existing operation or same-named status is only a building block—match triggers, targets, magnitude, turn timing, decay, removal, and lifecycle before treating behavior as implemented. Keep the canonical 304-card snapshot separate from runtime pack data.
