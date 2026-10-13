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
  Columns that name tags are stored as ids. `tags.parent` holds the parent's
  full id (kind `i`, `-1` when empty). `tags.school`, `objects.skill`,
  `cardType`, `stance`, `rarity`, `costResource` and `relations.source` and
  `target` hold one tag key (kind `g`, `-1` when empty). `tags.related`,
  `objects.tags` and `objects.exp` hold a list of keys (kind `G`, `[]` when
  empty). Every name must resolve; a list must be single-space separated, so
  it decodes to the same text.
- **Columnar arrays.** Each table is `{ n, cols: [[name, kind, data], ...] }`
  with one array per column. Kinds: `s` string index, `n` number or null, `g`
  tag key id or -1, `i` tag id or -1 (`tags.parent`), `G` tag key id list,
  `c` formula code, and `p` a path derived from the row's `id`. A `p` cell is
  null where the path is the derived one, and a string index where it differs.
  The only derivation is `assets/…` to `assets-mobile/…`, applied to
  `presentation.assets.lightPath` (`mobilePath()` in `tools/release.mjs`).
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
  leaves them out: prose such as `description`, `note`, `notes`, `effect` (tags),
  `usedFor`, `usedWhen`, `context` and `storage`; provenance such as `liveRef`,
  `source`, `file`, `usedBy`, `readBy`, `currentSymbol` and `currentAssetRef`;
  and the formula `expr` text (replaced by its RPN). The list is `DROP` in
  `tools/release.mjs`. A dropped column is not in the output, so it is not round-tripped.
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

Three checks are stricter than the workbench, and each is a loud build error
where the workbench would quietly give a wrong or odd answer: a malformed
number such as `1.2.3`; a call with the wrong argument count (the workbench
gives `NaN`); and an operator-like name inside `[ ]` read as an operator.
Tag names are resolved by key, except `tags.parent`, which is an id. The
workbench also accepts an id elsewhere; the release build does not.

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

`tools/release.test.mjs` compiles the real tables, writes the emitted module to
a temp file, imports it, and decodes it with a reference decoder that reads
only the module's data. It asserts:

- the module exports data only, with no functions, and `SOURCE_HASH` matches
  the inputs;
- every kept table and column round-trips exactly, rows and cells, and every
  input table is present;
- the tags table's parent and related references round-trip through ids;
- each formula gives the same value as the workbench engine at rank 1 and rank
  3, for no object and for each of the four objects (70 comparisons). The
  engine is cut from the source of `workbench.html` between `function findTag(k)`
  and `/* ---------- validation ---------- */`. A change that moves those markers
  fails the test and says so;
- the proposed placeholder is left out, with a note, as the workbench marks it;
- two compiles, and two CLI runs, give byte-identical output, and `--check`
  passes on a fresh file and fails on a stale one;
- a formula that reads `[rank]` matches the workbench at rank 1 and 3;
- each failure the design names fails the build, with its message: an
  unresolved `[key]`, a reference to the placeholder, a loop, a tag with no
  preview value, a wrong argument count, an unknown function, an unknown tag in
  an object, an unresolved reference in a dropped column, and an unreadable rank
  change.

## How the game would import it later (not wired now)

Build step: `node docs/tag-model/tools/release.mjs` writes the module. Runtime:
`import * as TC from './release/tag-constants.js'`, then read `TC.TABLES`
and evaluate formulas over the RPN with `TC.STR`, `TC.NUM`, `TC.FUNCS` and
`TC.BINOPS`. A release build would take this path. Dev and test keep reading the
tables. No file under `src/` imports this module, and this change does not
touch the engine.

## Size and commit decision

Measured on the 20 inputs at this commit's tables (`tools/release.mjs` stats;
gzip at level 9, computed by the CLI and the tests; the compile does not):

| | Bytes | Gzip |
|---|---|---|
| CSV, all 20 inputs | 11,802,698 | 900,649 |
| Module `tag-constants.js` | 4,480,047 | 632,010 |

Before derivation the module was 4,957,139 bytes (676,914 gzip). Deriving
`lightPath` saved 477,092 bytes raw and 44,904 gzip. 7,176 of 7,322 light
paths match the derived form; the other 146 (fonts and similar) are stored.

The module is 2,291,305 bytes of string table and 2,178,783 bytes of tables.
Most of the string table is asset paths and animation frame lists, which the
game does read.

**Decision: not committed.** The module is over the 1 MB limit. Its path,
`docs/tag-model/release/`, is already ignored by `.gitignore` line 23
(`[Rr]elease/`), so no `.gitignore` change is needed; `git status` never shows
it. Build it locally with `node docs/tag-model/tools/release.mjs`.

**Guard.** There is no committed file to compare, so `tools/check.mjs` compiles
the release build in memory and fails on any problem it reports. If a module
is ever committed, the guard should also compare it with a fresh compile, using
`node docs/tag-model/tools/release.mjs --check`.
