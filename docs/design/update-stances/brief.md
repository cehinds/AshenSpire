# Update Stances production brief

Working date: October 11, 2026, America/Anchorage. Target branch: `Feature/UpdateStances`.

The production unit is **ten distinct options per weapon group per family**, followed by class appearance adaptations. The ten options are not shared globally across weapons. A reusable movement theme may inform multiple weapons, but each weapon needs its own credible grip, weight, silhouette and action path. This document defines planned work; it does not claim that the planned art or animations already exist.

## Scope and counts

The six requested families are on-knee guard-break, dedicated smash stance, smash attack sequence, melee counter sequence, ranged counter sequence and magic counter sequence. All four classes—Reaver, Rogue, Starseer and Herald—must retain their established identity while using the selected equipment.

The ten weapon groups are sword + shield, greatsword, staff, bow, single dagger, dual daggers, single sword, spear, halberd and unarmed. In the requested weapon list, “dagger” means single dagger and “daggers” means dual daggers; these normalize to two groups, without introducing a third dagger category. Item catalog wording alone does not authorize a two-weapon runtime loadout.

| Planned scope | Base options | Four-class appearance adaptations |
| --- | ---: | ---: |
| Six new families × ten weapons × ten options | 600 | 2,400 |
| Proposed ten-option attack/defend/prepare backfill | 300 | 1,200 |
| Combined, including proposed backfill | 900 | 3,600 |

Existing attack, defend and prepare poses also need weapon-aware handling. The additional **ten options per weapon for those three existing families is proposed exploration scope**, rather than a confirmed increase to the six-family request.

Magic versions of held stances must change body configuration and focus: weight transfer, torso angle, hand/grip arrangement or sustained channel gesture. An aura or palette swap does not count as another option. Magic counter is already magical and receives no artificial physical counterpart. Guard-break and smash stance magic variants add a planned 200 weapon-first options / 800 class adaptations. Magic backfill for the three proposed existing stance families adds a possible 300 / 1,200. Extending the three otherwise physical sequence families—smash attack, melee counter and ranged counter—with derived magical choreography adds a further **proposed** 300 / 1,200. Including every proposed extension gives a maximum 1,700 treatment-specific options / 6,800 class adaptations; this is an upper bound before feasibility and selection, not a delivery claim.

A concept option is one composition brief or action storyboard. Class adapters, magic treatments, storyboard panels, body frames, FX frames and finished registered sequences are separate counts. Frame totals remain unset until selection and phase planning. Producing all options as finished animation clips would be a substantially larger task than reviewing their concept storyboards.

## Visual and equipment contract

Use the current painted alternative characters as identity references; the audited sources and rejected directions are in [current-art.md](current-art.md). View every character from a rear three-quarter camera behind the **left shoulder**, facing screen-right. Preserve full body, complete weapon tips and readable silhouette. Standing poses retain visible feet; guard-break must show exactly one grounded knee and the opposite planted boot. The existing source reference is 512 × 512 with floor anchor `[256,464]`, exported at 256 × 256 for current runtime art; these are later export references, not dimensions imposed on multi-option concept boards. Final selected cutouts must preserve the shared body scale and anchor rather than shrink the character to fit an oversized effect.

Reaver retains rusty plate, closed helmet and continuous crimson cape. Rogue retains the hood, brown Gutter Leathers and teal cloak. Starseer retains navy/gold Nightweave; Herald retains red hood and Rite Vestments. Their starter weapons are identity references, not a reason to substitute equipment: a Rogue with a spear needs the spear, and a Reaver with a bow needs the bow. Established book casting poses are references only where the selected equipment and action allow them. Books remain in front with pages toward their reader; do not repeat the rejected rear-held or wrong-facing book poses.

Exactly two arms and hands; credible grips; no extra shield, dagger, staff or bow. Preserve the distinction between a one-hand sword and a greatsword, a spear point and a halberd head, one dagger and two. Spear, halberd and unarmed lack exact existing action-family coverage and need dedicated authoring. The machine matrix records reference availability separately from runtime equip legality, which this document does not establish.

Guard-break means a **living, staggered character on one knee** after loss of guard. It must read differently from death, deliberate prayer, and ordinary preparation. Smash stance is a sustained readiness hold, with heavy weight loading; it is not the smash contact frame. Body and magic/impact effects remain separately exportable, so pose readability survives effects being removed.

