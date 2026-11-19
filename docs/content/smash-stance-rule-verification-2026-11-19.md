# Smash stance rule verification — 2026-11-19

Browser acceptance passed on combined GearPass + Smash source `35548faa9f130b8ea0000aa1f129124720304e61`: **32 checks passed, zero failed**, plus **36/36 snapshot, receipt and UI flows**. The eight selected current screenshots and two baseline screenshots are indexed in the [capture record](https://github.com/cehinds/AshenSpire/blob/ffd94d62753574c91b210127c4ef149617162d61/docs/preview/features/smash-stance-rule/capture-record.md).

The comparison used fetched `origin/dev` at `6232329243fbea016f8774bd398f02d3be6f1573`, which already includes GearPass. The checked-in source stamp was **0.7.4.209**, digest `ce10b5d42c`. Both probes asserted that source HEAD stayed unchanged; the tracked QA worktree stayed clean throughout the browser runs.

## Verified behavior

- Fresh Smash Information and actual hand-card help state **Against Defend: 1.5× damage. Against Prepared: 1.25× damage.** The existing quarter-of-Block bonus and half-of-total Poise share remain stated.
- The matrix exercised three rule authorities—shipped, old snapshot and custom shared—against Defend, Prepared and Counter at all four viewports. Production snapshot serialization/restoration retained each authority's own rule block. All 36 real hand help, Information body and Information tag-help surfaces matched that restored block.
- Old snapshots retained shared **1.25×**; custom shared rules retained **3×**, **30% Block** and **40% Poise** in all twelve custom flows. Shipped Defend/Prepared yielded **1.5×/1.25×**. Prepared's ordinary weakness and Smash stages combined once. Counter had exactly one **0.75×** defense stage and no additional Smash defensive multiplier.
- All **484 checked card-image instances** completed, had positive `naturalWidth` and decoded: 88 across the eight selected face/Information captures and 396 across the 36 matrix captures. All eight selected captures were visually reviewed for readable text and loaded art.
- No inspected card or Stamina was spent. There were no page errors, HTTP/network failures or unexpected console errors. The existing `navigator.vibrate` interaction-policy warning is the sole explicit console allowance.

## Fixture and evidence boundaries

The UI fixture explicitly mutes audio through production `shotSettings` → `loadMeta`/`saveMeta`; console-error maximum remains zero. Earlier unmuted source `26dcb410edb2a765781c478d6e9ab86d4f714268` acceptance produced **28 pass / 4 fail** from optional `holdTick.ogg` and `holdCommit.ogg` warm-fetch 404s. Exact baseline `07444b8bbbca94e1e24d068ceb2804b83febd194` requested the same absent URLs. Production audio retained its synth fallback; no generic 404 suppression or audio-runtime change was used. Those original logs and failing screenshots remain preserved in ignored QA scratch.

The separate preintegration source `5e923b101e0494148918b1061bcb920d99d680d8` also passed 32 checks and 36 matrix flows. Its evidence remains preserved as interim provenance; the captures accompanying this report were freshly produced from combined source 35548f.

These are memory-only screenshot fixtures using production combat snapshot serialization/restoration, stance selection, damage receipts, render and Information routes. The probe supplies controlled target stances/Block/Poise and restored rule variants in memory. It does not fabricate DOM, play a paid turn or claim an end-to-end combat victory. Face screenshots show the real unplayed card; rule-help content is additionally verified through its production accessibility/tag-help attributes and the visible Information body.

## Reproduction and raw output

Official command: `npm run qa:sandbox -- docs/qa/acceptance.smash-stance-rule.json --base origin/dev --out scratch/qa/smash-stance-rule/final-35548f`.

The independent ignored sidecars ran `ui-probe-muted.mjs <absolute QA root> <absolute selected output> final` and `receipt-ui-probe-muted.mjs <absolute QA root> <absolute matrix output> final`, using repository `tools/serve.mjs` and `launchBrowser` helpers. Viewports were desktop 1280×800, phone 390×844, wide 1600×900 and tablet 820×1180.

Full reports, screenshots and logs remain ignored under `scratch/qa/smash-stance-rule/{final-35548f,selected-35548f,receipts-35548f}` in the QA checkout. Raw JSON and logs are deliberately excluded from this selected evidence set. Saved-rule review images remain in `receipts-35548f/desktop-old-snapshot-defend.png` and `receipts-35548f/phone-custom-shared-defend.png`.

## Standalone preview status

The parent task's separate actual-file QA passed on [CI preview artifact 14515959316, run 44499406132](https://github.com/cehinds/AshenSpire/actions/runs/44499406132/artifacts/14515959316), built from exact source `35548faa9f130b8ea0000aa1f129124720304e61`. Its embedded build is **0.7.4.210**. Standalone HTML SHA-256: `98c7d470470337543679e4361159d40f7957ec8da514317ff088d453898b414c`.

Desktop1280×800 and phone 390×844 each exercised current rules, old shared 1.25× and custom shared 1.6×/2×: **8/8 visual flows and 8/8 strict network flows passed** with explicit production audio mute. All **16/16 card-image instances** decoded and matched pinned SHA-256 values. Resources and gameplay counters remained unchanged. Page exceptions and request failures were zero; **eight existing navigator.vibrate policy warnings** were recorded, so this is not a literal-zero-console claim.

These artifact checks booted the actual extracted standalone file and supplied in-memory combat-rule variants to its production UI. They do **not** claim that the standalone probe exercised exported production snapshot serialization/restoration: that separate contract is established by the 36-flow source-side matrix above. The ten selected PNGs in this evidence commit are source-browser captures at 35548f/stamp 209, not artifact screenshots relabeled as build 210.

Earlier unmuted 5e standalone network failures remain a limitation. The Pages URL returned 503 and is not claimed to work; the verified CI artifact is the preview fallback. Later test-pin-only commit `fdfe1a77f8` changes test data, with the same runtime/UI as source 35548f; this report records the exact tested source rather than implying a browser rerun on that later commit.

The feature gallery is temporary review evidence under CONTRIBUTING's feature-preview protocol. The parent task owns the README block and its premerge removal, preserving ignored local originals and immutable evidence-commit links. This evidence preparation changes no engine, UI, tests, acceptance criteria, build stamp or generated source.
