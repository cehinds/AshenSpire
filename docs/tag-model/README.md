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
| `tables/tags.csv` | 392 proposed tag nodes: identity only (id, key, label, parent, description, status) |
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

## Open questions

- **Mapping the current tags.** The game's live tag tree
  (`content/source/nodes.csv`) has to be mapped onto this model, node by node:
  which ones keep their id, which are re-homed (`[m]` in `tag-tree.txt`),
  which retire, and where their bound numbers move in `values.csv`.
- **SPEC change first.** SPEC.md §3.3 says a node carries no numbers and that
  `nodes.csv` is the one vocabulary. Before any code reads these tables, a
  SPEC pull request has to adopt the model (or the parts of it that survive
  review).
