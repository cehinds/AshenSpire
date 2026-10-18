# Update Stances — implementation audit and future integration

> Historical audit of `d2ca46813`, superseded in part by `dev` through
> `5b3a005f0`. The newer runtime previews armed cards on the body, provides a
> Smash wind-up hold, and retains the last confirmed stance across turn starts.
> Preserve those newer contracts. See [delivery-status.md](delivery-status.md)
> for the owner's October 12 selections and the current integration status.

Read-only runtime audit on `Feature/UpdateStances`, baseline `d2ca46813`, 2026-10-11 (America/Anchorage). This document is the only implementation-audit output; it does not install art or change gameplay.

The current task is art exploration first: ten shared concepts **per weapon group per requested family**, followed by adaptations for Reaver, Rogue, Starseer and Herald. The weapon groups are sword and shield, greatsword, staff, bow, dagger, dual daggers, single sword, spear, halberd and unarmed. The six-family baseline (guard break, Smash stance, Smash attack sequence, melee Counter, ranged Counter, magic Counter) is **10 concepts × 10 weapon groups × 6 families = 600 shared concepts**; adapting every concept to all four classes would produce 2,400 class-specific cells. Magic stance variants are additional coverage. These are planned coverage counts, not claims that artwork is complete. Weapon choice determines the physical choreography; class determines the character appearance. A class's historical reference weapon is not an authorization to substitute it for the equipped weapon.

Co-op development is paused by the user's latest instruction. The earlier selection-preview question is superseded for this task: no network preview, protocol, host or co-op UI work belongs in this delivery. The co-op observations below record existing behavior and deferred considerations only.

## What the runtime currently does

### Selected cards, confirmed stance and persistent combat state are different facts

| Fact | Current owner | When it changes | Visible result |
| --- | --- | --- | --- |
| Inspected/lit card | `src/ui/components/cardSelection.js` | Local inspection and deselection | Selected-card appearance and target silhouettes; inspection alone need not arm a play |
| Armed enemy/self play | `selected` / `selfArm` in `src/ui/screens/combat.js` | Local selection, targeting, cancel and confirmation | Legal targets and the player's action glyph |
| Last confirmed broad stance | `createStanceLedger()` | `cardPlayed` receipt only, cleared on that actor's `playerTurnStart` | Held character art after the action |
| Last confirmed authored action kind | `createStanceLedger(kindForCard)` in solo | Same confirmed receipts | Held action glyph when no card is armed |
| Combat stance/readiness | Entity `stanceId`, statuses and combat rest | Engine receipts and actual entity state | Defeated/readiness/guard rest resolution |

`src/ui/screens/combat.js:488` previews possible targets; `:626` synchronizes selection; `:652` implements `syncPlayerActionIntent`. An armed card resolves its effective equipment-projected definition and chosen upcast ranks with `resolveCombatCard`, then its `combatProfileFor` identity wins over the held kind. With no armed card, the glyph uses the last confirmed kind, or the neutral `ready` mark before a play/after turn reset. This is an action-glyph preview, not a selected-card character-stance preview.

The body continues to receive `heldStances.get()` at `src/ui/screens/combat.js:1506`; it does not use `selected` to replace the held stance. `applyVisualEvents` at `:258` applies both ledgers from the same receipts. Preparing, rejected and failed plays do not replace the confirmed stance. An unclassified latest confirmed card clears a prior stance. Enemy-turn start does not clear it; the player's next turn does. The ledgers are presentation memory, not gameplay/save fields (`src/model/alternativeStance.js:47`).

Actual stance and readiness resolution is independent (`src/model/combatPose.js:17`): defeat wins, followed by an authored `stanceId`, readiness statuses in receipt order, then defensive rest or idle. The card canvas's `restPose` additionally gives a painted held stance precedence over ordinary rest (`src/ui/alternativeCardStage.js:108`). Future art selection must not make a selected, uncommitted card into entity state or a confirmed receipt.

### Smash already has an action, but no distinct held Smash pose

`src/model/alternativeCardAnimation.js:5` lists Smash as an action. `cardActionFor` routes physical `maneuver:smash` to `smash`; spell camp/source routes to spell before physical Smash. `src/content/alternativeCardAnimations.js:2` contains a dedicated Smash sequence for all four classes:

```
ready → smash-load → smash-contact → smash-return → ready
durations: [60, 55, 50, 45, 50]; impact index: 2
travel: [0, -8, 60, 32, 0]
```

