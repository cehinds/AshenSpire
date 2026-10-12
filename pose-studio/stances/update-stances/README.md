# Update Stances — greatsword pilot review

Initial pilot: October 11, 2026 (America/Anchorage). Follow-up concepts are integrated on `Feature/UpdateStancesOptions`.

This review contains **40 generated and director-reviewed greatsword pose concepts for Reaver**, with **37 selectable candidates**: twenty original Smash/guard-break concepts and twenty new Counter/Evade concepts. Guard-break04, Counter15 and Evade20 require revision. The user selected five role mappings and authorized their use and merge. The full baseline remains **600 weapon-specific concepts planned**: ten options per weapon group per family, across ten weapon groups and six families. Class adaptations and magic stance variations remain planned.

| Target role | Confirmed source |
| --- | --- |
| Sweep | Smash04 |
| Counter | Smash06 |
| Guard-break | Guard-break06 |
| Evade | Smash08 |
| Smash | Smash05 |

Numeric choices are authoritative; the extra image of guard-break03 is context, not a sixth selection. Exact source crops and export provenance are in [selections.json](selections.json), owned by the art exporter. The selected pilot is registered, browser-validated and merged in PR #1890; evidence is in [delivery-status.md](../../../docs/design/update-stances/delivery-status.md). New follow-up boards remain concept comparisons, with no new runtime registration.

The next authorized pass requests **ten new greatsword options each for Sweep, Counter and Evade**, thirty total. Twenty Counter/Evade concepts have landed; Sweep’s final boards are pending. This separate pass does not complete the 600-option baseline.

| Follow-up family | Stable option IDs | Canonical sources | Director review |
| --- | --- | --- | --- |
| Sweep | `reaver-greatsword-sweep-11` through `-20` | Final `greatsword-sweep/sheet-a.png` and `sheet-b.png` pending integration | No selectable options yet |
| Counter | `reaver-greatsword-counter-11` through `-20` | [Actual painter descriptions and provenance](greatsword-counter/README.md) | Nine selectable; CT15 second hand needs clarification |
| Evade | `reaver-greatsword-evade-11` through `-20` | [Actual painter descriptions and provenance](greatsword-evade/README.md) | Nine selectable; EV20 second hand needs clarification |

Follow-up sheets are portrait, two columns by three rows: A contains 11–15 and B contains 16–20, in reading order with the bottom-right empty. The original Smash/Guard-break sheets remain landscape, three columns by two rows and numbered 01–10. **The gallery displays intact source boards.** Cell layout labels locate concepts; they are not crop instructions or runtime atlas registration. In particular, Evade sword/boot/cape bounds can cross nominal cell boundaries, so fixed 512px crops would truncate art.

Counter and Evade names below describe the actual paintings; remaining Sweep names are provisional movement briefs. The [director review record](../../../docs/design/update-stances/followup-art-review.md) governs the current flags and supersedes stale review-pending statements in the artist snapshots. Missing, unreviewed or flagged options cannot be favorited. The two follow-up flags may clear only after explicit director approval of their repaired sources.

The original five confirmed roles remain immutable records separate from editable browser favorites. Clear and reload preserve those labels. Copied JSON distinguishes actual source availability, concept review and selectable counts; new concept favorites do not modify runtime selections.

Open [the interactive review gallery](index.html) to inspect source sheets and the confirmed role labels. Browser favorites remain editable comparison choices and do not change the recorded five selections. Copied JSON includes confirmed roles, available browser favorites and follow-up coverage. Refer to a family plus its number (for example `smash04`, `guard-break02`, `sweep11`); each sheet describes its own reading-order layout.

The core baseline families are guard break, Smash stance, Smash attack sequence, melee Counter, ranged Counter and magic Counter. Sweep and Evade are now authorized selected roles and next-pass families. The ten weapon groups are sword + shield, greatsword, staff, bow, dagger, dual daggers, single sword, spear, halberd and unarmed. Class appearance and actual equipped weapon remain separate. Co-op development is paused.

## Smash loading stance — options 01–05

![Reaver greatsword Smash loading concepts 01 through 05; full original sheet](greatsword-smash/sheet-a.png)

1. **Deep high-guard squat** — low compression with a planted base.
2. **Long rear-loaded diagonal** — long stance with a rear-shoulder load.
3. **Cross-body waist coil** — transverse shoulder and hip opposition.
4. **Low rising load** — blade near the ground, poised for an upswing.
5. **Behind-head sledge load** — folded elbows preparing a heavy downward strike.

## Smash loading stance — options 06–10

![Reaver greatsword Smash loading concepts 06 through 10; full original sheet](greatsword-smash/sheet-b.png)

6. **High unilateral weight shift** — poised step/stomp; stability as a held stance still needs review.
7. **Broad lateral shoulder load** — wide stance and a lateral load.
8. **Compact chest-high crushing load** — arms close to the torso.
9. **Heel-lift rotational coil** — raised heel and visible rotation.
10. **Upright rear-hip pendulum** — upright rooted body with a low rear load.

