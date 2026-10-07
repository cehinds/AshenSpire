# Class-book rewards amendment — 2026-10-03

Owner-approved amendment to SPEC §14.3. This extends class books without
changing ordinary skill, spell or universal book lessons.

- A class book always grants its configured class-track XP. The first reading
  also learns that class card without equipping it. Books for an already known
  class can still be bought and read for XP and bonus rewards.
- Each successful reading makes independent rolls for one combat technique
  card and one feat. Both can succeed, either can succeed, or neither can.
  The per-book authored defaults are `combatCardChance: 25` and `featChance: 5`,
  percentages configurable from 0 through 100 in Advanced Shops settings.
- A technique is drawn from the named class's authored card pool, subject to
  the class track's existing rarity unlocks before reading (at least common).
  Equipment-only and internal cards are excluded. Copy limits send excess
  ordinary cards to the sideboard. A feat is drawn from the existing global
  feat catalog, following its existing repeatable stacking rules.
- Reading is one atomic confirmed transaction. XP, initial class learning,
  bonus rewards, one consumed copy and the reading revision commit together.
  Opening, cancelling, invalid choices and stale/replayed confirmations award
  nothing and cannot advance the reward outcome. Reopening or reloading the
  same saved run cannot reroll it. Rolls are derived from the run seed and
  committed reading revision, isolated from combat and shop random streams.
- The reading UI shows the actual configured odds before confirmation and
  reveals awarded techniques and feats afterward. Existing books without
  the new fields keep a zero bonus chance, preserving frozen run snapshots.
- Existing class equip/unequip, progress retention and classless rules stay
  as stated in SPEC §14.3. Learning does not require or change active class.
