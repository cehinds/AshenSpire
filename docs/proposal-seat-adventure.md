# The Seat as an adventure — design and implementation plan

*Design and plan, not a change. Per CONTRIBUTING rule 1, each phase below lands as
a SPEC PR first, then a feature branch into `dev` as a draft PR. Lore terms are
from [LORE.md](LORE.md). Owner's brief: 2026-09-11.*

## Part I — Design

### 1. Shape

An act is one **seat**: a region, its lower city, its citadel tower. The act has
three movements:

```text
THE ROAD  ──────────►  THE CITY  ──────────►  THE TOWER
seeded branching map   authored hub at ~50%   mini-run, 3–9 floors
fight · elite · camp   trader · smith · inn   gated floors · antechamber
wayfarer · quest       quest board · lore     boss from the seat pool
cache · delve          2–3 rolled sites       hearth-key relic · flame lit
```

Seat order is seeded (LORE §6). The causeway to the Ashen Spire opens from the seat climbed last (LORE §1).

### 2. The road

| Node | Decision | Implementation |
|---|---|---|
| Fight / Elite | lane, pool | unchanged |
| Camp | rest, upgrade, or *keep watch* (companion talk, a rumor) | today's shrine, renamed, with a third option |
| Wayfarer | one villager, one line of world, one choice | an event with `kind: 'wayfarer'`; short, 2 choices |
| Quest | accept a task with an objective on the road or in the city; the objective lights on the map and a lane leads to it (§2b) | World Journey quest rows, bound to road nodes |
| Cache | loot with a catch (pay cinders, a card, HP, or a companion's trust) | treasure node that opens an event before the reward |
| Caravan | small seat-specific shop, buys back | shop with a `caravan` stock profile |
| Delve | optional cave, 2–3 floors, one guardian, leave any time | World Journey local map, small; phase 6 |
| Unknown | rolls from the above | unchanged mechanism, new weights |

Suggested mix per seat (data, `typeWeights`): fight 35, wayfarer 15, camp 12,
cache 10, quest 8, elite 8, delve 6, caravan 6. Fixed rows: first floor fight,
city at ~0.50, treasure removed (the cache replaces it).

### 2b. Quest light — how a quest shows on the map

Today the map already answers "how much do you know about this node" on one
ladder (`hidden → placed → known`, `model/mapknowledge.js`) and already draws one
guided walk, the shrine lane, clipped to what the fog has revealed. A quest is a
**second light source and a second lane** on that same machinery. Nothing new is
invented; two rules are added to the ones that exist.

**Accepting a quest lights its objective.** The objective node lifts from
`hidden` straight to `known`: you were told what it is and where. Nothing else
lifts. Edges draw only when both ends are drawn (the existing rule), so the road
to it stays under fog — the node is unfogged, not the path.

**The quest lane.** From where the player stands, the forward walk to the
objective is computed exactly as the shrine lane is (same BFS, same
deterministic tie-break, recomputed on every mount, never stored) and painted
only where nodes are already drawn. It uses its own colour channel, distinct from
shrine gold and from the reachable ring, so it can never read as "you may step
here". One token, `--map-quest-lane`, judged against the same 3:1 rule as every
other map cue (proposal-45).

**Lookahead.** The lane also carries a little light of its own: the next `N`
floors of the walk ahead of the player lift from `hidden` to `placed` — a `?`
mark, "something is on the way" — never to `known`. `N` is data per quest
(default 2) so a long escort can be generous and a hunt can stay blind. This is
the "revealed x stages early" ask, kept at node level.

**Objectives chain.** A quest is a list of objectives; each has its own light and
lane in turn. Reaching one completes it and moves the lane to the next; the last
is usually the turn-in (a city quest board, a giver on the road). A completed
objective keeps a small mark so the map remembers what you did there.

**Out of reach.** The climb is forward-only. A fork that cuts the objective off
makes the lane vanish and marks the quest *out of reach this seat* on the board,
with the fork named. Whether it fails or carries to the city or the next seat is
per quest (data). Nothing silently disappears.

**Several quests.** Each accepted quest has a lane. Shared edges take the colour
of the nearer objective; at most two lanes paint at once, the rest show on the
board only. Settings → Display gains *Quest path glow*, default on, beside the
shrine toggle; reduced motion keeps the glow and drops the pulse.

**Fog invariant, unchanged.** Quest light is a *light source* (accepted
objectives, plus lookahead from where you stand), not a lane that paints through
fog. Accepted quests only grow and position only moves forward, so the light stays
monotone, which is the property the fog self-test asserts today.

**World Journey.** Same two rules over its terrain reveal: an accepted quest
marks its objective landmark on the parchment; roads stay unrevealed until walked.

### 3. The city

One authored city per seat. **Fixed sites**: Trader, Smith, Hearth-inn (the seat's
one full rest), Quest board, Lorekeeper (one page per visit, in a LORE §7 voice).
**Rolled sites**, 2–3 per visit from a seat pool: Card-teacher, Reliquary,
Recruiter, Physician, one Market-day / Gallows / Shrine event. No combat inside.
One visit; leaving is committed. Road flags open, close, or reprice sites, each
with a one-line reason shown on the site.

### 4. The tower

```text
gate ─ floor 1 ─ … ─ floor n ─ antechamber (camp) ─ BOSS ─ hearth
```

- Floors: tier 1 rolls 3–5, tier 2 4–7, tier 3 5–9. Each floor is a row of 1–3
  nodes from {fight, elite, cache, camp, wayfarer}. Camps are rare; one is fixed
  in the antechamber.
- Gates: a floor may require a key found on the road or bought in the city; the
  ungated alternative is harder, never absent.
- Boss: picked from the **seat pool** at seat birth (today's boss destinations),
  revealed on entering the tower. Each has a single form (today) and, phase 6, a
  **swarm form** (2–3 waves from the seat roster with the boss mechanic on the
  field).
- **Hearth-key**: the boss's unique relic. Collecting it plays the flame-lit
  sequence: tower unlit → flame at the crown → lower city's windows → (last seat
  only) the ring lit. Reduced motion shows the final frame.

| Seat | Boss | Hearth-key |
|---|---|---|
| Weald / Bastion | Fell Warden · Bell Keeper · Thorn Matriarch | Fell Warden Brand · *Cracked Clapper* · *Root Crown* |
| Marches / Citadel | Stitched King · Glass Regent · Marrow Organist | Crown of Stitches · *Regent's Shard* · *Ivory Key* |
| Reach / Observatory | Furnace Saint · Hollow Astronomer · Ashheart Dragon | Ember Idol · *Eclipse Lens* · Wyrm Heart |
| last seat, the causeway | Blighted Valkyrie | the Sovereign Ember (the ending, in the Spire's hearth-room) |

*Italic* = new relic.

### 5. Companions

One at a time. **Trust** is the stat: earned by choices, spent by asking them into a
fight they fear or a choice they oppose; at zero they leave at the next city.
They die only in fights they were asked into, under a rule shown beforehand.

| Build | A companion is | Cost |
|---|---|---|
| **A. Retinue** (ship first) | a passive relic + 1–2 companion cards in the deck while they travel | none new |
| **B. Ally seat** (later) | a second seat on the co-op combat board, scripted intents, small deck | an intent picker; the board exists |

### 6. Choice and consequence

Run history already gates events and choices. Extend the same grammar to four more
targets: a city site, a companion, the boss form, and the ending. Consequences
are legible on arrival ("The Physician's door is barred. He heard what watches
through your eyes."), nothing traps, and flags are run data declared as sidecar
requirements beside content, exactly as event requirements are.

### 7. Fixed vs rolled

| Authored per seat | Seeded per run |
|---|---|
| region, city, tower, boss pool, companion pool, voices, quest objectives and lookahead | seat order, road graph, node types, wayfarer draws, rolled sites, boss pick and form, floor count, caravan and card-teacher stock, which quests are offered |

## Part II — Implementation plan

Order is by dependency, then by payoff per unit of work. Sizes: S = a day or two,
M = a week, L = more. Every phase: SPEC PR → feature branch → draft PR into `dev`
→ `node --test tests/` green → `tools/runsim.mjs` at 300 seeds.

### Phase 0 — Seats (bind content to seat, not act) · M

The one change everything depends on. Today enemies, encounters, boss pools and
scenery bind to the act number.

| Change | Where |
|---|---|
| Seat ids `weald`, `marches`, `reach` → region ids `hollow-weald`, `pale-marches`, `cinder-reach` | new `content/seats.js` |
| Encounters gain `seat`; `act` stays as **tier** for `floorBand`/`targetBand` scaling | `content/encounters/act{1,2,3}.js` (act1→weald, act2→marches, act3→reach) |
| `rollEncounter` and `buildActMap` filter by `seat`, scale by tier | `engine/encounters.js:31`, `engine/actmap.js:56,71` |
| Run carries `seatOrder: [id,id,id]` and derives `seatId` from `actNumber`; `RUN_SCHEMA_VERSION` bump with migration: missing order ⇒ `['weald','marches','reach']` | `model/state.js`, `engine/save.js` |
| Seat order drawn from its **own rng stream** so every existing seed's maps are byte-identical | `engine/rng.js` streams, `engine/actmap.js` |
| Combat scenery: `regionForRun` returns the seat's region instead of seed-hash rotation; `ashen-crown` scenery reserved for the last tower | `model/environmentArt.js:11` |
| Boss labels and legacy boss table keyed by seat | `model/bossDestinationLabels.js`, `content/mapconfig.js LEGACY_ACT_BOSSES` |
| Custom Run: pin the first seat | `ui/screens/customRun.js` |
| Tests: seat filter, tier scaling, migration, seed stability (existing maps unchanged), pinned order | `tests/branchingBosses.test.mjs`, `tests/engine.test.js`, new `tests/seats.test.mjs` |

SPEC: §13 Seats (landed with the 0.7 SPEC PR); §3.11 gains the `seats` stream.

### Phase 1 — The tower · M

| Change | Where |
|---|---|
| `mapConfigs[tier].tower`: `{ floors: {min,max}, rowWidth: {min,max}, typeWeights, antechamber: 'camp' }` | `content/mapconfig.js` |
| `buildActMap` appends the tower segment above the road; the boss node stays the graph's terminal; tower nodes carry `segment: 'tower'` | `engine/actmap.js` (the one boot path; no second copy) |
| Map screen renders the tower as a narrow stack with a gate divider; boss revealed on gate entry | `ui/screens/map.js`, `model/mapview.js` |
| Encounter rows gain `hearthKey: relicId`; boss reward plan guarantees it | `content/encounters/*`, `model/rewardplan.js`, `content/relics.js` (+5 relics) |
| Flame-lit sequence: `content/hearthSequences.js` (frames per seat, `last` variant), `ui/screens/hearth.js` on `presentationSequence.js`, reduced-motion = final frame; art through `ui/assets.js` | new files; assets `assets/bg/hearth-<seat>-{0..3}.webp` |
| Tests: floor count bands, antechamber fixed, boss terminal, hearth-key always in the reward plan, sequence frame order, reduced motion | new `tests/tower.test.mjs`, `tests/reward-confirm.test.mjs` |

Art: 3 seats × 3 frames + 1 ring frame = 10 WebP at 1586×992, same pipeline as the
River Citadel pair.

### Phase 2 — The city · M

| Change | Where |
|---|---|
| Fixed row `{ at: 'fraction', of: 0.5, type: 'city' }`; node type `city` | `content/mapconfig.js floorRules` |
| `content/cities.js`: per seat `{ fixed: [...], rolledPool: [{siteId, weight}], rolledCount }` and site rows with a `handler` from the atlas service handlers (`shop`, `smith`, `rest`, `lore`) plus new `quests`, `teacher`, `reliquary`, `recruiter`, `physician`, `event` | new; validated in `model/schemas.js`, `model/validate.js` |
| City screen composes existing panels: `shop.js`, `rest.js` (inn = full heal, once), `smithServices.js`, World Journey quest actions (`model/worldAtlas.js questAction`), event screen for rolled events | new `ui/screens/city.js` |
| Rolled sites drawn from a `city` rng stream at seat birth, saved on the run | `engine/actmap.js`, `model/state.js` |
| One-visit rule; leaving commits | run state flag |
| Tests: city at 0.5 on every seed, rolled count and weights, one full rest, reload keeps rolled sites and stock, no combat inside | new `tests/city.test.mjs` |

### Phase 3 — Road vocabulary · S

| Change | Where |
|---|---|
| Node types `wayfarer`, `cache`, `caravan`; `camp` as the presented name of shrine with a third option | `content/mapconfig.js typeWeights/unknownWeights`, `ui/screens/map.js` glyphs |
| Wayfarer = event with `kind: 'wayfarer'`, ≤2 choices, 1 line; ~8 per seat in LORE §7 voices | `content/events.js` |
| Cache = treasure that first opens a `kind: 'cache'` event (the catch), then the reward menu | `engine/encounters.js resolveUnknownNode`, `ui/screens/reward.js` |
| Caravan = `buildShopStock` with a `caravan` profile (small, seat-flavored) | `engine/encounters.js:193`, `content/balance.js` |
| Remove the fixed treasure row | `content/mapconfig.js` |
| Tests: weights sum, wayfarer length rule enforced by `validateContent`, cache always yields a reward path | `tests/engine.test.js` |

### Phase 3b — Quest light · S

| Change | Where |
|---|---|
| Quest row: `objectives: [{ target: nodeId or { type }, lookahead: 2, onCutOff: 'fail' or 'carry' }]`, `laneKind` | `content/quests.js` (classic) / atlas `quests` table (World Journey); schema + validate |
| Run state `quests: { [questId]: { state: 'accepted' or 'done' or 'cutOff', objectiveIndex } }`; accept/complete/turn-in are run facts like event choices | `model/quests.js`, `model/state.js` |
| `litNodes` gains two sources: accepted objectives (→ `known`) and lane lookahead (→ `placed`); `questLane` beside `shrineLane`, same BFS | `model/mapknowledge.js` |
| Board clips the quest lane to drawn nodes exactly as the shrine lane; per-lane class and colour token; done-mark on completed objectives | `ui/components/mapboard.js`, `styles/map.css`, `--map-quest-lane` |
| Settings → Display · Quest path glow, default on; reduced-motion rule | `ui/screens/settings.js`, `model/mapknowledge.js resolveQuestGlow` |
| Cut-off detection: objective unreachable from the current node ⇒ `cutOff`; the board names the fork | `model/mapknowledge.js`, quest board UI |
| Fog self-test asserts lane containment and light monotonicity with quests on | `tools/mapfog.mjs --selftest` |
| Tests: accept lights only the objective, lookahead never yields `known`, lane never paints a hidden node, two-lane cap, cut-off names the fork, save round-trip | new `tests/questLight.test.mjs` |

### Phase 4 — Consequence targets · S

| Change | Where |
|---|---|
| Sidecars beside content, same `{ all?, any?, none? }` grammar: `citySiteRequirements[siteId]`, `bossFormRequirements[encounterId]`, `companionRequirements[companionId]`, each with a `reason` line | `content/cities.js`, `content/encounters/*`, `content/companions.js` |
| One evaluator: `eventChoiceRequirementMet(requirement, run)` already takes a subject; reuse, no new engine | `model/quests.js:124` |
| Ending tally: `run.hearths[seatId] = { fed: 'cinders' | 'companion' | 'self' }` written at each hearth; the last antechamber wayfarer reads it; the Valkyrie fight's variant and the game-over text read it | `model/state.js`, `content/events.js`, `ui/screens/gameover.js` |
| Tests: a barred site shows its reason, gated boss form, tally persists across save | `tests/city.test.mjs`, `tests/branchingBosses.test.mjs` |

### Phase 5 — Companions A (retinue) · M

| Change | Where |
|---|---|
| `content/companions.js`: `{ id, seat, name, voice, portrait, relicId, cardIds, trustStart, opposes: [{ eventId, choiceId, delta }], fears: [encounterIds], deathRule }` | new; schema + validate |
| Run state `companion: { id, trust } | null`; recruit adds the relic and cards (instances tagged `companionId`), leaving removes both; trust ticks on choices and camp talk | `model/state.js`, `engine/actions.js` |
| Recruiter site and wayfarer offers gated by phase 4 requirements | `content/cities.js`, `content/events.js` |
| HUD: companion badge in the identity cluster; camp gains **Keep watch** | `ui/components`, `ui/screens/rest.js` |
| Tests: recruit/leave symmetry (deck and relics restored), trust floor leaves at the next city, death only in feared fights and only under the stated rule | new `tests/companions.test.mjs` |

### Phase 6 — Later · L each

- **Swarm boss forms**: encounter `waves: [[ids], [ids]]` with the boss's field
  mechanic; seeded or forced by a phase 4 requirement.
- **Companions B**: an AI seat on `engine/coopCombat.js`; single-player wiring;
  the companion's small deck.
- **Delves**: small World Journey local maps hung off a road node; loot floors
  and one guardian; `tests/local-map.test.mjs` extends.
- **The drowned city**: a short fourth movement after the causeway — a handful
  of floors through the Ashen Spire's lower city on the `drowned-coast` region,
  no boss but the sea, ending in the hearth-room parley (LORE §6, §4). Needs its
  own SPEC entry; until then the causeway terminal and the ending scene carry it.

### Decisions taken in this plan (owner may override)

- Seat order seeded by default; Custom Run can pin the first seat.
- Camps heal less (30%) once the inn exists; the inn heals fully, once per seat.
- Companion death is per run.
- The ending tally is never shown as a number; one wayfarer tells it.

### What this plan does not touch

Combat rules, card pools, the co-op protocol, World Journey and Classic Climb as
shipped modes (the seat structure is a new profile beside them until proven), and
any save older than phase 0's migration.
