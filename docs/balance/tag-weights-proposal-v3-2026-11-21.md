# Tag weights proposal v3, 2026-11-21

Builds on v2 (same date): every v2 weight and its justification carries over unchanged. New in v3: fixed rarity discounts, a full upgrade menu, upgrade-tier roll odds and the budget charge. Data: `content/source/tagWeights.json` (proposed, v3).

## 1. Rarity discount (fixed)

adjusted = raw − discount. Every card targets the same adjusted band, −5 to 5. The discount is a design constant that rises with rarity: rarer cards appear less often as rewards and upgrade options, so they may carry more power.

| Rarity | Discount | Raw band |
|---|---|---|
| common | 0 | -5 .. 5 |
| uncommon | 2 | -3 .. 7 |
| rare | 5 | 0 .. 10 |
| starter, special | 0 | −5 .. 5 (rank fixed) |

**Drop-rate follow-up:** this assumes the chance of offering one specific card falls as rarity rises, for every class. Starseer and Herald break that today (`balance.rewards.rarityWeightsByClass`: a specific rare is offered as often as an uncommon). Fix the drop rates to uniform before the bands are enforced.

## 2. Rescore at current rarity

62 of 94 cards fit at their current rarity. The 32 that do not:

| Card | Rarity | Raw | Adjusted | Action |
|---|---|---|---|---|
| conflagration | rare | 52 | 47 | retune down |
| stormcall | rare | 32 | 27 | retune down |
| pyreLash | uncommon | 28 | 26 | retune down |
| emberWave | uncommon | 24 | 22 | retune down |
| radiantVerdict | rare | 18 | 13 | retune down |
| batteringGale | uncommon | 17 | 15 | retune down |
| forkedBolt | uncommon | 17 | 15 | retune down |
| glacialSpike | uncommon | 16 | 14 | retune down |
| starfall | rare | 13 | 8 | retune down |
| meteor | rare | 13 | 8 | retune down |
| cinderDart | common | 12 | 12 | retune down |
| emberFlick | common | 12 | 12 | retune down |
| witherDraught | uncommon | 11 | 9 | retune down |
| dazzleFlare | common | 10 | 10 | move to rare |
| searingRay | uncommon | 9 | 7 | move to rare |
| expose | common | 7 | 7 | move to uncommon or rare |
| counter | common | 7 | 7 | move to uncommon or rare |
| acidSplash | common | 7 | 7 | move to uncommon or rare |
| brittleTouch | common | 7 | 7 | move to uncommon or rare |
| palmFlame | common | 7 | 7 | move to uncommon or rare |
| dawnFlame | common | 6 | 6 | move to uncommon or rare |
| rendingHex | common | 6 | 6 | move to uncommon or rare |
| starseerSpecial | starter | 6 | 6 | retune down |
| judgment | rare | -3 | -8 | move to common or uncommon |
| venomedEdge | uncommon | -5 | -7 | move to common |
| hexmark | uncommon | -5 | -7 | move to common |
| mirrorGuard | uncommon | -6 | -8 | retune up |
| evade | common | -10 | -10 | retune up |
| sanctifiedWard | uncommon | -11 | -13 | retune up |
| healingPrayer | uncommon | -12 | -14 | retune up |
| closingDodge | uncommon | -12 | -14 | retune up |
| dawnBulwark | rare | -16 | -21 | retune up |

## 3. Upgrade menu

Value is in points (v2 weights). P = the card's positive value. Sizes ×1/×2/×4 (or ×1/×2/×3) are the engine's `SIZE_MULT`. **Tier comes from the rolled value:** up to 2 is a common upgrade, 3–4 uncommon, 5 and up rare. Min rank = the lowest card rank that can roll it.

