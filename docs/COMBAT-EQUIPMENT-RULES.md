# Combat and equipment rules

Status: specification for implementation; no gameplay activation or prototype
results are claimed by this document. Parent authority: [SPEC.md](../SPEC.md).
The owner selected the foundation and three-build prototype first, followed by the
accepted equipment, stance, and card expansion. Initial numbers below are prototype
defaults, not measured balance findings. Once implemented, each tunable has one
authoritative content row; replace copied tuning tables here with references to it.

## 1. Scope and implementation order

Equipment defines an attack's foundation. Cards define its technique. Stances
change persistent fighting behavior. Affinities, armor, and runes modify that
foundation through explicit conditions and source ownership.

First formalize and implement tags, damage/defense resolution, triggers, stacking,
resource recovery, and Evade. Exercise heavy physical, fast Bleed, and rare-mana
caster builds through the real combat engine before expanding reward pools.
Then implement equipment instances, grip, affinities, armor, sockets, loot,
creation choices, stance presentation, and the four 50-card reward pools.

Deferred ideas are not silently enabled by this scope: random AC checks, tactical
movement/Reach/Push, additional damage types without content, and unlimited proc
chains. The default combat ruleset has reliable hits and explicit defenses.

## 2. Categorized tags and source ownership

Extend the existing tagDomains/tags/tagFamilies/tagFamilyDomains/tagging tables;
do not introduce a second independent tag vocabulary. Existing creature, item,
itemType, run, grantSource, and presentation domains remain valid.

| Category | Initial examples | Contract |
| --- | --- | --- |
| Source | weapon, spell, unarmed | Identifies which source profile supplies mechanics |
| Delivery | melee, projectile, area | Controls eligible defenses, targets, reactions |
| Damage type | slashing, piercing, blunt, fire, frost, lightning, arcane, sacred, decay | Identifies a damage component for mitigation |
| Technique | heavy, precision, cleave, counter, flourish | Matches explicitly authored technique bonuses |
| Theme | blood, blight, astral, oath, stance | Matches class, rune, armor, and stance synergies |
| Presentation | existing animation selectors | Controls art only; cannot confer combat effects |

Attack/Skill/Power remain card classifications. Retain/Exhaust/Channel are
validated behavior properties, not independently authored duplicate tags. Resource
cost categories are derived from resolved costs. A Blood tag alone grants no Bleed.
Physical/magical is derived from the damage-type registry, not a second damage
number. A physical strike carrying magical damage retains its physical delivery.

Migration explicitly maps existing card-domain tags into the new categories.
Existing `pierce` is not silently reinterpreted as armor penetration. Starstone
theme, arcane damage, and a frost presentation tint are separate facts. Invalid
domains, missing mappings, and contradictory cardinalities fail with a named row.

Every resolved attack records actor, card instance, weapon/focus instance, hand,
grip, root action, target, and ordered hits. A normal weapon technique uses its
declared hand (main hand by default); dual-wield techniques author a hand per hit.
Spell damage uses the casting implement, not a sword held in the other hand.
Unarmed has its own profile. Enemies also have authored attack-source profiles.
Area is a delivery dimension and may coexist with spell or weapon source.

Properties are granted by the actual equipped instance. A sword rune adding
one Bleed buildup grants it and the Blood theme to all compatible attacks using
that sword, including class cards. Armor/relic effects can be actor-wide only
when their scope explicitly says so. Framework inheritance permissions remain
enforced; a tag does not bypass compatibility, targeting, costs, or restrictions.

Before payment, resolve one action snapshot. Equipment changes refresh previews
and cards in hand/draw/discard/exhaust immediately, preserving card IDs, upgrades,
ownership, and pile positions. They do not rewrite an already-paid action's source
mid-resolution or copy temporary tags into permanent card definitions. Removing
an effect source removes its derived grants. Already-applied ailments retain their
authored duration. Source-bound passives end on unequip. Stances persist until
replaced/end of combat; future attacks use the newly equipped weapon profile.

## 3. Damage and defense resolution

Ordinary direct attacks do not make an accuracy roll. Damage types do not
automatically cause ailments, cost mana, bypass armor, or alter impact.
Mixed damage is an ordered list of typed components, not multiple attacks.
Flat per-hit damage bonuses are allocated once using declared component weights;
splitting one hit into two types never doubles Strength or a rune bonus.

