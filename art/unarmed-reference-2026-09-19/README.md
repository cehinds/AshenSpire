# Unarmed physical poses

All four classes and all 35 armor entries are covered by 32 appearance suites. The three existing catalog aliases reuse their matching outfit. Each suite has 16 transparent 512px WebPs and shares the same nine-step Ready → ATK-01…ATK-07 → Ready sequence at 140ms per step. The main cross lands at step 5 / 700ms. These are painted approximations of shared choreography, not skeletal retargeting.

Both hands are empty. Armor gauntlets remain; weapons, labels, shadows and magical effects are absent from runtime frames. Each body suite uses one uniform scale and a common foot anchor (256,480); the close-up portrait is scaled separately. Original 1254px RGBA PNG atlases are preserved in sources/. prompts.json and per-source JSON files record exact generation prompts and references. All images were generated with built-in OpenAI image generation from project-owned outfit references.

Open index.html directly or through a static server. The preview supports appearance and class filters, all poses, shared sequence playback, stepping, scrubbing, speed, editable repeated pose order, reset, backgrounds, anchors and selectable sequence JSON for copying. Labels appear only in the preview and labeled sheets. overview.webp compares Ready and the main punch across every appearance.

Rebuild with Python and Pillow: `python assemble.py --export --require-complete`, then `python payload.py --runtime`. Extraction uses the existing sword/shield atlas_components helper. Exports verify frame bounds, shared body scale, alpha round-trip and SHA256. Runtime files live at assets/animations/unarmed/. Run `node tools/unarmed-animation-import.mjs art/unarmed-reference-2026-09-19/runtime-fragment.json` from repository root and `node tools/config-build.mjs` to compile authored references.

The importer validates all live armor selectors. Physical owns attack/ready/defense/hurt/stances and noncombat views. Cast/buff are safe empty-hand stills until the separate magic fragment replaces those two references and adds MAGIC-prefixed frames to the same sets. Both fragments share the unarmed profile and compose idempotently in either order, preserving unrelated profiles and settings. Spell-tagged unarmed attack cards cast; ordinary physical attacks punch; powers use buff. Equipped attacks keep their existing behavior.

Validation: `node --test tests/unarmed-animation.test.mjs tests/actionAnimation.test.mjs tests/combatAnimation.test.mjs`. See ../../docs/EQUIPMENT-ANIMATION-REFERENCES.md for the runtime contract.
