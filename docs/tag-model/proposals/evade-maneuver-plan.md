# maneuver:evade PR plan

**Status: plan, not started.** This PR starts after `feature/TagRefactor` reaches `dev`.
Every code citation below is on `origin/dev` (checked 2026-10-13). DECISIONS section 15
cites `combatMatchups.js` at lines 279, 346-347 and 399. Those numbers are from this
branch, not dev. The same logic on dev is at the lines in the table below.

Governing rulings: `docs/tag-model/DECISIONS.md` section 15 (rulings 1 to 10).
Feat proposal: `docs/tag-model/proposals/evade-cap-feats.md` (owner to pick).

## 1. What changes, in one line

Evade becomes its own live maneuver `maneuver:evade` (a stance, not a Defend variant).
It gives Evasion `evade.evasion`, a +3 Block per Evade, and keeps the reaction tag through
its `evade` payload. The 13 Evade-family cards move out of `maneuver:defend`. Seven of
them also leave the counter group.

## 2. Line map: DECISIONS (branch) to dev

| Concern | DECISIONS cites (branch) | Dev line | Dev code |
|---|---|---|---|
| Stance Block only for a defend stance | `combatMatchups.js:279` | `combatMatchups.js:307` | `startTacticalTurn`: `if (stance?.maneuver !== 'defend') return { block: 0, barrier: 0 }` |
| Smash vs defended stance | `combatMatchups.js:346` | `combatMatchups.js:374` | `stanceMultiplier`: `smash` and `stance.maneuver === 'defend'` |
| Sweep vs defended stance | `combatMatchups.js:347` | `combatMatchups.js:375` | `stanceMultiplier`: `sweep` and `stance.maneuver === 'defend'` |
| Smash status check on defended target | `combatMatchups.js:399` | `combatMatchups.js:431` | `previewTacticalAction`: `smash: ... target?.combatStance?.maneuver === 'defend'` |
| Trait guard armed by a Defend card | (not cited) | `combatMatchups.js:287` | `setCombatStance`: Impact/Flux only when `maneuver === 'defend'` (reaction rules v2) |
| Counter group (seven Evade cards) | `combatExpansionMartial.js:10` | `combatExpansionMartial.js:10` | `counter:` group |
| EVADES set | `combatExpansionMartial.js:30` | `combatExpansionMartial.js:30` | `const EVADES = new Set([...seven ids])` |
| Defend group (six non-counter Evade cards) | (not cited) | `combatExpansionMartial.js:7` | `defend:` group includes `smokePellet pocketSand smokeVeil vanish misdirect smokeBomb` |

Line 10 and line 30 are the same on the branch and on dev, so DECISIONS is correct for those two.

## 3. Data layers

### 3.1 Base tags (`content/source/tagging.csv`)

Change `maneuver:defend` to `maneuver:evade` on the thirteen Evade-family rows (dev lines):
`evasiveGuard` 2508, `dodgeRoll` 2510, `quickstep` 2519, `backstep` 2878,
`acrobaticsRogue` 2908, `shadowstep` 2915, `progression-nightstep` 3079, `vanish` 2897,
`smokeBomb` 2933, `misdirect` 2921, `smokePellet` 2873, `smokeVeil` 2890, `pocketSand` 2883.

The defend count on dev is 85 rows, so 13 leave it and 72 stay. Any test that counts
`maneuver:defend` must be updated in the same commit.

### 3.2 Tag node (`content/source/nodes.csv`)

Add `maneuver:evade` under `maneuver` (the row at `nodes.csv:452` is `maneuver:defend`).
Colour, glyph and `blurb` are owner art decisions. Add a `nodeTerms.csv` text row for the
tag. Regenerate the generated tag modules as DEVELOPER.md describes (`src/content/generated/tags.js`,
`tagging.js`, `nodeTerms`). Do not hand-edit generated files.

### 3.3 Overlay (`src/content/combatExpansionMartial.js`)

- Line 7 `defend:` group: remove the six non-counter Evade ids.
- Line 10 `counter:` group: remove `evasiveGuard dodgeRoll quickstep backstep acrobaticsRogue shadowstep progression-nightstep`.
- Add an `evade:` group with the same thirteen ids. The `groups` object feeds the overlay
  loop at lines 14-15, which turns each id into a `{ maneuver: 'evade' }` row.
- Line 30 `EVADES`: add the six non-counter ids, so all thirteen get `card.evade = { charges: 1, bonus: 0 }`.
  This keeps the reaction tag, because `traitProjection.js:48` already gives
  `reaction = true` for `def.evade != null` (ruling 2).
