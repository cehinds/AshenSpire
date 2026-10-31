# Tag effects checklist (per stack)

Owner ask, 2026-10-31: a checkbox list of every tag and its effects, plus effects that could be added, per stack.
Design only. Nothing here is built by this file. Sources read-only; line numbers are from `origin/dev` at 53a98a1cc0.

## How to read

- `[x]` an effect that exists today. Cites `file:line` of the rule; says whether it is per stack.
- `[ ]` a proposal that fits the tag's fantasy and the existing systems. One line, one number.
- `(locked)` the proposal touches a locked file (`engine/kernel|runtime|contracts|mechanics`, `src/model/formulas.js`, `mechanicsKernel.js`, `fixCoreMechanics.*`). Needs an owner-approved lock change.
- `(in progress, PR #)` landing now on a named branch. `(merged)` is on dev.
- **Per stack** means: the number is multiplied by the status's current stacks (the badge number). A flat effect says "flat".
- Systems used: Poise (break meter), Block (physical soak), Barrier (magic soak), Ward (rating, off in Core 2), statuses, contests (d20 + attrs vs DC), weaknesses, Precision/Evasion (d20 + Precision vs Evasion), SP/MP.
- Status files: `S:` = `content/source/statuses.json`, `G:` = `src/content/combatStatusRules.js`, `P:` = `games/ashenspire/packs/base-cards/statuses.json`, `M:` = `content/source/combatExpansionMatchups.json`, `R:` = `src/content/combatRules.js`.
- Core 2 rules (SPEC §17, `content/source/fixCoreMechanics.json`) override legacy numbers where they differ; where a status is Core-only the entry says so.

## 1. Statuses (stacked badges)

### Precision (stacks decay)
- [x] per stack: +1 Accuracy (S:3, `precision`, no decay). Core 2: Precision = 1 + floor(...) x (stacks + 1) (SPEC §17 :3347).
- [x] flat: `trait:persistent` keeps granted Precision past turn end (nodes.csv:495).
- [x] flat: the `precision` card tag gives guard bypass 4 in expanded combat (M:231); Core 2 removes it (combatMatchups.js:112).
- [ ] per stack: decays 1 at owner turn start (Core 2 note: decay already in SPEC :3347; make it visible on the badge) (locked)
- [ ] per stack: +2% crit chance, cap 20%
- [ ] per stack: ignore 1 point of target Evade stacks per hit, cap 3
- [ ] at 5+ stacks: next hit cannot be Evaded, consumes all stacks

### Evade
- [x] per stack: +3 Evasion; lose 1 stack at round start (S:11). Core 2: Evasion = 1 + DEX + stacks x (1 + DEX) (SPEC :3347).
- [x] per stack: a miss still consumes one stack (SPEC :3347).
- [x] flat: `base.evade` pack status, 25% to avoid a whole action per stack consumed (P:base.evade).
- [ ] per stack: +1 Precision on your next attack (dodging opens a gap)
- [ ] per stack: first stack spent per turn refunds 1 SP

### Counter (stacked badge) (proposal, owner request)
- [x] flat: Counter stance halves one eligible incoming hit and returns a reply once per cycle (M:3, combatMatchups.js:618-698; Core 2 SPEC :3353).
- [x] flat: `base.auto-counter` returns 6 physical on a connected Melee/Reach hit per stack consumed (P:159).
- [ ] per stack: return 10% of incoming damage to the attacker, added to the card's base reply
- [ ] auto-counter in stance: pay 1 SP to counter a hit while a Counter stance stands, no card in hand needed
- [ ] per stack: +1 Poise damage on the reply
- [ ] stacks cap at 5; one stack spent per returned hit

### Reflect (proposal, owner request)
- [x] flat: `base.reflect` returns half of actual HP damage from direct hits, never reflects again (P:175-180).
- [x] flat: `trait:unreflectable` hits skip reflection (combatMatchups.js:691).
- [ ] per stack: take 30% less incoming damage
- [ ] per stack: reflect 30% of incoming damage to the attacker, cap 90% at 3 stacks
- [ ] lose 1 stack when a hit is reflected (not per turn)

