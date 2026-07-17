# Tarnished Together — LAN co-op design

The authoritative spec for EldenSpire's drop-in/drop-out LAN co-op. Built in
stages (see **Status** at the bottom). Read this first when resuming the work.

## Pillars (locked with the user)

1. **Shared fight, StS2-style.** All *present* players fight ONE combat together.
   Enemy HP scales to the live headcount; debuffs are party-wide (one player's
   Vulnerable helps everyone); potions can be thrown to allies; rest sites can
   Mend an ally.
2. **The run is persistent and player-independent.** The dungeon lives on the
   **launcher's Node server**, not in any browser. Players are bodies that
   attach/detach. Close every tab and the spire is still there on return; the
   fire burns as long as `run.bat` runs.
3. **Jump in / jump out, live.** Presence auto-scales the game:
   - **Drop mid-combat:** the leaver is removed from the fight *immediately*;
     enemies rescale **down** to the remaining connected count; the remaining
     player(s) finish the battle. If *everyone* drops, the combat suspends on
     the server until someone returns.
   - **Rejoin mid-combat:** the returner jumps straight back into the active
     fight at the next action window; enemies rescale **up**; they get a fresh
     hand/energy for the current turn.
4. **Retroactive catch-up as a series.** A member's progress cursor freezes on
   disconnect. While they're away, every node the party resolves that *would
   have* given them a choice (card reward, relic, event) is logged into that
   member's **catch-up queue** with the exact options that were rolled. On
   reconnect they resolve the queue as a sequence of normal reward/event
   screens, then snap to the party's current position — carrying the loot and
   HP/gold deltas they earned. No missed progression, no free power: they make
   the same choices, just after the fact.

## Authority & transport

- **Server-authoritative.** The engine (`src/engine/*`, `src/model/*`) is pure,
  dependency-free ES modules that already run in Node (tests, `runsim`). The
  server imports the *same* modules and runs the real run + combat: one RNG,
  one map, one combat state. Browsers are **thin clients** — they render server
  state and send *intents*.
- **Transport:** hand-rolled RFC6455 WebSocket at `/lan` (see `tools/lan.mjs`),
  text frames of JSON. No deps. UDP beacon on `:48711` for auto-discovery.
- **Discovery:** each launcher listens for beacons and exposes what it hears at
  `GET /api/lan/info`; hosting broadcasts a beacon every 2s. The game lists
  joinable fires with zero typing.

## Protocol (intents ↑ to server, events ↓ to clients)

Intents (client → server): `hello`, `pick` (class), `ready`, `seed`, `start`,
`chooseNode`, `playCard`, `endTurn`, `useFlask`, `throwFlask`, `chooseReward`,
`chooseEvent`, `catchupChoice`, `leave`.

