# Map and battlefield source-art library

**26 retained source drafts across three batches.** Kept on `feature/ImproveMapBattleFieldArt`; the shared proposal and wiring examples are already in dev. These paintings remain unregistered drafts.

| Batch | Source count | Contents |
| --- | --- | --- |
| [01](batch-01/README.md) | 8 | Five map props and a daytime forest stack |
| [02](batch-02/README.md) | 10 | Six map props, night forest stack, misty sky |
| [03](batch-03/README.md) | 8 | Four travel landmarks, independent misty tent/arch, clearing and road grounds |

![Reusable misty scene components](batch-03/preview-scene-combinations.png)

- [catalog.json](catalog.json) links the batch manifests and editable scene recipes.
- Manifest IDs are local to their batch; use the batch ID plus asset ID as a library key. Revised subjects can exist in multiple batches.
- Source PNGs, prompts, provenance and measured dimensions are retained together. Previews demonstrate composition and small-size readability; they are not production exports.
- Scene source canvases currently reach about 1672 × 941; more overscan and registration are still required for wider camera motion. Map masters are 1254px square; 512px/256px exports remain pending.
- Existing issues include low-alpha edge dust, colored fringes and some small-size silhouette ambiguity. Each batch records its own findings.

Next art families: swamp, snow, volcanic; additional independent props; foreground effects; actor/contact-shadow references. Production integration continues through the [shared handoff](../../docs/design/improve-map-battlefield-art/HANDOFF.md) and the project's art-repository intake.
