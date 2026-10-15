# Accepted-stance preview and trusted-pointer follow-up

This follow-up is tracked in [PR 2017](https://github.com/cehinds/AshenSpire/pull/2017). The live pull request and subsequent Dev/Test runs are authoritative for merge and promotion state.

## Confirmed preview defect

With configured new-run defaults, Rogue Piercing Flurry used Attack Rating 2 in its preview before an accepted play entered Attack with Rating 3. Against the regression fixture's 36 HP, 8 Block and 10 Poise, the old preview showed hits `[1,0]`, while accepted play removed `[1,1]` HP. The reviewed fix projects the accepted stance on detached preview state. Live resources, RNG, protection and stance remain unchanged by preview; costs retain their pre-stance evaluation.

The five-line engine change and eight native/production-loader regressions are preserved in [8aaab5859](https://github.com/cehinds/AshenSpire/commit/8aaab585923a49dac618e28b5ac7c2758af9cd31). The initial stance candidate's affected 24-file test selection passed 328 tests; the explicit audit-configuration adapter passed four tests. The before-fix canonical regression failed under both loaders. The fix changes preview parity with existing execution, rather than combat balance.

## First configured card matrices — accepted-stance candidate

Loader and configuration are separate fields. The original 3,784-intent matrices used raw authored registries with combat ratings disabled, including the run through the real compiler/loader. Their original source, counts and hashes remain historical. They did not establish configured new-run behavior.

Fresh reports use the reviewed engine above and [audit tools c35ebaca9](https://github.com/cehinds/AshenSpire/commit/c35ebaca9ac23387a6c8c4303f4d501a09b15629), integrated at `30310f07452a6b5dd9b7bca3f18280766427a38a`. Both loaders use the complete snapshot:

```json
{"breakMeterVersion":2,"classMasteryVersion":1,"overrides":{},"ratingsVersion":1,"schemaVersion":1,"xpCurveVersion":1}
```

The v2 new-run override is explicitly `breakMeterVersion:2`; user overrides are empty. Snapshot SHA-256: `9680ab2559d49102c024bf6fd8fdf8ff4889bf9a39c83c84bf7e06a048c29270`. Resolved-content SHA-256: `14d07c03473e5bf38b4085bb1a771bb19da8dcdae05038fb39f4bde46e2cddc2`.

Each loader passed 1,892 candidates against two enemy fixtures: **3,784 intents, 3,760 paid/resolved plays with separate resource ledgers, end/next turn and a subsequent play, plus 24 named authored-unplayable refusals**. Each separate refusal matrix passed **1,013 atomic named refusals and 33 zero-net-price acceptances**. All four reports contain zero unexpected failures and zero fixture gaps; native and bundled payloads agree after removing loader labels.

| Report | SHA-256 |
| --- | --- |
| native variants | `666402b9bbb573cc60d1c37688ed666fe5342e5eb2b82033c66abd36322c4d6f` |
| native refusals | `f76b2ad9edb5ed10e7098e12a0abb2eecb1629e438928f17cefdb67ba6bd6460` |
| bundled variants | `5869d97ae096962446de2df32f085c0aa48eeb52d7f6ae40f77f7de0f2a42a07` |
| bundled refusals | `7b1ecfe2c5e9bb9816504be8ee9d5cc756f4670d1b0c63a0cf8a9fe0547fe8d5` |

The reports record exact tested product source (796 files, SHA-256 `41611221b35af8948bc8223e6b4a24138ad36b5fccd0f01fb50e6d524fea7162`), audit-tool and compiler-helper hashes. This source identity precedes the PR 2017 derived changelog receipt; at b3498d02 the derived receipt leaves the tested combat and audit modules unchanged; the later Counterstrike product change has a separate final validation phase below. Full settings/source metadata, commands and uncovered operation counts are in [proof-index.json](../../../tools/combat-audit/proof-index.json). Raw reports are local, untracked files at `/workspace/scratch/rogue-projection/configured-matrix/`, with `summary.jsonl`; they are not claimed uploaded.

Reproduce from the reviewed tools and product candidate:

```sh
node tools/combat-audit/cards.mjs --all-variants --configured-defaults
node tools/combat-audit/cards.mjs --all-variants --configured-defaults --bundled
node tools/combat-audit/cards.mjs --refusals --configured-defaults
node tools/combat-audit/cards.mjs --refusals --configured-defaults --bundled
```

These results cover the variant/payment/refusal contracts. They do not replace the historical conditional/effect matrices, close the 106 individual conditional-index gaps, or establish every effect amount, RNG state, user settings override or browser input.

## Shared Counter support preparation

Exact-head CI exposed another real preview omission: default v2 spell Counterstrike preparation increases protection's authored base from 5 to 7 before the prospective stance rating is applied. A Frost Counter fixture with DR3/PR0 therefore previews and grants 7 Block plus 4 Ward, total 11; the stance-only candidate previewed 6 plus 3, total 9.

The independently reviewed [Counterstrike fix 2eae12d](https://github.com/cehinds/AshenSpire/commit/2eae12d09b8c265b3d11531d5f05b1a0acb88ec0) shares accepted-card preparation with preview on detached state using `arm:false`, retaining effect-index token bindings and the same deferred-effect classification. Accepted execution and pricing are unchanged. Tests keep direct-opcode DR/PR expectations separate from accepted-card support effects and from stance-entry grants. The 26-file affected selection passes **343/343**; a separate comparison of 24 paid defense fixtures confirms unchanged execution against the pre-fix baseline.

The [original exact-head failure](https://github.com/cehinds/AshenSpire/actions/runs/38717606618/job/116364137277) is preserved. It is not waived by changing 8 to 9: default v2 accepted Counterstrike behavior requires the shared preparation rule. Final configured native and production-loader matrices have now passed for this separate Counter candidate. Each loader again covers **1,892 candidates × two enemies = 3,784 intents**, with **3,760 paid/resolved resource ledgers, turn recovery and follow-up plays; 24 named authored-unplayable refusals; zero failures or fixture gaps**. Each separate refusal report contains **1,013 atomic refusals and 33 valid zero-net-price acceptances**, with zero failures. Native/bundled report payloads agree after removing the loader label.

| Final Counter report | SHA-256 |
| --- | --- |
| native-variants | `01f7858ac40b75f691a470feb62c95b670069d94190a905f06e135d139558718` |
| bundled-variants | `64acd72172f5cce02c7dcc90b596402044b6e4704c7b8825d2e530cdf8bdb54f` |
| native-refusals | `2065032078fa3977926632ded25d98857b84b8821edd3809db464ac19cf96bcb` |
| bundled-refusals | `3990a78009adb17c2528174fc7e0c613af73174430706de1a8e7a8be557edcc6` |

These reports belong to exact candidate `2eae12d09b8c265b3d11531d5f05b1a0acb88ec0`: 796 source files, SHA-256 `27582189c839138455d1d14fdf00066ed16769da06b89a68eeadc8da1e09ec2c`, including b349's generated receipt blob `722e3bd015b55f23230922ef5947ea91128efed1`. The complete snapshot/hash and resolved-content hash equal the first configured phase above; audit-tool/compiler-helper hashes are unchanged. The final integration `5be5ec5e219ea10bb99acd08d1c5bbb1c930f4e1` changes derived receipt text to official blob `c09ed1a5a1e17452f15db7a3a668ccad1e805b03`, while retaining this candidate's exact tested combat and audit modules. The matrix is not relabeled as executed at 5be.

Raw final reports remain local and untracked at `/workspace/scratch/rogue-projection/configured-counter-final/`; the four reproduction commands above apply. The independently reviewed summary preserves both configured phases. The final candidate also passed **480/480** tests across all 35 files calling `previewCard` or `previewCoopCard`; this overlaps the 343-test affected selection and is not added to it. Log SHA-256 values: affected selection `3d069cc51f5b74eb344944fb20568ab2972704c6083489af2a72f23e77adc7b6`; all preview callers `f979f53529a33de7572e3b95f472082fd0ecc276a4fb54ca7df8a519d88e99dd`.

These are the same bounded card/payment/refusal contracts, separately executed after the Counter change. They do not prove every effect amount or close the historical conditional gaps. The first configured reports and earlier b349 Rogue browser proof keep their original source identities.

## Configured audit command boundary

Configured defaults are supported only for the full variant matrix against the default Wandering Soldier/Gilded Knight pair, or the refusal matrix. Configured base-only, all-enemy, conditional, Counter-lifecycle and deferred-condition combinations are rejected before loader/execution, with no silent raw fallback. Historical raw semantic audits retain their original assertions and scope.

The independently reviewed [scope guard a11a093](https://github.com/cehinds/AshenSpire/commit/a11a093a94cee2029512d0715c24e07dee544b01) changes input validation/help only; the validated variant/refusal execution loops and all gameplay are unchanged. **19/19** focused native/bundled boundary, runtime and existing raw-oracle checks pass. The earlier matrix reports keep their actual executed audit-tool hashes, and the compiled proof remains bound to the unchanged 5be game/receipt bytes. This guard does not establish configured semantic coverage for the rejected modes.

## Trusted-pointer hardening

Test merge `21b2484b9610b8cdca3d3dd5dbc0c0860d13d324` had one actual failed gate: [full-run job 116346385499](https://github.com/cehinds/AshenSpire/actions/runs/38712270350/job/116346385499) timed out at the new-slot decision door with zero console errors. Its boundary job propagated that failure; all other Test gates passed. Promotion was not considered complete.

The isolated [original observational trace](https://github.com/cehinds/AshenSpire/actions/runs/38713559047) showed the same modal button move about 36.7 px horizontally and 22.5 px vertically after its coordinates were sampled. That traced click succeeded, so it establishes a stale-coordinate hazard rather than directly reproducing the prior miss. Original trace artifact 11962086000 SHA-256: `1c7d536ab1a89e990ad229a4fdd000e9bec645929ab9bc6d06896059dc198a79`.

The one-line [repair ebc49a7](https://github.com/cehinds/AshenSpire/commit/ebc49a7f5985f4e1568c8391ac35a83498df93c4) scrolls only as needed with nearest alignment and instant behavior before sampling. The actual CDP mouse input, hold sequence, assertions and time bounds are preserved. [Validation 38715174421](https://github.com/cehinds/AshenSpire/actions/runs/38715174421), pinned to that repair, passed the observed whole journey **7/7** (266.3 s), then the uninstrumented trusted verdict/full-run gate **7/7** (259.6 s), both with zero console errors. The first modal button moved at most 0.133 px horizontally and 0.681 px vertically; mouse down, up and click hit the same button. Its second title entry was stable too.

Repaired trace artifact 11962693280 SHA-256: `5c89bd042aed8dbe8dd0ad6b04de05244981abf9b96087940f8cda4079150e95`. The observational workflow/helper stay on `worker/FullCombatAudit/title-pointer-trace` at `6b5293d0ee1d80b41632d23a04df094d508bd932`; they are not part of the delivered fix. This proof is pinned to the pointer-only repair and does not claim to validate the subsequent combat-preview change. [Final three-case compiled proof](final-compiled-parity/README.md) separately verifies the frozen product/receipt source `5be5ec5e219ea10bb99acd08d1c5bbb1c930f4e1`, build `0.7.1.1538` / digest `5bec9d014c`. Existing feature [artifact 11964178167](https://github.com/cehinds/AshenSpire/actions/runs/38720084161/artifacts/11964178167) was reused without rebuilding. The extracted and all three actual loaded HTML bodies match SHA-256 `c42a61470fb7ecd292d36deb6756135e6c06b5d181916aeb5204d22997333dfc`.

[Capture run 38720640518](https://github.com/cehinds/AshenSpire/actions/runs/38720640518), [artifact 11964822196](https://github.com/cehinds/AshenSpire/actions/runs/38720640518/artifacts/11964822196), passes all three cases. Two Rogue rows show the offensive face `6×2` and real guarded `1+1` HP loss, with stamina payment. The canonical Starseer Frost Counter row projects **6 Block +8 Ward**; authored support grants those values, with full Ward converting its 8 into Barrier. Separate stance-entry effects grant **2 Block +1 Barrier** and raise Ward capacity. The final pools are Block 8, Barrier 9, Ward 6/6; these totals are not substituted for the card's authored support. This checks preparation, rather than retaliation.

The record preserves all six selected/paid screenshots, exact fixture/provenance/limits and diagnostics: zero runtime page exceptions, **18 optional audio HTTP 404s and 89 console messages**. Audio playback and zero-console/network behavior are not established. The raw manifest remains in the artifact; the curated summary is committed beside the images.

The earlier [b349 Rogue proof](https://github.com/cehinds/AshenSpire/actions/runs/38718639047), [artifact 11963817042](https://github.com/cehinds/AshenSpire/actions/runs/38718639047/artifacts/11963817042), remains separately scoped to source `1548b38085`, HTML SHA-256 `3bcccb7c245a2ab3ecccea59a4005bdb1eab0a019ca5f969468a83fe38cfb50a`. Its [transport-cache failure](https://github.com/cehinds/AshenSpire/actions/runs/38718102967), [artifact 11963995879](https://github.com/cehinds/AshenSpire/actions/runs/38718102967/artifacts/11963995879), and [incorrect mitigated-face helper expectation](https://github.com/cehinds/AshenSpire/actions/runs/38718260499), [artifact 11964470614](https://github.com/cehinds/AshenSpire/actions/runs/38718260499/artifacts/11964470614), are preserved. The latter stopped before payment; correcting the helper to the intended offensive face did not change product code. No b349 result is relabeled as Counter-fixed evidence.

## Temporary preview cleanup verification

At exact source 5be, the root README retains blob `b5407c4a03ac1e07889ad663156e101e9dadf084` (5,960 bytes). The unchanged official helper blob `61242bc9d758d6437b59b8753236d76196da8d66` reports no temporary block to remove, and removal preserves the exact README bytes. Its exported absence/idempotence checks pass. The CLI `--check` requires a present temporary block and reports it missing in this already-cleaned state. The temporary `docs/preview/features/full-combat-audit/` folder is absent. Permanent evidence, Release 1517 gallery, channel README markers and AI disclosure remain. No build or README mutation was needed.
