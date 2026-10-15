# Current product core specification

**Status: documentation only; proposed runtime, schemas and game configuration are not implemented.** This file defines the requested future core. Existing gameplay and the repository-wide `SPEC.md` are unchanged. The documentation baseline was `49c5781fe`; the surveyed live source baseline was `3d40c190983069eec8d8a2370fb3f229ac376290`. Obtain the active branch head with `git log -1 --oneline --decorate`; neither baseline is a claim about the current tip.

Authority for this work is: **latest live user instructions → this CORE-SPEC → consistent [IMPLEMENTATION.md](IMPLEMENTATION.md) and [PSEUDOCODE.md](PSEUDOCODE.md)**. [README.md](README.md) indexes delivery status; [CONTINUE.md](CONTINUE.md) carries the next-session handoff. Resolve conflicting planning text by updating these documents. Future source changes must reconcile the repository specification explicitly; this document does not silently change live behavior or authorize source edits now.

Workers commit and push only their own `worker/json-game-modules/<task>` branches. The integrator alone integrates and pushes `Feature/json-game-modules`. **No merge or promotion to `dev`, `test`, `release` or `main` until a future explicit owner instruction.** No new top-level AGENTS file, runtime/schema implementation, game configuration deployment or GitHub messages belong to this documentation task.

Labels below matter: **Confirmed** means requested by the owner or an already accepted recommendation; **Suggested** means a recommendation requiring a later decision before becoming a requirement; **Pending** means the wording leaves a material choice unresolved. Proposed JSON illustrates future authoring, not an available schema or deployable configuration.

## Superseded decisions

| Earlier direction | Current authority |
| --- | --- |
| Small attack/pass game is the complete product core | The full game below is the default versioned `ashen.core@1.0.0` bundle. Attack/pass remains technical fallback infrastructure. |
| Missing module always means off | Missing bundled module inherits bundle selection/settings; missing nonbundled module is off. Explicit `false` disables either. |
| Fixed nine-slot deck; editor off | Ten-card starter; deck editor on at rest spots only; deck can change and grow through rewards. No fixed nine-slot constraint. |
| Every class starts with Evade/Power/Skill | Each starts with one class-specific card only, in addition to nine shared cards. Evade is available as content/reward, not a starter. |
| Distinct elemental damage and ranked spells | Unified damage; no elemental distinction or spell-rank system in this core. Rest card upgrades do not reintroduce spell ranks. |
| Feats, skill XP, attribute allocation at creation | Class selector with fixed starting loadouts; character-level progression; no feats, skill XP or creation attribute allocation. |
| Retain hand between rounds | Entire deck reshuffled at round end; no hand retain; fresh draw from base four plus INT: five normally, six for Starseer. |
| Old Poise pool absorption, break and automatic stagger | Core Poise only reduces damage. Do not retain pool absorption/depletion-to-stagger implicitly. Stagger/interrupt rules require separate authored semantics. |

## Bundle, kernel and toggles

**Confirmed:** The kernel is generic infrastructure: contracts, deterministic scheduling/RNG, registries, transactions, validation and host adapters. The product core is a versioned bundle of declared feature modules and their settings/content. All features required by the core rules below ship selected by that bundle. A core-only request therefore means the full specified game, including cards and progression; a minimal attack/pass harness alone fails product acceptance.

The public author entry shape remains:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {}
}
```

Resolution is exact and inspectable:

| Author entry for module | Selection and settings |
| --- | --- |
| Omitted, module declared by selected core bundle | Inherit bundle selection and settings. |
| Omitted, module not declared by bundle | Off. |
| `false` | Explicitly off, including a bundled module. |
| `true` | Enabled using module defaults followed by applicable bundle overrides. |
| Object | Enabled using module defaults → applicable bundle overrides → author object. |

Objects merge recursively; arrays and scalars replace. No parallel enable registry and no implicit activation of another feature through dependencies. A dependency may diagnose incompatibility or select an explicitly authored fallback; only the core pin's declared bundle composition selects inherited features. Technical helper dependencies are distinct from gameplay switches. Show the complete resolved expansion, exact module/bundle pins, artifact hashes and provenance of selection/settings. Locks, exports and saves pin both bundle and module artifacts; do not infer a lock from source shorthand.

For example, this proposed author input explicitly disables three bundled features and still needs a legal playable projection:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {
    "cards": false,
    "resources": false,
    "art": false
  }
}
```

