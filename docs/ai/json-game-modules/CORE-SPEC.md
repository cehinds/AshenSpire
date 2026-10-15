# Current product core specification

**Status: product authority with a partial host-adapter implementation.** The Ashen core profile, module schemas, source pack, generated lock and selected run/combat/rest/shop/reward adapters now exist on `Feature/json-game-modules`. The entire game-neutral architecture, portable rule execution and full browser acceptance do not. This document defines the user-approved product target, distinguishes confirmed requirements from suggestions/pending rules, and must not be replaced by provisional JSON defaults. The legacy sections of repository `SPEC.md` remain the behavior authority for `ashen.current`; its additive profile section links this target. Historical source hashes are omitted intentionally; inspect the current branch tip before verifying code.

[ARCHITECTURE.md](ARCHITECTURE.md) describes the target boundaries; this file is the product authority for rules and confirmed requirements. Current per-feature settings and source data are linked by the module and pack guides. If the host adapter uses a provisional choice, label it as provisional rather than treating the implementation as a product decision.

Authority for this work is: **latest live user instructions → this CORE-SPEC → consistent [IMPLEMENTATION.md](IMPLEMENTATION.md) and [PSEUDOCODE.md](PSEUDOCODE.md)**. [README.md](README.md) indexes delivery status; [CONTINUE.md](CONTINUE.md) carries the next-session handoff. Resolve conflicting planning text by updating these documents. Future source changes must reconcile the repository specification explicitly; this document does not silently change live behavior or authorize source edits now.

Workers commit and push only their own `worker/json-game-modules/<task>` branches. The integrator alone integrates and pushes `Feature/json-game-modules`. **No merge or promotion to `dev`, `test`, `release` or `main` until a future explicit owner instruction.** No new top-level AGENTS file, runtime/schema implementation, game configuration deployment or GitHub messages belong to this documentation task.

Labels below matter: **Confirmed** means requested by the owner or an already accepted recommendation; **Suggested** means a recommendation requiring a later decision before becoming a requirement; **Pending** means the wording leaves a material choice unresolved. JSON excerpts illustrate intent; executable settings live in the module schemas and core pack. Provisional working values are not promoted to confirmed gameplay by being present in JSON.

## Superseded decisions

| Earlier direction | Current authority |
| --- | --- |
| Small attack/pass game is the complete product core | The full game below is the default versioned `ashen.core@1.0.0` bundle. Attack/pass remains technical fallback infrastructure. |
| Missing module always means off | Missing bundled module inherits bundle selection/settings; missing nonbundled module is off. Explicit `false` disables either. |
| Fixed nine-slot deck; editor off | Ten-card starter; deck editor on at rest spots only; deck can change and grow through rewards. No fixed nine-slot constraint. |
| Every class starts with Evade/Power/Skill | Each starts with one class-specific card only, in addition to nine shared cards. Evade is available as content/reward, not a starter. |
| Distinct elemental damage and ranked spells | Unified damage; no elemental distinction or spell-rank system in this core. Smith upgrades equipment, not cards. No spell ranks are restored. |
| Generic rest/card-upgrade menu | Strategize (deck editing), Smith (equipment upgrading), Level Up (earned attribute allocation); every choice fully restores HP/MP/SP and both flask types. Standalone rest card upgrades are superseded. |
| Feats, skill XP, attribute allocation at creation | Class selector with fixed starting loadouts; character-level progression plus the explicitly requested profile class-unlock sequence below; no feats, skill XP or creation attribute allocation. |
| Retain hand between rounds | Entire deck reshuffled at round end; no hand retain; fresh draw from base four plus INT: five normally, six for Starseer. |
| Old Poise pool absorption, break and automatic stagger | Core Poise only reduces damage. Do not retain pool absorption/depletion-to-stagger implicitly. Stagger/interrupt rules require separate authored semantics. |

## Bundle, kernel and toggles

**Confirmed:** The kernel is generic infrastructure: contracts, deterministic scheduling/RNG, registries, transactions, validation and host adapters. Always-installed `engine/foundation` owns minimal gameplay providers; the kernel owns infrastructure only. The product core is a data-only bundle of declared feature modules and their settings/content at `games/ashenspire/bundles/core`, with Ashen definitions at `games/ashenspire/packs/core` and reusable mechanics at `engine/modules`. Follow ARCHITECTURE rather than introducing an `engine/core/core.mjs` gameplay monolith. All features required by the core rules below ship selected by that bundle. A core-only request therefore means the full specified game, including cards and progression; a minimal attack/pass harness alone fails product acceptance.

