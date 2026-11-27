# Code style

How every new or changed line of code looks (owner, 2026-11-26).
It covers the files a change touches; it is never a reason for a repo-wide reformat.
A full restructuring pass follows [docs/ai/CLEAN-CODE-PROMPT.md](docs/ai/CLEAN-CODE-PROMPT.md).

## Layout

- **Allman braces:** every `{` on its own line, and every block braced.
- **One thing per line:** one declaration or statement per line.
- **Vertical lists:** a list of more than 3 items (arguments, properties, array elements) and every
  nested object goes one item per line, with trailing commas.
- **Scoped components:** each block, callback body or nested object on its own lines.
- **Ternaries:** the `?` and `:` parts each on their own line; a nested ternary indents one more level.

```js
const MaxCachedProjections = 512;

function ReferenceClassId(definition)
{
  if (classes.includes(definition?.class))
  {
    return definition.class;
  }
  return isMagic(definition)
    ? MagicReferenceClass
    : MartialReferenceClass;
}
```

## Names and values

- **Descriptive names:** never single letters. PascalCase for public or exported names, camelCase for
  private ones.
- **No magic values:** ids, class names, storage keys, paths, status words and tuning numbers become
  named constants at the top of the file, or JSON config.

## Reuse

- **Abstract the repeats:** near-identical methods, assignments or objects become one helper, base
  class or shared component.

## Comments and changelog

- **Few comments, at most 2 lines each,** saying why, not what. Names explain the code.
- No history, dates, issue numbers or owner quotes, and no comments about code that no longer exists.
- **CHANGELOG receipts:** 2 lines at most.

## Scope

- Clean up only the files the change touches.
- A style cleanup never changes behaviour; prove it with the same output before and after.