| Group | Upgrade | Value | Sizes | Min rank |
|---|---|---|---|---|
| ease | Remove Exhaust | P×0.333 | - | common |
| ease | Remove Ethereal | P×0.333 | - | common |
| ease | Steady: drop a self-debuff | 2 | - | common |
| ease | Remove HP cost | 1 | ×1/2/3 | common |
| ease | Remove melee row tax | 1 | - | common |
| eff | +1 damage | 1 | ×1/2/4 | common |
| eff | +2 Block | 1 | ×1/2/4 | common |
| eff | +3 Poise | 1 | ×1/2/4 | common |
| eff | +1 stack | status | ×1/2/3 | common |
| eff | +1 hit | dmgPerHit | - | uncommon |
| eff | Element packet | 1 | ×1/2/3 | common |
| eff | -1 SP | 5 | - | uncommon |
| eff | -1 MP | 7 | - | rare |
| new | Apply weak 1 | 2 (status) | - | common |
| new | Apply frail 1 | 1 (status) | - | common |
| new | Apply bleed 1 | 1 (status) | - | common |
| new | Apply chill 1 | 1 (status) | - | common |
| new | Apply frost 1 | 1 (status) | - | common |
| new | Apply burn 1 | 4 (status) | - | uncommon |
| new | Apply venom 1 | 2 (status) | - | uncommon |
| new | Apply shock 1 | 2 (status) | - | uncommon |
| new | Apply vulnerable 1 | 4 (status) | - | uncommon |
| new | Apply crimsonBlight 1 | 3 (status) | - | uncommon |
| new | Apply confused 1 | 2 (status) | - | uncommon |
| new | Apply dazed 1 | 2 (status) | - | uncommon |
| new | Apply silenced 1 | 2 (status) | - | uncommon |
| new | Apply paralysis 1 | 6 (status) | - | rare |
| new | Apply sleep 1 | 9 (status) | - | rare |
| new | Gain regen 1 | 3 (status) | - | uncommon |
| new | Gain strength 1 | 2 (status) | - | uncommon |
| new | Gain prepared 1 | 2 (status) | - | uncommon |
| new | Gain dexterity 1 | 1 (status) | - | common |
| new | Gain barrier 1 | 2 (status) | - | common |
| new | Gain stoneskin 1 | 4 (status) | - | uncommon |
| new | Gain evade 1 | 5 (status) | - | uncommon |
| new | Gain Counter 1 | 4 | - | uncommon |
| new | Gain Reflect 1 | 4 | - | uncommon |
| new | Add 4 Block | 2 | ×1/2/3 | common |
| new | Draw 1 | 3 | - | common |
| new | Cycle: draw 1, discard 1 | 2 | - | common |
| new | Restore 1 SP | 4 | - | uncommon |
| new | Restore 1 MP | 5 | - | rare |
| new | Heal 3 | 3 | - | common |
| new | Cleanse 1 | 2 | - | common |
| new | Hold one: retain another card | 1 | - | uncommon |
| new | Boost: next card x1.25 | 2 | - | uncommon |
| new | Copy into deck | P×0.333 | - | common |
| new | Cull a card from deck | 2 | - | common |
| new | Shuffle discard into draw | 1 | - | common |
| new | Pull enemy forward | 2 | - | common |
| new | Advance / Retreat | 1 | - | common |
| new | Retain | P×0.25 | - | uncommon |
| new | Innate | P×0.2 | - | uncommon |
| new | Reaction | 2 | - | uncommon |
| new | Target: bypass Evasion | 1 | - | common |
| new | Recall | P×0.5 | - | rare |
| new | +1 INT/WIS for the run | 1 | - | rare |
| new | Honed: +1 per play this run | 1 | - | uncommon |
| identity | Melee -> Reach | 2 | - | uncommon |
| identity | Single -> Area | enemyValue | - | rare |
| identity | Damage type: slashing | 1/hit | - | common |
| identity | Damage type: frost | 1/hit | - | common |
| identity | Damage type: earth | 1/hit | - | common |
| identity | Damage type: sacred | 1/hit | - | common |
| identity | Damage type: blunt | 1/hit | - | common |
| identity | Damage type: poison | 2/hit | - | uncommon |
| identity | Damage type: lightning | 2/hit | - | uncommon |
| identity | Damage type: psychic | 2/hit | - | uncommon |
| identity | Damage type: arcane | 2/hit | - | uncommon |
| identity | Damage type: piercing | 2/hit | - | uncommon |
| identity | Damage type: decay | 3/hit | - | uncommon |
| identity | Damage type: fire | 4/hit | - | rare |
| identity | Stance: smash | 1 | - | common |
| identity | Stance: sweep | 1 | - | common |
| identity | Stance: counter | 1 | - | common |
| identity | Trait: unavoidable | 2 | - | uncommon |
| identity | Trait: impact | 2 | - | uncommon |
| identity | Trait: unreflectable | 1 | - | common |
| identity | Trait: persistent | 1 | - | common |
| identity | finesse | 2 | - | uncommon |
| identity | Trait: counterstrike (x1.5) | P×0.5 | - | rare |
| drawback | Drawback: Exhaust | P×-0.333 | - | common |
| drawback | Drawback: Ethereal | P×-0.333 | - | common |
| drawback | Drawback: lose 2 HP | -2 | - | common |
| drawback | Drawback: melee only | -1 | - | common |
| drawback | Drawback: Weak 1 on you | -2 | - | uncommon |
| drawback | Drawback: discard 1 | -1 | - | common |