- The counter-role block (line 108 onward) runs only for `role.maneuver === 'counter'`.
  The counter coverage at 109-112 and `POISE_REPLIES` at 115 (evasiveGuard 2,
  backstep 3, acrobaticsRogue 3) are dropped for these cards (ruling 11).
- `combatExpansionMartial.js` line 89 has an exception for `dodgeRoll` and `evasiveGuard`
  on `equipmentRole`. Check it still holds once the role is `evade`.

### 3.4 Presentation and profile sets

| File (dev line) | Change |
|---|---|
| `src/model/combatCardProfile.js:6` | `MANEUVER` set: add `evade` |
| `src/model/combatTacticsRules.js:75` | `MANEUVERS` array: add `evade` (validation) |
| `src/model/playingCard.js:61` `combatCardType` | `Evade` label; falls through to `p.maneuver[0].toUpperCase()` so it reads `Evade` already, but add an explicit line for clarity |
| `src/model/alternativeStance.js:4,20-45` | `defensive` set keeps `defend`; add an `evade` stance family (ruling 11: its own family, not `defensive`) |
| `src/model/combatIntentVisibility.js:19` | enemy/visible intent: add `evade` (currently falls through) |
| `src/model/alternativeCardAnimation.js:5,15` | `CARD_ACTIONS` and the maneuver mapping: add `evade` |
| `src/model/combatPose.js:26` | rest pose list: add `evade` if an Evade pose exists |

## 4. Combat effects (`src/engine/combatMatchups.js`, dev lines)

- **307 (stance Block).** Evade stance gets no stance Block. Its 3 Block is an authored card
  effect (section 5), not a turn-start stance block. Keep the `defend` gate.
- **374-375 (multipliers).** Smash and Sweep multipliers stay on `defend` only. An Evade
  target no longer takes the defended multiplier or the sweep multiplier.
- **431 (smash status).** The smash status check reads `defend` on the target. An Evade
  target is no longer "defended" there.
- **287 (trait guard).** The Impact and Flux trait guard is armed only by `defend`. Evade
  gets no trait guard by default (ruling 9 keeps buckler traits separate). **Q8, open.**

`counterCoverageMatches` (`combatMatchups.js:347`) and `counterCovered` / `eligible` in
`src/engine/combatReactions.js:25-37` are the shared eligibility function. They stay as they
are. The combat-rounds session depends on them. An Evade card is eligible by its
`trait:reaction` tag and a positive contact (`eligible`, line 31-33), not by coverage.

## 5. Evasion formula and the +3 Block

### 5.1 Formula wiring

`evade.evasion` (`docs/tag-model/tables/formulas.csv`, proposed):

    [evade.baseEvade] * [evade.stacks] + min([dexterity], [evade.dexCap]) + [evade.stanceBonus] + [evasion.cardBonus] + [armor.evasionBase]

Engine pieces to add (one pure function, no DOM):

- `evade.baseEvade` = 3; `evade.stanceBonus` = 3 while the Evade stance is active (ruling 10).
- `evade.stacks`: Evade stacks in effect, with the owner's rules (ruling 11): each stack adds
  3 Evasion and 3 Block; each incoming attack roll consumes one stack (hit or miss, our reading,
  open item Q11); one stack decays at the start of each owner turn. Block gained stays. The
  engine state is a stack counter. Today's `entity.combatEvade.charges`
  (`combatMatchups.js:312`, `prepareCombatEvade`) is the nearest existing state; how it is stored
  is an engine detail, not an owner question.
- `evade.dexCap` = band cap + `floor(armourRank / evade.dexCap.rankStep)` + feat raises.
  - Band: weight class from `weightClassId` (`src/engine/skillXp.js:135`), band thresholds
    `src/content/prototypes/combatEquipment.js:9` (`loadBands`), selected in `src/model/equipmentCombatProfile.js:85`.
    Light and cloth 99, medium 5, heavy 2 (`values.csv`).
  - Rank: `armourSkillId(weightClassId)` (`src/model/skills.js:45`), level from the skill ledger.
    Rank step 3, rank 10 medium 8 and heavy 5.
  - Feat raises: a new `evadeDexCap` key on `src/content/skillFeats.js` and
    `src/content/classSkillFeats.js` entries, if the feats are picked (see the feat proposal).
    Per band cap raises stack to at most +2 (proposed).

