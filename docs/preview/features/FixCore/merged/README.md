# FixCore merged battlefield captures

- Source served: `39e96eb7c8dc5a133df1cbae52cb7ab201b1f1e3`, integrating layered battlefield art from `761f854b7`.
- Captured **2026-10-18 UTC** in Chromium, using repository source over HTTP through `tools/serve.mjs`. These are explicitly posed Core 2 fixtures over the real engine/renderers, **not earned encounters, a played-through run, or captures of built standalone HTML**.
- Authored scene: `city-street`, weather `rain`, time `day`; resolved layered scene `city-street-rain`. Screenshot query: `shot=combat&gameProfile=core&shotLayeredScene=city-street&shotWeather=rain&shotTime=day`, with `shotSettings` explicitly setting `oneTapPlay:false` for selected-card inspection.
- Historical stamp during capture: **0.7.1.1621**, digest **3ee314657f**. That stamp alone does not identify a newly built integrated artifact. The combat HUD has no visible build stamp.
- Corresponding rebuilt standalone: **0.7.1.1622**, digest **9341762dd1**; [CI artifact, run 39164694361](https://github.com/cehinds/AshenSpire/actions/runs/39164694361/artifacts/12149454632). The actual built `/AshenSpire.html` passed local HTTP boot with the Core 2 gate, five hand cards, two enemies, the rainy scene, decoded layered images and particle texture, and **zero page errors**. HTTP boot does not certify `file://` use or offline operation.

| Image | Actual viewport | Capture UTC (file mtime) | Subject |
| --- | --- | --- | --- |
| mobile.png | 390 × 844 | 2026-10-18T20:53:38Z | Selected multi-hit card, known odds and defense/status PIPs |
| desktop.png | 1440 × 900 | 2026-10-18T20:50:11Z | Damage calculation with named offensive and protection sources |
| wide.png | 1920 × 1080 | 2026-10-18T20:50:30Z | Multi-hit card, target facts and layered battlefield |
| tablet.png | 1024 × 768 | 2026-10-18T20:49:53Z | Touch damage inspection and tablet layout |

All four images were inspected. Mobile's incidental Block hover explanation was dismissed by moving the pointer away and waiting 750 ms, beyond the authored 500 ms close delay; the card remained selected. The original raw frame is retained outside the tree. No pixels or layout were edited for these captures.

The four-view browser checks passed with **zero page errors**: exact defense facts and square PIPs, preview/receipt parity, multi-hit text containment, successful-read odds gating, touch inspection without playing, MP counts, modal layering, End hold cancellation, Deck/SP separation, decoded layered image/particle assets, weather input transparency and reduced-motion pause/resume. The full default OneTap suite passed serially; the original setting-off double-tap case also passed three isolated timing runs. An initial parallel run failed that case once; its cause remains unproven and it is not counted as a pass.

[Play the public FixCore preview](https://cehinds.github.io/AshenSpire/branches/feature/FixCore/latest/): the latest verified deployment at record time is still **0.7.1.1620**, digest **9bfa453b97**, source `97d7b111779a5fca67007917264217f59c7cdd09`. [Pages run 39162811065 / deploy job 117786710670](https://github.com/cehinds/AshenSpire/actions/runs/39162811065/job/117786710670) passed its public checker across 24 feature routes. **Publication of 1622 is pending**; these newer captures must not be attributed to the older public build. Artifact downloads require GitHub sign-in. Direct public navigation is blocked in the local environment.

The [original four captures](../README.md) retain source `f3929892c` / build **1616** provenance. The Release gallery remains **1517**: the coordinator rechecked the Release branch through GitHub at **2026-10-18 21:05 UTC**, unchanged at `d310c277fffaaec6ec7a58a87de846577f12312d`, matching its committed capture record. Public Release history could not be fetched locally. Release images and their record are unchanged.

Raw browser logs, checks and hashes remain outside the tree under `/workspace/scratch/fixcore-layered-rain-39e96eb7c/`, `/workspace/scratch/fixcore-layered-curated-39e96eb7c/`, and `/workspace/scratch/fixcore-standalone-layered-smoke-39e96eb7c.log`. Only the four curated PNGs and this bounded record are committed.
