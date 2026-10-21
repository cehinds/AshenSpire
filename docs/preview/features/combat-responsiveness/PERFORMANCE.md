# Combined responsiveness candidate: paired verification

Baseline is current dev `6ede40a71090096690a446d6c1aedf98f7ed36df`, built with the official light single-file bundler. Candidate is `8cd2d6527887a137d1afec9aa73d8f7a8ee8e59b`, including the reviewed hand geometry and native-input fixes on that base.

- Baseline: `/tmp/combat-responsiveness-profile/current-dev-baseline.html`; SHA256 `ac9c74462644d468574679c1458accbe1da60be15455372a700298ee1a507a92`.
- Candidate: `/tmp/combat-responsiveness-build/download/AshenSpire.html`; SHA256 `40d060e38f2de3763dc592ea31d226d2b03518b59d08ff04fbbacd4e83a6b072`.
- Raw run records and the scratch harness remain in the execution workspace; this archive contains the measured summary, not bulk trace JSON.

390×844 touch Chromium, Core seed3 /3 enemies/5 cards, normal pacing, oneTapPlay false. Boot unthrottled, then wait for62 images/0pending/0broken and loaded fonts before applying4×CPU throttle. No concurrent builds/tests/browser work. Two timing pairs in AB then BA order use original gameplay HTML with only input timestamps and a selection mutation observer (no source counters, CPU profiler, or trace). Separate counter pair uses six sparse entry counters, without stack capture. All six page runs had0 uncaught page errors (console warnings/errors were not comprehensively collected) and0card plays; Strike/offensive and Defend/defend stance changes stayed correct.

## Native event timestamp to selected-card mutation

| Action | Pair1 baseline→candidate | Pair2 baseline→candidate |
|---|---:|---:|
| Arm Strike |2186→915ms|1380→1213ms|
| Switch to other Strike |1863→1245ms|1428→1057ms|
| Switch to Defend |1592→860ms|758→725ms|

Candidate was lower in all six paired actions, but the sample is small and second-pair cross stance nearly tied. These are simulated CPU measurements, not a promised phone frame rate or universal percentage gain. Even candidate selection remains hundreds of milliseconds under4×throttle.

## Operation counts per arm / same-stance / cross-stance

| Operation | Baseline | Candidate |
|---|---|---|
| Full battlefield refresh |2 /2 /2|1 /0 /0|
| renderHand calls |3 /3 /1|1 /1 /1|
| Actual hand builds |2 /1 /1|1 /1 /1|
| Orphan card onConfirm |1 /1 /0|0 /0 /0|
| Target HUD geometry |3 /3 /3|3 /1 /2|
| updateTargetHud |7 /6 /4|4 /4 /4|

The baseline cross-stance cardOnConfirm count is zero (missing counter key means zero). A prior progress message mistakenly reported1; this table and raw JSON are authoritative.

Stable subsequent selections meet the0-refit target; first arm still has1 fit. Its exact remaining trigger was not instrumented in this lightweight run, so do not claim it is necessary. Initial/post-arm geometry snapshots were requested from functional QA to distinguish a real first-selection geometry change from another pending event. No additional optimization is justified by this result alone.

`candidate-selected-mobile.png` was captured and visually inspected after the counter sequence: fan/hit area composition and Defend stance remain present. Functional resize/text/zoom/upcast/reorder/draw/confirm and four-viewport screenshot QA is separately assigned to the input worker.

Both browser and server closed normally; exit0. Browser slot released before functional QA.

## Follow-up geometry observation

A separate fresh mobile functional run observed hand top514px before selection, while the last published geometry event still held518.2064px. First selection published514px with the same width, height and local geometry key. This is consistent with the first fit reconciling a previously unpublished settled position; it does not establish the cause of that initial movement. Later stable selections emitted no redundant full fits in the counter run.
