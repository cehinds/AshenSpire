# Mechanics runtime language

The rules a port (Unity/C#) must implement. The reference is `interpreter.mjs`; the data is the
mechanic folders (`mechanic.json`, `model.schema.json`, `interface.json`, `service.json`,
`cases.json`), `ops.json` and `formulas.json`. The contract for the files is
`docs/ai/json-game-modules/MECHANICS-ARCHITECTURE.md`. A port is correct when every `cases.json`
passes and `tests/runtime-interpreter.test.mjs` scenarios hold.

## 1. State

All state is plain JSON. A call takes a state and returns a new one; the input is never changed.

```json
{
  "entities": { "<ref>": { "hp": 0, "maxHp": 0, "block": 0, "poise": 0, "poiseMax": 0, "sp": 0, "mp": 0,
                           "statuses": { "<id>": 3 }, "tags": ["enemy"] } },
  "piles": { "draw": [], "hand": [], "discard": [], "exhaust": [] },
  "mechanics": { "<slug>": {} },
  "rng": { "seed": 1 }
}
```

- Entity refs are the keys of `entities` (`self`, `target`, `enemy`, `player`, any other).
- Missing `hp maxHp block poise sp mp` read as 0, `statuses` as `{}`, `tags` as `[]`, each pile as `[]`,
  `mechanics` as `{}`, `rng` as `{ "seed": 1 }`. `poiseMax`, `spMax`, `mpMax` stay absent when absent
  (absent means no cap).
- Statuses hold integer stacks. A status at 0 or below is deleted, never stored.
- Piles hold card ids (strings).
- `mechanics.<slug>` is the mechanic's own model state. Only that mechanic writes it (`set`).
- `allEnemies` is the list of entities, in key order, whose `tags` contain `enemy`.

## 2. Names

A mechanic's slug is its `id`. Public names are `slug.name`. A slug may contain dots, so split
`slug.name` at the longest prefix that is a loaded slug.

- Command: `slug.command`. Event: `slug.event`. Query: `slug.query`.
- Runtime events (raised by ops): `runtime.poiseBroken`, `runtime.staggered`. Payload `{ "target": ref }`.

## 3. Entry points

- `command(state, "slug.command", params)` runs every handler `on: "command.<command>"` of that mechanic, in file order.
  No such handler: error `Unknown command`.
- `emit(state, "slug.event", payload)` raises the event (see 6).
- `query(state, "slug.query", params)` evaluates `interface.queries.<query>.value` as a value (section 4)
  with `params` as the variables. It does not change state. No query: error `Unknown query`.

Each of `command` and `emit` returns `{ state, events }`. `events` is the ordered list of
`{ name, payload }` raised during the call.

## 4. Values

A value is evaluated in a scope: the variable map (handler params, loop variables) plus the current
mechanic's state.

| Form | Meaning |
| --- | --- |
| number, boolean, null | itself |
| `"$name"` | variable `name`; `"$name.a.b"` reads a field path. If the value so far is an entity ref, the next key reads that entity's field. `"$state.a.b"` reads the current mechanic's state. Unresolved: error `Unresolved $name`. |
| `"$model.a.b"` | the calling mechanic's model: its own state `state.mechanics[slug]` merged over the defaults of its `model.schema.json` (`properties.<key>.default`, recursing into object `properties`). State wins, key by key, at every depth. Unresolved: error `Unresolved $model.a.b`. |
| other string | itself (entity ref, status id, card id) |
| `{ "f": op, ... }` | formula, section 7, evaluated to an integer |
| condition object | boolean (section 5) |
| array / other object | each element / each member evaluated |

Entity-ref positions (`target`, `forEach`, `of`) accept a literal ref, `"$var"` holding a ref, or
`allEnemies`. An unknown ref: error `Unknown entity ref '<ref>'`.

## 5. Conditions

| Condition | True when |
| --- | --- |
| `{ "all": [c...] }` | every c is true (empty is true) |
| `{ "any": [c...] }` | some c is true (empty is false) |
| `{ "not": c }` | c is false |
| `{ "cmp": [op, a, b] }` | `a op b`, op one of `< <= == != >= >`; a and b are values; `==` and `!=` compare deeply |
| `{ "hasTag": [ref, tag] }` | the entity's `tags` contain tag |
| `{ "hasStatus": [ref, id] }` | the entity has more than 0 stacks of the status |

## 6. Handlers and steps

A handler is `{ on, when?, do }`. `on` is `command.<name>` or `event.<slug>.<event>`.
Its variables are the command params, or the event payload. If `when` is present and false, the
handler is skipped. Otherwise its `do` steps run in order. Handler depth counts nested handler runs
(commands, listeners, `call`). Starting a handler at depth 32 or more is an error:
`Recursion depth exceeds 32`.

Steps (the first key found decides the kind, in this order):

| Step | Meaning |
| --- | --- |
| `{ "op": name, ...params }` | run a catalog op (section 8) |
| `{ "if": cond, "then": [steps], "else": [steps] }` | branch; missing branch is empty |
| `{ "forEach": ref, "as": name, "do": [steps] }` | for each ref in the list (`allEnemies`, a ref, a `$var` holding a ref or an array, or an array of those), run `do` with variable `name` bound to it |
| `{ "emit": "slug.event", "with": {...} }` | raise the event with the evaluated payload |
| `{ "call": "slug.command", "with": {...} }` | run that command with the evaluated params, now |
| `{ "set": "a.b", "value": v }` | write the evaluated value at the path in this mechanic's state, creating objects on the way |
| anything else | error `Unknown step` |

**Raising an event** appends `{ name, payload }` to `events`, then, for every loaded mechanic in load
order, for every handler in file order with `on == "event." + name`, runs the handler with the payload
as variables. Events raised by those handlers append after, depth first.

Handlers may listen to runtime events like any other: `{ "on": "event.runtime.poiseBroken" }` runs
when `poiseDamage` takes a target with poise above 0 to 0, with the variable `target` bound to the ref
(`runtime.staggered`, raised by `stagger`, works the same way). The runtime events belong to no mechanic,
so they are never a listed `emit` target of a mechanic and need no `requires`.

Load order is folder-name order (sorted ascending by folder name).

## 7. Formulas

Closed set in `formulas.json`; code reference `src/model/formulas.js`. A port reimplements it there.
Rules that matter to a port:

- The final result of an evaluation is floored once toward negative infinity.
- `min` and `max` on any node clamp that node's raw value before the floor.
- `stacks` with `per` floors the division at once.
- Before evaluation every `$name` string inside the formula is replaced by the variable's value.
- `of` reads entities by name from the state, plus aliases: every variable whose value is an entity
  ref also names that entity. So with variable `target = "enemy"`, `{ "of": "target" }` reads `enemy`.
  Inside an op's per-target evaluation the variable `target` is rebound to the current target.
- Entity view for formulas: `hp maxHp block`, `mana = mp`, `maxMana = mpMax` (or `mp` when absent),
  `statuses[id].stacks`. Context numbers `energySpent` and `cardsPlayedThisTurn` come from variables of
  those names when numeric, else 0.

## 8. Ops

`ops.json` lists every op and its params. `reference: "portable"` ops are implemented below; any
other op raises `legacy op <name> is not portable`. An op not in the catalog raises `Unknown op '<name>'`.
A runtime must refuse to start if a portable op has no implementation.

Common rules:

- `target` selects entities (section 4). If absent: the variable `target` when defined, else `self`.
  The op applies to each target in order.
- Numeric params are values. Amounts are floored and not below 0 (`max(0, floor(v))`) except
  `stacks` and `restoreStamina`, which are floored and may be negative.
- Pools never go below 0.

| Op | Effect on each target |
| --- | --- |
| `damage` amount, hits (default 1) | repeat `hits` times: take `amount` from `block` first, the rest from `hp` (min 0). `amount` is re-evaluated each hit. |
| `block` amount | `block += amount` |
| `loseHp` amount, nonlethal | `hp = max(0, hp - amount)`, ignoring block. With `nonlethal`, error if `amount >= hp`. |
| `heal` amount | `hp = min(maxHp, hp + amount)` |
| `applyStatus` status, stacks (default 1) | `statuses[status] += stacks`; delete at 0 or below |
| `removeStatus` status, amount | no `amount`: delete the status. Else subtract `amount`; delete at 0 or below. |
| `gainEnergy` amount (default 1), funded | `sp += max(0, amount - funded)`, capped at `spMax` if present |
| `restoreStamina` amount (default 1) | `sp = max(0, sp + amount)`, capped at `spMax` if present. A negative amount takes stamina away (the only portable way to lose sp). |
| `restoreMana` amount (default 1), funded, toFloorPct | by amount: `mp += max(0, amount - funded)`, capped at `mpMax` if present. With `toFloorPct`: `cap = mpMax or mp`; `floor = min(cap, floor(cap * pct / 100))`; `mp = cap` if `mp >= floor` else `floor`. |
| `poiseDamage` amount | `poise = max(0, poise - amount)`. If it was above 0 and is now 0, raise `runtime.poiseBroken { target }`. |
| `gainPoise` amount | `poise += amount`, no cap |
| `restorePoise` amount | `poise += amount`, capped at `poiseMax` if present |
| `stagger` | raise `runtime.staggered { target }` |

Pile ops (no `target`):

| Op | Effect |
| --- | --- |
| `draw` amount (default 1) | move up to `amount` cards from the front of `draw` to the end of `hand` |
| `discard` amount (default 1), random | move up to `amount` cards from `hand` to the end of `discard`: the first card, or with `random` the card at index `floor(r * hand.length)` |
| `exhaust` amount (default 1), random | same, into `exhaust` |
| `addCard` card, count (default 1, min 1), pile (default `discard`), position (`top` or `bottom`, default `bottom`) | insert `count` copies of the card id at the front (`top`) or end (`bottom`) of the pile. Unknown pile: error `Unknown pile`. |

## 9. Determinism

- No clock, no host randomness, no map iteration order that is not specified: iterate entities and
  mechanics in key insertion order (entities) and sorted folder order (mechanics).
- The only random source is `state.rng.seed`, a 32-bit unsigned integer. Draw `r` in [0, 1) with
  mulberry32, which also advances the seed:

```text
seed = (seed + 0x6D2B79F5) mod 2^32
t = seed
t = imul(t xor (t >> 15), t or 1)
t = t xor (t + imul(t xor (t >> 7), t or 61))
r = ((t xor (t >> 14)) as uint32) / 4294967296
```

  (`>>` is unsigned shift, `imul` is 32-bit integer multiply, `+` after `imul` wraps at 32 bits.)
  Only `discard` and `exhaust` with `random` use it today.
- The same state, command and params always give the same result and events.

## 10. Cases

`cases.json` is an array of `{ name, given?, when, then }`.

- `given`: a partial state (defaults filled as in section 1).
- `when`: one of `{ command, with }`, `{ event, with }`, `{ query, with }`.
- `then.entities`, `then.piles`, `then.mechanics`: partial match. Objects match key by key; every
  other value, arrays included, must be deeply equal.
- `then.events`: event names that must appear in the result events in this order (other events may sit between).
- `then.value`: for a query, deep equal to the returned value.
- `when: { "event": "slug.event", "with": {...} }` raises the event with that payload (runtime events such as
  `runtime.poiseBroken` included), so a listener is tested without a command that causes it.
- `then.error`: the call must fail with a message containing this text.

A case passes when every part of `then` holds.
