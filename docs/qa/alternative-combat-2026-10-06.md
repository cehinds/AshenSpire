# Alternative playable combat validation

- Branch: alternative/dev, PR #1670.
- Build: 0.7.1.1033, source digest 412091e728.
- Runtime art: 19 rear-view armor appearances, 33 enemies, two companions and
  five speakers encoded from the approved catalog; 64 WebP files total including
  scenery and the card-section texture. Every derivative is hash-pinned.
- Fifteen Node tests passed for art identity, existing formations, environment
  selection and mobile rendering. Alternative formation checks passed at
  1600x550, 390x464 and 844x230 field sizes with one through six enemies.
- Chromium at 1600x1000 and 390x844: fresh title, Quick start, mastery choice,
  map encounter, real card selection and target click, end-turn confirmation,
  hand-retention choice, and turn 2. No page JavaScript errors.
- The same input flow passed from the portable file URL at both sizes, with
  alternative figures rendered. The download contains its artwork; it does not
  depend on the authoring directory or a source server.
- Desktop and phone screenshots were inspected for the rear player view,
  red/gold silhouette edges, separate scenery, bottom texture fade, and unchanged
  card/HUD/footer components. Hollow Weald is the first fully layered scene.

## Boundaries

- The separate art continuation is converting the remaining scene sets and
  companion/speaker perspectives. Existing regional art remains available.
- Combat Studio browser drafts are authoring data, not automatic live-game writes.
- This is local Chromium evidence, not physical-phone acceptance or proof of
  all possible encounters, animations and control combinations.
- The source-only preview server reports the pre-existing optional music
  manifest 404. Pack and standalone builds include the pinned audio assets.
- Hosted CI and Pages delivery are tracked separately from these local checks.
