# Combat tag and source integration

This implements the categorized identity and source ownership section of
[Combat and equipment rules](COMBAT-EQUIPMENT-RULES.md), continuing issue #845.
The new combat rules remain opt-in; this does not activate them for normal runs.

The [complete card, armament and profile audit](attack-source-audit.csv) is generated
from the same `tagging.csv` junction used by the game. Run
`node tools/attack-source-audit.mjs --write` after changing assignments, or `--check`
to verify the projection and reject missing direct-attack source mappings.

## Authored identity

All direct card definitions and attack profiles declare weapon, spell, or unarmed
source. Armaments declare their own source, delivery and base damage type. Normal
weapon techniques inherit the selected weapon's damage type; explicit techniques
can override it. Mixed damage still requires explicit component weights.

Starseer and Herald spell attacks retain an explicit Arcane baseline in this
slice. A Frost visual or a Blight theme is not an implicit conversion or an
ailment. New typed spell compositions are a later content change. Physical weapon
types distinguish slashing, piercing and blunt without granting armor penetration.

Legacy schools remain available to their existing consumers. Broad source,
delivery, damage and theme categories do not bypass cross-class equipment
permissions. Presentation tags never contribute to a resolved attack's mechanics.

## Resolution and ownership

- Explicit hand selection is honored, including the existing left/right card
  instance carriers and the mainHand/offHand combat profile vocabulary.
- Spells select a matching focus, including one in the offhand. A missing or
  incompatible explicit source refuses the action atomically rather than borrowing
  the other weapon. Empty physical hands use the unarmed source.
- Controlled prototype and saved combat profiles remain complete source snapshots.
  Legacy profiles without `sourceType` retain their focus-family interpretation.
- Live solo loadouts read active equipment through the existing slot model. Weight
  stays on the item; configurable profile/item rows select impact family. This
  slice does not infer two-handed grip or implement new grip requirements.
- Direct effects capture their source before payment or resource-spent hooks. Later hits
  use that snapshot. Contact buildup belongs only to that source, including a
  focus with an explicitly configured effect. A theme alone supplies no buildup.
- Card previews resolve the current source for hand, draw, discard and exhaust.
  Swaps remove inherited tags without storing them on permanent card definitions
  or changing card IDs, upgrades, ownership or pile order.
- Preview entries and damage events expose matching source identities and effective
  tags. Card chips use the preview's effective tags; inherited chips explain the
  item granting them. Existing tag overflow handling remains in place.

## Boundaries

Actual rune inventory/socket transactions, item-copy migration, affinities,
two-handed grip, armor-derived combat defenses, co-op live equipment swapping,
the balance gate, and new reward cards remain subsequent work. Configured source
effects exercise rune-style inheritance; this does not claim a shipped rune-loot
system. Legacy `strike.*` equipment modifiers retain their existing scope.

Validation includes production content validation, source coverage and
contradiction checks, real solo swapping, wrong-hand rollback, source snapshots,
save restoration, exact previews, and co-op seat ownership. The existing
multi-hit/mixed-damage tests continue to check impact and bonus conservation.
