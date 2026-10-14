# Character creation continuation handoff

Updated 2026-10-14. Gameplay and UI code is verified at `530abc04b`, based on
`origin/dev` `53e92b0da` (build 1519). The local assembly is
`worker/AddSubClasses/integration`; origin workers are published before merging
into `Feature/AddSubClasses`, then `Feature/updateCharacterCreation`.
Final playable build is 0.7.1.1520 / digest `ef85447e6b`, built from
`5423d7ce2b797c0fee0fe5a27d57612d85760a5b`. The delivery record below
separates this artifact source from the later documentation-only delivery commit. Earlier 1516 and 1520/digest `5db99f0428` previews are
historical snapshots and do not contain the final concise Class tiles.

## Implemented

- [x] Compact Class tiles: canonical five-to-seven-word lore, short play style,
  actual HP/SP/MP/AR/PR/DR/Poise/Ward/Evasion, equipped hands, relic and weapon art.
  Neutral accurately names the absence of an active birth stance. List and Grid
  use four desktop body lines and six phone lines, equal responsive heights,
  contained portraits and a native relic detail target.
- [x] Class → Attributes → Keepsake → Equipment → Feats → conditional Spells → Review.
- [x] Feats remains a browse-only Character / Class / Skills progression browser:
  canonical locks and descriptions, **zero starting feat grants**.
- [x] Reusable material, trim, symbol, artwork and text parts in the production
  UI/catalog. The current art pin is `hd-assets-v21`; the earlier 403/pending-pin
  handoff does not describe this source snapshot.
- [x] Eight opening subclass identities, two per base class, selected on the Class
  page with descriptions and an inspectable eleven-card preview. Review preserves
  the choice and its Class edit returns to both selectors.
- [x] New lobby UI explicitly selects a subclass for the connection owner and
  each couch seat; hello/pick/local-seat transport validates and carries it.
- [x] Draft deck previews support zero or partial ability choices and current
  settings. Final Begin/run creation still requires complete legal choices.
- [x] Exact opening composition, equipment-owned art reconciliation, compatible
  loadout alternatives, save/restore, class swaps, respec and co-op carriage.
- [x] FrostMonarch source-derived weapon infusion in solo/co-op combat and
  combat restore. No new binary card artwork was added.
- [x] Compact gold/soot creation styling: thin straight borders, contained icons
  above titles/details, equal two-column desktop choices and a readable single
  column on phones. The compact class body explicitly stretches to its tile
  width; it no longer collapses text into a vertical letter stack.
- [x] Stamped draft deck faces use current creation card rules and match opening
  equipment damage, costs, carriers and source fields. Empty/partial choices
  still render while Begin retains complete-selection validation.

| Base class | Opening choices | Existing top-tier progression paths |
| --- | --- | --- |
| Reaver | Heavy Knight / SwordMaster | Bulwark King / Warlord |
| Starseer | BattleMage / FrostMonarch | Conduit / Reservoir |
| Rogue | Ranger / Assassin | Shadow / Assassin |
| Herald | Cleric / Monk | Saint / Martyr |

## Deck and identity contract

An explicit opening subclass deals **5 subclass + 1 class + 1 weapon art + 4
basics = 11** playable instances. The five recipe roles are Smash, Counter,
Power, Skill, and Sweep or Spell. The class slot deliberately uses the existing
ability card; signatures remain reward content. The default basic split is two
Strike-role and two Defend-role cards, with equipment providing their faces.
The core class projection is not an additional playable card.

Starting choices replace recipe slots instead of appending cards. BattleMage,
FrostMonarch and Cleric retain two starting spell choices in Skill/Spell slots.
Monk retains one chosen spell in Skill and keeps its Sweep. Martial choices
replace a matching recipe role. Spell camp and recipe role are separate facts.

The single default art belongs to its actual item, choosing main hand, offhand,
then the existing unarmed fallback. Additional default equipment/package/global
cards are suppressed for this composition, including at later restamps. Player
installed mounts and independently earned cards remain owned; rewards may grow
an existing run beyond eleven. Custom dealt pool decks keep their existing rule.

`run.subclassId` is the explicit birth identity; `subclassDeckVersion: 1` retains
its composition policy. Its name/effects apply only while its parent class is
active and return when that class is equipped again. Existing XP, mastery and
tier gates are retained; configurable `progressionNodeIds` restrict only the
selected subclass's top-tier upgrade path. Old nodes and effects are unchanged.

**An absent opening field remains absent.** Legacy saves and older LAN clients
keep historical deck behavior and the earned tier-3 display fallback. Never
infer a new opening choice from `coreTags`: historical Rogue `assassin` shares an
ID spelling with the new opening Assassin but remains a legacy node. Respec
mapping must be gated on the explicit opening field, not the earned fallback.

FrostMonarch's configurable source recipe defaults to 2 extra Cold damage and
1 Frost buildup per landed HP-damaging weapon contact. It uses the actual held
weapon source and actor; pure spell casts and unarmed attacks do not acquire it.
Registered `damage:frost` source tags do not rewrite the primary damage identity,
and no `frostbite` status was restored.

## Where to continue

