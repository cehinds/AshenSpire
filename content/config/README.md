# content/config — presentation configuration

The third authored tree, after `content/source/` (game content) and
`content/framework/` (framework data). It holds the numbers and switches that
decide how the interface is **laid out**: sizes, positions, layers, timings, and
which parts appear. It holds no gameplay facts. Balance stays in
`src/content/balance.js`, and content stays in `content/source/`.

```
node tools/config-build.mjs            # compile: content/config → src/config/generated/ui.js
node tools/config-build.mjs --check    # gate: fail if the generated module is stale
```

`tests/run-node.mjs` runs `--check`, and `tools/launch.mjs` compiles before every
build. `tools/content-build.mjs` refuses any JSON here, by name, that the
generated module was not compiled from. Never edit `src/config/generated/ui.js`
by hand.

## Layout

One JSON file per subject. The folder decides where the file appears in
`uiConfig`, the module the game imports:

| File | Becomes | Owns |
| --- | --- | --- |
| `ui/tokens.json` | `uiConfig.tokens` | shared variables (design tokens), nothing else |
| `ui/scenes/w4.json` | `uiConfig.scenes.w4` | the W4 parent: band minimums, compact breakpoint, scene plate bleed |
| `ui/scenes/w4a-combat.json` | `uiConfig.scenes.w4a` | combat: bands, floor, hand, formation, target layer, overlays, combatant stack and meters, combat footer, layers |
| `ui/scenes/w4b-map.json` | `uiConfig.scenes.w4b` | map: header band, repeat-pick delay |
| `ui/scenes/w4c-dialogue.json` | `uiConfig.scenes.w4c` | dialogue: bands, portraits, context, footer, layers, entrance |
| `ui/components/<name>.json` | `uiConfig.components.<name>` | a part shared by several screens (card, buttons, tooltip, HUD …) |
| `ui/screens/<name>.json` | `uiConfig.screens.<name>` | one screen's own layout (armoury, shop, smith) |
| `ui/presentation/<name>.json` | `uiConfig.presentation.<name>` | a presentation table a src/ module used to hold as JS (map tiles, pose states, animation families, art anchors, environments, menus) |

A scene file's key is the text before its first `-`: `w4a-combat.json` is
`scenes.w4a`. Components, screens and presentation files use the whole file name.

A `presentation/` file is named for the module that reads it —
`presentation/mapPresentation.json` is read by `src/content/mapPresentation.js` —
so the JSON and its shim are findable from either end. Those modules keep their
exports and their reasoning and hold no numbers of their own;
`tests/config-migration.test.mjs` proves both, against a fixture captured before
the tables moved.

`components/dialogueFrame.json` holds the two pre-W4c dialogue numbers
(`portraitShare`, `sceneMinRem`) that `DialogueModel` still reads through
`wireframeUi.dialogue`. Delete it once nothing reads them.

## Sections

The top level of every file uses only these sections. Anything else is refused
by name.

| Section | Holds |
| --- | --- |
| `vars` | this file's own variables (compile-time only; not emitted) |
| `sizing` | how big: sizes, shares, minimums, maximums, breakpoints, band percents |
| `positioning` | where: anchors, insets, offsets, gaps, angles |
| `layering` | which layers exist, their z order, and whether each is enabled |
| `motion` | timings, fades, delays, entrance steps |
| `components` | which parts appear, and their options (counts, slot names, presets) |
| `behavior` | non-visual rules that aren't motion: drag thresholds, hysteresis, pick delays |

Inside a section, group by part (`sizing.hand`, `positioning.hand`) so one part's
numbers are easy to find across sections.

## Variables

Write a value as the string `"$name"` to use a variable. The compiler looks in
the file's own `vars` first, then in `ui/tokens.json`, and writes the plain value
into `uiConfig`. The game never sees a `$`.

- Put a value in `tokens.json` when two or more files share it, or when it is a
  design token (gutters, insets, the 44 px touch target, the 56 px footer
  minimum, the 768 px compact breakpoint, the reference rem).
- Put it in a file's `vars` when two places in that one file share it.
- Leave a one-off value as a plain number.

These are refused, each by name: an unknown variable, a variable that's defined
but never used, a cycle (`$a` → `$b` → `$a`), and a `$` anywhere except as the
whole string (`"calc($gap)"`, or a key such as `"$gap"`).

## Fractions

`{ "numerator": 5, "denominator": 8 }` compiles to the number `5 / 8`, computed by
the same division the hand-written code used, so the result is bit-for-bit the
old value. Use a fraction when the ratio itself is the design (a card's 5:8, W1's
21.6 of 95). A denominator of 0 is refused.

## Scene checks

Files in `scenes/` also have to satisfy the W4 contract:

- `sizing.bands` sum to 100;
- `sizing.floorPercent` is within 0–100;
- `layering.layers` ids are unique, and each `z` is an integer;
- every `motion.entrance` step names layers that `layering.layers` declares;
- `components.footer.actions` come from the known set (`back`, `skipSpeech`, `continue`);
- `positioning.portraits.visibleFraction` is greater than 0 and at most 1.

## Card presentation levels (`ui/components/card.json`, `behavior.fields`)

`behavior.fields` is the one place that says how much a card face shows:

```json
"fields": {
  "levels":   { "glance": [...], "focus": [...], "inspect": [...] },
  "surfaces": { "<surfaceId>": { "<level>": { "add": [...], "drop": [...] } } }
}
```

Rules `tests/card-presentation-levels.test.mjs` enforces, each of which would
otherwise fail silently:

- Region keys are exactly the keys of `balance.ui.equipmentCard.regions`. A key
  that drifts out of that set is a row the face loses with nothing to say so.
  `name` is never a region: it sits over the art and shows at every level.
- `inspect` names every region — it is the level whose job is to show
  everything, so a region it omits is one nothing ever shows.
- `glance` is a subset of `focus` is a subset of `inspect`, at the base level
  and on every patched surface. Choosing a card must never make it say less.
- A surface patch is **sparse** (`add`/`drop` against the base level), never a
  second full table, and may only name a surface `src/services/cardActions.js`
  already declares.

Nothing here sets a level: the level is derived from which card is lit
(`src/ui/components/cardSelection.js`) and a view mode only selects one of the
three. See `docs/COMPONENT-MODEL-ARCHITECTURE.md`.

## Adding a file

1. Put it in `ui/scenes/`, `ui/components/`, `ui/screens/` or
   `ui/presentation/`, using only the sections above.
2. Run `node tools/config-build.mjs`.
3. Read it from `uiConfig` (`src/config/generated/ui.js`).
4. Commit the JSON and the regenerated module together.

`src/content/wireframeUi.js` is a compatibility shim. It composes the old
`wireframeUi` shape from `uiConfig`, so existing readers keep working. New code
should read `uiConfig` directly.
