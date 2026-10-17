# Animation (host adapter)

`animation` controls authored figure action/reaction clips, action choreography (including the specialized Reaver attack and CSS fallback), and Reading Desk card-preview playback. Core and Current consume the same settings. Both bundled profiles default to enabled.

Add an override to the author file, `games/ashenspire/game.json`:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": { "animation": { "enabled": false } }
}
```

`animation:false` has the same presentation effect; `animation:true` inherits the bundle defaults. Current authors use `ashen.current@1.0.0` and can use the same overrides. `mode` must match the selected foundation (`configured` for Core, `legacy` for Current). Unknown keys, non-boolean `enabled`, and incompatible modes fail validation. Settings resolve from `defaults.json`, then the selected bundle, then author overrides; `settings.schema.json` defines the validated object.

Disabling the module keeps figures in their existing held/resting poses and prevents Reading Desk autoplay or manual playback. It preserves defeated art, class-default weapon art selection, figure dimensions, targeting geometry, and foundation feedback such as impact flashes, floating numbers, hit effects and effect sprites. This is a figure-motion switch, not a global zero-motion preference. Display accessibility preferences still apply independently.

Animation policy never changes combat outcomes, resources, RNG, receipt order, contact timing or recovery pacing. Disabled action handles retain the authored timing metadata without starting the figure clip. Old runs without a profile, and historical profiles missing the animation key, retain default-on behavior. A run uses its saved profile rather than a mutable global setting.

Approved sequence facts and art remain in their existing source owners: `src/model/selectedWeaponSequences.js`, `src/model/cardAnimationFamily.js`, and the production JSON under `pose-studio/stances/update-stances/selected-smash-sm03`, `selected-sweep-sw09`, and `pose-studio/stances/class-smash`. This module does not duplicate their phase/timing lists or change balance. Its accompanying JSON is the module manifest, defaults and settings schema. It introduces no portable animation instruction format; `ashen.legacy-adapter@1` remains required.

After runtime edits, rebuild profile artifacts, then validate serially:

```sh
node tools/game-config.mjs build
node --test --test-concurrency=1 tests/game-animation-policy.test.mjs tests/game-profile.test.mjs tests/deck-card-animation-preview.test.mjs tests/selected-weapon-stances.test.mjs
node tools/game-config.mjs validate --input games/ashenspire/game.json
node tools/game-config.mjs check
```

Browser acceptance also checks real figure geometry, targeting, End Turn and the disabled Reading Desk preview. Resolver validation alone does not prove those behaviors.
