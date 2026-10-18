# Merged Dev combat HUD capture

Captured 2026-10-18 from reviewed merge `bd847d3baf00f1af690c2148528d03b98b728a95`, incorporating Dev `a0b54c60e00bfdff3a1bbfb840a949424ed205f1`. A fresh canonical cache build produced local **0.7.1.1560**, digest `3568240a83`; these are new captures of actual `dist/AshenSpire.html?shot=combat`, not reused 026 images. Fonts loaded and no image failures were recorded at all four sizes; all captures were inspected. No capture-only layout CSS was applied.

This default solo-combat fixture documents current rendering. It does not demonstrate every profile, latency, hosted gameplay or live co-op. The current CI artifact is recorded below; exact public-route identity verification remains pending. Historical 026 captures and Q publication proof remain separately recorded in the parent gallery. Earlier Q quick-start 253/749 had only 1 ms margin, and historical T traces were nominal observations; neither proves timing for this merge. The existing about/changelog browser check passes 985/985, source plus selected standalone Settings.

| Phone · 390 × 844 | Desktop · 1440 × 900 | Wide · 1280 × 720 | Tablet · 768 × 1024 |
| --- | --- | --- | --- |
| ![Merged combat on phone](mobile.png) | ![Merged combat on desktop](desktop.png) | ![Merged combat in wide layout](wide.png) | ![Merged combat on tablet](tablet.png) |

See `capture-record.json` for exact source/build and viewport provenance.

Current runtime source: `93c799b285e464c64daad6604a182f510dbe15f9`. Verified [artifact 12120177516](https://github.com/cehinds/AshenSpire/actions/runs/39084603309/artifacts/12120177516) is **0.7.1.1560**, digest `e303de8945`, ZIP SHA-256 `26369b12c5d83987e09268d1205eec7bb5c5bfb4433d2fdbd305fe97fffd9cf9` ([run 39084603309](https://github.com/cehinds/AshenSpire/actions/runs/39084603309), job 117548431748). Exact public proof is pending.

The screenshots remain actual merge-source `bd847d3baf00f1af690c2148528d03b98b728a95` / local build 1560 / `3568240a83` captures. Subsequent lossless catalog encoding decodes to semantically equal JSON values and preserves runtime styling, so the images are retained with their original provenance; they are not captures of the final artifact. Current-source quick-start CI passed at median contact 250 ms / first number 665 ms with unchanged budgets. Other fast checks were pending at this update; this is not a hosted-gameplay or uniform-performance claim.