Resolve each hit in this order:

1. Confirm its living/eligible target. Do not retarget to another enemy unless
   the technique declares that behavior. Check Evade before any on-hit effects.
2. Resolve base components and source-specific scaling, then flat bonuses.
3. Apply attacker modifiers and target vulnerability/critical modifiers. Named
   stacking groups determine composition; equivalent bonuses are not multiplied
   merely because they have different sources.
4. Apply bounded armor mitigation to physical components, then matching typed
   resistance to each component. Explicit immunity reduces that component to zero.
5. Round final component damage using configured precision/rounding. Sum components
   for one Block transaction; distribute any HP remainder proportionally with
   stable largest-remainder allocation for per-type logs. There is no minimum HP
   damage through immunity or full mitigation.
6. Consume Block and apply remaining HP damage. Block is temporary absorption,
   not armor, resistance, or Evade.
7. Resolve the hit's allocated impact and eligible buildup from the same receipt.
   Queue reactions in the defined order; resolve defeat before later hits.

Initial armor formula: reduction = min(cap, armor / (armor + scale)), with
scale=100 and cap=0.60. Armor cannot be negative; penetration reduces effective
armor to a minimum of zero. Resistance sources in a named group use strongest-only
by default; independent groups multiply their remaining-damage factors, with an
initial total resistance cap of 0.75. Immunity is explicit and outside that cap.
Vulnerability is a separate bounded modifier. These defaults must be measured.

HP damage, impact, and buildup have separate resistances. A blocked contact hit
still counts as landed for weapon impact and on-contact buildup. An evaded hit
does not. An effect requiring HP loss declares `hpDamagePositive`; it must not
borrow the looser landed-hit event. Damage immunity does not imply ailment or
impact immunity. Creature-specific immunity is authored and visible.

Damage-over-time, threshold bursts, reflected damage, and health payments are
different event kinds. They receive neither weapon impact nor on-hit rune effects
by default. Existing `loseHp` remains an explicit health payment/bypass operation;
it is not the generic implementation of new typed damage. Existing special proc
payloads retain their explicit impact effects through migration.

One resolver supplies live combat, previews, logs, and automated assertions in
solo and co-op. Tests cover mixed damage, Block, immunity, rounding, and empty hits.

## 4. Weapon impact and stagger

Each direct attack derives a positive base impact budget from its source, even
when the card has no listed impact bonus. Weight and family determine the weapon
baseline; physical/magical delivery determines the multiplier. Initial formula:

`impactBudget = max(1, floor(weight * familyFactor * gripFactor * deliveryFactor))`

Initial factors: blade 0.5; hammer 0.7; other families must author their factor;
one-handed grip 1.0; supported two-handed grip 1.2; physical delivery 1.0;
ordinary magical delivery 0.2. Unarmed and enemy natural attacks author explicit
baseline profiles. Gravity/earth/force techniques can explicitly increase impact.
Magical damage added to a physical swing does not create another impact budget.

A card adds only its listed impact bonus. For each source and target, allocate
baseline plus bonus across the declared hits with integer largest remainders,
using authored hit weights and stable hit order for ties. Equal two-hit attacks
divide one source budget; they do not get the complete budget twice. Dual-wield
cards author source participation weights summing to one; they blend the two
sources instead of doubling the budget. Evaded/cancelled hits lose their shares;
shares are not redistributed. An area technique declares its per-target multiplier.

All rounding, delivery factors, source weights, area factors, and bonus distribution
are configuration. Individual low-impact hits may round to zero; the complete
direct attack still has its positive base budget before defense. Card previews
show total impact and the additional card contribution separately.

Keep the recognizable stagger payoff initially: skip one enemy action and expose
the target to extra damage. Retune thresholds against the prototype corpus. Define
the skipped-action limit, exposure duration, threshold growth, and post-stagger
resistance as rows. A target cannot be repeatedly staggered during its existing
stagger window. Subsequent impact is capped below the next threshold while
protected, with no deferred automatic stagger on expiry. Bosses can reduce control
duration or gain temporary resistance; blanket immunity is not the default.
Prototype critical damage shares an exclusive strongest-only damage group with
stagger exposure so the same opening cannot silently receive both full multipliers.

