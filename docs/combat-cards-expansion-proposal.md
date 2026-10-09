# Combat cards and Ashen Blight

Read the enemy's stance, choose a response, and build openings through protection, control, positioning, and card sequencing.

- **Implementation and playtesting**
  - The accepted combat rules now have a version-2 runtime implementation, introduced in [#1723](https://github.com/cehinds/AshenSpire/pull/1723).
  - New runs use the expanded rules. Existing runs keep the rules saved with their run.
  - Values labelled Suggested are configurable starting values for playtesting.
  - [The implementation contract](combat-expansion-contract.md) records the final ownership, Counter charge, rounding, recovery, Power lifecycle, and compatibility rules. It takes precedence over earlier proposal wording below.
  - The Reaver example defines the authored Counter reply: fully absorb the eligible action, then return the damage and Poise printed on the card.
  - [Enemy knowledge](enemy-knowledge-contract.md) records the separately coordinated hidden-intent, Perception, and bestiary expansion.

## Camps and combat identities

- **Physical (Martial)**
  - Physical attacks normally scale with AR.
  - Block absorbs their direct damage.
  - Poise resists their impact and Martial status pressure.

- **Magical (Spell)**
  - Magical attacks normally scale with PR.
  - Persistent Ward reduces their direct damage and resists Spell status pressure.
  - Temporary Barrier can absorb remaining magical damage.

- **Separate card properties**
  - Camp: Physical (Martial) or Magical (Spell).
  - Stance: the combat posture the card triggers.
  - School: Frost, Fire, Lightning, Force, Alteration, Illusion, Divine, or Decay.
  - Damage type: Blunt, Piercing, Slashing, Cold, Fire, Holy, Necrotic, or a retained legacy type.
  - Reach: Contact, Near, or Far.
  - Targeting: Single or Area.
  - Traits: Evade, Unreflectable, Grounded, Interrupt, or another explicitly listed effect.
  - A Force spell can deal Blunt damage and still use PR and magical defenses.
  - A Lightning spell can deal Piercing damage and still apply magical Paralysis.

- **Support and deck card types**
  - **Power:** play a paid card once, Exhaust that instance, and keep its buff for the combat unless an effect explicitly removes it.
  - **Skill:** reusable buffs, protection, recovery, or deck manipulation; normally Discard after use. A printed Exhaust or Retain rule still applies.
  - **Status:** usually a harmful card added to the deck. Its text states whether it can be played and how it is removed.
  - These types appear at the bottom of support and deck cards. Offensive and maneuver cards show their action type there.
  - Deck Status cards are separate from active status gauges and the recovery controls shown while incapacitated.
  - Each owned Power copy or legal Replica has its own paid cast; copying an effect does not count as a new card play.

- **One active stance**
  - Attack, Defend, Counter, Sweep, Ranged, Smash, or Casting.
  - The last stance-triggering effect replaces the previous stance.
  - It persists until replaced unless its card gives an expiry.
  - Support cards preserve the current stance unless explicitly stated otherwise.
  - Buffs and equipment traits may coexist, but cannot secretly provide another stance.
  - Retaining a stance does not automatically rearm Counter or refill protection.

- **Shared player and enemy rules**
  - Enemies use the same camps, stances, reach, targeting, and damage tags.
  - Enemy clues follow the active intent-visibility rules. When details are revealed, show the permitted stance or action, printed damage, and special effects; keep hidden details out of previews. The enemy-knowledge contract defines the separately coordinated unknown and broad clues.
  - Equipment, weaknesses, protection, and resistance are inspectable.
  - Every class should start with at least one Attack, Smash, and Counter.
  - Strike is Attack; Defend is Defend; Stomp is Smash; Quick Step or Dodge is Counter.
  - Preserve the current enemy-intent visibility contract; the earlier unfinished 70% suggestion does not introduce an extra hit roll or change move weighting here.

## Stances and their answers

- **Attack**
  - Fast pressure that punishes Smash preparation.
  - Suggested advantage: +25% damage against Smash.
  - Selected cards add interrupt, Sap, or printed Poise damage.
  - Defend and Counter answer it.

- **Defend**
  - Gain the card's printed protection when played.
  - Suggested passive: gain 1 + DR protection once at the owner's turn start while still in Defend.
  - Martial Defend grants Block; Spell Defend grants temporary Barrier.
  - The passive does not restore persistent Ward.
  - Changing stance before the turn-start check prevents that grant.
  - Do not trigger it repeatedly by entering Defend several times in one turn.
  - Suggested Sweep reduction: 25%.
  - Smash, penetration, and protection suppression answer it.

- **Counter**
  - Eligible Attack and Smash damage becomes ceil(damage × 0.5).
  - Gain the card's printed Block, Barrier, or other listed protection.
  - The card specifies what it catches: camp, school when relevant, reach, Single or Area, and eligible effects.
  - Most Counters catch Single attacks; Area requires an explicitly printed Ranged Area Counter.
  - The card specifies its return: Poise damage, Ward damage, HP damage, or a combination.
  - Most Counter cards should emphasize impact; HP returns are explicitly printed.
  - Sweep, Lightning, and Unreflectable effects answer its reaction.
  - Switching stance cancels its prepared Counter reaction.

- **Sweep or Windmill**
  - An Area technique that bypasses ordinary Counter reactions.
  - Clears Decoys and pressures groups.
  - Selected cards Push, expose concealment, or clear summons.
  - Defend and distance-based avoidance answer it.

- **Ranged**
  - Supports Near or Far delivery and distance-based avoidance.
  - Suggested distance chances are listed under Reach and area tags.
  - Ranged Counters, Spell Counters, Alteration interception, Closing, and Reach attacks answer it.

- **Smash**
  - Heavy commitment that breaks defensive posture.
  - Suggested bonus: +50% damage against Defend stance.
  - Holding Block in Counter does not activate this bonus.
  - Breaking Block can add printed Poise damage.
  - Attack and Counter punish it.
  - Spell Smash cards explicitly list their Barrier-breaking or Ward-damaging effects.

- **Casting**
  - Prepares a spell or maintains an ongoing effect.
  - Disruption and explicitly interrupting attacks answer it.
  - Protection, grounding, or counter magic can create a safe casting window.

## Evade roll

- **What Evade does**
  - Prepare one chance to avoid the next eligible direct damaging action.
  - It does not prevent status applications, buildup, existing status ticks, or run corruption.
  - Successful avoidance is narrower than full Invulnerability.
  - Suggested expiry: the owner's next turn start if unused.

- **Roll formula**
  - Evade total = d20 + DEX + floor(WIS / 5) + floor(INT / 10) + Evade bonuses − armor penalty.
  - Light armor penalty: 1.
  - Medium armor penalty: 2.
  - Heavy armor penalty: 3.
  - DC = 8 + incoming damage after stance matchup + attack difficulty bonuses.
  - The total must be strictly higher than DC; ties fail.
  - There is no automatic natural-20 success unless a card explicitly grants it.

- **Resolution timing**
  - Prepare Evade when its card is played.
  - Show an Evade Ready status icon.
  - Roll silently immediately before the incoming action resolves, using the final stance matchup.
  - On success, show an Avoided icon and cancel that action's direct damage.
  - Resolve its independent status effects normally.
  - On failure, resolve Block, Ward, Barrier, and HP damage normally.
  - One charge checks one complete action, including its multiple hits.
  - Suggested limit: one card-based Evade attempt per incoming action; extra charges wait for another action.

- **Counter interaction**
  - An avoided attack has not been fully absorbed by protection.
  - Successful Evade does not automatically trigger Counter.
  - An Evasive Riposte feat or card may explicitly allow that combination.
  - Failed Evade can still lead to a Counter if protection completely stops the eligible attack.

- **Probability and readability**
  - Display the estimated success chance in the card inspection or intent preview.
  - High damage can make the roll impossible; do not secretly force a minimum chance.
  - Lowering damage through the correct stance also lowers the Evade DC.
  - Damage already included in an enemy intent is not added again as AR or PR.

## Reach and area tags

- **Suggested reach names**
  - Contact: the former melee range.
  - Near: the former ranged tier.
  - Far: the former ranged+ tier.
  - Reach describes delivery; it does not create another active stance.

- **Targeting**
  - Single: one selected target.
  - Area: multiple targets or a defined zone.
  - Contact + Area: Sweep.
  - Near + Area: Burst.
  - Far + Area: Barrage.
  - Area targeting bypasses ordinary Single Counters, even if only one target is caught.
  - A Burst or Barrage is not automatically a Windmill; its other stance effects are separately printed.
  - A multi-hit Single attack remains Single, rather than becoming Area.

- **Suggested distance avoidance**
  - While a Ranged stance prepares Near positioning: 20% base chance to avoid an eligible incoming contact attack.
  - While it prepares Far positioning: 35% base chance.
  - Base distance chance cannot exceed 50%.
  - Card and equipment bonuses are shown separately.
  - Incoming Near/Far attacks do not suffer contact-distance avoidance unless explicitly stated.
  - Closing or adequate Reach can defeat this distance advantage.

- **Combining distance and Evade**
  - A distance success supplies one attack-bound Avoidance charge and immediately uses it.
  - If distance fails, an independently prepared Evade charge can attempt its d20 check.
  - A distance success does not also spend the card-based Evade charge.
  - Never award two damage cancellations for the same action.
  - Suggested combined chance: distance chance + (1 − distance chance) × Evade chance.
  - Example: 20% distance and 15% Evade gives 32% combined avoidance.
  - The 50% cap applies to the base distance chance, not this combined result.

- **Area attacks**
  - Each affected target resolves its own defenses.
  - Area attacks can be evaded unless tagged Unavoidable.
  - Suggested difficulty modifiers: +2 for Burst and +4 for Barrage; tune these by card.
  - Status clouds still apply their status pressure even when their direct damage is avoided.

## Persistent Ward and recovering Poise

- **Ward at battle start**
  - Start with the character's base Ward plus equipped Ward bonuses.
  - Suggested readable damage rule: reduce each magical action's direct damage by remaining Ward, to a minimum of 0.
  - Share that reduction across the action's hits; do not apply it again to every projectile.
  - Direct damage does not also spend Ward.
  - Ward is spent by explicit Ward damage and resisted magical status pressure.
  - Turns and stance changes never refill it.
  - A new battle restores starting Ward.
  - An explicit restoration card can restore Ward within its stated cap.

- **Ward status protection**
  - Keep each ailment's ordinary buildup gauge.
  - One completed magical gauge fill represents one stack-equivalent of status pressure.
  - While Ward is active, that pressure reduces Ward by 1.
  - Suggested limit: one gauge-derived Ward point spent per action per ailment; keep overflow for a later application.
  - Explicit Ward damage is a separate printed amount and can spend more.
  - If Ward remains above 0, the resulting ailment stack is blocked.
  - Suggested threshold-first interpretation: the pressure that reaches Ward 0 breaks Ward and applies its triggering ailment stack.
  - After the break, further gauge fills apply statuses normally.
  - Different magical ailments share the same Ward reserve.
  - Do not erase other ailments' partial buildup when Ward breaks.

- **Ward example with armor +3**
  - Assume no other Ward bonus: begin at Ward 3.
  - First completed magical status gauge: Ward becomes 2; no active ailment stack.
  - Second completed gauge: Ward becomes 1; no active ailment stack.
  - Third completed gauge: Ward becomes 0; the triggering ailment applies.
  - Ward stays broken for the rest of combat unless an explicit card restores it.
  - This is three full stack-equivalents, not three percentage points added to a gauge.

- **Magical ailments**
  - Normally Burn, Frost, Crimson Rot, Paralysis, Sleep, and other explicitly magical effects.
  - A source can override this category on its printed payload.
  - Restoring Ward does not cleanse an already-active ailment.

- **Poise**
  - Resists Martial impact and Martial status pressure.
  - Normally covers Bleed, Martial Dazed, Weak, Vulnerable, and Off Balance.
  - Once a gated Dazed stack is admitted, it uses the recovery-card rules below.
  - Suggested equivalent: a completed Martial gauge fill adds one Poise strain instead of immediately applying its stack.
  - At a Poise break, admit the triggering status, resolve printed Stagger, and reset Poise strain.
  - Suggested Stability prevents repeated action denial on consecutive turns.
  - Poise can recover and break again; broken Ward does not automatically reset.
  - Determine the resistance from the payload's Martial or Spell source, not the damage name alone.

- **Temporary protection**
  - Block absorbs Martial damage and normally clears at the owner's next turn start.
  - Barrier absorbs magical damage and uses its printed duration.
  - Retire Ward Barrier as the temporary shield's display name to avoid confusing it with persistent Ward.
  - A Spell Counter can grant Barrier without restoring Ward.

## Counter payloads and damage order

- **Counter return amounts**
  - Use the card's printed return formula.
  - Quick Step: 5 + DR Block and 3 + AR HP return.
  - Do not add the superseded automatic ×1.5 +5 return bonus.
  - Return Poise and Ward damage are present only when listed.
  - Ratings are added once.
  - Returns do not generate automatic impact, additional buildup, or another Counter.

- **Counter qualification**
  - Resolve the complete incoming action.
  - Martial Counter normally requires its eligible direct damage to be fully stopped by Block.
  - Spell Counter can answer magic damage or a status-only spell when the card lists that coverage.
  - Persistent Ward fully stopping damage or suppressing a status can qualify as a resisted payload.
  - Evade alone does not qualify.
  - Its eligible payloads must all be stopped or resisted; admitted status pressure prevents a full-return trigger.
  - Accepted partial gauge buildup counts as admitted pressure, even before a stack forms. A completed fill wholly consumed by Ward counts as resisted only if it leaves no accepted overflow.
  - A mixed attack/status card resolves at most one reaction.
  - Suggested limit: one prepared reaction per Counter play and at most one successful return per owner turn cycle.
  - The reaction expires at the owner's next turn start unless printed otherwise.
  - Counter mitigation stays active through that prepared window, even after a return spends the charge.
  - Keeping Counter stance after expiry does not refresh the window.

- **Magic Counter**
  - Can return Ward damage, Poise damage, or both as printed.
  - Ward damage spends persistent Ward.
  - Poise damage fills Poise strain.
  - HP return requires an explicitly printed effect and, by default, a caster attacker.
  - Show caster identity as a visible enemy or character trait.

- **Damage and status order**
  - Begin with the complete printed attack amount.
  - Apply the stance matchup, rounding Counter-reduced damage up.
  - Apply active Sleep and Prone damage modifiers.
  - Add these received-damage percentages together, then apply their combined multiplier once and round positive damage up. Three Sleep stacks and Contact Prone give +55%; three Sleep stacks and Single ranged Prone give +5%.
  - Compute Evade DC and resolve avoidance.
  - Apply equipment weaknesses and typed damage defenses.
  - Apply persistent Ward reduction to magical direct damage.
  - Spend Block or temporary Barrier against remaining direct damage.
  - Resolve HP damage.
  - Resolve independently authored status pressure and impact.
  - Check an eligible Counter once at the end.
  - A Ward break does not retroactively increase damage already resolved by that action.

- **Counter breakers**
  - Sweep and other Area moves bypass ordinary Single returns.
  - A dedicated Ranged Area Counter can answer them if its coverage and school filters match.
  - Lightning spends a prepared reaction charge on a connected attack unless Grounded prevents it.
  - Define Connected as not evaded, even if Block or Barrier absorbs the damage.
  - Independently authored Lightning status pressure can still affect an evading target.
  - Unreflectable Force bypasses returns.
  - Piercing pressures protection; leakage prevents a full return.
  - These exceptions must be visible on the card.

## Counter coverage and school trade offs

- **A Counter must match its target**
  - Its catch profile lists Martial, Spell, or both.
  - Spell school restrictions apply to magical payloads.
  - It lists accepted Contact, Near, or Far delivery.
  - It lists Single, Area, or both.
  - All required filters must match.
  - Passing the camp filter alone does not let a Counter answer every move.

- **Contact Counter**
  - Strong at answering committed contact Attack and Smash.
  - Normally covers one Single action.
  - Cannot automatically return against an attacker beyond its printed reach.
  - A Closing effect can explicitly extend the return.
  - Sweep, Burst, and Barrage normally bypass it.

- **Ranged Counter**
  - Intercepts its listed projectiles or magical delivery.
  - Does not automatically work against Contact or every Area attack.
  - A dedicated Ranged Area Counter can intercept Sweep, Burst, or Barrage when explicitly listed.
  - Suggested Area trade-off: an extra Action or Mana cost, limited coverage, or lower return impact.
  - Suggested default coverage: protect the user against one complete action.
  - Protecting allies requires a printed target count and interception budget.
  - Return once, not once per projectile or protected ally.

- **School advantage**
  - Suggested default: normal ×1, strong ×1.25, weak ×0.75 to one printed Counter effect.
  - Round ordinary final amounts down; fractional Ward pressure uses the shared carry rule.
  - That effect is normally return impact; a card can instead specify protection or status-negation strength.
  - Do not multiply protection, return, status negation, and permanent Ward together.
  - Apply one edge per affected Counter effect. Piercing's Ward-damage bonus and a school bonus cannot multiply the same return together.
  - A specific countermeasure overrides a generic advantage: Grounded overrides Conductive. Otherwise an applicable weakness takes precedence over a generic strength unless the card explicitly overrides it.
  - Ward reserve and Quick Step's basic mitigation remain unchanged by an unprinted school bonus.
  - Immunities and Unreflectable traits are explicit exceptions.

- **Suggested school matchups**
  - Fire Counter: strong at negating Frost; weak at controlling committed Blunt impact.
  - Frost Counter: useful against ordinary contact pressure; weak against Fire and shattering traits.
  - Lightning Counter: strong against Conductive weapons or armor; weak against Grounded targets.
  - Force Counter: strong against physical projectiles and impact; weak against mental or status-only spells.
  - Alteration Counter: broad neutral interception; specialize it to gain a particular advantage.
  - Illusion Counter: strong against target-dependent Single attacks; weak against Area, Reveal, and mindless targets.
  - Divine Counter: strong against Decay and selected mental curses; less efficient against raw physical impact.
  - Decay Counter: specialized against healing or protective spells when that support coverage is printed.
  - Earth/grounding Counter: strong against Lightning; coverage still limits which deliveries it can catch.

- **Trade offs make builds distinct**
  - Broad coverage costs more or has weaker printed protection.
  - Narrow counters are cheaper or stronger within their specialty.
  - Area coverage sacrifices efficiency or retaliation.
  - Status counters may negate buildup without returning HP damage.
  - Cantrip counters provide small protection or one narrow answer.
  - A specialized counter should have a readable weakness.

## Spell schools and damage effects

- **Frost**
  - Cold damage, Frost buildup, Frozen, and vulnerability.
  - Suggested Chilled bonus: +25% damage from the next Blunt hit.
  - Blunt shattering removes a Frozen stack.
  - Fire and Thaw clear pending Frost, Chilled, and Frozen.

- **Fire**
  - Highest direct damage among comparable spells of equal cost and targeting.
  - Builds Burn.
  - Connected Fire clears Frost effects before damage and applies its own authored Burn afterward.
  - Extinguish, cleansing, fire resistance, and buildup resistance answer it.

- **Lightning**
  - Piercing spell damage and magical Paralysis buildup.
  - Disrupts Counter readiness.
  - PR scales damage and explicitly authored buildup.
  - Conductive weapons and armor affect buildup and backlash.
  - Grounded and insulation answer it.

- **Force**
  - Blunt spell damage, Push, Ward pressure, and disruption.
  - Retains Spell scaling and defenses.
  - Selected cards carry Unreflectable.

- **Alteration**
  - Barrier, Ward restoration, absorption, grounding, dispelling, armor changes, and hand selection.
  - Defensive counters intercept their listed delivery types.
  - Suggested Ward restoration: restore 1, at most once per combat, without exceeding starting Ward.

- **Illusion**
  - Sleep, Decoy, concealment, confusion, and limited copying.
  - Direct damage wakes a Sleep stack.
  - Holy revelation, mental resistance, and cleansing answer it.

- **Divine**
  - Holy damage, healing, cleanse, Sanctuary, and ally protection.
  - Selected cleansing effects also grant a small benefit.
  - Decay and interrupted casting answer recovery.

- **Decay**
  - Necrotic damage, Rot, recovery suppression, and temporary curse cards.
  - Ward, cleansing, and curse removal answer it.
  - Ordinary Decay does not add Ashen Blight.

- **Earth**
  - Suggested Alteration branch, with a possible later ninth school.
  - Blunt damage, Grounded, roots, cover, and terrain.
  - Grounded removes listed Paralysis pressure and prevents conductivity/backlash effects.
  - Roots, cover, and terrain have explicit removal counters.

- **Damage tags**
  - Blunt: shattering and explicitly authored impact.
  - Piercing: protection penetration and stronger Ward pressure.
  - Slashing: authored Bleed buildup.
  - Cold: Frost buildup.
  - Fire: Burn buildup and thawing.
  - Holy: revelation.
  - Necrotic: recovery suppression.
  - Lightning is also an electrical qualifier, even when its damage component is Piercing.
  - Suggested Piercing spell benefit: +25% printed Ward damage.
  - Fractional Ward damage carries forward instead of making small bonuses disappear.
  - Ward pressure does not secretly multiply HP damage.

## Status recovery and equipment

- **Control gauges**
  - Display gauges as 0–100% while each ailment has its own authored unit threshold.
  - Suggested initial threshold: 6 buildup units.
  - Suggested threshold while that ailment is active: 4 buildup units.
  - Retune card buildup together with thresholds; do not reuse the old values unchanged.
  - Suggested Frozen, Sleep, and Paralysis stack cap: 3.
  - Cap new hard-control stacks at one per complete action per ailment.
  - Retain gauge overflow for the next distinct application.

- **Breakout and control limits**
  - Roll once per ailment tagged Chance Recovery before the afflicted owner's turn, using the tag-weighted recovery formula below.
  - Other ailments use fixed decay, duration, or listed cleansing instead.
  - Successful recovery removes one active stack.
  - With buildup but no active stack, success removes a suggested 25% of the current gauge instead.
  - Recovery does not restore Ward or undo damage already suffered.
  - A stack consumed to deny an Action is removed.
  - Sleep, Paralysis, and Dazed now lock normal cards instead of merely subtracting one Action.
  - Their recovery-card rules replace the earlier one-Action-loss rule.
  - Frozen and other non-gated control retain their authored action-denial rules.
  - A turn that remains hand-locked schedules shared Resolve for the following owner turn.
  - Resolve suspends hand locks, Counter/stance restrictions, and further control-based denial for that turn.
  - Bosses can suffer weakened moves or delayed casts instead of repeated whole-turn skips.

- **Suggested early recovery formula**

  - Chance = clamp(30 + floor(CON weight × CON + WIS weight × WIS + INT weight × INT) + bonuses − 10 × max(0, active stacks − 1), 5, 80)%.
  - Bodily tags: CON weight 1, WIS weight 0, INT weight 0.
  - Elemental tags: CON weight 0.5, WIS weight 0, INT weight 0.5.
  - Mental tags: CON weight 0, WIS weight 0.75, INT weight 0.25.
  - Curse tags: CON weight 0, WIS weight 0.5, INT weight 0.5.
  - Gear, feats, and enemy traits can modify these weights or add recovery bonuses.
  - Multiple tags select one authored weight profile; do not add every profile together.
  - Default weights total 1, keeping hybrid tags from automatically granting more recovery.
  - Reaver example: WIS 3 and INT 4 give 33% recovery from one Mental stack, 23% from two, or 13% from three.
  - More stacks reduce the chance and one success normally removes only one stack.
  - Resolve still prevents indefinite action denial.

- **Suggested status profiles**

  - Bleed and physical poison: Bodily.
  - Burn, Frost, and Paralysis: Elemental.
  - Sleep and confusion: Mental.
  - Crimson Rot and magical curses: Curse, with bodily overrides when appropriate.
  - Dazed, Weak, Vulnerable, and Off Balance choose the profile of their source.
  - Camp decides Ward versus Poise protection; recovery tags decide the stat weights.
  - A magical Sleep uses Ward protection and Mental recovery.
  - A magically inflicted Bleed can use Ward protection and Bodily recovery.

- **Removal counters**
  - Frozen: Fire, Thaw, or Blunt shattering.
  - Sleep: direct damage, manual recovery at 2 SP per stack, Rally, or listed cleansing.
  - Paralysis: manual recovery at 3 SP per stack, Grounded, insulation magic, or listed cleansing.
  - Dazed: manual recovery at 1 SP per stack or listed cleansing.
  - Burn: Extinguish or cleanse.
  - Bleed: bandaging or cleanse.
  - Ordinary cleansing does not restore Ward or erase Ashen Blight.

- **Evade and Invulnerability**
  - Evade Ready grants a roll; Avoidance cancels one direct damaging action.
  - Full Invulnerability is a separate, explicitly authored effect.
  - If it also blocks statuses, the card must say so.
  - Neither effect prevents corruption or automatically earns a Counter.

- **Equipment benefits**
  - Flat typed reductions such as Piercing −1, Slashing −1, or Cold −1.
  - Percentage damage resistance.
  - Buildup resistance.
  - Ward, Poise, AR, DR, or other printed rating bonuses.
  - Conductive, Insulated, Grounded, and similar traits.
  - Suggested flat reductions share one budget per action and type across all its hits.

- **Equipment progression and weaknesses**
  - Basic gear has one small benefit.
  - Better gear can combine benefits within a declared budget.
  - Enemies may have both Martial and Spell weaknesses.
  - Suggested damage weakness: +25%; buildup susceptibility is listed separately.
  - Do not apply two weakness multipliers for the same electrical Piercing component.

- **Lightning backlash**
  - Suggested trigger: attacker and target both have Conductive equipment.
  - Suggested chance: 20%.
  - Suggested backlash: 25% of actual HP damage, against the attacker's defenses.
  - Grounded prevents it.
  - Backlash cannot arc again, trigger Counter, or generate extra buildup.

## Recovery cards Sleep and Prone

- **Stamina notation**
  - SP means Stamina Points.
  - Manual recovery costs are the listed SP amounts, without a separate extra Action charge.
  - In a shared Action/Stamina pool, charge that pool once rather than charging the same expense twice.

- **Locked hand**
  - Active Sleep, Paralysis, or gated Dazed locks ordinary cards.
  - All three also suspend prepared Counter returns and card-based Evade while active; protection already gained remains. Resolve or an explicit condition-specific exception can suspend that restriction.
  - Show a temporary recovery card for each active condition.
  - Built-in recovery cards remain usable through other simultaneous hand locks, so Break Sleep can be followed by Break Paralysis. This exemption does not unlock ordinary cards.
  - Keep the actual hand underneath; do not discard, replace, or shuffle it.
  - Recovery cards do not enter the draw, discard, exhaust, reward, or permanent deck.
  - Their available stack counts come from statuses, not duplicated card instances.
  - They cannot be copied or upcasted by default.
  - End Turn, inspection, and normal menus remain available.

- **Manual recovery prices**
  - Break Sleep: 2 SP per removed stack.
  - Break Paralysis: 3 SP per removed stack.
  - Clear Dazed: 1 SP per removed stack.
  - Remove one stack or select several; show the total before payment.
  - Two Sleep stacks cost 4 SP; three Paralysis stacks cost 9 SP.
  - Clearing Sleep and Paralysis together costs their sum.
  - Multiple recovery plays are allowed while affordable; each must actually remove stacks.
  - No stack can be removed or paid for twice.
  - Ordinary cards unlock only after every active hand lock clears, or during Resolve.

- **Natural recovery and Resolve**
  - Chance Recovery rolls before the owner chooses a recovery card.
  - A successful roll removes one stack without the manual SP cost.
  - If the owner ends a turn still locked, remove one stack from one selected active gated condition.
  - Grant Resolve for the next owner turn; its remaining locks are dormant during that window.
  - Dormant Sleep grants no rest benefit or Sleep vulnerability.
  - Recovery budgets do not reset during Resolve.
  - Enemies without a card hand use the same status gate on their normal move and visibly choose recovery or wait.
  - These guarantees prevent insufficient SP from creating a permanent lock.

- **Sleep restoration**
  - At turn start, resolve mandatory ongoing damage and natural recovery first.
  - If active Sleep remains and the character is alive, restore a suggested 2 HP per Sleep stack.
  - Suggested total Sleep-healing cap: 6 actual HP per combat.
  - Permit one nominal grant of 1 persistent Ward per combat, never above starting Ward; the final Sleep contribution cannot exceed 1 Ward.
  - Commit this allowance only while Ward is missing, before restoration modifiers and rounding. Crediting a fraction consumes the allowance even if no whole Ward is delivered yet.
  - Example: a 20% restoration penalty credits 0.8 Ward and spends Sleep's allowance. Another Sleep tick cannot repeat it; a later non-Sleep restoration can complete the shared fractional carry.
  - Restoring Ward does not cleanse statuses or erase partial buildup.
  - Refreshing, copying, or reapplying Sleep cannot reset either budget.
  - Upcasting and restoration bonuses remain within those combat caps.
  - Self-applied Sleep can use the same rules; it provides recovery at the price of vulnerability and a locked hand.

- **Sleep vulnerability and waking**
  - Suggested vulnerability: +10% direct damage received per active Sleep stack.
  - At the default three-stack cap, this reaches +30%.
  - A connected direct damaging action wakes one Sleep stack, once after all its hits.
  - A hit absorbed by protection still wakes a stack.
  - A completely evaded action does not wake it.
  - Ongoing Burn, Bleed, and similar ticks do not count as waking attacks.
  - An actively sleeping defender cannot Counter or use card-based Evade unless an explicit effect permits it.
  - Waking from the hit does not retroactively allow a Counter against that same hit.

- **Prone**
  - A positional status, rather than a hand lock by itself.
  - Suggested incoming Contact Single and Contact Area damage: +25%.
  - Suggested incoming Single Near/Far damage: −25%.
  - Suggested Evade bonus against Martial ranged weapons: +2 Near, +4 Far.
  - Add these to the Evade roll, not as a second automatic Invulnerability stack.
  - Prone does not raise the 50% base distance cap.
  - Near/Far Area receives neither the ranged damage reduction nor the Evade bonus by default; standing in a distant ground explosion is not protected just because it is Far.
  - An explicitly projectile-based Area can opt into Prone's projectile effects.
  - Apply Sleep and Prone damage modifiers before computing the Evade DC.
  - Suggested Stand Up recovery: 1 SP, no separate extra Action charge.
  - Incapacitation must be cleared before voluntarily standing, unless the card covers those locks.

- **Cards usable during a lock**
  - Ordinary cards remain locked by default.
  - A card may explicitly be a Recovery card or say Usable while Sleep, Paralysis, or Dazed.
  - An ordinary card or authored recovery variant must cover every active lock to be playable; the built-in recovery controls have the exemption above.
  - Being usable while Sleep alone does not bypass simultaneous Paralysis.
  - Recovery events are separate from normal card-play chains.
  - Escape cannot automatically draw, refund SP, or trigger ordinary played-card rewards.
  - An explicit recovery reward may trigger once per owner turn.

## Chance Advantage and Disadvantage

- **Suggested randomness budget**
  - Aim for about 10–25% of ordinary combat actions to involve an outcome roll.
  - Aim for roughly 50% of status interactions to include an authored chance mechanic.
  - These are playtest targets, not a universal attack hit rate.
  - Put most chance-based effects on lower-rank maneuvers, cantrips, and spells.
  - Higher-rank effects can improve reliability, reduce penalties, or replace a chance rider with a guaranteed one.
  - Guaranteed status application still checks Ward, Poise, and explicit immunity.

- **Reliable outcomes**
  - Stance matchups, resource payment, protection absorption, and valid Counter triggers remain deterministic.
  - A Counter that meets its printed conditions does not roll again to decide whether to return.
  - Selected secondary riders, Evade, distance avoidance, and Chance Recovery provide randomness.

- **Advantage**
  - Roll twice and keep the favorable result.
  - Evade uses the higher d20.
  - A percentage success roll uses the lower d100, succeeding at or below its displayed chance.
  - Scope the tag to Evade, Recovery, a status rider, or another named roll.

- **Disadvantage**
  - Roll twice and keep the unfavorable result.
  - Evade uses the lower d20.
  - A percentage success roll uses the higher d100.
  - Several Advantage sources still grant only one extra roll.
  - Several Disadvantage sources also do not stack.
  - Having both cancels to one ordinary roll.

- **Chance previews**
  - Show the effective chance after Advantage or Disadvantage.
  - A base 15% chance becomes 27.75% with Advantage or 2.25% with Disadvantage.
  - A base 50% chance becomes 75% with Advantage or 25% with Disadvantage.
  - The 50% distance cap and 80% recovery cap apply before Advantage unless explicitly marked final caps.
  - Do not consume randomness when inspecting cards, choosing rank, or cancelling a target.
  - Save resolved outcomes so reopening a choice cannot reroll them.

- **Suggested sources**
  - A careful setup card grants Advantage on the next Evade check.
  - Off Balance can impose Disadvantage on a specified recovery or maneuver roll.
  - Grounded can grant Advantage on Paralysis recovery rather than blanket immunity.
  - Exhaustion or an explicitly printed armor trait can impose Disadvantage.
  - Avoid applying both a flat penalty and Disadvantage for the same source unless that stronger cost is printed.

## Optional upcasting

- **Upcastable tag**
  - Only techniques explicitly tagged Upcastable can use higher ranks.
  - The card lists its base rank, unlocked ranks, maximum rank, and rank effects.
  - Martial techniques may also be Upcastable.
  - Upcasting does not change a card's camp, school, reach, or targeting unless its rank table explicitly says so.

- **Additional cost**
  - Each rank above the base costs +1 Mana and +1 Stamina.
  - Rank 1 is the normal cost when the base rank is 1.
  - Rank 2 adds 1 Mana and 1 Stamina.
  - Rank 3 adds 2 Mana and 2 Stamina.
  - Rank 4 adds 3 Mana and 3 Stamina.
  - Other resource and Action costs remain printed.
  - Free-play effects do not waive the rank surcharge unless explicitly stated.
  - Mana discounts apply to the complete Mana price, including the rank surcharge, with a minimum cost of zero.
  - Solo and co-op badges use the same paid price. If a co-op host has not supplied that rank preview, show the conservative authored price as an estimate.

- **Rank benefits**
  - Per-rank bonuses can improve damage, protection, impact, buildup, or a named chance.
  - Fixed breakpoints can unlock Advantage, a new counter coverage, an additional target, or a cleanse.
  - Not every rank must add damage.
  - Threshold bonuses accumulate unless their table explicitly replaces a lower-rank effect.
  - Improved Area coverage still follows the Counter's declared school and reach filters.
  - Rank bonuses respect the base distance and recovery chance caps.
  - Resource generation, copy count, duration, and action denial never scale automatically.

- **Example Upcastable Quick Step variant**
  - Rank 1: 5 + DR Block, Evade, and 3 + AR HP return.
  - Rank 2: add 2 Block.
  - Rank 3: also grant Advantage on its Evade roll.
  - Rank 4: also add a printed 2 Poise return.
  - At Rank 3, pay the base cost plus 2 Mana and 2 Stamina.
  - Rank 3 does not automatically increase the printed HP return.

- **Default interaction**
  - General setting: Ask to upcast after target selection.
  - Default: OFF.
  - Selecting an eligible card reveals an Upcast button directly beneath it.
  - Press Upcast to open the rank choice dialog.
  - Preview the total costs, changes, and odds.
  - Then choose the target and play at that selected rank.
  - Playing normally uses the base rank without a modal.
  - Higher ranks remain visible. Selecting one updates the total resource badges and affordability before payment.

- **Optional automatic prompt**
  - When the setting is ON, choose a target first.
  - Open the rank modal before committing the play.
  - Cancel returns to the selected card and target with the prior rank selection intact; no play is committed.
  - Offer the base rank, unlocked higher ranks, and Cancel. Payment rechecks the selected rank against the available resources.
  - Self-targeted techniques open rank selection directly.
  - Cancel spends nothing, changes no stance, and rolls no dice.

- **Commit and copying**
  - Recheck card ownership, target legality, rank access, and affordability on confirmation.
  - Pay once, then apply the selected stance and effects.
  - One upcast is one card play, not one play per rank.
  - Exhaust occurs once.
  - Printed Blight is paid once; additional rank corruption requires an explicit rank effect.
  - A new upcast Replica pays its own rank surcharge.
  - An effect echo repeats the chosen effect at its resolved rank and follows the existing echo limits.

## Combos feats relics and replicas

- **Implemented effects and further ideas**
  - Drawing, discarding, Retain, Recall, temporary card generation and Replica support the current combo system.
  - Scry's future-draw chooser, Patient Duelist and the named relic ideas below are optional suggestions for later content, rather than playable additions in this phase.

- **Counter into follow-up**
  - An impact Counter breaks Poise and creates an opening.
  - A rarer HP Counter adds a printed return.
  - Suggested Off Balance after countering Smash enhances the next Attack or Smash.
  - A Patient Duelist feat could Retain a follow-up instead of adding damage.

- **Defense into preparation**
  - Maintain Defend to receive next-turn protection.
  - Use neutral support to heal or Recall without changing stance; a future Scry card could use the same rule.
  - Finish with Smash or Counter when the enemy telegraph changes.

- **Status sequences**
  - Pressure Ward, then apply Sleep or Paralysis after its break.
  - Freeze, then choose between Blunt shatter and Fire thaw/Burn.
  - Sleep lets you prepare; direct damage deliberately wakes a stack.
  - Lightning disables Counter, then a Martial attack follows.
  - Grounding and counter magic give the opponent answers.

- **Deck effects**
  - Scry (future suggestion): inspect and choose future draws.
  - Cycle: discard and redraw.
  - Retain: keep a chosen card.
  - Recall: retrieve from discard.
  - Generate: add a temporary card.
  - Replica: create a real playable copy.
  - Cantrips cost little and provide small attacks, utility, or counters.
  - Free generation, draw, and refunds need once-per-turn or other explicit limits.

- **Feat and relic rewards**
  - Guard break can grant Retain or cleansing.
  - Successful Evade can grant Scry or enable an explicitly printed Evasive Riposte.
  - Suggested relic — Copper Coil: boost Lightning buildup with backlash risk.
  - Suggested relic — Grounding Stone: protect against electrical effects.
  - Suggested relic — Frostglass: reward shattering with temporary Barrier.
  - Suggested relic — Ash Seal: reward high Blight without removing its run cost.
  - Enemies can use the same interactions with readable, narrower kits.

- **Turning disadvantages into openings**

  - Dream Harvest: while an enemy is asleep, the first support card each turn can Scry or draw without waking it.
  - Lucid Recovery: an explicit Sleep Recovery variant pays the normal 2 SP per removed stack and grants a small temporary Barrier.
  - Grounded Resolve: an explicit Paralysis Recovery variant pays 3 SP per stack and improves the next electrical recovery.
  - Clear Head: after removing Dazed, improve the next named maneuver roll once per turn.
  - Low Guard Riposte: while Prone, a successful Contact Counter gains printed bonus Poise; it must still absorb the increased incoming damage.
  - Crawling Shot: while Prone, a ranged card trades movement or reach for protection or accuracy.
  - Ember Covenant: the first Corrupted card each turn grants temporary Barrier; it never prevents the 100-Blight loss check.
  - Shatter Opportunity: reward a Freeze removed by shattering or thawing with Retain or a marked target.
  - Use explicit triggers such as After playing Lightning, While Prone, After recovering Sleep, or After breaking Ward.
  - Each reward has a stated limit and is counted once per complete action, not once per hit or displayed recovery card.

- **Inspiration**
  - [2024 Weapon Mastery](https://www.dndbeyond.com/posts/1742-your-guide-to-weapon-mastery-in-the-2024-players) inspires control rewards such as Push, Sap, Slow, Topple, and Vex.
  - [Nexon's Mabinogi basic skills guide](https://mabibook.nexon.net/usa/guidebook_basicskills.html) supplies the recognizable stance vocabulary.
  - The Evade formula and balance numbers here are custom AshenSpire rules.

## Ashen Blight

- **Emergency cards**
  - Powerful, cheap cards Exhaust for the combat.
  - Blighted Transmute: suggested +3 Energy, draw 2, 12 Blight.
  - Blighted Second Bloom: suggested heal 18, draw 1, 15 Blight.
  - Blighted Blightward: suggested 18 temporary Barrier, draw 1, 10 Blight.
  - These examples cost 0 Actions.

- **Persistent payment**
  - Ashen Blight is one run-long 0–100 meter.
  - Every accepted corrupted play pays its printed price.
  - Free plays, generated copies, and Replicas still pay.
  - Countered or fully resisted plays still pay.
  - Invalid plays and previews pay nothing.
  - Stance changes, Evade, Ward, cleansing, and battle end never remove the price.

- **Threshold and later danger**
  - At 100, resolve the requested one-time 90% run-loss check before card effects.
  - Survivors become Blighted and their entire deck, including later additions, becomes corrupted.
  - Suggested converted-card bonuses: normal Action cost −1, minimum 0, and +25% printed damage, healing, and temporary protection.
  - Manual recovery SP costs and upcast surcharges are not reduced by deck conversion.
  - Explicit Ward restoration and impact do not automatically gain these bonuses.
  - Preserve names, camps, stances, schools, tags, and upgrades.
  - Ordinary converted cards retain their normal lifecycle.
  - Suggested later risk: one saved 5% death check per subsequent combat.
  - Reloading does not reroll committed outcomes.

- **Echoes and visuals**
  - An effect echo repeats an effect without being another card play.
  - It does not pay twice, but cannot recursively copy or generate itself.
  - Black volcanic trim fades inward.
  - Thin ember veins enter from several edges and corners, fading before the readable center.
  - Keep a Corrupted label and visible Blight price.
  - A less severe mode remains an optional separate balance proposal.

## Three Ashen Blight reward stages

- **Milestones**
  - Stage 1, Singed: 25–49 Blight.
  - Stage 2, Kindled: 50–74 Blight.
  - Stage 3, Infernal: 75–99 Blight.
  - At 25, 50, and 75, choose one run-lasting feat.
  - Each feat has exactly two buffs and one debuff.
  - Choose a Martial, Spell, or Survivor path at each stage; mixing is allowed.
  - Values below use Stage 1 / Stage 2 / Stage 3 order.
  - At 100, the existing loss/transformation event occurs; there is no fourth reward stage.

- **Martial path feat: Volcanic Sinew**
  - Buff 1: +1 / +2 / +3 STR.
  - Buff 2: the first eligible Martial attack or authored Martial Counter return in each owner turn cycle adds +1 / +2 / +3 Poise damage if it already lists Poise damage.
  - Debuff: persistent Ward restoration is reduced by 10% / 15% / 20%.
  - Supports Smash, impact Counters, and aggressive Prone builds.
  - It does not invent Poise damage on HP-only cards.
  - Ward restoration uses fractional carry, rather than rounding every small restoration to zero.

- **Spell path feat: Cinder Sight**
  - Buff 1: +1 / +2 / +3 INT.
  - Buff 2: the first eligible elemental spell each owner turn cycle adds one total unit to one selected authored Burn, Frost, or Paralysis buildup; a multi-ailment spell does not add one to each.
  - Debuff: maximum Stamina is reduced by 1 / 2 / 3.
  - The extra unit is buildup, not a free active control stack.
  - It does not extend Sleep, Prone, or hard-control duration.
  - Lower Stamina makes manual recovery and upcasting harder.

- **Survivor path feat: Ashen Heart**
  - Buff 1: +1 / +2 / +3 CON.
  - Buff 2: the first restorative effect each owner turn cycle restores 10% / 15% / 20% more HP or Ward.
  - Debuff: draw one fewer card in the opening hand, minimum one card.
  - Restoration still obeys starting Ward and Sleep's combat budgets.
  - It does not grant permission to play locked cards.
  - Stat-derived maximum increases do not refill current HP or Stamina.
  - Maximum decreases immediately clamp the current resource to its new maximum.

- **Restoration arithmetic**
  - Add applicable restoration bonuses and penalties before multiplying the nominal grant once. A +20% bonus and a −20% penalty yield the original grant.
  - Apply missing-resource limits and source budgets after modifiers; no restoration exceeds the starting Ward cap or Sleep's combat caps.
  - Fractional Ward-restoration carry belongs to the character, persists across status removal and saves during that combat, and resets at combat end. It cannot restore Ward by itself or generate new Sleep allowances.
  - When Ward is full, discard excess restoration instead of banking it for later damage. HP uses whole-point rounding down and its actual-restored budget.

- **Repeated paths and persistence**
  - Stat buffs from distinct milestone feats add together.
  - Repeated reactive buffs use the strongest chosen tier instead of triggering several times.
  - Repeated copies of the same drawback use the strongest tier, not additive penalties.
  - Different path effects can coexist.
  - Each path's reactive buff has one shared budget per character's owner turn cycle, including opponent-turn Counter returns. Copies, echoes, stance changes, and saves preserve that budget.
  - Each milestone choice is committed once; saves, reloads, copied cards, and cleansing never grant it again.
  - Crossed milestones queue their choices after the committed action and before the next normal play.
  - Each queued choice permanently records its original milestone and tier: 25 gives Stage 1 values, 50 Stage 2, and 75 Stage 3, even when several thresholds are crossed together.
  - A payment reaching 100 resolves the run-loss check before effects or milestone choices.
  - Defeat grants no subsequent choice; survivors can resolve eligible unclaimed milestones.
  - These feats never prevent corruption death.

- **Visual stages**
  - Add milestone pips at 25, 50, and 75.
  - Show each chosen feat's two benefits and drawback.
  - Increase ember-vein detail at each stage without covering the card center.

## Reaver example

- **Character**
  - DEX 1; WIS 3; INT 4.
  - Medium armor: Evade penalty 2.
  - DR +3; AR +4.
  - Enemy shows Smash for 15 direct damage.

- **Quick Step**
  - Enter Counter.
  - Gain 5 + DR = 8 Block.
  - Prepare Evade.
  - Printed HP return: 3 + AR = 7.
  - Add Poise return only if printed.

- **Matchup and roll**
  - Counter reduces Smash to ceil(15 × 0.5) = 8.
  - Smash does not gain its Defend bonus against Counter.
  - DC = 8 + 8 = 16.
  - A natural roll of 5 gives 5 + 1 + floor(3/5) + floor(4/10) − 2 = 4.
  - Four does not exceed 16, so Evade fails.
  - Natural rolls 18–20 succeed: 15% Evade chance.

- **Enemy resolution**
  - The Smash deals 8 against 8 Block.
  - Block falls to 0; HP damage is 0.
  - The full eligible action was absorbed, so Quick Step returns 7 before the enemy's normal defenses.
  - Use the Reaver's printed weapon damage type.
  - Any independent status payload resolves separately and checks Poise or Ward.

- **If Evade succeeds**
  - Direct damage is avoided; Block remains.
  - Independent status pressure still resolves.
  - No ordinary Counter return occurs.
  - An Evasive Riposte effect can explicitly change that result.

## Delivery scope

- **Implemented expansion**
  - New runs use version 2 of the Martial and Spell rules. Existing runs keep their saved rules.
  - [The implementation contract](combat-expansion-contract.md) governs final values, ownership, rounding, card lifecycle, and compatibility.
  - Solo, co-op, enemies, card previews, and saved fights share those rules.
  - [Card sigils](combat-card-sigils.md) explain the action and school marks. Damage types remain written; inspection explains secondary tags.

- **Loading a fight**
  - Ordinary combat actions preserve the latest durable checkpoint, initially the fight's entry.
  - Explicit Save Game records the current fight. Later ordinary actions leave that checkpoint intact.
  - Irreversible Blight payments, milestone choices, encounter checks, and terminal outcomes are saved before adoption and presentation.
  - A failed required save rejects the whole play, including costs and RNG changes. Zero-cost corrupted plays still record their payment receipt.
  - Blight's effective stats update live equipment ratings and Poise without changing allocated points; reloading preserves the same projection.

- **Playtest delivery**
  - The implementation must reach regular and alternative dev/test with each channel's required checks passing.
  - Alternative presentation and animation changes remain preserved during reconciliation.
  - [Enemy knowledge](enemy-knowledge-contract.md) remains a separately coordinated runtime expansion.
