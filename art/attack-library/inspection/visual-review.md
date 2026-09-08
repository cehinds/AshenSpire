# Visual review, 2026-09-08

Status: experimental, no sequences approved for game integration.

Inspected all fourteen generated atlases for row/outfit identity and pose order.
Compared assembled screenshots at guard, windup, strike and follow-through for
the nine named examples. The browser also exercised normal and quarter-speed
playback; successful playback is not a visual-quality judgment.

Corrections made during this pass:

- Rejected the initial checkerboard-backed Reaver study.
- Redrew Rogue attack/dodge frames whose base outfit changed to teal.
- Redrew Starseer one-hand casting to keep the staff fist at the hip while the
  separate free hand performs the spell gesture.
- Redrew Herald's third buff pose to expose the main gripping fist separately
  from the hand raised to the heart.
- Reduced oversized shields and added camera margins after weapon blades were
  clipped by the stage. Shield faces now cover their strap hand.
- Reused cropped Reaver palm parts and reduced cyan spill at silhouette edges.

Remaining findings:

- Colored registration remnants and cut-out centers are still visible on some
  hands, especially Rogue dodge and Starseer casting. These require clean hand
  artwork and verified finger occlusion; passing socket detection is not enough.
- Reaver hand overlays need additional orientations and better wrist blending.
- Two-handed support-grip scaling can change the apparent weapon length. That
  needs rigid grip-spacing calibration against the authored pose references.
- Small silhouette changes, pose timing and foot planting still need a full
  frame-by-frame motion review. Source cells are too small for final hero art.
- Inventory-icon grips have not been visually certified for all loadouts.

Next art pass: clean and calibrate one Reaver attack family and one Starseer cast
family completely, including both hands, before extending their equipment and
outfit coverage. Preserve the other studies as references; do not merge them.
