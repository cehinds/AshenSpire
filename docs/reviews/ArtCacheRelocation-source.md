# Art cache relocation — source review record

Review baseline: [`313ed4d2968ec3e516fc834c831dfa848f34e28f`](https://github.com/cehinds/AshenSpire/commit/313ed4d2968ec3e516fc834c831dfa848f34e28f), tree `87884130eb89da5e1852503bda14d5917c8cc6ea`, for [PR #2309](https://github.com/cehinds/AshenSpire/pull/2309). That normal merge has parents `0ea49b674ca5970026ef486289aeb7486412779f` and latest stamped Dev `20f222170a08042f47deaae20d66efa1a18712b5`. This record adds review evidence; it does not change runtime code, art bytes, the release pin, or the authored build ordinal.

## Ownership and immutable runtime inputs

Game retains runtime IDs, eight display catalogs/Markdown indexes, game code and retained evidence. Runtime readers use `artPath(rel,{root,env})` and verified release packs; default/auto mode does not fall back to loose mutable light/display images. Explicit `ASHEN_ART_SOURCE=trees` remains for authored test fixtures. Editors/exporters use a separate explicit `ASHEN_ART_CHECKOUT` or asset root for the AI-Art `ashenspire` authoring tree; runtime does not silently use that checkout.

The published pin is `ashenspire-hd-assets-v24`, targeting AI-Art [`59663d814b62ab96cb5309b4e0720cd871782ee1`](https://github.com/cehinds/AI-Art/commit/59663d814b62ab96cb5309b4e0720cd871782ee1), release [423150902](https://github.com/cehinds/AI-Art/releases/tag/ashenspire-hd-assets-v24). Schema 2 has 8,169 IDs: 7,348 unchanged high/light records and 821 common records, including the 675 display images. Common records remain `{common:{path,bytes,sha256}}`; dimensions are independently checked metadata. The 512 existing display-library groups retain their prior ID sets; supplementary layer/cutout components do not become new library groups.

The raw release manifest SHA256 is `3e1b8790f920a30e35a81e05f8aa718b3aa635d824c8820e9d19b346e0bd84e8`. Game's official `withHeader`/`serialize` representation has SHA256 `a72ddb533c5234698a5111e1bd44455e5532bbbba63c505963de09356026a122`. Their headers/serialization differ intentionally; all 8,169 tier records, schema, pin and all three cache-marker meanings remain exact. No release attachment was rewritten. The supported CREDITS attribution row preserves original source/rights notices and unresolved gaps; it grants or infers no new licence.

## Copied-data removal and protected originals

The public post-removal commit is [`c94fd3ff8f0edf85ae6949feab56c518ab6dc8b3`](https://github.com/cehinds/AshenSpire/commit/c94fd3ff8f0edf85ae6949feab56c518ab6dc8b3). Retained local commit `353676533c8f1f5f85b0489482d56a29cd596e9b` has the exact same tree. Exactly 12,884 `copy`/`alias-existing` rows with `retainGameCodeOrEvidence:false` were removed, representing 3,045,005,782 bytes. Every candidate's source mode/Git object ID at source777 and published AI-Art596 destination mode/object ID matched the immutable transfer manifest before removal.

All 2,762 retained rows, eight display metadata files and 29 active code/catalog hashes were preserved. Actual build-input and identity-input intersections with removals were empty: all 1,072 build inputs and 1,090 identity inputs remained exact, with source digest `48703465be`. Active geometry code such as `layer-math.js` stays in Game. The sparse worker had zero physical candidate files, so applying the removal changed its index only; protected original files and earlier artifacts/evidence were not physically deleted.

Retained deletion-report SHA256: `a5d305a62347d7780e05d0304e0b9cc96d93364564b542b2c157c16119571ec3`. Immutable transfer-manifest SHA256: `2abb637654732cbde2ac35f27870e89212ad23f77d60b72a6e8a3e28a3f23670`.

## Validation scopes and source integrity

Official local LIGHT web and portable builds used source `7770f5d3dd7bbb8cc20480fe3bf078e7c3e38306`, version **0.7.1.1842**, digest **48703465be**. Follow-up read-only verification checked full light/common indexes and every one of the 675 inline display payloads for exact bytes, MIME, size and SHA256. The common index digest is `ed667bd375bba917f8f6581d7bbd094e9d4af216b1bb94d4be4913258c34fbb3`. These artifacts remain labelled pre-removal source777; the exact source777→353 input-equivalence proof does not relabel them as a later integration-head build.

Earlier audit/build wrapper failures remain failed and retained. Separate follow-up data checks and Root's explicit data acceptance supplied the bounded artifact/protected-source proofs without rebuilding or rescoring those failures. No local full-HD build is claimed. Published v24's actual [production release CI](https://github.com/cehinds/AI-Art/actions/runs/40162706126) passed 40 tests and verified all three real packs.

Actual loose-source integrity moved with the authoring images. The verification-only AI-Art commit [`f4f71bfc6389d12ceec0ffa48bbbc7750af754b1`](https://github.com/cehinds/AI-Art/commit/f4f71bfc6389d12ceec0ffa48bbbc7750af754b1) passed [production source CI 40171228327](https://github.com/cehinds/AI-Art/actions/runs/40171228327): 399 frozen source files / 55,892,481 bytes verified, 346 images fully decoded (321 WebP, 25 PNG), 21 fixture tests, zero skips. Coverage includes 41 actor HIGH/LITE families, four base-action families / 48 frames, 12 selected board choices, 24 weapon-source records, 15 preview inputs and the AT3 original-sheet recipe. Its [checker](https://github.com/cehinds/AI-Art/blob/f4f71bfc6389d12ceec0ffa48bbbc7750af754b1/checks/ashenspire-source-contract.mjs) and [read-only workflow](https://github.com/cehinds/AI-Art/actions/workflows/ashenspire-source-contract.yml) preserve the published v24 tag and eight attachments.

Game tests retain actual runtime Full/Lite byte checks, actual embedded portable HIGH hashes/dimensions, full project/binding checks, anchors and geometry/sequence contracts. Embedded HIGH evidence is not presented as LITE source-byte validation.

At corrective source `0ea49b674ca5970026ef486289aeb7486412779f`, Game had 15 successful checks and four workflow skips, including core, all discovery shards, previews, quick-start, Workbench export/platform tests, receipts, offline and intake. At the newer review baseline313, [tests 40172548970](https://github.com/cehinds/AshenSpire/actions/runs/40172548970), [receipts 40172550352](https://github.com/cehinds/AshenSpire/actions/runs/40172550352) and [quick-start 40172551911](https://github.com/cehinds/AshenSpire/actions/runs/40172551911) supply eight successful direct checks. This is not a claim of the earlier complete suite at313: duplicate pull-request runs were action-required, and current full push gates remain to be earned.

The official generators independently reproduce313's changelog projection. All 1,128 incoming Dev entries are unchanged; only PR2309 is added at **0.7.1.1846**. The incoming Dev box **1846 / cdd7b4a056** and Console code/tests remain exact. No box delta was authored.

## Four-view retained capture scope

Root manually inspected and accepted the four original settled light-web PNGs captured on 2026-10-25 UTC from source777 / **0.7.1.1842 / 48703465be**:

| View | Viewport | Touch | DPR |
| --- | --- | --- | --- |
| Phone | 390 × 844 | yes | 1 |
| Desktop | 1200 × 730 | no | 1 |
| Wide | 1920 × 1080 | no | 1 |
| Tablet | 820 × 1180 | yes | 1 |

Every view loaded all 15 fonts and 60 visible images, with six visible cost bindings and visible controls. Automated checks recorded zero page errors and zero failed network requests; 10–11 browser gesture-policy messages per view remain recorded, so no clean-console claim is made. The captures establish settled asset availability/readability, not native gameplay execution, latest-head screenshot identity or performance. Acceptance-record SHA256: `bd1241e1e0ba5d7cc06f357f45b3824194b74a3418ac5f63d27af58c17027965`. All original PNGs/reports remain unchanged.

## Unresolved publication verification

Publisher [40170572017](https://github.com/cehinds/AshenSpire/actions/runs/40170572017) assembled the expected Art0ea49 source/manifest, but its actual deployed **public root-index link** check observed older406f and failed. That proves a stale root-index commit link; it does not establish stale actual feature HTML. There is no earned working-feature-HTTP claim here. Temporary README screenshot evidence remains unpublished until actual working feature HTTP is verified, and the required feature block/folder cleanup remains mandatory before Dev merge.

A prospective publication follow-up can compare the assembly-local index link, selected source and feature manifest before deployment, while treating deployed root-index and actual feature-HTML checks separately. No publication-code change, cache-flush commit, new build/browser capture or performance claim is included in this record. Root owns final Dev merge and Test promotion after actual gates.
