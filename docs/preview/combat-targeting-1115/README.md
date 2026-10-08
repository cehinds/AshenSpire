# Final compiled combat targeting QA

Artifact: **0.7.1.1115 / 2d9127408f**, read directly from `build/download/AshenSpire.html`. Both correctness drivers confirmed the compiled identity before interaction. These are real Chromium mouse/touch interactions with the completed standalone artifact.

- Desktop: 1365 × 1000. Phone: 390 × 844. Initial card and fighter images were complete with positive natural dimensions before input.
- Shield Bash selects the player as its legal Counter target. Escape cancels selected friendly Counter and hostile spell targeting without changing resources, hand, Block, Counter state, or RNG.
- Playing Shield Bash costs exactly 1 SP (6 → 5), leaves Mana at 8, reduces the hand from 8 to 7, and prepares 14 Block plus one version-2 Counter charge. Escape after this paid play preserves the paid resources and prepared Counter.
- Co-op Upcast is reachable by mouse and touch. The actual compiled client submits Tier 1 for seat p1/Barrage Interception and Tier 2 for seat p2/Shield Bash, preserving each owner and friendly target. This uses engine-generated wire previews and a canned two-seat transport; it records intents and does **not** establish live host dispatch or two-browser networking.
- Both correctness drivers exited 0, reported no browser errors, and found no horizontal overflow. Reviewed captures show complete card text and reachable controls.
- Canonical timing: Normal motion, 1440 × 900, seed 1, five plays. Median **379 ms**, within the unchanged **400 ms median** budget. Samples: 547, 388, 281, 108, 379 ms. The gate is the median; individual samples can exceed 400 ms.

The compact [results record](results.json) preserves identity, costs, prepared state, seat intents, and timing. Representative final captures:

- [Desktop Counter selected](desktop-counter-self-armed.png)
- [Desktop Counter paid](desktop-counter-committed.png)
- [Phone Counter selected](phone-counter-self-armed.png)
- [Phone Counter paid](phone-counter-committed.png)
- [Desktop co-op Tier 2](desktop-coop-tier-two.png)
- [Phone co-op Tier 2](phone-coop-tier-two.png)

[Historical 1113 evidence](historical-1113/README.md) is explicitly older. It preserves the custom authored base-Tier-2 → Tier-5 modal retarget fixture and earlier Counter checks; it is not represented as a new 1115 run.

Commands run from the D: output directory:

```text
node built-click-impact-probe.mjs --plays 5 --seed 1 --debug
node built-target-qa.mjs
node built-coop-upcast-qa.mjs
```

Detailed output logs remain under `D:/repos/.codex/outputs/combat-card-stances/`: `built-click-impact-canonical-final-1115.log`, `built-target-qa-final-1115.log`, and `built-coop-upcast-final-1115.log`. This record covers compiled-artifact interaction and timing. The earlier local native-source 20-second startup gate was not rerun here; hosted source verification remains a separate delivery check.
