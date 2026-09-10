# Tower entrance preview

Local concept on `codex/tower-entry-preview`; not promoted to dev, test or release.
The initial prompt lights River Citadel over 560ms, holds the fully lit city,
then crossfades into the hall over 880ms. Settings > Game > Lit city pause
offers 0s, 0.3s, 0.5s (default), 1s and 2s. The setting persists between visits.
Reduced motion skips the hold. Darker layers improve menu readability.
The real menu then mounts. Continue retains its existing save-resume action.
Replay entrance returns to the initial prompt; reduced motion skips the movement.

This preview uses opacity fades only, without camera movement or a doorway wipe.
The portrait hall is separately composed to retain
the arch and pillars on phones. No save schema or game mechanics change.

The hall is now two independently rendered layers: an unobstructed city plate
at 28% brightness behind a foreground doorway. SVG display masks remove the
outdoor opening from the original doorway paintings, preserving the original
stonework, doors, lights and floor. The masks have matching landscape and
portrait dimensions and use the same cover/crop behavior as their artwork.
The interior city now uses an unlit variant with all windows, street lights
and golden river reflections removed. The doorway sconces remain separate.
A feathered, translucent dark backing fades in behind the ASHEN SPIRE wordmark
on both title states; reduced motion shows it without animation.

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
- **tower-city-background.webp:** built-in image-generation edit of the
  landscape hall. Remove foreground door, pillars, sconces, banners and floor;
  extend only the outdoor river city, bridges, mountains and sky across the
  canvas. Preserve the central outdoor perspective and muted painted style.
  No central giant tower, people or UI. Export to WebP at quality 90.
- **tower-door-mask.svg / tower-door-mask-phone.svg:** native display masks
  defining the transparent arch opening over the original hall paintings.
  Attempted raster cutouts returned painted checkerboards and are not used.
- **tower-city-background-unlit.webp:** built-in image-generation lighting
  edit of the city plate. Preserve camera, geometry, buildings, bridge and river;
  extinguish every artificial light and remove gold reflections and floating
  particles. Slightly darken ambient light, retain silhouettes and painterly
  charcoal/umber palette, add no objects or UI. Converted to WebP quality 90.

## Validation

The outer doorway gently fades between 100% and 92% opacity over an 11-second
cycle while the city and menu stay steady. Reduced motion and Ambient Off
disable this idle effect.

Flow: initial prompt -> city lights -> hall -> real menu -> New slot dialog ->
back -> replay. Playwright is used because the Browser plugin is unavailable.
Checks cover 390x844, 1440x900, 320x568, 844x390, repeated activation and system
reduced motion. Physical mobile Safari has not been tested.
