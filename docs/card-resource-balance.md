# Reward card resource balance

The September 19 content adjustment assigns fixed costs to cards, not a chance
to pay a resource each time a card is played. Existing Action costs remain.

| Rarity | Any Stamina cost | Both Stamina and Mana | Actions only |
| --- | ---: | ---: | ---: |
| Common | 30% | 15% | 70% |
| Uncommon | 50% | 30% | 50% |
| Rare | 70% | 50% | 30% |

The dual-resource share is included in the Stamina share. Counts round to the
nearest whole card in each rarity. Each selected resource costs one point.
Upgrading a card preserves its resource category.

The current combat-reward census is 52 Common, 51 Uncommon and 41 Rare cards.
The resulting Stamina-bearing/dual counts are 16/8, 26/15 and 29/21.

The census covers the union of the four class combat-reward pools.
It excludes merchant-only neutral cards, starter cards, special cards and cards available only through
equipment. Basic weapon attacks therefore retain their existing Action costs.
Spell identity does not override these rarity shares: the earlier blanket
Spell-cost proposal was replaced by this distribution. Dual-resource selections
favor caster spells and magical powers; physical techniques favor Stamina.

Herald and Starseer reward rolls favor higher rarities: normal fights use
35/50/15 Common/Uncommon/Rare weights, elites 25/50/25, and bosses 20/45/35.
Other classes retain the default weights. Skill drafts still require the
appropriate skill level to unlock a rarity, and Chaos Rewards retains equal
rarity weights. A low-level skill draft can therefore still offer only Commons.
Previously school-less Starseer and Herald reward cards now carry their existing
Starstone and Ritual schools respectively, so those higher-rarity cards can
actually enter focus drafts. Existing school tags are retained. School-based
synergies and skill upgrades also recognize these cards.

These are initial balance targets, not a claim about measured full-run win rates.
The census and combat payment tests live in `tests/card-rarity-costs.test.mjs`;
reward selection is checked by `tests/caster-reward-rarity.test.mjs`.
