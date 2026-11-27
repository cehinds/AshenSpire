# Owner editing: change the game without code

Four commands. Run them in a terminal opened in the repo folder (`C:\repos\AshenSpire`).

| Command | What it does |
| --- | --- |
| `npm run sync` | Moves your copy to the newest `dev` (on a local branch `owner/editing`). Run it before you start. |
| `npm run play` | Builds, checks, and opens the game. Saving a file reloads the page. |
| `npm run check` | Builds and checks only. Add `-- --full` to also run the core tests. |
| `npm run ship -- "Short title"` | Opens a pull request into `dev` with your edits. |

## The loop

1. `npm run sync`
2. `npm run play` and leave it running.
3. Edit a JSON file (table below) and save. The game reloads by itself.
   - If the page shows a red error bar, read it, fix the file, save again.
4. Happy with it? Stop `play` with `Ctrl+C`, then:

   ```powershell
   npm run ship -- "Tougher Husk Brute"
   ```

   - It makes a branch `feature/Owner...` from `origin/dev`.
   - One commit per file you changed, named from the change, such as `Raise Husk Brute poiseMax 5→6`.
   - It rebuilds the game data, runs the checks and the core tests (about two minutes), pushes, opens the pull request, and adds the changelog entry.
   - Add `--quick` to skip the core tests. Add `--dry-run` to only list what it would ship.
5. Open the link it prints. When the checks on GitHub are green, press **Merge pull request** (merge commit).
6. `npm run sync` again. Your shipped edits are cleared; anything not shipped is kept, with a backup copy in `.owner-backup/`.

## Where things live

All paths are from the repo folder. `core` means `games/ashenspire/packs/core/`.

| To change | Edit |
| --- | --- |
| Starting deck per class | `core/starterDeck.json` (`classDecks`) |
| Card pools (what rewards can offer) | `core/cardPools.json` |
| A card's cost, effects, text | `core/cards.json` |
| Enemy attributes, level, deck, behaviour | `core/enemies/<enemy>.json` (above the `derived` block) |
| Enemy cards and abilities | `core/enemyCards.json` |
| Relics | `content/source/relics.json` |
| Map rules: room odds, rest floors, shops, branches | `core/routes.json` |
| Anything else | `docs/MANUAL-EDITING.md` has the full table |

## Common edits

- **Enemy HP**: HP comes from the enemy's level and attributes. Raise `levelProfile` `min` and `max`, or move `constitution` earlier in `attributePriority`.
- **Card damage**: in `core/cards.json`, find the card by `"name"`, then change `"amount"` in its `"damage"` effect. Change `textTemplate` too if the words name a number.
- **Starting deck**: in `core/starterDeck.json`, change `"copies"`, or add a line `{ "card": "core.cardId", "copies": 1 }`.
- **Map**: in `core/routes.json`, `typeWeights` sets how often each room appears, `restFloors` which floors rest.

## Card limits

`content/source/actionCosts.json`, block `CARD_LIMITS`:

- `maxEffects`: most effects one card may have. `null` means no limit (the default).
- `maxDrawbacks`: most drawbacks one card may have. `null` means no limit (the default).
- Drawbacks are: losing HP, discarding, adding cards to your deck, delayed charges, Exhaust, Ethereal, and a debuff such as Frail on yourself.
- `selfDebuffStatuses`: which statuses on yourself count as a drawback.
- `cardFiles`: which card files are checked.

Set a number and `npm run check` names each card over it, for example:

```text
FAIL games/ashenspire/packs/core/cards.json: core.backstep (Backstep) has 2 drawbacks: frail on self, exhaust. The limit is 1 (maxDrawbacks).
```

## Drawbacks in Combat Power

`content/source/scoring.json`, block `drawbackCount` (also in Score Studio, Weights, "Drawback Cost"):

- `surchargeEnabled`: `true` to make drawbacks lower a card's Combat Power. Off by default.
- `weight`: Combat Power per drawback (negative lowers it), for example `-5`.
- `multiplier`: `true` to make each drawback scale the card's positive score instead, for example `-0.1` is 10% less per drawback.

## When something goes wrong

| You see | Do this |
| --- | --- |
| `FAIL <step>` and a message naming a file | Fix that file, save, `npm run check`. |
| `Unexpected token` or `JSON` in the message | A comma, quote or bracket is wrong. See JSON basics in `docs/MANUAL-EDITING.md`. |
| `... also changed on dev and the edits clash` | Copy your change somewhere, run `npm run sync`, redo the edit, ship again. |
| `sync stopped. These files changed and are not game content` | You changed a code file. Undo it in VS Code (Source Control, Discard) or ship it another way. |
| `gh auth status failed` | Run `gh auth login` once. |
| `ship` stops before pushing | Nothing went to GitHub. Fix the error and run it again. |

## Change the commands themselves

The four commands read three JSON files in `tools/owner/`. No code edit is needed.

| To change | Edit |
| --- | --- |
| Which build, check and test steps run, and in what order | `ownerTools.json` (`buildSteps`, `checkSteps`, `testSteps`) |
| Branch prefix, base branch, flags, limits, backup folder | `ownerTools.json` (`git`, `flags`, `limits`, `files`) |
| Which folders count as game content | `ownerTools.json` (`editableRoots`, `editableExtensions`) |
| Any message the commands print, the pull request text, the changelog line | `ownerText.json` |
| How a commit names a change ("Raise X 5→6") | `ownerDiff.json` (`phrases`) |

`{name}` in a message is filled in by the command. Keep the names; change the words around them.
The changelog line (`receipt.line`) must keep its start, ``- **{title}** ([#{pull}]({url}), `{stamp}`)``, or the changelog checks cannot find it.

## Rules that still apply

- Never commit built HTML or `buildordinal.json`. `ship` already leaves them out.
- Never push to `main`. `ship` only targets `dev`.
