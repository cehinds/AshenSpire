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
