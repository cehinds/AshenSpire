# Martial card proposal: 30 new combat cards (2026-11-19)

Proposal only. No game content changed. Owner ask: about 30 more martial combat cards, mixed rarity, using under-used tags, with cost, tags, effects, damage, rarity, stance and damage type. Coordinator rule added: most buff cards carry a drawback before upgrade.

## Survey (sources)

- **Martial classes:** Reaver (greatsword or sword and round shield) and Rogue (dagger and buckler, or shortbow and parry dagger): `content/source/classes.json`, `startingKits.csv`. Herald and Starseer are casters and are not covered. Weapon families: `content/source/weapons.csv` (sword, greatsword, dagger, bow, katana, halberd, warhammer, twinblade, battleaxe, shields, spear, torch, staves) plus the approved new types (mace, whip, crossbow, claws) in `docs/balance/owner-ruling-2026-11-18.md` section 18.
- **Existing martial cards (not duplicated):** `content/source/cards/reaverCards.json` (55), `rogueCards.json` (55), `colorlessCards.json`, `armamentCards.json`. Already crowded: Bleed attacks (Goreslash, Rend, Serrated Blade, Garrote, Impale), Prepared setup (Rogue), Vulnerable smashes (Ironbreaker, Skullsplitter), Evade or Retreat movers (Backstep, Dodge Roll, Shadowstep), plain Block. Nothing existing uses Thorns, Pierce stacks, Force on a martial card, Retain on Block, Reaction on a Defend, free Advance or Retreat-removal on a sweep.
- **Tags and rules:** `src/ui/components/cardTagSymbols.js` (rail symbols), `docs/alternative-combat-rounds/COST-WEIGHTS.md` (tag and status weights), `content/source/keywords.json` (exhaust, ethereal, innate, retain, unplayable), `statuses.json` (67 statuses; `retreat`, `evade`, `bleed`, `burn`, `venom`, `weak`, `vulnerable`, `frail`, `strength` exist), rulings sections 3, 16, 17, 20 to 23.
- **Stances and triangle:** `content/source/stances.json` (Reaver gorefire, bulwark, brace), `docs/STANCE-COMBAT-RULES.md`. Smash x1.5 against Defense and Spell; Counter x1.5 against Attack and Smash; Sweep x2 against Counter; Evade stacks defeat Attack until they run out.
- **Damage types:** physical slashing, piercing, blunt; poison on physical cards; elements fire, frost, lightning, arcane, sacred, decay, psychic, earth. Force is a physical-routing tag (Block, then half Poise, half HP; ruling section 20).
- **Rarity ladder:** `CARD_RARITIES` in `src/model/schemas.js`: starter, common, uncommon, rare, special. SPEC 2200 says no legendary rarity exists. Core counts by class (Reaver 17 common / 18 uncommon / 13 rare; Rogue 22 / 16 / 13 plus 2 special). So "top rarity" is **special**, which is not in reward rolls today (see Risks).
- **Budget:** `node tools/card-budget-report.mjs` (on `origin/chore/RetreatReachRules`; dev lacks it) runs. It measures final face values per cost; it does not score a card against a rarity target. The target curve is ruling section 2 (cost 1: 5 to 8, cost 2: 15 to 20, cost 3: 25 to 30; Smash about +50% Poise at +1 SP; Sweep about -30% damage). The shipped numbers (Strike 5, Smash 5 at 2 SP) are still pre-retune, so all numbers below are on the section 2 curve (face value at level 1, neutral stance).

## Budget method (my assumption, stated so it can be challenged)

