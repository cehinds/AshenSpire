# Mechanic folders

One folder per behaviour tag and per status. The contract is
`docs/ai/json-game-modules/MECHANICS-ARCHITECTURE.md`; the rules the folders are written in are
`engine/runtime/SPEC.md`. Counts below come from `index.json` (248 mechanics): 8 portable, 165 legacy, 75 data.

## Files

`mechanic.json` (manifest), `model.schema.json` (state the mechanic owns), `interface.json`
(commands, events, queries), `service.json` (handlers), `cases.json` (behaviour examples),
`guide.md` (3 to 6 lines). Public names are `<slug>.<name>`; a slug may contain dots.

## State model

Cases, services and queries all use the state in [SPEC.md section 1](../runtime/SPEC.md):

- entities: `{ hp, maxHp, block, poise, poiseMax, sp, mp, statuses: { <id>: stacks }, tags }`, all plain numbers
  (a status is a number of stacks, never an object; poise is a number, never `{ value, max }`);
- top-level `piles: { draw, hand, discard, exhaust }` of card ids;
- `mechanics.<slug>` is the mechanic's own model state. A service reads it as `$model.<path>`, which falls back to the
  `default` values in its `model.schema.json`, so tunable numbers live in the model and not in the service.

## Portability

- `portable`: `service.json` fully describes the behaviour with ops marked `portable` in `engine/runtime/ops.json`.
  Hand-authored (`"authored": true`), at least 3 cases, every case passes through the interpreter
  (`tests/mechanics-runtime.test.mjs`).
- `legacy`: the behaviour still runs in JavaScript; `legacy.file` and `legacy.symbol` name where.
- `data`: a classification or label with no behaviour of its own; it names no legacy file.

## Adding a mechanic

1. Add the tag (`content/source/nodes.csv`) or status (`src/content/statuses.js`), then run
   `node tools/mechanics-generate.mjs`. It writes the folder as `legacy` or `data`.
2. To author it by hand, set `"authored": true` in `mechanic.json`; the generator never touches that folder again.
3. Write the five files, with the interface names the cases use.

## Promoting legacy to portable

1. Set `"authored": true` and `"portability": "portable"` in `mechanic.json`; keep the `legacy` pointer as history.
2. Write `service.json` using only portable ops, `$model.*` for tunable numbers, and `call`/`emit` of names that exist
   (or `runtime.*`). If the behaviour needs an op that is still `legacy`, port that op in the interpreter first.
3. Write 3 or more cases in the SPEC state model. Use `when: { command }` or `when: { event, with }`; list only this
   mechanic's own events in `then.events`.
4. Run `node tools/mechanics-generate.mjs --check` and
   `node --test tests/mechanics-runtime.test.mjs tests/mechanics.test.mjs tests/runtime-interpreter.test.mjs`.

JSON stays glyph-free (ASCII only).
