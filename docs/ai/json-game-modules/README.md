# JSON-driven Ashen Spire modules

**Status: partial implementation on `Feature/json-game-modules`; browser acceptance remains in progress.** The repository now has a versioned profile resolver, generated artifact lock, core/current presets, an Ashen content pack, source-backed run/combat adapters and authoring CLI. It is still a host adapter that requires `ashen.legacy-adapter@1`; this is not yet the full engine-neutral runtime/portable rules VM the original goal calls for. The current configured profile and original legacy profile are separate entry paths.

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

Omitted bundled modules inherit their bundle settings. `false` disables; `true` selects bundle/default settings; an object recursively overrides settings and arrays replace. The `current` preset selects the existing legacy behavior. Catalog presence does not guarantee a configured adapter: unsupported future module selections and instances must fail closed.

## Runtime and release boundary

The resolver generates `src/content/generated/gameProfiles.js` and `games/ashenspire/game.lock.json`; do not edit these outputs directly. Each run carries an immutable resolved profile and lock hash. New profile settings affect new runs; saved runs stay pinned and this version does not hot-unload modules. Save schema is v25. A profile/runtime mismatch refuses the load without rewriting the stored save.

Focused headless tests have passed for run profile behavior, title save selection, starter/combat profiles and individual cards/resources/defenses/stances/routes/class-selection-off combat flows. These checks do not prove full product completion. Desktop/mobile browser parity, a complete profile run through win/defeat/restart/save, and portable export conformance are still outstanding. No deployed preview is claimed.

The owner has authorized implementation on the feature branch. Workers use isolated `worker/json-game-modules/*` branches; integrate only to `Feature/json-game-modules`. Do not promote or open a PR to dev, test, release or main without later explicit instruction. Continue already authorized work without asking for the same permission again.
