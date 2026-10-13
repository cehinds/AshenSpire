# Evade DEX cap feats (proposal, owner to pick)

**Status: proposal, owner to pick.** Nothing here is in game data. No row is added
to `content/source/nodes.csv`, `nodeTerms.csv`, `nodeVariables.csv`, `nodeEffects.json`,
`src/content/classSkillFeats.js` or `src/content/skillFeats.js`. Picking a feat means
the Evade PR adds it.

Context: DECISIONS section 15, ruling 4 (feats reduce the armour DEX penalty, which
raises the Evade DEX cap) and ruling 10 (owner tuning 2026-10-13). The cap is

    cap = bandCap + floor(armourRank / 3) + feat raises

with `bandCap` = 99 (light, cloth), 5 (medium), 2 (heavy) (`values.csv`,
`evade.dexCap.*`). Light and cloth are already uncapped, so no feat here touches them.

## Shape of the proposal

- **Four feats**, one per fitting track, so every class that wears medium or heavy
  has one.
- **Each raise is +1**, and the cap raises of one band stack to at most **+2** across
  the feats in a run (owner to confirm; see the balance notes).
- **Two are class feats** (`classSkillFeats.js`, offered at class-level milestones from
  `balance.js:190` cadence `feat: [1,4,8,12,16,20]`). **Two are armour-track skill
  feats** (`skillFeats.js`, offered every 2nd track level, `balance.js:504`
  `skill.featEvery: 2`).
- **Text style.** Each feat is a `feat:*` node in the `classification.feat` family
  (`nodes.csv:378`, e.g. `feat:coal-on-steel` at `nodes.csv:379`). Its player text is a
  `nodeTerms.csv` row with `{tokens}` filled from `nodeVariables.csv`
  (e.g. `nodeTerms.csv:119`, `nodeVariables.csv:156`). The `capRaise` variable is the
  token. A class or skill feat's effect is a `passive`-style row like
  `classSkillFeats.js` or `skillFeats.js`, with a new `evadeDexCap` key that the
  Evade cap reads.

## The four feats

### 1. Weight Shifted (class feat, Reaver)

- **Id:** progression `reaverWeightShifted` (`classSkillFeats.js`); tag `feat:weight-shifted`.
- **Tree / class fit:** `class:reaver`. Reaver is `armour:heavy` (`balance.js:193`).
- **Text:** "While you wear heavy armour, your Evade DEX cap rises by +{capRaise}."
- **Cap raise:** +1, heavy band only (2 becomes 3 at rank 0).
- **Prerequisite:** Reaver class level 8 (the third feat milestone, `balance.js:190`).
  No armour rank needed.
- **Balance note:** Heavy evades pay no Evade XP (`skillXp.js:195-204` pays light in full,
  medium at half, heavy nothing on evasion; heavy XP comes from impact absorbed,
  `impactPerXp: 5`). Heavy rank is therefore slow to raise. The feat is a flat +1
  that does not depend on the armour track. Feat value is 1 Evade evasion point,
  while Evade stacks give 3 each (`evade.baseEvade`).

### 2. Light on the Stones (class feat, Herald)

- **Id:** progression `heraldLightOnStones`; tag `feat:light-on-the-stones`.
- **Tree / class fit:** `class:herald`. Herald is `armour:medium` (`balance.js:193`).
- **Text:** "While you wear medium armour, your Evade DEX cap rises by +{capRaise}."
- **Cap raise:** +1, medium band only (5 becomes 6).
- **Prerequisite:** Herald class level 4 (the second feat milestone).
- **Balance note:** Offered early, so a Herald can have the medium raise before
  any armour rank. A Herald can also take Steady Fit (Feat 3), which stacks +2 on
  medium (the per-band ceiling). This is the medium counterpart of Feat 1.

### 3. Steady Fit (armour-track skill feat, medium)

- **Id:** skill feat `armourSteadyFit` (`skillFeats.js`, `skillId: 'armour:medium'`);
  tag `feat:steady-fit`.
- **Tree / class fit:** `armour:medium`, any class that trains medium armour
  (Starseer and Herald, `balance.js:193`).
- **Text:** "While you wear medium armour, your Evade DEX cap rises by +{capRaise}."
- **Cap raise:** +1, medium band only.
- **Prerequisite:** `armour:medium` rank 4 (`minLevel: 4`, the second skill-feat slot
  at `featEvery: 2`).
- **Balance note:** Medium evades pay half (`skillXp.js:199-200`), so rank 4 is
  slow to reach: rank 3 is about 700 armour XP and rank 4 about 1,495, which is about
  600 medium evades at 2.5 XP each. The feat is therefore a mid-run reward, not
  an early one. With Feat 2 a Herald can hold +2 on medium, the ceiling.

### 4. Heavy Hold (armour-track skill feat, heavy)

- **Id:** skill feat `armourHeavyHold` (`skillFeats.js`, `skillId: 'armour:heavy'`);
  tag `feat:heavy-hold`.
- **Tree / class fit:** `armour:heavy`, any class that trains heavy armour (Reaver).
- **Text:** "While you wear heavy armour, your Evade DEX cap rises by +{capRaise}."
- **Cap raise:** +1, heavy band only.
- **Prerequisite:** `armour:heavy` rank 4 (`minLevel: 4`).
- **Balance note:** Heavy rank 4 needs roughly 1,495 armour XP from impact absorbed
  (`impactPerXp: 5`, so about 7,500 impact). That is a long way. The feat matters
  most for a Reaver who has already reached rank 4. Feat 1 and Feat 4 together give
  Reaver +2 on heavy, the ceiling.

## Balance against the rank curve

- **Rank step.** The armour rank gives +1 cap at ranks 3, 6 and 9 (`floor(rank / 3)`).
  The XP curve (`balance.js:440`, `skill.xp`: base 100, growth 1.995, roundTo 5,
  maxLevel 10) gives approximate cumulative armour XP of about 700 to reach rank 3, about
  6,240 for rank 6, about 50,200 for rank 9 and about 100,240 for rank 10. These are
  computed from the curve by hand; check them with `xpToNext` before the PR.
- **Feat equals the first step.** A +1 feat is the same as reaching rank 3, and it
  is available at class level 4 or 8, or at armour rank 4. It sits at the early end of
  the rank curve, where most runs will be.
- **Cap binds only below DEX.** `min(DEX, cap)` means a cap raise adds evasion
  only while DEX is above the cap. Creation DEX is 10 to 15 (`attributes.js`), which is
  above the base medium and heavy caps and most rank-raised caps, so the raise usually
  counts. Light is uncapped, so Rogue gets no cap feat (intended by ruling 6; owner to
  confirm).
- **Per-band ceiling of +2.** With +2 from feats, medium reaches 5 + 2 + 3 = 10 at rank 10,
  and heavy reaches 2 + 2 + 3 = 7 at rank 10 (the owner's rank-10 heavy is 5 with no
  feats, so the feats add 2 on top). Owner to confirm the +2 ceiling or pick a lower one.

## Owner to pick

- Which of the four feats enter the game (any subset). Each is one row in its table
  plus its `nodeTerms` text and `capRaise` variable.
- Whether the per-band ceiling is +2 (proposed), +1, or uncapped (feats stack).
- Whether Rogue gets a feat for the light band (proposed: no, light is uncapped).
- The +1 raise amount (proposed) against +2 for a capstone.
