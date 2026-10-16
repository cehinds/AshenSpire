# Mobile floor clearance

Only the `mobile` form factor raises the ground layer. Desktop, widescreen and tablet keep their existing scenery geometry. Actor positions, scales and formation cells never depend on this adjustment.

`combatFormationModel.positioning.perspectiveGrid.scene.mobileFloor` authors a **10 physical pixel** clearance and each ground asset's first full-width painted row (alpha at least 128), normalized to image height. The reviewed mobile ground exports were measured directly; the boundary represents actual terrain rather than the transparent image box. Other regions use their corresponding boundary; missing/custom assets keep their original geometry until a reviewed boundary is authored.

After sprite fitting, the stage measures the actual CSS floor shadow, including its transform and sprite zoom. The highest shadow top in occupied band A supplies the limit. If A is empty, B then C supply it; no enemies means no adjustment. HUD rectangles are excluded.

The ground image uniformly scales about its horizontal centre and existing bottom until its painted boundary is at least 10 pixels above that shadow. Aspect ratio and lower coverage are preserved; the sky, landmarks and SVG camera remain unchanged. Every pass starts from authored layer coordinates, so resize cannot accumulate zoom. Ground parallax is held still on mobile to preserve clearance; other scenery motion remains available. Measurement attributes `data-mobile-floor-paint-top` and `data-mobile-floor-shadow-top` on `.alternative-backdrop` are physical offsets from the combat root top, cleared when inactive.

## Centred Mobile preset regression

At 844×390, selecting Settings → Display → Mobile centres the combat root at approximately x332–512. The pre-floor stage at `764743642` subtracted that viewport inset from already-local formation coordinates, placing actors at x20–150. The stage now converts field-relative positions and deltas against a zero local origin; the shared viewport/fixed-element conversion is unchanged. Actor sizes are unchanged. `tests/mobile-centered-formation.browser.mjs` uses the real Settings control and checks actors plus visible grid cells remain inside the centred root.
