# Scene 4 Reaver — cinder soldier, final dark grade

Integration-ready art only. Built-in image_gen edits, followed by WebP encoding without resizing.

Worktree: D:/repos/AshenSpire-reaver-cinder-art
Branch: codex/prologue-reaver-cinder-art
Base commit: 8e0c79df00104279bcb9d1776c387f7082afbadf

## Final assets

| Use | PNG master | Compressed deliverable | Dimensions | WebP size |
|---|---|---|---|---|
| Desktop | carry-reaver-desktop.png | carry-reaver-desktop.webp | 1586 x 992 | 263,174 bytes |
| Mobile | carry-reaver-mobile.png | carry-reaver-mobile.webp | 940 x 1672 | 276,190 bytes |

Every file is in D:/repos/AshenSpire-reaver-cinder-art/art/prologue-reaver-cinder-refinement/.
Runtime deliverable basenames match the requested names. Copy these two WebPs into the integration task's existing prologue asset directory when integrating. The PNG masters already include the requested dark filter.

## Visual verification

Visually inspected both generated refinements, both final darkened PNGs, and both decoded compressed WebP deliverables. Checked the deranged charcoal face, crooked/hunched human posture, internal chest cinder and molten fissures, tattered medieval equipment, readable continuous sword, preserved Fell Courtyard gate, full figure and feet, coherent desktop/mobile appearance, and absence of baked text or gratuitous gore. Shadows are intentionally deep; face, sword, gate and ember light remain legible. WebP files decoded successfully at the master dimensions; compression saves approximately 88% versus the PNG masters.

## Fidelity and scope

Read docs/LORE.md and docs/LORE-CAST.md. The depicted marked soldier remains at the Fell Courtyard gate and burns from within. This is a figure in the Reaver's class memory, not a claim that the unmarked Reaver is corrupted.

Only this art package was added in this isolated worktree. No runtime/config changes, main-checkout file edits, changes to scene 1 or scene 2 Burning, or PR creation were performed. The user subsequently approved merging this package into the Plan post-class intro sequence workflow branch, codex/prologue-burning-timing, and replacing its two carry-reaver runtime WebPs with these dark-filtered deliverables.

PROMPTS.md records the initial desktop/mobile edit prompts and source paths. DARK-FILTER-PROMPTS.md records the final requested dark-grade passes. manifest.json records dimensions, byte sizes, encoding settings and SHA-256 checksums.