Attack/pass, turn opportunities independent of optional resources, target selection, enemy response, outcomes, restart, basic activities, inspect, save/load and procedural low-poly stand-ins are mandatory runtime fallback capabilities. An optional `ashen.fallback@1.0.0` test fixture may exercise that harness; it is not the product core or a second required public authoring format. Every supported built-in toggle composition must remain playable. Cards/resources off requires authored semantic variants and compatible decks/content, not blanket effect removal or free costs. Invalid custom content can fail validation with exact paths and reasons. Art off/missing/failed preserves hitboxes, target IDs and inspection.

## Classes, stats and equipment

**Confirmed, latest clarification:** Four selectable classes use fixed loadouts and **six total attribute points**, not six or seven in every attribute. Every attribute starts at 1 and each class adds one point to its primary attribute. This supersedes the earlier all-7 proposal and its additive bonuses. All classes sum to six; there is no extra class CON bonus.

| Class | STR | DEX | CON | WIS | INT | Fixed starting weapons | Tenth starter card |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Reaver | 2 | 1 | 1 | 1 | 1 | Greatsword only | Weapon art |
| Starseer | 1 | 1 | 1 | 1 | 2 | Scepter | Spell |
| Rogue | 1 | 2 | 1 | 1 | 1 | Two daggers | Skill |
| Herald | 1 | 1 | 1 | 2 | 1 | Scepter | Power |

Canonical spelling is Herald; “Harold” in the earlier request refers to that class.

Proposed fixed-stat data excerpt (all values confirmed; schema still proposed):

```json
{
  "classAttributes": {
    "reaver": { "strength": 2, "dexterity": 1, "constitution": 1, "wisdom": 1, "intelligence": 1 },
    "starseer": { "strength": 1, "dexterity": 1, "constitution": 1, "wisdom": 1, "intelligence": 2 },
    "rogue": { "strength": 1, "dexterity": 2, "constitution": 1, "wisdom": 1, "intelligence": 1 },
    "herald": { "strength": 1, "dexterity": 1, "constitution": 1, "wisdom": 2, "intelligence": 1 }
  }
}
```

Exact item/card IDs, starting armor, flask quantities and equipment slot accounting are not supplied here. Fixed starting weapons do not establish a lifetime class restriction on reward equipment. Core sprites do not change with weapon or armor; equipment still changes authored gameplay values.

| Attribute increase | Confirmed primary benefit | Other behavior |
| --- | --- | --- |
| STR +1 | AR +1 | Preserve other applicable hidden dependencies through the legacy adapter. |
| DEX +1 | DR +1 | Preserve other applicable hidden dependencies. |
| CON +1 | Maximum HP +10 | SP progression and other applicable hidden dependencies remain. |
| WIS +1 | Maximum MP +1 | Preserve other applicable hidden dependencies. |
| INT +1 | Draw +1 | Draw is base 4 + INT; preserve other applicable hidden dependencies. |

Replace the corresponding legacy primary terms; do not add these benefits on top of old primary terms and double-count them. These are **per-increase benefits**, not definitions of starting HP/AR/DR/MP, resource caps or new base formulas. Keep the stats system and other hidden calculations except where the new core explicitly supersedes them. SP still grows from two CON levels or combinations of other stat levels; the precise threshold/combination rule is pending. Do not invent coefficients, caps or substitute a guessed formula.

A source survey using `git show` establishes these existing seams, not approval to copy all their numbers into the new rules:

| Existing source | Verified dependency and migration concern |
| --- | --- |
| `src/model/derivedStats.js` | Versioned stat rows, per-class forms, optional attribute baselines, independent flooring of each weighted attribute term, level terms and bounds. Preserve snapshots and rounding through adapters. |
| `src/content/derivedStats.js` | Live AR reads STR; DR reads DEX; PR reads INT; Ward reads WIS; Poise reads CON. HP, MP, SP and hands have authored rows. Old HP/MP/INT weights differ from the requested new primary benefits. |
| `src/content/derivedStats.js` SP row | Existing SP uses DEX/CON weights .25 and WIS/INT .2, base 3 and per-level .1. Independent flooring does not necessarily let two subthreshold attribute contributions combine. The requested two-CON/combined-other growth cannot be claimed implemented by retaining this row. Specify whether growth counts absolute attributes or gains and whether secondary contributions combine before or after flooring; no new coefficients or starting pool are assumed. |
| `src/content/derivedStats.js` MP/hand rows | MP has secondary STR/CON/INT contributions; INT also affects PR and hand rows with legacy baselines/caps. Preserve other applicable roles, replacing the primary MP/draw terms with the confirmed new rules; draw now uses base 4 + INT. |
| `src/model/attributes.js`, `src/content/attributes.js` | Creation totals/mode bounds, class presets, granted points and save validation are coupled. New class allocations sum to six; creation and save validation must accept those approved fixed presets and preserve old saves. New rules must not invalidate old saves. |
| `content/framework/mechanics.json` | Weight/capacity reads CON/STR; dodge rules read DEX/mode/weight; legacy rest/resource and equipment grant rules exist. The revised six-point allocations need balance/compatibility checks against legacy thresholds. A legacy full-MP-rest field does not settle the new core request. |

