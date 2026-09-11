# Proposal — the Seat as an adventure: road, city, tower

*A design proposal, not a change. Mechanics here need SPEC entries before content
moves (CONTRIBUTING, SPEC-RECONCILE). It reframes the owner's brief of 2026-09-11 —
D&D-style nodes, a midway city, a tower mini-run, thematic boss pools, companions,
choice and consequence — against what the game already ships, so the delta is
honest. Lore terms are from [LORE.md](LORE.md).*

## 0. The brief, reframed

An act is one **seat** (LORE §1): a region, its lower city, its citadel tower. Today
an act is one branching map that ends in a boss. The proposal makes it three
movements with different rhythms:

```text
THE ROAD            THE CITY               THE TOWER
wilderness nodes    a hub at the midpoint  a mini-run of 3–9 floors
fights, camps,      trade, rest, smith,    gated floors, a boss from the
wayfarers, quests,  new cards, quest       seat's pool (or a swarm),
caches, delves      turn-ins, lore,        the hearth-key relic,
                    companions             the flame-lit slideshow
```

Three ideas carry the whole thing:

1. **Every node is a decision, not a fight** (GDD §5.1 already demands this). The
   road gets a wider vocabulary of node types, each with a distinct decision.
2. **The city is where consequences cash out.** What the player did on the road
   changes who is in the city, what it sells, and who will come with them.
3. **The tower is the seat's ending, told by the game.** A short run, a boss who
   holds the seat's largest cinder in an object, and the flame going up.

## 1. What already exists (build on it, do not rebuild it)

| Brief item | Already shipped | Where |
|---|---|---|
| Cities with services, quests, lore | World Journey: fixed city sites with shop, smith, rest and lore handlers; quest givers with objective and reward; local interior maps | `docs/WORLD-ATLAS.md`, `content/source/worldAtlas.json` |
| Dungeon with an interior and a boss | World Journey legacy dungeons: entrance, junction, objective, boss sites; explicit boss encounter required | same |
| Gated roads | `conditions` rows: a road opens when a world node is completed or a local point explored | same |
| Boss chosen from a thematic pool per act | Three or four boss destinations per act, seeded (Fell Courtyard / Bellfoundry / Briar Sanctum, …) | `src/content/bossDestinations.js` |
| Quests that remember choices | Run history of event choices; event- and choice-level history requirements; the Grave of the Nameless chain | SPEC §quest chains, `content/events.js` |
| Rewards opened before collected | Post-fight spoils menu | README |
| A second fighter beside you in one combat | Co-op seats: one shared combat, each seat its own deck, flask throw-to-ally, Mend at rest | `docs/MULTIPLAYER.md` |
| Lit / unlit tower art and a crossfade | River Citadel unlit→lit→hall entrance sequence, reduced-motion aware | `art/tower-entry-preview/README.md` |
| Unique boss relics | Fell Warden Brand, Crown of Stitches, Wyrm Heart, Warden Horn, Ember Idol | `src/content/relics.js` |

**Recommendation:** do not add a third run mode. Make the seat structure the
merger of Classic Climb's procedural map (the road) and World Journey's authored
places (the city, the tower). Classic and World Journey stay as they are until the
seat mode is proven; the seat mode is a new profile over the atlas tables plus a
procedural road generator, not a fork.

## 2. The road

A seeded branching map, as today, with a node vocabulary that reads like a
travelling party's day rather than a combat schedule.

