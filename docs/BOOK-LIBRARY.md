# Books, lessons and reusable class cards

Owner decisions: a read grants XP **and one immediate lesson**, books may teach
outside the character's class, and a class card can be removed to leave an
empty class slot. This extends the previously approved illustrated shop.

## Player flow

Buy a book, open Inventory and select **Read**. Choose a lesson and confirm
**Read and learn**. Cancellation keeps the book and awards nothing. Confirmation
revalidates ownership, scope and revision, awards its configured XP, grants
one card and consumes one book. A level-up earned by that XP still grants its
ordinary progression reward independently.

| Book | XP | Immediate lesson |
| --- | --- | --- |
| Blade Manual | Blade | One Blade-tagged card across all class reward pools |
| Shield Manual | Shield | One Guard-tagged card across all class reward pools |
| Focus Treatise | Magic Focus | One card from the focus equipment's authored schools |
| Paired Steps Primer | Dual-wield | One card from weapon schools |
| Spellbook | Magic Focus | One `source:spell` card across classes |
| Universal Tome | Player-selected skill/class track | One skill, spell, or unlearned class card |
| Reaver / Starseer / Rogue / Herald Class Book | Named class | That reusable class card |

Skill/spell choices obey the selected track's existing rarity unlocks, with
common cards available from level zero. The choice pool is the union of
authored class reward pools, so internal and equipment-only cards are excluded.
No particular weapon needs to be equipped to study. Known class books are
unavailable to buy or learn again. The inherited 40 XP / 180 cinders / 140 sale
defaults remain configurable and have not received a balance tuning pass.

## Class cards

The starting class is already learned. Additional classes appear in Inventory
when learned and never auto-equip. **Equip class** and **Unequip class** are
available outside combat, once outstanding rewards are resolved. Each card
keeps its XP, pending drafts, tree choices and armour sets when set aside.

With an empty slot, the player is shown as **Classless**. The core projection
contains no class or class tags, combat mounts no class properties, and combat
class XP/class-tree choices stop. Previously learned cards, equipment, relics
and character attributes remain. Equipped class data and classless combat
snapshots survive saving and loading.

Compatibility detail: `run.class` retains the most recent class identity for
existing stat, armour and ordinary reward-pool readers. `classUnequipped`
controls whether its core card is active. Optional `classCards` records preserve
each learned class's tree choices and armour; old saves need no migration.
The separate legacy mirror event retains its existing reset rule; inventory
class-card equip uses the progression-preserving path.

## Authoring and review

Definitions live in `src/content/consumables.js`. A book may specify one of
`learnTags`, `learnClass`, or `learnAny`. Validation rejects unknown tags,
inconsistent class/XP targets and overlapping scopes. No second tag taxonomy
or duplicate class registry was introduced.

Each book uses a layered artwork recipe in `src/content/bookArtPresets.js`.
The Book Atelier supplies independently replaceable covers, colors, trim and
symbols; see `BOOK-ART.md`. All descriptions, purchases and reading
controls use live content values.

The asset kit lives in AshenSpire-art; see `BOOK-ART.md`. Learning
tests: `tests/book-learning.test.mjs`; rendered checks:
`tools/book-learning-browser.mjs` and `tools/book-library-built-browser.mjs`.
Screenshots and machine-readable receipts are in `docs/preview/book-library/qa/learning-*`.

Preview: `/docs/preview/book-library/preview.html?library=1` seeds a disposable
library, with shortcuts to reading and the real inventory. Packed-game QA:
`/build/AshenSpire.html?shot=shop&shotLibrary=1`. Neither URL is a publication.
