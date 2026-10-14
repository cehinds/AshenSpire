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

Base matrices use harness `a9d02585a`; native variants use `4d78fd1b9`, and compiled variants include reviewed menu integration `43a06ceb6`. These historical base matrices omit explicit friendly target IDs and therefore exercise compatibility defaults, not every UI target route. Both matrices check paid/resolved receipts, effective costs, bounded pending choices, queue recovery, end turn, next turn and a subsequent Defend. Immediate positive numeric damage, Block and healing require their operation receipts; counters require an armed reply. These assertions are authored-op contracts, not native-versus-compiled parity. The current resource-state addition separately measured 990 actual pool deltas in a 1,046-case native Soldier/Knight run; resource-restoring plays are not included in that count.

Equipment-profile fixtures equip the authored carrier and stamp its canonical card, including its rating and profile receipt. Eighty candidate cases have explicit fixture gaps: unarmed profiles and retired generic technique profiles are absent from the corresponding canonical equipment decks. They exit unsuccessfully and are never counted as accepted or expected gameplay refusals.

After the connected-player DTO correction and reviewed projection performance integration, both loaders repeated the 3,616-case variant matrix with explicit legal targets: 3,520 accepted plays, 24 named unplayable refusals, 72 fixture gaps and no failures. Each loader checks actual resource deltas for 3,440 plays without resource-restoring events. The remaining profile gaps are explicit capability-fixture gaps, not proven impossible player configurations.

Positive/negative conditional dispatch currently verifies 158 effect/grade instances covering 33 distinct authored conditions in both loaders. It checks operation receipt counts or an authored amount packet against the opposite predicate state; 81 deferred/unsupported effect instances remain explicitly uncovered. Predicate fixture setup itself validates all 43 condition definitions both ways but is not effect coverage. Guard Counter additionally proves real eligible blocked attack → reply damage 5, eligible leaking attack → no reply, Mirror Scribe bypass → no consumption, declined real reaction → no paid card, and preparation expiry/queue recovery, in both loaders.

Remaining coverage: all-enemy variant cross-product; the remaining conditional/deferred effect outcomes; exact scaled effect amounts and multi-hit totals; every opcode beyond the supported immediate contracts; deferred counter damage against eligible/ineligible incoming attacks; skill progression and all alternative carriers; empty-pool refusal atomicity; alternative combat rounds, co-op, boss phases, encounter sequences and combined status/relic interactions. Separate browser, stance and relic/enemy workers own their evidence. No gameplay defect has been confirmed by this card matrix so far.

Run `node tools/combat-audit/cards.mjs` with `--bundled`, `--all-enemies` and/or `--all-variants`. JSON output belongs in scratch, not in the repository. Named fixture gaps and unexpected failures return a failing exit status.
