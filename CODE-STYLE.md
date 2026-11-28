# Code style

How every new or changed line of code looks (owner, 2026-11-26).
It covers the files a change touches; it is never a reason for a repo-wide reformat.
A full restructuring pass follows [docs/ai/CLEAN-CODE-PROMPT.md](docs/ai/CLEAN-CODE-PROMPT.md).

## Data-driven: the game is an engine that runs configuration

Every rule, number, list, table, threshold, chance and player-facing text lives in JSON or CSV
config, so the owner can change the game without reading code, and in time from Score Studio.

- **Code only implements:** it reads config and behaves the same for every entry.
- **Where values go:**
  - Tunables: `content/source/balance<Name>.json`, read as `balance.<name>` from
    `src/content/balance.js` (small shared scalars sit at the top level from `balanceCore.json`).
    Every number carries its own `$note`; strings and lists carry none.
  - Player-facing text: a row in `content/source/uiStrings.csv`, never a literal in code.
  - A Core game's own content: its pack under `games/ashenspire/packs/core/`.
- **Configured values must apply:** read `registries.balance.<name>` from the registries the caller
  holds; use the authored `balance.<name>` only when no registries are given. Bad values still fail
  loudly. An Advanced row that nothing reads is a bug.
- **Variants extend a base** and hold only their tweaks; a new option is a config edit, not new
  code.
- **Engine internals stay in code:** caches, internal record ids, and result codes callers check.
- **Every change:** move the values the touched code uses into config, and prove the output is
  unchanged before and after.

## Layout

- **Allman braces:** every `{` on its own line, and every block braced — never single-line `if (condition) statement;`.
- **One thing per line:** one declaration or statement per line.
- **Vertical lists:** a list of more than 2 items (arguments, properties, array elements) and every
  nested object goes one item per line, with trailing commas.
- **Scoped components:** each block, callback body or nested object on its own lines.
- **Ternaries:** the `?` and `:` parts each on their own line; a nested ternary indents one more
  level.
- **Line length:** 100 characters at most.
- **File order:** imports, constants, private helpers, exports, with a blank line between groups.

```js
export function ReferenceClassId(definition, scoreReference)
{
  if (scoreReference.classes.includes(definition?.class))
  {
    return definition.class;
  }
  return isMagic(definition)
    ? scoreReference.magicClass
    : scoreReference.martialClass;
}
```

## Structure

- **Small pieces:** functions about 40 lines at most and 3 levels of nesting; split longer ones into
  named helpers. One concern per module.
- **Guard clauses:** return early instead of wrapping the body in if/else.
- **Explaining variables:** break long expressions and `?.` chains into named steps.
- **Abstract instead of editing many sites:** when one change needs edits in many places, add the
  helper, table or config entry that lets the next change happen in one place.
- **HTML as partials:** small named render helpers, not large `innerHTML` template strings.
- **Abstract the repeats:** near-identical methods, assignments or objects become one helper, base
  class or shared component.

## Names and values

- **Descriptive names:** never single letters; use descriptive nouns for every variable so the code
  is easy to follow. PascalCase for public or exported names, camelCase for private ones.
- **No magic values:** ids, class names, storage keys, paths and status words become named constants
  or config; tuning numbers go to config. A list of allowed choices and its default live together
  in config, never as a literal array in code.
- **Say what a helper returns:** no cryptic short names (`tFull` became `UiFullText`); a reader
  should know what a call gives back from its name alone.

## Tests

- **Tests are data-driven too:** expected values are read from the config they test, so a tuning
  change never needs a test edit.
- **Inputs are named:** test inputs go in a JSON fixture under `tests/fixtures/` or named constants.
- **Table-driven repeats:** repeated assert shapes become one helper that loops over a case table.
- **Pin behaviour, not numbers:** never copy a shipped number into a test to prove it equals itself.

## Comments and changelog

- **Few comments, at most 2 lines each,** saying why, not what. Names explain the code.
- **One sentence per line:** never split a sentence across comment lines.
- No history, dates, issue numbers or owner quotes, and no comments about code that no longer
  exists.
- **CHANGELOG receipts:** 2 short sentences at most.

## Scope and enforcement

- Clean up only the files the change touches.
- **A correction applies everywhere:** feedback given on one spot is fixed in every spot of that
  file and in every file touched later. New feedback is added to this guide.
- **Formatting is automatic:** run `npm run format:changed` before committing; never hand-format.
  CI reports changed `tests/` or `tools/` files that are not formatted
  (`npm run format:changed:check`). `src/` waits until the bundler reads multi-line export lists.
- **Smell report:** `npm run code:smells` lists magic numbers and strings, duplicated code, long
  functions and deep nesting in the changed files. Fix every finding in lines you touch.
  CI prints the report on every pull request.
- **Generated files stay compact:** edit the JSON source named in their header, never the output.
- A style cleanup never changes behaviour; prove it with the same output before and after.
- The pinned dprint formatter in `tools/code-quality` applies the layout, with its own 4-space
  indent, to files enrolled in its `policy.json`.