## 5. Evade, resources, and hand behavior

Dodge Roll: Retain; gain one Evade; maximum one charge; once per actor turn.
No dice check and no Block grant. Light/medium/heavy costs are initially 1/2/3
stamina and zero actions. Payment fails without mutation if Evade is already
active, the use limit is reached, or resources are insufficient.

Evade consumes on the next eligible incoming direct hit and prevents its HP damage,
impact, and attached ailments. It prevents only one hit of a flurry. It expires
at the start of its owner's next turn before draw, even when the turn is skipped.
Damage-over-time and health payments bypass it without consuming it. Direct hits
are dodgeable by default, including projectiles; undodgeable attacks declare an
exception shown in intent previews. A resolved non-evaded zero-damage contact
still follows its explicit trigger eligibility. Reloading cannot refresh Evade.

Each starter deck has exactly one universal Dodge Roll. Equipping either/both
hands never removes or duplicates it. Remove legacy empty-hand Dodge grants during
migration; preserve deliberately acquired run-owned extra copies. Hand-size limits
and Retain behavior otherwise remain unchanged. Empty hands use unarmed techniques.

Restore one stamina at the start of each owner turn after expiring defenses and
before draw, capped at maximum, regardless of prior spending. Do not also run
legacy idle-recovery at turn end. Combat initializes pools through the existing
resource entry rule; the first turn does not grant a duplicate setup refill.
Mana has zero natural turn recovery and retains explicit flask/rest restoration.
Resource refunds do not reset activation limits or allow replaying a paid effect.

The rough 3 actions / 2 stamina / 1 mana relationship is a design budget, not a
player-facing exchange operation. Zero-action effects need bounded repetition.
Normal physical arts primarily cost actions/stamina; enchanted signature arts can
require all three. High-cost magic produces a guaranteed useful base effect.

## 6. Triggers, chance, and stacking

Each effect declares trigger, predicates, source scope, target rule, magnitude,
probability, roll scope, stack key/mode/cap, duration boundary, activation limit,
cooldown, permitted secondary triggers, and presentation. Omitted optional values
resolve from one validated defaults registry; they are never inferred from names.

Resolution events have stable rootActionId, eventId, actorId, targetId,
sourceInstanceId, cardInstanceId, hitIndex, depth, and event kind. On play fires
once after atomic payment; on landed hit fires once for each contact, not once
per damage component; on HP loss requires positive loss. Defeat and status-proc
events have separate identities. Queue order is phase, explicit priority, source
instance ID, effect ID, then target/hit order. Triggers only enqueue effects.

An effect cannot react again to its own descendant event by default. Secondary
damage cannot generate weapon attacks, impact, or new on-hit procs unless allowed.
Each effect has a root-action activation cap as well as any per-turn limit. A
configurable queue-depth/event-count guard rejects an invalid resolution atomically
and reports its offending effect IDs; it must not silently spend resources and
truncate half a player action. Candidate execution uses a cloned deterministic
state and commits after validation, including its RNG state and receipts.

Chance defaults to guaranteed; random bonus effects default to one roll per card
play shared across that effect's targets/hits. Per-target and per-hit modes are
explicit. Use a dedicated persisted seeded proc stream; probabilities 0 and 1
consume no random draw. Previews never consume RNG. Show final probability after
modifiers. Invalid probabilities, unknown scopes, negative durations, and missing
limits fail content validation. No random chance is required for stance activation,
resource payment, core Bleed buildup, or an expensive spell's base benefit.

| Stack mode | Meaning |
| --- | --- |
| add | Sum magnitude up to cap; duration policy still explicit |
| refresh | Keep magnitude; reset expiry to the declared boundary |
| replace | Newest valid application replaces old value and expiry |
| strongest | Greatest active magnitude wins; expired winners reveal remaining sources |
| independent | Keep separately attributed instances; respect aggregate cap |
| unique | One active instance in the named group, such as a stance |

