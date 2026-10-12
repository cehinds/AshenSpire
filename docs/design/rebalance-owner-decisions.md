# Owner decisions — feature/RebalanceCardsAddCards (2026-10-12)

Recorded by the managing session so any machine or model can continue the work.
Detail and rationale: `docs/design/elements-and-tag-mechanics.md`.

1. An Insanity break applies the `staggered` status (every Stagger goes through `breakEnemy`).
2. Poison becomes a real damage type (`damage:poison`), with cards.
3. Element/status names follow TagRefactor (Frost not Cold, burned not burn, blighted not crimsonBlight); shipped ids are renamed with a save migration.
4. Only Blight applied by Necrotic damage lasts the whole fight (`necroticBlight`); all other Crimson Blight keeps 3 turns. The version-1 matchup table stays unchanged (old saves).
5. Add both Psychic and Earth elements.
6. A few enemies (~10–15%) resist elements.
7. Tag model imported as gameplay tables only (no 11.6 MB presentation inventory).
8. Tag tables drive game numbers: later, not in this work.
9. Combat Rounds preview ported now as its own track (PR #1888).
10. Feint applies Prepare at every rank.
11. oath / precision / gorefire get mechanics:
    - Oath: +2 Block per Oath card while no stance has been entered **this fight**.
    - Precision: attacks bypass part of the target's Block.
    - Gorefire: attacks apply Burned on HP loss. Gorefire Slash gains Burned 1 **always**, after a sim check.
    - Cards carrying precision/gorefire that never hit (Nock and Wait, Execution Window, Enter Gorefire) are **retagged**.
12. Exposure (taggedVulnerability) bonus rounds up.
13. Psychic/Earth cards belong to no class: any class can learn them; Herald and Starseer meet them more often (higher offer weight, and a chance one is a starting spell).
14. Poison immunity: constructs halve its build-up; undead take it normally.
15. Silenced exists: add the `spellDamageDealtMult` modifier.
16. Weapon attack cards get a fixed `damage:*` tag (owner override of the weapon-derived reading in SPEC §4.7; SPEC to be updated).
17. Codex P2 findings on the unwired Combat Rounds preview (PR #1888) after `8086a5a` are answered and deferred to the wiring phase, not chased in the port.
18. The fixed weapon `damage:*` tags apply to old (v1) saved runs as well as new (v2) runs.
19. Weapon damage-type rules (owner, 2026-10-12, answering Codex on #1900):
    - `strike`, `cheapShot`, `bloodhuntersStrike`, `guardCounter` deal the **equipped weapon's** damage type (no fixed tag).
    - Weapon families: blades deal Slashing and/or Piercing; blunt weapons deal Blunt and/or Force; projectiles (throwing daggers, bows, javelins — only bows exist today) deal Piercing.
    - `ruinousBlow`, `deathblow`: Blunt and/or Force.
    - `bloodTithe`: Slashing or Piercing, following the equipped blade.
    - Untagged weapon cards must resolve to the weapon family's type in v1 and v2 (today v2 falls back to Blunt).
20. PR #1901 (link self-test fix) approved to merge once CI is green.
21. The four Rogue poison cards (Asp Dart, Viper Strike, Septic Blade, Lethal Dose) stay in the classic (v1) card pools as well as v2 (already so; no code change).
22. Lethal Dose becomes a thrown vial — "thrown but reach instead of ranged": `delivery:projectile` and `reach:near` (the reach other thrown or near cards use), keeping `maneuver:attack` (never `maneuver:ranged`); in v2 the overlay sets Reach and the projectile flag.
23. Ruinous Blow and Deathblow deal Blunt + Force (`damage:arcane`) split 60:40 and 40:60. The pairing is the orchestrator's reversible assignment: Ruinous Blow 60 Blunt / 40 Force (the heavy blow leans physical), Deathblow 40 Blunt / 60 Force, authored as `attack.components`. In v1 and v2 a mixed hit is labelled by its heavier part, carries every part's rider, and (v2) meets each type's resist or weakness with that part's share.
24. Blood Tithe with a piercing non-blade (spiked shield, bow): "piercing + necrotic and bleed status effect". Its damage is a weapon half plus a Necrotic (`damage:decay`) half, split 50/50 (an assumption): a blade keeps its slashing or piercing, a piercing non-blade gives piercing, any other piece or bare hands give slashing. It applies 2 Bleed on hit (3 upgraded; v2 projects 8 / 12 Bleed build-up), after its double-Bleed payoff reads the target.
