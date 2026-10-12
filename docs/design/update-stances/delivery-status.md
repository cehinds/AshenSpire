# Selected stance delivery status

The five selected Reaver/greatsword pose exports and runtime integration are complete. Independent code review is approved. [PR #1890](https://github.com/cehinds/AshenSpire/pull/1890) carries build **0.7.1.1406**; browser QA and the authorized merge remain pending.

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
| Independent code review | Approved |
| Initial focused runtime/animation tests | 97 passed; initial implementation evidence |
| Final selected-weapon tests | 5 passed, including the real starting-kit registry projection |
| PR / receipt | #1890 / build 0.7.1.1406, digest `35ae0d901e` |
| Browser QA / solo gameplay validation | Pending |
| Authorized merge | Requested by the user; pending |
| Co-op | Paused |

The runtime pilot requires default-armour Reaver with the sole actual greatsword in either active hand and the other hand empty. Correction `44496130` includes the real starter's single-weapon grip mode; eligibility is not mechanically restricted to mode `two`. The paintings visually use both hands. Sweep, Counter and Smash use selected holds; pure-dodge preparation/readiness can hold Evade. Confirmed player-target guard-break and successful evasion show finite reactions, then restore the current action or newest held pose. Existing full attack and retaliation clips remain; five registered poses do not imply five new full animation sequences.

The 97 initial focused passes and five final tests are separate validation scopes. The final tests are in `tests/selected-weapon-stances.test.mjs` and include actual starting-kit projection after the eligibility correction. Independent review and these source tests do not establish browser/gameplay acceptance.

The user's request authorizes delivery and merge without another approval question. “Pending” means evidence or merge completion remains outstanding, not that authorization is missing. Receipt/build evidence comes from source commit `06b073d14`; these documentation updates do not alter build inputs. The older [integration notes](integration-notes.md) describe the initial investigation; later Dev changes and the selected implementation must be assessed from the current source and implementation evidence.

After the selected delivery is merged, the authorized next pass is ten **new greatsword options each for Sweep, Counter and Evade**, thirty total. This separate pass has zero generated options in the present snapshot. Other weapons, additional class appearances, magic treatments and the full 600-option baseline remain planned.
