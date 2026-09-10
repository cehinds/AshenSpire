# Tower entrance preview

Local concept on `codex/tower-entry-preview`; not promoted to dev, test or release.
The initial prompt starts a 2.6-second sequence: River Citadel lights awaken,
the view approaches the tower, and a central doorway reveal opens onto its hall.
The real menu then mounts. Continue retains its existing save-resume action.
Replay entrance returns to the initial prompt; reduced motion skips the movement.

This preview uses layered paintings and a doorway wipe, not a 3D camera or
physical door simulation. The portrait hall is separately composed to retain
the arch and pillars on phones. No save schema or game mechanics change.

## Artwork and prompts

Created with the built-in image-generation tool and converted using Sharp to
WebP quality 90. Runtime assets are in `assets/bg/`.

- **river-citadel-unlit.webp:** lighting-only edit of River Citadel. Preserve
  the exact camera, architecture, mountains, bridges and river. Extinguish all
  artificial lights, beacon, gold reflections and floating particles. Slightly
  darken ambient light while retaining silhouettes and the charcoal/umber
  painterly palette. No UI, text, characters or new architecture.
- **river-citadel-lit.webp:** preserve the same camera and geometry. Illuminate
  all windows, lanterns and tower beacon with restrained amber gold and matching
  river reflections. Keep ambient light dark and painterly details unchanged.
  No new buildings, text, UI, people or floating particles.
- **tower-entrance-hall.webp:** inside the same gothic tower, look outward
  through an open pointed arch to city, river, bridges and mountains. No central
  tower outside because the viewer is inside it. Frame the scene with charcoal
  stone pillars, ribs, open timber doors, worn flagstones and amber sconces.
  Keep the center quiet for menu text, matching the reference palette and
  painting style. No people or baked-in text/UI.
- **tower-entrance-hall-phone.webp:** recompose the hall for a 2:3 phone image,
  showing the whole arch, pillars and sconces rather than merely cropping.
  Center the opening at approximately 55% of the width. Same scene, materials
  and palette, quiet center for lettering, no added panel.

## Validation

Flow: initial prompt -> city lights -> hall -> real menu -> New slot dialog ->
back -> replay. Playwright is used because the Browser plugin is unavailable.
Checks cover 390x844, 1440x900, 320x568, 844x390, repeated activation and system
reduced motion. Physical mobile Safari has not been tested.