1 cp = 1 face damage = 1 Block. Component prices: Poise damage 0.5 cp; status or stack (Bleed, Burn, Venom, Weak, Vulnerable, Evade, Counter, Pierce, Retreat, Strength, Advance, Pull) 2 cp each (COST-WEIGHTS `statusWeight`); Thorns stack 3 cp (it never decays, ruling 16); Force, Retain, Reach chip 1 cp (COST-WEIGHTS chip weights, Reach sources that come from the weapon are not charged again); Sweep damage per target counts /0.7. Drawbacks subtract: Exhaust -3, Escalating -3, Ethereal -2, self Vulnerable/Weak stack -2, self Frail stack -2, Wound or Dazed to discard -2, discard 1 card -1.5, enemy gains Strength -2. Target by cost: 0 SP: 4, 1 SP: 6.5, 2 SP: 17.5, 3 SP: 27.5 (section 2 midpoints). Smash target is 1.75 x the curve of one SP less (same damage, +1 SP, +50% Poise). Rarity multiplier on the target: common 1.0, uncommon 1.1, rare 1.2, special 1.35. Upgraded card must sit between its base budget and 1.25 x target. A card passes at +/-1 cp of target. Re-check every row with `card-budget-report.mjs` after the retune lands; the cp sums here are hand arithmetic, not tool output.

## The 30 cards

Rarity spread: 12 common, 10 uncommon, 6 rare, 2 special. Class spread: Reaver 10, Rogue 10, weapon-type colorless 10. Maneuvers: Attack 12, Defend 6 (one a no-stance skill), Counter 4, Sweep 4, Smash 3, Evade 1. All MP 0 (martial). Tag status: Thorns, Pierce stacks, Multi-hit, Escalating are approved in the 2026-11-18 rulings but not built; see New mechanics.

