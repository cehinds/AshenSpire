# Continue the JSON game modules work

This is a handoff for the next AI session. It records product decisions and a
safe first task; it grants no additional authority. Continue work already
authorized in the active session without asking the user to authorize it again.
A live user instruction to continue or implement this plan authorizes its next
bounded slice.

## Paste-ready continuation prompt

```text
Continue the AshenSpire JSON-driven modular game work from the current feature
branch and these handoff docs. First read CLAUDE.md, CONTRIBUTING.md,
DEVELOPER.md, SPEC.md, then docs/ai/json-game-modules/README.md,
IMPLEMENTATION.md, PSEUDOCODE.md and this file. Treat the live user's latest
instructions as authoritative. This saved prompt grants no additional
authority; continue work already authorized in the active session without asking
for the same authorization again. A live user instruction to continue or
implement this plan authorizes its next bounded slice.

Before coding, run `git status --short --branch` and `git log -1 --oneline
--decorate`; preserve existing user changes. Workers commit and push only to
their own `origin/worker/json-game-modules/<task>` branches. The integrator
reviews and integrates onto `Feature/json-game-modules`, then pushes that feature
branch. Do not merge/promote to dev, test, release or main unless the owner
explicitly instructs you later. The architecture is future work: verify each
stated source path and behavior against the current checkout before relying on it.

Start with one bounded task: map the current live source/content/runtime seams
and compare them with the proposed module contract; report the actual paths,
ownership, mutable state and compatibility risks. Then freeze only the minimal
interfaces and representative JSON examples needed for a core-only playable
browser slice with a behavior-preserving legacy adapter. Do not scaffold the
whole proposed module catalog. Make the core-only game playable first. Add one
optional cards module that can be turned on and off, and verify both modes. Keep
changes small and reviewable. Stop and report any conflict between the design,
live sources, or user instructions before widening scope.
```

## Current status and next bounded work

At the baseline `3d40c190983069eec8d8a2370fb3f229ac376290`, the game is a mature,
playable monolith with content compilers, framework data, a Workbench and an
engine exporter. The modular JSON architecture, generic module kernel, package
catalog, JSON authoring/editor flow and core-only game do not yet exist. A prior
planning effort had two review rounds approved with corrections; the later
playable-core correction was approved with changes. Do not recast those reviews
as implementation or runtime verification.

Next do a **read-only source inventory** on the current feature head. Confirm
where actions, turn ownership, player/enemy state, damage, resources, activities,
saves, screens and content are actually defined. Trace the concrete dependency
and import paths; identify which current behaviors a compatibility adapter must
preserve. Record exact files and the smallest headless/browser checks that cover
those seams. Then freeze the first interfaces and example JSON, and implement a
thin **core-only playable vertical slice** only when authorized. Add one complete
cards package with defaults, schema, runtime implementation, guide, content,
UI, state integration and test cases; prove cards can be disabled while core
attack/pass remain useful. A coherent SP/block/equipment interaction can follow
after that slice works.

Do not start by moving all legacy code into a `core` folder, creating every
proposed package, or pursuing engine purity. Preserve existing behavior through
an adapter/preset while extraction proceeds incrementally.

## Product decisions to preserve

- **The core alone is playable.** It includes a default player and enemy, HP,
  direct attack and pass, target selection, a player/enemy response loop, a core
action opportunity budget independent of optional SP/MP/Actions, a simple enemy
  decision, victory/defeat/restart, a basic activity menu, inspection, low-poly
  procedural stand-ins, and save support. An empty host or engine shell fails
  acceptance.
- Optional packages are full, coherent modules: defaults/configuration,
  schema, implementation, author guide, content, UI, state ownership and
  integrations, plus cases where relevant. A switch must exercise real
  composition, not just hide a tab.
- Canonical author input is one object, for example
  `{"formatVersion":1,"core":"ashen.core@1.0.0","modules":{"cards":true,"resources":{"include":["sp","mp"]},"defenses":{"include":["block","poise"],"order":["block","poise"]},"stances":{"include":["attack","counter","sweep","defend"]},"art":false}}`.
  Missing/false disables an optional module; true uses defaults; an object
  enables it and overrides settings. Do not add a parallel enable list. Merge
  objects recursively; replace arrays and scalars; use explicit RFC 6902 patch
  operations for source edits and removals. `$comment` is author metadata,
  retained in source but omitted from the gameplay hash.
- Optional feature switches do not implicitly load another optional gameplay
  package. Technical prerequisites may bundle, but must not activate unrelated
  rules/content. Integrations declare the module that owns them and their
  version/conditional requirements. Core exposes stable providers for actions,
  targets, stats, damage, activity and presentation.
- Cards off: core attack/pass still work. Defenses off: damage passes through.
  Stances off: neutral stance works. Equipment and stats retain a useful
  baseline. Maps/dungeons off: core activities remain. Shops, rewards and
  quests must still offer meaningful choices without their usual route. Missing,
  disabled or failed art uses core low-poly stand-ins with the same hitboxes,
  targets and inspection affordances.
- Disabled resources require explicit content fallback or availability filtering,
  especially for MP spend-all/scaling cards. Never silently make every card free
  or delete effects that depend on the resource. Preserve original definitions;
  derive a projection and report exclusions. Built-in starter content must make
  each supported combination playable; invalid arbitrary custom content should
  produce clear validation errors.
