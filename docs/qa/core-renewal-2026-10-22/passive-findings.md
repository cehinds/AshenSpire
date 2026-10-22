# Core Renewal final union: strict passive comparison

Baseline: accepted source c36fed3b5, version 0.7.1.1770 / digest 1bf7e51758, pack SHA256 7f0d0805be37a4b04c8438ec2048ed58302b87246b5e515899d1d552fff34f49. Final runtime: 25aed2598167a30cdde0ced7813f5e0737ff95cf, local build 0.7.1.1773 / digest 1c4155a92c, pack SHA256 0e20099f6b8e27f470533cb91423198110b084dc888b9aca95f6ac7943e35001. Final standalone SHA256 900b028d9ee87868815bc1119587dfb6b5b269d08687bbfdb382bf56d4e2b480. These identify frozen local artifacts, not a published build. The later canonical gallery commit changed documentation only.

Six exclusive quiet local runs in B,C,C,B,B,C order; three paired samples per action. Unchanged stalls-pack-passive-harness.mjs, SHA256 97ae2e9cccdf6aa9247ea27a6fec88479c8faaf0371625194cb7b20f08c96f1b. Chromium 375×667, DPR3, CPU4×, after own pack tier/fonts/art/network idle. Each directory contains real copied packs/objects and asset-base ./; pins and 8,169 index references were verified. No CPU/timeline/selector profiler, wrapper/source hooks, forced GC or per-frame geometry/style reads. No competing local build, tests or browser work. All samples retained; no exclusions or reruns. Do not pool this series with earlier experiments or diagnostics.

Fresh shipped defaults, no override. Both sources select Lite through Auto quality on a coarse pointer, and Auto animation pace resolves Fast. This is inferred from production policy, not direct getAnimSpeed instrumentation. The stage-gap default remains 500 ms; the new animation-duration default is 390 ms divided by its 390 ms normalizer, so it adds a factor of 1. The new Mobile fast preset was not selected. Readiness includes scheduling, pacing and main-thread work; CDP script/style/layout/task counters describe work rather than perceived latency. This measures the whole union, not isolated patches.

A native first tap arms the card; 1,300 ms plus 1,500 ms of armed idle precedes confirmation. Readiness spans confirming pointerdown to observed single payment, card removal, unlocked hand and enabled End Turn. Selection latency is outside that span.

| Pair | Defend baseline→final ms | Strike baseline→final ms |
|---|---:|---:|
|1|4141.6→3856.7|4604.4→4604.0|
|2|3688.8→3963.4|4183.4→4045.3|
|3|4278.0→3638.1|4477.8→3917.1|

Paired Defend readiness reductions: 6.9%, -7.4% (slower), 15.0%. Strike: 0.009%, 3.3%, 12.5%; the first 0.4 ms difference is negligible. Medians below are medians of raw times, not medians of paired percentages.

| Median metric | Defend baseline→final | Strike baseline→final |
|---|---:|---:|
|readyMs|4141.6→3856.7 (-6.9%)|4477.8→4045.3 (-9.7%)|
|longTasksMs|2849.0→2531.0 (-11.2%)|3432.0→2875.0 (-16.2%)|
|scriptMs|1804.0→1236.5 (-31.5%)|1839.1→1268.8 (-31.0%)|
|styleMs|922.5→1209.5 (+31.1%)|1342.5→1442.6 (+7.5%)|
|layoutMs|143.2→145.6 (+1.7%)|164.1→159.8 (-2.6%)|
|taskMs|3300.8→3098.7 (-6.1%)|4197.6→3660.9 (-12.8%)|
|maxFrameMs|883.3→983.3 (+11.3%)|750.0→866.6 (+15.5%)|
|layouts|46.0→52.0 (+13.0%)|76.0→80.0 (+5.3%)|
|styles|111.0→128.0 (+15.3%)|186.0→189.0 (+1.6%)|
|fits|3.0→3.0 (-0.0%)|4.0→4.0 (-0.0%)|

All paired work: core.defend

| Pair | Script ms | Style ms | Layout ms | Long tasks ms | Max frame ms | Layout/style counts |
|---|---:|---:|---:|---:|---:|---:|
|1|1804.0→1247.4|922.5→1209.5|143.2→145.6|2849.0→2531.0|1033.2→1050.0|44.0→52.0 / 109.0→128.0|
|2|1516.0→1194.3|842.6→1399.6|122.4→151.3|2356.0→2653.0|849.9→949.9|46.0→54.0 / 111.0→132.0|
|3|1921.7→1236.5|945.8→1032.4|149.9→140.3|2996.0→2280.0|883.3→983.3|48.0→51.0 / 113.0→128.0|

All paired work: core.strike

| Pair | Script ms | Style ms | Layout ms | Long tasks ms | Max frame ms | Layout/style counts |
|---|---:|---:|---:|---:|---:|---:|
|1|1950.6→1680.2|1394.9→1442.6|160.0→184.2|3432.0→3289.0|949.9→1066.6|76.0→69.0 / 186.0→175.0|
|2|1627.7→1224.2|1234.9→1465.0|164.1→141.7|2962.0→2875.0|750.0→866.6|76.0→80.0 / 193.0→189.0|
|3|1839.1→1268.8|1342.5→1342.7|175.6→159.8|3435.0→2610.0|750.0→716.6|73.0→82.0 / 179.0→204.0|

All 12 actions paid and resolved exactly once. Paired card/instance/target/payment records and ordered event types matched: eight Defend events and thirteen Strike events, including attackHit. Each payment was 1 energy, 1 stamina and 0 mana; Strike targeted expected enemy e1. Every hand unlocked, every End Turn enabled, and zero page errors occurred. The harness records event types/payment/target, not full damage amounts or HP deltas; separate packaged native QA owns damage/detail correctness.

All pages loaded light art. Baseline requested 121 distinct own-directory objects, final 123; no escaping routes or pack/object HTTP failures. Every baseline ended with 870 connected elements and every final with 878. This does not attribute the extra eight nodes/two objects or establish a memory leak. Unforced-GC post-action JS heap ranged 40.9–72.7 MB; native/GPU memory is excluded, so memory parity is not established.

The 2× minimum and 4× stretch goals are NOT MET. Median readiness speedups are 1.074× Defend and 1.107× Strike: 6.9% and 9.7% less latency, below the 50%/75% reductions required for 2×/4×. Median main-thread task work falls 6.1%/12.8%, long tasks 11.2%/16.2%, and script work about 31% for both. However, style work rises 31.1%/7.5%, and median maximum frame gaps worsen 11.3%/15.5% to 983/867 ms. Large visible pauses remain. Do not claim stalls are fixed, universally faster frames, statistical significance from n=3, or actual Galaxy A32/iPhone SE/Safari performance. This covers fresh Defend and Strike, not End Turn, Counter, long fights, networking or memory pressure.

Recommendation: treat this as a modest whole-batch latency/processing improvement with an unresolved style/frame-stall regression and unmet goal. Preserve all results and diagnose final-source CPU stacks before selecting another bounded optimization. Browser contexts, browser and server closed; the quiet lease was explicitly released before analysis.

Raw: core-renewal-final-25aed-passive.json. Summary: core-renewal-final-25aed-passive-summary.json. Config/log use the same prefix. Frozen identity: core-renewal-final-25aed-identity.json. Harness: stalls-pack-passive-harness.mjs.