| # | Name | Class / weapon | Rarity | Cost (SP/MP) | Stance / maneuver | Tags | Damage (base / upgraded) | Damage type | Effect text | Drawback | Upgrade (what changes) | Budget (cp vs target; upgraded) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Reaching Thrust | Colorless / spear | common | 1/0 | Attack | Pierce 2, Reach | 3 / 4 | piercing | Deal 3. Pierce 2 (ignores 2 Block). | - | +1 damage | 7 vs 6.5; up 8 vs <= 8.1 |
| 2 | Hooked Pull | Colorless / whip | common | 1/0 | Attack | Reach, Pull (remove Retreat) | 4 / 5 | slashing | Deal 4. Remove 1 Retreat from the target. | - | +1 damage | 6 vs 6.5; up 7 vs <= 8.1 |
| 3 | Spiked Guard | Reaver / spiked shield | common | 1/0 | Defend | Thorns 1 | - (Block 6 / 5) | piercing (Thorns) | Gain 6 Block and 1 Thorns. You gain 1 Vulnerable. | Self Vulnerable 1 | Drops the Vulnerable; Block 5 | 7 vs 6.5; up 8 vs <= 8.1 |
| 4 | Riposte Step | Rogue / rapier | common | 1/0 | Counter | Counter 2, Reaction, Ethereal | - (Block 4 / 4) | piercing (return) | Gain 4 Block and 2 Counter. Ethereal. | Ethereal | Loses Ethereal | 6 vs 6.5; up 8 vs <= 8.1 |
| 5 | Slip the Blow | Rogue / leathers | common | 1/0 | Evade | Evade 3 | - (Block 3 / 5) | - | Gain 3 Block and 3 Evade. Exhaust. | Exhaust | Block 5 | 6 vs 6.5; up 8 vs <= 8.1 |
| 6 | Shoulder Charge | Reaver / plate | common | 1/0 | Attack | Force, Poise damage | 4 / 5 | blunt + Force | Deal 4 Force damage and 3 Poise damage. | - | +1 damage | 6.5 vs 6.5; up 7.5 vs <= 8.1 |
| 7 | Charging Pommel | Reaver / sword | common | 2/0 | Smash | Poise damage, free Advance | 5 / 6 | blunt | Deal 5 damage and 8 Poise damage. Advance 1 for free. | - | +1 damage, +2 Poise | 11 vs 11.4; up 13 vs <= 14.2 |
| 8 | Hooking Sweep | Colorless / halberd | common | 1/0 | Sweep | Reach, Pull all | 3 / 4 each | slashing | Deal 3 to all enemies. Remove 1 Retreat from each. | - | +1 damage | 6.3 vs 6.5; up 7.7 vs <= 8.1 |
| 9 | Needle Flurry | Rogue / dagger | common | 0/0 | Attack | Multi-hit 1, Venom | 2x2 / 3x2 | piercing + poison | Deal 2 damage twice and apply 1 Venom. Escalating. | Escalating | +1 damage per hit | 3 vs 4; up 5 vs <= 5 |
| 10 | Kiting Shot | Rogue / shortbow | common | 1/0 | Attack | Reach, Retreat (inflict), Escalating | 7 / 8 | piercing | Deal 7. Inflict 1 Retreat. Escalating. | Escalating | +1 damage | 6 vs 6.5; up 7 vs <= 8.1 |
| 11 | Torch Swipe | Reaver / torch | common | 1/0 | Attack | Burn | 5 / 6 | fire | Deal 5. Apply 1 Burn. | - | +1 damage | 7 vs 6.5; up 8 vs <= 8.1 |
| 12 | Shield Rim Shock | Reaver / round shield | common | 1/0 | Defend | Force, Retain, Reaction | 2 / 2 (Block 3 / 4) | blunt + Force | Gain 3 Block. Deal 2 Force damage. Retain. | - | +1 Block | 7 vs 6.5; up 8 vs <= 8.1 |
| 13 | Halberd Cartwheel | Colorless / halberd | uncommon | 2/0 | Sweep | Reach, Poise damage, Weak | 9 / 10 each | slashing | Deal 9 and 3 Poise damage to all enemies. Apply 1 Weak to all. | - | +1 damage, +2 Poise damage | 18.4 vs 19.2; up 20.8 vs <= 24 |
| 14 | Bristling Bulwark | Reaver / plate | uncommon | 2/0 | Defend | Thorns 2, Exhaust | - (Block 14 / 16) | piercing (Thorns) | Gain 14 Block and 2 Thorns. Exhaust. | Exhaust | Block 16; loses Exhaust | 17 vs 19.2; up 22 vs <= 24 |
| 15 | Fencer's Poise | Rogue / rapier | uncommon | 1/0 | Counter | Counter 2, Evade 1 | - (Block 3 / 3) | piercing (return) | Gain 3 Block, 2 Counter and 1 Evade. Add a Wound to your discard pile. | Wound added to discard | Evade 2 | 7 vs 7.2; up 9 vs <= 9 |
| 16 | Crushing Rebuke | Colorless / mace | uncommon | 1/0 | Attack | Pierce 3 | 3 / 4 | blunt | Deal 3. Pierce 3. You gain 1 Weak. | Self Weak 1 | +1 damage | 7 vs 7.2; up 8 vs <= 9 |
| 17 | Keep Them Out | Colorless / spear | uncommon | 1/0 | Attack | Reach, Pierce 1, Retreat (inflict), Exhaust | 6 / 7 | piercing | Deal 6. Pierce 1. Inflict 1 Retreat. Exhaust. | Exhaust | +1 damage | 7 vs 7.2; up 8 vs <= 9 |
| 18 | Skull Cracker | Colorless / warhammer | uncommon | 2/0 | Smash | Poise damage | 7 / 8 | blunt | Deal 7 damage and 11 Poise damage. | - | +1 damage, +3 Poise | 12.5 vs 12.5; up 15 vs <= 15.6 |
| 19 | Duck and Lunge | Rogue / dagger | uncommon | 1/0 | Attack | Evade 1, free Advance | 4 / 5 | piercing | Deal 4. Gain 1 Evade. Advance 1 for free. Discard 1 card. | Discard 1 | +1 damage | 6.5 vs 7.2; up 7.5 vs <= 9 |
| 20 | Whirling Twin Slash | Rogue / twinblade | uncommon | 1/0 | Sweep | Multi-hit 1 | 3x2 / 4x2 each | slashing | Deal 3 twice to all enemies. Add a Dazed to your discard pile. | Dazed added to discard | +1 damage per hit | 6.6 vs 7.2; up 9.4 vs <= 9 |
| 21 | Iaijutsu Reply | Colorless / katana | uncommon | 1/0 | Counter | Counter, Reaction, Ethereal | 7 / 8 (Block 2) | slashing | Reaction. Gain 2 Block. Counter return deals 7. Ethereal. | Ethereal | +1 damage; loses Ethereal | 7 vs 7.2; up 10 vs <= 9 |
| 22 | Drive Forward | Reaver / any weapon | uncommon | 0/0 | Skill (no stance) | Advance 2 (free), Strength | - | - | Advance 2 for free. Gain 1 Strength. Every enemy gains 1 Strength. | Each enemy gains Strength 1 | Enemies no longer gain Strength | 4 vs 4.4; up 6 vs <= 5.5 |
| 23 | Greatsword Cleaver | Colorless / greatsword | rare | 3/0 | Smash | Poise damage, Vulnerable, Weak | 18 / 21 | slashing | Deal 18 damage and 26 Poise damage. Apply 2 Vulnerable and 1 Weak. | - | +3 damage, +4 Poise | 37 vs 36.8; up 42 vs <= 46 |
| 24 | Pin Down | Rogue / shortbow | rare | 2/0 | Attack | Reach, Pierce 3, Retreat (inflict) 2, Exhaust | 14 / 16 | piercing | Deal 14. Pierce 3. Inflict 2 Retreat. Exhaust. | Exhaust | +2 damage | 21 vs 21; up 23 vs <= 26.2 |
| 25 | Iron Bastion | Reaver / plate | rare | 2/0 | Defend | Thorns 3, Exhaust, Retain | - (Block 15 / 15) | piercing (Thorns) | Gain 15 Block and 3 Thorns. Exhaust. | Exhaust | Loses Exhaust; gains Retain | 21 vs 21; up 25 vs <= 26.2 |
| 26 | Mirror Riposte | Rogue / rapier | rare | 2/0 | Counter | Counter 4, Evade 3, Reaction, Escalating | - (Block 10 / 12) | piercing (return) | Reaction. Gain 10 Block, 4 Counter and 3 Evade. Escalating. | Escalating | Block 12 | 21 vs 21; up 23 vs <= 26.2 |
| 27 | Thousand Petals | Rogue / twinblade | rare | 2/0 | Sweep | Multi-hit 2, Bleed | 4x3 / 5x3 each | slashing | Deal 4 three times to all enemies. Apply 2 Bleed to all. | - | +1 damage per hit | 21.1 vs 21; up 25.4 vs <= 26.2 |
| 28 | Relentless Cadence | Reaver / sword | rare | 1/0 | Attack | Combo (turnMetric), refund | 4 / 5 | slashing | Deal 4. If you already played a Smash or Sweep this turn: deal 4 more and gain 1 SP. | - | +1 damage | 7.5 vs 7.8; up 8.5 vs <= 9.8 |
| 29 | Stonewall Oath | Reaver / plate | special | 3/0 | Defend | Thorns 4, Counter 3, Exhaust | - (Block 25 / 28) | piercing (Thorns) | Gain 25 Block, 4 Thorns and 3 Counter. Exhaust. You gain 2 Frail. | Exhaust + self Frail 2 | Block 28; Frail 1 | 36 vs 37.1; up 41 vs <= 46.4 |
| 30 | Spear of the Fallen Knight | Colorless / spear | special | 3/0 | Attack | Reach, Pierce 4, Retreat (inflict), Advance 2, Exhaust | 25 / 28 | piercing | Deal 25. Pierce 4. Inflict 1 Retreat. Advance 2 for free. Exhaust. | Exhaust | +3 damage | 36 vs 37.1; up 39 vs <= 46.4 |

