# FixUI checkpoints

Worktree: `D:/repos/.codex/worktrees/fix-ui/AshenSpire`. Branch: `feature/FixUI`.
Each fix below was committed and pushed to `origin/feature/FixUI`, merging concurrent remote updates. Existing cards, card fan, hotkeys and footer are preserved.

- [x] Enemy target ownership: transparent tap areas leave neighboring artwork selectable. `f5b09ccf246`. [Try checkpoint 1](http://localhost:8341/build/fixui-01-targets.html?shot=combat).
- [x] Portrait framing: player feet and HP stay above cards; enemies recede into the upper field. `2a54a780d30`. [Try checkpoint 2](http://localhost:8343/?shot=combat).
- [x] Scenery: the scene canvas covers the fitted floor without tiled or mirrored extensions. `471585fae82`. [Try checkpoint 3](http://localhost:8345/?shot=combat).
- [x] Selected player details: compact name/level, HP, Poise and Ward sit beside the character; hidden enemy footers do not displace them. `8aee5cef380`. [Try checkpoint 4](http://localhost:8346/?shot=combat).
- [x] Selected portrait player packing: exclude its unused foot proxy from footer reservations. `fa25c9be002`. [Try checkpoint 4a](http://localhost:8347/?shot=combat).
- [x] Combat tools: compact unboxed Log/Reaction controls span the card band, Log left and Reaction right. Existing drag snapping remains. `1ee68285deb`. [Try checkpoint 5](http://localhost:8348/?shot=combat).
- [x] Toolbar geometry regression: verify the row's full width and equal outer padding in the actual adapter. `2900824566f`. [Try checkpoint 5a](http://localhost:8349/?shot=combat).
- [x] Final independent review and complete fast-suite result: 416 files, 3,541 tests, zero failed; 149 engine/tool checks passed. Native touch, selection restoration, log snapping and real card-play checks passed. See [evidence](README.md#fixui-follow-up--october-10).
- [ ] Owner positioning acceptance on the playable checkpoint and physical phone.

Checkpoint 1 is a packaged target-only snapshot and retains the old framing. Later checkpoints archive source/code/CSS under `D:/repos/.codex/previews/FixUI`; each `preview.json` records its commit. They share the local pinned art cache. They are local previews, not immutable release artifacts or hosted deployments; URLs work while their servers run.

The shared feature branch also contains another session's CI-lane work and enemy expansion. Preserve those changes; do not force-push. These checkpoints do not claim a new dev/test promotion. See the [runtime QA record](README.md), [reference comparison](hud-comparison.html) and [component catalog](../../component-catalog.html).