These are existing class-default painted action frames, not the requested new weapon-specific concepts. The stage already supports timing, preload, travel, recovery and playback for this action. `playerAttackFamily` deliberately returns no weapon override for `smash`, so equipping a new weapon currently leaves Smash's class-default choreography in place (`src/model/playerAttackSprites.js:16`).

The held pose is the gap: `stanceForCard` maps physical Smash to `offensive` (`src/model/alternativeStance.js:19`), and `alternativeSelectedStances` only supplies `offensive`, `defensive` and `casting` per class. A confirmed Smash therefore holds the same broad offensive art as an ordinary attack. This must not be described as “no Smash attack exists.”

### Counters currently share one painted family per class

`combatProfileFor` carries `counterMode` from `counter:melee`, `counter:ranged` or `counter:spell` (`src/model/combatCardProfile.js:33`). Combat reaction/matchup coverage already distinguishes those identities. The visual action selector does not: any Counter chooses `counter` (`src/model/alternativeCardAnimation.js:15`), and the held selector chooses `counter` before testing spell camp (`src/model/alternativeStance.js:23`).

`src/content/playerCounterSweepSprites.js:2` supplies one selected Counter stance/return sequence per class. `src/ui/alternativeCardStage.js:47` creates `counterPrepare` as a held one-frame preparation. `resolveCombatAnimation` routes a paid Counter to `counterPrepare`, and only an actual `combatCounterTriggered` uses the full `counter` retaliation (`src/model/combatAnimation.js:15`). These are four painted phases, `[55, 60, 65, 80]`, with impact index 1 and effects separate from the body.

There are no separate held or return-art cells for melee, ranged and magic Counter in this catalog. New concepts must retain the distinction between preparing a defense and a triggered return; selecting or paying for a Counter cannot itself swing the retaliation.

### Magic currently has a broad held pose and several action routes

Each class has a `casting` held pose in `src/content/alternativeSelectedStances.js:2`. There is no weapon-specific held casting key. Card identities use authored camp/source; elemental physical damage alone does not imply a spell (`src/model/alternativeCardAnimation.js:10`, `src/model/alternativeStance.js:19`). Spell Counter and Defend keep their maneuver precedence.

Ordinary spell actions can select `energy-blade` for a spell attack/blade identity or `staff-casting` otherwise; `rangedMagic` always selects `staff-casting` (`src/model/playerAttackSprites.js:13`). That choice is currently made without requiring an equipped staff. It is existing behavior to account for, not proof that a bow, unarmed or polearm magic pose is authored. The broader base catalog also supplies `spell` and `rangedMagic` actions.

### Guard break currently produces a callout, not a dedicated body pose

`completeGuardBreak` emits `combatGuardBroken` from a connected Smash that depletes previously present Guard (`src/engine/combatMatchups.js:443`); the legacy path does likewise at `:146`. It can emit on a lethal hit and with a zero bonus. The engine already owns the event and Poise consequence.

`src/ui/fx.js:1352` maps the receipt to the Guard Break callout. `src/model/combatEffectEvents.js:7` supplies existing guard/barrier overlays from their separate receipts, without a `combatGuardBroken` body-animation mapping. Ordinary HP damage uses the existing hurt clip, tint/recoil and shake; a fully guarded hit suppresses HP flinch/slash/shake (`src/ui/fx.js:1383`). These effects are not a new rear-view guard-break pose. A guard-break replacement must belong to the defending target, not the attacker playing Smash, and must give defeat precedence on a lethal break.

## Weapon-first coverage and gaps

The table describes the four-class alternative card stage, which currently wins in `playerSprite` (`src/ui/assets.js:773`). All four classes have the same eight reviewed weapon attack family keys in `src/content/playerAttackSprites.js:2`. Their class-specific appearance is supplied after family selection. The equipped-armament profile remains authoritative for action identity.

