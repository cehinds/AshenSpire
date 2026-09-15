# Lore ↔ mechanics audit

*Read [LORE.md](LORE.md) against the shipped game and say, line by line, which
of it is a rule and which of it is only a sentence. Audited 2026-09-14 against
`dev` at `0.7.1.51`. Every claim below names the file or the command that
falsifies it; none is remembered.*

**Verdict.** The *world* is in the mechanics. The *premise* is not. Names,
roster, seats, class identities and one event chain are faithful to the point
of being load-bearing. The one-breath pitch — climb, take the cinders, relight
the three flames, then choose what to do with the Ember — has almost no
machinery behind it, and the lore's own declared narrative channel delivers
nothing to the screen.

---

## 1. What holds

| Lore | Mechanic | Falsify |
|---|---|---|
| §3 "cinders are the only currency… the merchant takes them, the shrines drink them" | `run.cinders` is the only currency. Granted per victory (normal 45–75, elite 105–150, boss 225–270), spent at the merchant, spent to buy character levels at the shrine (50, +10 each) | `balance.js:53`, `balance.js:245`, `model/armamentTrading.js:26`, `model/levelup.js` |
| §6 "There is no first seat… the ring decides the rest" | Seats ship (SPEC §13). Encounters bind to `seat`, never to an act number; the seed picks the order; tier scaling keeps act 2 act 2 wherever you meet it | `node -e "import('./src/content/seats.js').then(m=>console.log(m.SEATS.map(s=>s.id)))"` |
| §1 "The Blighted Valkyrie goes where the Ember goes" | Her encounter carries `seat: null` — the one row the schema admits it for — and is appended to the tier-3 map whatever seat holds it | SPEC §13.5 |
| §3 the corrupted, and §6 the rooms they hold | All 33 shipped enemies are the lore's names. Every boss destination is the lore's room: Fell Courtyard, Bellfoundry, Briar Sanctum, Stitched Throne, Hall of Mirrors, Ossuary Organ Hall, Furnace Chapel, Eclipse Observatory, Ashheart Caldera | `content/bossDestinations.js` |
| §5 Reaver "fights in two stances because the Wardens taught two: one to break, one to hold" | Exactly two stances ship: `gorefire`, `bulwark` | `content/stances.js` |
| §5 Herald "spends their own health to act because that is what a Saint does" | 10 of 39 Herald cards cost the player's own HP. A costing rule, not a claim | class `herald` in `content/cards/` |
| §5 Starseer "casts in sequence… the second spell is always the true one" | `starstoneCharge`: *"A spell was cast this turn: your next Starstone bonus is live. Fades at end of turn."* | `content/statuses.js` |
| §5 Rogue poison and speed; §8 "the Rogue's poison is not Blight" | Rogue carries `venom`, `envenom`, `prepared`, `afterimage`, `deadlyTempo`. No blight status touches the Rogue | `content/statuses.js` |
| §6 the Grave of the Nameless: "What the player does there follows them up the Spire" | `graveOfTheNameless → namelessKeeper → namelessRest`, each stage gated on specific prior **choice ids** | `eventHistoryRequirements` in the content bundle |

That last row is the only place in the codebase where lore drives a system
rather than decorating one. It is the model for everything in §5 below.

## 2. Contradictions

**2.1 The player can be Blighted.** §4 makes the Forsaken's immunity
load-bearing: *"The Blight takes hold through the flame-mark, and the Forsaken
never had one. That is why they can climb."* In play, two enemy moves apply
`crimsonBlight` to the player — `courtMarionette.blowdart` and
`blightedValkyrie.rotWings` — and the `blightCoating` flask has the player
dealing it outward. §8's vocabulary table forbids Blight meaning "disease,
poison," which is exactly what the status is.

`crimsonBlight` is an IP-scrub artifact ("Scarlet Rot" pre-scrub, SPEC §4.4),
not a word chosen for this world, so renaming the status is cheaper than
rewriting §4. Whatever it is renamed to must not be built on the reserved word;
`harbingerOfBlight` and `blightCoating` travel with it.

**2.2 SPEC inverts §1's logic about the Crown.** SPEC §13.2 glosses the Ashen
Crown as *"the Spire's summit, reached by the causeway that opens from the last
**relit** tower."* §1 says the opposite: a relit flame *drives the Ember on* —
"it will not sit in a hearth that is fed" — so every climb corners it at the
last **cold** tower, and that tower's summit is the Crown. The mechanic (tier-3
boss node, whichever seat) is right; the sentence explaining it is backwards.
One-line SPEC fix.