Bow heavy-action semantics remain an open review item: the proposed direction is a forceful braced shot, with a different loading silhouette and release path from normal aim. Do not depict a bow being smashed into the ground or add a melee weapon. Physical ranged counter is supported visually by the existing bow release reference. For other weapons, preserve a pending capability decision: “ranged counter” could mean a ranged retaliatory payload or countering incoming ranged attacks. No thrown swords, invented bows or presumed projectiles. An evade/intercept followed by a melee return is a different action interpretation that needs resolution before authoring that sequence.

## First wave: twenty generated greatsword concept candidates

The first production wave establishes the art grammar with ten dedicated smash holds and ten kneeling guard-break holds using a Reaver/greatsword identity pilot. The artists' exact prompts and briefs are the single authority for these options:

- [Greatsword smash options 01–10](../../../pose-studio/stances/update-stances/greatsword-smash/briefs.md).
- [Guard-break options 01–10](../../../pose-studio/stances/update-stances/guard-break/briefs.md).

[production-matrix.json](production-matrix.json) references those artist authorities by option number and records existing board paths. It intentionally does not repeat a second, potentially conflicting set of pose descriptions. Magic and other-class adapters remain planned rather than inferred from the physical Reaver pilot.

All four canonical A/B boards now exist, carrying twenty generated physical Reaver/greatsword candidates: ten smash holds and ten guard-break poses. The matrix records twenty generated options; the broader 600-option request remains planned. All twenty have received art-director concept review: nineteen are selectable for user comparison, and guard-break option04 needs revision because its blade reads short and touches the neighboring A05 boot. There are zero user-selected poses, production-approved assets or registered sequences. Preliminary or repair passes are not additional options. See [art-review.md](art-review.md) and artist provenance for visual review notes, superseded candidates, anatomy concerns and crop/viewport limitations. A generated concept is not a selected pose, approved cutout or registered sprite sequence.

The remaining weapon/family work packages request ten options each but have no invented completed specifications. They stay `planned_not_briefed` until an artist develops and records distinct silhouettes and choreography.

## Subsequent production and acceptance

1. Review the twenty greatsword pilot candidates at actual combat scale, resolve the recorded defects and choose poses before class/magic adaptation. Preserve the existing board paths, exact prompts and generation provenance.
2. Apply the selected pose grammar across weapon groups, then all four class appearances. Resolve bow heavy-action and non-bow ranged interpretation before those sequences.
3. Develop ten weapon-specific storyboards for smash attack and each counter family. A counter preparation hold and a triggered retaliation are separate states. At minimum, show load/preparation, defense or commitment, contact/aim, follow-through/release, recovery and matching equipped rest; assign actual timing after selection.
4. Author requested magic held stances and review proposed magic-sequence/backfill extensions. Preserve existing spell/card identity rather than assigning new schools or gear through art.
5. Turn selected storyboards into body and separate FX frames, normalize bounds, register catalog entries and validate solo gameplay. Runtime routing is a later implementation task. Co-op work remains paused.

Review anatomical continuity, forward intent, weapon count, grip changes, knee/foot contact, outfit identity, visible weapon endpoints, distinct body silhouettes and recovery back to the correct equipment. Animation review must establish visible playback of every authored phase at normal and reduced-motion settings; prior frame-skipping reports are not resolved by this art brief.

Web research and its source ledger are in [references.md](references.md). Text-supported mechanics include the [I.33 sword/buckler counter wards](https://www.hema101.com/post/sword-and-buckler-102-i33-part-4-defence), [Meyer staff/polearm source](https://wiktenauer.com/wiki/Joachim_Me%C3%BFer), and [World Archery posture guidance](https://www.worldarchery.sport/news/149488/9-common-recurve-archery-mistakes-and-how-fix-them). Magic gesture inspiration includes the [Frieren publisher sample](https://www.ki-oon.com/news/644-frieren-le-renouveau-de-l-heroic-fantasy.html). External image pixels were not delivered for direct inspection in that workstream, so the reference propositions are text/metadata-informed rather than verified visual anatomy. Cite them as inspiration and equipment mechanics; never copy another character or let a reference introduce unsupported gear.

The state progression is planned → briefed → generated → director-reviewed concept (selectable or revision-needed) → user-selected → production-approved → frames authored → exported → registered → solo validated. Concept review and selection do not imply production approval or a finished sequence.
