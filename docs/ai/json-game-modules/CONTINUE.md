# Continue the JSON game modules work

This is an active implementation handoff, not a proposal-only project. First inspect `git status --short --branch` and `git log -1 --oneline --decorate`; branch tips and in-progress source changes can move while workers integrate. Read [CORE-SPEC.md](CORE-SPEC.md) for product authority, [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries, [IMPLEMENTATION.md](IMPLEMENTATION.md) for contracts, the [author guide](../../../games/ashenspire/guide.md), and the [module guides](../../../engine/modules).

## Current status

The latest stable source build is `0.7.1.1539` (digest `f6930be11b`, source `ec08a6ca9`); the current-default JSON profile is `0.7.1.1535` (digest `e83c1c0ad6`, source `a330ee248`). Source branches: [`Feature/json-game-modules`](https://github.com/cehinds/AshenSpire/tree/Feature/json-game-modules) and [`Feature/json-game-current-preview`](https://github.com/cehinds/AshenSpire/tree/Feature/json-game-current-preview). Exact CI artifacts: [core](https://github.com/cehinds/AshenSpire/actions/runs/38703926669/artifacts/11957243379) and [current default](https://github.com/cehinds/AshenSpire/actions/runs/38703962043/artifacts/11957851105). These are test artifacts, not a published preview. The feature branch contains the profile resolver and generated lock, the `ashen.core@1.0.0` content bundle, configured run/combat/rest/reward/shop adapters, the original legacy profile, and authoring CLI commands. The adapter remains host-dependent and is not portable or engine-neutral. Only implemented capabilities may be selected; unsupported configured modules/instances are rejected. The `current` legacy preset has no module overrides; unsupported overrides fail validation rather than being ignored. Check the current resolver before documenting any new supported setting.

Final CI reports 85 focused tests passed against both defaults and all configured CI gates passing. The baseline command had exited 0 before the latest class loadout changes and is being rerun now. The reusable [browser suite](../../../tests/game-profile-ui.browser.mjs) passed earlier exact menu/import/map/combat/fallback checks; final-source UI suite rerun is in progress. Manual browser evidence now confirms all four classes can be created with their exact ten-card starters and weapons, combat/save-load including Rogue's two daggers, Smith attack/Block and shared-preview behavior, and the current-default legacy wizard→map→fight. A standalone Smith save→quit→Continue run passed on 1,538. Reward offers filter through six weapon and four armor groups plus core arts. Ten simulated runs had nine clear act one and all lose later; this is a balance signal, not a full-run victory result. No complete three-act victory is claimed. Gallery captures remain from 1,538 before final nonvisual fixes; do not imply they were recaptured for 1,539. Legacy mobile crowding is still open. Keep preview publication pending until deployment succeeds and is verified.

The configured core includes four fixed classes, exactly six starting attribute points per class, the ten-card starter, 4+INT hand, one-channel damage, configured defenses/stances, deterministic three-act routes, class unlocks and one-service rests. Only Reaver is initially selectable; each unique terminal full-run win or defeat unlocks the next class. Rest services are Strategize, Smith and Level Up, one per visit, followed by full HP/SP/MP and flask recovery. Deck editing is Strategize-only; equipment editor timing is separate. See CORE-SPEC for the six class allocations, exact starting deck composition, stance edges, formulas and provisional values. Do not invent unsupplied mechanics.

## Next bounded work

1. Record the final-source browser UI rerun and rerun `node tests/run-node --no-selftests --no-discovered` after the latest class loadout changes.
2. Complete or explicitly defer a full three-act victory path, including final reward/outcome and save/reload. No current result demonstrates this.
3. Check schema/default/lock freshness after any resolver or policy-binding changes.
4. Address legacy mobile title crowding as a separate UI item.
5. Verify new module-off flows against actual adapters and confirm unsupported settings fail with useful paths. Do not describe unimplemented current-module knobs as active.
6. Check the authorized preview workflow and report publication only after a successful deploy is independently confirmed. Keep host-dependent export and portable-runtime gaps visible.

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
