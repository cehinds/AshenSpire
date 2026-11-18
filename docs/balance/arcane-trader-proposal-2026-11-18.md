# Arcane Trader and scrolls, 2026-11-18 (approved by the owner)

## Shop prices for the super-rare map relics (owner: expensive)
Today a rare relic costs 810–900 gold (`balance.shop.relicCost`). The removal and conversion relics cost more, and the price rises as the drop chance falls:

| Relic | Chance | Price |
|---|---|---|
| Hearthstone | 0.1% | 1800–2000 |
| Merchant's Bell, Forge Ember | 0.3% | 1500–1650 |
| Ward of Passage | 0.5% | 1350–1500 |
| Bounty Writ | 0.8% | 1200–1350 |
| Mystery Map | 2% | 950–1050 |
| Smoke Bomb | 5% | 800–900 |

## The Arcane Trader (new merchant kind)
- **What it is:** a new merchant kind beside market, blacksmith and wise master (`shops.kindWeights`, new key `arcane`).
- **Chance:** when a merchant is placed, it is the Arcane Trader **10% of the time for the caster classes (Starseer, Herald) and 5% for the others** (owner). It replaces the market at that node.
- **What it sells:**

| Shelf | Stock | Price |
|---|---|---|
| Magic relics | 2 | relic price +10% |
| Scrolls | 3 | spell scrolls by formula; unique scrolls as listed |
| Magic armaments (staves, sceptres, tomes, talismans, chimes, light sources) | 2 | armament price |
| Magic armour (unarmoured robes) | 1 | armour price |
| Spell cards | 3 | card price |

- **Not sold:** card removal, flasks or inn rest; those stay at the market.
- **Magic relics:** a relic is "magic" if it touches MP, Ward, spells, elements or Prepared stance. Proposed for the shelf: Runed Bracer, Shattered Aegis, Prepared Mind, Prism of Elements, Storm Rod, Tinderbox, Frostbitten Charm, Rotting Censer, plus the existing caster relics.

## Scrolls (owner, 2026-11-18)
- **Where they live:** scrolls are consumables in the **potions (flask) section**, not deck cards. They **do not count against the potion limit**.
- **Using one in a fight:** the scroll is spent and **its card goes into your hand**. **A scroll's card costs 0 to play** (no MP or SP), whatever the spell normally costs (owner). Once that card is played it leaves for good; it never joins the deck. Some scroll cards have **Retain** (they wait in hand until played); the rest are lost at the end of the turn if not played.
- **Spell scrolls:** most scrolls are one-use copies of existing spells. **Every spell has a scroll version**, named "Scroll of <spell>", at the spell's base grade. Each card's Retain is set per scroll in the rules pass.
- **Unique scrolls:** a few exist only as scrolls:

| Scroll | Price | Where used | Effect |
|---|---|---|---|
| Teleport Scroll | 150 | fight or map | Escape a non-boss fight with no rewards, or hop to a node on the same depth or 1 ahead (any branch before the pre-boss rest) |
| Scroll of Farsight | 60 | map | Reveal the next 3 depths of your branch |
| Scroll of Recall | 220 | map | Return to the last rest you visited on this branch |
| Scroll of Unmaking | 120 | fight (Retain) | Remove all Ward and Block from one enemy |
| Scroll of Haste | 110 | fight | Gain 2 SP and draw 2 cards |

- **Price of a spell scroll:** 60 + 40 × the spell's cost (MP + SP); rare spells +50% (owner: pricier).
- **Where to buy:** the Arcane Trader always stocks 3 scrolls. **Regular traders also have a 50% chance per visit to stock 1** (owner). Scrolls also turn up as rare rewards.

## Owner decisions (2026-11-18)
1. The Arcane Trader stock and the 5 unique scrolls are approved.
2. Caster classes (10% Arcane Trader chance) are Starseer and Herald; the others get 5%.
3. Scrolls sit in the potions section, outside the potion limit.
4. A regular trader stocks 1 scroll on 50% of visits.
5. A spell scroll costs 60 + 40 × the spell's cost, and rare spells +50%. The price follows the spell's normal cost; casting the scroll is free.
6. Build order: after feature/MapRouteSpread merges into dev, together with the map relics.
