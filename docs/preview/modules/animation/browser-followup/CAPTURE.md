# Co-op HUD browser follow-up

Captured 2026-10-17 UTC from the production `mountCoop` renderer through the
explicit source `?shot=coop&shotSettings={"manaRing":false}` screenshot fixture.
The transport and host snapshot are canned. These captures do not demonstrate
a live co-op connection. The canned seats have no player appearance; their
crossed-swords placeholders and the fixture backdrop are expected.

Source base: `61b1eeaa8885342a734fd3e28bc55d741b99a1ef` (Dev).
Inherited build identity: `0.7.1.1551`, digest `fb5dff3704`.
This is source-preview evidence of the uncommitted HUD correction, not a newly
published build. Captured fixed `styles/combat.css` SHA-256:
`4c2540e842cbbf4dab3db16806c5f70d89d30b3bc12dfbd38f462fb215521a3d`.
The consolidated feature preview will supply the published source/build identity.

Both baseline and fixed captures await `document.fonts.ready` and all image
`decode()` promises; the capture records report fonts loaded and zero failed
image elements. Art uses the pinned `hd-assets-v23` cache and source display
copies. No capture-only layout CSS is applied. Baseline comparison swaps in
the exact base commit's combat stylesheet; fixed views use the working source.

- Phone: `after-390x844-bars.png` (390 × 844).
- Desktop: `after-1440x900-bars.png` (1440 × 900).
- Wide: `after-1280x720-bars.png` (1280 × 720).
- Tablet: `after-768x1024-bars.png` (768 × 1024).
- Baseline/fixed comparison: `before-390x844-bars.png`,
  `before-1280x800-bars.png`, `after-1280x800-bars.png`.

Before the correction, phone Leave reaches y=101.77 beyond the 76px HUD band;
desktop resource bars start at y=-3.23 and Leave reaches y=82.27 beyond 80px.
Afterward, phone Leave ends at y=62.08 and its label at y=74.77; desktop
resource bars start at y=8.77 and Leave ends at y=61.52.

Validation: `node --test tests/coop-hud-top.test.mjs
 tests/ui-component-catalogs.test.mjs` passes 69/69. The unmodified full
`tools/coop-hud-top.mjs` browser probe passes GREEN 6/6, including ring on/off,
390×844, 844×390 and 1280×800, all subsidiary orb/seat/privacy/Counter/flask/vow
checks, and comparisons with the solo action bar. Screenshot evidence concerns
the topbar correction only.
