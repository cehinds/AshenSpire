# Clean-code pass: the owner's prompt

Paste this (or point an agent at this file) when asking for a structure / readability pass.
Replace `<SCOPE>` with the files, folder or feature to work on.

---

Restructure `<SCOPE>` into nicely formatted, readable, self-explanatory code with very limited
comments: easy to read, change and maintain, and data-driven so behaviour is tuned in JSON
config rather than in code.
**Behaviour, saves and visuals stay identical** unless I say otherwise.
Where two things that should match don't (sizes, behaviour), list them and ask before unifying.

## 1. Find the repetition first, then remove it

Before editing, list and count:

- methods that are the same or nearly the same
- modals, menus, pickers, lists, views and screens that rebuild the same thing by hand
- button behaviour and styling: press, hover, disabled, hold, sound, haptics
- structure: modules that do the same job but are laid out differently

For each family, make **one** shared piece:

- a function, a component or a partial view
- a base class with small subclasses
- a JSON `extends` chain, where config only holds the tweaks

Similar-but-different implementations share an **interface**:

- a JSDoc `@interface`, checked by `tools/code-quality`
- or an abstract base class
- for example, `Picker { Open, Select, Update, Close }`

Two menus that do the same job must behave the same and have the same proportions.

## 2. Data-driven

- Content, layout values, timings, sizes, copy keys and per-variant differences live in JSON config, not in code.
- Multi-branch rule pipelines (such as combat mitigation stages in `content/source/mechanics/protection.json`) and optional payload field mappings belong in configurable JSON or declarative tables, not nested `if / else if` chains, so updates and tuning stay simple.
- Code reads the config and behaves the same for every entry.
- Variants are JSON entries that `extends` a base and hold only their tweaks.
- Adding a new menu, modal, button style or option is a config edit, with no new code path.
- Validate config at load: unknown keys and bad values fail loudly, never silently fall back.

## 3. Components that update themselves

- Build screens from small components and partial views. Each one owns its own DOM.
- When state changes, update only the component that changed, only when it changes.
- Never rebuild a whole screen, modal or list for a local change.

## 4. Readable code

- **Names**
  - Descriptive: no single letters or vague words (`data`, `item`, `node`, `tmp`).
  - Functions are verb phrases: `build…` returns a node, `render…` fills a host, `open…`, `update…`, `read…`/`find…`.
  - Booleans start with `is`/`has`/`can`/`should`.
  - Exported names are PascalCase, private names camelCase.
- **Functions:** short, about 50 lines at most. A big function reads as a list of named steps.
- **Comments:** almost none. A name explains the code, not a comment. Never write history, dates, issue numbers or essays.
- **Layout**
  - Allman braces, and every block braced.
  - One statement per line.
  - A blank line between steps.
  - No line over 100 characters.
  - Run the repo formatter (`tools/code-quality`) last.
- **Multi-line:** one item per line, with trailing commas, for:
  - any call with 2 or more arguments
  - a nested call
  - an object or array with 2 or more entries
  - a parameter list with 3 or more names
  - a ternary
  - any condition with 2 or more parts
- **Literals:** repeated strings and numbers become named constants or config. Tunable values go at the top of the file or in JSON.
- **File order:** imports, then constants, then private helpers, then exports.

## 5. Safety rules

- Never move an expression out of an `if`, loop or `try`, or ahead of an early return or a side effect.
- Keep the order of side effects: DOM writes, listeners, focus, timers, saves, sounds.
- Keep exported names, object keys, ids, CSS classes and i18n keys, unless you update every reader.
- If a test pins exact source text, loosen the test so it checks the same property. Never weaken what it proves.

## 6. How to run it

1. Survey first: counts and file:line per family. Show me a ranked plan.
2. Work in small waves, one PR each. Agents own separate files, and commits are pushed as they land.
3. Each wave needs:
   - an Opus review at high effort, run against the code rather than your conclusions
   - the full `npm test`
   - sandbox QA with before/after screenshots at 1280x800 and 390x844
4. Merge when CI is green, then promote to `review`.
5. Report back in one short table: what was merged into what, how many lines went, and what is left.
