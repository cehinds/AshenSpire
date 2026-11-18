# Map relics and the Teleport Scroll, 2026-11-18 (approved by the owner)

Owner request: relics that change how the map is travelled, which nodes come next or appear, and the map fog, plus Teleport Scroll cards. This builds on feature/MapRouteSpread (11 depths, V-spread branches, rest gaps of 2–5).

## Fog and scouting relics

| Relic | Rarity | Effect |
|---|---|---|
| Spyglass | common | Fog reveals 2 depths ahead instead of 1. |
| Ember Lantern | common | Every rest site in the act is visible through the fog. |
| Cartographer's Ink | uncommon | Unknown (?) nodes show their real type 1 depth ahead. |
| Hawk Feather | uncommon | Elites and traders are visible through the fog. |
| Seer's Eye | rare | Fog reveals 3 depths ahead, but not across into another branch's late nodes (the V rule still holds). |

## Traversal relics

| Relic | Rarity | Effect |
|---|---|---|
| Wayfinder Boots | uncommon | Once per act, step to a neighbouring lane on the same depth without fighting. |
| Rope and Grapple | uncommon | Once per act, skip one depth: travel two depths ahead along a connected path. The skipped node gives nothing. |
| Pathbreaker Charm | rare | Edges to the next depth also reach one lane left and right, within your own branch. |

## Node-type relics (what appears and how random it is)

| Relic | Rarity | Effect |
|---|---|---|
| Merchant's Token | common | +1 trader on each branch for the rest of the run (new acts). |
| Anvil Shard | common | +1 blacksmith on each branch for the rest of the run. |
| Loaded Dice | uncommon | When you reach a node, re-roll an unknown (?) node's outcome once per act. |
| Bloodhound Collar | uncommon | +1 elite per branch, and elites drop +10% gold. |
| Pilgrim's Compass | uncommon | The middle rest of each act sits 1 depth closer to you; the 2–5 gap rule still holds. |
| Fateweaver Coin | rare | At each fork, see the two outcomes of an unknown (?) node and pick which it becomes. |

## Teleport Scroll (card)

- **Type:** a card in the deck, Exhaust, 1 SP. Teleport Scrolls appear as rare card rewards and in trader stock.
- **In battle:** play it to escape a non-boss fight. You get no rewards (no XP, gold or cards), then choose a node on the same depth or 1 depth ahead, within your own branch.
- **Boss fights:** the scroll can't be played. Its face shows it greyed out with the reason.
- **On the map (open):** should it also be usable outside a fight, to hop lanes?
- **After use (open):** is the card spent, removed from the deck for the run, or does it only Exhaust for that fight?

## Owner decisions (2026-11-18)
1. All 14 relics are approved; tuning comes later.
2. A Teleport Scroll is **removed from the deck** after use (one escape per scroll).
3. The scroll works **on the map too**: outside a fight it hops to a node on the same depth or 1 depth ahead.
4. A teleport (scroll or traversal relic) **may enter any branch, but only before the pre-boss rest depth**. The pre-boss rest and its boss stay reachable only from their own branch, so the "no other boss visible from the pre-boss rest" rule still holds. The node picker shows the eligible nodes in other branches only while you are choosing.
5. Order: build after feature/MapRouteSpread merges into dev.
