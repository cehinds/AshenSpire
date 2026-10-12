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
