# DEVELOPER.md — extending AshenSpire

How to run, test, and add content. The architecture contract lives in
[SPEC.md §3](SPEC.md); exact engine signatures in
[docs/ENGINE-API.md](docs/ENGINE-API.md). This file is the practical guide.

For how work is branched, reviewed, and merged, see the
[working rules](AGENTS.md).

## Run & test

```
# play (no build step — any static server, or open index.html directly)
npx serve .            # then http://localhost:3000

# tests (22 assertions, SPEC §8)
node tests/run-node.mjs        # CI-style, exits 1 on failure
# or open tests/index.html in a browser — same suite, green/red list
```

## The CI door: a tool's silence is not its success (#12)

Every CI step that runs a checker is wrapped:

```
node tools/verdict.mjs -- node tools/verify-shipped.mjs
```

`verdict.mjs` refuses two greens CI used to accept, because CI reads exit codes
only: a tool that **exits 0 printing nothing** (its `main()` never ran on that
platform) and a tool whose verdict **counts zero** ("OK — 0 checks passed").
Exit codes are distinct on purpose — `3` is silence, `1` is a real failure or a
zero-work green, `4` is a child killed by a signal, and **`2` is *the harness
could not run*** — because those need different fixes.

**A harness death is not a finding.** An unhandled throw or rejection in a Node
child exits `1`, which is the same code as *a check ran and failed* — so the door
merged the two states it exists to keep apart, for the commonest instrument death
in this tree. It now answers **`2` (HARNESS could not run)** when a child exits
exactly `1` and its output carries Node's fatal-exception signature: a stack
frame together with the `Node.js vX.Y.Z` trailer Node prints only on the uncaught
path. Nothing else moves — `2`, `4` and any other code were already distinct.
**The boundary is the tell, not the word "Error":** a tool that catches its own
error and deliberately exits `1` is a finding and stays `1`, even if it prints a
stack; a non-Node harness that dies unhandled has no trailer and is read as a
finding. Both edges are planted in `--selftest`.

**So a tool that CI trusts must print a counted verdict.** The accepted forms
are a closed table at the top of `verdict.mjs` (`N checks passed`, `PASS — n/m`,
`GREEN (n/m)`, `n passed, m failed`, `N caught`, `n of m … ran`, `OK — N/N …`).

**The verdict line ENDS at its counted claim** (a closing `.` aside). Anything
trailing — prose, a semicolon, an extra clause — is unrecognised grammar and is
refused by name; print commentary on its own line. That is a contract rather
than prose to interpret, and it is deliberate: satisfying "accept *no failures*,
reject *errors occurred*, reject *one check failed*" is natural-language
understanding, which is unbounded, and every loss there is either a lie accepted
or an honest tool called a liar. **The cost is bounded and was paid in the same
commit: six summary lines in this repo carried trailing prose and each was a
one-line correction.**

**The line must state an unqualified success**, and the door proves it: a ratio
must be whole (`PASS — 1/27` is refused), a suite must report zero failures
(`1 passed, 4 failed` is refused), a negated line is never a verdict (`NOT PASS
— 1/10`), and **two verdict lines are ambiguous** — a tool that says `9 checks
passed` and later `0 checks passed` must not be readable as either. An unknown
grammar is silence, loudly, with the tool named.

**Wrapper flags are read only before the `--`.** `verdict -- node tool.mjs
--selftest` runs the *tool's* self-test; the separator is required.

Adding a grammar row is a contract change and ships with a plant in
`node tools/verdict.mjs --selftest`, which runs first in CI so the door is never
trusted unwatched. The two known-bads the contract requires live at
`tests/fixtures/verdict/silent_exit_zero.mjs` (prints nothing, exits 0) and
`tests/fixtures/verdict/vacuous_green.mjs` (well-formed verdict counting zero);
the assertion must fail on both.

**A step that never runs never reaches the door**, so `node
tools/workflow-lint.mjs` reads `.github/workflows/*.yml` as text and refuses a
step with no `run:`/`uses:`, and any **duplicate key at any mapping level** —
top-level keys, job IDs, job keys, step keys, `with:` blocks. YAML resolves
duplicates last-wins silently, and a parser has thrown that evidence away
before you can check it.

