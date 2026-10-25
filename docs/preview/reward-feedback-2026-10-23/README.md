# Reward inspection, progression and buff feedback

PR [#2260](https://github.com/cehinds/AshenSpire/pull/2260), captured 2026-10-23, 04:06–04:13 UTC. These are controlled production-renderer fixtures, not a completed playthrough or published-host recording.

Source `8a4c56b3bae4140a13738664834fbbd1e306f784` covers the configured reward inspector, levels and combat floats. Final generic chooser source is `4d466e7d81d923cead296021def7950563f86726`; its only intervening changes are name-only reward buttons and their test. The other rendered surfaces are byte-identical. Every browser result records stable start/end source commits. The standalone build of the final source passed; its local version is `0.7.1.1785`, digest `9dd99d4783` (the committed receipt box remains `0.7.1.1784` until the merge stamp). CI produces the downloadable build and the PR tracks promotion/publication.

| Capture | Viewport | What it shows |
| --- | --- | --- |
| [Buffs on phone](buff-mobile.png) | 390×844 | Actual enemy Consecrate: +3 Strength and +6 Precision. |
| [Buffs on desktop](buff-desktop.png) | 1440×900 | Separate positive-gain words over their recipient. |
| [Buffs on wide screen](buff-wide.png) | 1920×1080 | Both words during real action playback. |
| [Buffs on tablet](buff-tablet.png) | 768×1024 | Labels remain within the viewport. |
| [Reward inspection](reward-inspect-mobile.png) | 390×844 | Existing full read-only card inspector; native scrolling continues below the viewport. |
| [Reward buttons](reward-choices-desktop.png) | 1440×900 | Short, uniform name buttons and a separate Inspect action. |
| [Core level](level-core-mobile.png) | 390×844 | Honest no-benefit notice and old-to-new level progress. |
| [Actual benefit fixture](level-benefit-mobile.png) | 390×844 | Registered source-school cards show resolved before/after values; this is not a Core starter-level reward. |

`SHA256SUMS` identifies these eight original PNG files. Both a browser QA agent and the coordinating agent inspected the representative captures. Transient floats were captured immediately through CDP after observing visible words, without extending their lifetime or changing styles.

Verification:

- 48 configured inspection loops: six reward kinds, chooser/review, four viewports. Eight final generic loops cover actual Arrow/Enter, Tab/Space and phone touch. Inspection and one Escape preserve selection, offer, stage, run, deck, XP and claim count.
- 12 progression cases use actual award/notice models: Core 0→1, compatible registered Blade 4→5 and 4→10, next benefits and unchanged XP on rendering/Continue. Current Core starter levels grant no stat bonus or unlock; the UI does not invent one.
- Seven combat cases use real End turn, the authored Wyrm Aspirant, engine-produced receipts and production playback. Includes normal four-view, phone OS/manual reduced motion and Instant. A four-grant burst verifies three visible lanes, hidden queued words, no sampled overlap and eventual display of every gain; the longest name fits 390px.
- Local focused tests, historical combat/save golden projections, translation/style/config/plant/receipt checks and the standalone build passed. Independent review covered all implementation and follow-up fixes; CI results are linked from the PR.

Environment: Chromium 154 on Linux, repository-owned browser/server lifecycle, no font or CSS zoom overrides. Local fetched light-art fallbacks were used. No page exceptions were observed. Audio was not verified: optional local SFX 404s and autoplay/vibration restrictions were recorded, so this is not a clean-console/audio claim. Tablet glance text remains compact at the existing default app scale; inspection retains full rules. Native phone hardware, other browsers and published-host navigation were not tested. The execution environment cannot access the Pages host.

Full JSON receipts and reproduction harnesses remain outside the tracked tree in `/workspace/scratch/reward-feedback-qa/final-exact`; bulk QA JSON is intentionally not committed. All owned browsers, profiles and servers were closed.
