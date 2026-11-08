# SPEC history — shared armor sets, opening presentation (World Journey and legacy dungeons removed)

## Removed as obsolete
- "World Journey: authored atlas and seeded routes" and "Legacy dungeon integration" were deleted from SPEC.md (owner addition B, 2026-11-07). `src/model/state.js:1108-1109` rejects `run.legacyDungeon` ("legacy dungeons are no longer supported") and `run.journey` ("World Journey runs are no longer supported"). The old text is in git history (SPEC.md at 356fe2e0).

## Shared armor sets
- Equip threshold was 12 before the §13.4m lean rebase; now 3.
- Bonuses are initial values, not balance-tested.
