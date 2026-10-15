# Continue the JSON game modules work

This is an active implementation handoff, not a proposal-only project. First inspect `git status --short --branch` and `git log -1 --oneline --decorate`; branch tips and in-progress source changes can move while workers integrate. Read [CORE-SPEC.md](CORE-SPEC.md) for product authority, [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries, [IMPLEMENTATION.md](IMPLEMENTATION.md) for contracts, the [author guide](../../../games/ashenspire/guide.md), and the [module guides](../../../engine/modules).

## Current status

The feature branch contains the profile resolver and generated lock, the `ashen.core@1.0.0` content bundle, configured run/combat/rest/reward/shop adapters, the original legacy profile, and authoring CLI commands. The first adapter intentionally remains host-dependent and must not be advertised as portable or engine-neutral. The full module catalogue is larger than the configured adapter set: only implemented capabilities may be selected; unsupported future configured modules/instances must be rejected. Check the current resolver before documenting any new supported setting.

The focused headless checks passed for run profile behavior, title Continue/Load selection, starter/combat profile metadata, and individual cards/resources/defenses/stances/routes/class-selection disabled combat flows. No full browser acceptance has been recorded yet. UI work is still in progress; run a focused browser smoke after the UI worker reports ready. Do not claim an end-to-end product win, mobile parity or deployed preview without evidence.

The configured core includes four fixed classes, exactly six starting attribute points per class, the ten-card starter, 4+INT hand, one-channel damage, configured defenses/stances, deterministic three-act routes, class unlocks and one-service rests. Only Reaver is initially selectable; each unique terminal full-run win or defeat unlocks the next class. Rest services are Strategize, Smith and Level Up, one per visit, followed by full HP/SP/MP and flask recovery. Deck editing is Strategize-only; equipment editor timing is separate. See CORE-SPEC for the six class allocations, exact starting deck composition, stance edges, formulas and provisional values. Do not invent unsupplied mechanics.

## Next bounded work

1. Check the integrated tip and verify schema/default/lock freshness after the latest resolver and policy-binding changes.
2. Review the user-facing five-choice title at desktop and mobile sizes. With a loadable save, Continue and Load should be present; Continue selects the latest eligible save. With no loadable save, both doors are omitted. Confirm the imported profile selection and starter summary remain current.
3. Run a short configured core run from title through class selection, combat, a rest, reward/shop, save, reload and a terminal outcome; exercise the legacy preset separately. Record only observed behavior and errors.
4. Verify new module-off flows against actual runtime adapters and check that invalid or unsupported settings fail with a useful path. Keep profile snapshots pinned on existing saves and confirm mismatch refusal preserves stored bytes.
5. Run focused tests for any changed slice. Browser evidence is still required for user-facing behavior; do not expand to unrelated suites without a relevant change or failure.

## Author workflow

Edit `games/ashenspire/game.json` for small feature/settings overrides; edit `games/ashenspire/packs/core/*.json` for game-specific content. Read the module guide and schema before changing settings. Then run:

```sh
node tools/game-config.mjs validate --input games/ashenspire/game.json
node tools/game-config.mjs build
node tools/game-config.mjs check
```

`export` currently reports a required host adapter; `--portable` should reject it. Generated JS and lock files are build outputs. The current save schema is v25; profile pins are immutable for existing runs, and no v1 hot unload or automatic save migration is provided.

## Branch and authorization boundary

The user already authorized the work on `Feature/json-game-modules`. Keep source work in isolated worker branches and integrate reviewed commits only onto that feature branch. Do not promote, merge or open a PR to dev, test, release or main until the user explicitly authorizes that next step. This handoff adds no approval gate and does not require asking again for work already authorized. No claim of preview deployment follows from a branch push.
