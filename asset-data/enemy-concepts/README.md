# Enemy sprite concepts

[The catalog](manifest.json) lists 32 enemy designs, all enabled and wired (2026-11-18): each has a Core sheet, cards and encounters, and its frames are mapped in `src/content/enemyExpansion.js` and `enemyStanceSprites.js`. Each entry carries the `concept` tag and its encounter role and geographical seat; Carrion Headsman and Knellcap Sentinel are normals in the Marches (owner, 2026-11-18). Seat IDs follow the region when the starting location changes.

The original designs, pose sheets, prompts and HD/light exports live in the AshenSpire art tree of `cehinds/AI-Art`. Open the [local art gallery](../../../AI-Art-AshenSpire/pose-studio/enemy-expansion-2026-11-18/index.html) when the art checkout is a sibling named `AI-Art-AshenSpire`. For a different checkout location, use the repository-relative `source.gallery` path. Each entry's `sourceManifest` selects its original catalog from `source.manifests`.

## Resolving artwork

Join the entry's `artRoot`, a slash and a filename from the shared `frames` map. For example, Bracken Tusker's held Defend stance resolves to `assets/enemy-poses/expansion/brackenTusker/stance-defend.webp`. Its defend animation plays `defend-01.webp` followed by `defend-02.webp`. Each design supplies one idle, six stance holds, three two-frame action clips and one downed pose.

Use the same canonical art ID in both tiers. To find its image in the art checkout or a release archive, replace the leading `runtimePrefix` with the tier's `checkoutPrefix` or `archivePrefix`. Canvas sizes and foot anchors are recorded per tier.

## Future integration

Integration is done: the enemy definitions, encounter roles and pose mapping exist for every entry, and the art release v28 contains the frames. A new concept needs the same three pieces and a release that contains its frames. See the [art authoring and release guide](../../docs/ART-AUTHORING.md).
