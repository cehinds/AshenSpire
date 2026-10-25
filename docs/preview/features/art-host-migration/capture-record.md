# Art host migration capture record

Captured 2026-10-25 UTC with Chromium in fresh isolated contexts. Root individually inspected and accepted these four original PNGs. These are individual visual/asset/behavior scopes, **not an overall four-context QA PASS** or a performance/hardware result.

## Source and build identity

- Local official LIGHT pack source: `be501d0d2914d64e0a4497340cece40dc823dcf8`; whole Git tree `4a646e4fac21219e49ed93ee20bc85d483742211`.
- Version `0.7.1.1840`, runtime digest `d4414521b9`; local pack HTML SHA-256 `6719fe874c576baacaf33765e843bc72b8224370b81723ee6af44da44ad56c43`.
- Official `bundle --light` used existing v23 bytes reverified against the mirrored pin, without changing the original cache. External verification passed 314 checks over 7,950 objects. No CSS, game, RNG, functions, art or pacing overrides.
- Local pack uses external objects; the successful public CI artifact is standalone LIGHT HTML. They share source/version/runtime identity; their HTML shapes/hashes are different. These images are from the official **local pack**, not a downloaded CI artifact or the public site.
- Stable public Review source `5803d61b97d8cf1250833433ca5d95705bbbeb12` has the exact whole tree above, as independently verified by Root. Review URL: https://cehinds.github.io/AshenSpire/branches/fix/ArtHostMigrationReview/latest/ . Actual public HTTP verification succeeded in publication run `40161324931`, deploy job `121077091595`, independently reported by Root; this exact Review target is the source-equivalent `5803d61b97d8cf1250833433ca5d95705bbbeb12`.
- Worker integration `61329a233ad75131b9f0fcd5aaf1543cf1177ee9` includes Dev `2a2c19c67c2505972a46e348e4a1e76cf6cccac1` (build1841) and separately reviewed #2304 UI changes. It is not claimed whole-tree identical to the capture source. The migration pin, consumers and art manifest are unchanged from be501.

## Publication and existing gallery

Root verified actual published Test source `d564` / build1841 and Release build1784 / digest `c509` in the same publication. Release1784 remains unchanged, so the existing Release gallery is retained byte-for-byte. The feature block does not alter primary badge/play/download routes, readme-sync content or AI disclosures; their current publication verification is coordinated by Root. No claim is made that these local captures are screenshots from public HTTP.

## Captures and exact scope

All use native `?shot=combat&shotSeed=SHOWCASE&shotClass=reaver`, default two-enemy Core fixture. Original bytes are copied unchanged.

| File | Viewport / input | Accepted scope and retained run outcome |
| --- | --- | --- |
| mobile.png | 390×844, isMobile+hasTouch, actual touchscreen taps | Native pinned gp6 Defend selected and confirmed. SP3→2 (energy alias2), Block0→14, HP71/MP1 and enemies unchanged; exactly one cardPlayed and cardResolved, balanced timeline1/1, watchdog0. Original run remains FAIL on an aggregate function-identity assertion; native dispatch can rebind emit, but aggregate false does not prove only emit changed. |
| desktop.png | 1200×730, mouse context, no gameplay | Settled initial fixture;15 registered fonts explicitly loaded, zero visible broken images/page exceptions, six nonempty fitted cost bindings and controls in viewport. Original run remains FAIL: profile accounting followed normal SingletonCookie symlink and raised ENOENT. |
| wide.png | 1920×1080, mouse context, no gameplay | Settled initial fixture; all font/image/cost/control/error checks PASS. |
| tablet.png | 820×1180, isMobile+hasTouch, no gameplay | Settled initial fixture; all font/image/cost/control/error checks PASS. |

The prior unloaded-optional-font desktop attempt and all other original failures remain retained outside the repository. Visible text computed families were Inter/Segoe UI/system, Georgia and sans-serif; unused registered lore FontFaces were not automatically requested by fonts.ready. Later explicit FontFace.load availability checks loaded all15 without CSS changes. Prospective no-follow profile accounting passed dangling/cyclic/live-link regressions, tolerates only ENOENT races and propagates real errors.

Phone's three missing optional OGG samples (holdTick/cardPlay/block) are documented procedural-synth fallbacks. No product exceptions were observed. Wide/tablet had zero failed requests and no visible broken images. All browser/driver/server/profile resources closed; OOM deltas0. This is untimed QA; no latency claim.

## Original image hashes

- `mobile.png`: `fa54d12d4595ef92fa521a699f4a2e857310804e4e28c477e3f4dd95402d6f0a` (394887 bytes).
- `desktop.png`: `d006e65ed392a7d775490a7d59d18d7611c6b5c2539a4b7db03420e6cf79d7af` (1225177 bytes).
- `wide.png`: `867135fedc1336d344f28f91ac42285875b691f1b63592b959db5d51ebe2e329` (2535419 bytes).
- `tablet.png`: `59926ebcb6ed2402878df9d8f111f0730dd241212e1b11f52ecdbee1f32bacfe` (914186 bytes).

Full raw reports, serializable gzip snapshots, native hit-test receipts and initial failures remain in the owned `/tmp/art-host-responsive-*` directories; only this compact capture record and accepted original PNGs are published.