Duration and magnitude do not share a counter. Durations name whose turn and
whether start/end; refresh does not add duration unless explicitly authored.
Derived states such as Bloodied (HP <= 50% maximum initially) update immediately
and are not removable status stacks. Existing status IDs migrate explicitly.

Initial tactical conditions: Marked (next qualifying attack bonus), existing Weak
for weakened offense, Exposed (specified defense reduction), Bloodied, Channeling,
and Prepared. Avoid introducing a duplicate Weak condition. One channel can coexist
with one stance. A new channel replaces the prior channel; stagger, death, or its
declared expiry ends it. Ordinary damage does not roll a concentration check.
Prepared effects react automatically to a stated trigger with visible charge and
expiry; no modal reaction prompts during enemy actions.

Initial weapon traits: Cleave (bounded second target), Sap (weaken next attack),
Opening (next qualifying attack bonus), Topple (conditional added impact),
Follow-through (bounded Block bypass), Flow (first qualifying offhand technique
cost reduction). Each family has one signature trait initially. Extra rune traits
retain their own limits; they do not create additional free attacks by implication.

## 7. Three-build prototype gate

Use isolated test scenarios that instantiate the same registries, engine, queue,
cost resolver, RNG, and preview functions as the game. No separate combat simulator
may be presented as evidence that production mechanics work. Prototype content
must be explicitly selected and excluded from ordinary reward pools.

Use three ten-card decks with the same starting HP, attribute budget, item quality,
and progression tier. Spell builds allocate more of their equal attribute budget
to casting; do not gift them extra refill resources. Each includes one Dodge Roll,
two baseline guards, one recovery skill, one stance, and five attack/technique cards.
Record actual load class and derived resource caps. Two hands empty is a separate
creation/compatibility case rather than an artificially armed fourth build.

| Build | Equipment and attack mix | Intended strength | Intended pressure |
| --- | --- | --- | --- |
| Heavy physical | Two-handed greatsword/hammer; three basic strikes, one high-impact art, one cleave | Impact and large committed hits | Stamina competition and multiple attackers |
| Fast Bleed | Dagger with Blood affinity or +1 Bleed rune; three basic flurries, one setup, one finisher | Contact buildup and sequencing | Physical armor, buildup resistance, lower impact |
| Rare-mana caster | Casting focus; three action-only spells, one 1-mana spell, one 2-mana signature spell | Decisive limited casts plus reliable fallback | Long sequences without mana refill |

Before tuning, capture current-dev behavior with analogous legal equipment/decks.
Then run both versions against: an unarmored single enemy; an armored high-poise
enemy; a three-enemy encounter; an explicitly Bleed-resistant enemy; a boss with
control resistance; and three encounters without mana refill. Also exercise full
Block, mixed damage, death mid-flurry, missing mana, and simultaneous co-op triggers.

For each build/scenario, use the same 100 seeds and publish all results, including
losses. The deterministic agent policy is shared (same targeting/defense heuristic,
no hidden-information access); log any build-specific policy parameters. Separately
play each build through the browser to check sequencing and readability.

Measure win rate, HP lost, turns, damage by type, buildup/proc count, impact/staggers,
enemy actions denied, resources spent/recovered, unusable hands, and proc chains.
Report median and tail outcomes, sample size, and deterministic repetition checks.
This small corpus does not establish full-run balance or replace human playtesting.

Gate to content expansion:

- All mechanics invariants and solo/co-op parity pass, including preview equality.
- Every build has an affordable offensive line at zero mana; no regeneration loop
  produces unlimited actions, damage, resources, or permanent control.
- Every build clears the basic encounter under a documented reasonable policy;
  weaknesses remain observable. No build wins every comparison on damage, defense,
  and resource efficiency. Any dominance or inaccessible starting costs are tuned
  and rerun before scaling content.
- Mana-spending cards provide a measurable payoff over their action-only fallback;
  the caster survives the depletion scenario without requiring a free mana refill.
- Weight/grip changes matter, fast hits do not multiply full weapon impact, and
  stagger resistance prevents continuous denial of boss actions.
- Browser checks confirm readable costs, defense/impact/buildup previews, Retain,
  and deterministic Evade at desktop and phone widths. Publish actual evidence.

## 8. Equipment instances, grip, and upgrades

