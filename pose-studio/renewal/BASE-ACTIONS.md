# Base class actions

Open [the atelier](index.html) for Reaver, Rogue, Starseer and Herald in base armour.
Each class has one default **dashing strike**, **defense**, and **power**. Equipped
weapons do not select or change these animations. Blade/shield and other tag
combinations are deferred.

- Reaver: sword, closed steel helmet and a full continuous crimson cape.
- Rogue: twin daggers.
- Starseer: staff.
- Herald: sword in the anatomical right hand; shield on the left arm.

The five-pose strike stays planted during wind-up, dashes 96 preview pixels into
contact, follows through and returns. All actions follow the current game speed
settings (260 ms Normal, 160 ms Fast). Reduced motion and Instant remove travel
and flashes. **Test hit flash** previews an alpha-masked red flash on any class.
Existing slash, impact, ward, shield and aura artwork remains separate.

The class-only registry is `base-action-registry.json`; each family has twelve
512 px transparent frames with 256 px Lite WebP equivalents. The preview loads
only these scoped families. Older loadout, reaction and spell projects are kept
as separate studies and are not offered in this preview.

**Download Workshop project** provides a portable `<class>-base.rig.json` with
all three animations. **Edit effects in Pose Studio** opens the corresponding
`base-<action>.pose.json` in a separate draft namespace, preserving older saves.
These are flattened painted poses, not separated body/weapon rigs. The Workshop
projects include the dash offsets; Pose Studio exports edit poses/effects and
do not encode the atelier's travel curve. Runtime bindings remain empty.

Rebuild with `python tools/alternative-base-actions-build.py`. Whole-sheet source
art and the selected ImageGen prompts live in `source/` and each class's
`source/` folder. `base-normalization.json` records crop boxes, shared scales,
floor anchors and gutters. Source hashes are recorded in each base manifest.
The original generated PNGs are preserved in Codex's D: generated-images folder.

Validation: `node --test pose-studio/tests/model.test.mjs pose-studio/tests/renewal.test.mjs pose-studio/tests/base-actions.test.mjs`.
Visual review should include all three actions, both raster sizes, hand placement,
cape continuity, clear weapon tips, normal/fast timing and reduced motion.
This remains an authoring preview; gameplay integration is a separate step.
