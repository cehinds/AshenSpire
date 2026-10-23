# Isolated hand/tools batching: strict incremental comparison

Baseline: runtime 25aed2598167a30cdde0ced7813f5e0737ff95cf, local build 0.7.1.1773 / 1c4155a92c, frozen pack SHA256 0e20099f6b8e27f470533cb91423198110b084dc888b9aca95f6ac7943e35001. Candidate: 84ede677510dabf1b5dd054de29d4905d92b55d6, local build 0.7.1.1773 / 2a8d63b26f, frozen pack SHA256 b021155224b919acac4ac9cd5a49a10d488942fb0da008a8a5029b4b04e14cec. Candidate is isolated and not integrated/pushed by this worker. These are local artifact identities, not published-build identities.

The candidate changes only hand/tools source and associated tests atop exact 25aed. Source approval and passing behavioral tests do not establish performance. This compares 25aed to 84ede; accepted 1770 is NOT the baseline for this series. Do not pool results or compound its percentages with the earlier 1770→25aed comparison.

Six exclusive quiet runs in B,C,C,B,B,C order, three paired samples per action. Unchanged stalls-pack-passive-harness.mjs SHA256 97ae2e9cccdf6aa9247ea27a6fec88479c8faaf0371625194cb7b20f08c96f1b. Chromium 375×667 DPR3 CPU4× after own pack/fonts/art/network idle. Real copied packs/objects, asset-base ./, all 8,169 references/object bytes/hashes/fonts verified. Fresh shipped defaults, no pacing override; source pacing is identical between this baseline and candidate. Auto quality resolves Lite and Auto animation pace Fast on a coarse pointer by production policy. No CPU/trace/selector profiler, wrapper/source hooks, forced GC or per-frame geometry reads. Root and workers explicitly paused local builds/tests/browsers. All six runs and twelve actions are retained, including the large candidate Strike; no exclusion or rerun.

A native first tap arms the card, followed by 1,300 ms plus 1,500 ms armed idle. Readiness spans confirming pointerdown to observed single payment/card removal/unlocked hand/enabled End Turn. It excludes initial arming latency and includes both intended pacing and main-thread processing.

| Pair | Defend baseline→candidate ms | Strike baseline→candidate ms |
|---|---:|---:|
|1|3331.8→3721.9|4108.7→16858.3|
|2|4457.6→3180.5|4352.8→3413.0|
|3|4166.3→4077.3|5013.9→4289.6|

| Median metric | Defend baseline→candidate | Strike baseline→candidate |
|---|---:|---:|
|readyMs|4166.3→3721.9 (-10.7%)|4352.8→4289.6 (-1.5%)|
|longTasksMs|2952.0→2413.0 (-18.3%)|3257.0→3153.0 (-3.2%)|
|scriptMs|1499.6→1209.5 (-19.3%)|1537.1→1438.0 (-6.4%)|
|styleMs|1238.5→1133.7 (-8.5%)|1451.5→1425.4 (-1.8%)|
|layoutMs|142.2→114.6 (-19.4%)|162.2→145.4 (-10.4%)|
|taskMs|3401.7→2882.2 (-15.3%)|3986.8→3871.4 (-2.9%)|
|maxFrameMs|1050.0→883.3 (-15.9%)|1066.7→916.6 (-14.1%)|
|layouts|52.0→51.0 (-1.9%)|78.0→74.0 (-5.1%)|
|styles|125.0→126.0 (+0.8%)|186.0→190.0 (+2.2%)|
|fits|3.0→3.0 (-0.0%)|4.0→4.0 (-0.0%)|

All paired work: core.defend

| Pair | Script ms | Style ms | Layout ms | Task ms | Long tasks ms | Max frame ms | Layout/style counts |
|---|---:|---:|---:|---:|---:|---:|---:|
|1|1014.7→1209.5|973.8→1133.7|106.6→114.6|2539.6→2882.2|1994.0→2413.0|816.8→883.3|53.0→51.0 / 131.0→126.0|
|2|1644.5→957.0|1315.7→812.2|146.8→93.9|3686.2→2303.3|3173.0→1790.0|1166.6→716.6|51.0→49.0 / 125.0→126.0|
|3|1499.6→1516.2|1238.5→1174.5|142.2→149.3|3401.7→3344.8|2952.0→2823.0|1050.0→1066.7|52.0→51.0 / 124.0→123.0|

All paired work: core.strike

| Pair | Script ms | Style ms | Layout ms | Task ms | Long tasks ms | Max frame ms | Layout/style counts |
|---|---:|---:|---:|---:|---:|---:|---:|
|1|1253.8→3856.3|1451.5→4517.0|162.2→810.3|3715.4→16236.8|2782.0→15335.3|750.0→4733.2|78.0→70.0 / 190.0→164.0|
|2|1537.1→1047.6|1366.2→1065.5|150.1→135.5|3986.8→3037.8|3257.0→2106.0|1066.7→616.7|69.0→74.0 / 176.0→190.0|
|3|1753.9→1438.0|1709.7→1425.4|191.1→145.4|4682.7→3871.4|3837.0→3153.0|1099.9→916.6|79.0→80.0 / 186.0→190.0|

Median readiness is lower by 10.7% Defend and 1.45% Strike; median task work falls 15.3%/2.9%, long tasks 18.3%/3.2%, script 19.3%/6.4%, style 8.5%/1.8%, and maximum frame gap 15.9%/14.1%. These raw-time medians do not represent every pair. Defend first pair worsens 3331.8→3721.9 ms. Strike first pair worsens 4108.7→16858.3 ms; candidate max frame gap 4733.2 ms versus paired baseline 750 ms, with long tasks 15335.3 versus 2782 ms. That severe observation is retained and not dismissed as an outlier or assigned to the candidate without causal evidence. Medians hide its severity.

All twelve actions paid/resolved exactly once. Paired card/instance/target/payment records and ordered event types matched: Defend eight events, Strike thirteen including attackHit. Each payment was 1 energy, 1 stamina, 0 mana; Strike targeted expected e1. All hands unlocked, End Turn enabled, and zero page errors. This harness records event types/payment/target, not full HP deltas or damage amounts. All pages loaded light art, requested 123 distinct own-directory objects, and had no escaping asset routes or pack/object HTTP failures. Every page ended with 878 connected elements. Unforced-GC post-action JS heap ranged 41.0–66.9 MB; native/GPU memory is excluded and no leak/parity claim follows.

Recommendation: do not integrate under the requested gate requiring measured gain without material frame regression. Most medians improve, but this small sample does not demonstrate safe tail behavior and contains a severe candidate frame/action stall. Passing tests and source review do not override the observed result. No causal diagnosis, statistical significance, physical Galaxy A32/iPhone SE/Safari claim, or 2×/4× goal claim is supported. Further decisions belong to root; no rerun or source edit was performed. Browser contexts, browser and server closed, process exited 0, and the quiet lease was explicitly released before analysis.

Raw: core-renewal-25aed-84ede-passive.json. Summary/config/log use the same prefix. Both frozen artifact directories and all samples remain preserved. Candidate identity: core-renewal-final-84ede-identity.json.
