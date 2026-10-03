# Turn Stamina — October 3, 2026

Stamina replaces the separate action budget. New characters have a base of 3
Stamina for every class, plus independently floored contributions from DEX
(0.25), CON (0.25), WIS (0.2), INT (0.2), and each level after the first (0.1).
It refills at the beginning of each player turn;
unspent points and temporary gains do not carry into the next turn. Existing
turn-start bonuses and stagger penalties still apply. Mana remains separate.

Cards use their former action price as their Stamina price; the former
additional Stamina charge is removed from authored cards and upgrades. X
spends the remaining turn budget. Dodge retains its weight-priced Stamina
cost (1 Light, 1 Medium, 2 Heavy) with no additional action charge.

The top vitals bar shows HP and MP. The combat footer and shared card renderer
use the former action diamond in green for Stamina. Card text, relic text,
cost tooltips, smithing labels and co-op affordability use the new vocabulary.
The former Actions settings and idle-Stamina recovery settings are retired
from the visible editor; their keys remain readable for imported settings.

## Compatibility

`cost`, `cost.action`, `gainEnergy`, `energySpent`, and related identifiers
remain compatibility names. On a live combat player, `energy` and `energyMax`
are accessors into `stamina` and `maxStamina`, so there is one mutable pool.
Snapshot restoration and transactional combat clones reinstall those
accessors. Both engines debit that pool once. Stamina card-upgrade tags modify
the same cost as legacy action tags.

Existing runs retain their snapshotted stat maxima. The base-3 default applies
to new runs. A resumed old combat carries its remaining action budget into
Stamina. Temporary overflow survives an exact combat save; the outer run's
persistent pool remains capped for save validation.

## Validation

- 158 focused Node tests passed across turn-Stamina, framework, card costs,
  derived stats, saved combat, co-op foundations, configuration and recovery.
- 6 additional movement and smithing tests passed.
- Content, framework-data and UI-config generation checks passed.
- Desktop browser: HP/MP-only top bar, green card diamonds; playing Strike
  moved Stamina 3 → 2; End Turn returned it to 3.
- Mobile browser at 390 × 844: inspected the HP/MP bar, card cost rails and
  green Stamina counter. No captured JavaScript errors on either inspection.
- Screenshots are local at `.codex/stamina-evidence/desktop.jpg` and
  `.codex/stamina-evidence/mobile.jpg`.

The broad repository test run was interrupted and is not a full-suite pass.
The checkout has no fetched art pack, so browser evidence uses fallback art.
No packaged release, CI run, promotion or publication was performed.
