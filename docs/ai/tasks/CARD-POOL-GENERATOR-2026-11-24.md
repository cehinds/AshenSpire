# Score Studio: card pool generator and class deck editor (owner, 2026-11-24)

Status: designed, not started. Starts after `feature/ProceduralCardNames` lands (same files:
`tools/score-studio/studio.js`, `src/model/cardGenerator.js`). Branch: `feature/CardPoolGenerator`.

## Checklist

Naming (feature/ProceduralCardNames, in progress)
- [ ] Name structure: rarity, 2nd effect, element (magic), base, rank, +
- [ ] Base words by range: Strike/Shot, Touch/Bolt; Cleave/Wave; maneuver words kept
- [ ] Name length limit (20) with editable keep order
- [ ] Flat option on every multiplier in the Weights tab

Card pool generator
- [x] Generator makes 1-3 effects, statuses, schools, SP/MP costs at exact CP
- [ ] Regenerate modal: mode (replace generated / replace all / add)
- [ ] Totals: card count, cards per school, per camp
- [ ] Odds: rarity, rank, cost, card type, range, effects per card
- [ ] Allowed effects/statuses, keyword, drawback and area odds
- [ ] Seed with dice, class, live totals, preview before Apply
- [ ] Tooltips on every control

Class decks
- [ ] Starting deck per class with copy steppers
- [ ] Regenerate starting deck from rules
- [ ] Reward odds per school and card type
- [ ] Allowed cards, schools and card types per class

Acts, shops and rewards
- [ ] Ranks and cards per act
- [ ] Rank and rarity odds per source (rewards, shops, events, elites/bosses) per act
- [ ] Odds table per act and a sample roll

Finish
- [ ] Review, browser check, screenshots, PRs merged and promoted

## Owner request

- A button that regenerates cards from the weights and a set of priorities, opening a modal with
  toggles, checkboxes and number boxes, each with a tooltip.
- Priorities include: number of effects, rarity percentages, rank percentages, cost percentages,
  number of cards, number of cards per school, and anything else useful.
- A second button for regenerating and customizing class starting decks, and which cards, schools
  and card types are available or likely to appear.

## Decisions

- Regenerate mode is a choice in the modal (owner: "a checkbox option for each"):
  - Replace generated only: hand-made Core cards stay; generated cards are rebuilt.
  - Replace everything: the studio list becomes generated cards (Reset restores).
  - Add to the pool: new generated cards beside what is there.
  Nothing reaches the game until Export (save model: auto-save temp, Save to JSON config, Export).
- The deck editor controls, per class: starting deck cards (and copies, with its own Regenerate),
  reward odds (school, card type, card likelihood in rewards and shops), and allowed lists (which
  cards, schools and card types a class can ever get).

## Generator modal (first cut)

- Total cards; cards per school (fire, frost, lightning, force, decay, divine, illusion, earth,
  alteration, none) and per camp (martial, magic, hybrid).
- Rarity % (common / uncommon / rare), rank % (Unranked, Rank 1..maxRank), cost % (SP 0..3,
  MP 0..3), card type % (attack, skill, smash, sweep, counter, defend), range % (melee / reach).
- Effects per card % (1 / 2 / 3), allowed effects and statuses (checkboxes), keyword odds,
  drawback odds (HP cost), area odds.
- Seed (with a dice button), class (colorless or one class), percentages normalised with a live
  total, a preview count before Apply.
- `src/model/cardGenerator.js` today makes one primary effect plus an optional rider; extend it to
  2-3 effects, statuses, schools and SP/MP costs while every card still lands exactly on its target
  CP (ScoreCard). Names come from the convention name (CardName).

## Acts, shops and rewards (owner addition, 2026-11-24)

- Per act: which ranks and cards can appear (today `scoring.levelLists.tiers` minRank/maxRank and
  `src/content/generated/levelLists.js`), editable per act.
- Per source (card rewards, shop shelves, events, elites/bosses): rank odds and rarity odds per act,
  and any card pinned in or out. Find the owner files (balanceRewards.json rarityWeights, shop
  pricing/stock in games/ashenspire/packs/core/shops.json, level lists) before writing.
- Show a small table per act: rank x source with the odds, and a preview roll of a few offers.

## Deck editor modal (first cut)

- Per class tab: starting deck list with copy steppers; Regenerate starting deck from rules
  (size, type mix, schools); reward odds sliders per school and card type; allowed checklists.
- Reads and writes the game's own data (`src/content/deckRules.js` creationPool,
  `src/model/startingDeckChoice.js`, `content/source/balanceRewards.json` rarityWeights and
  class pools); find each owner file before writing.
