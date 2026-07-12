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
- **S2 — Server-authoritative session** ⏳ `tools/session.mjs`: server runs the
  real run/map/rewards via the engine; intent protocol; browser thin-client
  mode. Headless protocol test drives 2 mock clients through a run.
- **S3 — Shared combat** ⏳ multi-player combat in the session; headcount
  scaling; party-wide debuffs; throw-potion; live join/leave rescale;
  solo-finish on drop.
- **S4 — Catch-up series** ⏳ per-member missed-node queue with rolled options;
  replay as reward/event screens on reconnect.
- **S5 — Polish** ⏳ fork voting, Mend at rest sites, co-op-only cards, host
  persistence to disk / resume.

## Constraints

- The single-file `dist/EldenSpire.html` has **no server**, so co-op requires
  the launcher (`run.bat` / `node tools/launch.mjs`). Solo play is unchanged
  and never depends on any of this.
- Nothing here touches the engine's public API — co-op is orchestration around
  the same primitives solo play uses.
