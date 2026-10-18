# Final selected-reaction gameplay QA

Unpatched build **0.7.1.1417**, digest **b1ec8952f6**, source commit [`e8efd0244`](https://github.com/cehinds/AshenSpire/commit/e8efd0244). The served `AshenSpire.html` was verified at this build identity. This source change adjusts reaction timing, readiness restoration, and defeat handling; selected pose art and layout did not change. The five held-pose and mobile captures remain in [the 1415 art/layout QA record](../1415/README.md).

The final actual-game browser run exited successfully with no page errors:

- Actual `combatGuardBroken` receipt for the player, source `e1`, poise 3 → selected `pilot-guard-break` for 197.4 ms → Defensive hold restored. [Screenshot](guard-break-reaction.png)
- Actual successful Dodge receipt (roll 19, total 18 vs DC 16) → selected `pilot-evade` for 181.8 ms → Evade hold restored. [Screenshot](successful-evade-reaction.png)

The deterministic fixture plays the real starter defense or Dodge card and resolves a registered Colossus Smash through the game engine; event-log receipts were not injected. Independent source review passed 57/57 focused checks, including actual engine ordering/identity fixtures and deferred-bitmap hook coverage. Fast-path timing was checked at 81 ms.