Foundation is the single authoritative HP owner. Resources uses/decorates that HP provider and owns SP/MP/Actions, without a second HP state. Class selection belongs to the core bundle; optional character creation is off. Progression may own separate run-level and profile-unlock subdomains without changing their confirmed rules. Tags/groups select declared references and never activate hidden modules.

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

Authored counterpart: `games/ashenspire/packs/core/classes.json` and `stats.json`. This excerpt records confirmed values; edit the source files, not this example:

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

### Persistent class unlocks

**Confirmed, latest owner instruction:** “core should only have reaver unlocked, starting run until win or defeat unlocks then star seer, then another one rogue, and then another one harold.” All four classes remain defined, but a fresh profile may select only Reaver for a new run. Class unlocks persist in the profile across runs; they are separate from character levels, attribute allocation, feats and skill XP.

| Unique full-run completions recorded by profile | Newly unlocked class | Classes selectable for a new run |
| --- | --- | --- |
| 0 | Reaver initially | Reaver |
| 1 | Starseer | Reaver, Starseer |
| 2 | Rogue | Reaver, Starseer, Rogue |
| 3 or more | Herald at completion 3 | Reaver, Starseer, Rogue, Herald |

A completion is a terminal **full-run win or defeat**, not an encounter victory: beating the final act's boss wins the run; hero death defeats the run. Either terminal outcome advances the sequence. Quitting, abandoning or restarting without a terminal run outcome does not count. No win-only gate or requirement to play the newly unlocked class is added. Working interpretation: a qualifying run with any currently unlocked class counts; the owner did not require a particular class.

Consume committed full-run outcome facts into a persistent, idempotent per-profile ledger keyed by unique run identity. Each unique completed run grants at most one next class; duplicate delivery, reload, retry or repeated processing of the same terminal save must not grant additional unlocks. At three completions all classes are available; further completions do not invent additional progression or rewards.

Profile storage, backup and migration must preserve the completion ledger and unlocked classes. Keep this profile state distinct from versioned run locks and run-local character progression: unlocking a class changes future selection eligibility without rewriting existing runs or their pinned gameplay artifacts. Existing-profile migration must be explicit; do not guess historical completions or silently reset unlocks. This requested class-unlock progression is the explicit exception to the earlier character-level-only direction; no other profile progression system is introduced.

The core bundle declares the necessary class-selector/progression/unlock capability selected by default. Unlock implementation may be owned by progression with a class-selector integration rather than inventing a second implicit activation registry. Any separately packaged unlock module must be declared by the bundle and resolved with the same pins/provenance rules as other features.

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
| `content/framework/mechanics.json` | Weight/capacity reads CON/STR; dodge rules read DEX/mode/weight; legacy rest/resource and equipment grant rules exist. The revised six-point allocations need balance/compatibility checks against legacy thresholds. The latest owner clarification independently confirms full MP recovery for every rest service; do not treat the legacy field as authority for unrelated defaults. |

**Confirmed families:** weapons: straight swords, shields, scepters, bows, greatswords, daggers; armor: robes, light, medium, heavy. Shields are retained in the requested weapon-family catalog. Additional equipment taxonomy, starting armor and equip restrictions remain to be authored. **Confirmed:** equipment editor is on. Only deck editing was restricted to rests; do not apply that restriction to equipment by inference. Suggested: equipment editing in safe noncombat phases; exact timing/cost policy remains to be authored.

## Deck and readable cards

**Confirmed:** Deck editor is enabled **at rest spots only**. The owner clarified: “and limit deck editing to rest spots.” Deck editing is the Strategize service. Manual adding/removing/reordering/equipping of the active deck is blocked at other nodes and in combat, without deleting cards or deck state. The starter is exactly ten cards:

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

