# Owner backlog

Owner-requested changes. Tracker only: nothing here is implemented by the tracking session; the managing session runs build/review/merge.

## #1 Remove the selected HUD
- Status: in progress
- Asked: 2026-11-07 — "remove the selected HUD"
- Means: Enemies stop opening the larger selected/target panel; every combatant keeps the overhead mini HUD; targeting, floor tint and tap-to-inspect stay.
- Questions: none
- Link: branch feature/NoSelectedHud

## #2 Keep the current HUD
- Status: done
- Asked: 2026-11-07 — "the current hud is fine"
- Means: Keep today's mini HUD layout (intent above, Block square left of the HP bar when Block > 0, HP number where it is now). The earlier "HP number inside the bar" idea was cancelled.
- Questions: none
- Link: —

## #3 Delete stale GitHub branches
- Status: pending
- Asked: 2026-11-07 — "yes" (owner approved deleting alternative/dev, alternative/release, alternative/test, tools-archive)
- Means: Remove those four branches from the repo. The managing session's GitHub access was refused; the owner deletes them at github.com/cehinds/AshenSpire/branches.
- Questions: none
- Link: —

## #4 All statuses as badges in one row with Precision
- Status: pending
- Asked: 2026-11-07 — "Id like all status's to be batches like automatic sweeP"; clarified: "no: I mean in the same row as precision and status effects since those buffs are status effects just buff status effects"
- Means: Every status effect on a combatant, buffs included (e.g. the clock/speed-lines one), renders as the same small round count badge in one shared row with Precision (the crosshair badge), not scattered in different styles/places. ("Automatic Sweep" in the first ask was Precision.)
- Questions: none
- Link: —

