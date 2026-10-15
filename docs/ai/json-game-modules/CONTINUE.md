# Continue the JSON game modules work

This is an active implementation handoff, not a proposal-only project. First inspect `git status --short --branch` and `git log -1 --oneline --decorate`; branch tips and in-progress source changes can move while workers integrate. Read [CORE-SPEC.md](CORE-SPEC.md) for product authority, [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries, [IMPLEMENTATION.md](IMPLEMENTATION.md) for contracts, the [author guide](../../../games/ashenspire/guide.md), and the [module guides](../../../engine/modules).

## Current status

The stable source build is `0.7.1.1537` (digest `039d6633b9`); source branches are [`Feature/json-game-modules`](https://github.com/cehinds/AshenSpire/tree/Feature/json-game-modules) and [`Feature/json-game-current-preview`](https://github.com/cehinds/AshenSpire/tree/Feature/json-game-current-preview). Preview publication remains pending. The feature branch contains the profile resolver and generated lock, the `ashen.core@1.0.0` content bundle, configured run/combat/rest/reward/shop adapters, the original legacy profile, and authoring CLI commands. The first adapter remains host-dependent and is not portable or engine-neutral. Only implemented capabilities may be selected; unsupported configured modules/instances are rejected. The `current` legacy preset has no module overrides; unsupported overrides fail validation rather than being ignored. Check the current resolver before documenting any new supported setting.

Verification on the stable build: 75 focused tests passed; `node tests/run-node --no-selftests --no-discovered` exited 0; Workbench reported 79 passed with one Windows-only skip. The reusable [browser suite](../../../tests/game-profile-ui.browser.mjs) passed title-menu, JSON-import, five-node route, map/combat and cards/art-off fallback checks. Manual browser runs completed a three-turn combat win into mixed reward and Strategize with full recovery/one service, and a defeat that unlocked Starseer. Headless defeat→completion ledger→unlock→save/load and three acts with distinct valid bosses passed. Smith behavior passed in browser; standalone Smith save/Continue is still running. No complete three-act victory is claimed. Keep preview publication pending until its workflow succeeds and is verified; do not infer it from branch links or the passing checks.

The configured core includes four fixed classes, exactly six starting attribute points per class, the ten-card starter, 4+INT hand, one-channel damage, configured defenses/stances, deterministic three-act routes, class unlocks and one-service rests. Only Reaver is initially selectable; each unique terminal full-run win or defeat unlocks the next class. Rest services are Strategize, Smith and Level Up, one per visit, followed by full HP/SP/MP and flask recovery. Deck editing is Strategize-only; equipment editor timing is separate. See CORE-SPEC for the six class allocations, exact starting deck composition, stance edges, formulas and provisional values. Do not invent unsupplied mechanics.

## Next bounded work

1. Retrieve the standalone Smith save/Continue result and record what was actually verified.
2. Complete or explicitly defer a full three-act victory path, including its final reward/outcome and save/reload boundary. Do not substitute the passed three-act route validation for a victory run.
3. Check the integrated tip and verify schema/default/lock freshness after any new resolver or policy-binding changes.
4. Verify the five-choice title at desktop/mobile sizes if the UI changes; current browser evidence covers the exact menu and save-sensitive Continue/Load behavior, but does not establish broad platform parity.
5. Verify new module-off flows against actual adapters and confirm unsupported settings fail with useful paths. The configured module surface is narrower than the catalog; do not describe unimplemented current-module knobs as active.
6. Check the authorized preview workflow and report publication only after a successful deploy is independently confirmed. Keep the host-dependent export and portable-runtime gaps visible.

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
