# Recipient effect sequence validation

The recipient runtime, including the Ward shatter correction, was reviewed at `277000b1b1c3fdcd42698bdd916200412192526a`. The game pins `ashenspire-hd-assets-v30` at `02b6e34db4`. All 12 effect sheets in each released art tier match the reviewed source sheets by SHA-256.

- The [sandbox acceptance](acceptance.recipient-effect-sequences.json) checks Effects On and Effects Off in real combat at 1280×800 and 390×844. All 16 checks passed on the settled source at `38933289ec78057696e9c356512d8c45ab7a6c5c` against `origin/dev` at `7dff4b03a1783054a4ed807f4d45db028b104343`, with normal verified v30 asset loading.
- The focused Node suite passed 74 tests. Fake timers verified exact 10 ms overlap on the same recipient, preserved clip durations, independent recipients, one AoE group, compound base and texture planes, and cancellation. The generated UI configuration check passed.
- Local Core2 browser runs verified real card receipts and target rendering on both viewports. Charm displayed Weak then Vulnerable. The Ward Break card displayed the authored shatter at its peak, with computed host opacity `0.8`. Sweep, Counter gain, Evade gain, Bind, Restrained, animation skip, and missing-art fallback passed. Effects Off still displayed recipient art. Reduced Motion and Reduce Flashes each suppressed it.
- A separate 6-check run confirmed Charm sequencing, Ward Break and Effects Off on both viewports with normal asset resolution from the verified v30 cache.
- The production gallery rendered all 12 frame-2 effects with their exact primary canvas and computed host opacity `0.8`. The refreshed Ward shatter peak preserved its tint and reached full authored canvas alpha before the master opacity.

Reproduce the sandbox comparison and save its report and screenshots with:

```sh
npm run qa:sandbox -- docs/qa/acceptance.recipient-effect-sequences.json --base origin/dev --out scratch/recipient-effect-sequences/sandbox
```

Browser DOM timestamps are sampled at the browser's pace. In one local Charm run the observed overlap was 10.0 ms on desktop and 8.8 ms on phone. The scheduler test checks the exact configuration independently of that sampling.