**It reads a CLOSED set of YAML forms, and an unknown form is refused by name**
— file, line, and the text — never treated as "nothing here". That is the same
call `verdict.mjs` makes about a grammar it does not speak, and it is the safe
direction: an unknown form silently skipped is how a duplicate key gets through
a duplicate-key checker. **The cost is stated rather than discovered: the day
someone writes a legal form this linter has not learned, CI goes red until it
learns it.** Anchors, aliases and tags (`&a`, `*a`, `!tag`) are refused on
purpose — an alias can expand into a mapping whose keys the linter would never
see. **Whether this should instead be a real YAML parse is an open dependency
question for Constantine** (this tree has no dependencies, and `linkcheck.mjs`
enforces that by refusing bare specifiers); the refusal is what makes the gap
loud in the meantime.

## The four layers (dependencies point down only)

```
src/ui/       renders model state, dispatches player intents  (DOM lives here ONLY)
src/engine/   generic interpreters + seeded procedural systems (headless)
src/model/    schemas, registries, formulas, validation, state (headless)
src/content/  pure data — every card/status/enemy/relic and every tuning number
```

Rules that keep this honest:

1. **No entity ids in engine/model.** There is no `if (status === 'bleed')`
   anywhere below `src/content/`. If you need new behavior, either compose it
   from the existing primitives (opcodes/formulas/triggers/status model) or
   extend a closed set — which is an engine PR with SPEC + ENGINE-API updates.
2. **All content is schema-validated** at boot (dev banner + console) and by
   test 15. Unknown fields, dangling ids, unknown opcodes all fail loudly.
3. **Every number a player sees comes from the engine** (`previewCard` /
   `previewIntent`). The UI never does math.

### UI models, components, and screen hosts

The detailed contract and migration sequence live in
[docs/COMPONENT-MODEL-ARCHITECTURE.md](docs/COMPONENT-MODEL-ARCHITECTURE.md).
For migrated slices, keep these responsibilities separate:

- `src/ui/models/` owns immutable, serializable, DOM-free presentation records.
- `src/ui/components/` renders those records and owns semantic markup and
  accessibility attributes.
- `src/ui/screens/` projects game state, owns lifecycle, and translates semantic
  commands into domain actions. It does not duplicate extracted markup.
- `src/ui/behaviors/` owns reusable interaction binding when a migrated slice
  needs it; callbacks do not live inside models.

Menu and Armoury are the reference implementations. Keep public entry points
compatible while migrating a vertical slice; do not bulk-move unrelated code.

### Armoury configuration and documentation

The current player contract is summarized in
[`docs/ARMOURY-LAYOUT-BRIEF.md`](docs/ARMOURY-LAYOUT-BRIEF.md); stable rendered
names and selectors live in
[`docs/ASSET-COMPONENTS.md`](docs/ASSET-COMPONENTS.md). The reusable semantic
model IDs remain in [`docs/COMPONENT-CATALOG.md`](docs/COMPONENT-CATALOG.md).

- Author view labels, pane composition, ratios, snap stops, compact thresholds,
  List/Grid defaults, comparison presentation, and card-class capabilities in
  `content/source/armouryUi.json`. Run the content build; never hand-edit
  `src/content/generated/armouryUi.js`.
- The persisted view keys remain `grid`, `rack`, and `hybrid` for save
  compatibility, but their player-facing labels are **Character**,
  **Inventory**, and **Hybrid**. Do not expose the compatibility keys as UI
  names.
- `equipSlots.csv` and the loadout ladder own equipment group order, position
  count, labels, short codes, lock state, and socket identity. Renderers iterate
  those records; they must not branch on Right Hand, Left Hand, Armour, or a
  fixed number of positions.
- `layout.cardClasses.inventoryItem.holdAction` is the class capability switch.
  When true and the shared hold-confirm setting is active, the folded face and
  expanded reveal are one action surface and one progress presentation. When
  hold-confirm is off, a tap still discloses details and the explicit in-card
  action remains available. Do not add a second nested action button to the
  hold-enabled presentation.
