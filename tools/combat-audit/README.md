# Combat audit coverage

The inventory comes from the content registries: 4 classes, 304 cards, 523 applicable class/card pairs, 33 enemies, 1,808 candidate combinations of upgrades, authored grades, equipment profiles and unlocked upcast tiers. Inventory is not a claim that every combination can be supplied by a current player deck.

The baseline game is frozen at `0962c5ecc6467be75ffc1a4cbccc39d583e44dac`, digest `d93ee7b6bf`, build `0.7.1.1527`, art `hd-assets-v23`. The immutable local server at port 4413 serves `/workspace/scratch/combat-audit-baseline-0962`; its receipt records this identity. Source fixtures change DTO fields only and preserve compiled dispatch and event methods.

Measured engine coverage:

| Matrix | Loader | Accepted | Named unplayable | Fixture gaps | Failures |
| --- | --- | ---: | ---: | ---: | ---: |
| 523 base class/card pairs × 33 enemies | Native ESM | 16,863 | 396 | 0 | 0 |
| Same base matrix | Production CommonJS transform | 16,863 | 396 | 0 | 0 |
| 1,808 candidate variants × Soldier/Knight | Native ESM | 3,512 | 24 | 80 | 0 |
| Same variant matrix | Production CommonJS transform | 3,512 | 24 | 80 | 0 |

Base matrices use harness `a9d02585a`; native variants use `4d78fd1b9`, and compiled variants include reviewed menu integration `43a06ceb6`. Both matrices check paid/resolved receipts, effective costs, bounded pending choices, queue recovery, end turn, next turn and a subsequent Defend. Immediate positive numeric damage, Block and healing require their operation receipts; counters require an armed reply. These assertions are authored-op contracts, not native-versus-compiled parity. The current resource-state addition separately measured 990 actual pool deltas in a 1,046-case native Soldier/Knight run; resource-restoring plays are not included in that count.

Equipment-profile fixtures equip the authored carrier and stamp its canonical card, including its rating and profile receipt. Eighty candidate cases have explicit fixture gaps: unarmed profiles and retired generic technique profiles are absent from the corresponding canonical equipment decks. They exit unsuccessfully and are never counted as accepted or expected gameplay refusals.

Remaining coverage: all-enemy variant cross-product; positive/negative outcomes for 43 distinct authored conditions; exact scaled effect amounts and multi-hit totals; every opcode beyond the supported immediate contracts; deferred counter damage against eligible/ineligible incoming attacks; skill progression and all alternative carriers; empty-pool refusal atomicity; alternative combat rounds, co-op, boss phases, encounter sequences and combined status/relic interactions. Separate browser, stance and relic/enemy workers own their evidence. No gameplay defect has been confirmed by this card matrix so far.

Run `node tools/combat-audit/cards.mjs` with `--bundled`, `--all-enemies` and/or `--all-variants`. JSON output belongs in scratch, not in the repository. Named fixture gaps and unexpected failures return a failing exit status.
