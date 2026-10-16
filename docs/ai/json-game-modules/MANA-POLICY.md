# Mana base-cost policy

`content/source/cardManaPolicy.json` authors the minimum printed Mana price.
The current host adapter applies it in the shared card resolver, after the
normal cost formula and equipment identity, before item modifiers and combat
discounts. Thus card faces, previews and payment share the same base price.
Higher existing prices remain unchanged; explicit discounts can still reduce
payment below the minimum.

Weapon arts come from actual authored weapon packages or the explicit
`extractable` art tag, including a Power used as a weapon art. Spell cards use
the spell camp or explicit spell ability kind. A class Power, an ordinary
physical card, and an equipment attack/guard basic do not become spells merely
because of their class, damage school or item. Unarmed fallback mounts alone
are not weapon-art identity.

The JSON policy currently belongs to the host adapter, rather than a per-run
module setting. A configured profile with MP disabled bypasses the floor and
keeps its authored resource-off variant. This is an explicit adapter limitation,
not a new mandatory Mana resource.

Core stats may author `poolBasesByClass.<classId>.<pool>` (`hp`, `mana`, or
`stamina`). These values use ordinary per-class stat rows and are snapshotted
with a new run. Core Reaver's Mana base is 0; starting WIS 1 contributes 1 MP,
and each additional WIS still contributes another MP.

Core Strike is 6 damage for 1 SP. Its same-rank damage-focused Smash is 12 for
2 SP. Sundering Art is 36 for 2 SP + 1 MP, three times that Smash's base damage.
Star Spark keeps 9 damage and applies 2 Vulnerable; Vulnerable gives 50% more
incoming attack damage, with one stack decaying at turn end. Powers and ordinary
class skills were not given a blanket damage multiplier.