**Confirmed families:** weapons: straight swords, shields, scepters, bows, greatswords, daggers; armor: robes, light, medium, heavy. Shields are retained in the requested weapon-family catalog. Additional equipment taxonomy, starting armor and equip restrictions remain to be authored. **Confirmed:** equipment editor is on. Only deck editing was restricted to rests; do not apply that restriction to equipment by inference. Suggested: equipment editing in safe noncombat phases; exact timing/cost policy remains to be authored.

## Deck and readable cards

**Confirmed:** Deck editor is enabled **at rest spots only**. The owner clarified: “and limit deck editing to rest spots.” Manual adding/removing/reordering/equipping of the active deck is blocked at other nodes and in combat, without deleting cards or deck state. The starter is exactly ten cards:

| Shared starter | Copies |
| --- | ---: |
| Strike | 3 |
| Defend | 3 |
| Counter | 1 |
| Smash | 1 |
| Sweep | 1 |
| Class-specific weapon art / skill / spell / power | 1 |
| **Total** | **10** |

The class-specific row follows the class table. Rewards may grant owned cards outside rests while manual deck editing remains unavailable. Acquisition is distinct from editing/equipping the active deck; collection versus active-deck membership and automatic reward insertion need an explicit policy. Do not silently auto-equip rewards outside rests or block rewards altogether. Suggested: grant cards to an owned collection, then let the player change the active deck at a rest. No fixed nine-slot deck, mandatory starter Evade or equalized class-special type is allowed. Evade may appear in rewards/available cards. Minimum/maximum editable deck size is not specified.

At round end, reshuffle the entire deck; do not retain the previous hand. **Confirmed:** draw is exactly `4 + INT`, giving five starting cards for Reaver/Rogue/Herald and six for Starseer. INT growth increases draw by one per point; use this formula for the fresh opening/round hand. Exact lifecycle rules for temporary/exhausted/generated cards still require authored rules; “entire deck” must not accidentally erase permanent rewards or duplicate instances.

Accepted readable-card guidance: at most two effects and approximately two to three total display lines on the face; inspect provides detail. Authored effects can include damage, status, block, Poise interaction and evasion. Buffs are statuses. Those categories do not authorize automatic legacy Poise break behavior. Costs and class-special effects are not invented here.

Proposed content excerpt (illustrative vocabulary, not the runtime schema):

```json
{
  "starterDeck": {
    "shared": [
      { "card": "strike", "copies": 3 },
      { "card": "defend", "copies": 3 },
      { "card": "counter", "copies": 1 },
      { "card": "smash", "copies": 1 },
      { "card": "sweep", "copies": 1 }
    ],
    "classSpecificCopies": 1,
    "classSpecificKind": {
      "reaver": "weaponArt",
      "rogue": "skill",
      "starseer": "spell",
      "herald": "power"
    },
    "editorEnabled": true,
    "editorAllowedAt": ["rest"],
    "roundEndReshuffle": "entireDeck",
    "retainHand": false,
    "draw": { "base": 4, "attribute": "intelligence", "perPoint": 1 }
  }
}
```

This excerpt deliberately omits card IDs, costs, deck limits and collection-to-active-deck reward policy. It is not deployable until the actual schema/content and pending decisions exist.

## Combat, Poise and presentation

**Confirmed:** Unified damage has no elemental distinction. Preserve seven tactical stance identities: Attack, Smash, Defend, Counter, Sweep, Prepared and Evade. The directed advantage table is exact:

| Acting stance | Beats |
| --- | --- |
| Attack | Smash, Prepared |
| Counter | Smash, Attack |
| Smash | Defend, Prepared |
| Sweep | Counter, Evade |
| Prepared | Defend, Counter |

Do not infer reverse matchups, additional winners, bonus multipliers or automatic interruption from “beats.” The advantage consequence, ties and unlisted pair resolution must be specified separately. Defend and Evade have no additional outgoing advantage asserted by this request. Prepared being a stance does not make it a starter card.

Evade uses accuracy: either avoid all incoming damage or take twice the damage when it fails. Probability formula, eligible attack scope, duration and order relative to mitigation must be defined and tested; do not substitute the old dodge/temporary-guard mechanic automatically.

