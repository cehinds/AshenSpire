# Gameplay tag model (proposal)

**Status: PROPOSAL.** This folder is a design proposal, not the game's live tag
contract. Nothing in the game reads these files. The tag tree in
`content/source/nodes.csv` and its companions (`nodeRelations.csv`,
`familyNodes.csv`, `nodeTerms.csv`, `nodeVariables.csv`,
`variableBindings.csv`, `nodeEffects.json`; SPEC.md §3.3 *Tag tree* and
*PropertyRule*, §4.7) stay authoritative until a SPEC change lands in its own
pull request (CONTRIBUTING.md, ground rule 1).

## What is here

| File | What it is |
|---|---|
| `tables/tags.csv` | 517 nodes: 392 proposed tags plus 125 `meta.presentation` nodes. The game has 448 tag nodes today (`content/source/nodes.csv`). Columns: id, key, label, parent, erd, school, description, effect, variables, duration, stacking, related, status, glyph, color, liveId |
| `tables/presentation/*.csv` | The presentation inventory: 13 tables of how the game looks (components, layouts, styles, tokens, breakpoints, assets, animations, effects, resolutions, settings, symbols, combat symbols, strings). See *Presentation layer* |
| `tools/` | Node scripts that regenerate the presentation tables and tag changes (`build.mjs`), validate them (`check.mjs`), and hold the reviewed live-tag map (`live-map.mjs`, `legacy-status.json`) |
| `tables/objects.csv` | Carriers: cards, weapons, armour, and the tags each one carries |
| `tables/values.csv` | Every number, by key |
| `tables/formulas.csv` | The math, written with `[key]` references |
| `tables/ranks.csv` | Progression: what changes at each rank of an object |
| `tables/relations.csv` | Interactions between tags (for example `STRONG_VS`) |
| `tables/assets.csv` | Game asset ids the tables point at, with size and kind |
| `erd.mmd` | Mermaid ER diagram of the model |
| `tag-tree.txt` | The tag tree as an indented outline. `[n]` = new tag, `[m]` = existing tag moved to a new parent, `{…}` = note |
| `workbench.html` | A standalone page for editing the tables |

## The six-table reframe

Today a tag node carries no numbers, and numbers live in balance paths bound
per scope. The proposal splits the same job into six tables, each with one
job:

- **tags** are identity: what a thing is.
- **objects** are carriers: the cards and items that hold tags.
- **values** are numbers.
- **formulas** are math over values, written with `[key]` references.
- **ranks** are progression: per-rank changes to values.
- **relations** are interactions between tags.

Plus **assets**, the art each object can show.

## Conventions

- A tag's `id` is its full dotted path (`card.upgrade.base`).
- A tag's `key` is the shortest suffix of that path that is still unique.
  Formulas use keys (`[ar]`, `[crit.mult]`).
- A value whose key matches a tag's key is that tag's preview number. For
  example the value `ar = 24` is what the AR tag shows in a preview.
- Art fields (`art`, `artDefault` in `objects.csv`) hold game asset ids, such
  as `assets/cards/extended/card-strike-512.webp`, resolved at runtime through
  `assetUrl()` in `src/ui/assetmap.js`. They are not URLs.

## How to edit

1. Open `workbench.html` in a browser. Outside claude.ai it runs in local mode.
2. Import the CSVs from `tables/`.
3. Edit, then export each table back to CSV and replace the file here.

Plain text editors and spreadsheets work too; keep the header row and the
column order.

## Worked example: Strike

`objects.csv` says Strike deals `[strike.damage]` and costs `[strike.cost]`.
`formulas.csv` defines:

```
strike.damage = [strike.baseDamage] + floor([ar] * [strike.arScale]) + [sword.arBonus]
```

At rank 1 with AR 24 (`values.csv`): 6 + floor(24 × 0.25) + 3 = **15**.

`ranks.csv` changes the inputs as Strike ranks up:

| Rank | Change | baseDamage | arScale | Damage | Cost |
|---|---|---|---|---|---|
| 1 | — | 6 | 0.25 | 15 | 1 |
| 2 | baseDamage +1 | 7 | 0.25 | 16 | 1 |
| 3 | arScale +0.05 | 7 | 0.30 | 17 | 1 |
| 4 | baseDamage +1 | 8 | 0.30 | 18 | 1 |
| 5 | cost = 0 | 8 | 0.30 | 18 | 0 |

## Presentation layer

