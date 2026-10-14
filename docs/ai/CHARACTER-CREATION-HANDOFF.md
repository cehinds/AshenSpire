# Character creation continuation handoff

Updated 2026-10-14 for the local `worker/AddSubClasses/integration` assembly.
The verified browser snapshot is source `47e273338`, build `0.7.1.1516`, source
digest `6f221253cd`. The assembly subsequently reached `61fc43ab1` and merged
current `origin/dev` at `b452125ee` (base build 1519); the next fresh build is
pending as 1520. The source-47 captures below are evidence of that snapshot,
not of the later Frost inspector correction or dev merge. Feature publication,
the final discovered test suite and refreshed browser evidence remain pending.

## Implemented

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
| Production screens and reusable parts | [creation screen](../../src/ui/screens/customize.js), [lobby](../../src/ui/screens/lobby.js), [UI model](../../src/ui/models/CreationSubclassModel.js), [components](../../src/ui/components/creationSubclass.js), [UI notes](../subclass-creation-ui.md) |
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

- [x] Root reported 151 passing focused core checks before the final dev merge.
  Coverage includes eight eleven-card births, role semantics, visible hand
  choices, selected spells/maneuvers, legacy identity and migration, restamps,
  swaps, respec, invalid save references, solo/co-op combat and session restore.
  This targeted result is not a full discovered-suite result.
- [x] Focused ability, quick-start, class-tree, equipment-preview, respec and
  co-op regressions passed during implementation. UI checks cover actual screen
  mount, empty/partial picks and full stamped opening-card definitions rather
  than only card IDs/counts.
- [x] Built source `47e273338` as `0.7.1.1516`, digest `6f221253cd`; Chromium
  Playwright/CDP captured 64 QA records across 23 component folios and all seven
  creation pages at 1440×900 desktop and 390×844 phone widths. Touch/mouse
  subclass changes, eleven-card inspection and focus return were recorded.
- [x] The same standalone artifact's eight-choice matrix reports eleven cards
  for every subclass and the required 5/1/1/4 source counts. Caster Spells is
  visible for Starseer/Herald, including Monk; martial classes omit that step.
- [x] Root reviewed the rendered compact desktop/phone class layout after the
  measured zero-width inner-body fix. No further styling pass is scheduled.
- [ ] Finish the final display-only Frost starting-card projection and inspector
  acceptance. Thread the same disposable draft run/settings through the model
  and inspector; actor-derived Cold/Frost must display without being persisted
  onto birth refs. Root must record the accepted model/UI commit and tests here.
- [ ] Record the final discovered-suite result against the completed assembly.
  Earlier parallel lanes were stopped to free browser CPU; they do not establish
  a full pass. Include the exact tested source, command, totals and any failures.
- [ ] Build the final assembly (planned 1520), record its actual source/digest,
  and recapture Frost card inspection after the projection fix and dev merge.
  Source-47/build-1516 screenshots cannot certify these later changes.
- [ ] Publish the assembled worker, feature branch and refreshed playable
  preview through the agreed parent workflow; record exact refs, links and
  durable evidence only after publication succeeds.

Local source-47 evidence was recorded at
`/workspace/scratch/subclass-preview/screenshots/results.json` and
`/workspace/scratch/subclass-preview/screenshots/final-class-matrix.json`.
These are ignored scratch records, not shipped files or durable release links.
The page captures use rail navigation in a fresh creation preview and make no
completed-playthrough claim. The harness itself reports that it did not run the
full Node suite. Its optional music-manifest 404 uses the documented procedural
score fallback.

Useful focused shards: `tests/subclass-opening.test.mjs`,
`tests/subclass-stamped-preview.test.mjs`,
`tests/subclass-weapon-infusion.test.mjs`,
`tests/creation-subclass-components.test.mjs`,
`tests/creation-subclass-screen.test.mjs`, `tests/lobby-subclass-selection.test.mjs`.
Browser harness: `node tools/character-creation-components-qa.mjs --out <directory>`.
Keep bulky generated evidence in ignored scratch output or CI artifacts.
