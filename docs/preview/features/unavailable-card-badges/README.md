# Unavailable card cost cue — PR 2276

[Play the feature build](https://cehinds.github.io/AshenSpire/branches/fix/UnavailableCardBadges/latest/) · [CI artifact backup](https://github.com/cehinds/AshenSpire/actions/runs/40046098211).

Captured 2026-10-24 UTC from the official local packed candidate, source commit `31688946b06b3d361476d0418c845dc2785b2254`, complete tree `aace41d6b4f59b3f1f3b859557bf978959e5b835`, build `0.7.1.1805`, source digest `27954845c7`, light edition. HTML SHA-256: `8c620b56be1915b78d82fed8764c683e95a0197b92035729e21e2256ee442019` (14,769,017 bytes). Docs-only publication commits do not change these code/build inputs.

The official packed-only command was `ASHEN_ART_SOURCE=cache node tools/bundle.mjs --light --out <private-output>`. A temporary read-only cache input alias was removed after the writer closed; no cached asset or old artifact was changed. Local source identity and external-asset verification passed 314 checks. The exact same complete source tree in CI merge `ae2bab2070d48166c36a914d17dbf3d233047873` passed the separate 12-check shipped gate and 22 negative external-asset plants. This is split local/CI proof, not a claim that the local packed-only directory passed the standalone shipped gate.

[Trusted Pages deployment](https://github.com/cehinds/AshenSpire/actions/runs/40046449287/job/120734353272) HTTP-verified the feature wrapper/metadata at the exact source commit above among 26 feature previews. Captures executed the local official pack; they are not direct public-host navigations.

| Capture | Viewport | Effective quality | PNG SHA-256 |
| --- | --- | --- | --- |
| [mobile](mobile.png) | 375 × 667; DPR 3; touch | auto → Lite | `f6a4aa86b3a1e14511fbb0c7de90e975143d6e9e3afc113ccb74ee1a11eea3b1` |
| [desktop](desktop.png) | 1280 × 720; DPR 1; mouse | auto → Full | `a0d83d853591480547f3950313e2c49c9e43fe1baab6eafbad0d6a8852c31e5e` |
| [wide](wide.png) | 1920 × 1080; DPR 1; mouse | auto → Full | `b8e1fcecd319c85efa09dea56959756c546b25333fb311c330863dc90b0fdf53` |
| [tablet](tablet.png) | 768 × 1024; DPR 2; touch | auto → Lite | `ee3eedea43700ae074317154e3a8abb1aedb58c5b294c297f9fed198531ad9b9` |

The game’s native ephemeral `?shot=combat&shotSeed=SHOWCASE&shotClass=reaver` fixture starts with affordable Sundering Art (2 SP + 1 MP). Native Defend then Strike leave 1 SP + 1 MP. All remaining hand costs/affordability classes, exact-once payment/target/effects, and the unaffordable card’s target refusal were checked; refusal changed no HP, resources or events. Information opened, the first Escape closed it, and focus returned to its native button. All 15 fonts loaded. The main session inspected these four captures plus phone selected/Information and an explicit native `shotSettings={performanceMode:"lite"}` desktop context.

In Lite, the face remains opaque, the existing inset body shade stays at 40%, and only cost image/text children receive opacity 0.65 when unavailable. Existing layer opacity still multiplies. Both Stamina and Mana badges and their flags/trims protrude beyond the face and remain visibly dim; the overlapping face shows no neighbor text/art bleed. The nominal cue attenuation is 0.39 inside the body overlay and 0.65 outside it. Full-mode child opacity remains 1; its existing filters are unchanged. Native hover/focus/selection and target preview tooltip behavior were retained.

Default phone/tablet resolve to Lite/fast presentation, default mouse desktops to Full/normal. Reduced-motion media and body settings were false; durable localStorage stayed empty. Pacing values were recorded using the frozen source resolver and native ephemeral defaults/fixture, not by altering the browser. These are configuration records, not measured performance timings. No CPU slowdown, profiler, CSS/HTML injection, game-function wrapper or RNG override was used. Critical `_emitEvent` identity stayed exact; the only changed function key was the source-proven native `emit` rebinding, with old/new bodies recorded.

Health evidence is intentionally qualified. The phone’s original blanket zero-network-error gate failed on five documented optional SFX sample 404s and Chromium’s vibration policy notice; its older console records lack per-message URL/source attribution, so no retrospective error-gate pass is claimed. The tablet’s original guessed-source classifier also failed; preserved CDP evidence showed the exact native `intervention` source, and a reviewed pure offline reclassification found zero unexpected errors, five paired optional SFX 404 responses and two native policy records. The three subsequent desktop contexts passed the strict classifier, which permits only the five named optional sample 404s at the exact pack path with response/CDP correlation, and the exact native vibration message with intervention attribution. All Runtime console errors/asserts, page exceptions and other HTTP failures remain fatal. Previous failed harness attempts are preserved outside the repository.

All candidate files and protected old artifacts passed before/after hash/inode checks. All browser contexts, servers and profiles closed. The original whole-face-alpha experiment failed visual review and is preserved as rejected evidence; this opaque-face correction does not claim a mobile performance improvement. Issue #2249’s mobile performance target remains unmet and the earlier floor candidate remains unadopted.

Component catalog: [existing illustrated-card component](../../../component-catalog.html). No component ID, model, renderer or composition changed.

This feature block and folder are temporary review evidence and are removed before the PR merges into Dev, as required by CONTRIBUTING.md. The separate published Release 1784 gallery remains.