The presentation tables describe how the game looks and reads. They are an
inventory, not gameplay: nothing in them changes a number, a card or a rule.
Each row points at its source (`liveRef`) and at a node in the Presentation
tree (`tag`, a key from `tables/tags.csv` under `meta.presentation`).

| Table | Holds |
|---|---|
| `components.csv` | Named UI components by group (scene, battlefield, card-structure, HUD header, footer, button, modal, menu, background art, map, overlay, wireframe) |
| `layouts.csv` | Each component's position and size, with its raw breakpoint condition and normalised `band` |
| `styles.csv` | CSS declarations per selector, with raw breakpoint and `band`; `tag` is the style kind (color, typography, spacing, radius, shadow, motion, z-index, token, other) |
| `tokens.csv` | CSS custom properties and the theme they are declared in |
| `breakpoints.csv` | Every media or container condition in the stylesheets, with its band |
| `assets.csv` | Art ids by category, with the light and high tier paths and sizes |
| `animations.csv` | Sprite and motion sequences by group (the id prefix) |
| `effects.csv` | Visual effects by kind (sprite effect, aura, shadow, glow, float text, screen shake, flash, tint, particle) |
| `resolutions.csv` | Art tiers (light, high, local high-res) and card sizes, with max width and format |
| `settings.csv` | Every settings row, with `scope` (player or tuning) |
| `symbols.csv` | Icons and sigils by group (the id prefix) |
| `combat-symbols.csv` | Every combat concept and its icon. Concepts without one take the suggested asset as a `placeholder` in `assignedAssetRef` |
| `strings.csv` | Player-facing strings with their use: label, tooltip, or hardcoded in source |

**Proposed named bands** (`tools/bands.mjs`). `band` is derived from the raw
`breakpoint` or `condition`; the raw text is kept.

- `mobile`: max-width at or below 600px, or pointer:coarse with orientation:portrait
- `tablet`: 601px to 1024px
- `desktop`: 1025px and up
- `all`: no condition
- `state`: `data-*` or `body.*` hooks, which are not viewport conditions
- `other`: anything else. A condition goes to a band only when its whole width range lies inside that band, so `max-width: 640px` and `max-width: 900px` are `other` (they straddle a band edge)

**Settings scope split** (`scope` in `settings.csv`). `player` is the settings
screen and its per-device or profile preferences; `tuning` is advanced and
config rows (the advanced-config overlay, attribute, class and balance modules).
Where a row matches both rules, `tuning` wins. Today that gives 44 player rows
and 4,424 tuning rows: almost every settings row reads from the advanced-config
module, so the split is mostly a list of tuning knobs. Confirm the precedence
before the split is used.

**Placeholder symbols.** Combat concepts that had no icon now have an assigned
asset, the suggestion in `combat-symbols.csv`, with `status = placeholder`. The
suggested artwork is not drawn yet; every `placeholder` still needs art.

**Release builds.** These tables are for review and regeneration. A release
build would serialise them into compact runtime constants (generated code, one
lookup per tag) rather than shipping the CSVs or the inventory.

**Regenerate.** The inventory is extracted from the repo by a separate
script that is not on this branch. With the extracted CSVs in a folder:

```
node docs/tag-model/tools/build.mjs --inv <folder-with-inventory-csvs>
node docs/tag-model/tools/check.mjs
```

Without `--inv`, `build.mjs` rebuilds from the copies in `tables/presentation/`
and is repeatable. `check.mjs` validates every CSV (column counts, LF, final
newline), key uniqueness and shortest-suffix form, every reference column, and
the `tag`, `band` and `scope` columns; it exits 1 on any problem.

**Tag status (Task 3).** `status` is one of `live-tag` (a node in
`content/source/nodes.csv` clearly matches; its id is in `liveId`),
`game-concept` (the game has the concept with no tag node, such as HP, Block
or a status), or `new`. `live-tag` also covers the old `moved` tags, with a
note in `description`. The matches are reviewed by hand in
`tools/live-map.mjs`; the brief's renames (Force, Divine, Necrotic, Frost) map
to the `damage:*` nodes. The matches marked *probable* there are label-level
only and need a review.

## Open questions

- **Mapping the current tags.** The game's live tag tree
  (`content/source/nodes.csv`) has to be mapped onto this model, node by node:
  which ones keep their id, which are re-homed (`[m]` in `tag-tree.txt`),
  which retire, and where their bound numbers move in `values.csv`.
- **SPEC change first.** SPEC.md §3.3 says a node carries no numbers and that
  `nodes.csv` is the one vocabulary. Before any code reads these tables, a
  SPEC pull request has to adopt the model (or the parts of it that survive
  review).