Each owned copy has a stable instance ID referencing a catalog item, quality,
reinforcement level, one affinity, socketed rune instances, art mounts, and any
acquisition data needed for idempotent rewards. Equipped slots reference the copy,
not just the catalog ID. Allow separately owned copies of the same base item.
No duplicate possession of one rune instance or item instance is valid.

Weapon metadata distinguishes native 1H/2H tags from currently selected grip and
allowed grip modes. One-handing an eligible native-2H weapon requires
ceil(base Strength requirement * 1.5), with other attribute requirements unchanged.
Structurally two-handed weapons such as bows cannot opt in. A two-handed grip
occupies both hands and has its own configured damage/impact modifiers. A legal
one-handed grip can use an offhand but loses those two-handed grip bonuses.
Validate final loadout atomically at equip, swap, creation, and load.

Whetstones replace a compatible weapon's single affinity: Heavy (Strength/impact),
Keen (Dexterity), Balanced (mixed physical scaling), Blood (small contact buildup
with reduced direct scaling), Arcane (Intelligence/magical component), Sacred
(Wisdom/sacred component). Each has explicit scaling coefficients, base-damage
tradeoffs, tags, compatibility, price, and replacement rules. Type conversion
conserves the authored base budget unless a separate bonus explicitly increases it.
No automatic mana cost is added to ordinary attacks by affinity alone.

Armor defines weight separately from defense and poise resistance. Legacy armor
migrates its old effective weight once to an explicit value; later upgrades do
not change weight unless their upgrade row says so. Add modest tag-scoped weapon
bonuses (duelist/blade, heavy/impact, hunter/projectile, ritual/spell). Reinforcement
improves declared stats at bounded tiers and prices. Preview the complete before/after.

Rarity remains acquisition/content identity; quality and reinforcement are separate.
Initial quality tiers: Standard 0 sockets, Fine 1, Superior 2, Masterwork 3, with
bounded stat gains. All base weapons and armor support quality variants. Relic
quality/socket variants use authored effects rather than multiplying unique rules.

Runes have quality, compatible item families, conditions, properties, activation
limits, and value. Socket/install/remove transactions check inventory and currency
before committing. Removal returns the same rune instance at its configured cost;
replacement never silently destroys a rune. A Technique Rune adds one art mount,
with one such expansion per item initially. Removing an occupied extra mount
requires a valid destination for its art and otherwise refuses without mutation.
Art slots grant choices, not additional actions. Socketed runes contribute once
to item value and cease contributing when removed. Buy/sell/removal prices must
not create a profitable reversible transaction loop.

## 9. Loot and character creation

Each enemy references a themed drop table. Separate occurrence probability, item
selection weights, and quality weights; each is configurable by encounter tier.
Aggregate multi-enemy drops through a configured encounter cap. Weapons, armor,
relics, runes, and affinity materials keep their own compatibility and quality
rules. Better copies remain eligible after base-item discovery. Rolls are seeded
and persisted once; reward claims, reloads, and co-op collection cannot reroll or
duplicate them. Merchants/smithing offer a dependable alternative to rare drops.
Prices, drop rates, capacity behavior, and quality curves are tuned to a measured
full-run loot budget; this spec does not claim a particular drop rate is balanced.

Creation visibly offers Empty Hand in either hand, including both empty, without
discovery requirements. It is a null equipment choice, not a fake owned item.
Preview unarmed attacks/guard/techniques, Dodge Roll, load, and costs immediately.
Two-handed selections occupy the other hand explicitly. Restore the user's actual
choices when revisiting the screen; do not auto-equip a fallback sword or shield.

## 10. Stances, art, and class pools

One stance per actor, combat-scoped. Entering costs stamina once; no upkeep.
Standard initial cost: 1 action + 2 stamina; exceptional: 1 action + 3 stamina.
Same-stance activation is unavailable by default to prevent entry-effect farming.
Replacement unregisters old hooks, performs exit, then enters the new stance once.
Save/restore never replays entry effects. Costs and hooks remain content rows.

