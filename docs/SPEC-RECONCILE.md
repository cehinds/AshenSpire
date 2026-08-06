# SPEC reconciliation — stage 1

*Viki, 2026-08-03. Marina's mandate: "feature complete" becomes a count reaching zero
instead of a feeling. Every SPEC claim in the swept sections gets a verdict —
**shipped** (proof cited) · **cut** (named; Constantine's veto is free) · **to-build** —
with the artifact the sentence describes and the command that would falsify it.
A claim with no falsifying command is a cache, and it is wrong already or will be.*

*Swept at `dev` = `70d35e2`. SPEC line numbers are at that tree, before this branch's
own SPEC edits; each row carries a quote fragment so the row survives renumbering
(line numbers rot — the assignment's own §7.4 citation had). Verdicts were verified
against `src/` and, where behavioral, against `tests/run-node.mjs` (38/0 at this tree)
and headless Chromium on `dist/AshenSpire.html` `?shot=` states (non-empty DOM dumps,
markers asserted — an empty dump is a broken harness, not a pass).*

**This stage's scope: shop · rest · rewards, plus the §7.4/§11 audio rot (fixed in
this same branch — see the SPEC diff).** Combat was measured by the week's combat
work (#22/#24/#52 record). Other sections: later stages, appended below this one.

## Verdict counts, stage 1

| Section | claims | shipped | cut | to-build |
|---|---|---|---|---|
| Shop | 11 | 9 | 2 | 0 |
| Rest | 6 | 4 | 1 | 1 |
| Rewards | 15 | 12 | 3 | 0 |
| **Total** | **32** | **25** | **6** | **1** |

Four shipped verdicts carry a named boundary (marked ⚠ below: S8, W5, W12, W15) — the sentence is
true of the mechanism and overbroad about its reach. A ⚠ is not a pass wave-through;
it is the exact edge a later edit must not silently cross.

---

## Shop

| # | SPEC (at 70d35e2) | Claim | Verdict | Artifact | Falsifying command |
|---|---|---|---|---|---|
| S1 | §3.2:116 | `ui/screens/shop.js` exists | **shipped** | `src/ui/screens/shop.js` | `ls src/ui/screens/shop.js` |
| S2 | §3.3:154 | `shopAction(...)` is in the closed player-intent set | **cut** | no run-level intent layer exists; the shop mutates `run` directly and persists via `onChanged` → `persist()`. The shipped closed set is combat-only: `playCard`/`endTurn`/`useFlask` (`src/engine/combat.js:420`) | `grep -rn "shopAction" src/` → 0 hits |
| S3 | §3.11:290 | shop stock rolls on stream `shop` | **shipped** | `STREAM_NAMES` (`src/engine/rng.js:10`); `buildShopStock` draws on `'shop'` (`src/engine/encounters.js:178-207`) | `grep -n "'shop'" src/engine/encounters.js` |
| S4 | §6:553 | cards cost 45–160 by rarity | **shipped** | `balance.shop.cardCost` = common [45,55] · uncommon [68,82] · rare [135,160] | `grep -n "cardCost" src/content/balance.js` |
| S5 | §6:553 | relics 140–300 | **shipped** | `balance.shop.relicCost` = [140,160]/[200,230]/[270,300] | `grep -n "relicCost" src/content/balance.js` |
| S6 | §6:553 | flasks 50–80 | **shipped** | `balance.shop.flaskCost` = [50, 80] | `grep -n "flaskCost" src/content/balance.js` |
| S7 | §6:553 | card removal 75, +25 per purchase | **shipped** | `removeBase: 75, removeStep: 25`; recomputed after each removal (`src/ui/screens/shop.js:99`, `src/engine/encounters.js:206`) | `grep -n "removeBase\|removeStep" src/content/balance.js src/ui/screens/shop.js` |
| S8 | §6:553 | "All numbers: `balance.js`" | **shipped** ⚠ | true, plus a shipped extension the sentence doesn't carry: Custom Climb mods multiply prices (`expensiveShopsMult` 1.5 / `hoarderShopMult` 2, applied in `main.js` `shopPriceMult()`) | `grep -n "shopPriceMult" src/main.js` |
| S9 | §6:553 | currency is "runes" | **cut** (renamed) | cinders since the IP scrub (`95c3b87`, `docs/IP-SCRUB.md`); opcode is `addCinders` (`src/engine/actions.js`) — SPEC still says runes document-wide, one debt, one future act | `grep -rn "cinders" src/content/balance.js` |
| S10 | §7.1:562 | Shop is a map-node screen in the flow | **shipped** | `main.js` `case 'merchant'` → `buildShopStock` → `run.shopStock` (rolled once, saved — reload restores the same shelves) → `showShop()` | `node tests/run-node.mjs` (test 18: `buildShopStock` deterministic); headless `?shot=map` DOM contains merchant nodes |
| S11 | §5.5:505 | flasks are sold at shops | **shipped** | `flaskStock: 2` slots in `buildShopStock`; purchase gated on free flask slots (`shop.js:74`) | `grep -n "flaskStock" src/content/balance.js src/engine/encounters.js` |

## Rest

| # | SPEC (at 70d35e2) | Claim | Verdict | Artifact | Falsifying command |
|---|---|---|---|---|---|
| R1 | §3.2:118 | `ui/screens/rest.js` exists | **shipped** | `src/ui/screens/rest.js` — Rest (heal) / Smith (upgrade, with per-card upgrade preview) | `ls src/ui/screens/rest.js` |
| R2 | §3.3:154 | `restAction('rest'\|'smith', cardId?)` intent | **cut** | same as S2 — the screen mutates `run.hp` / `inst.upgraded` directly, `onDone` → `persist()` | `grep -rn "restAction" src/` → 0 hits |
| R3 | §5.4:494 | Grace Fragment: "Shrines heal +15% more" | **shipped** (renamed Ember Fragment) | `src/content/relics.js:228` `shrineHealMult: 1.15`, consumed by `shrineHealAmount` | `node tests/run-node.mjs` — test 18 asserts ×1.15 |
| R4 | §5.4:497 | Dragon Heart: shrines smith-only | **shipped** (renamed Wyrm Heart) | `src/content/relics.js:356` `shrineNoRest: true`; `rest.js:12,20-23` locks Rest and says why | `grep -n "shrineNoRest" src/content/relics.js src/ui/screens/rest.js` |
| R5 | §7.1:562 | Shrine is a map-node screen in the flow | **shipped** | `main.js` `case 'shrine'` → `showRest()`; heal = `min(missing HP, floor(maxHp × 35% × mult))` (`encounters.js:265`), Custom Climb `lessHealingMult` halves it | test 18 asserts shrine heal 35%; headless `?shot=coopshrine` renders Rest + Smith |
| R6 | §10:650 | Wondrous Physick crafting at shrines (forward hook: "UI only") | **to-build** | nothing in `rest.js`; the composability half the hook promises does exist (`wondrousDraught` two-payload script, test 18) | `grep -in "craft" src/ui/screens/rest.js` → 0 hits |

Reverse finding (no verdict — SPEC is silent, tree is not): the shrine heal *number*
(35%) appears nowhere in SPEC, while `src/engine/encounters.js:264`'s comment cites
"SPEC shrine.healPct" — a pointer to a sentence that does not exist. One of the two
should exist; today neither checks the other.

## Rewards

| # | SPEC (at 70d35e2) | Claim | Verdict | Artifact | Falsifying command |
|---|---|---|---|---|---|
| W1 | §3.2:115 | `reward.js` handles "card reward, chest, boss reward" | **shipped** | one `mountRewards` mounts combat, treasure (`TREASURE`), and boss (`<BOSS> FALLS`) payloads (`main.js:853-1040`) | `grep -n "mountRewards" src/main.js` |
| W2 | §3.3:154 | `chooseReward(choice)` intent | **cut** | callback (`onDone`), not an engine intent; only co-op has a `chooseReward` message and it is a net protocol, not the engine set | `grep -rn "chooseReward" src/` → co-op send only |
| W3 | §3.4:177 | run-level opcodes: `addRunes`, `addCardToDeck`, `removeCardFromDeck`, `upgradeCard`, `addRelic`, `addFlask`, `loseMaxHpPct`, `startCombat` | **shipped** (one rename: `addCinders`) | `src/engine/actions.js:454-517` — the full case list | `grep -n "case 'add" src/engine/actions.js` |
| W4 | §3.8:259 | reward system = rarity rolls + pity/decay counters in `encounters.js`; knobs in `balance.js` | **shipped** | `rollRuneReward` / `rollCardRewardIds` / `rollFlaskDrop` / `rollRelicReward` (`encounters.js:44-122`); `balance.rewards` | `node tests/run-node.mjs` — test 18 |
| W5 | §3.11:290 | reward streams `cardRewards`/`relicRewards`/`flaskRewards` in the named-stream list | **shipped** ⚠ | true — but the closed list the sentence enumerates was stale: shipped has an 11th stream, `armaments`. Fixed in this branch's SPEC edit | `grep -A13 "STREAM_NAMES" src/engine/rng.js` |
| W6 | §3.11:291 | same seed → same rewards; a different path doesn't shift later rolls | **shipped** | per-stream saved counters; test 18 "reward/shop/unknown rolls deterministic" | `node tests/run-node.mjs` |
| W7 | §3.12:296 | saved after every committed choice (reward taken) | **shipped** | `persist()` inside every reward/shop/rest `onDone`/`onChanged` (`main.js:1039,1064,1074-1078`) | `grep -n "persist()" src/main.js` |
| W8 | §4.1:326 | all enemies dead → victory → rewards | **shipped** | combat-end path assembles the reward payload (`main.js:1020-1040`) | `node tools/verify-shipped.mjs` + test 14 (bot completes a combat) |
| W9 | §5.3:476 | boss reward: "75–90 runes, rare relic choice, card reward with rare upgrade odds boosted" | **part cut** | cinders 75–90 ✓, boss card odds 45/40/15 ✓ (rare-boosted vs normal's 5%) — but the relic is **one** boss-rarity relic, not a choice (`main.js:1009`, single `relicId` rendered in `reward.js:20-24`) | `grep -n "rollRelicReward" src/main.js` |
| W10 | §6:553 | cinder ranges: Monster 15–25, Elite 35–50, Boss 75–90 | **shipped** | `balance.rewards.cinders` — exactly those pairs | `grep -n "cinders:" src/content/balance.js` |
| W11 | §6:553 | card reward = choose 1 of 3; 60/35/5 normal, 45/40/15 elite | **shipped** | `cardChoices: 3`, `rarityWeights` verbatim; shipped extensions: Feral Eye gives elites a 4th choice (test 18), Custom "Chaos Rewards" flattens rarity | `node tests/run-node.mjs` — test 18 |
| W12 | §6:553 | "+ flask roll" after combat | **shipped** ⚠ | normal + elite combats only — the boss payload carries no `flaskId` (`main.js:1005-1010`); the SPEC sentence is overbroad | `grep -n "flaskId" src/main.js` |
| W13 | §6:553 | elites additionally drop a relic | **shipped** | `main.js:1025` — `relicId` iff pool `elite` | `grep -n "pool === 'elite'" src/main.js` |
| W14 | §6:553 | bosses drop "a boss-relic choice of 3" | **cut** | single boss-rarity relic, no choice roll and no choice UI. Note: this dead claim has **two homes** (here and W9's §5.3:476) — a duplicated cache, which is how it survived | `grep -rn "choice" src/ui/screens/reward.js` → 0 relic-choice hits |
| W15 | §5.5:505 | flasks: ~35% drop decaying −10/+10, from combats, shops, events | **shipped** ⚠ | `flaskDropBasePct: 35`, `flaskDropStepPct: 10`, pity both directions asserted (test 18); shops sell them (S11); the **events** source is vocabulary-only — the `addFlask` opcode exists, no shipped event uses it | `grep -c "addFlask" src/content/events.js` → 0 |

Reverse finding: the armament economy — treasure/elite/boss drops, boss consolation
cinders, drops riding the reward screen (`balance.equipment.drops`,
`encounters.js:136-168`, `reward.js:35-46`) — is shipped and wholly unclaimed by SPEC.
A later stage owns writing it in; until then SPEC under-describes what a boss node pays.

---

## §7.4 + §11 — the audio rot, fixed in this branch (not counted above)

The assignment's citation (`SPEC.md:576/643`) resolves at the **release/build**
branches' numbering to §7.4's sound bullet and §11's "audio assets (hooks only)"
clause — the line numbers themselves had rotted, which is the finding in miniature.
At `70d35e2` the same sentences are :590 and :657. Status before this branch:

- §7.4 "Sound: … no-op in v1 … without shipping audio" — described nothing: a full
  procedural WebAudio engine ships (`src/ui/audio.js`, 445 lines — synth SFX per hook
  id, per-context music beds incl. `shop` and `rest`, volume/mute settings), wired
  `sfx.sink` in `main.js:154-155`. The two asset-override paths fail differently and
  the spec now says so: music-folder tracks fall back to the synth bed on failure;
  an `SFX_MANIFEST` entry short-circuits the synth and a failed load is a cached
  miss that plays silence (`sfx()` → `playSample` → `if (!buf) return`); and
  `MUSIC_MANIFEST` is imported but never read. **Rewritten to the shipped truth.**
  *(First pass said "a missing/failed load falls back to the synth" for both paths —
  the code's own comment, not the code; Sten's gate caught it — D1. Dormant today:
  both manifests ship empty.)*
- §7.4 "YOU DIED" / "GREAT RUNE RESTORED" — renamed at the IP scrub; shipped strings
  are YOU PERISHED / EMBER RESTORED (`gameover.js:9`). **Rewritten.**
- §7.4 animation bullet — the ≤300 ms / ≤80 ms bounds hold for *most* effects at the
  default speed, and three big-moment effects are hardcoded past them (heavy hit
  flash 380 ms, cast glyph 450 ms, Stagger wobble 600 ms — `fx.js:429-431,466,465`);
  the Animation speed setting scales pacing (beat/step/lunge), never those fixed
  durations, and shake/flash honor the Screen shake / Reduced motion / Reduce
  flashes settings. The invariants that actually held — nothing blocks input, a click
  always skips — are now stated as the rule. **Rewritten.** *(First pass restated
  the 300 ms bound as a default-speed truth; Sten's gate caught it — D2.)*
- §3.2's `sfx.js  (no-op stubs in v1)` row — the same dead fact's second home.
  **Rewritten; `audio.js` and `content/music.js` rows added.**
- §11 non-goals — three of nine clauses described shipped features: multiplayer
  (Forsaken Together LAN co-op, `docs/MULTIPLAYER.md` — self-hiding on `file://`
  builds, `src/net/lan.js:lanInfo()`), mobile layout (the narrow layout), audio.
  **Split into "still non-goals" and "shipped since."**
- §1 titled the game "Spire of the Erdtree" (heading and Working-title row) — the
  shipped title is **Ashen Spire** (`title.js:47` `ASHEN SPIRE`, bundle
  `dist/AshenSpire.html`). **Both fixed**, with a header note naming
  `docs/IP-SCRUB.md` as the authority for shipped names until the document-wide
  pre-scrub-vocabulary rename lands (finding 5 below).

Falsify any of it: `grep -n "no-op" SPEC.md` → 0 audio hits; `ls src/ui/audio.js
src/content/music.js src/net/lan.js`.

## Couplings found while sweeping (not SPEC claims — live defects/debts)

1. **`tools/runsim.mjs:117` crashes on dev.** It calls `resolveUnknownNode(REG, rng,
   { seenEvents })` without `act`, required since the map-anchors rework
   (`encounters.js:243` throws). The M3-acceptance tool ("all 3 classes can complete
   3-act runs") fails on every run: `node tools/runsim.mjs 2` → `CRASH reaver seed#1:
   Unknown mapConfig for act 'undefined'`, exit 1. Both sides individually valid; the
   pair is the defect — my coupling class exactly. One-argument fix, Rune's or Vira's
   call which side owns it.
2. **The boss-relic-choice claim rotted in two homes at once** (W9/W14) — a
   duplicated cache; whichever way Constantine rules (build the choice, or bless the
   single relic), one sentence should survive.
3. **`encounters.js:264` cites a SPEC sentence that doesn't exist** (shrine heal % —
   Rest section, reverse finding above).
4. **SPEC §3.2 places `floorplan.js` under `engine/`; it lives at
   `src/model/floorplan.js`** — and SPEC §6:536 cites the correct path, so SPEC
   disagrees with itself. Map section's ground; recorded, not edited here.
5. **SPEC's vocabulary is pre-scrub document-wide** (runes/Vagabond/Erdtree/Scarlet
   Rot/Watchful Omen/…, vs shipped cinders/Reaver/Goldbough/Crimson Blight/Fell
   Warden — `docs/IP-SCRUB.md` is the map). One rename act, not per-section nibbles;
   left intact so SPEC stays internally consistent until that act.

## Boundary of this sweep

Verified on this Linux runner only. Single-player shop/rest/reward screens have no
`?shot=` state, so their DOM was verified through the co-op shot variants plus the
engine paths (test 18) and build identity (`build/` ≡ `dist/` md5
`e3ad80d4de9cb2a6b00250672c74788e`; `verify-shipped: OK — 4 checks`). Audio was
verified as code + wiring, not with ears — Vega's seat, not mine. Play-feel of any
of it is Sunna's.
