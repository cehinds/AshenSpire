# Selected Reaver greatsword browser QA

Selected-pose and mobile captures use the final art/layout build **0.7.1.1415**, digest **04a5dbdc03**, convergence commit [`c893f2462`](https://github.com/cehinds/AshenSpire/commit/c893f2462). The served artifact was verified as ordinal 1415 with that digest. The later 0.7.1.1417 change affects reaction playback only; the selected art/layout is unchanged. Actual gameplay reactions were recaptured on the final build in [1417 reaction QA](../1417/README.md).

## Selected held poses

All listed card inputs were selected through keyboard input in the actual `shotKit` starter: Reaver, default armour, sole right-hand greatsword. For each screenshot, the hand was replaced with that authored card so the corresponding selected pose could be checked. Dodge Roll selects Evade; mixed Evasive Guard stays Counter.

| Role / input | Capture |
| --- | --- |
| Sweep — Sweeping Blow | [sweep.png](sweep.png) |
| Counter — Guard Counter | [counter.png](counter.png) |
| Smash — Sundering Hew | [smash.png](smash.png) |
| Evade — Dodge Roll | [evade-dodge-roll.png](evade-dodge-roll.png) |
| Mixed counter — Evasive Guard | [evasive-guard-counter.png](evasive-guard-counter.png) |

## Engine reactions and scope

The reaction fixture uses the actual starter cards and engine receipts. It deterministically sets one registered Colossus to use Smash, plays the real defense or Dodge card, then advances the real turn; it does not inject event-log receipts. The guard-break receipt targets the player and breaks 3 poise; the selected reaction appears for about 186 ms and returns to Defensive. The successful Dodge receipt rolls 19 (18 total against DC 16); Evade appears for about 189 ms and returns to the held Evade pose. Both captures show the full game scene.

- [Actual guard-break reaction](guard-break-reaction.png)
- [Successful Evade reaction](successful-evade-reaction.png)

The 390×844 phone capture shows the complete Smash weapon and readable HUD, card, and footer. The blade tip has roughly 15 px clearance at the left edge. The companion guard-break phone capture confirms the knee and planted boot meet the floor. The five selected poses were checked at 390×844 and 1440×1000 for selected asset identity, visible-ink bounds, consistent scale, floor, placement domain, and canvas width. The mobile-fit harness completed 81 substantive assertions and three scope negatives; its final process exit was 1 only because it classified 11 benign Chromium `navigator.vibrate` user-activation notices as console errors. There were no application exceptions or relevant application errors; the parent approved classifying those notices as benign without rerunning.

- [Mobile Smash, 390×844](mobile-smash-390x844.png)
- [Mobile guard-break, 390×844](mobile-guard-break-390x844.png)

The negative equipment/class cases were Reaver + straight sword, Reaver + greatsword and round shield, and Rogue + greatsword. Each omitted the selected-profile metadata and rendered a different canvas image from the supported Reaver pilot; no application errors occurred.

## Review record

Independent runtime review is approved (34/34 checks); core tests passed 150/150, and the corrected source assertion passed 10/10. Source tests and deterministic browser fixtures establish the selected routing and reactions for the documented default-armour Reaver/sole-greatsword scope. They do not exercise every encounter or equipment combination.
