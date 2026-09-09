# Seven-frame transition studies

Local reference preview: `/transition-reference-preview.html`. Experimental work stays unmerged.

Greatsword playback now follows the requested original sprite numbers: **1 → 3 → 2 → 6 → 5 → 4 → 6 → 7 → 1**. This is nine playback steps using seven existing drawings. The original thumbnail numbers are retained; stepping, playback and the previous-frame overlay follow the new order. Append `?class=reaver&play=1` to start playback on opening the preview.

Six sequences cover the four existing class references plus Reaver sword/shield and Herald staff/free-hand casting. Each has seven drawings (42 exports total): guard, windup, bridge into contact, contact, bridge out of contact, follow-through and recovery. The last frame returns to guard. Three bridges per sequence keep the total within the requested five-to-seven-frame range; this is not three inserted frames per gap. Hit and menu idle are excluded.

The source artwork already contains each weapon. Reaver was generated from its original combined sheet; the other sequences use four-pose guides in `keys/` to exclude unrelated hurt and menu poses. Original combined references remain unchanged one directory above. `sources.json` records prompts, selected image files, source-slot ordering and manually estimated front-foot registration. The recovery edits replace abrupt Rogue/Reaver returns, the shield correction removes an erroneous double-ended sword, and the Starseer correction puts its staff above the casting axis before contact. Some generated source sheets contain an unused eighth drawing; only seven selected frames are exported.

`build.mjs` slices the source PNGs, removes connected neutral background pixels, and translates each drawing onto a shared 600 × 560 canvas. It does not redraw limbs or resize individual frames. Custom crop boundaries retain weapon tips extending beyond nominal sheet cells. Source masters are preserved. `extraction.json` reports the output bounds and registration for inspection.

Preview controls include normal, half and quarter speed, single-frame stepping, loop playback, and an optional previous-frame overlay. Bridge frames are marked in gold. Each sequence links its original four key poses and regenerated source sheet.

Validation: `node art/combined-reference/transitions/build.mjs` and `node art/combined-reference/transitions/check.mjs` (requires Sharp/Playwright and the local server on port 4291). The check exercises every sequence/frame, loop wrap, quarter-speed timing, image loading, overlay toggles and 390px layout. Filmstrips and browser captures are under `inspection/`.

Visual review covered all 42 exported drawings, with additional generation passes for incorrect poses and weapon shapes. These remain silhouette motion references, not finished painted sprites. Some hand outlines and weapon-length variation still need a tracing pass before layered production assets. New hand/weapon anchors must be traced on these drawings; reusing old coordinates would misrepresent the grips. No runtime animation selection, equipment layers, live game build or release files are changed.
