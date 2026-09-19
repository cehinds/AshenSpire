# Greatsword outfit animation suite

Open `index.html` for synchronized playback across all four classes and 19 armor entries (16 distinct appearances). Filter by class, select an action, pause, or scrub the nine-step attack. Every entry has a portrait and labeled pose sheet. Copied references include the armor ID, playback step and original pose ID.

The approved motion is ready → source ATK-07 → ATK-04 → ATK-02 → ATK-03 → ATK-05 → ATK-01 → ATK-04 → ready. Preview labels ATK-01 through ATK-07 refer to these seven playback steps, not source filenames. The repeated source ATK-04 is intentional. Source ATK-06 remains available in the exported suite but is not part of the approved attack.

Fifteen new full-suite atlases were generated with the built-in image_gen tool using the approved Reaver atlas as the pose/layout reference and each shipped outfit's menu image as its appearance reference. The original approved Reaver frames are reused unchanged. Exact prompts are saved in `prompts.json`; generated PNG masters remain in `sources/`. No external artwork was downloaded.

Each unique appearance supplies 14 transparent poses plus a portrait. `export.py` slices the 4×4 source grid, applies one scale per full-body suite and a common bottom-center foot anchor, writes 512×512 WebPs, and verifies decoded alpha byte-for-byte. Animated previews and labeled sheets use the approved playback order. Generated anatomy and cloth are painted approximations, not a skeletal rig.

Run `python art/greatsword-outfits-2026-09-19/export.py --bind` from the repository with Pillow installed, then `node tools/config-build.mjs`. Binding refuses to run until all 16 appearances exist. Runtime files live under `assets/animations/greatsword-outfits/`.

All armor bindings reference one `greatswordTwoHand` motion profile. Bastion Harness reuses Warden Mail, Rimeweave Robes reuse Starlit Silks, and Waywatcher Coat reuses Nightveil Coat, matching the catalog aliases. Both ordered empty-hand/greatsword combinations are covered. Existing catalog greatswords report the legacy one-hand grip when held alone; their visual motion remains two-handed without changing equipment mechanics. An occupied second hand prevents this animation selection.