## Tag coverage

| Tag | Cards (by #) |
|---|---|
| Pierce | 1, 16, 17, 24, 30 |
| Force | 6, 12 |
| Reach | 1, 2, 8, 10, 13, 17, 24, 30 |
| Retreat inflict (all carry a drawback) | 10 (Escalating), 17 (Exhaust), 24 (Exhaust), 30 (Exhaust) |
| Pull (remove Retreat) | 2, 8 |
| Advance, free | 7, 19, 22, 30 |
| Counter | 4, 15, 21, 26, 29 |
| Evade | 5, 15, 19, 26 |
| Thorns | 3, 14, 25, 29 |
| Poise damage | 6, 7, 13, 18, 23 |
| Exhaust | 5, 14, 17, 24, 25, 29, 30 |
| Retain | 12, 25 (upgrade) |
| Reaction | 4, 12, 21, 26 |
| Escalating | 9, 10, 26 |
| Ethereal | 4, 21 |
| Bleed / Burn / Venom | 27 / 11 / 9 |
| Multi-hit | 9, 20, 27 |
| Combo / chain | 28 |
| Weak / Vulnerable (enemy) | 13, 23 |
| Self debuff drawbacks | Vulnerable 3, 22 (enemy Strength); Weak 16; Frail 29; Wound 15; Dazed 20; discard 19 |

Still uncovered: Reckless, Drained, Fortified (all approved, unbuilt), self-Staggered, Confused, Innate, Recall, Seal, Reflect, Ward (caster tags), Prepared (Rogue chain; Rogue already has many), Frost and Lightning (no martial weapon deals them except the Frost Spear, whose card would be the next add), and Shock or Chill build-up. Reckless and Drained are held back because nothing prices or implements them yet.

## New mechanics needed

- **Approved in the rulings, not built:** Thorns (cards 3, 14, 25, 29), Pierce as a stack that ignores 1 Block per stack and is cancelled by Stone Skin (1, 16, 17, 24, 30), Multi-hit stack (9, 20, 27), Escalating (9, 10, 26).
- **Existing ops used as-is:** `applyStatus` (retreat, evade, bleed, burn, venom, weak, vulnerable, frail, strength), `poiseDamage`, `moveEngagement` for free Advance (needs the "costs no SP" path from ruling 17), `pullEnemy` (2, 8; card 8 needs the all-enemies form), `addCard` wound or dazed into the discard pile, `discard`, `gainEnergy` (28).
- **NEW (mine):** card 28's condition "you already played a Smash or Sweep this turn". `turnMetric` exists as a predicate; a per-maneuver metric is probably NEW. If it is not wanted, replace with "if you changed stance this turn" (`inStance`).
- **NEW (mine):** Force on a Defend card (12): a damage row on a Block card with the Force tag. Needs only data if damage rows are allowed on `type: skill`.
- **NEW (mine):** Spear of the Fallen Knight (30) and the other `special` cards need a drop source (see Risks); no code, but a reward rule.
- Thorns priced at 3 cp per stack is my number; the ruling gives none.

## Risks

- **Top rarity:** the game has no tier above rare; `special` is the schema's last name and is not in reward rolls (SPEC 2200). Cards 29 and 30 need a source (boss, elite or event reward) or the owner must say rare is the ceiling and move them to rare with their drawbacks kept.
- **Thorns never decays** (ruling 16). Cards 3, 14, 25 and 29 stack up to 1 + 2 + 3 + 4 in one fight; with Counter and Block this snowballs against many small enemy hits. Drawbacks are priced for it but no cap is allowed (ruling 23); watch in playtest.
- **Retreat chains:** 10, 17, 24 and 30 inflict Retreat; reaching through costs 1 Advance per stack (ruling 22 amendment), so 24 (2 stacks) and 30 (stack plus 2 free Advance) stay playable only with Reach or the free Advances. Escalating on 10 and 26 is unbuilt; if Escalating slips, switch both to Exhaust.
- **Pierce stacks:** 5 cards; Stone Skin and high Block enemies cancel them. Keep Pierce numbers small until Stone Skin counts are known (the list uses 1 to 4).
- **Stacks with weapon types:** the Dagger base (0-cost attacks gain Multi-hit) doubles card 9's hits; Bow Retreat at turn end makes 10 and 24 hit a back row; Hammer Smash already inflicts Retreat and Vulnerable, so 18 does not add them; Halberd and Spear add Sweep damage and Reach by default (not charged again).
- **Budget scale:** cp prices above are my assumption (the repo has no rarity target). STR and DEX adds are not included. Numbers use the pending section 2 curve, not today's shipped values, so a re-run of `card-budget-report.mjs` after the retune can move every row.
- **Unbuilt tags in the survey:** the rail symbol file has no glyphs yet for Thorns, Pierce, Multi-hit or Escalating (`cardTagSymbols.js` SHAPES); they would fall back to the generic Skill glyph.
