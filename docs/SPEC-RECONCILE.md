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

---

# Stage 2 — SPEC true about what 0.4.x ships

*Viki, 2026-08-07, at `dev` = `267397a` (release candidate). Track C of the 0.4.x
sequencing. Stage 1's rows are unchanged and still hold; **Saga's disclosure §4 cites this
file — the stage-1 section above was not renumbered or moved**, so that citation is intact.*

## What stage 2 found, in one sentence

**Stage 1's rot was dead paths; stage 2's rot is dead restatements — and the paths are now
clean.** A path-resolution sweep over the whole document returns **zero unresolved** (two
intentional placeholders: `encounters/actN.js`, an external `manifest.json`). Every defect
below is a sentence that *restated a value which has a home elsewhere* and drifted while
nobody edited it.

> **The rule adopted in this pass, and the reason six sections changed shape:**
> **a spec sentence states a CONTRACT (what must be true) or points at a HOME (what is
> currently true). It never restates a value that has a home.** A contract is a rule and
> cannot rot. A restated value is a cache with no write event — the thing this whole
> reconciliation exists to delete.

## Defects found and fixed

| § | What it claimed | Shipped truth | Falsifying command |
|---|---|---|---|
| 3.2 | A 52-file inventory of the tree | **92 `.js` under `src/`; 4 of the 52 dead** (three pre-scrub class card files; `floorplan.js` filed under `engine/` while §6 correctly cited `model/` — SPEC disagreed with itself). `tools/`, `content/source/`, `build/`, `dist/` absent entirely | `find src -name '*.js' \| wc -l` → 92 |
| 3.12 | Run keys + "settings and last 20 results"; field list restated in prose, carrying `runes` | **Three run slots; a durable profile with two schema versions (one home each), a verified-write mirror, a keyed archive index, quarantine, and a player-facing drawer** (#66/#67). Field list is data: `RUN_SHAPE` | `node tests/run-node.mjs` (profile-durability cases); `grep -n "RUN_SHAPE" src/model/state.js` |
| 3.14 | Five validation checks | Plus pairing/range rules, and **Law 1 clause 6 is built** (#64) | `node tools/content-build.mjs --selftest` → *16 known-bads red by name* |
| 4.4 | Bleed "**Threshold 12**", escalating ×1.5 | **Threshold 7, constant** — picked against the sim *after* this prose was written | `node -e "import('./src/content/statuses.js').then(m=>m.statuses.filter(s=>s.proc).forEach(s=>console.log(s.id,JSON.stringify(s.proc))))"` |
| 4.4 | A **Frostbite** status | **CUT — describes nothing.** No `frostbite` row ships | `…m.statuses.some(s=>s.id==='frostbite')` → `false` |
| 4.4 | "Scarlet Rot"; no Burn row | `crimsonBlight` / **Crimson Blight**; `burn` ships unlisted | the same status dump |
| 7.4 | Score + SFX content "lives in `music.js`" | **SFX recipes and `SFX_MANIFEST` moved to `content/sfx.js`** (#59/#46) — recipes are a table in a two-word closed vocabulary; a malformed layer names its recipe id | `grep -n "from '../content" src/ui/audio.js` → two content homes |
| 7.4 | — | `MUSIC_MANIFEST` **still** imported and never read (stage-1 finding, unchanged) | `grep -c "MUSIC_MANIFEST" src/ui/audio.js` → 1 |
| 7.5 | One palette, seven hexes | **Three palettes** — default, high-contrast, and `body.cb-safe` (Okabe-Ito) — plus `--map-structure` (#62/#45). Hexes no longer restated | `grep -nE "^\s*--" styles/base.css`; gate: `node tools/contrast-audit.mjs` |
| 7.5 | "Self-host the woff2 files" | **TO BUILD** — fonts are **not bundled**; `CREDITS.md` says so and is the authoritative home | `ls assets/fonts` → does not exist |
| 8 | 17 required tests; "**CI-less workflow**" | **47 passing cases across 43 declared test blocks**, two listed entries already false (test 7's threshold 12 / ×1.5; test 8's "Scarlet Rot"). **CI exists** | `node tests/run-node.mjs`; `ls .github/workflows/ci.yml` |
| 1 | "desktop browsers, 1280×720 minimum" | Contradicted §11 — **a narrow layout ships**; 1280×720 is the layout *reference* | `grep -n "data-layout" src/main.js` |
| 1 | Persistence = run save + settings + history | Understated the profile subsystem | §3.12 |

**Counts, stage 2: 13 claims corrected — 11 rewritten to the shipped truth, 1 marked CUT
(Frostbite), 1 marked TO-BUILD (self-hosted fonts).** Six sections (§1, §3.2, §3.12, §3.14,
§4.4, §7.4, §7.5, §8) changed from restatement to contract-plus-pointer.

## Verified unchanged (checked, not assumed)

Path resolution across the document (0 unresolved); the **inward-import layer rule** now
asserted in §3.2 — `content` imports nothing, `model`/`engine` never import `ui` — verified by
grep before it was written down; `verify-shipped: OK`; suite green at the release SHA.

## Standing debts, unchanged and named

1. **Pre-scrub vocabulary, document-wide** — 24 remaining hits
   (`grep -cE "runes|Vagabond|Astrologer|Prophet|Erdtree|Scarlet Rot" SPEC.md`). One
   deliberate rename act; now stated once in the header as **to-build** rather than
   apologised for per section.
2. **The dangling unlock refs** (`graveWardenUnlock`, `ashChildUnlock` → classes that do not
   exist; green because the ref check is written per *known* kind) — **still open, and it is
   a code/test defect, not a SPEC defect.** It does not belong in a documentation pass:
   fixing it means changing a test's shape, which needs its own gate. **Vira's dispatch,
   handed over deliberately** — she offered, it is her lens, and the check she would write
   (unknown kind = error, not skip) is the general form, not the two rows.

## Boundary of stage 2

Read at `267397a` on one Linux runner. Suite and the named tools re-run by me; **nothing
rendered and nothing played** — no screen was opened in this pass, so every UI claim above is
a claim about source and settings wiring, not about pixels. Audio verified as code, not with
ears (Vega's). The profile-durability properties are stated from source and the suite's own
cases; I did not corrupt a real browser profile to watch the recovery surface behave — that is
the one gap I would most want closed before the release SHA is called good, and it is Sunna's
and Vira's ground, not mine.

---

# Stage 2b — rebased onto the merged release tree

*Viki, 2026-08-07. Stage 2 was written at `267397a`; five branches merged before it landed, so
it is rebased onto `dev` = `2c0a716` and every falsifier re-run against the tree that will
actually ship. Last in Marina's release order on purpose — so the spec describes the merged
tree rather than a state that never existed.*

## Re-run at `2c0a716`: every stage-2 falsifier still holds — except my own counts

| Falsifier | Result |
|---|---|
| Path resolution, whole document | **0 unresolved** (two intentional placeholders) |
| `frostbite` status exists? | `false` — the CUT verdict stands |
| `MUSIC_MANIFEST` uses in `audio.js` | **1** (the import; zero reads) — unchanged through three audio moves |
| `ls assets/fonts` | absent — fonts still TO-BUILD |
| Pre-scrub vocabulary debt | **24** — unchanged |
| Suite / `verify-shipped` / `content-build --selftest` | 48/0 · OK, 4 checks · 16 known-bads red by name |

**And the three that moved were mine.** `src/` went 92 → **94**, the suite 47 → **48**, test
blocks 43 → **44**, in four days. I had written those counts into the prose that *explains why
counts do not belong in prose*.

> **Fixed by naming the expiry, not by bumping the number.** Both now read as dated
> measurements — *"52 listed against 92 shipped, measured at `267397a`; `src/` held 94 two
> commits later, which is the point"* — because a measurement pinned to a SHA is a historical
> observation and cannot rot, while a bare count is the next cache. Same discipline the CI
> header ruling used: a number that names its own expiry is the opposite of the header it
> fixes.

## What the five merged branches changed in SPEC

| Merge | SPEC effect |
|---|---|
| **#71** sfx orphan ids | **§7.4 rewritten a third time.** "One recipe per hook id" is now false: ids are **composed**, and `resolveRecipe` is one pure function with three steps — **exact → family (segment before the first `_`) → `default`** — so `procBurst_bleed` plays its own row, an unauthored proc still sounds like a burst, and the fallback **warns once per unknown id**. Authoring a family is one row, no engine change, no registration list. *Falsified by:* `resolveRecipe('procBurst_nosuch')` → matched `procBurst`, `fellBack: false` (run; it does). |
| **#73** disclosure one home | **New §2.1** — the second shipped subsystem this reconciliation found with no SPEC home (after profile durability). One home (`src/content/aiDisclosure.js`), two surfaces (Settings → About; the Steam field printed by `tools/ai-disclosure.mjs`), a drift gate that fails on a stale bundle, and the runtime claim as a **single named string** given to both the player and the falsifier. **`approved: false` is stated, because the spec says what is true** — it records whose words these are, is read by nothing at render time, and is a release gate rather than a display condition. ***(Value moved 2026-08-07: Constantine approved the wording, so the module and SPEC §2.1 now read `approved: true`. This row records what #73 did and is left standing; it is the third prose copy of one boolean and nothing syncs the three — named in SPEC §2.1. — Saga)*** ***(Moved again 2026-09-03, AS-HD-040: the class art was replaced with AI-generated images, which made the approved wording's "no image-generation model was used" false. The text was corrected, so the module returned to `approved: false` under its own rule and is back with Constantine. SPEC §2.1 no longer restates the value — it cites the module, which is the fix Saga named above. This row remains the last prose copy: read the module, not this sentence.)*** |
| **#69/#72** release shots | **§8 gains the harness distinction.** `screenshot.mjs` photographs the **source tree** and is structurally blind to any surface without a `?shot=` state; `release-shots.mjs` photographs the **built bundle**, derives coverage from `main.js`'s states so a new one cannot be silently missed, excludes five co-op states **by name**, and **fails before the browser starts** on an unlisted state. The artifact is never modified to reach a state. Failure lines name floats and screens separately. |
| **#70** float clamp | No SPEC claim moved — §7.4's floating-number bullet states the behaviour, never the width. The CSS owning the width is exactly what the section already implied. Recorded as *checked, unchanged*. |

## The instrument law — now §8's clause 5

**Marina's audit trigger fired on three lying greens in one week**: a harness blind to five
player-facing surfaces, a driver returning exit 0 against broken code, and a disclosure check
covering one text of seven. Each was accurate about what it measured and silent about its own
hole. The law shipping out of it is now written where this project says how it knows things:

> **Every release-gating instrument prints what it did NOT check, in its run output — not only
> in its header.**

It belongs in §8 rather than in a log because §8 is the section a person reads when deciding
whether a green means anything. **A boundary in a file header is read by the author; a boundary
in the output is read by whoever is about to trust the result.**

## Boundary of stage 2b

Rebased and re-run on one Linux runner. **Nothing rendered:** I did not run
`release-shots.mjs` or open a browser, so §8's description of it is read from its source and
its own header, not watched. The disclosure gate I *did* run (`--check`, exit 0, 8 texts × 2
bundles). The profile-recovery gap named in stage 2 is still open and still not mine.
