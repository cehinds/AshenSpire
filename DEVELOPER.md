# DEVELOPER.md — extending AshenSpire

How to run, test, and add content. The architecture contract lives in
[SPEC.md §3](SPEC.md); exact engine signatures in
[docs/ENGINE-API.md](docs/ENGINE-API.md). This file is the practical guide.

For how work is branched, reviewed, and merged, see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Run & test

**The built standalone HTML is not committed on `dev`** (since 2026-09-26).
Every rebuild used to upload ~284 MB of new Git LFS objects (the 255 MB full file
and the 29 MB mobile one) and the repository's LFS budget ran out. Now
`AshenSpire.html`, `AshenSpire-mobile.html`, `build/*.html` and `dist/*.html` are
ignored: `node tools/launch.mjs --build-only` writes them locally, CI builds them
on every push and pull request, and `.github/workflows/dev-preview.yml` uploads
them as the `dev-standalone-<commit>` artifact — that is where a `dev` build is
downloaded. A `dev` clone needs no Git LFS. `tools/verify-shipped.mjs` fails if
any of them is tracked again. Historical builds (and `release`/`main`, which
still carry theirs) remain LFS pointers; readers of those verify content hashes.

A pull request still commits the one derived fact the build writes,
`buildordinal.json` (plus `src/content/changelog.generated.js`), and its receipt
names that ordinal. CI rebuilds and requires the rebuild to change nothing
committed, then runs `node tools/buildversion.mjs --check` against the fresh
build, so the box and the receipt are still checked to agree.


Settings: `src/ui/screens/settings.js` draws only the open Advanced topic and
searches every section; `src/ui/buildChannel.js` decides whether the debug-only
sections (tuning, layout, import/export, Defaults & sync) are shown — dev and
test builds only, never main or release; `src/model/settingsSync.js` keeps a
settings profile on GitHub. Review, design and next steps are in
[docs/SETTINGS-REVAMP.md](docs/SETTINGS-REVAMP.md); run
`node --test tests/settings-revamp.test.mjs`.

