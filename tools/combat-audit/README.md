# Combat audit coverage

This audit found and fixed the primary Quit menu action and two measured initialization costs: Settings previews now render when opened, and card value projection groups authored tags once per operation. The projection change preserves independent pre-change value hashes. No gameplay defect was confirmed by the card matrix. The unrelated Ward-to-Block/stance implementation merged from Dev is preserved and the current proofs below include it.

The registry-derived current inventory contains 4 classes, 304 cards, 523 applicable class/card pairs, 1,892 upgrade/grade/profile/upcast candidates, 17 equipment profiles, 33 enemies, 73 relics, 71 statuses, 21 card-effect opcodes and 43 authored conditional shapes. Candidate fixtures include 84 saved legacy-face combinations. Capability fixtures equip canonical carriers, train the authored skill rank and use official `stampDeck` receipts; injected test cards and large resource/HP pools isolate mechanics rather than represent normal progression or balance.

The integrated standalone source is `60e89f5ff8c4763552e62ebaf08830e26461b5b9`, digest `368140ce27`, build `0.7.1.1530`, pinned `hd-assets-v23` light/common art. Its HTML SHA-256 is `1d63824ea3d6df48d2909b31b595e48d63e46e2d4322f74e868371b92792c319`. The immutable source snapshot and local QA server are separate from the changing audit tools. `proof-index.json` records raw card proof hashes and counts; raw result JSON remains outside the repository.

| Current production proof | Native ESM | Production loader |
| --- | ---: | ---: |
| 1,892 candidates × Soldier/Knight intents | 3,784 | 3,784 |
| Paid/resolved plays with separate SP/MP ledgers | 3,760 | 3,760 |
| Named authored-unplayable refusals | 24 | 24 |
| Capability fixture gaps / unexpected failures | 0 / 0 | 0 / 0 |
| Wrong-side/empty-pool intents | 1,046 | 1,046 |
| Atomic named refusals / accepted zero-net-price plays | 1,013 / 33 | 1,013 / 33 |
| Attributed positive/negative conditional indices | 156 | 156 |
| Explicitly uncovered conditional indices | 106 | 106 |
| Focused conditional helper contracts | 25 | 25 |
| Deferred conditional counter outcomes | 12 | 12 |

Every accepted matrix play checks legal targets, paid and resolved receipts, actual payment/restoration in each resource pool, bounded prompts/queues, end turn, next turn and a subsequent play. Immediate positive numeric damage, Block and healing require operation receipts; counter cards must arm their deferred payload. Refusal snapshots include enemies, piles, turn/phase, trigger gates, prompts, queued actions and RNG counters, excluding only derived preview caches. The 33 empty-pool accepted plays have zero effective prices; they are not mislabeled as self-funding simply because they contain a restoration opcode.

Conditional proofs use the actual legal target, controlled predicate states, attributed operation packets and actual HP/Block/Barrier/status/pile changes. Same-op coeffects count only when their other predicates remain stable; an amount receipt alone cannot establish a changing complementary branch. The general and focused helpers plus deferred proofs currently establish 37 of 43 literal authored condition shapes, with a further frost/frostExposed → frozen/chilled projection proven through resolved dispatch. Five remaining semantic families are named rather than counted: not-Bulwark, target Staggered/not-Staggered, not-Starstone Charge and not-HP-below-50. Their cards are exercised in the paid matrix; this does not prove every individual conditional index. A focused closure helper is being reviewed separately.

Real Guard Counter and Crimson Reprisal fixtures verify authored preparation, no premature HP damage, eligible incoming attack, exact conditional HP/Poise payload, the implemented stance multipliers, suppression/bypass, declined reaction, expiration and input recovery. The four lifecycle scenarios and twelve conditional cases run under both loaders. Enemy reactions remain enabled.

Historical baseline breadth is separately frozen at `0962c5ecc6467be75ffc1a4cbccc39d583e44dac`, digest `d93ee7b6bf`, build `0.7.1.1527`. It covered 523 base class/card pairs × all 33 enemies under both loaders: each 17,259 intents, 16,863 accepted, 396 named unplayable and zero unexpected failures. Those early engine rows used compatibility defaults for friendly targeting, so they are not a claim about every UI target route or the later stance implementation. The baseline browser, stance and relic reports retain their own source identities.

This is bounded coverage, not every possible state cross-product. Uncovered combinations include all-enemy upgraded/profile cross-products, every alternative carrier/progression path, co-op, complete campaign sequences, every boss phase, every RNG outcome and combined relic/status/stance interactions. Opcode representatives and family-level outcomes do not establish every authored effect amount or every conditional index. Fresh integrated browser/menu/stance/relic evidence is added to the final preview report with its own source binding.

Reproduce with `node tools/combat-audit/cards.mjs --all-variants`, adding `--bundled` for the actual production transform. Other modes are `--conditions`, `--refusals`, `--counter-lifecycle` and `--deferred-conditions`; `--all-enemies` expands the base sweep. Focused modules have matching tests under `tests/combat-audit-*.test.mjs`. Keep raw output in scratch or CI artifacts. Unexpected failures and named capability gaps fail the command.