Poise should be “pretty high” and **only reduces damage**. **Confirmed:** while Poise applies, damage taken is `max(floor(incomingDamage * 0.75), 1)`: 25% less damage, not 75% mitigation. No nominal high-Poise number, activation/expiry rule or pipeline placement was supplied. Suggested: apply only to positive eligible damage, preserve zero damage as zero, and never resurrect damage canceled by Evade or another stage. Decide/test the stage order, eligible damage, per-hit/per-action policy and duration before implementation. No pool absorption, depletion, automatic stagger or old break-meter semantics are inherited. Stagger/interrupt may remain separately authored statuses/stance effects; their triggers, duration and consequences are pending.

**Confirmed base animation/action vocabulary:** attack, smash, defend, counter, sweep, cast, evade, hit, hurt/status effect, defeated, staggered. Retaining the staggered presentation state does not define a mechanical stagger trigger. Sprites remain the same under weapon/armor changes; missing art uses stand-ins.

Combat log is retained and consumes committed facts only. It must not leak concealed enemy plans, unknown outcomes, hidden checks or private state. Details behind inspect remain subject to disclosure rules. Inspection opens through **press-and-hold on a target**, or **press the target HUD after that target is already selected**. Select first, then press its HUD. Do not replace that with an i-button or ordinary sprite click by default. Suggested: provide an accessible keyboard equivalent without disclosing extra information.

## Run, rests and rewards

**Confirmed:** Three acts; each act has seven pre-boss nodes followed by one boss, with a different boss in each act. Two rest stops are visible; elites and bosses are visible; other route nodes display `?` while their actual authored type remains one of event, fight, elite, treasure, shop or rest. The generator must preserve actual types for resolution without leaking hidden ones through inspect/log/UI. The scope of the two-rest constraint (each act versus run total) needs an explicit generator rule if not settled elsewhere; do not add an elite-count quota. Suggested: place the final rest before each boss rather than treating that placement as confirmed.

Rests allow resting, leveling up and card upgrades. Rest restores HP and SP and refills healing flasks and MP flasks. **Pending:** directly restoring current MP is not explicitly requested; MP-flask refill does not imply full MP restoration. Costs, number of upgrades per visit and interaction/order among rest/level/upgrade are not specified. Suggested: one card upgrade per rest; no invented currency cost or unlimited upgrades as default. Card upgrades are independent of removed spell ranks.

The owner targets one to two attribute level-ups per “floor,” three to six total levels. **Pending:** interpret “floor” as act (giving one to two per act), and distinguish three to six level gains from final character levels. Starting level, XP curve, grant timing and any off-by-one conversion must be explicit before implementation; no curve is authorized by these numbers alone.

Reward categories are weapons, relics, combat cards, weapon arts, potions and armor. Combat rewards usually contain three options drawn from any of these categories; they need not contain one of each category. **Suggested:** offer three, choose one. The owner confirmed the usual displayed count, not the number taken. Rarity weights, duplicate policy, category eligibility, item auto-equip behavior, exceptional offer counts and potion limits remain authored decisions. Reward acceptance and editor changes must preserve legal decks and compatible loadouts under supported toggles.

## Proposed module ownership

This is a future responsibility map, not a claim that packages exist. IDs can be finalized with the implementation contract; do not add switches merely for every internal helper.

| Feature owner | Core responsibility / conditional integration |
| --- | --- |
| Core bundle/catalog | Declared module selection/defaults, content preset, exact pins and provenance. |
| Kernel/contracts | Generic scheduling, transactions, RNG, state isolation and typed operations. |
| Cards | Starter/editor, deck/hand lifecycle, card readability and rest upgrades. |
| Resources | SP/MP pools and flask-related resource integration; authored resource-off variants. |
| Stats / progression | Attribute rows, hidden dependencies, fixed class presets, character-level gains and save snapshots. |
| Defenses | Block/Poise and declared ordered damage pipeline; confirmed 25% damage reduction and separately decided eligibility/order. |
| Stances / reactions | Seven stance identities, directed matchups, authored consequences and response scheduling. |
| Effects / statuses | Unified damage effects, buffs, evade outcome integration and separate stagger/interrupt semantics. |
| Equipment | Fixed starting gear, families, mechanics, reward eligibility and separately authored equipment timing policy. |
| Character creation | Four-class selector and fixed loadouts; no attribute allocation. |
| Routes / encounters | Three-act route constraints, unique act bosses, visibility and seeded actual node types. |
| Rest / shops | Rest services and authored shops, reachable through activities when routes are disabled. |
| Rewards | Mixed three-option offers, claim policy, equipment/card/resource integration. |
| Core UI / log / inspect | Usable simple controls, committed-fact log, target/HUD inspection and disclosure. |
| Art / animation | Stable core sprites, action vocabulary and optional presentation over fixed geometry. |
| Runtime fallback providers | Attack/pass, finite turn opportunity, response/outcomes, stand-ins, inspect and saves under toggles. |

