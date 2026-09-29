# Bow attack source sheets

Eight original transparent 7-column × 4-row sheets were generated with the
built-in image generation tool on 2026-09-28. Each row uses one project-owned
unarmed-magic `STANCE-READY.webp` outfit as a character reference and
`art/painted-items-2026-09-07/shortbow.png` as the weapon reference. The exact
row order is in `tools/bow-animation-import.py`.

The generation prompt for each sheet used this template, with `{outfits}`
filled by its four ordered outfit names:

> Create a production 2D game sprite sheet for RIGHT-FACING fantasy archers,
> using the four supplied character images as exact outfit and painterly style
> references in their provided order, and the supplied shortbow image as the
> exact weapon shape. Transparent background. STRICT grid of 7 equal-width
> columns and 4 equal-height rows, exactly 28 complete full-body figures, one
> figure centered in each cell, consistent head size, feet baseline, camera
> angle, and proportions. Rows 1–4 are {outfits}. Each row shows one continuous
> bow-attack action across seven columns: (1) alert ready with bow held low,
> (2) lift bow toward right, (3) bow arm extended horizontally right and
> string hand pulling to cheek, (4) string fully drawn with nocked arrow
> pointing right, (5) release arrow, (6) follow-through with bow arm extended,
> (7) recover to ready. Bow is in the forward hand in all frames and has a
> visible taut string in draw frames. Clean silhouette with no cropping or
> overlapping cells. No text, numbering, labels, borders, colored background,
> shadows outside cells, extra characters, or extra limbs. Preserve each
> reference character's face, clothing, armor, body shape, and color within
> that row.

`tools/bow-animation-import.py` slices and places the figures on the shared
640px combat canvas. `tools/bow-animation-config.mjs` registers their clips.
The painted bow is held in the forward hand; left-hand bow bindings share that
same art rather than claiming a separately authored mirrored sequence.
