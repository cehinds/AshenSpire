# SPEC history — §4 Combat rules

Archive of dates, rationale, provenance and superseded designs moved out of SPEC.md §4 when it was made concise. Nothing here is a current rule.

## 4 (intro)

- Reward-card cost tuning (2026-09-19). Class-specific rarity weights, Chaos Rewards and skill rarity unlocks: unchanged rule, now in SPEC.
- Pools between fights (2026-09-24, plan A2): Stamina refills to max at fight start; `"carry"` "keeps the old rule, but it has no effect on the Stamina a fight opens with". Mana refill at fight end is owner 2026-10-31 and supersedes plan A2 for Mana; `"carry"` restores the 2026-09-24 rule.
- Recovery (2026-09-27, owner; cleanup 3i-A): the in-combat recovery rules (per turn, after unused turns, every N rounds) and the Advanced → Recovery tab were removed with the Combat Rounds Preview. The prototype foundation ruleset that kept its own recovery rules was removed too (#2633).

## 4.1 Turn loop

- Configurable hand rules (2026-09-19; counts are stat rows since ruleset 7). Default hand rule: owner 2026-10-03.
- "A held hand never starves the discard of its reshuffle" is the rationale for the whole-discard-joins-the-shuffle rule.

## 4.1a Ward and Barrier statuses (owner, 2026-11-01)

- They replace the old numeric Barrier absorption pool; "every point of it is now one Barrier stack (owner, 2026-11-01)". "No second loop" for Ward decay.
- Saves: the old numeric barrier "was a one-turn overflow layer, so nothing carries into the new rules."

## 4.2 Damage math
- Owner D16 (2026-10-18) set Vulnerable ×1.25. Core 2 amendment note dated 2026-10-31.

## 4.3 Card rules
- Smithing: "the shipped tier cap is 1 ... **Owner ruling, 2026-10-28 (Core): armaments can be leveled up 3 times.**" Tier-access ask 2026-10-31. Zero-cost cards and ramp: owner 2026-10-31.

## 4.3a Action costs
- Formula shape is the owner's; Mana-side rank, Ethereal and stacks added 2026-10-12; restores break even 2026-10-13. "Replaced rule (2026-10-12): the restore was subtracted from the price, so these cards netted Mana."
- P was raised from 6 to 8 "because at 6 the rank 1–3 spell and rank 1–2 targets miss 80%". Shipped tunables calibrated 2026-10-12.
- Smashes and sweeps quotes (owner 2026-10-13): "Some higher rank ones could cost 1 sp? But basic ones are 2sp"; "Be sure to add poise and base damage to account for the higher cost for smashes and AoE for sweeps but normal damage"; "All smashes deal poise damage".

## 4.4 Status effects
- Threshold-proc statuses: #61, Constantine's direction 2026-08-06; supersedes the earlier Bleed row; the old carry-and-escalate ×1.5 is gone.
- "The numbers are deliberately NOT restated": Bleed's threshold was picked against the sim after the section was first written, and the prose said 12 while the shipped row said 7 until a pass caught it. "A restated provisional value is a cache guaranteed to rot; §6 already refuses to restate its samples."
- Crimson Blight was "Scarlet Rot" pre-scrub; Venom was renamed from Poisoned by the TagRefactor.
- Frostbite row: "CUT — describes nothing." Falsify: `node -e "import('./src/content/statuses.js').then(m=>console.log(m.statuses.some(s=>s.id==='frostbite')))"` → `false`.
- Poise/Stagger: the ratings-meter variant of the break rule is retired (#2633). Madness: "Risk/reward, mostly enemy-inflicted." Insanity vs Madness: "two words, two mechanics, on purpose."

## 4.6b Enemy intent commitment
- Owner report: "Intent does not consistently show what the enemy is going to do and often changes their choice. Also, if the enemy would lose sp reacting then the other actions they have queued should be removed."
- C owner quote (2026-11-02): "YES - reaction SP carries over: the SP an enemy spends reacting during the player's turn comes out of its next turn, and queued moves it can no longer afford are dropped and shown".

## 4.6a Enemy SP pool
- Quotes: "enemies are essentially characters with cards, at about 2 SP" (2026-10-13); "blight lowers INT, WIS and DEX and raises STR and CON" (2026-10-13); "if a character attacks, and still has sp have the remaining actions be ? if the character fails the perception check" (2026-10-18); "move teh damage to the left of the stance icon and the damage about 2 times larger than before; and have the percent's to hit cetnered on their sprite with a black outline and white font color and about 2x larger" (2026-10-18); "should be harder about 50 to 75 normies, 25 to 50 elites, 10 to 25 for bosses" (2026-10-13).
- Boss band: the class spread at the Bell Keeper and Thorn Matriarch is wider than 15 points, and boss SP moves every class together; accepted by the owner 2026-10-13.

## 4.6 / 4.9 removals
- The old Advanced → Combat toggles, Momentum and the Combat Rounds Preview were removed in cleanup 3i-A.

## 4.7 Tagged combat cards and readable enemy stances
- Intent concealment: "Design assumption resolving the incomplete user sentence 'base 70% chance to be': 70% chance to conceal the exact selected action, not 70% hit chance."
- Weaknesses in Core: the paragraph appeared twice in SPEC; the second copy ended "The combat log, a `weaknessTriggered` event, the 'Weak!' callout, the inspector's traits, the bestiary and two HUD chips show them", which predates the Discovery rule (owner 2026-11-01) that keeps undiscovered weaknesses hidden and the title-screen bestiary empty.
- "Out of scope for this contract" and the future-expansion pointer: moved here as rationale; the links remain in SPEC.

## 4.8 / 4.9 / 4.10
- Owner authorized the complete revised combat expansion for implementation on 2026-10-07. "This specification precedes the implementation" (card traits). Enemy-knowledge contract: "lands before its runtime implementation".
- 4.10: owner's 2026-10-08 reaction-contract revision. The reaction system has shipped.
