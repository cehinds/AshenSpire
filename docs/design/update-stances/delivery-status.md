# Selected stance delivery status

The five selected Reaver/greatsword pose exports and runtime integration are complete. Independent source reviews are approved, and the director approved the corrected guard-break comparison. Final built-game browser QA remains pending. [PR #1890](https://github.com/cehinds/AshenSpire/pull/1890) carries build **0.7.1.1412**; browser QA and the authorized merge remain pending.

| Target role | Selected source | Decision |
| --- | --- | --- |
| Sweep | Smash04 | Use and merge authorized |
| Counter | Smash06 | Use and merge authorized |
| Guard-break | Guard-break06 | Use and merge authorized |
| Evade | Smash08 | Use and merge authorized |
| Smash | Smash05 | Use and merge authorized |

The additional image of guard-break03 supplies context only. It is not a sixth selection. Numeric family/option choices control the source mappings.

Exact crop coordinates, unchanged source hashes and export provenance are in the [selection manifest](../../../pose-studio/stances/update-stances/selections.json). The reproducible [exporter](../../../tools/selected-weapon-profile-export.mjs) produced full/mobile WebPs under `assets-display/alternative/reaver-greatsword-pilot-*.webp`, the [selected Sprite Workshop project](../../../pose-studio/stances/selected-projects/reaver-greatsword-pilot.rig.json), and the `reaver-greatsword-pilot` registration in `src/content/alternativeSelectedStances.js`. This document does not duplicate crop coordinates or source hashes.

| Delivery evidence | Status at this snapshot |
| --- | --- |
| Generated pilot concepts | 20 |
| Art-director reviewed concepts | 20 |
| Selectable concepts | 19; guard-break04 requires revision |
| User-selected role mappings | 5 |
| Selected export manifest and cutouts | Complete: five full/mobile pose exports and selected project |
| Runtime registration and routing | Complete; eligibility correction `44496130` included |
| Independent source review | Approved: eligibility, canonical pure-Dodge and selected-profile mobile clamp |
| Initial focused runtime/animation tests | 97 passed; initial implementation evidence |
| Final selected-weapon tests | 5 passed, including the real starting-kit registry projection |
| PR / receipt | #1890 / build 0.7.1.1412, digest `96f531f0e5` |
| Pure-Dodge source checkpoint | 36 focused passes; independent correction review approved with 34 checks |
| Actual reaction-hook bindings | 35 regression passes; missing animation-pace imports fixed by `c663cf2d4` |
| Mobile-fit source review | Approved; 26 independent composition/selected-weapon/formation tests and all-five bounds checks passed |
| Latest Dev grid behavior | 42 focused tests passed after #1884 merge |
| Corrected guard-break export | Director-approved comparison; 2 export/source/hash registration tests passed after `ed4dbf3b5` |
| Browser QA / solo gameplay validation | Pending; captures must use the current build |
| Authorized merge | Requested by the user; pending |
| Co-op | Paused |

The runtime pilot requires default-armour Reaver with the sole actual greatsword in either active hand and the other hand empty. Correction `44496130` includes the real starter's single-weapon grip mode; eligibility is not mechanically restricted to mode `two`. The paintings visually use both hands. Sweep, Counter and Smash use selected holds; pure-dodge preparation/readiness can hold Evade. Correction `71d6f4595` uses the canonical `isPureDodge` marker even when expanded Dodge is typed Counter; mixed counters keep their Counter pose and the glyph/mechanics remain unchanged. Confirmed player-target guard-break and successful evasion show finite reactions, then restore the current action or newest held pose. Existing full attack and retaliation clips remain; five registered poses do not imply five new full animation sequences. The mobile fix uses one stable horizontal envelope across all five selected poses: the existing viewport clamp may move presentation X when needed, while body scale, floor Y and formation cells remain unchanged. Guard-break registration now maps the source-sheet knee/boot support line at y480 to exported floor y464, moving that painting down about 32.5 export pixels; source artwork is unchanged.

The 97 initial focused passes and five final tests are separate validation scopes. The final tests are in `tests/selected-weapon-stances.test.mjs` and include actual starting-kit projection after the eligibility correction. The pure-Dodge correction has 36 focused passes and approved independent review. Later hook-binding, mobile-fit, grid and guard-break export checks above are overlapping focused scopes, not a summed test total. These source checks and comparison review do not establish final built-game browser acceptance.

The user's request authorizes delivery and merge without another approval question. “Pending” means evidence or merge completion remains outstanding, not that authorization is missing. The initial receipt at `06b073d14` used build 0.7.1.1406. After merging Dev `216845621` (#1876), the receipt and both high-art/light builds were regenerated to 0.7.1.1408 (`c192e3e401`). Earlier brief/matrix build references record the pre-refresh snapshot; this delivery record names the current build. The later pure-Dodge correction `71d6f4595`, merged at `6208dae3f`, is now rebuilt as 0.7.1.1410 (`08b5c57339`). The frozen source at `a6f8f7609` includes reaction imports, mobile edge clamping, the corrected knee/boot anchor and Dev #1884; high-art and light builds are now 0.7.1.1412 (`96f531f0e5`). Earlier source/build snapshots are historical. QA must capture this unpatched build. Documentation updates do not alter build inputs. The older [integration notes](integration-notes.md) describe the initial investigation; later Dev changes and the selected implementation must be assessed from the current source and implementation evidence.

After the selected delivery is merged, the authorized next pass is ten **new greatsword options each for Sweep, Counter and Evade**, thirty total. This separate pass has zero generated options in the present snapshot. Other weapons, additional class appearances, magic treatments and the full 600-option baseline remain planned.