Hit roll: `evade.evasion` is the defender's Evasion in the hit roll, `d20 + Accuracy >= 8 + Evasion`
(owner, ruling 11). That is the `hit.missChance` shape (`docs/tag-model/tables/formulas.csv:11`).
The `evadeRollPreview` option (`src/engine/combatAvoidance.js:41-48`) is removed and is not wired.
The `evasion.rating` formula does not change (ruling 6).

The Evade DEX term lives in `evade.evasion`. `combatRounds` has its own `dexCap` table
(`src/content/combatRounds.js:16`, `evasion-armor.csv`). That table is the rounds session's
and is not touched here.

### 5.2 The +3 Block per Evade

- Author it as a `block` effect of 3 on each Evade card (ruling 1), not as a stance block.
- **Ruling 11.** The +3 Block per stack adds to the card's own Block. Quickstep 5 + 3 = 8
  (`combatExpansionMartial.js:129-140` sets the primary Block to 5 today).
- **Ruling 11.** In the rounds preview the +3 Block gets the 1.8× scaling on cards with 2 or more SP.
  The scaling is the rounds session's rule; this PR only supplies the 3 Block.

## 6. Keep counterCovers shared

`counterCoverageMatches` and `counterCovered` (`combatReactions.js:25-27`) stay. Do not add
an Evade branch to them. Eligibility for an Evade card comes from `trait:reaction` (already set
through `def.evade`). No new function. A test pins that an Evade card with `trait:reaction` is
eligible through `eligible()` with no coverage check.

## 7. combatRounds stanceFor and COST-WEIGHTS (rounds session, not this PR)

These are not on `origin/dev`. They are on `origin/feature/AlternativeCombatRounds` and
`origin/feature/CombatRoundsPlayable`:

- `src/engine/combatRounds/stance.js:5` `KIND_STANCE` maps kind `evade` to stance `evade`.
  It is by kind, not by maneuver, so it is unaffected.
- `src/content/actionCosts.js:55-60` has `maneuver:defend` weight 0 SP. A `maneuver:evade`
  row (weight 0, side `sp`) is needed for cards that now carry `maneuver:evade`.
  `docs/alternative-combat-rounds/COST-WEIGHTS.md:161` lists the defend row and must list evade too.
  `tests/action-costs-weights-doc.test.mjs` fails if the two disagree.

Coordination: until the rounds branch merges, the evade cost row is missing. The rounds session
adds it. This PR does not edit those files.

## 8. Sigils

- `src/content/combatSigils.js:4` `ACTION_SIGILS`: add `evade`, with a monochrome mark and help
  text (`mark(label, shape, help, solid)`). The mark is an art decision.
- `cardSigilIdentity` (`combatSigils.js:28-29`) throws `Unknown primary card type` for an
  action with no mark. Once `combatCardType` returns `Evade`, the PR is broken unless
  `ACTION_SIGILS.evade` lands in the same commit. Land sections 3.4 and 8 together.
- `docs/tag-model/ART-LIST.md` may need a row for the new mark (check when the mark is drawn).

## 9. Save and co-op parity

- `src/engine/combatSnapshot.js:55-60` and `src/model/combatReactionState.js:27`: the
  accepted reaction versions are `[1, 2]`. Version 3 (ruling 11) is added there.
- `src/engine/combatSnapshot.js:245` `reactionRulesVersion` / `reactionRules` keys: keep `combatEvade`
  (charges, bonus, expiry) and any new Evade stance field in the snapshot, so a restored fight
  resolves the same way.
- `src/engine/coopCombat.js:95,105`: co-op creates combat from the same ruleset. The Evade
  change must read the same snapshot fields on both paths.
- `src/ui/screens/coop.js` reads `combatStance`; check the Evade stance renders.

**Reaction rules version 3 (ruling 11).** New expanded runs snapshot version 3, and the Evade
rules apply to them. Saved runs keep version 2 and keep the defend-stance behaviour through a
gate on `ctx.reactionRulesVersion === 2`. Without that gate, a saved mid-fight v2 run would
re-derive `maneuver:evade` from the card id at load and change its resolution.

## 10. SPEC and contract sections to update

- **SPEC §4.7** (tagged combat cards, readable enemy stances): add the Evade stance and its
  Evasion and Block numbers.
- **SPEC §4.8** (Martial and Spell expansion, version 2): the counter group and EVADES set
  change; the Evade cards move to the evade group.
- **SPEC §4.10** (defensive reaction choices): eligibility is unchanged. State that Evade
  reaction comes from `trait:reaction` through `def.evade`.
