# Pilot artwork review — 2026-10-11 client

Independent visual inspection of the repaired greatsword smash concept sheet and corrected guard-break A sheet. This records useful exploration and remaining pose issues; neither sheet is approved or promoted.

## Greatsword smash, repaired A

Source inspected: [`pose-studio/stances/update-stances/greatsword-smash/sheet-a.png`](../../../pose-studio/stances/update-stances/greatsword-smash/sheet-a.png), 1536×1024 RGBA, five concepts on a full comparison sheet. The character identity, crimson cape, plate rendering and rear three-quarter camera generally match the intended Reaver reference. The repair gives option 2 a clearer two-hand grip than the initial A sheet.

- Top-right option 3 still reads like a rear/shoulder hold: the grip sits close to the back and the blade is carried laterally, which makes the intended forward attack direction awkward. Reorient the grip into a readable forward-ready space.
- The top-left pose is a vertical overhead readiness pose, and bottom-middle is another raised-sword pose. Clarify which image is the dedicated held smash stance and which belong to the separate smash action sequence. The hold should read as a stable load-ready silhouette distinct from anticipation/contact/recovery.

The review image `/workspace/scratch/smash-alpha-browser.png` shows the sheet composited in a browser on a neutral gray backing. My earlier view_image-based claim that the visible brown/red haze meant bad alpha was wrong: the PNG's hidden RGB looks like a backdrop in the image viewer, while browser compositing confirms valid transparency. Do not use `view_image` on hidden RGB as evidence of an alpha defect. The sheet is a concept comparison, not a set of assumed 512 px runtime crops; review the full sheet and individual concepts as the gallery presents them. Preserve the same Reaver body/outfit and rear three-quarter right orientation as the selected stance references.

## Greatsword smash, sheet B

Source inspected: [`pose-studio/stances/update-stances/greatsword-smash/sheet-b.png`](../../../pose-studio/stances/update-stances/greatsword-smash/sheet-b.png), 1536×1024 RGBA, options 6–10. The body/outfit and camera remain consistent with the Reaver identity. These are all raised or waist-level weapon loads, rather than impact frames; the choice sheet should label them as held concepts if that is their intended role.

- Option 6 has the raised-toe/high-shift balance, but the blade points up-left across the sheet, while the brief calls for an up-right direction. The prompt/README records this mismatch. It also has a forward-step/stomp quality, so it may not work as a static held pose.
- Option 7 gives a broad lateral shoulder load, option 8 a compact chest-high load, and option 9 a heel-raised waist rotation. They provide distinct silhouettes, though grips and body torque should be judged at the gallery scale.
- Option 10 has an upright rear-hip hold with the blade low across the body. The artist intended a heavy pendulum upswing load, but at first glance it reads more like carry/recovery than a smash-ready load; keep this as a comparison caveat. Root froze all ten concepts as reviewable candidates and recommends options 4, 7 and 10 for comparison. This is a freeze of the concept set, not production approval.

This is a full comparison sheet, not a set of assumed 512 px runtime crops. I made no alpha finding from the image viewer; use browser compositing if transparency needs review.

## Guard-break, targeted A revision

Source inspected: [`pose-studio/stances/update-stances/guard-break/reaver-greatsword-guard-break-sheet-a.png`](../../../pose-studio/stances/update-stances/guard-break/reaver-greatsword-guard-break-sheet-a.png), 1536×1024 RGBA. This canonical A now contains the targeted revision. Option 1 improves on the first A pass: the forward, lopsided collapse and lowered hands read less formal/prayerlike. Options 2, 3 and 5 remain useful exploration for a broken guard, each with a distinct low body/weapon arrangement.

- Option 4 remains flagged for revision. Its extended blade still reads short relative to the Reaver, and it touches/overlaps option A5's rear boot near source coordinate `(630,880)`, merging neighboring silhouettes in the comparison sheet. The pose also does not make a two-handed greatsword grip apparent. Keep the long blade length, clear the boot, and make the weapon's weight and handling legible.

The earlier image `/workspace/generated_images/exec-ea6d5449-65d9-492a-9998-443df3ca90ef.png` is the rejected preliminary; do not use it as the current comparison. A01 is a fixed candidate; A04 remains the sole flagged candidate. Review against body state, knee visibility, correct greatsword scale, and consistency with the selected Reaver camera. The preliminary is not used to judge B.

### Guard-break, B exploration

Source inspected: [`pose-studio/stances/update-stances/guard-break/reaver-greatsword-guard-break-sheet-b.png`](../../../pose-studio/stances/update-stances/guard-break/reaver-greatsword-guard-break-sheet-b.png), 1536×1024 RGBA, options B06–B10. This is exploratory concept art. B06 shows a dropped knee and lowered sword but leaves the torso relatively upright. B07 has a knee grounded, slumped torso and sword point on the ground; its broken state is clearest on first read. B08 has an upright torso and shoulder-carried sword and reads more exhausted/resting than broken. B09 has a lowered weapon hand and low blade with a slumped upper body; B10 is deeply folded with one knee down and a long greatsword low beside the figure. B10 has the strongest greatsword length. The artist/root consider B06–B10 distinct enough for concept comparison with the B08 caveat; these are still not selected poses.

## Follow-up review checklist

The frozen pilot contains 20 generated concepts: 19 are selectable for further review, and A04 is flagged for revision. None is production-approved.

For any later sources, inspect the whole gallery sheet and each concept at the intended display scale. Record whether: the rear three-quarter right camera matches the selected Reaver references; the full cape/boots/weapon read clearly; hands and grips are physically readable; the smash hold is distinct from its action sequence; guard-break has an unmistakable grounded knee and collapsed guard; and each weapon matches the requested family. If transparency is under review, confirm it with browser compositing rather than inspecting hidden RGB in an image viewer. Treat visual review as separate from provenance and export checks.
