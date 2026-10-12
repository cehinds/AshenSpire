# Update Stances — greatsword pilot review

Art exploration on `Feature/UpdateStances`, October 11, 2026 (America/Anchorage).

This review contains **20 generated and director-reviewed greatsword pose concepts for Reaver**, with **19 selectable candidates**: ten Smash loading stances and ten guard-break reactions. The user selected five role mappings and authorized their use and merge. The full baseline remains **600 weapon-specific concepts planned**: ten options per weapon group per family, across ten weapon groups and six families. Class adaptations and magic stance variations remain planned.

| Target role | Confirmed source |
| --- | --- |
| Sweep | Smash04 |
| Counter | Smash06 |
| Guard-break | Guard-break06 |
| Evade | Smash08 |
| Smash | Smash05 |

Numeric choices are authoritative; the extra image of guard-break03 is context, not a sixth selection. Exact source crops and export provenance are in [selections.json](selections.json), owned by the art exporter. Runtime registration, solo validation and merge completion are tracked in [delivery-status.md](../../../docs/design/update-stances/delivery-status.md); no completion is inferred from concept selection.

After the selected delivery is merged, the next authorized pass is **ten new greatsword options each for Sweep, Counter and Evade**, thirty total. That separate pass is planned and has zero generated concepts in this snapshot; it does not complete the 600-option baseline.

The gallery now scaffolds those thirty proposals from the [follow-up reference brief](../../../docs/design/update-stances/followup-reference-brief.md). It is isolated follow-up work and must not enter the selected-delivery PR. Generation remains paused until the parent confirms that selected delivery has merged.

| Follow-up family | Stable option IDs | Planned source sheets | Layout / review state |
| --- | --- | --- | --- |
| Sweep | `reaver-greatsword-sweep-11` through `-20` | `greatsword-sweep/sheet-a.png`, `sheet-b.png` | Portrait 2 columns × 3 rows; NEEDS REVIEW |
| Counter | `reaver-greatsword-counter-11` through `-20` | `greatsword-counter/sheet-a.png`, `sheet-b.png` | Portrait 2 columns × 3 rows; NEEDS REVIEW |
| Evade | `reaver-greatsword-evade-11` through `-20` | `greatsword-evade/sheet-a.png`, `sheet-b.png` | Portrait 2 columns × 3 rows; NEEDS REVIEW |

Sheet A contains 11–15 and B contains 16–20, each in row-major order with the bottom-right cell empty. The original Smash/Guard-break sheets retain their landscape 3-column × 2-row layout and 01–10 numbering. Family layout, numbering offset and per-sheet `reviewStatuses` live in `review.mjs`; follow-up sheets start `needs-review`. Missing sources show planned placeholders. Available but unreviewed images may be inspected, while their favorite controls stay disabled and do not increase the selectable count. Only a director-approved `candidate` sheet enables its non-flagged options.

The availability summary and copied JSON distinguish thirty planned follow-up concepts, actual loaded source sheets and director-reviewed/selectable concepts. Browser favorites exclude missing and unreviewed options. The original five confirmed roles remain recorded independently of browser favorites, including after Clear and reload. No new painting, crop, runtime registration or replacement of selected art belongs to this scaffold.

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

## References and next stage

- [Current class, stance and weapon art inventory](../../../docs/design/update-stances/current-art.md)
- [External pose references and inference limits](../../../docs/design/update-stances/references.md)
- [Production brief and planned coverage](../../../docs/design/update-stances/brief.md)
- [Director's art-review notes](../../../docs/design/update-stances/art-review.md)
- [Existing runtime behavior and future integration boundaries](../../../docs/design/update-stances/integration-notes.md)

Deliver the five chosen Reaver/greatsword role mappings, then merge as authorized and begin the separate Sweep/Counter/Evade exploration pass. Further class adaptations and full sequences require their own production evidence. Current source sheets remain preserved as provenance.
