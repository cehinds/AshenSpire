# Unity import

Reference path for loading `dist/build/<game>.build.json` (format `ashen.build@1`) in Unity. The C# under `Runtime/` is
**reference code, not yet compiled in CI**; no `.csproj` or `.asmdef` is part of the repository build. It is plain C#
(System.Text.Json, no Unity API) so it also builds under .NET, which is how a port should run the case suite first.
Read `engine/export/README.md` for the artifact layout, load order and versioning.

## Steps

1. **Build the artifact.** `node tools/build-game.mjs` (needs Node). Copy `dist/build/ashenspire.build.json` to
   `Assets/StreamingAssets/ashenspire.build.json`. CI publishes the same file as a build artifact; its `hash` must equal
   `games/ashenspire/build.summary.json`.
2. **Add the runtime.** Copy `Runtime/*.cs` into `Assets/Ashen/Runtime/`. On Unity versions without System.Text.Json
   use Newtonsoft (`com.unity.nuget.newtonsoft-json`) and replace `JsonElement` with `JObject`/`JToken`.
3. **Deserialize.** Read the file (`UnityWebRequest` on Android and WebGL, `File.ReadAllText` elsewhere) and call
   `AshenBuild.Load(json)`. It refuses an unknown `format`.
4. **Bind tags.** `build.Tags["fx:heal"]` gives the mechanic slug; `build.Mechanics[slug]` holds manifest, model, interface,
   service and cases. Cards, characters and gear in `build.Content` carry tags; resolve each to its mechanic once at load.
5. **Run services.** `new AshenRuntime(build)` then `Command(state, "fx_heal.heal", params)`, `Emit(...)`, `Query(...)`.
   Each returns a new `GameState` and the ordered events. Implement `IFormulaEvaluator` fully (`runtime.formulas`) and the
   mechanics marked `legacy` in your own code until they move into `service` JSON.
6. **Prove it.** Write a test that walks every `mechanics[slug].Cases` entry (`given`, `when`, `then`: SPEC section 10)
   against `AshenRuntime`. A port is correct when they all pass, as in `tests/build-game.test.mjs`.
7. **Render components.** Each `ui.components.<id>` is a view model (`props`, `bindings`, `states`, `events`, `children`);
   each `ui.screens.<id>` places components in `regions`. With UI Toolkit: one `VisualTreeAsset` per component, a binding
   layer that resolves `$entity.pools.hp` style paths against your model objects, and `ui.layout[path]` for sizes and
   colours. Raise the `events` names as commands into the runtime. Bind enemy SP, MP and card costs only through the
   `enemy_visibility.visibleFields` query.
8. **Load assets.** `AshenAssets.FromBuild(build)`, then `PathFor(id, "light" | "high")` or
   `AddressableKey(id, tier)`.

## Asset id to Addressables key

The id is the art path without `assets/` and extension, `/` turned into `.` (`bg.bg_act1`). One id can ship several files,
one per tier, so the Addressables key carries the tier:

```text
ashen/{tier}/{id}        ashen/light/bg.bg_act1     ashen/high/bg.bg_act1     ashen/common/music.map.map
```

The importer walks `assets.catalog.assets`, and for each `files.{tier}` path adds that file to Addressables with address
`ashen/{tier}/{id}` and label `{tier}`. Mobile builds include labels `light` and `common`; desktop includes `high` and
`common`. `AddressableKey` applies the fallback `tier -> common -> other tier`. An entry with `placeholder: true` has no file:
draw the style-guide placeholder from the id. `report.unresolvedAssets` lists UI slots with no catalog entry yet.

## Determinism

Keep one `GameState` per run, never mutate it in place, and seed `RngSeed` from the run seed. Do not use `UnityEngine.Random`
or the clock inside rules. Iterate mechanics in ordinal slug order (`AshenBuild.MechanicOrder()`).
