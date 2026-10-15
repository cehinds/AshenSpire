# Continue the JSON game modules work

Use this handoff with [CORE-SPEC.md](CORE-SPEC.md),
[IMPLEMENTATION.md](IMPLEMENTATION.md), and [PSEUDOCODE.md](PSEUDOCODE.md). The
core specification is the latest product authority for this proposal. Existing
runtime behavior still comes from the live checkout and `SPEC.md` until code
changes land.

## Paste-ready continuation prompt

```text
Continue the AshenSpire JSON-driven modular game work. First run
`git status --short --branch` and `git log -1 --oneline --decorate`. Read
CLAUDE.md, CONTRIBUTING.md, DEVELOPER.md and SPEC.md, then
`docs/ai/json-game-modules/README.md`, `CORE-SPEC.md`, `IMPLEMENTATION.md`,
`PSEUDOCODE.md` and `CONTINUE.md`. Treat the latest live user instruction as
authoritative and preserve all existing changes. Continue work already
authorized in this session without asking for that authorization again.

The current implementation baseline is still
3d40c190983069eec8d8a2370fb3f229ac376290. No modular runtime has been built or
verified. Start with one bounded source inventory: compare the proposed full
four-class Ashen core bundle with live authored data and runtime behavior, then
freeze the actual source/ownership map and only the contracts needed for the
core manifest, class selection, ten-card starter deck and first combat slice.
Verify every path and behavior against the current checkout. Do not scaffold the
full package catalog or invent executable CLI commands.

The product core is the full playable four-class Ashen bundle specified in
CORE-SPEC.md, not the minimal attack/pass harness. A technical fallback host
fixture may support infrastructure tests; it is not the user-facing core or
product acceptance. Implement incrementally with a behavior-preserving adapter.
Make the full Ashen core usable first; then prove optional modules can be
independently omitted while supported combinations remain playable. Do not move
all legacy code into core at once.

Workers commit and push to their own
`origin/worker/json-game-modules/<task>` branches. The integrator reviews and
integrates onto `Feature/json-game-modules`, then pushes that feature branch.
Do not merge or promote to dev, test, release or main until a later explicit
owner instruction. Make small, reviewable commits. Do not invent a commit SHA;
read it from `git log` after committing.
```

## Current status and bounded next task

The gameplay source baseline remains
`3d40c190983069eec8d8a2370fb3f229ac376290`; the previous handoff docs commit is
`49c5781fe`. The feature branch was created from the gameplay baseline. No PR
exists and no feature preview has been verified. This work updates planning
material only; do not imply the new core or modules are implemented.

First map the proposed full Ashen bundle against live authored data and runtime
source. Trace class definitions, cards/loadout, weapons/armor, stats, combat
rounds and stances, activities/routes, rewards, saves, UI and generated content.
Identify owners, mutable state, imports/dependencies, legacy behavior and the
smallest useful test coverage. Then freeze the source map and minimal
versioned contracts for a core manifest, class selector, starter deck and first
combat vertical slice. Keep the design specified in `CORE-SPEC.md` as the
product target; record remaining unknowns instead of filling them with invented
rules. Do not scaffold all runtime packages or build a generic empty engine.

The four-class product core and the technical fallback fixture are distinct:

- The product core selects Reaver, Rogue, Starseer or Herald, uses the specified
  default stats and ten-card starting deck, and supports the in-scope combat,
  gear, rest and activity interactions. It is the acceptance target.
- A fallback-only technical host (`ashen.fallback@1.0.0`) may provide a player,
  enemy, direct attack and pass when testing module-loader infrastructure. It is
  not a user-selectable core bundle and does not satisfy core gameplay
  acceptance.

## Canonical author configuration and resolution