### Block (resource, not a status)
- [x] per point: soaks physical damage first, then magic part in Core 2 (SPEC :3339).
- [x] flat: expires at turn start unless Unbreakable/Stoneskin (S:1317 stoneskin, `unbreakable`).
- [x] per stack: `base.persistent-block` replenishes Block up to stacks at turn start (P:15).
- [x] per stack: Dexterity +1 Block per card (S:31); Frail -25% Block gained (S:66, flat).
- [ ] per 5 Block: +1 Poise guard when a hit is fully absorbed
- [ ] per 10 Block held at turn end: +1 Evade stack

### Barrier / Ward
- [x] per stack: `base.persistent-barrier` replenishes Barrier up to stacks at turn start (P:23).
- [x] flat: Barrier soaks the magic part of a hit after Block (SPEC :3339); Ward is a rating, off in Core 2 (SPEC :3339).
- [x] flat: Force hit strips 2 Ward once per action (nodes.csv:122).
- [ ] per point: Barrier absorbs 1 magic damage and 1 status build-up
- [ ] per 4 Barrier: -1 build-up pressure from each spell hit

### Weak
- [x] flat: -25% attack damage; added stacks extend duration, not potency (S:42, SPEC :3339).
- [x] per stack: legacy tooltip, 1 stack expires each turn (S:42). Gauge: 6/4 threshold, cap 3 (G:23).
- [ ] per stack: -1 Precision for the afflicted

### Vulnerable
- [x] flat: +25% incoming attack damage; stacks extend duration (S:54, SPEC :3339). Gauge G:24.
- [ ] per stack: the afflicted's Block gain is reduced by 1

### Frail
- [x] flat: -25% Block from cards, 1 stack expires per turn (S:66).
- [ ] per stack: -1 Poise guard gained per defensive card

### Strength / Dexterity
- [x] per stack: Strength +1 attack damage (S:19). Dexterity +1 Block per card (S:31).
- [ ] per Strength: +1% Poise damage dealt

### Bleed / Bleeding
- [x] build-up: threshold burst for a % of max HP, ignoring Block (S:78; G:13 threshold 7/7, cap 3).
- [x] per stack: Bleeding loses 1 HP per stack at turn start (G:39).
- [x] flat: Sanguine Pact gains 2 Strength per stack on a Bleed burst (S: `sanguinePact`).
- [ ] per stack: Bleeding also reduces the target's Block gain by 1

### Burn
- [x] per stack: lose HP equal to stacks at turn start, 1 stack burns out per turn (S:304; G:16).
- [x] flat: Fire thaws Frozen/Chilled (G:41 tooltip).
- [ ] per stack: -1 Frost build-up resistance
- [ ] per stack: the target's Block takes 1 extra damage at turn start

### Frost / Frozen / Chilled
- [x] build-up: Frost gauge fills to Frozen; Frozen denies 1 Action per stack (G:15, G:40).
- [x] flat: Chilled makes the next Blunt hit +25% (G:41, R: `chilledBluntPercent`).
- [x] flat: Blunt shatters Frozen (G:40 tooltip).
- [ ] per stack of Frozen: -1 Evasion
- [ ] per stack of Chilled: -1 SP regained at turn start, cap 1

### Venom (Poisoned)
- [x] per stack: lose HP equal to stacks at turn start, 1 stack expires per turn (S:1104; G:14).
- [x] per stack: Envenom adds 1 Venom per attack hit (S:1230).
- [ ] per stack: heals received by the afflicted reduced 10%
- [ ] per 5 stacks: afflicted loses 1 SP at turn start

### Crimson Blight / Necrotic Blight
- [x] per stack: lose HP equal to stacks at turn start, ignores Block (S:251, S:279). Crimson expires after 3 turns (S:251); Necrotic lasts the fight (S:279; G:19 no recovery).
- [x] flat: Harbinger of Blight heals 1 HP per stack on application (S: `harbingerOfBlight`).
- [ ] per stack: -2% max Barrier

### Paralysis / Sleep / Dazed (locks)
- [x] per stack: locks cards, Counter and card Evade; Break costs 3/2/1 SP per stack (G:43-45 tooltips, G:20-22).
- [x] per stack: Sleep +10% direct damage received (G:29).
- [x] flat: Grounded grants Advantage on Paralysis recovery (G:47).
- [ ] per stack of Paralysis: -1 SP at turn start
- [ ] per stack of Sleep: heal 1 HP at turn start (cap 6, G:29)

