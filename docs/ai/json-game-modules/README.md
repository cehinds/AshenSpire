# JSON-driven Ashen Spire modules

**Status: partial implementation on [`Feature/json-game-modules`](https://github.com/cehinds/AshenSpire/tree/Feature/json-game-modules); preview publication is pending.** The source work is also tracked on [`Feature/json-game-current-preview`](https://github.com/cehinds/AshenSpire/tree/Feature/json-game-current-preview). The stable source build is `0.7.1.1539` (digest `f6930be11b`, source `ec08a6ca9`); the current-default JSON profile is build `0.7.1.1535` (digest `e83c1c0ad6`, source `a330ee248`). CI artifacts: [core profile](https://github.com/cehinds/AshenSpire/actions/runs/38703926669/artifacts/11957243379) and [current-default profile](https://github.com/cehinds/AshenSpire/actions/runs/38703962043/artifacts/11957851105). A versioned profile resolver, generated artifact lock, core/current presets, Ashen content pack, source-backed run/combat adapters and author CLI are implemented. The configured adapter still requires `ashen.legacy-adapter@1`; a portable rules VM, broad runtime/module extraction and complete cross-engine export are future work. The current configured profile and original legacy profile remain separate entry paths.

The user-facing profile starts with four fixed classes, a ten-card starter, route progression, one-service rests, shops and rewards. Each route act has eight depths including its boss; branching alternatives add nodes within a depth, with three lanes by default and one shared node at each of two rest depths. New profiles begin with Reaver; unique terminal wins or defeats unlock Starseer, Rogue, then Herald. The title offers five choices when a valid save exists (Continue, New Game, Load Game, Settings, Exit); Continue chooses the newest eligible save, and Continue/Load disappear when no eligible save exists. Rest offers one of Strategize, Smith or Level Up and then restores HP/SP/MP and both flask types. Manual deck editing is Strategize-only.

## Start here

- [Game author guide](../../../games/ashenspire/guide.md): the small `game.json`, feature switches, validation/build/export commands and limitations.
- [Core pack guide](../../../games/ashenspire/packs/core/guide.md): classes, cards, routes, rests, rewards and shops.
- [Core product specification](CORE-SPEC.md): user-confirmed mechanics and unresolved/provisional values.
- [Architecture](ARCHITECTURE.md): kernel, always-on foundation, module and game/content boundaries.
- [Implementation contract](IMPLEMENTATION.md): runtime ownership, resolver/update/save contracts and acceptance criteria.
- [Pseudocode](PSEUDOCODE.md): transaction, operation and deterministic-flow sketches.
- [Continuation handoff](CONTINUE.md): actual current status and next bounded verification task.
- [Per-module guides](../../../engine/modules): schemas, defaults, author examples, enabled/disabled behavior and adapter limits.

The one author entry shape is:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {}
}
```

Omitted bundled modules inherit their bundle settings. `false` disables; `true` selects bundle/default settings; an object recursively overrides settings and arrays replace. The `current` preset selects existing legacy behavior and has no configured module overrides; unsupported overrides are rejected rather than silently ignored. Catalog presence does not guarantee a configured adapter: unsupported future module selections and instances must fail closed.

## Runtime and release boundary

The resolver generates `src/content/generated/gameProfiles.js` and `games/ashenspire/game.lock.json`; do not edit these outputs directly. Each run carries an immutable resolved profile and lock hash. New profile settings affect new runs; saved runs stay pinned and this version does not hot-unload modules. Save schema is v25. A profile/runtime mismatch refuses the load without rewriting the stored save.

Verification on the final build: 85 focused tests pass against both defaults, CI gates pass, and the final `node tests/run-node --no-selftests --no-discovered` baseline exited 0 after the latest loadout edits. The reusable [`game-profile-ui.browser.mjs`](../../../tests/game-profile-ui.browser.mjs) regression suite passed on final source. Headless checks using a fixture with all four classes unlocked created each class with exact weapons and ten-card decks, constructed real combat, and loaded actual saved runs; headless Smith damage, Block, and preview values agreed. Browser checks on core build 1,539 passed a three-turn combat win→reward→Smith→save→quit→Continue flow. Browser checks on current-default build 1,535 passed the natural wizard→map→combat path. The 1,538 Smith save/Continue result is superseded by this 1,539 rerun. Ten simulated runs had nine clear act one and all lose later; no full three-act victory is claimed, and balance remains provisional. Gallery captures are from build 1,538 before final nonvisual fixes; they were not recaptured for 1,539. Fresh 1,539 smoke images are forthcoming from the UI worker and have not yet been reviewed here. Legacy mobile crowding remains open. Preview publication is pending; the CI artifacts are test artifacts, not a published playable preview. The configured export remains host-dependent, with portable export and full module extraction outstanding.

The owner has authorized implementation on the feature branch. Workers use isolated `worker/json-game-modules/*` branches; integrate only to `Feature/json-game-modules`. Do not promote or open a PR to dev, test, release or main without later explicit instruction. Continue already authorized work without asking for the same permission again.
