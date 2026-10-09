# Combat cards: rules and next suggestions

**Earlier implementation notes:** the tables and examples below describe the original tagged-card candidate introduced in #1705. Expanded version-2 combat is implemented through #1723 and subsequent integration. Use [the updated bullet notes](combat-cards-expansion-proposal.md) and [implementation contract](combat-expansion-contract.md) for current Counter, Evade, Ward, status recovery, Power/Skill/Status, upcasting, and Ashen Blight behavior. Existing version-1 runs keep their saved rules; the historical values below do not override the version-2 contract.

Implementation: [#1705](https://github.com/cehinds/AshenSpire/pull/1705). Contract: [SPEC §4.7](../SPEC.md#47-tagged-combat-cards-and-readable-enemy-stances). All 260 card families, 17 basic equipment profiles and 103 enemy moves receive authored tags. Suggestions below add no runtime behavior until implemented separately.

The [next combat expansion proposal](combat-cards-expansion-proposal.md) records the latest rules and suggestions in grouped bullets: Physical (Martial)/Magical (Spell), single persistent stances, Evade, Counter coverage, persistent Ward, recovery cards, Sleep and Prone, tag combos, upcasting, and three Ashen Blight feat stages. It revises the future design; the existing contract below remains unchanged.

## Core split

- **Physical:** Attack, Defend, Counter, Sweep, Ranged, Smash. Card classification stays Attack/Skill/Power; maneuver describes combat interaction.
- **Spells:** Frost, Fire, Lightning, Force, Alteration, Illusion, Divine, Decay. School and damage type stay separate. Alteration includes wards, protection, shaping and resource control; it need not deal Force damage.
- Damage and tactical tags provide shared rules to player cards and enemy moves. Utility cards keep draw, discard, preparation, offerings, healing and statuses; they do not become damage cards merely to fit this model.
- Mabinogi-style inspiration: read stance, choose response, prepare retaliation. Dungeons & Dragons 5.5e-inspired suggestions: weapon identities, limited reactions, setup conditions and control actions. This is an original card adaptation, not a reproduction of either ruleset.

## Physical loop

| Type | Implemented behavior | Answer | Example existing cards |
|---|---|---|---|
| Attack | +50% Poise pressure against prepared Smash or casting; ordinary HP damage unchanged | Defend or melee Counter, unless attack uses bypassing damage | Strike, Ambush, progression Ember Hew |
| Defend | Printed Block/support protects next enemy phase | Smash gets +50% against physical Guard and +3 Poise when Guard breaks | Defend, Iron Skin, Shield Bastion |
| Counter | Immediate support, deferred reply, one reaction | Sweep, physical Ranged, Force or Piercing bypass melee mode | Guard Counter, Riposte, Binding Parry |
| Sweep | Bypass melee Counter; area only where card explicitly targets all enemies | Guard; ranged pressure avoids melee reply | Sweeping Blow, Cleaving Blow, Whirling Guard |
| Ranged | Physical projectiles avoid melee Counter | Ranged/Spell Counter; printed defensive Alteration | Pinning Shot, Barbed Arrow, Arrow Volley |
| Smash | Break physical Guard and pressure Poise | Attack preparation pressure or eligible melee Counter | Sunderplate, Colossus Smash, Kiln Cleave |

Important limit: Ranged currently means safe from **melee retaliation**, not blanket immunity to enemy melee damage. Sweep does not automatically become an area attack. Fast Attack does not automatically cancel casting; normal Poise/break rules decide interruption.

## Counter details

- Counter card retains immediate Block, draw, Prepared and printed statuses. Listed direct damage/Poise becomes reply budget, with conditions captured after normal preparation/payment and before this card's own support or Guard/Ward. No printed Block: gain 4 base Guard; all Counters add 2 base magical Ward. No listed damage: default reply base 6. Ratings/modifiers still apply where ordinary rules specify.
- Deferred reply damage does not ask for an enemy target during preparation; it answers the incoming attacker. Printed immediate hostile support still requires its own target. Solo and co-op share this target plan.
- First eligible positive hit deals half damage and spends reaction. Fully absorbed hit returns `floor(base × 1.5) + 5 + bonus`. Partial absorption spends reaction without return damage. Listed positive reply Poise gets ×1.5; absent Poise stays absent.
- Melee mode covers eligible physical Attack/Smash. Ranged mode covers physical projectiles. Spell mode covers spells and physical projectiles; against a physical projectile its reply removes Ward without HP damage. Against an incoming spell it can damage caster Health. Reactions cannot chain reactions.
- Player reaction expires at next player-turn start. Enemy Counter becomes active when next stance is rolled; it expires at that enemy's turn start. Stagger immediately interrupts an armed Counter; death prevents retaliation.
- A Smash Guard break resolves its listed Poise bonus before a same-hit Counter reply. If the break causes Stagger, that reply is interrupted. Multi-hit previews spend Counter once and update Guard/Ward between hits; variable sequences show their actual per-hit amounts and total.
- Current enemy examples: Gilded Knight Parry, Court Duelist Riposte and Cinder Mantis Folded Blades use melee Counter; Chain Scavenger Chain Snare uses ranged Counter; Mirror Scribe Polished Ward uses Spell Counter. Their old support payloads stay intact; explicit reply base is 6.

## Spell schools

Current school differences come from existing printed recipes and typed-damage riders. Merely carrying school tag grants no automatic draw, refund or status.

| School | Current identity and examples | Suggested next tools — not implemented |
|---|---|---|
| Frost | Frost buildup and control; Frost Nova, Frost Veil, progression Rime Mirror | Chill reduces next action pressure; Shatter consumes Frost for Poise or draw rather than always HP damage |
| Fire | Burn and pressure between turns; Cinder Sigil, Pyre of Charts, Ashfall Rite | Kindle links Burn across targets; controlled self-discard fuels next Fire card; Burning targets weaken Illusion concealment |
| Lightning | Sap/Weak disruption; Star Spark and Azure Coil identity | Conductive marks enable chain targets; interrupt prepared casting through Poise; refund once per turn after successful disruption |
| Force | Ward drain and melee-Counter bypass; Starstone Pebble, Starlance, Starfall Beam | Repel cancels one prepared melee follow-up; pull targets together for Sweep; draw after breaking Ward |
| Alteration | Protection, Ward, resource shaping; Crystal Barrier, Gravity Well, Time Dilation, Warding Star | Spell absorption, dispel, defensive reflection, convert excess Ward into next-turn resource; summon utility rather than a second damage spell |
| Illusion | Weak/confusion and hand tempo; Scholars' Insight, Star Path, progression Nightglass Reading | Scry/reorder top draw cards; force one visible intent reroll; decoy absorbs one reaction; fear restricts next move family |
| Divine | Healing, protection and cleanse; Urgent Heal, Sacred Harvest, Last Mercy, Warm Litany | Bless next card; cleanse for draw; protect ally; restore an exhausted ordinary card with strict one-per-combat limit |
| Decay | Crimson Blight, offerings and life transfer; Blight Touch, Contagion, Blood Harvest | Wither lowers healing; harvest status stacks for healing or resources; spread buildup without multiplying every damage rider |

Suggested school response loops: Fire melts Frost protection; Frost slows Fire setup; Alteration absorbs Lightning/Force; Force breaks Alteration wards; Divine cleanses Decay; Decay taxes repeated healing; Illusion disrupts costly preparation, while Divine or a deliberate scouting action exposes it. These loops require authored conditions and limits before implementation; current school tags do not create them.

## Damage types

| Display | Stable ID | Current rider |
|---|---|---|
| Blunt | `blunt` | +2 Poise |
| Piercing | `piercing` | Bypass up to 2 Guard; bypass melee Counter. Specialized ranged/spell Counter still catches projectiles |
| Slashing | `slashing` | Bleed 1 after HP damage |
| Cold | `frost` | Frost 1 after HP damage |
| Fire | `fire` | Burn 1 after HP damage |
| Lightning | `lightning` | Weak/Sap 1 after HP damage |
| Force | `arcane` | Remove up to 2 Ward; bypass melee Counter |
| Holy | `sacred` | After HP damage, cleanse one attacker debuff stack in configured priority order |
| Necrotic | `decay` | Crimson Blight 1 after HP damage |

Riders apply once per committed root action (player card or enemy move) and target, not once per hit or printed damage effect. An already printed matching status prevents extra status rider. Ward removal never spills into Health. Existing weapon-dependent cards inherit equipped damage type; do not force every Strike to Slashing or every staff spell to Fire.

## Combos and build rewards

| Existing combo | What already works | Suggested feat/relic — not implemented |
|---|---|---|
| Binding Parry → Ambush/Aimed Shot | Parry prepares Counter, grants Block, Prepared and draw. Prepared powers later rogue recipes | **Measured Reply feat:** successful Counter makes next Attack cheaper, once per turn |
| Guard → progression Furnace Advance | Existing Guard-play condition adds follow-up damage | **Unbroken Line relic:** first fully absorbed hit each combat lets player retain one card |
| Frost buildup → progression Eclipse Lance | Existing Frost/Frost-Exposed condition rewards follow-up | **Cold Ledger feat:** consuming Frost draws one, once per turn; costs stacks rather than adding free damage |
| Guard break → Sunderplate | Smash and printed Poise pressure can cause normal break; Sunderplate's existing Staggered condition adds Bleed | **Breaker Chain relic:** first actual Guard break draws one and discards one, once per turn |
| Explicit discard → progression Pocket Coil / Razor Debt | Existing discard-history conditions enable draw or attack bonus | **Tactical Reserve feat:** after discard, retain next defense card; one card per turn |
| HP offering → progression Crown of Scars | Existing offering-history rider rewards earlier payment | **Ashen Testament relic:** first paid offering protects against one debuff; no automatic persistent corruption |
| Spell → progression Cinder Orbit | Existing previous-spell condition grants bonus | **School Weave feat:** three distinct schools in one turn grant Ward or scry; no unlimited mana loop |
| Ranged setup → Nock and Wait → ranged enemy hit | Immediate draw/Prepared plus specialized ranged Counter | **Returning String relic:** successful ranged Counter returns one exhausted ordinary ranged card, once per combat |

Build limits: trigger once per turn/combat where stated; cap discounts at zero; reactions cannot create further reactions; Exhaust recovery must exclude proposed native corruption cards. Prefer status conversion, draw/discard choice, retention and resource timing before adding another damage multiplier.

## Enemy reads

- Exact action starts **70% hidden**; this controls intent information. Base hidden chance 70%; each Wisdom reduces it 2 percentage points and each Intelligence reduces it 1 percentage point. Clamp 0–95%. Wisdom 10 / Intelligence 5 → 45% hidden.
- Stance always visible: Attacking, Defending, Countering, Sweeping, Ranged, Smashing, Casting, Preparing or Staggered. Hidden action omits selected move ID, exact damage, hit count and payload. Reveal rolls once per selected intent; inspection and reload never reroll it.
- Enemy move catalog lists known possible moves. Hidden current selection receives no active highlight or live numeric preview.
- Suggested **Observe card**, not implemented: spend action to reveal current move and reorder one drawn card. Observation should trade tempo for certainty, not erase uncertainty free.

## Example gameplay loop

Numbers below isolate tactical rules: ignore ordinary rating/status/armor adjustments; real play uses live preview. Counter example has reply base 6 and sufficient defense.

1. Player sees Soldier **Attacking** and Knight **Countering**. Exact Soldier attack may be hidden; stance still supports response.
2. Play **Sweeping Blow**. Its all-enemy targeting is printed; Sweep bypasses Knight's melee Counter. Knight's Guard still absorbs damage normally. Hitting Soldier's Health may apply Slashing's Bleed rider if equipped source supplies Slashing.
3. Play **Binding Parry**. Block, Prepared and draw resolve immediately; Counter is ready. Remaining resources can fund draw/setup or be saved according to ordinary turn rules.
4. Enemy's eligible 8-damage attack becomes 4. Full absorption triggers reply: `floor(6 × 1.5) + 5 = 14` before attacker's own defenses. Reaction is spent; later enemy attacks receive no automatic Counter reduction.
5. Next turn, inspect new stances. Knight showing ordinary Guard invites **Sunderplate/Smash**; Knight showing Counter invites Sweep or Piercing/Ranged. Prepared can instead enable **Ambush/Aimed Shot**. Casting foe invites fast Attack's Poise pressure or Spell Counter.
6. Draw/discard and status setup shape future turns. Exhaust removes ordinary exhausted cards for this combat; combat Crimson Blight still follows ordinary status rules.

## Ashen Blight: proposed run risk

[Ashen Blight proposal](./ashen-blight-proposal.md) is separate and **not runtime behavior in this candidate**. Proposed cheap, powerful Exhaust families add persistent run corruption; crossing cap may cause requested 90% rupture loss or a surviving Blighted transformation, with subsequent per-combat risk. Proposed volcanic trim fades toward center, retaining readable rules and explicit Corrupted badge.

Keep persistent corruption separate from combat Crimson Blight, spell school Decay and ordinary Exhaust. Proposal must settle save receipts, full-deck overlay, copying/recovery limits and timing before implementation. Never apply run corruption to every current Decay or Exhaust card merely because its tags match.

## Coverage and rollout boundary

- Migrated candidate: 260 current cards, 17 equipment card profiles, 33 enemies and 103 moves. Card schools cover all eight identities; no current enemy is newly invented merely to fill missing Frost-caster slot.
- Authoritative tag rows hold every classification. Counter faces and rank recipes describe preparation; immediate support remains printed. Tests cover all authored and composed cards, every scoped enemy move, Counter modes, legacy ID labels and active-tag authority.
- Reusing a derived enemy-move table follows changes to nested moves. An explicitly replaced flat table takes precedence for its scoped rows; runtime materialization stamps the selected rows once and shares the frozen objects with nested enemy moves.
- Land specification-only PR first. Implementation PR then carries source/generated data, engine/UI changes and behavioral validation. Separate suggested content additions and persistent-corruption work into their own scoped implementations.
