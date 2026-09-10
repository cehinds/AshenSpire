# Hurt feedback and defeated poses

49 grounded defeated frames: every enemy and all sixteen painted player outfits. Each source strip contains a matching idle seed and a newly drawn horizontal defeated pose. References are the approved enemy idle PNGs and painted outfit idle WebPs.

Run `node art/defeated-poses/build.mjs` from the repository root with sharp available (the same dependency used by painted-outfits-ship). The builder removes baked checkerboards, detects the separating gutter, preserves one scale across both cells, and registers the defeated frame against the original idle. Outputs are 384px transparent WebP with a shared ground at y=364. The Fell Warden needs a larger speck threshold to remove isolated checkerboard debris. Source sheets and the generated manifest retain provenance and scale information.

`index.html` provides Hurt, Defeated, and Revive controls for every character. Hurt feedback holds the original hurt drawing for three equal beats: ordinary colors, red hue, ordinary colors. It applies to attack damage and direct/status HP loss. Fully blocked damage keeps its guard reaction. The existing Reduce flashes setting suppresses the tint. Defeat is a persistent pose and is restored from health/alive state on solo and co-op redraws; revival restores the living resting pose.

Checks: `node art/defeated-poses/browser-check.cjs` samples all 49 hurt sequences, persistent defeat, revival, reduced motion and flash preferences. `node art/defeated-poses/game-check.cjs` checks real combat redraws in served and standalone builds at 1440px and 390px. Both use Playwright and the local preview on port 4288. Run the repository build and shipping checks after exporting assets.