### Confused / Slowed / Entombed / Off Balance
- [x] Confused: -10% damage dealt; 50% chance per turn of 3 Poise damage per stack (G:53).
- [x] Slowed: -10% damage dealt, -25% Block gained (G:58).
- [x] Entombed: skips next turn, takes 25% less damage (G:61).
- [x] Off Balance: disadvantage on bodily recovery; 1 stack expires per turn (G:45 row).
- [ ] per stack of Slowed: -1 SP at turn start
- [ ] per stack of Confused: 10% chance the afflicted attacks a random target

### Prone / Staggered / Invulnerability / Decoy / Concealed
- [x] Prone: +25% Contact damage taken, -25% Single Near/Far, +2/+4 Evade vs Near/Far (G:30, G:46).
- [x] Staggered: skip next turn, +50% attack damage taken until your next turn end (S:398; SPEC :1057).
- [x] per stack: Invulnerability / Decoy consume 1 stack to avoid one direct action (G:48-49).
- [ ] per stack of Decoy: +1 Evasion until consumed

### Regen / Stoneskin / Unbreakable
- [x] per stack: Regen heals HP equal to stacks at turn start (S:330).
- [x] flat: Stoneskin keeps Block through next turn start (S:1317). Unbreakable caps Block at 30/40 (S: `unbreakable`).
- [ ] per stack of Regen: also restores 1 Poise at turn start

### Guilt, Madness, Insanity (build-ups)
- [x] Insanity: build-up burst, Poise damage, resist status (S:137). Madness: lose 2 HP, gain 1 Energy per stack (S: `madness`).
- [ ] Guilt: no rule in the status files read; define before listing (proposal: per stack, +1 damage taken from Sacred)

### Silenced / Magic Vulnerable (enemy)
- [x] per stack: spells cost 1 more Stamina; Force hits stop and remove 1 stack (S:1303).
- [x] flat: Magic-school HP damage increased while active, 2 turns (S:1277).
- [ ] per stack of Silenced: -10% spell damage dealt

### Stacked badges added today
#### Shocked (proposal, owner request; contest piece depends on `contest:` below)
- [ ] on hit by Lightning: contest 1d20 + stacks x (INT + WIS + rank) vs DC Poise + STR + DEX + CON + level; success applies Shocked
- [ ] per stack: -1 Precision for the afflicted
- [ ] per stack: 5% chance the afflicted loses 1 SP at turn start
- [ ] per stack: +1 Paralysis build-up taken
- [ ] Damp gives the Shocked roll advantage; Grounded blocks it (G:47)
- [ ] 1 stack expires per turn

#### Damp (proposal, owner asked for a sensible definition)
- [ ] per stack: -1 Evasion (wet, slow)
- [ ] per stack: +1 Lightning stack taken, Shocked contest gets advantage
- [ ] per stack: Frost deals +1 damage
- [ ] per stack: Burn deals -1 damage per tick
- [ ] Fire hit removes all Damp (steam); 1 stack expires per turn

#### Earth stacks (needs a better name; "rock badge"; candidates: Stoneward, Ballast, Bedrock)
- [ ] per stack: absorb 1 Lightning stack that would be applied (Grounded-like)
- [ ] per stack: +1 Block at turn start
- [ ] per stack: -1 Evasion (heavy)
- [ ] per stack: +1 Poise guard when Poise is hit by Blunt
- [ ] decays 1 per turn; Earth hit by the owner refreshes 1 stack

#### Counter and Reflect stacks
- see Counter and Reflect above.

#### Insight contest `contest: mental|physical` (in progress, PR # feature/InsightContest)
- [x] on that branch: card never rolls Accuracy or range; caster rolls d20 + attrs + rank vs DC = target's current Poise + target attrs + level; tie succeeds (feature/InsightContest SPEC §17 Contests; `src/engine/contest.js`).
- [ ] per stack of Foresight: +1 to the next insight contest roll (locked: `content/framework/mechanics.json` contest constants)

#### Enemy weaknesses (in progress, PR # feature/EnemyWeaknesses)
- [x] branch adds enemy weakness tests and enables the Fire element in Core for Elemental Weapon (feature/EnemyWeaknesses, `tests/enemy-weaknesses.test.mjs`).
- [ ] per hit of the weak type on one target in one turn: +5% damage, cap +25% (locked if in formulas.js)
