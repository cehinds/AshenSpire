# Final narrow union: pack-shaped full-action comparison

Baseline: source c6928c98b67e79f9789199047e63db019f1a2d50, version 0.7.1.1764, digest 4b759387dd, pack HTML SHA256 7779fb33643457dc8df22655ea564030b5d4b62afa501b4d4f3e4220506bbd2f. Frozen directory: pack-1764-accepted/.
Candidate: PRIVATE union f52ae5a63f694dd47fbe5efe0cd70c3f78a65bca, version 0.7.1.1765, digest cd9938a7ec, pack HTML SHA256 e980b12b70e8801ffceac266993cf56b820591174753d37d74536b80d5d8e548. Frozen directory: pack-1765-combined-odds-probe/. It combines PR2242 tap/toolbar changes and reviewed PR2241 narrowed head 45517c80e02d4007228ef82305f28f0199ce788c. Aura renderer and aura tests match accepted c692; earlier rejected aura cache or filter work is not included. This is candidate evidence, not a published-build identity.

## Protocol

Six exclusive quiet local runs in B,C,C,B,B,C order, three paired samples per action. Same unchanged stalls-pack-passive-harness.mjs: Chromium 375×667, DPR3, CPU4× after pack tier/fonts/art/network idle. Each regular copied directory has its own packs and objects, asset-base ./; no symlinks to other build assets. All pack pins and 8,169 index references verified. No CPU/timeline/selector profiler, forced GC, source/controller hooks, or per-frame style/geometry reads. No source/build changes during measurement. Passive rAF/long-task observers and CDP counters retained.

Pacing: fresh shipped defaults, no override. Source defaults are Auto performance and Auto animation pace; coarse-pointer Auto selects Lite, and Auto under Lite resolves Fast. This is not an explicitly forced Normal, Slow or Instant test. Effective pace is inferred from unchanged production policy, not a directly persisted getAnimSpeed read; the harness does not modify or expose that internal function. Configuration archives this distinction. Boot art tier light is directly observed on every page.

Native first tap arms each card; 1,300 ms plus 1,500 ms armed idle precede one native confirmation. Readiness spans confirming pointerdown→observed exact payment/card removal/unlocked controls. First selection is outside that span. This is a NEW comparison period; do not pool with previous standalone, tap/tools-only, or aura-including union measurements. No sample was excluded.

## All readiness pairs

| Pair | Defend baseline ms | Defend candidate ms | Strike baseline ms | Strike candidate ms |
|---|---:|---:|---:|---:|
|1|6643.4|5884.9|6004.4|5489.3|
|2|5032.4|4478|6073.7|5435.8|
|3|5460.2|5283.7|6578.8|6110.9|

Candidate readiness is lower in all six pairs. Paired Defend reductions: 11.4%, 11.0%, 3.2%; paired Strike reductions: 8.6%, 10.5%, 7.1%. Medians below are medians of raw times, not the median of paired percentages.

| Median metric | Defend B→C | Strike B→C |
|---|---:|---:|
|readyMs|5460.2→5283.7 (-3.2%)|6073.7→5489.3 (-9.6%)|
|longTasksMs|4105→3918 (-4.6%)|4938→4385 (-11.2%)|
|scriptMs|2555.78→2430.22 (-4.9%)|2842.49→2769.6 (-2.6%)|
|styleMs|1374.48→1291.6 (-6.0%)|1740.93→1511.17 (-13.2%)|
|layoutMs|188.14→176.88 (-6.0%)|227.75→195.05 (-14.4%)|
|taskMs|4775.29→4554.36 (-4.6%)|5768.79→5217.81 (-9.6%)|
|maxFrameMs|1566.6→1516.6 (-3.2%)|1099.9→983.3 (-10.6%)|
|fits|3→3 (-0.0%)|4→4 (-0.0%)|
|layouts|50→46 (-8.0%)|76→69 (-9.2%)|
|styles|110→108 (-1.8%)|166→167 (+0.6%)|

### core.defend: all paired work

| Pair | Script ms | Style ms | Long tasks ms | Layout count | Style count | Geometry events |
|---|---:|---:|---:|---:|---:|---:|
|1|2966.49→2761.55|1643.95→1503.98|5347→4549|51→46|116→108|3→3|
|2|1957.02→1873.13|1374.48→1223.19|3785→3342|50→45|110→108|3→3|
|3|2555.78→2430.22|1285.21→1291.60|4105→3918|49→46|110→108|3→3|

### core.strike: all paired work

| Pair | Script ms | Style ms | Long tasks ms | Layout count | Style count | Geometry events |
|---|---:|---:|---:|---:|---:|---:|
|1|2550.10→2769.60|1871.58→1381.81|4759→4385|70→64|171→160|3→3|
|2|2842.49→2536.63|1511.90→1511.17|4938→4297|77→71|166→167|4→4|
|3|3226.28→2843.46|1740.93→1819.48|5523→5009|76→69|165→169|4→4|

## Correctness and interpretation

All twelve actions paid and resolved exactly once; paired targets, energy/mana/stamina payments and ordered event types matched. Defend has eight event types and Strike thirteen. Hand non-inert and End Turn enabled after every action; zero page errors. All pages loaded light art with 121 distinct own-directory object URLs requested by pre-action audit; zero escaping asset routes or pack/object HTTP failures through completion. All six ended at 870 connected elements. Post-action JS heap approximately 50–67 MB under unforced GC; this excludes native/GPU memory and does not establish leak absence or memory parity.

Recommendation: retain the narrow union as a bounded, measured reduction in UI work. Readiness and long-task totals improve in every matched pair; layout counts also fall in every pair. Median Defend readiness improves 3.2% and Strike 9.6%, while main-thread task medians improve 4.6% and 9.6%. Script/style/max-frame metrics are not uniformly better in every pair, so do not claim universal improvement or statistical significance from n=3. Changes are measured together; do not assign the total gain to either individual PR.

The larger mobile-performance goal remains unresolved: candidate readiness still ranges 4.478–6.111 seconds, with Defend frame gaps of 1.217–1.600 seconds and substantial long tasks. This is not a claim that combat stalls are fixed, a physical-device/Safari test, or a mobile networking/memory-pressure simulation. It covers two fresh native actions, not long fights, End Turn or Counter performance. Browser/server processes closed and quiet lease explicitly released before analysis; no further profiling or experiments started.

Raw: stalls-combined-odds-pack-strict.json; summary: stalls-combined-odds-pack-strict-summary.json; config: stalls-combined-odds-pack-strict-config.json; log: stalls-combined-odds-pack-strict.log; harness: stalls-pack-passive-harness.mjs.