- Module state is isolated per runtime instance. Commands, events, pipelines,
  ordering, numeric policy and RNG are typed and versioned. Rollback covers state,
  queued work and RNG. Events are committed facts; host side effects use a
  deduplicated outbox.
- Distinguish portable rules/data from native code. An export must reject a
  required unsupported code module; it must not pretend portability by silently
  dropping functions.
- A save pins the exact resolved lockfile and gameplay hash, including module
  artifact hashes, module ABI versions and numeric policy. A toggle or module
  version change starts a new run by default; v1 does not live-unload
  packages. Save migration is explicit and tested separately from configuration
  migration and module upgrades.

The proposed package catalog covers 26 optional feature families, including
cards, resources, defenses, stances and effects/statuses. See the
implementation contract for the complete package boundary. Do not create module
folders or scaffold the entire catalog during the initial slice.

## Repository entrypoints to inspect

Verify these against the live checkout; they are orientation points, not proof of
the proposed design:

- Authored input: `content/source/nodes.csv`,
  `content/source/nodeRelations.csv`, `content/source/nodeEffects.json`,
  `content/source/characterCreation.json`,
  `content/source/worldAtlas.json`,
  `content/source/legacyDungeons.json`, and
  `content/framework/mechanics.json`.
- Existing runtime seams: `src/engine/actions.js`, `src/model/formulas.js`,
  `src/model/combatCardProfile.js`, `src/model/loadout.js`, `src/model/state.js`,
  and the live framework bridge/registries. In particular, inspect global
  singleton installation and registries before designing per-runtime isolation.
- Existing builders and export: `tools/content-build.mjs`,
  `tools/framework-data-build.mjs`, `tools/config-build.mjs`, and
  `tools/engine-export.mjs`. Current authoring compiles JSON/CSV into generated
  modules; engine export is downstream packaging, not a module authoring/apply
  workflow.
- Workbench integration: `workbench/tools.json` and `workbench/README.md`.
  Add a new HTML tool there if one is eventually built. `docs/tag-model/README.md`
  is a proposal, not evidence of a live module editor/runtime.

Some named model and framework paths may move between branches or be generated;
use `git ls-tree`, `rg --files`, and imports from current entrypoints to establish
the current source of truth. Avoid treating generated output as the authored
source.

## Proposed author workflow (not available yet)

The suggested future loop is:

1. `validate`: read-only JSON/schema/reference/dependency and combination checks.
2. `preview`: compile in an isolated temporary workspace and run the actual game
   with a selected combination; no authored source mutation.
3. `apply`: explicit, validated, atomic update to authored module/config source,
   then existing builders/checks.
4. `export`: deterministic package/content bundle with schema, version and hash;
   reject unsupported native code requirements.
5. `push`: workers push reviewed commits to their own worker branches; the
   integrator reviews and integrates them onto `Feature/json-game-modules` and
   pushes that branch. Its CI preview is asynchronous and must be confirmed
   before calling it published.

No CLI with these commands exists at this baseline. Keep existing commands and
proposed commands visibly distinct in docs and UI.

## Delivery rules and checks

- User's current release boundary is strict: workers commit and push to their
  own `origin/worker/json-game-modules/<task>` branches; the integrator reviews
  and integrates onto `Feature/json-game-modules` and pushes that feature branch.
  No dev/test/release/main merge or promotion until an explicit later owner
  instruction. This overrides the standing contrary promotion workflow in
  `CLAUDE.md` and `CONTRIBUTING.md`.
- Workers use separate `worker/json-game-modules/<task>` branches/worktrees.
  The main session manages, reviews and integrates their work into the feature
  branch. Use the requested worker model guidance (GPT-6.1 Sol medium/low and
  GPT-6 Luna; Luna 6.1 is unavailable) and read-only reviewers; do not create
  chats or message people.
- Inspect `git status` before edits and before staging. Do not discard user
  changes. Use small commits with subject ≤72 characters and push each worker
  commit to that worker's branch promptly. The integrator merges worker commits
  onto the feature branch and pushes it. Never invent a commit SHA; obtain the
  current SHA from `git log` after commit.
- Documentation-only changes need link checks and `git diff --check`; do not run
  source tests/builds for docs-only edits. For source changes, choose targeted
  suites from `DEVELOPER.md`, then the repo's documented fast checks and touched
  discovered shards. The standard broader command is
  `node tests/run-node.mjs --no-selftests --no-discovered`. `node tools/launch.mjs
  --build-only` and `node tools/plantsites.mjs --check` may be relevant for source
  changes; inspect current docs and scripts for stamp/generated-file handling
  before invoking anything that writes. Do not commit generated HTML.
- For runtime acceptance, test core-only and each supported optional-module
  combination, including every module disabled, each module enabled, and
  targeted pair/higher-order invariants. Verify legal actions, turn advancement,
  outcomes, save/load and config validation. Run two isolated instances with the
  same seed and prove equal traces with no shared singleton/global bridge state.
  Keep legacy numeric behavior in trace comparisons during adapter extraction.
- For visible UI changes, capture fresh screenshots and provide a verified
  playable preview. The `Feature/**` workflow builds the exact branch commit;
  Pages publication happens later through a workflow run. README's old
  PR-required wording is stale and should not be repeated. Do not claim preview
  success until the live link is tested.
- No PR has been created. If a PR is needed later, it targets the
  `Feature/json-game-modules` parent branch while the release boundary holds; do
  not promote branches under this handoff.