Events (server → clients): `welcome`, `roster`, `start`, `state` (authoritative
snapshot / delta of the shared scene: map | combat | reward | event), `party`
(presence + progress strip), `catchup` (a member's pending queue), `hostGone`.

Design rule: clients never mutate game state locally. They send an intent and
wait for the server's `state`. This keeps determinism and makes drop/rejoin a
pure function of server state.

## Presence & scaling model

- A **member** is a persistent identity: `{ id, name, classId, deck, relics,
  flasks, hp, maxHp, gold, cursor, connected }`. Members persist across
  disconnects; `connected=false` freezes the character.
- **Combat headcount** = connected members. Enemy HP/scaling is computed from
  the connected count at fight start and recomputed on every live join/leave.
  Scaling curve: TBD in the combat stage (StS2 is sub-linear, not ×N).
- **Solo-finish on drop:** removing a member from combat drops their entities,
  energy, and hand; the fight continues for whoever's left.

## Stages (build order)

- **S1 — Foundation** ✅ discovery + lobby + WS transport. Intermediate: players
  currently launch the shared seed *independently* (client-local run) with a
  live party strip. Proves the pipe end-to-end. *(This is replaced by S2.)*
- **S2 — Server-authoritative session core** ✅ `tools/session.mjs`: the server
  runs the real shared run via the engine — one shared map/RNG, per-member
  build (own deck/relics/hp), headcount HP scaling (`coopHpMult`), per-member
  rewards, and the catch-up queue. Combat is an **injected resolver** seam
  (`resolveCombat(resolver)`) so S3 drops the live fight in without touching the
  loop. Proven headless by `tools/session-smoke.mjs` (18 checks: map → combat →
  rewards, drop-out rescale-down, catch-up accrual, reconnect replay).
  *Deferred to S3 (they're inseparable from combat rendering):* wiring the
  session into `tools/lan.mjs` over the WS protocol + the browser thin-client
  renderer. S1's client-local shared-seed run remains the playable intermediate
  until then.
- **S3 — Shared combat + thin client** ✅ *done end-to-end.* Wired the session
  into `tools/lan.mjs` over the WS intent protocol (chooseNode/playCard/endTurn/
  useFlask/chooseReward/shrineChoice/eventChoice/catchupChoice → server; `state`
  snapshots → all clients; drop marks the member absent and the run persists;
  `rejoinId` reconnects to the same body). Built the browser thin client
  `src/ui/screens/coop.js` — renders authoritative snapshots (map/combat/reward/
  shrine/event/catch-up/complete) and sends intents, never mutating locally.
  **Full visual parity with solo:** coop.js reuses the real components + CSS —
  `enemySprite`/`playerSprite`, the shared `renderCard`, the SVG node map, and
  the `.combat`/`.mapscreen` shells; only co-op extras are layered on (a seat per
  player, whose-turn flags, party read-out, throw/mend affordances). The snapshot
  carries what those need (full map graph, enemy statuses/poise, per-player hand
  instances). Verified live in 2-player across two launchers: real SVG map (53
  nodes) + parity combat board (sprites, real cards, intents, 2 seats), zero
  console errors. `tools/lan-smoke.mjs` (14) drives the server-authoritative run
  over the socket. *Original S3 server core:*
  `src/engine/coopCombat.js` is a standalone N-player fight engine reusing the
  solo opcode/status/trigger primitives (solo `combat.js` untouched, 23 tests
  green): shared enemies, per-player energy/hand/block, one shared player phase,
  enemy attacks fan out to every player, party-wide debuffs (automatic via the
  shared enemies), delayed enemy moves, headcount HP scaling, live join/leave
  rescale, last-player-drop → suspend. Wired into the session as the live combat
  (`combatPlay`/`combatEndTurn`/`combatFlask`, `settleCombat` with StS2 revive-
  at-1-HP-on-victory). Proven by `tools/coop-combat-smoke.mjs` (13) +
  `tools/session-smoke.mjs` (17, now driving the real fight). *Remaining:* wire
  the session into `tools/lan.mjs` over the WS intent protocol + the browser
  thin-client renderer (the last big UI piece). v1 combat gaps to revisit:
  poise/Stagger in the enemy turn, flask throw-to-ally (S5), and a once-per-
  combat relic shared by two players can mis-gate (trigger keys aren't player-
  scoped in `triggers.js`).
- **S4 — Catch-up series UI** ⏳ replay the per-member catch-up queue (already
  accrued by S2) as reward/event screens on reconnect. (Client renders it; a
  dedicated multi-step flow is the remaining polish.)
- **S5 — Polish** 🟡 *shipped:* Stagger in the co-op enemy turn (a poise-filled
  enemy loses its telegraphed move), **flask throw-to-ally** (a non-offensive
  flask lands on a chosen hero — armed in the client, delivered by clicking a
  seat), and **Mend at rest sites** (heal an ally 30% instead of resting).
  Verified live in real 2-player co-op across two launchers (cross-launcher
  discovery + real-time combat sync, zero console errors) and headless
  (`coop-combat-smoke` 17, `session-smoke` mend). *Also shipped:* **host
  disk-persist/resume** — the run serializes to `.coop-session.json` (gitignored)
  at every safe boundary (never mid-combat; a resumed run lands at the
  pre-combat node) and the launcher reloads it on startup; the lobby's host sees
  a "⟳ RESUME LAST RUN" button that re-seats connected clients as the saved
  members (`resumed` → the client learns its member id). Resume also re-attaches
  to a run still live in memory (host left the screen, not the server). Proven
  by `tools/session-resume-smoke.mjs` (10: JSON round-trip, RNG counters,
  refuses-to-persist-mid-fight) + `tools/lan-resume-smoke.mjs` (7: persist →
  server restart → load → resume over the socket) and live in the browser.
  *Also shipped:* **fork voting** — with 2+ present members every map pick is a
  vote (changeable until the last vote lands); majority wins, ties break toward
  the earliest-joined member (the host); a disconnect that completes a vote
  resolves it; solo routes instantly. The scene carries `votes` so every client
  shows vote pips (voters' class glyphs above the node), your vote ringed gold,
  and a VOTES n/m counter. *Also shipped:* **co-op-only cards** on a new `ally`
  target primitive (user-approved addition to the closed target set, SPEC §3.4):
  'ally' resolves to the explicitly aimed living teammate and **falls back to
  self in solo**, so every co-op card stays engine-valid everywhere. Cards in
  `src/content/cards/coop.js` (Rallying Banner / Shared Flame / Lord's Oath) at
  rarity `special` — excluded from class pools AND merchant stock; the co-op
  session appends one as an extra option to every combat reward while the party
  has 2+ living members. Client: clicking an ally card arms seat-aim (the
  flask-throw affordance). Proven: engine test 23 (solo fallback + pool
  exclusion), coop-combat-smoke (ally Block lands on the teammate, not the
  caster), session-smoke (party rewards carry a co-op option).

**Tarnished Together is feature-complete.** Known edge for a later pass: a
once-per-combat relic owned by BOTH players shares a trigger-state key
(`triggers.js` keys aren't player-scoped), so the first proc consumes it for
both. Cosmetic-scale; noted, not blocking.

## Constraints

- The single-file `dist/EldenSpire.html` has **no server**, so co-op requires
  the launcher (`run.bat` / `node tools/launch.mjs`). Solo play is unchanged
  and never depends on any of this.
- Nothing here touches the engine's public API — co-op is orchestration around
  the same primitives solo play uses.
