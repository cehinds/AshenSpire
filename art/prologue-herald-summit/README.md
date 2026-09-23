# Herald at the Observatory summit — final refinement

Scene 4 Herald memory: the fully hooded and veiled novice burns from within, collapsing against the monumental Crown Flame hearth while desperately tending the Sovereign Ember. Open summit arches reveal the ash-white Observatory city and Cinder Reach caldera far below. The face, including eyes, is completely concealed.

## Final integration assets

| Format | PNG master | WebP deliverable |
| --- | --- | --- |
| Desktop | `masters/carry-herald-desktop.png` | `deliverables/carry-herald-desktop.webp` |
| Mobile | `masters/carry-herald-mobile.png` | `deliverables/carry-herald-mobile.webp` |

Use these WebPs for `assets/prologue/carry-herald-desktop.webp` and `assets/prologue/carry-herald-mobile.webp`. This folder supersedes the earlier `prologue-herald-conversion` (small brazier, uncovered face) and `prologue-herald-refinement` (incorrect soldier story) handoffs, which were never merged. No runtime integration, shared config edits, main-checkout edits, PR or merge were performed.

## Lore and composition

Read `docs/LORE.md` and `docs/LORE-CAST.md`: the Crown Flame and Sovereign Ember belonged to the Observatory, fed in its crown, while the Furnace Saint keeps the Crown Flame's hearth in the Furnace Chapel at the tower's base. The Herald was a marked Furnace Chapel novice whose Burning began but did not finish, and who feeds the flame from themselves. At the user's direction, this memory is staged at the Observatory's summit hearth during the Burning, while the Ember is still present. The specific ceremony, ornate hearth design and reaching gesture are visual interpretations, not additional canon.

The subject's hood and opaque scorched veil conceal all facial features. Pain and urgency are conveyed by contracted shoulders, collapsed knees, a supporting grip, and a strained reaching hand. Internal chest, neck and arm fissures remain visible. The monumental hearth, large irregular glowing starstone and flame establish the grand Ember's scale. No baked-in text or gratuitous gore.

## Generation and export

Generated with the built-in image tool and imagegen skill. Exact prompts are in `prompts/desktop.txt`, `prompts/mobile.txt` and `prompts/covered-face-intermediate.txt`. The desktop edit used the covered-face intermediate `C:/Users/suprbludude/.codex/generated_images/01a0bc8d-d523-7dd3-b7a9-c20d86aeb19a/exec-a40e8165-5c0a-4144-a593-c7b331115f6f.png`. The mobile image used the final desktop scene as its reference.

Generated PNG sources:
- Desktop: `C:/Users/suprbludude/.codex/generated_images/01a0bc8d-d523-7dd3-b7a9-c20d86aeb19a/exec-c137f071-f253-410a-94cf-23305b9b0d7c.png`
- Mobile: `C:/Users/suprbludude/.codex/generated_images/01a0bc8d-d523-7dd3-b7a9-c20d86aeb19a/exec-d022230d-300e-4674-aab7-55760add7791.png`

PNG masters preserve generated pixels. WebP export uses quality 90, method 6, without resizing or cropping. `manifest.json` records actual dimensions, sizes and SHA-256 hashes. `export_webp.py` reproduces encoding with Pillow.

Both generated compositions and WebP exports were visually inspected for concealed face, internal burning, readable hands, matching design, monumental hearth and visible tower elevation. Mobile is independently composed. No runtime testing was performed for this art-only handoff.

Worktree: `D:/repos/AshenSpire-reaver-art-refinement`; branch: `codex/prologue-reaver-art-refinement`.