Every stat — HP, Mana, Stamina, Actions, opening hand, draw per turn, hand
size, AR, DR, PR, Ward, Poise — is one row of `src/content/derivedStats.js`
(ruleset 7, SPEC §3.5), priced by `statRowValue` in `src/model/derivedStats.js`.
`src/model/statRows.js` decides which rows a run, fight or preview reads (the
run's snapshot, the retired homes restated exactly for a pre-ruleset-7 run, or
the live table) and converts the retired settings keys. Hand behaviour options
live in `src/content/handRules.js` (defaults), `src/model/handRules.js`
(settings and the fight's rows), and `src/engine/handRules.js`
(draw/retention/discard planning). Run
`node --test tests/stat-rows.test.mjs tests/hand-rules.test.mjs tests/advanced-config.test.mjs tests/advanced-settings-groups.test.mjs`
for the focused rules, persistence and settings checks. Advanced → Stats →
Draw & hand keeps the Opening hand, Draw / turn and Hand size rows beside the
discard controls, under a live worked example.

`node tools/launch.mjs --build-only` produces the standalone aliases and an
external-art web edition in `build/web/`. **By default it builds the light art
tier** (owner, 2026-09-26: dev/test builds are light only): one single file,
`AshenSpire.html`, whose art payloads come from the committed `assets-mobile/`
twin tree (~29 MB, edition `light`, no size cap), and a web edition carrying the
same art. `--full-art` builds the release/main shape instead: the full-art single
file (~255 MB) plus the mobile one (`AshenSpire-mobile.html`, the same twins, held
under 30 MB). CI passes `--full-art` only for `release` and `main`. Changing anything under `assets/`
means regenerating the twins with `node tools/mobile-art.mjs` (needs `cwebp`
from libwebp on PATH); `node tools/mobile-art.mjs --check` is the Node-only gate
CI runs, and the policy lives in `tools/mobileart-policy.mjs`. Then run
`node tools/art-manifest.mjs --write`: `content/art-manifest.json` lists every
asset id (its runtime `assets/…` path) with the file each tier ships —
`light` (`assets-mobile/`) and `high` (`assets/`), each with bytes, sha256 and
pixel size; the placeholder tier has no file. `tests/art-manifest.test.mjs`
fails the core suite while it is stale. `src/ui/assetmap.js` resolves an id
through a high-res source when one is set (Settings → Display → Art quality),
else the built-in art. Serve the whole web directory for
mobile testing. Rendering-quality behavior and performance checks are described
in [Mobile performance](docs/MOBILE-PERFORMANCE.md).

The opt-in combat workshop is documented in [docs/COMBAT-WORKSHOP.md](docs/COMBAT-WORKSHOP.md).
Tag assignments and source ownership are documented in [docs/COMBAT-TAG-SOURCES.md](docs/COMBAT-TAG-SOURCES.md).
Run `node tools/attack-source-audit.mjs --write` after editing the tag junction;
`--check` verifies complete attack-source mappings and the review table.
`node tests/run-node.mjs` includes its focused engine regression suite.

Layout numbers (sizes, positions, layers, timings, which parts appear) are
authored as JSON in `content/config/`, the third authored tree after
`content/source/` and `content/framework/`. Its README explains the folders,
the sections, and the `"$name"` variables. `node tools/config-build.mjs`
compiles it into `src/config/generated/ui.js` (`uiConfig`), and
`tools/launch.mjs` runs it before every build. `--check` is the drift gate that
`tests/run-node.mjs` runs, and `tools/content-build.mjs` refuses a config file
the generated module wasn't compiled from. `src/content/wireframeUi.js` is now
a compatibility shim composed from `uiConfig`, so change the JSON, never the
shim or the generated module.
`ui-studio/` is a standalone local editor for that JSON (see
[ui-studio/README.md](ui-studio/README.md)): `node ui-studio/server.mjs` draws
the approved wireframes at real device sizes on a snapping grid, edits any
value with its unit and variables, validates the tree with `compileEntries`
before writing, keeps backups, and opens the live game at the chosen size.
`node --test ui-studio/tests/*.test.mjs` covers the model and the server;
`node ui-studio/tests/browser.mjs` drives the page in headless Chromium.
`node tools/combat-prototypes-browser.mjs` checks real workshop input at desktop
and phone sizes; `node tools/combat-prototypes.mjs --seeds=100` records the shared
three-build policy through the actual combat engine. Ordinary runs do not select
this ruleset yet. See the workshop's remaining content-expansion gate.

Boss destinations are assigned when an act map is created. `bossIds` lists the
terminal nodes, each carrying its saved `encounterId`; `bossId` remains a
compatibility alias. Resolve the chosen terminal through
`bossEncounterForNode()` in solo, LAN and simulations. Legacy maps without this
metadata resolve their original act boss without consuming RNG. Run
`node tests/branchingBosses.test.mjs` for topology, deterministic selection,
LAN choice and real save-manager round trips.
Loading validates explicit and legacy boss references before accepting a save.
Existing destination labels refresh from current content without changing the
saved graph's paths, encounter identities, selection or RNG counters. Run
`node --test tests/legacyBossReferences.test.mjs tests/bossDestinationLabels.test.mjs`
for content-update regressions in solo and LAN restoration.
Enemy expansion checks: `node tests/expandedRoster.test.mjs` covers all 46 new
moves, phases, seeded encounter reachability and ten named boss locations.
`node tests/branchingBosses.test.mjs` covers map and save compatibility.
`node tools/card-feedback.mjs --standalone` checks arrival/play/outcome feedback
using trusted desktop and phone inputs, including OS and in-game Reduced motion.
Enemy inspectors use `enemyMoveCards()` as a read-only presentation of the
existing weighted move selector; rendering never chooses or rerolls an intent.
Attack motion uses the actor/action, tag, intent and neutral precedence in
`src/content/actionAnimations.js`. Keep those mappings separate from mechanics.

Painted enemy art is selected in `src/content/enemyArt.js` and rendered through
the shared `enemySprite()` asset function. The twelve PNGs in
`assets/enemies-unity/` are unchanged imports from the Unity fork; retain their
384px square canvas and common foot anchor when replacing them. Keep the
original sprite files as fallback assets. See CREDITS.md and the extraction
manifest beside the images for provenance.
Combat stature is presentation-only: `CombatSpriteScaleModel.js` uses the
encounter pool to keep elites at 1.75x and bosses at 2x (Ashheart Dragon at 3x).
`combatSpriteGeometry.js` caches visible idle bounds, while painted player
stages expose their existing authored idle bounds. The shared formation fit
reduces all art together when space is limited, retaining per-row depth and
ground anchors. Names, health bars and their inspection targets do not shrink.
Run `node --test tests/combat-sprite-scale.test.mjs` and
`node tools/combat-sprite-scale-qa.mjs` against `COMBAT_QA_URL`; set
`COMBAT_QA_OUT` for screenshots outside the checkout. The browser check needs
Playwright and Edge and covers elite/boss ratios, feet, health bars, card
selection and returning from an enemy turn at desktop and narrow widths.
The fourteen new frames in `assets/enemies-expansion/` use the same canvas,
left-facing orientation and foot anchor (192, 364). They are transparent idle
paintings; runtime motion supplies their action feedback, not authored attack
strips. Preserve both imported Unity art and the original fallback assets.

Armament trading uses `src/model/armamentTrading.js` for inert quotes and atomic
commits. Stored ownership, equipped sets, capacity, currency and stock revisions
are rechecked at commit. Selling retains upgrades, mount history and permanent
discovery; it removes only card instances granted by the sold item. Legacy shops
without the new shelves retain empty shelves instead of rerolling their stock.
Run `node --test tests/armamentTrading.test.mjs` for purchase, sale, stale quote,
mounting and save round-trip coverage. How many cards a shelf of resting cards
holds — the merchant's shelves, a mount's deck list — is authored once at
`content/config/ui/components/card.json -> sizing.shelf`, laid out by
`.card-shelf` in styles/kit.css, and checked by
`node --test tests/card-shelf.test.mjs`. Weapon-art packages are authored in
`content/source/weaponCardPackages.json`; regenerate with `node tools/content-build.mjs`.
Combat HUD regression checks: `node tools/combat-hud-menus.mjs` exercises
desktop and phone potion quantities, cancellation, weapon-art targeting and
separate pile tabs. `node tools/ui-sweep.mjs --out docs/sweep` photographs every
room at a desk and a phone width and asserts the facts the 2026-09-11 review's
fixes stand on (the run band on every room, wrapped event choices, the phone
action row, the map camera under reduced motion). `node tools/screenreach.mjs --only 390x650` checks reachable
controls across screens. Potion selection uses the shared flask action plan;
only explicit Use may spend a charge. The map Quick Access faces retain real
44px target boxes to prevent neighboring invisible hit regions overlapping.

```
# play (no build step — any static server, or open index.html directly)
npx serve .            # then http://localhost:3000

# build the authored trees (launch.mjs runs the first two for you)
node tools/config-build.mjs            # content/config/**.json → src/config/generated/ui.js
node tools/content-build.mjs           # content/source/* → src/content/generated/ (+ the tag tree's views: tags, domains,
                                       #   pairings, property rules, and src/framework/data/{properties,relations}.js)
node tools/framework-data-build.mjs    # content/framework/*.json → src/framework/data/ (entities, terms, assets, …)
node tools/config-build.mjs --check    # drift gate: the generated UI config is current

# tests — the index is derived, never hand-counted (SPEC §8): grep -n "test('" tests/engine.test.js
node tests/run-node.mjs        # CI-style, exits 1 on failure (runs config-build --check)
node tests/run-node.mjs --no-selftests    # the fast half: engine suite, every *.test.mjs, tool verdicts
node tests/run-node.mjs --selftests-only  # the slow half: each tool's --selftest known-bad corpus
# or open tests/index.html in a browser — same suite, green/red list
```

Every `*.test.mjs` in the repository runs: `tests/run-node.mjs` finds them
(skipping `node_modules`, `dist`, `build`, `scratch` and dot-directories other
than `.github`) and hands them to one `node --test`. A new test file needs no
registration. A file that must not be spawned there goes in its `NOT_SPAWNED`
map with the reason. `.github/workflows/tests.yml` runs the two halves as two
Linux jobs on every pull request into `dev` and every push to `dev`; the
bundler's parse-gate fixtures (`node tools/bundle.test.mjs`, several minutes)
run as their own step in the self-test job.

```
# what raises the red failure banner, and what must not
node --test tests/debug-banner.test.mjs
```

The failure banner (`src/ui/debuglog.js`) is the game's one claim that a control
died, so it must never make that claim about a working screen. `window.onerror`
also carries browser *notifications* — `ResizeObserver loop completed with
undelivered notifications` is the one a player met, arriving with no filename and
no line (`at :0`) because there is no throw site. Those are logged as `NOTICE`
and raise nothing; `isBenignPageNotice()` is the anchored classifier, and
`tests/debug-banner.test.mjs` holds both edges.

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

## Plants and the same door (`tools/doorplant.mjs`)

Every `--selftest` corpus in `tools/` is one mechanic: a known-bad is written as
FILE BYTES into a copy of this checkout, the tool is run whole from that copy,
and the run must fail *by the red that plant names*. `doorplant.mjs` is the only
home of that mechanic; the tools supply the plants and the reds.

```bash
node tools/doorplant.mjs --selftest   # the harness's own door — seconds, no browser, no port
node tools/plantsites.mjs --check     # every plant's find-string still resolves — under a second
```

Both run on every pull request in `dev-preview.yml`, because a corpus that has
stopped being able to arm is green for the wrong reason and nothing else notices.

**Plants are authored with `\n`, and line endings belong to the CHECKOUT, not to
the plant.** The committed blobs are LF and Linux CI checks out LF, but a Windows
checkout under `core.autocrlf=true` — the Git-for-Windows system default — has a
CRLF working tree. An exact byte match on a **multi-line** find-string can never
succeed there. Until 2026-09-17 that made `node tools/startup-gate.mjs
--selftest` print `SELFTEST RED — 2 plant(s)/edge(s) failed` on Windows and green
in CI, and both failures read `PLANT SITE DRIFTED` — the same words real drift
produces, about two sites that had not moved. Single-line plants were unaffected,
which is what made it look arbitrary. `doorplant` now re-expresses each plant in
the target file's own line ending before matching and writes the replacement back
in that ending; `plantsites.mjs` already compared LF-normalised views, so this is
the same rule at the stage that edits bytes.

**So do not "repair" a drifted plant by spelling `\r\n` into its find-string** —
that is a plant which only arms on Windows, and it will read as drifted the next
time anyone runs the corpus on Linux. Author `\n` and let the harness translate.

`PLANT SITE DRIFTED` still means exactly one thing: the site is absent in the
file's own ending **and** exactly as authored, so the plant never armed and the
corpus is proving less than it claims. It is a hard red, never a skip. The known
backlog of genuinely drifted sites is pinned in `tools/plantsites-baseline.json`,
and `--check` fails in both directions — a site that starts resolving again must
be recorded in the same change, or the freed slack hides the next regression.

**Verifying a line-ending claim: count bytes, not lines.** Git Bash's
`grep -c $'\r$'` reports every line of an LF file as matching, so it cannot tell
the two apart. Ask Node instead:

```bash
node -e "const b=require('fs').readFileSync(process.argv[1]);let cr=0,lf=0;for(const c of b){if(c===13)cr++;if(c===10)lf++}console.log('CR',cr,'LF',lf)" styles/kit.css
```

## Receipts: nothing is promoted without one (`tools/receipts.mjs`)

Every merged pull request must be named by an entry in
[CHANGELOG.md](CHANGELOG.md) before that work is promoted from `dev` to `test`.
The changelog you can read inside the game is a projection of that file (#189),
so a merge with no receipt is missing for a **player**, not only for the
repository.

```
node tools/receipts.mjs --check              # origin/test..HEAD — the promotion
node tools/receipts.mjs --check --since dev  # any other range
node tools/receipts.mjs --check --pr <N>     # a pull request head: #N itself has a receipt
node tools/receipts.mjs --check --pr auto    # the same, N from GITHUB_EVENT_PATH / GITHUB_REF
node tools/receipts.mjs --selftest           # the known-bad corpus
```

`.github/workflows/receipts.yml` runs the selftest and the range check on every
push to `dev`. The range is bounded at the promotion target on purpose: the
question is never "does every merge in history have a receipt" — the
changelog's own header records which stretch is deliberately unreconstructed —
but "is *this* promotion complete", asked while the answer can still be acted
on. On a pull request into `dev` it runs the selftest and `--check --pr auto`
instead, which judges only that pull request's own number: the range there
would be about merges the author did not make, but a pull request with no
receipt of its own is the author's to fix, before merge.

The tool checks **coverage**, not truth: whether an entry exists naming each
merged pull request. Whether the prose is accurate is not machine-checkable, and
whether the ordinal on it is the one committed at that merge belongs to
`tools/about-changelog.mjs`, which owns the file's shape. If CHANGELOG.md ever
yields no pull-request references at all, that is this tool's own syntax having
moved out from under it, and it exits **2 (harness could not run)** rather than
reporting every merge as unreceipted.

Writing one is in the file's own header: a receipt for already-landed work names
the ordinal **as committed at that merge**; a receipt shipping in its own pull
request is written one ahead, then `node tools/about-changelog.mjs --write` and a
rebuild converge the box to the receipt.

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
- In combat, never mutate `run.loadout` from the Armoury. Prepared-set changes
  dispatch `swapArmament`; item replace/move/unequip actions dispatch
  `changeEquipment`. Both are player-turn-only, pay the authored equipment
  action price, and let the engine reconcile cards, resource vessels, Poise,
  events, and the persisted combat snapshot atomically.
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

Changes to the in-run Load door (`confirmSlotLoad`, `resumeRun`) run the real
Quick Menu → Load path: a newer-build slot must be refused with the run kept,
and a fight abandoned mid-combat must reload at turn 1 with the same HP, opening
hand and deck:

```bash
node tools/slot-load-door.mjs
node tools/slot-load-door.mjs --selftest
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

## Reword the interface (one file: `content/source/uiStrings.csv`)

Every sentence a screen says is a row in `content/source/uiStrings.csv`, and a
screen asks for it by id:

```js
import { t, tFull, tTip } from '../strings.js';
t('reward.continue')                         // the control's own words
t('reward.cinders.title', { amount: 40 })    // {tokens} come from the caller
tFull('reward.blocked.storage')              // the sentence it means
tTip('reward.skip')                          // the tooltip a small face gets
```

Three authored forms per id, never a runtime guess between them: `short` is
what the control wears, `full` is the sentence it means, `tip` is the tooltip
title. A blank cell means "this id has no such form", and asking for it throws
by name — an empty button is the defect this prevents. `extends` fills only the
cells a row leaves blank, so `reward.skip` is the house Skip with one sentence
changed.

Rewording the game is then a spreadsheet edit and a rebuild, touching no code:

```bash
node tools/content-build.mjs      # csv → src/content/generated/uiStrings.js
node tools/uistrings.mjs --check  # the ratchet, below
node tests/run-node.mjs           # tests/ui-strings.test.mjs holds the rules
```

**The migration is a one-way street.** Most screens still hold their own
sentences; `tools/uistrings.mjs` counts what is left, per file, against
`tools/uistrings-baseline.json`, and `--check` fails in BOTH directions — a
file that grew a hardcoded sentence, and a file that migrated one without
recording it (an overstated baseline hides the next regression in its slack).
A screen you migrate ends with `node tools/uistrings.mjs --write-baseline` in
the same commit.

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
- `onTurnEndInHand` (optional effect list) fires at the player's turn end for
  each copy still in hand, before the hand is discarded — Guilt's
  `[{ op: 'loseHp', target: 'self', amount: 1 }]`. Fires in solo and co-op
  combat. Its numbers bind to the card's text template after `effects`
  (Guilt's text says `{loseHp}`).

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

A **quest chain** is a sidecar beside the events in the same file: list its
steps and completing choices in `questChains`, and name each step's speaker in
`eventSpeakers`. A speaker is a row in `content/source/speakers.csv`
(`id,name,portraitKey`; the key names existing art, and a blank key shows the
name plate). A chain's steps open in the dialogue screen, one beat per
blank-line paragraph of the event's `text`. Both event screens commit a choice
through `commitEventChoice` (`src/engine/quests.js`); do not call
`executeRunEffects` and `recordEventChoice` separately, or completion is
skipped. `node --test tests/quest-dialogue.test.mjs` covers the door, the
validation refusals and the dialogue model.

> Each walkthrough above is **validation-checked**: add the snippet and run the
> suite — test 15 (content validation) rejects unknown fields, bad enums,
> dangling ids, out-of-set opcodes/formulas/predicates, and unbound template
> tokens. All six types (card, status, relic, enemy, encounter, event) are
> confirmed to validate from these exact examples.

## Reference — the closed sets (extend = engine PR)

| Set | Where defined | Contents |
|---|---|---|
| Combat opcodes | `model/schemas.js` `COMBAT_OPCODES` | damage, block, dodgeRoll, applyStatus, removeStatus, draw, discard, exhaust, addCard, gainEnergy, restoreMana, restoreStamina, loseHp, heal, shuffleDiscardIntoDraw, enterStance, poiseDamage, stagger, arcaneBuildup |
| Run opcodes | `RUN_OPCODES` | addCinders, addCardToDeck, removeCardFromDeck, upgradeCard, addRelic, addFlask, addFlaskCapacity, loseMaxHpPct, startCombat, swapClass, refillFlasks |
| Targets | `TARGETS` | self, enemy, allEnemies, randomEnemy, player, owner, ally, otherEnemies |
| Formula ops | `model/formulas.js` `FORMULA_OPS` | add, mul, percentMaxHp, missingHp, missingMana, stacks, energySpent, blockOf, hpOf, cardsPlayedThisTurn |
| Trigger events | `TRIGGER_EVENTS` | every bus event (ENGINE-API §7) + ownerTurnStart/ownerTurnEnd + hpBelowPct |
| Predicates | `PREDICATES` | inStance, hasStatus, hasBlock, hpBelowPct, firstCardThisTurn, firstAttackThisCombat, cardTypeIs, cardTagIs, everyNthCardThisCombat, random, eventIsAttack, hpDamagePositive, healPositive, manaPositive, eventSourceIsOwner, eventTargetIsOwner, eventStatusIs, skillLevelAtLeast, classLevelAtLeast, all, any, not |
| Relic passives | `PASSIVE_KEYS` | runeGainMult, eliteExtraCardReward, flaskPowerMult, revealUnknown, restHealMult, restDenied, powerCostReduction, poiseThresholdAdd, swapCostDelta, exposureBuildupMult, skillXpMult |
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
drives the player flow's stats step at desktop and 390×844 mobile sizes:
Standard and Assign points for every class, with the Hand and Draw chips
checked against the hand a solo fight deals. It does not visit the catalog.

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
The file is a local build output, ignored by git on `dev`; commit only the
`buildordinal.json` (and generated changelog module) the rebuild writes.

## Balance & telemetry

`node tools/balance.mjs` regenerates [docs/BALANCE.md](docs/BALANCE.md): enemy
intent-DPS vs. HP sanity table, measured starting-deck DPS per class, and an
empirical Act-1 win-rate pass (the naive bot). The **Run History** screen
(Title → Run History) shows per-run outcomes and overall/per-class win rates —
the live win-rate telemetry the balance pass is tuned against. Re-run the harness
after any content or tuning change to catch regressions.

Every simulator fight is the live fight: `src/main.js` and the simulators
(`runsim`, `balance`, `measure-classes`) build a run's combat through
`src/engine/runCombat.js` (`createRunCombat` — hand rules, rating rules, swap
price and equipment start statuses from the profile's settings, `{}` for a fresh
profile) and settle it through `runCombatEnd`, which carries HP, Mana, Stamina
and flasks into the next fight. The bots choose from `tools/simbot.mjs`
(`affordableCards`: playable and affordable in Actions, Mana and Stamina, priced
by the engine's own `cardPlayCosts`), set a refused card aside and play on, and
concede a fight still open after 150 turns as a stalemate.
`node tools/balance.mjs --check` fails when docs/BALANCE.md is stale
(`tests/balance-doc.test.mjs` runs it); regenerate with
`node tools/balance.mjs > docs/BALANCE.md`.

`node tools/runsim.mjs [N]` goes further: it plays **whole seeded runs** (map
path → encounters → combats → rewards → shrines/events/ambushes → act bosses,
Acts 1–3) with the same greedy bot plus a simple pilot. Any crash is a real
integration bug; the win rate is a completability **floor**, not a balance
target (the bot can't pilot combos or curate a deck). Baseline at 100
runs/class on 2026-09-24, under the live rules (plan A1, simulator parity): Reaver
12, Starseer 1, Rogue 54, Herald 58 wins; zero crashes.

## M1 known deviations (tracked for M2/M3)

Frostbite is not on this list: it is CUT (SPEC §4.4, which carries the
falsifier), not deferred.

1. **Warrior's Vow** enters Gorefire instead of "a stance of your choice" —
   a generic choose-one UI primitive is an M2/M3 feature.

Resolved: **Goreblood** no longer freezes Bleed as well as Poise. Bleed
thresholds are constant by design (#61), so `meterMaxGrowthDisabled` binds
only Poise, and the card text and tooltip say Poise only.

Resolved: **Guilt** is no longer inert. Since #1286 it loses its HP at the end
of each of your turns while in hand, solo and in co-op, through the card's
`onTurnEndInHand` hook (see *Add a card* above); the card text binds the amount.

## Dodge outcome presentation

The engine emits dodgeRolled once per resolved roll. The combat screen retains its last player receipt before animation playback, so skipping playback cannot discard the explanation. The shared dodgeReceipt formatter labels temporaryGuard as base guard; ordinary blockGained events remain responsible for the applied Block amount. The persistent result uses the standard modal shell and focus return; a live region announces new outcomes.

Regression coverage: node tests/framework.test.mjs checks weight-class costs, deterministic outcomes, atomic resource refusal, stale activation and ordinary Block absorption. Browser evidence must additionally exercise the result modal, keyboard focus and normal/reduced-motion playback on desktop and phones.

### Every-weapon card preview
Open `weapon-cards-preview.html` through the local server to browse every canonical
armament using the production card renderer. Search by name, type or tag; enlarge
any card or open its full explanations. Merchant offers and buy/sell inspectors
reuse this card while preserving the live quote, smithing tier and mounted cards.

Run `node tools/weapon-card-preview.mjs --shots <output-directory>` to check every
armament at 1280x1000 and 390x844, capture every card and grouped gallery screenshots,
and verify keyboard tooltips, full details, filtering and read-only merchant
inspection. Uses `tools/browser.mjs`; set `CHROME` when automatic discovery does
not locate your Chromium browser. `--shots` is optional for test-only runs.

### Mobile card interaction checks

Combat cards select before committing. A selected card retains its fan position and reveals above its siblings. Confirm using the shared hold duration/progress, a double-tap after selection, or a valid target tap/drop. A single extra tap does not play. Empty-field taps and Escape cancel; invalid/cancelled drags spend nothing. Test both a self skill and an enemy attack, including switching selection, at 320x568, 375x667 and desktop sizes.

Phone checks must include browser bars expanded/collapsed, full detail titles, and equipment explanations. Chromium mobile emulation cannot certify iPhone Safari fullscreen or audio. Unsupported fullscreen should explain Safari Share → Add to Home Screen. Volume sliders adjust game mix; device volume remains under the player's control.

Combatant overhead UI: `node tools/combatant-overhead-qa.mjs` checks delayed touch/hover/focus explanations, inspection, co-op, and grounded geometry at desktop, phone, narrow, and landscape widths. Set `COMBAT_QA_URL` to the source preview URL and `COMBAT_QA_OUT` for screenshots. Requires Playwright with Edge.

## Opening sequence

Advanced → Opening configures every scene, class line, caption, control, hold,
transition and tint, and the staging around them: which painting a scene draws
on (`art`, any shipped opening painting, not only its own), whether it plays
(`enabled`), where it plays (`order`), whether it carries a title banner, plus
the wireframe, artwork scale/fit/focus, text position, alignment, size,
container (present / visible / opacity / colour) and outline. `prologueSequence`
turns order and inclusion into the playing order; the indices it returns stay
indices into the AUTHORED `config.scenes`, which is what `run.prologue.scene`
and every `gameConfig.prologue.scenes.<id>.*` key are named for, and
`prologueResumePosition` is how a run paused on a scene since switched off finds
where to carry on.

Staging is held twice, from one table: `PROLOGUE_STAGE_FIELDS` names every field
that exists both under `presentation` (the house style) and under each scene's
`stage` (its own answer, read only when the scene sets `ownStaging`), and the
rows, the defaults, the validation and `prologueStaging` all read that table, so
a field cannot be added to one home and forgotten in the other. The `night`
wash cap that used to be an `if` in the renderer is that scene's own staging.

Scenes are added into named slots, never invented at runtime: the authored
sequence carries `slots` empty scenes (`extraA`…), switched off, so every key an
added scene writes is still a key the all-or-nothing importer can refuse a bad
value for. `prologueSceneCopy`, `prologueSceneClear`, `prologueReorderChanges`
and `prologueFreeSlot` are the list editor's whole model; Settings only renders
them. `presets.<id>` are three slots a whole opening parks in
(`prologueSlotPayload` / `prologueSlotChanges` — loading is a replacement, so
the change set names the keys to unset as well). Per-scene `music`/`stinger`
reach the audio engine through the `audio` option `main.js` passes to
`mountPrologue`; the settings preview passes none and keeps what is playing.
Deliberate quiet is the `quiet` bed (`content/music.js`), never `stopMusic()` —
the engine remembers the context it is in.

The controls are the FRAME's, not the caption's: a band (`.prologue-bar`) that
is the last grid row of every wireframe, so text that floats does not take
Continue with it. `presentation.controlsPosition: 'text'` puts them back under
the words. `node tools/screenshot.mjs --only prologue` photographs the opening
(`?shot=prologue`, with `?shotSettings={…}` to stage it), which is how a staging
change is checked against the real screen rather than against its selectors. The authored
data is in `content/config/ui/screens/prologue.json`; rebuild with the config
compiler. Scene file: `prologueScenePreset` exports the opening alone in the
art-studio preset shape that `parseAdvancedConfigFile` already imports, so the
scene file and the whole-game configuration carry the same keys and one
importer reads both.
`src/model/prologue.js` projects settings without gameplay RNG. The shared
`mountPrologue` renderer serves new solo games and the settings preview.
`run.prologue` stores a version, pending/complete status and scene index; new
runs snapshot the effective overrides in the existing advanced-config snapshot.
Old saves bypass the opening. The completion callback persists before revealing
the map. `tests/prologue.test.mjs` covers configuration/preset imports, source
immutability, class lines, destination, and interrupted save recovery.
### Ratings and starting pools
Settings → Advanced → Progression controls starting stat pools, class attributes and flasks, level-up and experience. Advanced → Stats is the one home for what those points turn into: one topic per trait (Actions, Draw & hand, HP, Stamina, Mana, Poise, Ward, AR, DR, PR) holding its stat row — the same nine fields everywhere (Base, STR, DEX, CON, WIS, INT, Per level, Min, Max) — and its constants, then the resistance, impact, break, status and per-source tables. Each trait topic shows a live worked example from src/ui/models/StatsPreviewModel.js. Source models: src/model/startingStatConfig.js (the stat-row editors), src/model/statRows.js, src/model/handRules.js and src/model/combatRatings.js; grouping: src/ui/models/AdvancedSettingsGroups.js; engine integration: src/engine/combatRatings.js. New runs snapshot configuration; saved combat snapshots preserve both meters and fractional buildup. Validate with node --test tests/starting-stat-config.test.mjs tests/combat-ratings.test.mjs tests/hand-rules.test.mjs tests/advanced-config.test.mjs tests/advanced-settings-groups.test.mjs.
