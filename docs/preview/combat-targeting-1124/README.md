# Combined compiled combat targeting QA

Artifact: **0.7.1.1124 / 84f593f7fd**, read directly from `build/download/AshenSpire.html`. Each correctness driver confirmed this compiled identity. The completed standalone artifact was exercised through real Chromium mouse/touch input; source and build metadata were unchanged during these checks.

- Canonical timing ran first in isolation: Normal motion, 1440 × 900, seed 1, five plays. **388 ms median** passes the unchanged **400 ms median** budget. Samples: 583, 410, 266, 138, 388 ms. Shield Bash and Dodge Roll were played against their actual legal friendly targets. Individual samples can exceed the median budget.
- Solo desktop (1365 × 1000) and phone (390 × 844): Shield Bash selects the player. Escape cancels friendly Counter and hostile spell targeting with resources, hand, Block, Counter, and RNG unchanged. The paid Counter spends exactly 1 SP (6 → 5), leaves Mana at 8, reduces the hand from 8 to 7, and prepares Block 14 plus one Counter charge. Subsequent Escape preserves that paid state.
- Co-op desktop and phone: the selected-card Upcast button is reachable by mouse/touch and opens a tier choice dialog. Seat p1 submits Barrage Interception at Tier 1 to p1; seat p2 submits Shield Bash at Tier 2 to p2. The actual compiled client uses engine-generated previews with canned two-seat transport. This verifies submitted intents and UI ownership, not live host dispatch or two-browser networking. The co-op picker is a dialog, not an inline tier select.
- Generic desktop retarget fixture: a custom definition for the known `rallyingBanner` ID has base Tier 2 and unlocked Tiers 3/5. With the post-target prompt enabled, choosing Tier 5 changes the destination from self to enemy and rearms legal targets without payment or RNG changes. Selecting a legal enemy then spends 3 SP and 3 Mana (10 → 7 each) and grants the printed Block 14. This fixture verifies the generic contract; it is not a shipped card definition.
- All four drivers exited **0**. Correctness drivers reported **no browser errors**; desktop/phone solo and co-op had **no horizontal overflow**. Solo and retarget checks waited for initial card/fighter images to be complete with positive natural dimensions. Representative captures were visually reviewed for text, art, targets, and controls.

[Compact results](results.json) preserve identity, payments, prepared state, seat intents, and timing. Final captures:

- [Desktop paid Counter](desktop-counter-committed.png)
- [Phone selected Counter](phone-counter-self-armed.png)
- [Phone paid Counter](phone-counter-committed.png)
- [Desktop co-op Tier 2](desktop-coop-tier-two.png)
- [Phone co-op Tier 2](phone-coop-tier-two.png)
- [Tier 5 waiting for a legal enemy](desktop-tier-five-retarget.png)
- [Tier 5 paid](desktop-tier-five-paid.png)

Commands, from `D:/repos/.codex/outputs/combat-card-stances/`:

```text
node built-click-impact-probe.mjs --plays 5 --seed 1 --debug
node built-target-qa.mjs
node built-coop-upcast-qa.mjs
node built-tier-target-qa.mjs
```

Detailed logs remain in that output directory as `built-click-impact-canonical-final-1124.log`, `built-target-qa-final-1124.log`, `built-coop-upcast-final-1124.log`, and `built-tier-target-qa-final-1124.log`.

[Earlier 1115 evidence](../combat-targeting-1115/README.md) remains historical and unchanged apart from its explicit historical label. These checks do not replace hosted source/CI verification or owner-device acceptance.