- `layout.comparison.presentation` chooses `tooltip` or `inline`.
  `holdPreviewDelayMs`, `tooltipWidthRem`, and `tooltipMaxHeightRatio` configure
  the shared tooltip. Hover/focus alone never opens comparison. A timed whole-card
  Equip/Move/Unequip hold also previews comparison through the same lifecycle;
  with hold-confirm off, the explicit action button commits and the card keeps a
  separate read-only hold-to-compare gesture.
- Armaments, Inventory, Cards, and Stats compose `trayModel` and `renderTray`.
  Folding collapses to the standard header without erasing the remembered
  expanded size. Sort controls and resize handles exist only while expanded
  and only when that tray model declares the corresponding capability.
  Armaments is currently non-resizable; Inventory also disables height resizing
  while it fills the Inventory-view pane.

After an Armoury contract change, update the JSON registry, Markdown catalogs,
interactive catalog description, GDD/SPEC, and changelog in the same change.
Run at least:

```bash
node tools/content-build.mjs --check
node tools/ui-components.mjs --selftest
node tools/tray-components.mjs
node tests/run-node.mjs
```

Cold-boot startup changes additionally run the rendered input contract and its
same-door known-bad corpus:

```bash
node tools/startup-gate.mjs
node tools/startup-gate.mjs --selftest
```

Exact combat-save changes additionally run the real Save / Save and Quit /
Load-review path at desktop and phone sizes, plus its copied-tree known-bad
corpus:

```bash
node tools/combat-save.mjs
node tools/combat-save.mjs --selftest
# after the one authorized artifact regeneration:
node tools/combat-save.mjs --artifact --screenshots
```

## Add a card (one file: `src/content/cards/<class>.js`)

```js
{
  id: 'moonSlash', name: 'Moon Slash', class: 'reaver', rarity: 'common',
  cost: 1, type: 'attack', keywords: [], icon: '🌙',
  effects: [
    { op: 'damage', target: 'enemy', amount: 6 },
    { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 },
  ],
  textTemplate: 'Deal {damage} damage. Apply {weak} Weak.',
  upgrade: { effects: [
    { op: 'damage', target: 'enemy', amount: 9 },
    { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 },
  ] },
}
```

Then add its id to the class `cardPool` in `src/content/classes.js` if it
should appear in rewards. Notes:

- `{damage}` tokens bind to effects **in order**; repeats are `{damage.2}`.
  `applyStatus` binds under its **status id** (`{weak}`). A literal number on a
  player-visible op without a token is a validation error.
- Powers whose stack count is invisible ("gain the power", not "gain N")
  use formula-valued stacks to opt out of the token rule:
  `stacks: { f: 'add', args: [1] }` — see Rallying Standard.