| Node | The decision | Notes |
|---|---|---|
| **Fight** | which lane, which enemy pool | unchanged |
| **Elite** | risk for a guaranteed relic | unchanged |
| **Camp** | rest, upgrade, *or* keep watch (a companion's loyalty tick, a rumor) | replaces "shrine" naming on the road; the city has the real rest |
| **Wayfarer** | a passing villager, pilgrim, deserter: one short exchange, one choice | lore-delivery node; ~2 choices; may set a flag or offer a companion |
| **Quest** | accept a task with an objective elsewhere on the road or in the city | World Journey's quest rows, generalised to the road |
| **Cache** | random loot with a catch: a locked box (cost cinders / a card / HP), a corpse with a companion's initials on it | treasure with a decision attached |
| **Delve** | enter a cave: a local mini-map of 2–3 floors with loot and one guardian; leave any time | World Journey's local map, small; the guardian is an elite-tier pool pick |
| **Caravan** | a travelling merchant with a short, seat-specific stock | the road's shop; buys back |
| **Unknown** | rolls from the above | as today |

Rules:

- **Ratios are data per seat**, as `typeWeights` is today. Suggested road mix:
  fight 35, wayfarer 15, camp 12, cache 10, quest 8, elite 8, delve 6, caravan 6.
- **A delve is optional and bounded.** Two or three floors, three to five nodes
  each, one exit. It never gates the main road.
- **The wayfarer is the lore's main voice on the road.** One line of world, one
  choice, one consequence. It is the node form of card flavor (LORE §7): a
  fragment, never a lecture.
- **The road ends at the city.** The city is the midpoint, fixed by the road
  generator at ~50% of the seat's floors, as `treasure` is fixed at 0.64 today.

## 3. The city

One authored city per seat (LORE §1: the Bastion, the Citadel, the Observatory's
lower terraces). Fixed sites give the city its shape; **rolled sites** give each
run its difference.

**Fixed sites** (every run):

| Site | Does |
|---|---|
| **Trader** | buy/sell cards, relics, flasks, armaments; buys back at half (shipped) |
| **Smith** | upgrade, mount weapon arts (shipped) |
| **Hearth-inn** | full rest; companion talk; the one guaranteed rest of the seat |
| **Quest board** | accept city quests; turn in road quests for cinders, relics, or a card |
| **Lorekeeper** | a Warden's field-book, a Court ledger, a Chapel liturgy — read one page per visit (LORE §7 voices, delivered in place) |

**Rolled sites** (seeded from a per-seat pool; 2–3 per visit):

| Site | Does |
|---|---|
| **Card-teacher** | a named NPC offers three cards from a themed slice of the class pool; pick one |
| **Reliquary** | one relic from the seat's pool, for a price that is not cinders (a card, max HP, a companion's trust) |
| **Recruiter** | a companion is here *if* the road flags allow (§5) |
| **Physician** | remove a card or cure a status for cinders; sometimes "asks only a little flesh" |
| **Gallows / Shrine / Market day** | one-off events with a city-scale consequence: a hanging you can stop, a shrine that takes a card and gives a flask charge |

Rules:

- **Consequences cash out here.** A road flag can close a site, open one, change
  a price, or change who is standing at the recruiter. This is the cheapest place
  to make choice visible: one authored line and one site toggle.
- **The city is safe.** No combat inside, unless a quest sends one there.
- **One city visit per seat.** Leaving is committed; the road to the tower opens.

## 4. The tower

The tower is a **mini-run**: a stack of 3–9 floors (seeded, weighted by act tier),
each floor a small node row, ending in the boss.

```text
gate ─ floor 1 ─ floor 2 ─ … ─ antechamber ─ BOSS ─ hearth
```

- **Floor count** is data: tier 1 rolls 3–5, tier 2 4–7, tier 3 5–9.
- **Floor content** is a short row: 1–3 nodes from {fight, elite, cache, camp,
  wayfarer-inside-the-tower (a stitched courtier, a Chapel novice)}. Camps are
  rarer than on the road; one is guaranteed in the antechamber.
- **Gates**: a floor can be gated by a tower-key found on the road or bought in
  the city (World Journey `conditions`). Without it, the alternative floor is
  harder. Never a hard stop.
