# Combined silhouette references

Reference-first continuation of the existing unmerged equipment-animation work.
The black silhouettes include the weapons in their actual raster drawing.
Gold/cyan/coral SVG guides annotate the drawing; they do not compose or move it.

## Current delivery

- Four baseline sheets, seven existing class poses each (28 poses): guard,
  attack1–4, hit, idle. These preserve source pose roles, not a seven-frame
  animation loop. The original painted frames appear beside each reference.
- Reaver greatsword, Rogue twin daggers, Starseer staff and Herald empty hands.
- Separate manually traced handle/tip and paired hand-edge review annotations.
  The view has exactly 6 / 8 / 6 / 4 markers respectively, with toggles.
- Two first equipment variations, seven drawings each: Reaver sword/shield and
  Herald staff/free-hand casting. Their anchor calibration is still pending.

Generated using the builtin image-generation tool. Initial and correction
prompts are in `prompts.json` and `variation-prompts.json`. Source contact sheets
are rebuilt from existing `assets/painted-outfits/{class}` by `prepare.mjs` using
Sharp. Complete raster masters are retained in this directory. No procedural
body rig or floating inventory weapon produced these combined silhouettes.

## Inspection and limits

Inspected source sheets, generated sheets and browser comparisons. Rejected
generated colored-marker versions because hand pairs were incomplete. Regenerated
clean drawings and supplied explicit SVG coordinates instead. Redrew Starseer
support arms and corrected an extra arm in Herald's equipped hurt variation.
Fixed SVG cell clipping after the browser exposed adjacent poses in letterboxes.

Anchors are hand-traced estimates for visual review, not calibrated production
grips. The clasped Herald idle has an explicitly flagged estimated far hand.
Generic bodies necessarily interpret joints obscured by the original costumes.
Some silhouettes and projected weapon lengths still vary across source poses.
These drawings have not established rigid 3D length, final timing, a complete
weapon-combination library, dummy-contact validation, or a layered runtime.
Do not treat passing marker-count tests as an anatomy or animation-quality pass.

Next: refine hand-edge ordering, grip landmarks, consistent scale and target
contact; calibrate the new equipment studies; then trial layered reconstruction
against a corrected combined reference. Keep all work unmerged.

## Preview and verification

```powershell
node art/equipment-rig/serve.mjs 4291
# with Sharp and Playwright available to Node:
node art/combined-reference/check.mjs
```

Open `/combined-reference-preview.html`. Checks cover all 28 baseline views,
anchor counts, cell bounds, overlay toggles, browser errors and phone overflow.
Inspection screenshots are saved under `inspection/`. No live game integration,
generated game build, mechanics, or version number was changed.