| Requested group | Current reviewed ordinary attack selection | Held stance / Smash / Counter coverage | Future art requirement |
| --- | --- | --- | --- |
| Sword and shield | `sword-shield`; a `straightSword`/`katana` plus a recognized shield | Class-only stances and special actions; shield-sourced attack does not borrow a sword swing | Show both equipped shapes, distinguish weapon strike, shield Smash and defense |
| Greatsword | `greatsword` for sole held greatsword | Class-only special actions | Two-hand load, believable weight and recovery |
| Staff | `staff-casting` for sole recognized focus or focus-sourced attack; magic routes can select it without a held staff | Broad class casting and Counter | Preserve the actual held staff/focus; distinguish physical staff contact and magical return |
| Bow | `bow` for `ranged` with `shortbow` and matching/absent source | Class-only special actions | Keep bow in body silhouette; no melee lunge for a shot; explicit defense/Smash grammar |
| Dagger | `single-dagger` for sole `dagger` | Class-only special actions | One short blade and a free hand |
| Dual daggers | `dual-daggers` for `dagger` + `parryDagger` | Class-only special actions | Two blades and readable crossing/parry direction |
| Single sword | `single-sword` for sole `straightSword`/`katana` | Class-only special actions | One sword and a free hand; distinguish from greatsword and sword/shield |
| Spear | No reviewed card-stage weapon family; `frostSpear` falls back to class-default action | No weapon-specific cells | Dedicated shaft, thrust/contact and recovery geometry |
| Halberd | No reviewed card-stage weapon family; `halberd` falls back to class-default action | No weapon-specific cells | Dedicated head, levered strike and rear silhouette; do not alias to spear |
| Unarmed | No reviewed card-stage weapon family; empty equipment falls back to class-default action | Class-default body can still paint its reference weapon | Explicit empty-hand art for every class and each supported family |

The resolver at `src/model/playerAttackSprites.js:17` excludes a source not currently equipped, recognizes an exact `dagger` + `parryDagger` pair, and does not normalize every possible same-group combination. A sole `parryDagger`, two generic daggers, or sword plus lantern is not proof of reviewed support. Armor pieces are filtered before this family count; other non-armor carried pieces can still affect its exact-combination match. Future selection should use actual active hands and grip from `gripOf` / `figureSpec`, not merely every non-armor equipped item (`src/model/loadout.js:2414`, `:2520`).

There is also a separate equipment-animation system (`src/model/equipmentAnimation.js:64`, `content/config/ui/presentation/equipmentAnimations.json`). It recognizes polearm IDs but has no authored default-outfit polearm binding. It does have per-class unarmed bindings, ordered hand/group matches and some generic Blade choreography borrowing. This does not fill the card-stage unarmed/polearm gaps: the card stage takes precedence and receives only the class, not the loadout. Its held frames are also loaded solely by class (`src/ui/alternativeCardStage.js:34`, `:51`). Nondefault armor identity is not an automatic match to default-outfit art.

## Minimal future integration after artwork selection

No step here is implemented by this exploration.

1. Keep a weapon-first concept inventory and stable option IDs. Record the selected concept, weapon group, action/defense mode, class appearance, rear orientation, bounds, anchor and source provenance. Ten shared concepts per weapon group per family precede class adaptations; do not generate a native-weapon-only set and claim ten-group coverage.
2. Add a weapon presentation resolver from the active ordered hands, grip and resolved card/source profile. Resolve choreography first, then class/outfit art. Pass this presentation identity to the card stage; currently its constructor receives only `classId`. Record an explicit unsupported cell rather than silently substituting an unrelated weapon or class.
3. For a dedicated held Smash, add the selected `smash` held frame and return `smash` for a confirmed physical Smash. Extend the corresponding held catalog and stage selection. Preserve existing spell-camp precedence. The simple class-only implementation would be small, but does not satisfy the requested ten-group art coverage; a weapon-specific Smash requires the resolver/catalog cells above.
4. Keep the existing Smash action route, replace its selected painted frames or add explicit weapon-scoped sequences, and preserve its contact/recovery/travel contract. Ordinary-attack weapon overrides currently cover only attack/spell/ranged/rangedMagic; extend them deliberately rather than assuming Smash will pick them up.
5. Add Counter variants from the resolved `counterMode` (not guessed from the enemy attack or its damage color), with matching held preparation and triggered-return art. Keep paid preparation separate from retaliation. Existing event grouping/beat ownership remains authoritative.
6. Add weapon-specific magic held art while preserving camp/source identity. Make energy-blade versus staff/casting eligibility explicit so an unarmed or bow loadout cannot inadvertently acquire a staff through a generic spell selector.
7. Add a finite rear-view guard-break reaction from the authoritative `combatGuardBroken` target receipt. Use the existing timeline/stage timing owner. Suppress a redundant ordinary hurt-body replacement only where the selected guard-break reaction is actually playing, without suppressing its damage number, sound, recoil contract or final defeat. Do not manufacture a new gameplay event from depleted UI bars.

