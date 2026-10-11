# Release constants for the tag model

**Status: PROPOSAL, not wired.** The game does not read this output. It is a
compact, deterministic build of the tables for a later release path. Tables
stay the place people edit (`tables/`, `workbench.html`); a release build loads
the compiled constants instead. Nothing here changes a number, a card or a rule.

## Input

Every CSV under `docs/tag-model/tables/` and `tables/presentation/`: 7 top-level
tables and 13 presentation tables, 20 files in all. The compiler reads them with
`tools/csv.mjs` and nothing else.

## Output

One ES module, `docs/tag-model/release/tag-constants.js`, written by
`node docs/tag-model/tools/release.mjs`. The output is data only: named
exports, no functions, no imports. It is generated and deterministic: the same
input bytes give the same output bytes, with no timestamps or paths in it.

## Encoding

- **Interned string table.** `STR` holds every distinct string cell once, in
  first-seen order (traversal is sorted file path, then row, then column).
  Index 0 is the empty string. A string cell is stored as its index.
- **Numeric cells.** A column whose non-empty cells are all canonical numbers
  (`String(Number(t)) === t`, so `1.5` and `-2` qualify, `1.50`, `+1` and `1e5`
  do not) is stored as JS numbers, with `null` for an empty cell. Any other
  column stays a string column, so `TBD` and `+0.05` keep their text.
- **Numeric ids for tag keys.** A tag's id is its row index in `tags.csv`.
  Columns that name tags are stored as ids: `tags.parent`, `tags.school` and
  `objects.skill`, `cardType`, `stance`, `rarity`, `costResource` as one id
  (`-1` when empty); `tags.related`, `objects.tags` and `objects.exp` as a list
  of ids (`[]` when empty). Every name must resolve to a tag key. Each list must
  be single-space separated, so it decodes to the same text.
- **Columnar arrays.** Each table is `{ n, cols: [[name, kind, data], ...] }`
  with one array per column. Kinds: `s` string index, `n` number or null, `g`
  tag id or -1, `G` tag id list, `c` formula code.
- **Formulas pre-parsed to RPN.** Each formula's `expr` is parsed with the
  workbench grammar (see below) and stored as a flat postfix code array. Each
  opcode is followed by its arguments:

  | Op | Args | Meaning |
  |---|---|---|
  | `NUM` | literal index | push `NUM[i]` |
  | `RANK` | | push the rank |
  | `VALUE` | value id | push a value (ids are row indexes in `values`) |
  | `FORMULA` | formula id | push a formula (ids are row indexes in the kept formulas) |
  | `CALL` | function index, argc | call `FUNCS[i]` with `argc` values |
  | `NEG`, `NOT` | | unary `-`, `!` |
  | `BIN` | operator index | a binary operator from `BINOPS` |

  Every `[key]` is resolved at compile time to `RANK`, `VALUE` or `FORMULA`.
  An unresolved key, a key that names both a value and a formula, a tag key
  with no preview value, a formula cycle or an unknown function fails the build.
- **Dropped columns.** The game never reads these at runtime, so the compiler
  leaves them out: `description`, `note`, `notes`, `liveRef`, `source`, `file`,
  `usedBy`, `usedFor`, `usedWhen`, `context`, `readBy`, `storage`,
  `currentSymbol`, `currentAssetRef`, and the formula `expr` text (replaced by
  its RPN). A dropped column is not in the output, so it is not round-tripped.
  Its `[key]` references are still validated, so a bad reference fails the
  build even in a dropped column. Presentation `tag` columns are kept, because
  `breakpoints.tag` holds the band.
- **Kept as text.** `objects.cost` and `objects.description` cite `[key]`
  references. `cost` is kept as text and its references are checked.
  `description` is dropped (above), and its references are checked too.

## Versioning

`FORMAT` is the encoding version (bumped when the layout changes). `SOURCE_HASH`
is the SHA-256 of the format version plus every input file's path and bytes, in
sorted path order. A consumer can compare the hash with a fresh compile to tell
whether the constants are current.

## Reference semantics

The formula grammar is copied from `docs/tag-model/workbench.html`, the formula
engine, not imported from it: the same tokens (`[key]` references, numbers, names,
`+ - * / % ^`, `< > <= >= == !=`, `&& ||`, `!`, parentheses, and `×` as `*`), the same
precedence (`||` < `&&` < comparison < `+ -` < `* / %` < unary < `^`), and the
same functions (`min max floor ceil round abs clamp(x,lo,hi) if(c,a,b)`). Calls
evaluate every argument, as the workbench does. The row-level rule for
overrides is the workbench's too: a rank change on an object replaces a value
from rank 2 on, and changes add up rank by rank. The compiler does not expand
ranks. The `ranks` table ships as data.

A formula row with `status=proposed` and an empty `expr` is left out, with a
note in the compile report, as the workbench does. A formula that references
it fails the build, so a placeholder cannot quietly ship.

## Tests

`tools/release.test.mjs` compiles the real tables, imports the emitted module,
and decodes it with a reference decoder. It asserts:

- every kept table and column round-trips exactly, rows and values;
- each formula gives the same value as the workbench engine at rank 1 and rank
  3, for every object and for no object. The workbench engine is run from the
  source of `workbench.html`, so a change there that breaks the reference fails
  the test;
- two compiles give byte-identical output.

It also prints the size before and after (CSV bytes, module bytes and gzip).

## How the game would import it later (not wired now)

Build step: `node docs/tag-model/tools/release.mjs` writes the module. Runtime:
`import * as TC from './release/tag-constants.js'`, then read `TC.TABLES`
and evaluate formulas over the RPN with `TC.STR`, `TC.NUM`, `TC.FUNCS` and
`TC.BINOPS`. A release build would take this path. Dev and test keep reading the
tables. No file under `src/` imports this module, and this change does not
touch the engine.

## Size and commit decision

See the step 4 section below, which records the measured sizes and whether the
generated module is committed.
