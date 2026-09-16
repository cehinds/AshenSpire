# Roster pressure and legacy continuation evidence

This is an incoming-damage heuristic, **not win rates or a balance certification**. Actual engine dispatch, 24 deterministic seeds (1–24), 12 turns per condition. Player has no cards, offense or consumables; HP resets to 100 before each turn. Conditions are zero Block at full enemy HP, 10 Block each turn at full HP, and zero Block after placing the enemy at 30% HP and checking phases. Existing status buildup persists.

The probe excludes player attacks, Poise interruptions, Dodge, deck growth, potion and weapon-art decisions, healing races and time to kill. Defensive status resistance and direct move/status effects use the real engine.

| Boss | HP | Base loss/turn | With 10 Block | Phase before | Phase after | Phase max hit/turn |
|---|---:|---:|---:|---:|---:|---:|
| fellWarden | 120 | 7.99 | 0.75 | 12.26 | 12.26 | 20 |
| bellKeeper | 116 | 7.78 | 2.28 | 7.33 | 9.08 | 19 |
| thornMatriarch | 110 | 7.05 | 1.74 | 6.67 | 9.48 | 32 |
| stitchedKing | 195 | 14.75 | 7.7 | 26.83 | 26.83 | 78 |
| glassRegent | 180 | 11.17 | 4.26 | 10.39 | 19.8 | 55 |
| marrowOrganist | 190 | 12.26 | 7.44 | 9.71 | 18.91 | 42 |
| blightedValkyrie | 250 | 16.32 | 8.64 | 27.87 | 27.87 | 53 |
| furnaceSaint | 260 | 15 | 9.27 | 11.8 | 19.58 | 40 |
| hollowAstronomer | 225 | 17.04 | 11.59 | 11.78 | 19.88 | 32 |
| ashheartDragon | 245 | 14.04 | 8.56 | 8.98 | 19.45 | 56 |

HP and phase thresholds remain unchanged. All seven bosses retain their previous charge delays, charging Block and move weights. Dragon gains 2 Strength in its existing 60% phase. The adjusted alternatives reach approximately 70–77% of their original act boss phase pressure. Glass reaches a 55-damage delayed attack versus King’s observed 78 maximum; Dragon’s delayed maximum is 56 versus Valkyrie’s 53. Thorn reaches 32 versus Warden’s 20 because Bleed adds Block-bypassing proc damage; its root attack is delayed, but buildup must be managed rather than treated as ordinary Block damage. This probe does not prove that every high-damage turn is avoidable.

## Legacy save continuation

Baseline 60300dd47c72daa36ecfea4edcdb576c82341e9f: all 19 original enemy definitions are deeply equal. For each, create a combat under the original registry, commit one turn, serialize through JSON, restore with the expanded registry without consuming RNG, then compare eight further exact combat snapshots. All 19 passed. This covers already-entered combat; unentered legacy map boss assignment belongs to the route tests.

## Reproduce

Run from `work/roster`; the script also resolves its checkout from its own path.

```powershell
node ../../outputs/roster-balance-probe.mjs 60300dd47c72daa36ecfea4edcdb576c82341e9f
node tests/expandedRoster.test.mjs
```

The probe writes this report. Expanded-roster tests passed 5/5 after the approved adjustments, including all 46 move payloads, delay resolution, once-only phase unlocks, seeded plans and live pool reachability.