Initial roster: Reaver Gorefire/Bulwark/Breaker/Executioner; Rogue
Bloodletter/Duelist/Venom/Shadow; Starseer Astral Focus/Crystal Ward; Herald
Sacred Oath/Blight Communion. Each needs distinct mechanics, tag identity, and
entry effect in its implementation content change. Preserve legacy Gorefire and
Bulwark identity while retuning their entry penalties/bonuses against the prototype.

Derive artwork from the owner's existing class references after checking current
assets and prior work. Preserve face, outfit, proportions, style, and weapon grip.
Authored poses cover stance idle and compatible weapon-family/grip attacks,
including unarmed. Attacks, dodges, hit reactions, cancellation, and re-rendering
return to the current stance idle, not a stale timer's default idle. A persistent
tag-selected outline/ground glow remains until replacement/combat end. Gorefire
uses crimson/blood accents; Bulwark blue guarded effects. Rune/affinity effects do
not overwrite the stance aura. Each stance has icon/text identification; reduced
motion preserves its static pose and steady glow. Register assets, attribution,
consistent ground anchors, and regenerated manifests. Deliver a reviewable gallery.

After the prototype gate, expand each class reward pool from 36 to 50 unique cards:

| Class group | Actions only | Stamina with optional actions, no mana | Mana with optional actions/stamina |
| --- | ---: | ---: | ---: |
| Reaver/Rogue, each | 25 | 15 | 10 |
| Starseer/Herald, each | 20 | 10 | 20 |

Any mana cost places a card in the last category. Count base reward definitions,
including stance cards; exclude starters, duplicate copies, upgrades, and
equipment-only grants. Derived gear costs do not rewrite authored pool census.
Include attacks, skills, and powers in each appropriate category. Preserve
action-only caster play. Mana effects have decisive guaranteed benefits; physical
arts emphasize stamina, magical/signature arts can add mana. Review Herald health
payments so routine cards do not charge HP plus every other resource.

## 11. Configuration, compatibility, and verification

All magnitudes, formulas from a supported formula registry, rounding, caps, scopes,
probabilities, duration boundaries, stacking modes, slot rules, quality curves,
costs, drop weights, colors, and animation mappings are authored data. JSON/CSV
cannot execute arbitrary code. New semantic primitives require engine support,
schema validation, and tests; new compositions of supported primitives need data.

Continue using content/source tables and content/framework/mechanics.json for
their existing ownership. Extend relational tables for new associations; generated
src/content and src/framework files are rebuilt, never hand-edited. Configuration
validation rejects unknown IDs, unsafe cycles, non-finite numbers, contradictory
tag domains, illegal grants, unbounded repeats, and missing migration mappings.
UI descriptions, before/after equipment previews, costs, tags, and combat receipts
derive from those same resolved definitions.

Persist ruleset identity/hash, item/rune/card instance references, current resources,
active stance/channel/defenses, status expiries, event counters, activation limits,
and RNG state. Migration is explicit and idempotent. Either retain the matching
legacy resolver for active combats or require a safe between-combat transition;
never reinterpret a legacy in-progress fight with new costs. Unsupported versions
get a recoverable explanation, not reset possessions or silently duplicated items.
Maintain the project's 0.6.x.x version line; ruleset identity is a separate concern.

Implementation units are serialized GitHub Issues and branches/PRs targeting dev:

1. This spec-only change.
2. Foundation schemas/resolver plus three real-engine prototype scenarios and report.
3. Item-instance migration, handedness, and Empty Hand creation.
4. Whetstones, armor upgrades/bonuses, runes, art mounts, and value transactions.
5. Enemy-specific loot and quality variants.
6. Stance mechanics, source-based art, animation/effect integration.
7. Four class-pool expansions and final resource/enemy balance pass.

Later changes rebase on the then-current dev after owner integration; agents do
not merge their own PRs. Reuse existing issues when they match; this document is
an implementation contract, not a parallel ticket/status system.

For runtime changes run the node suite, focused mechanics tests, content/framework
builders as needed, `node tools/launch.mjs --build-only`,
`node tools/buildversion.mjs --check`, `node tools/verify-shipped.mjs`, and
`git diff --check`. Check desktop, phone, keyboard/touch inspection, reduced motion,
and co-op. Update the component catalog when its surfaces change. Publish concrete
results and baseline limitations; build success is not deployment or game balance.