- **SPEC §4.11** (Combat Rounds Preview): note the evade stance row in `STANCE_GROUPS`
  (`combatRounds/resolver.js:534`) and that the rounds session owns the cost row.
- **`docs/combat-card-traits-contract.md`** (Reaction picks, line 250 onward): unchanged, since
  picks key on `def.evade`. Re-check the stance-advantage table.
- **`docs/tag-model/DECISIONS.md` section 15**: mark the PR as landed, and close the "Combat
  effects of the move" bullets.
- **`docs/tag-model/tables/formulas.csv`** `evade.evasion` and **`values.csv`**: status moves
  from proposed to shipped in the PR.

## 11. Tests

Add or change (dev file names):

- `tests/combat-matchups.test.mjs` and `tests/combat-matchups-live.test.mjs`: Evade target
  takes no defended smash or sweep multiplier (dev 374-375), and no smash status (dev 431).
  Stance Block is 0 for an Evade stance (dev 307).
- `tests/combat-expansion-martial.test.mjs`: the thirteen cards are `maneuver:evade`; the
  seven are gone from the counter group; the thirteen all carry `card.evade`.
- `tests/combat-expansion-tactics.test.mjs`: the evade payload and reaction tag (`traitProjection`).
- `tests/combat-reactions.test.mjs` and `tests/combat-reaction-rules-v2.test.mjs`: an Evade card
  is eligible through `trait:reaction` with no coverage check; a Counter still needs coverage.
- New `tests/combat-evade-evasion.test.mjs`: formula terms; cap per band (99, 5, 2); rank step
  (rank 3 gives +1, rank 10 gives medium 8 and heavy 5); stance bonus only while the stance is
  active; stacks; armour base only with an evasion tag; min(DEX, cap) with no -1.
- `tests/alternative-card-animation.test.mjs`: `evade` action.
- `docs/tag-model/tools/evasion.test.mjs`: the new formula rows and values parse.
- Save: `tests/combat-expansion-counter-save.test.mjs` pattern, with an Evade stance and
  charges round-trip.
- Co-op: `tests/coop-counter-fanout.test.mjs` pattern, with an Evade card on the co-op path.
- Sigils: `ACTION_SIGILS.evade` exists; `cardSigilIdentity('Evade', ...)` does not throw.

## 12. Step list (small commits)

1. Tags: `maneuver:evade` node, `nodeTerms` text, `tagging.csv` 13 rows. Regenerate. Tag-model check.
2. Overlay: move the 13 cards to the evade group; EVADES gains the six; POISE_REPLIES dropped (ruling 11).
3. Profile and presentation sets (section 3.4), plus `ACTION_SIGILS.evade` in the same commit.
4. Combat effects (section 4), with tests for 307, 374-375, 431 and 287.
5. Evade Block: authored +3 Block effect that adds to the card's Block (section 5.2, ruling 11).
6. Evasion formula: the pure function, cap by band, rank step, feat raises (the four approved feats).
7. Stacks: gain, the one-per-attack and one-per-turn decay, and the Evasion drop of 3 per stack lost (ruling 11), with tests.
8. Hit roll wiring: `evade.evasion` as the defender's Evasion in `d20 + Accuracy >= 8 + Evasion` (ruling 11), with tests.
9. Reaction rules version 3 for new runs; saved v2 runs keep defend-stance behaviour (ruling 11).
10. Save and co-op parity tests (section 9).
11. SPEC §4.7, §4.8, §4.10, §4.11 and the contracts; DECISIONS §15 status.
12. Regenerate generated modules and run the full suite.

Each step keeps `check.mjs` and compile lossless. The rounds files (section 7) are not edited here.

## 13. Owner questions

Answered on 2026-10-13 and recorded in DECISIONS §15 ruling 11; removed from this list:
the feat approval (old Q9), the +3 Block stacking and rounds scaling (old Q1, Q2), the Poise
reply (old Q3), the stance family (old Q4), the hit roll (old Q5), the stacks rules (old Q6),
and the reaction rules version (old Q7). Ids of the open items are kept.

- **Q8.** Do the Impact and Flux trait guards apply to Evade? (Default: no.)
- **Q10.** Confirm that Evade no longer takes the defended smash and sweep multipliers (dev 374-375) and the smash status check (dev 431).
- **Q11.** Does a miss also consume a stack? (Our reading, ruling 11: yes. "Use" means any incoming attack roll against you, hit or miss.)
