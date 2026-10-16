# Continue the JSON game modules work

This is an active implementation handoff. Inspect `git status --short --branch` and `git log -1 --oneline --decorate` before continuing; workers may be integrating newer source. This handoff was reconciled against `7591251bd`, not a new CI or deployment result. Read [CORE-SPEC.md](CORE-SPEC.md) for product authority, [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries, [IMPLEMENTATION.md](IMPLEMENTATION.md) for contracts, the [author guide](../../../games/ashenspire/guide.md), and the [module guides](../../../engine/modules).

## Integrated behavior

`Feature/json-game-modules` contains the profile resolver/lock, configured core run/combat/rest/reward/shop adapters, the full current preset, and the shared JSON card catalog. The approved catalog contributes **67 playable combat designs and three generated status cards**, plus two generated Strike/Smash helpers. Original proposal clauses and per-entry provenance hashes are retained separately from executable definitions and editable author defaults. Existing balanced current cards and the core ten-card starter remain intact; profile projection keeps one definition per stable ID.

The [base card pack guide](../../../games/ashenspire/packs/base-cards/guide.md) explains source files, reward groups, costs and defaults. Current admits all 67 combat designs. Core admits the compatible subset while preserving unified damage, no elements/ranks, and no retained hand. Explicit card requirements, including transitive status/linked-spell dependencies, filter rewards when a required module or protection pool is disabled. Four authored SP/MP resource variants cover each definition; disabled pools are not recreated. X cards spend remaining SP when available and use explicit fixed alternatives when SP is absent.

The closed host DSL now supports real card-zone selection/reordering/recovery/transformation, combat-only card changes, bounded dynamic metrics, cost growth, effect variants, linked spells, generated enemy burdens and intent reveals. Choices pause the paid action queue, have actual selection UI, and preserve continuation through saves/replay and co-op ownership. Shared status planners feed the existing interpreter and damage receipts; the [status contract](PROPOSAL-STATUS-RULES.md) documents lifecycle, targeting, conversions, protection, reactions and capability gates. Typed Decay/Divine behavior uses resolved gameplay identity, not visual references or the generic magic channel.

Important authored defaults and adapter representations:

- Transmute exhausts one chosen hand card for **10 Cinders**, settled once into the run or acting co-op seat. Alternative potion/component/scroll yields are not implemented by this default.
- Many Forms permits **two** concurrent stances. Each incoming action selects one defensive receipt by least incoming advantage, then the authored priority; expiration preserves the primary stance.
- Enemy burden cards occupy an explicit draw/hand/discard/exhaust overlay alongside authored enemy move plans. This is not a normal player deck. Stagger/Paralysis skip finitely and exhaust; Restrained enters hand, taxes matching melee/reach attacks and exhausts. Read Intent exposes the permitted hand identities/counts only during its authored reveal window.
- Scout orders up to three draw cards; Spread X selects eligible living enemies in deterministic order. Transform is combat-only. Chosen Retain expires after its next cleanup by default; Conceal snapshots both count and duration from stacks. A scroll resolves its canonical spell by ID, and its one-use limit belongs to each physical instance even after recovery/reload.

These resolve previously unspecified proposal parameters; they are editable defaults, not claims that every alternative described in the original proposal is implemented. Export still requires `ashen.legacy-adapter@1`; a portable or engine-neutral rules VM, hot unload and automatic old-save migration are not supplied. Unsupported settings/operations/references must fail validation rather than silently omit behavior.

The configured core still has four fixed classes with six starting attribute points, initially Reaver alone; terminal full-run wins/defeats unlock the next class. Reaver starts with 1 MP and gains 1 maximum MP per WIS. Strike is 6 damage/1 SP, Smash 12/2 SP, Sundering Art 36/2 SP/1 MP, and Star Spark 9 damage plus two Vulnerable/1 SP/1 MP. Base spells and weapon arts cost at least one MP unless an explicit disabled-resource variant applies; higher prices and later discounts remain meaningful. Each act starts at a single Rest, branches into three lanes, includes its second Rest at depth 6 and boss at depth 8, and retains authored fog. Strategize, Smith and Level Up share the painted Rest UI; exactly one confirmed service per visit performs full HP/SP/MP/flask recovery. Settings chooses the profile for future runs without mutating a pinned active run.

## Verification and remaining work

Focused tests exercise every current combat design through real preview/play, every admitted core design including resource variants, actual status effects/conversions, generated burden limits, namespace-safe card exports, and choice/reaction/co-op/save behavior. These establish targeted behavior; inspect the current test output before reporting a final combined gate result. Historical build ordinals, CI links and screenshots from the earlier handoff are not evidence for this catalog, and this document certifies no new browser capture, CI build or preview deployment.

The earlier broad runner was not completed; do not infer full-suite green from focused checks. Historical simulations cleared act one in nine of ten runs but all lost later. Earlier core and current browser smoke paths were separate, narrower paths. **There is still no complete three-act victory proof**, including final outcome and save/reload.

Next bounded work:

1. Recheck compiled pack/profile freshness and focused regressions after any integrated source changes. Keep artifact-mutating CLI tests serial and separate from generation/check commands.
2. Review current source and standalone browser evidence for the shared catalog, inspection, choice modals and co-op flows; record actual source/artifact provenance instead of reusing old captures.
3. Complete or explicitly defer the full three-act victory path and final outcome/save-resume proof. Check module-off adapters and useful rejection paths when changing compatibility.
4. Treat mobile layout issues, additional Transmute outputs, portability and deployment as separate work; no successful publication follows from a branch push.

## Author workflow

Edit `games/ashenspire/game.json` for supported settings, `packs/core/*.json` for core content, and `packs/base-cards/*.json` for shared definitions/groups/status rules/resource alternatives. Follow the linked schemas and guides. Regenerate sequentially:

```sh
node tools/base-cards.mjs
node tools/base-cards.mjs --check
node tools/game-config.mjs validate --input games/ashenspire/game.json
node tools/game-config.mjs build
node tools/game-config.mjs check
```

Run focused checks serially; the profile CLI tests mutate generated artifacts, so do not run these concurrently with generation or another profile-test process:

```sh
node --test --test-concurrency=1 tests/base-card-pack-source.test.mjs tests/base-card-pack.test.mjs tests/base-status-integration.test.mjs tests/card-zones.test.mjs tests/combat-reaction-stack.test.mjs tests/enemy-burden-ui.test.mjs tests/core-mana-policy.test.mjs tests/card-mana-policy.test.mjs
node --test --test-concurrency=1 tests/game-profile.test.mjs tests/game-profile-cli.test.mjs tests/game-profile-combat.test.mjs tests/game-profile-run.test.mjs tests/game-profile-run-rewards.test.mjs tests/game-profile-reward-filters.test.mjs tests/game-profile-map.test.mjs
node tools/base-cards.mjs --check
node tools/game-config.mjs check
```

Generated JS and locks are outputs, not independent authoring sources. Existing runs retain immutable profile pins; a new profile selection applies to future runs.

## Branch and authorization boundary

The user authorized work on `Feature/json-game-modules`. Workers commit/push their isolated `worker/json-game-modules/*` branches; the integrator alone integrates reviewed commits into the feature branch. **Do not promote, merge or open a PR to dev, test, release or main without a future explicit user instruction.** This handoff adds no approval gate for already authorized feature work. A pushed branch is not a deployed preview.