| Concern | Files |
| --- | --- |
| Authoritative rules and data | [SPEC](../../SPEC.md), [subclass definitions](../../src/content/subclasses.js) |
| Options, legality, draft recipes and identity | [identity model](../../src/model/subclasses.js), [deck recipes](../../src/model/subclassDeck.js), [class identity](../../src/model/classCard.js), [starting abilities](../../src/model/startingAbilities.js) |
| Birth, grants, saves and progression | [run state](../../src/model/state.js), [loadout composer](../../src/model/loadout.js), [save door](../../src/engine/save.js), [class tree](../../src/model/classTree.js), [respec](../../src/model/classRespec.js) |
| Source-scoped Cold/Frost behavior | [weapon infusion](../../src/model/weaponInfusion.js), [damage interpreter](../../src/engine/actions.js), `combatRules.js`, `combatCardTactics.js`, `combatExpansionActions.js` |
| Production screens and reusable parts | [creation screen](../../src/ui/screens/customize.js), [lobby](../../src/ui/screens/lobby.js), [UI model](../../src/ui/models/CreationSubclassModel.js), [Class summary](../../src/ui/models/CreationClassTileModel.js), [detached card preview](../../src/ui/models/CreationCardPreviewModel.js), [components](../../src/ui/components/creationSubclass.js), [UI notes](../subclass-creation-ui.md) |
| Catalog and authoring sources | [component catalog](../component-catalog.html), `src/ui/catalog/creationSpecimens.js`, `styles/kit.css`, `content/source/uiStrings.csv`, `tools/hud-component-studio/projects/character-creation/` |

The Studio scenes remain editable design/authoring material; changing them does
not automatically change gameplay. Reuse the production components when refining
screens. [Subclass UI notes](../subclass-creation-ui.md) list individual catalog
folios and screenshot pose parameters.

## Launch, editor and package paths

From the selected checkout, use [`run.bat`](../../run.bat) on Windows or
`./run.sh` on Unix. Both invoke [`tools/launch.mjs`](../../tools/launch.mjs),
refresh the current build and `dist/` aliases, serve the game and open a browser.
`node tools/launch.mjs --build-only` refreshes the outputs without a server;
`--no-open` keeps the server without opening a browser. For source development,
use `node tools/serve.mjs --host 127.0.0.1 --port 8080 --no-open` and open
`http://127.0.0.1:8080/index.html`.

The packed game is `build/AshenSpire.html` with its companion asset folders;
the light standalone page is `build/download/AshenSpire.html`. Launcher copies
are `dist/AshenSpire.html`, `dist/AshenSpire-<version>.html`,
`dist/download/AshenSpire.html` and the root `AshenSpire.html`. These generated
paths are not proof of publication. Windows packaging separately produces
`build/windows-installer/AshenSpire-Setup-<version>.exe`; see the
[installer instructions](../../desktop/windows/README.md). No installer release
is claimed by the creation browser checks.

The local authoring editor entry is [`editor/index.html`](../../editor/index.html).
Open [`editor/Start Studio.cmd`](../../editor/Start%20Studio.cmd) on Windows, or
run `node editor/server.mjs` and open `http://127.0.0.1:4317`. To select another
checkout, use `editor/Start-Studio.ps1 -Project <checkout> -Port 4318`.
[Studio instructions](../../editor/README.md) describe the Node 22+ requirement
and source-save checks. The editor is **authoring-only**, separate from the
shipped game. It edits its selected checkout; it does not switch branches,
commit, merge or publish. Compile saved content and reload the actual game to
verify changes. Workspace annotations and new scripts do not create runtime
behavior automatically.

The character-creation design scenes in
`tools/hud-component-studio/projects/character-creation/` are also authoring
material. Production folios can be opened with `?shot=components` on the source
or standalone game; the Class pose is
`?shot=customize&shotClass=starseer&shotSubclass=frostMonarch`.

## Verification and remaining work

- [x] Core engine/tool lane: **151 passed, zero failed**, source `f901b5467`:
  `node tools/verdict.mjs -- node tests/run-node.mjs --no-selftests --no-discovered`.
  This is separate from the discovered subclass acceptance tests.
- [x] Fast discovery: **665 unique files / 6,456 Node tests**, no unresolved
  failures. The certificate combines fifteen frozen-source proof shards, the
  exact original 42-file shard replay at final code `530abc04b`, and five new
  Class tests at `136ce67e0`. Runtime gameplay engine/model/data is unchanged
  from the core snapshot; intervening changes are UI, copy ownership and its
  reduced ledger. This is deliberately not a single-SHA full-suite claim.
- [x] Original timing failures, timeout and unrecognized-verdict attempts remain
  preserved. Full retries passed with the same assertions and deadlines;
  the measured-count replay checks fresh Node output rather than inventing a
  success line. The only code red was five copy sites newly owned by creation
  strings; they now reuse those owners. The required copy budget decreased
  `customRun.js` from 19 to 18, without increasing an allowance.