The author document keeps one shape, for example:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {
    "cards": true,
    "resources": { "include": ["sp", "mp"] },
    "defenses": { "include": ["block", "poise"], "order": ["block", "poise"] },
    "stances": { "include": ["attack", "counter", "sweep", "defend"] },
    "art": false
  }
}
```

Here `core` selects a declared full bundle of core modules and settings; it is
not the minimal technical fixture. Resolve an author document as follows:

- A module included in the selected core bundle inherits that bundle's settings
  when absent from `modules`.
- A module outside the bundle is disabled when absent; `false` explicitly
  disables it.
- `true` enables the module using module defaults and selected-bundle defaults.
- An object enables it and resolves module defaults, then bundle defaults, then
  author values. Objects merge recursively; arrays and scalars replace.
- Do not implicitly activate another optional gameplay package beyond the
  explicitly selected core bundle. Technical prerequisites may bundle without
  activating unrelated features.
- Report resolved values and provenance. Pin the exact lockfile and resolved
  gameplay hash, including module/package artifact hashes, ABI versions and
  numeric policy, into the run/save compatibility identity.

Use explicit RFC 6902 operations for source edits and removal semantics.
`$comment` is source metadata and excluded from the gameplay hash. Keep original
definitions; make a validated derived projection and report exclusions. When a
resource is disabled, use authored fallback content or availability filtering;
do not silently zero costs or strip dependent effects. Built-in supported
combinations must remain playable, while invalid custom content receives clear
validation errors.

## Product decisions from the core specification

`CORE-SPEC.md` owns full detail. Preserve these decisions when summarizing or
implementing them:

- Four classes are in the product core: Reaver, Rogue, Starseer, Herald. There
  is no attribute-creation flow. Default six-stat profiles are Reaver
  STR2/DEX1/CON1/WIS1/INT1; Starseer STR1/DEX1/CON1/WIS1/INT2; Rogue
  STR1/DEX2/CON1/WIS1/INT1; Herald STR1/DEX1/CON1/WIS2/INT1.
- The ten-card opening deck is 3 Strike, 3 Defend, 1 Counter, 1 Smash,
  1 Sweep and 1 class-specific card. Deck and equipment editors are on; deck
  editing is available only at rest spots. Full rounds reshuffle and draw fresh;
  hand retention is off. Deck growth through rewards is allowed. Equipment
  editor timing is unrestricted by the user; a safe non-combat surface is a
  recommendation, not a settled requirement.
- Hand size is base 4 + INT: 5 for most classes and 6 for Starseer. Primary
  stat gains are STR +1 AR, DEX +1 DR, CON +10 HP, WIS +1 MP, INT +1 draw.
  Other resource formulas and thresholds remain unspecified. Do not invent
  them; use canonical authored content as the fallback for resource caps.
- Core values include HP, SP, MP, AR, DR, Accuracy, Evasion, Block and Poise.
  The only-confirmed Poise rule is damage taken equals
  `max(floor(damage * 0.75), 1)` while the effect applies: this is 25% less
  damage, not 75% mitigation. The old absorb/deplete/carryover-to-stagger rule
  is not approved. Guard at zero does not create damage. Active policy and
  high-value details remain open in CORE-SPEC; do not guess them.
- Stances are attack, defend, smash, sweep, counter, evade and prepare. Preserve
  confirmed edges: attack > smash/prepare; counter > smash/attack; smash >
  defend/prepare; sweep > counter/evade; prepare > defend/counter. Evade is
  accuracy-based and fully avoids or applies 2x damage as specified there.
  Damage is unified: no elements, rank, spell, feat or skill-XP systems.
- The run spans three acts, each with seven pre-boss nodes and a distinct boss.
  Activity types include events, fights, elites, treasure, shops and rests. Rest
  interactions include HP/SP recovery, healing, MP flask refill, level
  allocation and card upgrades; a direct MP refill is not established. Rewards
  include weapons, relics, combat cards, weapon-art spots, potions and armor;
  usually offer three choices and take one. Keep unsettled route-visibility,
  reward and level-up details in CORE-SPEC; do not add guessed rules.
- Deck editing is available only at rest spots. Equipment editing is enabled
  without a settled timing restriction; a safe non-combat surface is only a
  recommendation. Inspect by holding a target or tapping an already-selected
  target HUD. Normal click and `i` are not the
  default inspect action. Card faces show 2–3 total simple effect lines; inspect
  reveals details. Preserve the combat log.
- Reaver uses a greatsword, Starseer a scepter, Rogue two daggers, Herald a
  scepter. Allowed weapons: straight swords, shields, scepters, bows, greatswords
  and daggers. Armor: robes, light, medium and heavy. Gear does not alter the
  stable base animation keys: attack, smash, defend, counter, sweep, cast,
  evade, hit, hurt, status, defeated and staggered. Missing/off art uses
  low-poly fallback with identical geometry and interactions.
- Character level, attributes and card rewards provide 1–2 choices per act and
  3–6 level-ups; exact XP math is not settled. Do not add XP thresholds or other
  formulas without source/spec support.

This handoff does not override or amend the live `SPEC.md`. Resolve conflicts
between this proposed product target, `CORE-SPEC.md`, and live implementation by
recording the exact discrepancy and checking the current user direction, not by
silently mixing rules.

## Repository survey entrypoints

These are initial probes; confirm actual paths and imports on the current
checkout, especially because generated modules and branches can differ:

- Authored data: `content/source/nodes.csv`,
  `content/source/nodeRelations.csv`, `content/source/nodeEffects.json`,
  `content/source/characterCreation.json`,
  `content/source/worldAtlas.json`, `content/source/legacyDungeons.json`, and
  `content/framework/mechanics.json`.
- Runtime seams: `src/engine/actions.js`, `src/model/formulas.js`,
  `src/model/combatCardProfile.js`, `src/model/loadout.js`, `src/model/state.js`,
  plus framework bridge/registries. Trace imports and who owns mutable state;
  inspect global singleton installation before proposing isolated runtimes.
- Build/export: `tools/content-build.mjs`,
  `tools/framework-data-build.mjs`, `tools/config-build.mjs` and
  `tools/engine-export.mjs`. Existing builders compile authored JSON/CSV to
  generated modules. Engine export packages data; it is not module authoring,
  apply or runtime loading.
- Workbench: `workbench/tools.json` and `workbench/README.md`. A future HTML
  authoring tool belongs in the Workbench registry. `docs/tag-model/README.md`
  is a proposal, not a live module system.

## Proposed tool flow; commands do not exist yet

Keep existing commands distinct from these proposed verbs:

1. `validate` performs read-only schema, reference, dependency, provenance and
   supported-combination checks.
2. `preview` composes an isolated temporary bundle and runs the selected
   gameplay configuration without mutating authored sources.
3. `apply` explicitly validates and atomically updates authored module/config
   files, then runs existing builders and checks.
4. `export` writes deterministic data, schemas, package versions, artifact
   hashes, ABI and numeric-policy metadata; rejects required unsupported native
   code rather than dropping it.
5. Workers push reviewable commits to worker branches. The integrator reviews
   and integrates onto `Feature/json-game-modules`, then pushes it. Feature
   build and Pages publication are asynchronous; verify the live preview before
   claiming it works.

## Delivery and acceptance checklist

- Release boundary: workers push only their own
  `origin/worker/json-game-modules/<task>` branches. Integrator alone integrates
  to and pushes `Feature/json-game-modules`. No merge or promotion to `dev`,
  `test`, `release` or `main` without a later explicit owner instruction. This
  overrides contrary standing text in `CLAUDE.md`/`CONTRIBUTING.md`.
- Keep work small and preserve user changes. Check `git status` before editing
  and staging. Commit each focused step, subject ≤72 characters; push to the
  correct worker branch. Never invent a SHA. The main session reviews/integrates
  onto the Feature parent and pushes it.
- No PR exists. If one is needed later, target `Feature/json-game-modules` while
  this boundary holds. Do not promote branches under this handoff.
- Documentation-only updates require relative-link review after sibling docs
  are integrated and `git diff --check`; do not run source builds or tests. For
  later code, use targeted tests from `DEVELOPER.md`, documented fast checks and
  touched discovered shards. Inspect generated-file/stamp behavior before any
  writing check; never commit generated HTML.
- Future full-product acceptance must cover all four classes, default stats and
  ten-card opening deck; deck editing at rest spots only; equipment editing
  enabled without a user-imposed timing restriction; supported stance edges,
  class gear, damage, rewards, rest actions,
  distinct act bosses and saves. Exercise module resolution with missing,
  false, true and object values, nested overrides, provenance/hash stability,
  and supported combinations. Verify the full core remains playable as
  features are omitted. The technical fallback fixture is only an
  infrastructure test, never product-core acceptance.
- Keep resolved saves locked to the exact lockfile and gameplay hash, package
  artifacts, ABI and numeric policy. Test deterministic traces for two isolated
  runtime instances; no shared mutable singleton state. Save/config/module
  migrations stay explicit and separate.
- Visible UI work needs real screenshots and a verified preview. `Feature/**`
  builds the exact branch commit; Pages publishes later. No preview is verified
  by this handoff. Root README still contains stale PR-required wording; update
  it only with a verified preview and captures when there are visible changes.
