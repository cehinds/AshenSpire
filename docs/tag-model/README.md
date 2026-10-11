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
| `tools/` | Node scripts. `build.mjs` regenerates the presentation tables and the tag changes; `check.mjs` validates the tables; `live-map.mjs` (with `SHARED_LIVE`) and `legacy-status.json` hold the reviewed live-tag map; `bands.mjs` normalises breakpoints; `csv.mjs` reads and writes the CSVs |
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
| `tokens.csv` | CSS custom properties and the theme they are declared in. Key: token + theme + file (one token can be declared more than once in a scope, in different files) |
| `breakpoints.csv` | Every media or container condition in the stylesheets and scripts, with its file and where it is used. Its band is in the `tag` column (there is no `band` column) |
| `assets.csv` | Art ids by category, with the light and high tier paths and sizes. Its `id` is the `assets.id` that `components.assetRefs` and `combat-symbols.assignedAssetRef` resolve against |
| `animations.csv` | Sprite and motion sequences by group (the id prefix) |
| `effects.csv` | Visual effects by kind (sprite effect, aura, shadow, glow, float text, screen shake, flash, tint, particle) |
| `resolutions.csv` | Art tiers (light, high, local high-res) and card sizes, with max width and format |
| `settings.csv` | Every settings row, with `scope` (player or tuning) |
| `symbols.csv` | Icons and sigils by group (the id prefix) |
| `combat-symbols.csv` | Every combat concept and its icon: `assignedAssetRef` is an `assets.id` or blank. See *Icons* below for the statuses |
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

**Icons.** `combat-symbols.csv` has one `status` per concept. `assignedAssetRef`
is an `assets.id`, an inline SVG reference, or blank:

- `has symbol` (38): the concept's current icon is an asset file or an inline
  SVG in code.
- `placeholder` (56): no icon yet; `assignedAssetRef` is the suggested icon. A
  suggested asset exists in `assets.csv`; `earth` and `psychic` suggest an
  inline SVG. The artwork is not drawn yet, so every `placeholder` still needs
  art.
- `missing` (0): no icon, so `assignedAssetRef` is blank. `check.mjs` fails any
  row where `missing` and a blank `assignedAssetRef` disagree.

An inline SVG is written `svg:<Module>.<NAME>.<key>`, for example
`svg:combatSigils.ACTION_SIGILS.attack` or `svg:cardTagSymbols.SHAPES.slashing`.
`<Module>` is a key of `SVG_MODULES` in `tools/svg-source.mjs` (its source file),
`<NAME>` is a `const` declared in that file, and `<key>` is an object key inside
it. `check.mjs` reads the source and fails the reference unless all three
resolve. `build.mjs` writes these references from the inline SVG text in the
inventory. Earth and psychic have no symbol of their own, so they reuse the
school sigils `SCHOOL_SIGILS.alteration` and `SCHOOL_SIGILS.illusion`.

The suggested text that is not an `assets.id` (for example `card-icon:banner`)
is mapped to the outline icon of that name under
`assets/cards/default-outline/icons/` (or `assets/player-polish/ui/icons/` for
`ui-icon:`) when that file is in `assets.csv`; otherwise it is blank.

**Keys and cleaning.** `build.mjs` makes the presentation tables unique before
it writes them:

- Duplicate ids get a suffix: `effects.id` (2 rows, for example
  `flash.hitflash-2`) and `breakpoints.name` (36 rows, for example
  `css-max-width-640px-2`). Rows are kept, not deleted.
- Exact duplicate rows are dropped: 55 in `layouts.csv` and 39 in
  `styles.csv`.
- `components.assetRefs` keeps only tokens that resolve: an `assets.id`, or a
  `*` pattern that matches at least one `assets.id`. A `../` prefix (a
  stylesheet-relative path) is dropped to get the root-relative id, and a
  `${...}` template becomes a `*` pattern. Other tokens are removed. The
  current extract removed 17 token occurrences: 15 footer paths
  (`assets/ui/footer/*`) that are not in `assets.csv`, and the pattern
  `assets/equipment/feet_*.webp` (twice), which matches no asset.
- `check.mjs` requires each key to be unique: `id` (components, effects,
  animations, symbols, assets, objects), `key` (settings, strings, values,
  formulas), `tier` (resolutions), `name` (breakpoints), `tagKey`
  (combat-symbols), `token` + `theme` + `file` (tokens), and the triples
  object + rank + key (ranks) and source + relation + target (relations).
  `layouts` and `styles` have no key; they are checked for exact duplicates.
- Running `build.mjs` twice gives byte-identical output; a second run changes
  nothing, so it is safe to re-run.

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
and is repeatable: a second run is byte-identical (checked on this branch by
running it three times and diffing the tables). The `--inv` path is not run
here, because the extracted inventory is not on this branch.

`check.mjs` validates, and exits 1 on any problem:

- shape: every CSV parses with a consistent column count, LF line endings and
  a final newline, and every column the checks read exists (a missing column
  fails by name);
- keys: the uniqueness rules above; tag keys are the shortest unique suffix of
  their id;
- duplicates: no exact duplicate row in a presentation table;
- references: tag `parent`, `school`, `related` and `variables`; object `tags`,
  `skill`, `exp`, `cardType`, `stance`, `rarity`, `costResource` and `grants`;
  rank and relation keys; formula `[key]`s; `components.parent`, and the
  `componentId` of layouts and styles, against `components.id`; every
  presentation `tag` against a presentation node;
- assets: `assetRefs` and `assignedAssetRef` are blank, an `assets.id`, or a
  `*` pattern with a match;
- vocabularies: tag `status`, `band` (layouts, styles), `scope` (settings),
  combat-symbols `status`;
- live tags: `liveId` only on a `live-tag`, and it names a `nodes.csv` id; an id
  claimed by two tags must be listed in `SHARED_LIVE` with a reason (none is
  today); the *Moved* note appears once per description.

**Tag status (Task 3).** `status` is one of `live-tag` (a node in
`content/source/nodes.csv` clearly matches; its id is in `liveId`),
`game-concept` (the game has the concept with no tag node, such as HP, Block
or a status), or `new`. `live-tag` also covers the old `moved` tags, with a
note in `description`. The matches are reviewed by hand in
`tools/live-map.mjs`. Spellcraft elements map to the school nodes (Fire, Frost,
Lightning, Force, Divine and Necrotic to `school:fire`, `school:frost`,
`school:lightning`, `school:force`, `school:divine` and `school:decay`). The
magic damage types map to the damage nodes (`damage:fire`, `damage:frost`,
`damage:lightning`, `damage:arcane` for Force, `damage:sacred` for Divine,
`damage:decay` for Necrotic). The matches marked *probable* there are
label-level only and need a review. Today 71 tags are `live-tag` and no node
is claimed by two tags, so `SHARED_LIVE` is empty.

## Open questions

- **Mapping the current tags.** The game's live tag tree
  (`content/source/nodes.csv`) has to be mapped onto this model, node by node:
  which ones keep their id, which are re-homed (`[m]` in `tag-tree.txt`),
  which retire, and where their bound numbers move in `values.csv`.
- **SPEC change first.** SPEC.md §3.3 says a node carries no numbers and that
  `nodes.csv` is the one vocabulary. Before any code reads these tables, a
  SPEC pull request has to adopt the model (or the parts of it that survive
  review).
