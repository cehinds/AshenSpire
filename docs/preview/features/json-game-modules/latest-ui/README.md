# Reading Desk and compact Rest — combined standalone evidence

Captured October 15, 2026 in America/Anchorage (October 16 UTC). The exact local standalone artifact was built from source **3abd51267**: version **0.7.1.1534**, runtime digest **b284ae955d**, SHA-256 `88d880b435f617cf48eb93f04e495c6e75ab3c1f7f93bd5b438e3e68b9221d60`. Core and current/full captures use that same HTML with their respective `gameProfile` query. The separate current-default branch changes three configuration files; these screenshots do not claim to have loaded its CI archive.

Both CI builds succeeded: [core run 38856854055](https://github.com/cehinds/AshenSpire/actions/runs/38856854055) / [artifact 12027328615](https://github.com/cehinds/AshenSpire/actions/runs/38856854055/artifacts/12027328615), and [current run 38856921594](https://github.com/cehinds/AshenSpire/actions/runs/38856921594) / [artifact 12027428006](https://github.com/cehinds/AshenSpire/actions/runs/38856921594/artifacts/12027428006). Latest Pages publication was not verified by this capture pass.

This gallery records the combined standalone application after the card catalog, combat rules, compact Rest frame, and revised Reading Desk were integrated. Earlier source-only comparisons remain in [reading-desk](../reading-desk/) and [rest-sidebar](../rest-sidebar/). The [first-wave Dark veil, Mana, and map evidence](../dark-veil/README.md) remains historical.

| Host viewport | Core Rest | Core Reading Desk |
| --- | --- | --- |
| Desktop · 1440×900 | [Rest](desktop-rest.png) | [Desk](desktop-desk.png) |
| Wide · 1920×1080 | [Rest](wide-rest.png) | [Desk](wide-desk.png) |
| Tablet · 1024×768 | [Rest](tablet-rest.png) | [Desk](tablet-desk.png) |
| Mobile · 390×844 | [Rest](mobile-rest.png) | [Library](mobile-desk.png) · [Inspection](mobile-inspection.png) |

Desktop uses a large card face above its description; the reading pane scrolls to retain the full description without shrinking the face; selecting a different library card updates the inline inspection. Show animation is a checkbox, and the optional preview can be paused. Rest keeps its scenery in proportion beside a compact service sidebar on wide displays; mobile keeps its service pane and Continue footer reachable.

Additional captures: [description scrolled into view below the large face](desktop-description.png), [paused animation](desktop-animation-paused.png), [invalid deck count](desktop-invalid-count.png), [unsaved-change confirmation](desktop-unsaved-confirmation.png), [current/full Rest](current-desktop-rest.png), and [current/full Reading Desk](current-desktop-desk.png).

Focused browser checks cover selection updates, description access, viewport bounds, cancellation and acceptance, the one-service core Rest transaction, and current/full library grouping. Both Escape and Cancel review unsaved changes; Keep editing retains the draft, while confirmed discard returns to the unchanged Rest. Accept remains unavailable below the minimum deck size, with a red current/minimum count. A valid accepted deck is persisted and spends that core Rest visit. Equivalent current/full Strike copies share one owned/unlimited counter.


The final focused Chromium pass succeeded at all four sizes with no page errors. The core checks confirmed actual saved state after Accept and unavailable service cards after commitment. The current/full fixture enabled its existing Rest-only editing setting, reached the same Reading Desk through the Rest service, and showed a single equivalent Strike row with a combined `2/∞` count.

Sweep correctness was checked separately against the actual corrected definitions, not inferred from the already-working Sweeping Blow fixture. Three focused `sweep-targeting.test.mjs` cases passed: core Sweep, current Hewing Arc, and grade-zero Crimson Cleave. They exercise the browser target model's `needsTarget=false` plan, untargeted production dispatch hitting both living enemies, and one resource payment. No new broad Rest or profile suite was run by this capture helper.
