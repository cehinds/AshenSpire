# Rest sidebar preview

Source implementation: `39a3ea1df` (`styles/player-polish.css`). Captured from the served source app at `http://localhost:4467/index.html?shot=rest&gameProfile=core&shotRestState=wounded&shotRestPoints=1` with Chromium and Playwright, reduced motion enabled.

| Capture | Viewport |
| --- | --- |
| desktop-rest.png | 1440 × 900 |
| wide-rest.png | 1920 × 1080 |
| tablet-rest.png | 1024 × 768 |
| mobile-rest.png | 390 × 844 |

The Rest frame uses a compact right sidebar on wide screens; mobile keeps a scenery aperture above a scrolling visit body and a fixed Continue footer. Tablet/mobile service lists scroll to retain readable text and tap targets.

Art is reused unchanged from the existing release: `assets/player-polish/scenes/chapel-rest-master.webp` (square, 1254 × 1254 high tier) and `assets/player-polish/illustrations/rest-traveler-fire.webp` (3:2). The CSS preserves both aspect ratios and scales the painting from the scenery area. This change does not extend the artwork or add a wider source. The existing landscape design candidate, `docs/design/player-components-2026-10-03/assets/scenes/chapel-rest-desktop.webp` (1672 × 941), is not used; adoption would require the normal art release pipeline.

Validation: 25 focused Rest model/DOM tests; all three configured services' cancellation, confirmation, full pool/flask recovery, save/load persistence and spent re-entry browser checks; source screenshots and service modal checks at the four viewports above. Additional 844 × 390 landscape checks passed. Browser geometry checks confirmed original image proportions, no page/body horizontal overflow or service-card content overflow, bounded sidebar, reachable Level Up, cancellable modal and visible Continue. No page errors were recorded. The Browser connector runtime was unavailable in this environment; the explicitly requested real-browser checks used installed Playwright/Chromium. These are source preview captures; the parent task verifies the combined standalone build separately.
