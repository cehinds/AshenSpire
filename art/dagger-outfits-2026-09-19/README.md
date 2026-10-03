# Single-dagger animation suite

Open `index.html` for a configurable animation preview, synchronized outfit
comparison and labeled sheets. The suite covers all four classes and all 35
catalog armor entries through 32 distinct appearances. Three catalog aliases
reuse their existing appearance mapping; shared armor is painted for each wearer.
Ready, ATK01–ATK07, Defend, Hurt, Cast, Buff, aggressive/defensive stances,
portrait and a separate conversation pose are included. Character poses contain
no baked aura or particles; effects belong to separate runtime layers.

Authored equipment: anatomical right/main hand dagger, left/off hand empty.
Selector: `class / armor / dagger + empty / one`. Motion and selectors use
weapon groups and ordered hands, not duplicate per-item animation sets.
The existing dagger group contains `dagger` and `parryDagger`. Reversed hands
and dual daggers need separately reviewed art; this suite must not select them.

All skins share `daggerSingle`: Ready → ATK01–ATK07 → Ready, 100ms per step,
900ms total, impact at ATK05 (500ms). Portrait and conversation have separate
painted references. The preview changes only its local review configuration.
Copy its JSON to propose the next `attack-sequence.json`; runtime speed/preset
settings stay in their existing shared configuration. Pose IDs remain stable
when playback is reordered. These are painted approximations of one locked
choreography, not a skeletal rig or pixel-identical joint animation.

## Equipment evidence at base 72a44b0c

- `content/config/ui/presentation/equipmentAnimations.json`: dagger art group
  includes Dagger and Parrying Dagger.
- `content/source/equipSlots.csv` and `weapons.csv`: either hand accepts both.
- `content/source/tagging.csv`: both have `item:blade`; Parrying Dagger also
  has `item:shield`, even though its catalog kind is `shield`.
- `src/model/loadout.js` (`gripOf`): two occupied one-handed items sharing an
  item type derive `dual`; Dagger + Parrying Dagger therefore derives dual.
- `applyEquipTransition` moves an item already held elsewhere. Two copies of
  the identical Dagger ID are not a legal authored pair.
- `gripRefusal`: a two-handed armament requires the other hand empty. Other
  one-handed mixed groups may pair subject to normal ownership/stat gates.
  Mixed pairs are distinct animation selectors, not this single-dagger suite.

Dual dagger and reversed-hand animation families are separate future work.
This suite changes no equipment balance, legal pairing or global speed settings.

## Reproduction and provenance

Built-in image generation created the full 4×4 transparent PNG in one pass,
using the approved Rogue sword/shield Ready frame as identity reference.
All other skins use this new single-dagger atlas as the pose reference and their
existing sword/shield Ready frame as the appearance reference. Exact seed lockback
would preserve the old weapons, so it is unused. `prompts.json` and
`sources/*.prompt.json` preserve exact generation requests and source provenance.
`sources/rogue-default.png` is the original unmodified transparent PNG.
The sprite-pipeline workflow is adapted to the existing atlas extractor so
daggers crossing nominal cell lines remain intact. `export.py` imports that
extractor from the adjacent sword/shield pack and uses one scale across all
full-body poses and skins in normalized source coordinates, bottom-center
anchoring, independent portrait scale and verified WebP alpha.
Run `python art/dagger-outfits-2026-09-19/export.py --bind` with Pillow and NumPy,
then `node tools/config-build.mjs`. Binding refuses incomplete appearance coverage
and changes only this family's motion profile, frames and 35 ordered selectors.
Run `python art/dagger-outfits-2026-09-19/serve.py --port 8843` for the local
preview. Use an unused port; do not stop another task's server.
The labeled sheet is review-only; individual runtime-candidate frames have no text.
`manifest.json` records source/frame hashes, extraction boxes, anchors and coverage.
`validation.json` records export checks. Generated project artwork follows the
existing project AI-art provenance convention; no third-party asset was added.
