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
