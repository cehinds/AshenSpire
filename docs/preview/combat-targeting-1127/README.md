# Compiled combat targeting and pricing QA

Artifact: **0.7.1.1127 / 737b1222ad**, read directly from `build/download/AshenSpire.html`. All three correctness drivers required this exact identity before opening a browser. Source and build metadata were unchanged during these checks.

- Canonical timing ran first: Normal motion, 1440 × 900, seed 1, five real plays. **345 ms median** passes the unchanged **400 ms median** budget. Samples: 633, 370, 244, 146, 345 ms. Shield Bash and Dodge Roll were played against their legal friendly targets. Individual samples can exceed the median budget. Unrelated host builds/tests were observed during startup; the run completed without changing its deadlines.
- Solo desktop (1365 × 1000) and phone (390 × 844): Shield Bash arms the player. Escape cancels selected Counter and hostile spell targeting with resources, hand, Block, prepared Counter and RNG unchanged. Paid Shield Bash spends exactly 1 SP (6 → 5), leaves Mana at 8, and prepares Block 14 plus one Counter charge. Unarmed Escape preserves that paid state.
- Co-op desktop and phone: the reachable selected-card Upcast button opens its tier dialog. Tier 2 Shield Bash visibly shows **3 SP / 2 Mana**. With only 2 SP the card is gray and clicking it submits no play. After funding, seat p2 submits Tier 2 to p2; seat p1 submits Barrage Interception Tier 1 to p1. These are real compiled client interactions with production-engine generated previews and **canned two-seat transport**; they do not claim live host payment or two-browser networking. Production host payment parity is covered separately by the focused engine tests.
- Generic desktop fixture: an output-only definition for the known `rallyingBanner` ID uses base Tier 2 and unlocked Tiers 3/5. The enabled post-target prompt changes Tier 5 from self to enemy and rearms legal targets without payment or RNG changes. Its badge shows **3 SP / 3 Mana**. With 2 SP it is gray; an intentional call to the actual compiled dispatch function refuses with player, piles, enemies, queued work, events, run and RNG unchanged. The function reference is captured through a CDP breakpoint during an ordinary paid Counter click; no artifact or source bytes are changed. Funding and choosing a legal enemy then spends 3 SP / 3 Mana (10 → 7 each) and adds Block 14 (14 → 28). The authored fixture is not a shipped card definition.
- Canonical timing and all three final correctness drivers exited **0**. Correctness drivers reported **no game/browser errors**. Desktop/phone solo and co-op reported **no horizontal overflow**. Representative screenshots were visually reviewed for price badges, controls, targets, art and text.

The first co-op attempt exited 1 because the generated wire fixture mistakenly used `player` for both seat IDs; the client correctly showed spectator mode. The output fixture was corrected to p1/p2 and the final driver passed. Its failed log/result remain in the output directory. One solo temporary-profile cleanup warned EBUSY after browser closure; final process inventory found no owned `v2qa-` or `clickimpact-` Chrome/Edge process.

[Compact results](results.json) preserve identity, payments, prepared state, seat intents, pricing, refusal and timing. Selected captures:

- [Desktop paid Counter](desktop-counter-committed.png)
- [Phone selected Counter](phone-counter-self-armed.png)
- [Phone paid Counter](phone-counter-committed.png)
- [Desktop co-op Tier 2 price](desktop-coop-tier-two.png)
- [Phone co-op Tier 2 price](phone-coop-tier-two.png)
- [Phone co-op Tier 2 with insufficient SP](phone-coop-tier-two-low-sp.png)
- [Tier 5 waiting for a legal enemy](desktop-tier-five-retarget.png)
- [Tier 5 with insufficient SP](desktop-tier-five-low-sp.png)
- [Tier 5 paid](desktop-tier-five-paid.png)

Commands from `D:/repos/.codex/outputs/combat-card-stances/`:

```text
node built-click-impact-probe.mjs --plays 5 --seed 1 --debug
COMBAT_QA_ORDINAL=1127 COMBAT_QA_SOURCE=737b1222ad node built-target-qa.mjs
COMBAT_QA_ORDINAL=1127 COMBAT_QA_SOURCE=737b1222ad node built-coop-upcast-qa.mjs
COMBAT_QA_ORDINAL=1127 COMBAT_QA_SOURCE=737b1222ad node built-tier-target-qa.mjs
```

The environment variables above use shell-neutral notation; PowerShell runs set `$env:COMBAT_QA_ORDINAL` and `$env:COMBAT_QA_SOURCE`. Logs in the output directory are `built-click-impact-canonical-final-1127.log`, `built-target-qa-final-1127.log`, `built-coop-upcast-final-1127.log`, and `built-tier-target-qa-final-1127.log`.

[1124 evidence](../combat-targeting-1124/README.md) remains historical, including the underpriced badges that prompted this correction. These checks do not replace hosted source/CI verification or owner-device acceptance.
