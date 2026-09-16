# Validation result

- `node art/enemy-poses/validate.mjs`: passed. 33 enemies, 66 RGBA frames, distinct attacks, transparent margins, and byte-identical retained painted idles.
- `node art/enemy-poses/inspect.cjs` with Playwright and installed Edge: passed. 33 gallery cards, zero broken images, no phone horizontal overflow, successful playback and all 33 combat-renderer pose transitions.
- `node tests/run-node.mjs`: passed, exit code 0.
- `node tools/launch.mjs --build-only`: passed.
- `node tools/verify-shipped.mjs`: passed.
- `node tools/buildversion.mjs --check`: passed.
- `git diff --check`: passed.

Visual review used the source images, extracted frames, and phone gallery screenshot. Browser validation used the real enemy renderer in a fixture; a complete gameplay encounter was not played. The artwork supplies one attack keyframe per enemy.
