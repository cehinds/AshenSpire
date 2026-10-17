# Generation handoff

Work in `/workspace/AshenSpire`. Read this batch's `brief.json`, `prompt-prefix.txt`, and `../style-system/style-guide.json` / role profiles. Each assigned setting produces **four assets**: `backdrop.png`, `ground.png`, `prop-left.png`, `prop-right.png` in its own folder, with matching `.provenance.json` files and a folder `review.json`.

Use the exact shared prompt prefix, then the setting palette/light/subject and role rule from the brief. Each source is a new imagegen generation, so omit reference image arguments. Use `transparent_background:true` for ground and props, false for backdrops. Use imagegen only for art; no Python/PIL image editing. PNGs are copied unchanged from original generated paths. Python/PIL is allowed for read-only measurements.

- Backdrop: wide3072×1728 requested, player-height INSIDE location, side surroundings feel nearby, no distant tiny landmark panorama. Quiet center.
- Ground: wide3072×1728 requested, transparent upper52–55%, opaque lower plane to left/right/bottom edges, quiet center.
- Left/right prop: square1536 requested, complete isolated nearby wall/facade/tree/rock component, generous alpha margins. No ground slab or surrounding scene. Left prop faces gently toward right/scene center; right prop toward left. Mild ground-level three-quarter view, no isometric camera. Source silhouette complete; main preview may intentionally crop it at viewport edge.
- Painted night setting uses genuinely cool low-key materials and restrained warm local lamps/windows. Override generic daylight assumptions.
- Cave/dungeon/tunnel interiors have no outdoor sky or precipitation.
- Keep the shared muted matte material style. No people, text, fake UI framing, photographic glitter, plastic shading or broad neon effects.

Discover imagegen in ALL_TOOLS if not shown directly. For its exec call, use the first-line pragma with `yield_time_ms:120000`, and return the result through `generatedImage(result)`. Calls may run concurrently in batches of4–5. Save completed files as they return so partial reviews can begin.

Each provenance sidecar must include `generator:"OpenAI image_gen"`, exact `prompt`, `sourceOutputPath` absolute original path, `sourceReferences:[]`, requestedDimensions object, `styleFamilyId:"ashen-spire-painted-v1"`, and `styleProfileId` (`battlefield-backdrop`, `battlefield-ground`, `battlefield-prop`). Main measures actual dimensions and hashes.

View every final output. Fix genuine style/cropping problems with imagegen. Do not regenerate solely because margins are narrower than15% or faint alpha dust exists; record those limitations. If a complete solid subject is cut by the source canvas, fix it. Do not change finished files after declaring them frozen.

Each folder review.json: `{ "items": [{ "id":"setting/backdrop", "verdict":"approved", "reason":"actual visual findings and limits", "profileId":"battlefield-backdrop", "sha256":"..." }, ...four items] }`. Hash the exact retained final PNG bytes.

Own only your assigned setting folders. No shared manifests, modules, scripts, catalog edits or commits. Main performs independent review, source mapping, composition, validation and publishing.

Some later settings have a `reuse` object: skip generation of those components. They reference another setting/component ID and are resolved by the scene JSON. Generate only role names absent from `reuse`. Review.json lists only the newly generated source IDs owned by that folder. `backdrop` and `ground` subject text use same field name; `prop-left` uses `left`, `prop-right` uses `right`.