**2.3 The World Journey atlas makes the Crown a place.** §1: "The Ashen Crown
is not a place." The atlas ships it as one of five regions, with roads and
locations described as *"An enduring place in The Ashen Crown."* SPEC §13.2
carefully rules `ashen-crown` out of the seat set, but the atlas is a separate
surface and was never reconciled. The same surface ships **The Drowned Coast**,
a region LORE.md does not mention at all (the weald has "a drowned hamlet"; the
coast is new). Either the lore bible grows a §11 for the World Journey's own
geography, or the atlas borrows names the bible has already defined otherwise.

## 3. Absent — the premise has no mechanics

- **`relight` and `hearth` appear zero times in `src/`.** Killing an act boss
  grants loot; nothing is lit. There is no flame state on the run, no cinder
  price for a hearth, and no hearth-key relic — §9 defers that mapping to
  `proposal-seat-adventure.md`, which has not landed past Phase 0.
- **One ending, and the player is never asked.** `ui/screens/gameover.js:30`
  titles victory *"Ember restored"* — the Restore ending of §4, hardcoded.
  Claim and Transform have no representation anywhere.
- **The lore's declared main channel is unwired.** §7: *"The main channel is one
  line of flavor text on a card."* 7 of 188 cards carry `flavor`, and no card
  surface renders it: `resolveCard` carries the field forward
  (`model/registries.js:29`) and `ui/components/card.js` draws tags instead.
  So the channel delivers **0%** of what is written, including the 35 seed
  lines already authored in §7. Equipment blurbs: 45 of 449. Relics: 43 of 55 —
  relics are both the best-covered surface and the only one that renders.
- **The flame-mark exists nowhere** — no status, tag, item or event turns on it,
  though §2 and §4 both rest on it.

*Falsify the first and third:*

```sh
grep -rn "relight\|hearth" --include=*.js src/ | wc -l       # 0
node -e "import('./src/content/index.js').then(m=>{const c=m.contentBundle.cards;\
  console.log(c.filter(x=>x.flavor).length,'/',c.length)})"   # 7 / 188
```

## 4. Drift — one cleanup PR

| Where | Says | Ships |
|---|---|---|
| SPEC §4.5, §5.2 (5 places) | "Bloodflame Stance", "Enter: Bloodflame" | `gorefire`, and LORE §5/§7 say Gorefire. SPEC is the stale one |
| LORE §3 | "The smith burns them" (cinders) | The smith spends `smithingStones` (`model/smithing.js`). Reword the lore or reprice the smith |
| `damageSchool` | Starseer's school is literally `magic`; Herald's is `arcane` | §8 reserves the Starseer's element as **starstone** and bans "generic mana or magic". Candidates: `starstone` and `ritual` — both already exist as tags |
| Arcane Exposure | The meter the merged progression proposal hangs mana recovery on | Ships on 2 of 33 enemies. Thin ground for an economy |

## 5. Regression risk in the merged progression proposal

[proposal-progression-and-property-system.md](proposal-progression-and-property-system.md)
§6 states *"Cinders keep one job: the merchant,"* retiring cinder-priced levels.
That deletes one of the three lore sentences about what cinders are *for*
("the shrines drink them"), and with it the best thematic mechanic the game
currently has: spending harvested names to grow yourself is the **Claim**
ending in miniature, playable at every shrine.

XP-from-use is defensible in this world — the Forsaken grows by doing, because
no fire was ever promised to them — but that sentence is not in LORE.md. Write
it into §4, or keep one cinder sink at the shrine. Do not do neither.

## 6. Ranked fixes

1. **Render `flavor` in card inspection, then author §7's seed lines.** The
   lore is already written; only the wire is missing. One UI change, one
   content pass. Highest lore-per-diff in the repo.
2. **Rename `crimsonBlight` off the reserved word** (or amend §4 to drop the
   Forsaken's immunity). Until then §4's central claim is false in play.
3. **The cleanup PR** of §4 above: SPEC's stance name, SPEC §13.2's inverted
   sentence, the smith's currency line, the `magic` school.
4. **`run.flames`** — three booleans, lit by the seat's boss falling, priced in
   cinders at the tower, shown in the HUD. The smallest change that makes the
   premise exist, and the hook both §9's hearth-keys and §4's three endings
   need before either can be built.
5. **Reconcile the World Journey atlas with the bible** — the Crown as summit
   rather than region, and a lore home for the Drowned Coast.