Illustrative content excerpt; use the actual current pack schema and examples for executable data:

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
    "editorRestService": "strategize",
    "roundEndReshuffle": "entireDeck",
    "retainHand": false,
    "draw": { "base": 4, "attribute": "intelligence", "perPoint": 1 }
  }
}
```

This excerpt deliberately omits card IDs, costs, deck limits and collection-to-active-deck reward policy. It remains illustrative; the actual authored card/deck content is in the core pack, and unresolved policies remain unresolved.

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

**Confirmed:** Three acts; each act has seven pre-boss nodes followed by one boss, with a different boss in each act. Two rest stops per act are visible; elites and bosses are visible; other route nodes display `?` while their actual authored type remains one of event, fight, elite, treasure, shop or rest. The generator must preserve actual types for resolution without leaking hidden ones through inspect/log/UI. The two-visible-rest-stops-per-act count is confirmed; do not add an elite-count quota. Suggested: place the final rest before each boss rather than treating that placement as confirmed.

**Confirmed rest services:** The owner specified: “it will be the options strategize: deck editing smith: upgrade equipment level up: all options is a full heal and full mp and full healing and mp flasks”. This supersedes the earlier generic resting/card-upgrade proposal.

| Rest option | Service | Recovery attached to every option |
| --- | --- | --- |
| Strategize | Edit the active deck; deck editing remains rest-only. | Full HP, full MP, full SP, full healing-flask charges and full MP-flask charges. |
| Smith | Upgrade equipment, not cards. | The same full recovery. |
| Level Up | Allocate an earned character-level attribute increase. | The same full recovery. |

The earlier full-SP restoration remains in effect; the new instruction does not revoke it. Equipment editor enablement and its separate timing policy remain distinct from Smith's rest-menu equipment upgrading. There is no standalone card-upgrade rest service unless the owner later adds one; card-level rewards remain separate content.

**Confirmed:** the owner clarified “core is one service per visit.” Each rest visit commits exactly one of Strategize, Smith or Level Up, exactly once. Recovery belongs to the committed service choice, not merely entering the rest screen. Do not infer unlimited Smith upgrades or free levels. The amount/cost of equipment upgrading and XP eligibility need authored policies; Level Up must spend an earned level and must not grant one simply because a rest was visited.

Apply full recovery against final resource maxima after the service, including any maximum-HP/MP/SP changes caused by Level Up. Keep Strategize usable without making an edit, so a player with no earned level or upgradeable equipment can still recover. Suggested eligibility policy: disable unavailable Level Up/Smith services with a clear reason while retaining Strategize; exact XP and equipment upgrade requirements remain to be authored.

Illustrative service excerpt; the current executable policy is in `games/ashenspire/packs/core/rests.json` and the rest module schema:

```json
{
  "rest": {
    "servicesPerVisit": 1,
    "recoveryAfterService": true,
    "services": [
      { "id": "strategize", "action": "editDeck" },
      { "id": "smith", "action": "upgradeEquipment" },
      { "id": "levelUp", "action": "allocateEarnedAttributeLevel" }
    ],
    "eachServiceRecovery": {
      "hp": "full",
      "mp": "full",
      "sp": "full",
      "healingFlaskCharges": "full",
      "mpFlaskCharges": "full"
    }
  }
}
```

The excerpt deliberately omits equipment-upgrade amount/cost and eligibility policies; consult the current source pack and retain those details as unresolved rather than inventing values.


The owner targets one to two attribute level-ups per “floor,” three to six total levels. **Pending:** interpret “floor” as act (giving one to two per act), and distinguish three to six level gains from final character levels. Starting level, XP curve, grant timing and any off-by-one conversion must be explicit before implementation; no curve is authorized by these numbers alone.

Reward categories are weapons, relics, combat cards, weapon arts, potions and armor. Combat rewards usually contain three options drawn from any of these categories; they need not contain one of each category. **Suggested:** offer three, choose one. The owner confirmed the usual displayed count, not the number taken. Rarity weights, duplicate policy, category eligibility, item auto-equip behavior, exceptional offer counts and potion limits remain authored decisions. Reward acceptance and editor changes must preserve legal decks and compatible loadouts under supported toggles.

## Proposed module ownership

This is a future responsibility map, not a claim that packages exist. IDs can be finalized with the implementation contract; do not add switches merely for every internal helper.

| Feature owner | Core responsibility / conditional integration |
| --- | --- |
| Core bundle/catalog | Declared module selection/defaults, content preset, exact pins and provenance. |
| Kernel/contracts | Generic scheduling, transactions, RNG, state isolation and typed operations. |
| Cards | Starter/editor, deck/hand lifecycle, card readability and rest-only Strategize integration. |
| Resources | SP/MP pools and flask-related resource integration; authored resource-off variants. |
| Stats / progression | Attribute rows, hidden dependencies, fixed class presets, character-level gains, run snapshots and profile-owned idempotent class-unlock ledger. |
| Defenses | Block/Poise and declared ordered damage pipeline; confirmed 25% damage reduction and separately decided eligibility/order. |
| Stances / reactions | Seven stance identities, directed matchups, authored consequences and response scheduling. |
| Effects / statuses | Unified damage effects, buffs, evade outcome integration and separate stagger/interrupt semantics. |
| Equipment | Fixed starting gear, families, mechanics, reward eligibility, Smith equipment upgrades and separately authored equipment-editor timing policy. |
| Character creation | Four defined classes with fixed loadouts; only profile-unlocked classes selectable, initially Reaver alone; no attribute allocation. |
| Routes / encounters | Three-act route constraints, unique act bosses, visibility and seeded actual node types. |
| Rest / shops | Strategize/Smith/Level Up, exactly one service per visit, full recovery after every service; authored shops. Services remain reachable through activities when routes are disabled. |
| Rewards | Mixed three-option offers, claim policy, equipment/card/resource integration. |
| Core UI / log / inspect | Usable simple controls, committed-fact log, target/HUD inspection and disclosure. |
| Art / animation | Stable core sprites, action vocabulary and optional presentation over fixed geometry. |
| Runtime fallback providers | Attack/pass, finite turn opportunity, response/outcomes, stand-ins, inspect and saves under toggles. |

The bundle includes the modules necessary for these rules by default. Extra legacy feature families (quests, dialogue, multiplayer, advanced UI and others) remain separately selectable where supported; inclusion in an old catalog does not make them newly mandatory core gameplay. No dependency may silently turn them on.

## Acceptance and decision checklist

These are **future acceptance requirements**, not tests already run:

- [ ] Empty `modules` resolves the full versioned product bundle, with exact bundle/module artifacts and selection/settings provenance. Explicit false overrides inheritance; missing nonbundled entries stay off. Merge vectors cover recursive objects and replaced arrays/scalars.
- [ ] Each class starts from its approved six-total fixed attributes/gear with exactly ten cards and exactly one correct class special. No creation allocation, feats, skill XP or starter Evade; new presets and old snapshots pass the appropriate save validators.
- [ ] A fresh profile exposes only Reaver. Three unique completed full runs unlock Starseer, Rogue, Herald in that order; test win and defeat independently at every step and a run using any already-unlocked class. Encounter wins and nonterminal quit/abandon/restart do not count; locked classes cannot start runs.
- [ ] Duplicate outcome delivery, terminal-save reload/retry and repeated processing grant at most one unlock per unique run. Profile reload/backup/migration retains the ledger and unlocks; two profiles remain independent. Existing run locks/state stay unchanged, and completions after all four unlock add no invented rewards.
- [ ] Strategize changes/grows the active deck only at rests. Outside rests editing is blocked without state loss; owned-card rewards remain claimable and follow an explicit active-deck policy. Equipment editor is on with its separately declared timing. Round end reshuffles with no retained hand. Base 4 + INT gives starting draws 5/6/5/5; tests cover INT growth, permanent rewards and temporary card lifecycles.
- [ ] Attribute increase vectors prove STR→AR, DEX→DR, CON→HP, WIS→MP, INT→draw benefits. Secondary dependencies, SP thresholds/combinations, flooring, caps and old snapshot restoration have explicit vectors; no guessed starting derived totals.
- [ ] Seven stance identities and exactly the five directed advantage rows are authored. Tests cover ties/unlisted pairs and decided advantage consequences without invented reverse edges.
- [ ] Evade success deals zero; failure doubles eligible damage under a declared accuracy rule/stage order. Poise takes max(floor(incomingDamage * .75), 1) while active, under the declared positive/zero eligibility and stage policy without old absorption/break coupling. Separate stagger rules and animation states are tested.
- [ ] Seeded routes satisfy three acts, seven pre-boss nodes plus a distinct boss per act, two visible rest stops per act, approved placement and visibility. Hidden node types/plans never leak through log or inspect.
- [ ] Rest exposes Strategize (deck edit), Smith (equipment upgrade) and Level Up (earned attribute allocation). Every option restores full HP/MP/SP and both flask-charge types. Exactly one service commits per visit, once; recovery uses final maxima and does not trigger merely on entry. Equipment-upgrade amount/cost, eligibility and level cadence have tests; no unearned level or standalone rest card upgrade appears. Recovery remains reachable without edits/earned levels/upgradeable equipment, and approved recovery ordering covers changed resource maxima. Rewards cover all six categories and the approved offer/claim policy.
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
| Rests | Placement of the confirmed two visible stops per act; equipment-upgrade amount/cost and XP eligibility. Exactly one service per visit and full HP/MP/SP plus both flask refills after the chosen service are confirmed. |
| Level cadence | “Floor” means act? Three to six gains versus final levels; timing/start level/curve. |
| Rewards / deck limits | Three offers choose one recommendation; exceptions, taking policy, deck bounds, owned collection versus active-deck grant policy. Manual editing is already rest-only. |

Suggested items above must remain visibly suggested until accepted. Pending fields must not be silently filled from legacy defaults, balance intuition or example JSON. Later clarification updates this file and the sibling implementation/pseudocode/handoff together before a source slice relies on it.