- **The boss** is chosen from the **seat's pool** at seat birth (as boss
  destinations are today) and revealed when the tower is entered. Each pool
  member has:
  - a **single-boss form** (today's fights), and
  - a **swarm form**: two or three waves from the seat's roster with the boss's
    mechanic on the field (the Bell Keeper's peal calling a wave, the Stitched
    King's Thousand Hands as a wave of Marionettes, the Furnace Saint's furnace
    opening between waves). Which form is seeded, or forced by a road flag.
- **The hearth-key.** The boss holds the seat's largest cinder in an object. That
  object is the boss's **unique relic** and, in lore, what lets the flame be lit.
  Killing the boss drops it; collecting it (rewards are opened before taken) is
  the trigger for the slideshow.

| Seat | Boss | Hearth-key (existing relic where one fits) |
|---|---|---|
| Bastion | Fell Warden | Fell Warden Brand |
| Bastion | Bell Keeper | *The Cracked Clapper* (new) |
| Bastion | Thorn Matriarch | *Root Crown* (new) |
| Citadel | Stitched King | Crown of Stitches |
| Citadel | Glass Regent | *The Regent's Shard* (new) |
| Citadel | Marrow Organist | *Ivory Key* (new) |
| Observatory | Furnace Saint | Ember Idol |
| Observatory | Hollow Astronomer | *Eclipse Lens* (new) |
| Observatory | Ashheart Dragon | Wyrm Heart |
| any (last seat) | Blighted Valkyrie | *the Sovereign Ember* — the run's ending, not a relic |

- **The flame-lit slideshow.** Three or four WebP frames per seat, crossfaded
  like the title entrance: the tower unlit → the flame at the crown → the lower
  city's windows catching → (last seat only) the viaduct ring lit and the Ember
  cornered. Reduced motion shows the final frame. The relic card sits over the
  last frame. Art exists for one seat's unlit/lit pair; the pattern is proven.

## 5. Companions

NPCs met on the road or in the city who come along if the player's choices earn
it, help in some fights and some quests, and can leave or die.

**Three ways to build them, cheapest first:**

| Option | What a companion is | Engine cost | Feel |
|---|---|---|---|
| **A. Retinue** | a relic-like passive plus 1–2 companion cards shuffled into the deck while they travel with you | none new: relics and cards exist | present but abstract |
| **B. Ally seat** | a second co-op seat in the shared combat, driven by a simple scripted intent picker, with its own small deck | co-op engine exists; needs an AI seat and single-player wiring | the companion is *on the field* |
| **C. Both** | A on the road, B in the fights they are scripted to join | A + B | the companion matters everywhere |

**Recommendation: ship A, design for B.** A gives the loop (recruit, keep, lose)
with zero new combat surface. B is the payoff and the co-op board already draws a
second seat, so the cost is the intent picker, not the UI.

Rules regardless of option:

- **Trust is the stat.** Earned by choices (wayfarer, quest, camp talk), spent
  by asking them into a fight they fear or a choice they oppose. At zero they
  leave at the next city. A companion has 2–3 authored lines of what they oppose.
- **One companion at a time** in v1. Choosing a second means dismissing the first
  (and their trust is not refunded).
- **Companions can die** only in fights they were asked into, and only under a
  rule the player can read beforehand ("if the wave reaches the third round").
- **Companions are seat-flavored.** A Bastion deserter, a Citadel surgeon who
  stitched the wrong people, an Observatory novice who was marked and lived.
  Each is one voice from LORE §7 and one open question from LORE §9.

## 6. Choice and consequence

The run history already records every committed event choice and gates events
and choices on it. The proposal generalises the gate to five targets:

| Target | Example |
|---|---|
| **Another event** | shipped (Grave of the Nameless chain) |
| **A city site** | you let the Blight-Priest watch through your eyes → the Physician will not treat you; the Reliquary offers something it should not |
| **A companion** | you paid the Stake of the Martyr with a card → the deserter who wanted that card gone joins; you silenced the bell → the bell-warden refuses you |
| **The boss form** | you rang the cracked bell on the road → the Bell Keeper comes as a swarm; you spared the Court Surgeon → the Stitched King fights alone |
| **The ending** | seat by seat, what you fed each hearth is tallied: cinders only, a companion's name, your own name. The last tower reads the tally (LORE §4: restore / claim / transform is decided by what you did, not a menu) |

Rules:

- **Consequences are legible on arrival, not at the choice.** The choice states
  its immediate cost; the city or tower shows what it changed, with one line
  saying why ("The Physician's door is barred. He heard what watches through your
  eyes."). Never a hidden penalty with no explanation.
- **Nothing traps.** Every gate has an alternative that is harder, never absent
  (World Journey's solvability rule).
- **Flags are run data**, saved with the run, and content-declared as sidecar
  requirements beside the event/site/boss rows, as event requirements are today.

## 7. Seeded uniqueness: what is fixed, what rolls

| Fixed per seat (authored) | Rolled per run (seeded) |
|---|---|
| region, city, tower, boss pool, companion pool, lore voices | seat order (LORE §6), road graph and node types, wayfarer draws, delve layouts, rolled city sites, boss pick and form, floor count, caravan and card-teacher stock |

## 8. Sequencing (suggested)

1. **Road vocabulary** — wayfarer, cache, camp, caravan as new node types over
   the classic generator; content is events and shop stock, no new engine.
2. **City midpoint** — fix a city node at ~50%; fixed sites from World Journey's
   handlers; two rolled sites from a pool.
3. **Tower mini-run** — floor stack, antechamber camp, boss reveal, hearth-key
   relic, slideshow (art per seat).
4. **Consequence targets** — extend history requirements to sites and boss form.
5. **Companions A** — retinue cards and trust.
6. **Swarm boss forms**, then **Companions B**, then **delves**.

Each step is a SPEC entry and its own branch. Steps 1–3 give the feel the brief
describes; 4–5 give it teeth.

## 9. Open decisions (the owner's)

- **Seat order seeded, or the first seat chosen at character creation?** Seeded
  gives variety; chosen lets a player learn one seat. Recommendation: seeded by
  default, with the Custom Run drawer allowing a pin.
- **Does the city's rest replace road camps' heal, or add to it?** Recommendation:
  camps heal less than today (30%), the hearth-inn heals fully, once.
- **Companion death: permanent per profile, or per run?** Recommendation: per run;
  the companion can be met again in another run with a line acknowledging it was
  a different climb.
- **Does the ending tally show?** Recommendation: never as a number; once, as the
  wayfarer at the last antechamber telling you what you fed the fires.