- `upgrade` is a partial override: present fields replace base ones;
  `keywords` replaces the whole list (that's how Kick Off+ drops Exhaust).

## Add a status (one file: `src/content/statuses.js`)

```js
{
  id: 'frostbite', name: 'Frostbite', icon: '❄',
  stackMode: 'unique', decay: 'onConsume',
  modifiers: { damageTakenMult: 1.3 },
  tooltip: 'Takes 30% more attack damage until consumed.',
}
```

The engine interprets `stackMode` (add/refresh/unique), `decay`
(none / perTurnEnd / {duration:n} / onConsume), build-up `meter`s
(max, growthMult, onFill effects), stat `modifiers`, and trigger `hooks`.
Bleed, Crimson Blight, and Staggered are all plain data here — test 17 proves a
brand-new status needs zero engine changes.

## Add a relic (one file: `src/content/relics.js`)

```js
{
  id: 'whetstoneFragment', name: 'Whetstone Fragment', rarity: 'common', icon: '🪨',
  triggers: [{
    on: 'damageDealt', once: true,
    if: { p: 'all', preds: [{ p: 'eventIsAttack' }, { p: 'eventSourceIsOwner' }] },
    do: [{ op: 'damage', amount: 4 }],
  }],
  textTemplate: 'Your first attack each combat deals {damage} extra damage.',
}
```

## Add an enemy (one file: `src/content/enemies/act<N>.js`)

```js
{
  id: 'gildedKnight', name: 'Gilded Knight', hp: [40, 44], poiseMax: 18, art: '♞',
  moves: {
    thrust: { intent: 'attack', damage: 10, weight: 55, maxConsecutive: 2 },
    parry:  { intent: 'block', block: 9, weight: 45, maxConsecutive: 1 },
  },
}
```

Add it to an encounter in `src/content/encounters/act<N>.js` so it can appear.
Special moves: `delay: { turns, whileCharging }` makes a telegraphed
delayed attack (Held Blade pattern — Stagger cancels it); `locked: true` +
`phases[].unlockMoves` gates moves behind HP-threshold phase changes.

## Add an event (one file: `src/content/events.js`)

```js
{
  id: 'testShrine', name: 'Test Shrine', art: '🕯',
  text: 'A quiet shrine offers a choice.',
  choices: [
    { label: 'Pray (heal 10% max HP)',
      effects: [{ op: 'heal', target: 'self', amount: { f: 'percentMaxHp', of: 'self', pct: 10 } }],
      resultText: 'You are mended.' },
    { label: 'Leave', effects: [], resultText: 'You leave it be.' },
  ],
}
```

Events fire on `?` (Unknown) map nodes. `effects` are the **same DSL** as cards,
but run-level (SPEC §3.4): `addCinders`, `addRelic {random?|id}`,
`removeCardFromDeck`, `upgradeCard {random?}`, `loseMaxHpPct`,
`startCombat {encounterId}`, plus `heal`/`damage`/`addCardToDeck`. `requires?`
(e.g. `{ cinders: 50 }`) gates a choice; a `startCombat` effect hands control to
the combat orchestrator after `resultText` shows. Nothing to register — every
shipped event is reachable via Unknown nodes.

> Each walkthrough above is **validation-checked**: add the snippet and run the
> suite — test 15 (content validation) rejects unknown fields, bad enums,
> dangling ids, out-of-set opcodes/formulas/predicates, and unbound template
> tokens. All six types (card, status, relic, enemy, encounter, event) are
> confirmed to validate from these exact examples.

## Reference — the closed sets (extend = engine PR)

| Set | Where defined | Contents |
|---|---|---|
| Combat opcodes | `model/schemas.js` `COMBAT_OPCODES` | damage, block, applyStatus, removeStatus, draw, discard, exhaust, addCard, gainEnergy, loseHp, heal, shuffleDiscardIntoDraw, enterStance, poiseDamage |
| Run opcodes | `RUN_OPCODES` | addCinders, addCardToDeck, removeCardFromDeck, upgradeCard, addRelic, addFlask, loseMaxHpPct, startCombat |
| Targets | `TARGETS` | self, enemy, allEnemies, randomEnemy, player, owner |
| Formula ops | `model/formulas.js` `FORMULA_OPS` | add, mul, percentMaxHp, missingHp, stacks, energySpent, blockOf, hpOf, cardsPlayedThisTurn |
| Trigger events | `TRIGGER_EVENTS` | every bus event (ENGINE-API §7) + ownerTurnStart/ownerTurnEnd + hpBelowPct |
| Predicates | `PREDICATES` | inStance, hasStatus, hasBlock, hpBelowPct, firstCardThisTurn, firstAttackThisCombat, cardTypeIs, everyNthCardThisCombat, random, eventIsAttack, eventSourceIsOwner, eventTargetIsOwner, eventStatusIs, all, any, not |
| Relic passives | `PASSIVE_KEYS` | runeGainMult, eliteExtraCardReward, flaskPowerMult, revealUnknown, shrineHealMult, shrineNoRest, powerCostReduction |
| Modifier keys | `MODIFIER_KEYS` | damageDealtMult, damageTakenMult, blockGainedMult, attackDamageAdd, blockAdd, skipTurn, retainBlock, blockCap, meterMaxGrowthDisabled |

Escape hatch: `src/content/scripts.js` (named functions callable as
`{ script: 'name' }` effects). Budget < 5% of content, each entry justified in
a comment. Current usage: **one** (Wondrous Draught — dynamic meta-selection
of other flasks' effect lists, which the DSL cannot reference).

## Add an SFX file (one file: `assets/sfx/<id>.ogg`)

Sound-effect ids automatically look for `assets/sfx/<encoded-id>.ogg`; for
example, the `cardPlay` cue looks for `assets/sfx/cardPlay.ogg`. The source app
loads that path directly, while the standalone bundler carries it through the
same `assetUrl()` seam used by art. No registration row is needed.

Use `SFX_MANIFEST` in `src/content/sfx.js` only when a cue needs a different
path or format. The first cue stays immediate and procedural while an unknown
file warms asynchronously; once that file is decoded, later cues use the
cached sample instead. A missing or unreadable file is cached as unavailable,
so every cue keeps the immediate synth. Decode failure logs the exact resolved
URL, making a bad asset diagnosable without delaying combat feedback. Run
`node tools/sfx-filename-convention.mjs` after changing this contract.

## Performance (SPEC §9 M4)

Combat feedback is **CSS-driven**: JS only toggles short-lived classes and
appends floating numbers/banners that self-remove after ≤320 ms (`src/ui/fx.js`),
staggered `STEP_MS` apart and skippable on click. There are **no per-frame
render loops** — paced combat playback (`playTimeline`) is `setTimeout`-driven
beat by beat, and the one timed loop in the codebase is the gamepad poller
(`src/ui/input.js`, ~60 Hz `setInterval`) which is **input, not render**, and
runs only while a controller is connected (started on `gamepadconnected`,
stopped when the last pad disconnects) — no idle cost. So there are **no
per-frame JS allocations**; frame rate is just the browser compositing a handful
of transitions, comfortably 60 fps. Ambient title effects (embers, gold glow)
are pure CSS and honor `prefers-reduced-motion` (`styles/ui.css`).

## Input — keyboard + gamepad (SPEC §7.3)

`src/ui/input.js` adds a focus cursor over interactive elements (arrow keys /
D-pad / left stick move it spatially; Enter / A activate — via `dispatchEvent`
so SVG map nodes work too) plus the gamepad poller. `cursor` actions activate
the focused element; `key` actions (Cancel/Menu/End-turn) dispatch the same
synthetic keys the screens already listen for, so a controller reuses every
existing keyboard handler with no per-screen rewrite. Which pad button drives
each action is rebindable in the overlay's **Controls** tab
(`src/ui/screens/controls.js`), persisted to `meta.settings.bindings`.

## First-run tutorial — the reachability probe

`src/ui/components/tutorial.js` positions its spotlight and bubble in the veil's
**local** coordinates via `anchorLocalBox()` (`src/ui/fx.js`) — never raw
`getBoundingClientRect()` offsets, which are post-`--ui-zoom` pixels and land at
`offset×zoom` when written back as inline `left`/`top`. That mistake once put
both of the tutorial's buttons below the fold at 1920×1080, and since `finish()`
is the only writer of `seenTutorial`, the veil came back on every reload.

`node tools/tutorial-reach.mjs` is the check: real headless Chromium at eight
viewports (zoom 0.62 → 1.70), advancing each step with **real mouse clicks at
real screen coordinates**, plus the two exits that need no geometry — Escape,
and a veil that lets board clicks through (`pointer-events: none`). It also
walks the real first-run path and asserts the flag persists. Run it after any
change to the tutorial, to `--ui-zoom`, or to the combat board's layout; it
prints the boundary of what it did not cover.

## Character creation — the short form (D26)

The creation screen's default view is **starting stats and starting armaments,
nothing else**. Every entry has a **FACE** (its name and its number, no prose),
a **REVEAL** one tap down (the authored sentence plus what the tables derive),
and — for a derived stat — a **RECEIPT** at the foot of the reveal (the
arithmetic, `statProjection`'s own string). Vocabulary and the tier field:
`src/model/disclosure.js`; the read model: `src/model/creationBrief.js`; the
renderer both this screen and the combat frame use: `src/ui/components/disclosure.js`.

**Which entries are short is DATA.** Each row carries its own
`disclosure: 'face' | 'reveal'` — attributes in `src/content/attributes.js`,
derived stats in `derivedStats.js`'s `presentation` block beside the rule each
describes. There is no list in any screen of which stats are "simple"; move a
row's tier and the screen moves with it.

`CHROME=/usr/bin/chromium node tools/creationbrief.mjs` is the check: the
tables imported through the real content door for the expectation, the app
served and booted in headless Chromium at `?shot=customize` for the
observation, faces clicked. `--selftest` plants each known-bad in its corpus as
file bytes in a copy of this tree and re-runs the whole tool against each.
**The corpus is not listed here.** This paragraph said "five known-bads" and
named them while the corpus stood at ten, and the count rotted without anyone
editing a line — a second copy of a fact nothing keeps in sync. The plants, what
each is aimed at, and what the green does NOT cover are printed by `--selftest`
itself; read them there.

### Character-creation component catalog

Open `?shot=components` on a served checkout to see the Class, Character,
Starting Equip, and Seed sections together as interactive reference specimens.
The catalog moves the production panels into labeled folios; it does not keep a
second copy of their markup or content. Select **Assign Points** to inspect its
live dialog and refusal states. `node tools/character-creation-check.mjs`
verifies the catalog at desktop and 390×844 mobile sizes alongside the player
flow.

## Standalone build (`build/AshenSpire.html`)

## Shared Load / Quit confirmation

`node tools/confirmation-modal.mjs` drives Load and Quit Without Saving from
both Map and Combat through the real Quick Menu at 1200×730, 390×844, and
320×640. It verifies the themed
`alertdialog`, neutral initial focus, cancellation and launcher restoration,
one-layer Escape behavior over Settings, explicit commit, viewport fit, and
44px action targets, while capturing overflow plus console/network diagnostics.
Add `--selftest` for its seven-plant copied-tree known-bad corpus; add
`--artifact --screenshots` only after the serialized standalone build has been
regenerated from frozen source.

## Standalone build (`build/AshenSpire.html`)

`node tools/bundle.mjs` emits a single self-contained HTML file to `build/` —
all CSS inlined, every ES module bundled into one classic `<script>` via a tiny
per-module-closure runtime (so file:// has no module/CORS issue). Double-click
to play; no server, no Node, no external files. Re-run after any source change.

## Balance & telemetry

`node tools/balance.mjs` regenerates [docs/BALANCE.md](docs/BALANCE.md): enemy
intent-DPS vs. HP sanity table, measured starting-deck DPS per class, and an
empirical Act-1 win-rate pass (the naive bot). The **Run History** screen
(Title → Run History) shows per-run outcomes and overall/per-class win rates —
the live win-rate telemetry the balance pass is tuned against. Re-run the harness
after any content or tuning change to catch regressions.

`node tools/runsim.mjs [N]` goes further: it plays **whole seeded runs** (map
path → encounters → combats → rewards → shrines/events/ambushes → act bosses,
Acts 1–3) with the same greedy bot plus a simple pilot. Any crash is a real
integration bug; the win rate is a completability **floor**, not a balance
target (the bot can't pilot combos or curate a deck). Baseline at 30 runs/class:
zero crashes, and the Herald completes full 3-act runs even naively.

## M1 known deviations (tracked for M2/M3)

1. **Frostbite** is specced (SPEC §4.4) but not shipped — its
   "next big hit +30%, then consumed" needs a conditional-consume hook no M1
   content uses. Lands with the M2 flask that applies it.
2. **Guilt** ships as an inert unplayable curse — its "lose 1 HP at turn end
   while in hand" needs an in-hand card hook (engine seam planned with M2's
   event system, which is the first thing that can grant Guilt).
3. **Warrior's Vow** enters Gorefire instead of "a stance of your choice" —
   a generic choose-one UI primitive is an M2/M3 feature.
4. **Goreblood** freezes Poise thresholds as well as Bleed (the
   `meterMaxGrowthDisabled` flag is global by design — strictly a buff; the
   card text says so honestly).