## Deferred co-op observations

Current co-op local selection (`litCard`, `armedFriendlyCard`, upcast maps) lives in `src/ui/screens/coop.js:341`; there is no selection-preview command in the LAN switch (`tools/lan.mjs:239`). `playCard` is a real authoritative host action through `tools/session.mjs:900`. The host produces `receiptSeq`/events and per-observer enemy `intentPreviews` (`tools/session.mjs:815`); the UI reduces confirmed stance from `cardPlayed` once per receipt sequence and resets the named seat on its turn (`src/ui/screens/coop.js:398`). The body uses that seat's held ledger at `:1267`. It does not receive another device's uncommitted selection.

If the user reopens this feature later, a minimal preview should be a separate ephemeral per-seat presentation message/projection, never `cardPlayed`, engine `combatStance`, a save field, or a call to the authoritative play operation. Validate the connection's owned seat strictly, the current encounter/turn and hand instance, allow only needed presentation identity, clear on deselect/play/reject/turn/reset/disconnect, and reject stale sequences. Rate-limit redundant updates. Selected intent must not masquerade as confirmed defense or readiness. This is deferred design guidance, not a current work item or user decision request.

`tools/lan-state.mjs:11` is the existing per-device privacy boundary. It redacts enemy identity and filters reads/seat-priced previews to the connection's own seats before delivery. `stanceForPublicIntent` reads only the public broad stance (`src/model/alternativeStance.js:35`); it must never infer private enemy moves, targets, school, pending action or exact damage to choose more specific artwork. A new player-art family does not authorize a corresponding exact enemy-art reveal.

## Validation and practical risks for later implementation

- Identity: check effective `cardTags` override printed/base tags, physical elemental damage remains physical, Counter mode remains authored, and `sourceArmamentId` refers to a valid active hand. Exercise all ten groups across all four class appearances, both supported hand orders, grip changes, offhand combinations and armor cells.
- Receipt semantics: confirm selection/cancel/preparing/failed play never mutates the held ledger; a confirmed unclassified card clears stale stance; the actor's next turn resets only that actor; a new fight clears all presentation memory. Verify any selected-preview clear returns to the last confirmed pose, not an invented confirmed action.
- Reactions: Counter preparation cannot retaliate; actual returns must display the right defense mode. Guard break belongs to its target, fires once per root contact, and gives defeat precedence on lethal breaks. Preserve ordinary guarded/HP feedback, Poise/stagger order, and reaction choice/save/resume mechanics.
- Timing/render: preserve existing impact caps, forward/recovery travel, preload before first paint, hit-stop and skip settlement. The card canvas owns action and hurt clocks; adding another timeout to guess action completion creates a race. Slow rendering may sample over short phases, so validate recorded real gameplay as well as still contact sheets. Test Normal/Fast/Instant, reduced motion, reduce-flashes, paused preview, rendered stills and action restoration.
- Art: keep body and VFX separate, rear orientation consistent, anchors/bounds stable, sword/shield and polearm tips inside the intended composition, and transparent padding clean. Register both asset tiers and hashes in the proper manifests. A changed silhouette affects width/height fitting and overhead placement; compare phone and desktop battlefield layout at multiple UI scales.
- Privacy regression coverage remains relevant even while co-op work is paused; shared selectors must keep observer-public enemy stance restrictions. Any later network preview also needs owned-seat spoofing, stale message, cancel, reconnect/resync and cross-device private-read checks.

Useful existing focused suites for a later code change are `alternative-stances`, `alternative-selected-stances`, `alternative-card-animation`, `alternative-card-stage`, `player-attack-sprites`, `player-counter-sweep`, `combat-selected-action-intent`, `combat-held-kind-intent`, `battlefield-resting-stance`, `combat-counter-animation`, `combat-smash-counter-order`, `combat-reaction-feedback`, `combat-reactions`, `rear-combat-art`, `coop-intent-projection` and `lan-intent-privacy` under `tests/`. Several assert today's exact family counts/Smash offensive mapping; change those expectations only when the reviewed new contract deliberately changes them. Follow the repository's actual browser/build gates for implementation PRs, with fresh screenshots and a published preview.

Audit verification: inspected the live branch's source, read the relevant existing regression assertions, and used direct module imports to enumerate all four classes' sequences and reviewed weapon keys. No runtime tests or browser behavior are claimed as executed by this documentation-only audit.
