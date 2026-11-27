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
    `src/content/balance.js`. Every number carries its own `$note`; strings and lists carry none.
  - Player-facing text: a row in `content/source/uiStrings.csv`, never a literal in code.
  - A Core game's own content: its pack under `games/ashenspire/packs/core/`.
- **Configured values must apply:** read `registries.balance.<name>` from the registries the caller
  holds, falling back to the authored `balance.<name>`. An Advanced row that nothing reads is a bug.
- **Variants extend a base** and hold only their tweaks; a new option is a config edit, not new code.
- **Engine internals stay in code:** caches, internal record ids, and result codes callers check.
- **Every change:** move the values the touched code uses into config, and prove the output is
  unchanged before and after.

## Layout

- **Allman braces:** every `{` on its own line, and every block braced.
- **One thing per line:** one declaration or statement per line.
- **Vertical lists:** a list of more than 2 items (arguments, properties, array elements) and every
  nested object goes one item per line, with trailing commas.
- **Scoped components:** each block, callback body or nested object on its own lines.
- **Ternaries:** the `?` and `:` parts each on their own line; a nested ternary indents one more level.
- **Line length:** 100 characters at most.
- **File order:** imports, constants, private helpers, exports, with a blank line between groups.

```js
export const MaxCachedProjections = 512;

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
- **HTML as partials:** small named render helpers, not large `innerHTML` template strings.
- **Abstract the repeats:** near-identical methods, assignments or objects become one helper, base
  class or shared component.

## Names and values

- **Descriptive names:** never single letters. PascalCase for public or exported names, camelCase for
  private ones.
- **No magic values:** ids, class names, storage keys, paths and status words become named constants
  or config; tuning numbers go to config.

## Comments and changelog

- **Few comments, at most 2 lines each,** saying why, not what. Names explain the code.
- No history, dates, issue numbers or owner quotes, and no comments about code that no longer exists.
- **CHANGELOG receipts:** 2 short sentences at most.

## Scope and enforcement

- Clean up only the files the change touches.
- A style cleanup never changes behaviour; prove it with the same output before and after.
- The pinned dprint formatter in `tools/code-quality` applies the layout to files enrolled in its
  `policy.json`.
