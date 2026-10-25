# Art cache relocation — capture record

These are the four original PNGs manually accepted by Root on 2026-10-25 UTC. They show settled asset availability and readability, without native gameplay actions, profiling, scored timings, or a hardware/performance claim.

The captures use the official local light-web artifact from source `7770f5d3dd7bbb8cc20480fe3bf078e7c3e38306`, tree `74e4c084aa229f87dde268eb93d97028e138ad7c`, version **0.7.1.1842**, digest **48703465be**. Its HTML SHA256 is `ccd9938c206c61c84b29e3cd89ad49f6cd6fa638de3533fb0fada32922c2f263`. The post-removal source `353676533c8f1f5f85b0489482d56a29cd596e9b` was independently checked to have identical actual build inputs. These are retained local-artifact captures, not screenshots taken from a later public build or merge head.

## Verified public route and source

[Play the verified Art feature build](https://cehinds.github.io/AshenSpire/branches/fix/ArtCacheRelocation/latest/). The authorized deploy retry [40175699119, attempt 2 / job 121125593271](https://github.com/cehinds/AshenSpire/actions/runs/40175699119/job/121125593271) passed actual HTTP verification for all 30 selected feature targets on **2026-10-25 at 09:03:28 UTC**, including exact Art source `9469093bc1a1c37ca65bee7cc0cc1f392bc6c4b6`. Root independently reviewed the actual logs. This route is mutable; that verification time and source identify this record. These PNGs were not recaptured from that public build, and its later source identity is not substituted for their original source777/build1842 identity.

The original attempt 1 [deploy job 121124741144](https://github.com/cehinds/AshenSpire/actions/runs/40175699119/job/121124741144) remains FAILED: its public root-index check did not find the Art link. Actual feature-HTML staleness was not established by that failure. Root authorized one bounded retry with the same selected source; attempt 2 success does not rewrite the failed attempt. The earlier publisher 40170572017 failure is also retained. No source/version/stamp wake-up or threshold change was used for the retry.

The same successful deployment verified the existing Release **0.7.1.1784** unchanged at 09:01:33 UTC. The root README Release gallery remains byte-identical.

## Current source checks

Source 946 includes the two reviewed authoring-tool fixes: the selected-profile writer no longer shadows its path resolver, and the explicit authoring overlay includes the exact migrated HUD reference path. The two scoped regressions retained original TDZ/HTTP404 failures, then passed actual file/catalog/rig writes with valid 512/256 WebP fixture frames and actual server/HUD-loader behavior. These tool-only fixes required no new screenshots or local game build.

Current 946 CI completed with **12 successes and 4 workflow skips, zero failures**. The fresh [Codex summary](https://github.com/cehinds/AshenSpire/pull/2309#issuecomment-6394070830) assessed that exact head as completed with `has_any_findings:false` and `has_unresolved_findings:false`; the original finding comments remain recorded. The source-review record in [docs/reviews/ArtCacheRelocation-source.md](../../../reviews/ArtCacheRelocation-source.md) names its earlier review baseline and validation scopes.

## Original captures

| Image | Viewport | Touch | DPR | Bytes | SHA256 |
| --- | --- | --- | --- | ---: | --- |
| mobile.png | 390×844 | true | 1 | 398075 | `110521d61ab9f9049f73e3b3ea881580a15eba8d8b349f47febac86d3eb2b0ad` |
| desktop.png | 1200×730 | false | 1 | 1225220 | `e73d3344bc293d1598f5fa9285d60ee9417bf5667ad6fadde87977732848df86` |
| wide.png | 1920×1080 | false | 1 | 2535419 | `867135fedc1336d344f28f91ac42285875b691f1b63592b959db5d51ebe2e329` |
| tablet.png | 820×1180 | true | 1 | 914186 | `59926ebcb6ed2402878df9d8f111f0730dd241212e1b11f52ecdbee1f32bacfe` |

Each view loaded all 15 registered fonts and all 60 visible images, with six visible card-cost bindings and visible controls. Automated checks reported zero page errors and zero failed network requests. Browser gesture-policy messages were retained (10–11 per view); this is not a clean-console claim. Root inspected the original PNGs and accepted their assets/readability. Normal hand overlap and the existing light-rendered low-resolution background were not classified as new defects.

Acceptance record SHA256: `bd1241e1e0ba5d7cc06f357f45b3824194b74a3418ac5f63d27af58c17027965`. Original report SHA256: `089e7447287528507c0be866c47f16c4b422485872b10775580197ba261d6e26`. All original reports and images remain unchanged.

Game verifies pinned runtime Full/Lite bytes and retained embedded HIGH evidence. Actual prototype HIGH/LITE and selected original source-image/recipe integrity passed the separate [AI-Art production source check](https://github.com/cehinds/AI-Art/actions/runs/40171228327) at `f4f71bfc6389d12ceec0ffa48bbbc7750af754b1`: 399 files, 346 decoded images, 21 fixture tests, zero skips. The published v24 tag and release attachments remain unchanged.
