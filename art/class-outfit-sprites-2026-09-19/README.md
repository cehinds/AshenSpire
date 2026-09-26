# Shared armor: class-specific sprites

Sixteen distinct outfits: Reaver, Starseer, Herald and Rogue wearing Wayfarer Plate,
Nightweave, Rite Vestments and Gutter Leathers. Class headwear, proportions and
signature equipment remain recognizable. Gameplay requirements and bonuses are
unchanged by this art pass.

Each source is an eight-pose transparent atlas generated with the built-in Image
Gen tool from the shipped class menu art and the corresponding inventory armor
reference. `prompts.json` records the initial requests. The final Rogue leather
atlas was corrected by editing the transparent Rogue Rite Vestments atlas to
replace the burgundy robe with the approved leather outfit while retaining its
layout, daggers, poses and transparency. Original generator outputs are preserved.

Run `python art/class-outfit-sprites-2026-09-19/export.py` with Pillow and NumPy.
The export separates connected alpha silhouettes, preserves antialiased edges,
uses one shared scale per atlas, and anchors all combat frames at (320, 600) on
a 640-pixel canvas. It emits the runtime manifest, WebP frames, and `preview.jpg`.

Eight authored poses cover standing, guarding, wind-up, impact, recovery, casting,
hurt and defeat. Technique and readiness names reuse the appropriate authored
pose. These are class/outfit animations, not separate weapon-loadout animations.
The existing equipment-specific animation bindings remain unchanged.

Open `/item-cards-preview.html?sharedArmor` to see the in-game cards, bonuses, tags,
and all four class versions per outfit. The pose selector uses the combat stage
renderer, including costume-preserving readiness and defeat.
