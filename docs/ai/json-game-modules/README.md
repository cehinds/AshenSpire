# JSON-driven Ashen Spire modules

**Status: partial implementation on [`Feature/json-game-modules`](https://github.com/cehinds/AshenSpire/tree/Feature/json-game-modules); preview publication is pending.** The source work is also tracked on [`Feature/json-game-current-preview`](https://github.com/cehinds/AshenSpire/tree/Feature/json-game-current-preview). The stable build is `0.7.1.1537` (digest `039d6633b9`). A versioned profile resolver, generated artifact lock, core/current presets, Ashen content pack, source-backed run/combat adapters and author CLI are implemented. The configured adapter still requires `ashen.legacy-adapter@1`; a portable rules VM, broad runtime/module extraction and complete cross-engine export are future work. The current configured profile and original legacy profile remain separate entry paths.

The user-facing profile starts with four fixed classes, a ten-card starter, route progression, one-service rests, shops and rewards. New profiles begin with Reaver; unique terminal wins or defeats unlock Starseer, Rogue, then Herald. The title offers five choices when a valid save exists (Continue, New Game, Load Game, Settings, Exit); Continue chooses the newest eligible save, and Continue/Load disappear when no eligible save exists. Rest offers one of Strategize, Smith or Level Up and then restores HP/SP/MP and both flask types. Manual deck editing is Strategize-only.

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

Verification recorded on the stable build: 75 focused tests passed; `node tests/run-node --no-selftests --no-discovered` exited 0; Workbench reported 79 passed and one Windows-only skip. The reusable [`game-profile-ui.browser.mjs`](../../../tests/game-profile-ui.browser.mjs) browser suite passed the exact title menu, JSON import, five-node route, map/combat paths, and cards/art-off fallback. Manual browser checks completed a three-turn combat win into a mixed reward and Strategize with full recovery/one service, and a defeat that unlocked Starseer. Headless defeat→completion ledger→Starseer→save/load and three-act distinct valid bosses also passed. Smith behavior passed in browser; standalone Smith save/Continue remains in progress. A full three-act victory is not yet claimed. The current export remains host-dependent; portable export conformance and broad current-module knob coverage remain future work. Preview publication is pending and is not claimed.

The owner has authorized implementation on the feature branch. Workers use isolated `worker/json-game-modules/*` branches; integrate only to `Feature/json-game-modules`. Do not promote or open a PR to dev, test, release or main without later explicit instruction. Continue already authorized work without asking for the same permission again.