- [x] Final named-import, zoom-unit and copy-budget gates passed. Class/copy/
  catalog/native-detail acceptance passed **28/28**; Frost production-loader,
  stamped-preview and actual-hit acceptance passed **26/26**. Mounted-feat
  buildup keeps its original assertions; captured weapon identity remains frozen
  while prepared status metadata refreshes.
- [x] Native List/Grid browser verification covers all four Class selections at
  1440×900, 1440×720 and 390×844: four/four/six body lines; equal selected heights
  198/180/286.95 px; every child and portrait stays inside its border. Body type
  is 16 physical pixels. Relic controls have a non-overlapping 44 px target,
  touch opens the dialog, and close returns focus.
- [x] Final standalone 1520/digest `ef85447e6b` verified all eight subclasses
  with eleven cards and source counts 5/1/1/4. Only Starseer/Herald show Spells.
  Actual Assign-points → Intelligence 3 → four Equipment folds → Feats → two
  Spells → Review → Begin reaches Act I with no runtime errors. This screenshot
  route uses memory storage; it is not a serialized-slot browser proof. Save and
  co-op transport have separate automated acceptance coverage.
- [x] Final build and refreshed artifact captures passed: 64 capture/interaction
  records, plus the eight-subclass matrix and actual Begin flow. Final package
  and compact Class delivery details are recorded below.
- [x] Worker work is published on origin and merged into `Feature/AddSubClasses`,
  then `Feature/updateCharacterCreation`. Exact remotely verified commit/tree
  receipts are saved in the origin-state record below.
- [ ] Further visual/balance changes follow the owner's playtest feedback.

Fast checks follow the repository's `--no-slow` policy. Four slow files and tool
self-tests belong to the heavy test/release lane and were not run in this local
fast validation. No main/release merge or installer publication is claimed.

## Evidence and delivery record

- Fast certificate: `/workspace/scratch/subclass-validation/final-fast/final-certificate.json`.
  Its adjacent logs/results preserve every attempt and identify each proof SHA.
- Core: `/workspace/scratch/subclass-validation/final-core.result.json`.
- Concise Class proof: `/workspace/scratch/subclass-preview/concise-class-review-157b/`
  and `concise-class-grid-review-157b/`; combined gate receipt is
  `concise-class-review-157b/final-gates.json`.
- Historical 1520 captures: `/workspace/scratch/subclass-preview/screenshots-0.7.1.1520/`.
- Final artifact stamp: `/workspace/scratch/subclass-preview/build-stamp.json`.
  Version `0.7.1.1520`, digest `ef85447e6b`, artifact source `5423d7ce2`.
- Final captures: `/workspace/scratch/subclass-preview/screenshots-0.7.1.1520-ef85447e6b/`.
  `results.json` records 64 captures/interactions; `final-class-matrix.json`
  checks all eight decks; `final-begin.json` records actual Begin into Act I.
  The only expected network fallback is the optional music manifest (procedural score).
- Final package launcher: `/workspace/scratch/subclass-preview/packages/0.7.1.1520-ef85447e6b/AshenSpire-subclass-preview-0.7.1.1520/START-HERE.html`.
- ZIP: same parent directory, `AshenSpire-subclass-preview-0.7.1.1520.zip`
  (119,390,691 bytes). Includes 76 captures, 27 component groups, the exact
  standalone game and the design-only mouse layer editor.
- Fresh compact Class captures: `class-reaver-desktop-1440x900.png` and
  `class-reaver-mobile-390x844.png` in the final captures directory; all four
  classes were rechecked against the standalone artifact at all three sizes.
- Origin publication receipt: `/workspace/scratch/subclass-origin-state.json`.
  Origin worker → `Feature/AddSubClasses` → `Feature/updateCharacterCreation`;
  all three final trees must match the final local delivery tree. The earlier
  unpublished local feature wrapper is preserved under
  `backup/Feature-updateCharacterCreation-20261014`.
- Artifact source stays `5423d7ce2`; the later delivery commit changes only this
  handoff Markdown. Do not relabel the build as that later commit.

All scratch evidence is local, ignored output, not a durable public release URL.
The layer editor is an editable design library, separate from production code;
mouse changes do not automatically patch the game.

Default FrostMonarch's Ash Staff is a spell focus. Generic Bashing Blow has no
lending armament and resolves as unarmed: both inspector and combat show 13
Blunt with no inherited Cold/Frost. A resolved physical Sword source instead
adds 2 Cold and 1 Frost after an HP-damaging contact. Sword/Staff acceptance is
an explicit diagnostic fixture, not a legal starting Sword choice. Do not change
source rules or equipment legality merely to force a preview bonus to appear.

Useful focused shards: `tests/subclass-opening.test.mjs`,
`tests/subclass-stamped-preview.test.mjs`, `tests/subclass-weapon-infusion.test.mjs`,
`tests/creation-frost-inspector.test.mjs`, `tests/creation-class-tiles.test.mjs`,
`tests/creation-subclass-components.test.mjs`, `tests/creation-subclass-screen.test.mjs`,
`tests/lobby-subclass-selection.test.mjs`.
Browser harness: `node tools/character-creation-components-qa.mjs --artifact --out <directory>`.
Keep bulky generated evidence in ignored scratch output or CI artifacts.