The bundle includes the modules necessary for these rules by default. Extra legacy feature families (quests, dialogue, multiplayer, advanced UI and others) remain separately selectable where supported; inclusion in an old catalog does not make them newly mandatory core gameplay. No dependency may silently turn them on.

## Acceptance and decision checklist

These are **future acceptance requirements**, not tests already run:

- [ ] Empty `modules` resolves the full versioned product bundle, with exact bundle/module artifacts and selection/settings provenance. Explicit false overrides inheritance; missing nonbundled entries stay off. Merge vectors cover recursive objects and replaced arrays/scalars.
- [ ] Each class starts from its approved six-total fixed attributes/gear with exactly ten cards and exactly one correct class special. No creation allocation, feats, skill XP or starter Evade; new presets and old snapshots pass the appropriate save validators.
- [ ] Deck editor changes/grows the active deck only at rests. Outside rests editing is blocked without state loss; owned-card rewards remain claimable and follow an explicit active-deck policy. Equipment editor is on with its separately declared timing. Round end reshuffles with no retained hand. Base 4 + INT gives starting draws 5/6/5/5; tests cover INT growth, permanent rewards and temporary card lifecycles.
- [ ] Attribute increase vectors prove STR→AR, DEX→DR, CON→HP, WIS→MP, INT→draw benefits. Secondary dependencies, SP thresholds/combinations, flooring, caps and old snapshot restoration have explicit vectors; no guessed starting derived totals.
- [ ] Seven stance identities and exactly the five directed advantage rows are authored. Tests cover ties/unlisted pairs and decided advantage consequences without invented reverse edges.
- [ ] Evade success deals zero; failure doubles eligible damage under a declared accuracy rule/stage order. Poise takes max(floor(incomingDamage * .75), 1) while active, under the declared positive/zero eligibility and stage policy without old absorption/break coupling. Separate stagger rules and animation states are tested.
- [ ] Seeded routes satisfy three acts, seven pre-boss nodes plus a distinct boss per act, approved rest counts/placement and visibility. Hidden node types/plans never leak through log or inspect.
- [ ] Rest restores HP/SP and both flask types; approved direct-MP behavior, upgrade limit/cost and level cadence are explicit. Rewards cover all six categories and the approved offer/claim policy.
- [ ] Press-hold target and press already-selected target HUD open inspect. Ordinary selection does not become unintended inspect; release/cancel behavior works. Log reports committed facts and preserves concealment.
- [ ] Equipment changes gameplay while core sprites stay fixed. All requested families/actions are represented; art disabled/missing/failed preserves target geometry and interaction.
- [ ] Supported built-in toggle combinations, including cards/resources/stats/defenses/stances/routes/equipment off and targeted pairs, preserve useful actions, turn advancement, outcomes, restart and save/load through authored fallbacks. Invalid custom variants fail clearly. Two differently configured runtimes remain isolated and replay deterministically.
- [ ] Full product-core browser/headless acceptance passes; a minimal fallback harness alone cannot satisfy it. Exports preserve executable meaning and locks; unsupported operations fail rather than disappearing.

Open decisions to resolve before freezing deployable defaults:

| Pending decision | Required resolution/evidence |
| --- | --- |
| Derived starts / SP | Bases, caps and approved secondary dependencies; two-CON and combined-other growth vectors. |
| Poise | Nominal high value, activation/duration, stage order and zero/positive-hit eligibility; confirmed taken-damage formula stays fixed. |
| Stances / stagger / Evade | Advantage consequences, neutral/tied pairs, evade accuracy/scope/order, separately authored stagger triggers/duration. |
| Equipment | Editor enabled; exact timing/cost, starting armor and item/card identities. |
| Rests | Two per act versus run if unresolved; direct MP restoration; upgrade count/cost and service ordering. |
| Level cadence | “Floor” means act? Three to six gains versus final levels; timing/start level/curve. |
| Rewards / deck limits | Three offers choose one recommendation; exceptions, taking policy, deck bounds, owned collection versus active-deck grant policy. Manual editing is already rest-only. |

Suggested items above must remain visibly suggested until accepted. Pending fields must not be silently filled from legacy defaults, balance intuition or example JSON. Later clarification updates this file and the sibling implementation/pseudocode/handoff together before a source slice relies on it.