## 4. Rolling an upgrade

1. **Group** by upgrade number: the engine's `GROUP_SHARES` (ease / eff / new / identity). Drawbacks are offered beside them as an option.
2. **Tier** by card rank and upgrade number:

| Card rank | Upgrades 1–3 | 4–6 | 7–10 |
|---|---|---|---|
| common | 70/25/5 | 60/30/10 | 50/35/15 |
| uncommon | 55/35/10 | 45/40/15 | 35/45/20 |
| rare | 40/40/20 | 30/45/25 | 20/50/30 |

3. **Option** inside the group and tier: weight = engine kind weight × tier odds ÷ max(1, value). Cheaper options come up more often.
4. **Charge** against the upgrade budget: max(1, value − the tier's rarity discount). A rare −1 SP (+5) charges 1; Vulnerable at uncommon (+4) charges 2. A drawback adds |value| as credit.
5. **Budget** over 10 upgrades: starter/common 8, uncommon 7, rare 6. An option whose charge is over the remaining budget is not offered.

Three choices are offered per upgrade. The simulator (`card-upgrade-sim.html`) runs exactly these rules against this file.


## 5. Item score criteria (weapons, armour, relics)

Same 3-round window and points as cards. **Item power** = kit + Poise threshold + range + modifiers + property rules + damage-type tags. **Combat power** = item power − rarity discount (boss 7). Rank uses the same bands as cards.

| Term | Rule | Why |
|---|---|---|
| Attack profile (weapons) | (profile base − 3) × 0.35 × 3 Strikes; spell share × 0.5 | Measured against bare hands (unarmed Strike 3) |
| Guard profile (weapons) | (profile base − 1) × 0.49 ÷ 2 × 2 Defends | Against unarmed Guard 1 |
| Weapon art | The art card scored as a card, its SP/MP included, × 1 play | Legacy art numbers converted: damage × 0.35 + 3 per hit, Block × 0.49 + 6 |
| Poise threshold | (threshold − 4) × 0.5 | 4 is the median piece; each point delays a Break |
| Range | melee −3, reach +3, ranged +3 | Card range weight × 3 Strikes |
| Strike damage / Poise / hits / cost | n × 0.35 × 3 · n × 0.5 · (n−1) × 1.5 × 3 · n × −5 × 2 | Per-play value × Strikes in 3 rounds |
| Strike status rider | status weight × n × 3 | |
| Defend Block | n × 0.49 | |
| Max HP / SP / MP | n × 0.5 · n × 15 · n × 7 | +1 SP every round is 5 × 3 |
| Regen / Strength / Dexterity | status weight × n | |
| Property rules | Σ trigger frequency × value of its ops | Frequency per 3 rounds (combat start 1, turn start 3, card played 9…); once ≤ 1, per-turn limit ≤ 3n, any condition × 0.7 |

Findings: Greatsword (−2) and Warhammer (−2) still score low: in the data the Greatsword's Strike costs +1 SP for only +3 Poise, and the Warhammer's art (Bashing Blow) is weak for 1 SP + 1 MP. Tower Shield (−8) is held down by its art (Bastion: Exhaust, Weak on you). Cinder Axe (34) and Blight Rod (34) carry Strike Burn/Blight riders that repeat on every Strike.