## #5 Enemy Block to the left of the health bar
- Status: pending
- Asked: 2026-11-07 — "move the block to the left of the health bar for enemies" (screenshot: Block shield "7" sits below-left of the bar, under its left end; red box marks the spot at the bar's left end)
- Means: On enemy mini HUDs, the Block badge moves from under the bar to directly left of the HP bar, in line with it. Player HUD and the rest of the layout (#2) stay.
- Questions: none
- Link: —

## #6 Status row under the health bar
- Status: pending
- Asked: 2026-11-07 — "also, I want the precisiuon to be under the health" (screenshot: red box directly under the HP bar)
- Means: The Precision + status badge row (#4) sits directly under the HP bar, instead of left of it/below-left. Pairs with #5 (enemy Block left of the bar).
- Questions: none
- Link: —

## #7 Magic damage becomes plain damage; spells default to Reach
- Status: pending
- Asked: 2026-11-07 — "I'd like to change magic damage to just deal damage but are reach spells by default, with the school having it's unique status effect."
- Means: Drop "magic" as a separate damage type: spell damage is just damage. Spells have Reach (ranged) by default. Each spell school gets its own unique status effect instead.
- Answers 2026-11-07: school statuses — "check what's already in the code base" (existing damage riders in SPEC.md are the starting point: Fire→Burn, Lightning→Weak/Sap (+Shocked), Force→strip Ward, Holy→cleanse, Poison→Venom, Psychic→Confused, Earth→Slowed, Necrotic→Necrotic Blight; Frost/Alteration have none listed). Existing magic-damage resists/bonuses become normal damage ones.
- Questions: none
- Link: —
- Answers 2026-11-07 (Frost/Alteration): Frost applies Chilled, and Chilled escalates to Frozen (as in Divinity: Original Sin 2 environmental statuses); a Damp target's Chilled advances to Frozen automatically. Alteration acts like D&D abjuration and transmutation: protective/warding and transforming effects, not a damage-rider status.

## #8 Status saving throws (DC vs will/fortitude/reflex), spell and martial
- Status: pending
- Asked: 2026-11-07 — "I'd also like for enemies to roll for saving against status effects. On the card show the Difficulty Class which will not be set to 10 + int + wis + spell rank + other for example most cantrips will probably be: 10 + 1 + 1 + 0; so DC 12. the target will need to roll a 1d20 + resistance type. for now I want 3 resistance types: will, fortitutde, reflex. will: wis + int; fortitutde: con + poise; reflex: dex + evasion. the other category will probably come from other tags associated with the card, and the card's spell school. I also want that if the character is already suffering from a status effect, they roll with disadvantage. can you improve this, as well as make suggestions as to which spell school should target which resistance. I also want there to be martial status effects too with DCs and resistance type"
- Means: Status-applying cards show a DC and the target rolls 1d20 + a save (Will / Fortitude / Reflex) against it; fail = status applies. Spell DC = 10 + caster INT + WIS + card rank + other (card tags/school). Martial status cards get a DC and save type too. Target already holding a status rolls at disadvantage. (Note: SPEC §Damp already has a "shock contest" with advantage; the new save system must reconcile with it.)
- Proposed refinements (for owner approval):
  - DC: keep your formula; use ability *modifiers* (not raw scores) if stats are scores; "other" = card/tag/school bonuses, no cap (owner 2026-11-07: "no cap to other"). Martial DC = 10 + STR or DEX mod + weapon tier/card rank + other.
  - Saves: Will = WIS+INT, Fortitude = CON+poise, Reflex = DEX+evasion (as asked). Nat 20 always saves, nat 1 always fails.
  - Disadvantage: only if the target already has a *different* status of the same save type; stacking the same status uses the existing stack rules, no save needed to add stacks.
  - Result tiers: fail = full status; save = no status (cantrips/small statuses) or half duration/stacks (bigger spells). Pick one rule per rank.
  - Boss/elite tuning: enemies get Will/Fort/Reflex values in their data row; bosses get advantage vs their weakest-to-hit save or a flat +bonus.
  - Card UI: "DC 12 · Will" next to the status; target panel shows its three saves.
  - Suggested school → save: frost → Fortitude (slow/chill); fire → Reflex (Burn, dodge the flame); lightning → Reflex (shock/stun); force → Fortitude (knock-back/stagger); earth → Fortitude (root/crush); decay → Fortitude (poison/wither); illusion → Will; divine → Will (fear/smite/sanctify); alteration → Will for mind-shape, Fortitude for body-shape (card-level override).
  - Martial: Smash/stagger/bleed/knockdown → Fortitude; Sweep/trip/net/entangle/disarm → Reflex; Intimidate/taunt/shout/feint → Will.
- Update 2026-11-07 — "per haps I should make the resistance be related to the card huh?": the save type (Will/Fortitude/Reflex) is authored per card, not fixed by school. School becomes only the default/suggested value (table above) when a card sets none.
- Owner answers 2026-11-07:
  - Save result: most statuses negate on a save; some cards halve, or negate only some of their effects. A card can inflict several statuses, each with its own save (think D&D).
  - Stats: use the stat values as-is (stats are already modifiers, small numbers). Problem to fix: enemy levels are far too high (see #9).
  - Damp: no caster advantage; the *target* rolls its save at disadvantage while Damp (replaces the Damp "shock contest" idea).
  - Save not required on every card: some cards just deal damage. Spell attack/hit = 10 + max(INT, WIS); damage = base damage + max(INT, WIS) + 1d4 × rank. Status DC (new formula, supersedes the earlier one) = 10 + max(INT, WIS) + rank + level.
- Answers 2026-11-07: "level" = spell caster class level. Damp's disadvantage = Reflex saves against cards with the lightning tag only.
- Questions: none
- Link: —

## #9 Enemy levels 1-5 with the player's stat budget
- Status: pending
- Asked: 2026-11-07 — "the problem is that enemies levels are way too high and need to be reduced to 1 throuh 5 level with reasonable stats per level. if a player starts with 8 points (1 in each stat, and 3 other points applied in other stats, the enemies shoudl follow that rule too"
- Means: Rescale all enemy levels to 1-5. Enemy stats follow the player's budget: 1 in each of 5 stats + 3 free points at level 1 (8 total), growing by the player's per-level rule, so saves/DCs (#8) stay sane.
- Answers 2026-11-07: points per level = same as the player's rule; enemies carry the player's stat list.
- Questions: none
- Link: —

## #10 Keep Poise (decision)
- Status: done
- Asked: 2026-11-07 — "ok, lets keep poise"
- Means: No change. Poise stays as the single break meter, behind Ward/Barrier and the Fortitude save (CON + Poise, #8). No Ward/Barrier merge requested.
- Questions: none
- Link: —

## #11 Poise bar always visible, fixed-width HUD
- Status: pending
- Asked: 2026-11-07 — "just keep the poise visible at all times but make it have the height of the health bar. also, I'd liek the health bar with the badges to be a fixed width instead of dynamically changing."
- Means: Poise bar is always shown (no hiding, no badge shifting), the same height as the HP bar, under it (layout with #5 Block left of the bar, #6 badges under). The HP bar plus its badge row has one fixed width on every combatant instead of resizing with content.
- Update 2026-11-07 — "have poise bar and hp be the same width, and stays fixed even if there is no block also I want the block icon to be larger to fit the height of the hp, poise, and status effect badges rows": HP and Poise bars share one width, fixed whether or not Block is present (Block's slot is reserved when Block is 0). The Block icon grows to span the full height of the HP, Poise and badge rows stacked (placed left of the bars, #5).
- Answer 2026-11-07: "it applies to every one" — one fixed width for every combatant, player and enemies.
- Questions: none
- Link: —
- Layout confirmed 2026-11-07 ("ok but don't strech it out"): Block icon (tall, left) | HP bar / Poise bar / badge row stacked, HP number right of the HP bar. Keep it compact: fixed width roughly today's bar width, thin rows, no stretching of the HUD (Block icon scales to the stack height, not the other way round). Covers #4, #5, #6, #11.

- Update 2026-11-07 — "keep the number inside the shield too": the Block value stays printed inside the (now larger) Block shield icon.