All ten are selectable concept candidates. The source sheets establish readable alternatives, not strict runtime cell registration. See [the Smash brief](greatsword-smash/briefs.md) for prompts, intended silhouettes and generation constraints; the actual painting remains the review evidence.

## Guard break — options 01–05

![Reaver greatsword guard-break concepts 01 through 05; full original sheet](guard-break/reaver-greatsword-guard-break-sheet-a.png)

1. **Collapsed sword-point support** — revised from the overly formal original; now a selectable concept candidate.
2. **Ground drag + thigh catch** — readable loss of balance with the blade dragging.
3. **Palm catch + rear drag** — a grounded catch and broken posture.
4. **Sideways open guard / crossing blade** — needs revision: the longer blade intersects option 05’s rear boot. Isolate/repaint before export and review greatsword length. Selection paused.
5. **Dropped greatsword / slack arms** — the actual picture has dropped weapon weight and slack arms, superseding the original thigh/chest prompt.

Options 01, 02, 03 and 05 remain available for comparison, with option 04 explicitly requiring revision. The user chose option06 from sheet B for the Guard-break role. This status is anatomy/concept review only; it is not runtime approval.

## Guard break — options 06–10

![Reaver greatsword guard-break concepts 06 through 10; full original sheet](guard-break/reaver-greatsword-guard-break-sheet-b.png)

6. **Thigh-clutch / chest blow**.
7. **Recoiled hanging blade**.
8. **Slumped shoulder carry** — may read as tired/resting; a clearer broken-guard cue needs review.
9. **Hanging rear drag**.
10. **Backward heel collapse / floor drag**.

All five are selectable concept candidates. These labels describe the actual generated painting, rather than unfulfilled details in the first prompt. Guard break belongs to the fighter taking the impact, while Smash belongs to the attacker.

## Counter follow-up — options 11–20

![Counter concepts 11–15, intact source board](greatsword-counter/sheet-a.png)

![Counter concepts 16–20, intact source board](greatsword-counter/sheet-b.png)

| Option | Actual painting | Status |
| --- | --- | --- |
| CT11 | High hanging, down-right blade | Concept candidate |
| CT12 | Low forward plough, up-right blade | Concept candidate |
| CT13 | High point-forward horizontal side cover | Concept candidate |
| CT14 | Lower wide chest-centered inclined barrier | Concept candidate |
| CT15 | Rear-weighted low hanging | Needs clearer second hand; selection disabled |
| CT16 | Compact crown roof, horizontal blade | Concept candidate |
| CT17 | Forward outside hanging cover, withdrawn torso | Repaired forward grip; director approved |
| CT18 | Withdrawn point-on-line, sternum hilt | Concept candidate |
| CT19 | Lower wide high hanging cover | Concept candidate |
| CT20 | Outside diagonal cut-ready cover | Concept candidate |

## Evade follow-up — options 11–20

![Evade concepts 11–15, intact source board](greatsword-evade/sheet-a.png)

![Evade concepts 16–20, intact source board](greatsword-evade/sheet-b.png)

| Option | Actual painting | Status |
| --- | --- | --- |
| EV11 | Rear-weighted low blade | Concept candidate |
| EV12 | Deep planted landing with upright blade | Concept candidate |
| EV13 | Tall wide low carry | Concept candidate |
| EV14 | Long lateral high carry | Concept candidate |
| EV15 | Deep forward duck | Concept candidate |
| EV16 | Deep planted landing with upright blade | Concept candidate |
| EV17 | Narrow upright collected recovery | Concept candidate |
| EV18 | Wide planted low trailing carry | Repaired hip grip; director approved |
| EV19 | Compact forward horizontal carry | Concept candidate |
| EV20 | Upright low forward carry | Needs clearer second hand; selection disabled |

These actual silhouettes do not fulfill every original motion label. EV12 is not clearly retreating backward, and EV20 is not a pronounced shoulder slip. Concept approval does not assert that exact body scale/gutters were achieved or that these are ready runtime frames.

## References and next stage

- [Current class, stance and weapon art inventory](../../../docs/design/update-stances/current-art.md)
- [External pose references and inference limits](../../../docs/design/update-stances/references.md)
- [Production brief and planned coverage](../../../docs/design/update-stances/brief.md)
- [Director's art-review notes](../../../docs/design/update-stances/art-review.md)
- [Existing runtime behavior and future integration boundaries](../../../docs/design/update-stances/integration-notes.md)

The five chosen Reaver/greatsword role mappings are delivered and merged. Finish the separate Sweep/Counter/Evade concept pass and review the outstanding grip repairs. Further class adaptations and full sequences require their own production evidence. Current source sheets remain preserved as provenance.
