# Character creation continuation handoff

Updated 2026-10-14 against assembled source `d3f6204f9` on
`Feature/updateCharacterCreation`. This replaces the earlier build-1322,
pending-art and design-only subclass status. Final integration checks and fresh
browser evidence are still being produced; do not treat this note as their result.

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
- [x] FrostMonarch source-derived weapon infusion shared by preview, solo,
  co-op and combat restore. No new binary card artwork was added.

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

## Verification and remaining work

- [x] Worker regression checks cover all eight eleven-card births, role semantics,
  visible hand choices, selected spells/maneuvers, legacy identity and migration,
  restamps, swaps, respec, invalid save references, actual solo/co-op combats and
  co-op session/snapshot restoration. The core shard has 22 passing tests.
- [x] Focused existing ability, quick-start, class-tree, equipment-preview, respec
  and co-op regression suites passed during implementation. Frost and UI workers
  have separate targeted acceptance shards.
- [ ] Record root's final assembled fast-lane/build results. Those checks are in
  progress; no full-suite or all-fast-lanes-green claim belongs here yet.
- [ ] Record Luna's fresh desktop/mobile captures and actual touch, inspection,
  focus-return and lobby results. New preview screenshots are not verified yet.
- [ ] Finish visual sizing and trim against the user's reference: compact controls,
  unstretched card faces, concise tile copy, readable mobile inspection and clean
  material/trim layering. Review the actual rendered screens before calling the
  artwork/layout match complete.
- [ ] Publish/link a refreshed playable preview and durable evidence after those
  checks. Old build-1322 scratch packages and captures are historical references,
  not screenshots of this implementation.

Useful focused shards: `tests/subclass-opening.test.mjs`,
`tests/subclass-weapon-infusion.test.mjs`, `tests/creation-subclass-components.test.mjs`,
`tests/creation-subclass-screen.test.mjs`, `tests/lobby-subclass-selection.test.mjs`.
Browser harness: `node tools/character-creation-components-qa.mjs --out <directory>`.
Keep bulky generated evidence in ignored scratch output or CI artifacts.
