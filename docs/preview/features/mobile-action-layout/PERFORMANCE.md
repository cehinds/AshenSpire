# Pack-shaped tap/toolbar follow-up: full-action comparison

Baseline: source c6928c98b67e79f9789199047e63db019f1a2d50, version 0.7.1.1764, digest 4b759387dd, HTML SHA256 7779fb33643457dc8df22655ea564030b5d4b62afa501b4d4f3e4220506bbd2f. Frozen directory: pack-1764-accepted/.
Candidate: source b550bf93a153b7f87386a6ecb973e3dfa7de848f, version 0.7.1.1765, digest d64c4b8cf9, HTML SHA256 88850ce0ef2371437d463fec9373bd6cb01dce34bc7a1b9cb26edea734c28d01. Frozen directory: pack-1765-tap-tools/. Root confirmed subsequent PR2242 receipt-only changes do not change this runtime. No PR2241 changes are included.

Each immutable local directory contains its own regular copied pack indexes, objects, cards and asset-base.json; download/ was excluded, no symlinks or canonical root build replacement. HTML is approximately 14.9 MB. Both common and light index hashes match the HTML pins; all 8,169 index entries resolve to own-directory object files with expected sizes. Identity archives are pack-1764-accepted-identity.json and pack-1765-tap-tools-identity.json.

## Protocol and correctness

This is a NEW dataset using pack-shaped delivery. Do not pool with prior 132 MB standalone results or infer a paired packaging speedup. Six exclusive quiet runs in B,C,C,B,B,C order, three matched pairs. Chromium 375×667, DPR3, CPU4× after loaded pack tier/fonts/art/network idle. Default shipped pacing, no overrides. Native first tap arms each card, 1,300 ms plus 1,500 ms armed idle precede one native confirmation; readiness is confirming pointerdown→observed payment/hand removal/unlocked controls. No profiler, source/controller hooks, forced GC, selector tracing or per-frame style/geometry reads. Existing passive rAF/long-task observers and CDP counters remain.

All twelve actions paid/resolved exactly once; paired targets, payments and event sequences matched. Defend has eight event types and Strike thirteen; controls unlocked and no page errors. Every page loaded the light tier and requested 121 distinct own-directory object URLs by pre-action audit; no pack/object HTTP failures or routes escaping its own copied directory through the entire run. All six ended at 870 connected elements. Pre-action JS heap was approximately 47–52 MB and post-two-card heap 44–66 MB with unforced GC; native/GPU buffers are excluded and no leak or memory parity claim follows.

## All paired readiness results

All values milliseconds; pair 2 executed candidate then baseline. No sample was excluded.

| Pair | Defend B | Defend C | Strike B | Strike C |
|---|---:|---:|---:|---:|
|1|5035.3|5022.8|5994.8|5797.7|
|2|6587.1|5618.6|12227|5340.5|
|3|3928.4|5093|5377.9|9249.5|

The baseline pair 2 Strike 12.227s and candidate pair 3 Strike 9.250s are both preserved. These are not explained away as outside contention or excluded as warmup.

| Median metric | Defend B→C | Strike B→C |
|---|---:|---:|
|readyMs|5035.3→5093 (+1.1%)|5994.8→5797.7 (-3.3%)|
|longTasksMs|3658→3857 (+5.4%)|4796→4519 (-5.8%)|
|scriptMs|2284.54→2195.42 (-3.9%)|2648.54→2355.71 (-11.1%)|
|styleMs|1279.88→1386.35 (+8.3%)|1874.02→1803.57 (-3.8%)|
|layoutMs|162.72→190.72 (+17.2%)|206.84→292.69 (+41.5%)|
|taskMs|4330.36→4392.45 (+1.4%)|5630.27→5613.74 (-0.3%)|
|maxFrameMs|1366.7→1433.3 (+4.9%)|1200→1166.7 (-2.8%)|
|fits|3→3 (-0.0%)|4→4 (-0.0%)|
|layouts|50→44 (-12.0%)|77→69 (-10.4%)|
|styles|112→106 (-5.4%)|167→172 (+3.0%)|

### core.defend: all paired work

| Pair | Script ms | Style ms | Long tasks ms | Layout count | Style count | Geometry events |
|---|---:|---:|---:|---:|---:|---:|
|1|2284.54→2195.42|1279.88→1270.23|3658→3800|49→45|110→106|3→3|
|2|3040.74→2552.62|1780.35→1386.35|5288→4337|50→44|112→106|3→3|
|3|1549.92→2057.52|920.93→1495.82|2609→3857|51→44|113→106|3→3|

### core.strike: all paired work

| Pair | Script ms | Style ms | Long tasks ms | Layout count | Style count | Geometry events |
|---|---:|---:|---:|---:|---:|---:|
|1|2648.54→2355.71|1874.02→1803.57|4796→4519|69→70|167→177|3→4|
|2|5475.58→2323.49|4032.46→1513.20|10928→4117|79→69|162→172|5→4|
|3|2500.48→3794.05|1480.45→3142.27|4296→8020|77→68|177→156|4→4|

## Interpretation and limits

Full-action readiness is mixed/near-neutral: Defend median +1.1% slower, Strike -3.3% faster. Defend is nearly tied in pair 1, faster in pair 2 and slower in pair 3; Strike is faster in the first two pairs and substantially slower in pair 3. This small sample does not establish a reliable broad latency improvement. Main-thread work remains substantial and several-second actions persist.

The consistent structural result is fewer Defend layout/style counts: all three layout pairs decrease, median 50→44, while style counts decrease 112→106. Strike layout count median falls 77→69, with two lower pairs and one 69→70 increase; style counts are mixed. Geometry event medians are unchanged. These counters support narrower redundant-work reduction, not a claim that all stalls are solved or that all saved operations caused wall-time changes. A source-reviewed simplification can be retained for its verified bounded work reduction if desired, but this benchmark does not justify advertising a material full-action speed fix. No per-change attribution is possible from the combined candidate.

Physical phones/Safari and memory pressure were not tested. Local pack delivery models shipped directory/asset structure, not actual mobile networking. This scenario covers two fresh actions, not long fights, End Turn or Counter performance. No additional profiling, experiments or source changes were performed. All browser/server processes closed and quiet lease released before analysis.

Raw: stalls-tap-tools-pack-strict.json; summary: stalls-tap-tools-pack-strict-summary.json; config: stalls-tap-tools-pack-strict-config.json; log: stalls-tap-tools-pack-strict.log; exact harness: stalls-pack-passive-harness.mjs.
