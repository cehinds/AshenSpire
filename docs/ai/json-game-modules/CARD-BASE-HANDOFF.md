# Card-design base handoff

**Scope: clarification pending.** The user asked to make the updated cards from `Feature/UpdateCharacterCreation` the base. It is not yet clear whether “base” means gameplay mechanics, card presentation, or both. This handoff records what the source branch contains; it does not promote its proposals into runtime content.

## Source and contents

- Origin branch: `Feature/UpdateCharacterCreation`.
- Current design-catalog commit: `fbee6162589ec2374664c19c4c78ee2795691d7e` (“Restore the game title fade in card previews”).
- Catalog introduction: `67aa99e5f9647a30f054ea818bb928c43e1513aa` (“Add read-only card and tag design catalog”).
- Preview publisher: `cecc2eff89986940858f0528d7d9aaf22ee54d55` (“Package card proposal preview for sandboxed Pages hosting”).
- Captured live-game source commit: `f7a24e0e39dd7823c15f89afd6023782526655d0`.
- Catalog files: `docs/design/card-tag-design/current-game.json`, `proposed-design.json`, and `all-cards-and-tags.json`.

The catalog keeps the **304-card live snapshot** in `currentGame` separate from **74 proposal entries**: 70 combat cards, 2 services, and 2 rule templates. All proposal entries are marked `state: proposed` and `balanceUndecided: true`. Their SP/MP costs, rank, school, and stance are unassigned. Candidate IDs use the `proposed:card:*` namespace and are not production IDs. Most proposal display names are AI working labels; the catalog marks only Ward Armor, Grease, and Smite as user-explicit names. Paralysis and Restrained are user-request terms. Do not treat the 304-card snapshot as a replacement source for live cards.

## What can be reused

The branch contains no changes to runtime card definitions or the game renderer. The in-game-look preview imports the existing `illustratedCardHtml`, `illustratedArtwork`, and `fitIllustratedCards` helpers and current styles. The only renderer-like change in `fbee616` restores the existing dark `.card-title-fade` layer in the standalone gallery. That gallery, its audit and captures can be reused as a visual review harness; there is no presentation implementation to port into the game.

The proposal JSON can be retained as the source for continued design review. It should remain separate from `games/ashenspire/packs/core/cards.json` until approved rules and costs exist. Preserve canonical references as art/visual references only; the preview README explicitly says they do not assign mechanics to proposals.

## Compatibility and unresolved mechanics

The three explicitly named card proposals are:

- `proposed:card:persistent-protection` — **Ward Armor** grants Persistent Block 4 and Persistent Barrier 4, replenished at the owner's turn start and consumed by matching damage. The damage threshold, physical/magical groups, and Barrier-to-Ward mapping are unresolved. Persistent Block/Barrier are not live statuses.
- `proposed:card:greased` — **Grease** applies Greased 3; adds prone chance and melee/reach accuracy penalty; a fire hit is unavoidable, deals 3× fire damage, applies Burn 3, and splashes 1.5× damage. Greased and this compound hit/splash behavior are not implemented; the splash basis is unresolved. Live `prone` and `burn` do not implement Greased.
- `proposed:card:divine-strike` — **Smite** deals weapon damage plus Divine damage, but both contributions are unquantified. Sacred damage exists and `divine` aliases to it, but the card effect model has no dynamic weapon-damage amount. `attack.weaponDamage` selects damage typing/components; it does not supply the proposed weapon-scaled effect.

Other proposal families also need rule work before they can become playable cards. The proposal's Poison is explicitly not the live Venom status; its lethal Blight differs from Crimson/Necrotic Blight; proposed Weak may require migration. Charm, Bind, Restrained, Foresight, Mirrors, Greased, Persistent Block, and Persistent Barrier are not live statuses. Live `evade`, `prone`, `burn`, `staggered`, and `paralysis` names do not implement every proposed behavior. In particular, generated Paralysis, Stagger, and Restrained cards entering an opponent's deck or hand have no matching lifecycle. A matching status name is not sufficient compatibility evidence.

## Safe integration boundary

There are no complete, costed proposal cards ready to add to the runtime base. Keep the proposal catalog and visual gallery as design artifacts. If gameplay promotion is confirmed, choose approved candidate IDs and settle each card's cost, rank, school/stance, exact rules, and any required engine/status support before translating it into pack data. The unresolved scope question remains whether presentation, mechanics, or both should become the base.
