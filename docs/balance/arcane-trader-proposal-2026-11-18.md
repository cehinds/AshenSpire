# Arcane Trader and scrolls, 2026-11-18 (proposal for owner approval)

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
| Scrolls | 3 | 60–220 by scroll |
| Magic armaments (staves, sceptres, tomes, talismans, chimes, light sources) | 2 | armament price |
| Magic armour (unarmoured robes) | 1 | armour price |
| Spell cards | 3 | card price |

- **Not sold:** card removal, flasks or inn rest; those stay at the market.
- **Magic relics:** a relic is "magic" if it touches MP, Ward, spells, elements or Prepared stance. Proposed for the shelf: Runed Bracer, Shattered Aegis, Prepared Mind, Prism of Elements, Storm Rod, Tinderbox, Frostbitten Charm, Rotting Censer, plus the existing caster relics.

## Scrolls (one use; the card is removed from the deck after use)
Scrolls are cards added to the deck. Each costs 0 to play and leaves the deck for good once played, like the Teleport Scroll. They are sold at the Arcane Trader and turn up as rare rewards.

| Scroll | Price | Effect |
|---|---|---|
| Teleport Scroll | 150 | Escape a non-boss fight with no rewards, or hop nodes on the map (approved) |
| Scroll of Fire | 90 | 12 Fire damage to all enemies; 2 Burn each |
| Scroll of Frost | 90 | 10 Frost damage to one enemy; it is Frozen |
| Scroll of Lightning | 90 | 8 Lightning damage, Chain to 2 more enemies |
| Scroll of Warding | 80 | Gain 3 Ward |
| Scroll of Stoneskin | 70 | Gain 5 Stone Skin and 8 Block |
| Scroll of Haste | 110 | Gain 2 SP and draw 2 cards |
| Scroll of Mending | 100 | Heal 15 HP and Cleanse 2 |
| Scroll of Unmaking | 120 | Remove all Ward and Block from one enemy |
| Scroll of Farsight | 60 | Usable on the map: reveal the next 3 depths of your branch |
| Scroll of Recall | 220 | Usable on the map: return to the last rest site you visited on this branch (no rewards for skipped nodes) |

## Open choices for the owner
1. Approve the Arcane Trader stock and the scroll list, or name changes.
2. Is "caster classes" Starseer and Herald, or Starseer only?
3. Should scrolls count toward deck size for hand and draw, or sit apart (a scroll pouch)?
