# Sword and shield outfit animation suite

Open `index.html` for synchronized playback across four classes and the current 35 armor entries (32 distinct appearances). Filter by class, choose an action, pause, or scrub the attack. Each entry includes a portrait, a labeled pose sheet and a copyable outfit/pose reference.

The attack is `STANCE-READY → DEFEND → ATK-07 → BUFF-NO-AURA → ATK-02 → ATK-03 → ATK-04 → ATK-05 → ATK-05 → STANCE-DEFENSIVE → STANCE-READY`: eleven 100ms steps with impact at ATK-05 (700ms). `attack-sequence.json` configures this shared sequence. Source pose IDs remain stable while preview attack labels number playback steps. All attack frames are aura-free; BUFF-NO-AURA is an image-generated clean variant of the Buff pose. The separate Buff action keeps its magical effect. Each appearance supplies 15 body poses plus a portrait, including shield defense, hurt, cast, buff, ready, aggressive and defensive stances.

All paintings are authored with the sword in the right hand and shield in the left. Both ordered equipment combinations select this family, but reversed equipment deliberately shares the canonical artwork. It is not mirrored and is not a separately painted hand swap. The manifest and runtime sets record `authoredEquipment` explicitly.

The built-in image_gen tool produces the source PNG atlases. Exact prompts and source provenance are in `prompts.json`. The exporter segments complete figures from their alpha in reading order, so weapons and feet crossing nominal grid boundaries are preserved. Body thresholds adapt when soft glow joins adjacent figures; ownership grows back through the original alpha. A 12px edge allowance retains soft edges while excluding remote near-transparent background specks. The manifest records extraction bounds and thresholds. Opaque pixels are never discarded or duplicated.

One full-body scale per suite and a shared body-foot anchor produce 512×512 WebPs; decoded exported alpha is verified byte-for-byte. These are painted approximations, not a skeletal rig. `test_extraction.py` exercises cross-grid weapons and feet, glow bridges and isolated transparent noise.

Run `python art/sword-shield-outfits-2026-09-19/export.py --bind` with Pillow and NumPy, then `node tools/config-build.mjs`. Binding refuses partial source coverage. Runtime files live under `assets/animations/sword-shield-outfits/`; all outfits share the configurable `swordShield` motion profile. Existing greatsword profiles, frames and bindings are preserved.

Catalog appearance aliases are retained; shared armor has a dedicated painting for each class. Conversation and menu reuse Ready, while detail uses Portrait. Dodge, victory, defeat and revive retain existing fallback presentation.

After editing the attack sequence or aura-free source variants, run `python art/sword-shield-outfits-2026-09-19/export.py --refresh-playback --bind`, then `node tools/config-build.mjs`. This preserves the original pose exports and rebuilds animation previews, labeled sheets and runtime references.
