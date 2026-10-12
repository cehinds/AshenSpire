# Update Stances — greatsword pilot review

Art exploration on `Feature/UpdateStances`, October 11, 2026 (America/Anchorage).

This first review contains **20 drafted greatsword pose concepts for Reaver**, with **19 selectable candidates**: ten Smash loading stances and ten guard-break reactions. The full baseline remains **600 shared concepts planned**: ten options per weapon group per family, across ten weapon groups and six families. Class adaptations to Reaver, Rogue, Starseer and Herald follow selected directions; those four appearances are not four additional choices. Magic stance variations are additional scope. These are concept candidates, not cropped/registered game sprites or animation sequences.

Open [the interactive review gallery](index.html) in the Workbench/static preview to select favorites, inspect each unchanged source sheet, and copy the choices. Favorites are saved in that browser only; copied JSON contains stable option IDs. On this rendered page, refer to a family plus its number (for example `smash 04`, `guard-break 02`). Numbers below follow reading order: the first three figures on the top row, then the two below. No source images are destructively cropped.

The core families are guard break, Smash stance, Smash attack sequence, melee Counter, ranged Counter and magic Counter. The ten weapon groups are sword + shield, greatsword, staff, bow, dagger, dual daggers, single sword, spear, halberd and unarmed. Class appearance and actual equipped weapon remain separate. Co-op development is paused; this review changes no game code.

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

Options 01, 02, 03 and 05 are selectable concept candidates. The pilot is frozen for owner review with option 04 explicitly requiring revision. This status is anatomy/concept review only; it is not runtime approval.

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

After concept choice, adapt the selected choreography to the four class appearances and review weapon/hand consistency, rear orientation, anatomy, cape continuity and full silhouette bounds. Then author the selected attack/reaction phases and runtime registrations. Current source sheets remain preserved as provenance.
