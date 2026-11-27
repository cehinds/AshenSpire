# Review and verification

Baseline review: 2026-11-26. Readability review: 2026-11-27, America/Anchorage.
Scope: planning documents, measurements, images, scripts, and status accuracy.
No sprite fix or full-build acceptance is claimed.

## Planning review

| Contributor | Work |
| --- | --- |
| A: sprite_survey | Inventory/measurements; independent review of visual/runtime evidence and integrated documents. |
| B: sprite_identity | Identity audit, canonical proposals, source candidates, eight reference sheets. |
| C: sprite_verification | Published metadata, tests, production-stage captures, coverage limits. |
| Coordinator | Baseline, integration, source/image checks, plan/status, commits, pushes. |

One P2 finding was accepted: reproduction could label changed inputs as the
fixed baseline. The images were correct; input guards needed strengthening.

| Guard | Verified input |
| --- | --- |
| Visual collector | 23 sources against retained hashes and baseline Git blobs. |
| Reference builder | Baseline/pin identity and 38 image hashes before output. |
| Measurement audit | 330 raster rows against immutable snapshot in 94f46215e72; snapshot never overwritten. |
| Runtime capture | 23 sources, 330 rasters, actual HTTP-loaded bytes against retained evidence. |

Positive reproduction passed. Six manipulated in-memory cases and a temporary
corrupted raster were rejected without changing canonical outputs. Final
independent review found **no outstanding consequential issues**.

## Baseline checks

- Coordinator reran the audit: 184 rows, 117 available selected-family paths,
  330 rasters, no missing files or provided-catalog hash mismatches.
- Reaver's **261 / 345 = 0.756521739** and inverse **1.321839080** were
  independently checked. This is an applied-scale ratio, not anatomical growth.
- Coordinator inspected the primary images, four class sheets, and desktop
  runtime scenes. Starseer's middle runtime panel shows the pointed-hat HURT.
- All 11 focused test files were independently rerun: **68 passed, zero failed**.
- Independent review verified four runtime PNG hashes and 12 matching
  HTTP/cache/retained-baseline receipts.
- [Evidence verifier](verify-evidence.mjs) checks links, source lines, compact
  JSON, 12 image hashes, and 12 image receipts. [Latest result](VALIDATION.json).

These are baseline checks, not completed sprite fixes. Exact commands and
capture conditions: [verification report](verification/VERIFICATION.md).

## Readability cleanup

Apply the owner's global style to touched planning scripts: Allman JS braces,
expanded blocks, one declaration per line, descriptive helpers, named config,
and short necessary comments. Python retains valid Python syntax.

Acceptance for this pass:

- Preserve measurements, task IDs, checkbox states, CLI options, output schemas,
  guards, and baseline/implementation distinctions.
- Keep image and measurement artifacts unchanged. Only the validation result
  may change to reflect current links and check time.
- Compare regenerated artifacts with f72cf9bae19; check syntax, provenance
  guards, and the final diff before committing.

Readability checks completed:

- Overview reduced from 1,314 to 761 words; details remain in linked reports.
- All 72 story/task IDs and 90 checkbox states retained across the six main reports.
- All seven standalone/embedded script syntax checks passed.
- Full audit reproduced the same 184 rows, 117 paths, and 330 rasters; all four
  generated CSV/JSON artifacts match the prior planning commit.
- All 21 retained image/data artifacts are byte-identical. Only VALIDATION.json
  is refreshed for current link counts and check time.
- Six snapshot-guard rejection cases passed.
- Original and reformatted evidence verifiers produced identical results apart
  from check time. Independent review found no behavior changes.
- Independent capture/harness diff review found no changes to profiles, timing,
  frozen-clock ordering, CSS values, receipts, defaults, or cleanup behavior.
- Original/reformatted browser snapshots matched exactly for Reaver and Starseer
  at 1280×800 and 390×844: PNG bytes, computed CSS, and geometry were identical.
  Receipts matched after excluding only the wall-clock presentation.savedAt field.
- Collector and reference builder regenerated identical inputs, manifest, and
  eight PNGs. Capture guards retained positive/negative behavior; a mocked
  published observation produced identical output without refreshing live data.

## Limits

Synthetic stage captures do not establish full combat/HUD, actual damage
integration, reduced motion, complete tier/variant coverage, or interruptions.
The full-game selector timeout remains a capture limitation. Published Git
SHA/art pin parity and canonical AI-Art replacement selection remain open.

All future fix, after-image, preview, and behavior acceptance items stay
unchecked in the [evidence checklist](EVIDENCE-CHECKLIST.md).
