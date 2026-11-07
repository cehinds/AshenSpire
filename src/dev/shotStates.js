// Dev-only `?shot=` pose ladder, moved out of src/main.js (review H4 seam (a)).
//
// Every state a capture instrument can pose lives here, and this module is loaded
// by a dynamic import only when `?shot=` is set (src/main.js), so a normal boot
// neither fetches nor parses it. `createShotStates(ctx)` returns a plain
// `{ [state]: fn }` table; showFirstScreen() calls the entry for the state asked
// and falls through to the ordinary first screen when there is none.
//
// WHAT COMES IN THROUGH `ctx`: functions and consts of main.js's module scope
// as-is (`ctx.showMap`, `ctx.saves`, ...), and the mutable `let` bindings
// (`run`, `rng`, `registries`, `activeMeta`, `activeSettings`,
// `shotPoiseMaxOverride`) through explicit getter/setter pairs, so an
// assignment here reaches main.js's binding and never writes a local.
import { awardLevelXp, xpToNext as levelXpToNext } from './../model/levelup.js';
import { SLOTS, runKey } from './../engine/save.js';
import { addToStorage } from './../model/loadout.js';
import { createDeck, createIdGen } from './../model/state.js';
import { buildBlacksmithStock } from './../engine/shopKinds.js';
import { mountGameOver } from './../ui/screens/gameover.js';
import { mountCompendium } from './../ui/screens/compendium.js';
import { gameModule } from './../model/gameProfile.js';
import { isConfiguredRun } from './../model/gameProfileRun.js';
import { screenshotRoutePath } from './../ui/models/ScreenshotFixtureModel.js';
import { configureArmamentKitPreview } from './armamentKitPreview.js';

export function createShotStates(ctx) {
  const {
    saves, shotParams, bootStorage, app,
    newRun, showMap, enterCombat, startFight, showEvent, persist, showRest, showShop,
    beginGameProfileReward, poseFxShowcase, showTitle, showHistory, showProfile,
    showSettings, showStartupGate, showCustomize,
  } = ctx;

  // The posed states that need a started run: shared preamble, then the per-state
  // sub-branch. Moved verbatim from showFirstScreen().
  function poseRunState(name) {
    // Suppress the first-run tutorial so captures show a clean board.
    const shotMeta = saves.loadMeta();
    shotMeta.settings.seenTutorial = true;
    saves.saveMeta(shotMeta);
    // `?shotSeed=<string>` — ONE MAP IS NOT THE MAP (EldenSpire#28).
    //
    // Every reachability measurement this repo has taken of the act map was taken
    // on the seed literal that used to sit here, so "0 covered at 390x844" was a
    // fact about ONE map graph. Node positions are a function of the seed; a node
    // trapped under a floating button is a coincidence between the two; and a
    // coincidence measured once is an anecdote. tools/mapreach.mjs sweeps seeds
    // because of this line, and the default is unchanged so every existing
    // capture and every existing sweep still means what it meant.
    //
    // Read through `shotParams`, the single const declared beside pickStorage() —
    // NOT a fresh location.search read, which the note up there forbids, for the
    // reason it gives: that const IS the gate's reach.
    const shotClass = shotParams.get('shotClass');
    newRun({ classId: ctx.getRegistries().classes.all().some(c => c.id === shotClass) ? shotClass : 'reaver', seedString: shotParams.get('shotSeed') || 'SHOWCASE', slot: 1 });
    const run = ctx.getRun();
    // In-memory QA fixture: earned attribute points. Feats come from actual claims.
    if (shotParams.get('shotProgression') === '1') {
      awardLevelXp(ctx.getRegistries(), run, levelXpToNext(ctx.getRegistries(), 1), { pointsPerLevel: 2 });
      showMap();
    }
    // `?shotNewerSlot=<n>` — STAND BESIDE A CLIMB FROM A NEWER BUILD. Slot n
    // gets slot 1's own bytes (the real writer's, just persisted by newRun) with
    // the schema one ahead, so the in-run Load door meets exactly what a newer
    // build leaves behind (SPEC §3.12). Memory storage only: a shot boot's
    // storage is the stub, so no durable byte is involved.
    // tools/slot-load-door.mjs is the reader.
    const shotNewerSlot = Number(shotParams.get('shotNewerSlot'));
    if (Number.isInteger(shotNewerSlot) && shotNewerSlot > 1 && shotNewerSlot <= SLOTS) {
      const bytes = JSON.parse(bootStorage.getItem(runKey(1)));
      bootStorage.setItem(runKey(shotNewerSlot), JSON.stringify({ ...bytes, schemaVersion: bytes.schemaVersion + 1 }));
      // The same rewrite on demand, for a newer build in another tab writing a
      // slot while this tab's load confirmation is still open.
      window.__shotAgeSlot = (slot) => {
        const aged = JSON.parse(bootStorage.getItem(runKey(slot)));
        bootStorage.setItem(runKey(slot), JSON.stringify({ ...aged, schemaVersion: aged.schemaVersion + 1 }));
      };
    }
    // `?shotRefusedSlot=<n>` — STAND BESIDE A CLIMB THIS BUILD REFUSES. Slot n
    // gets slot 1's bytes with a seat order no registry holds: slotSummary
    // parses it (the picker offers it as a climb), loadRun's content validation
    // refuses and archives it (SPEC §3.12). Memory storage only, as above.
    // tools/slot-load-door.mjs is the reader.
    const shotRefusedSlot = Number(shotParams.get('shotRefusedSlot'));
    if (Number.isInteger(shotRefusedSlot) && shotRefusedSlot > 1 && shotRefusedSlot <= SLOTS) {
      const bytes = JSON.parse(bootStorage.getItem(runKey(1)));
      bootStorage.setItem(runKey(shotRefusedSlot), JSON.stringify({ ...bytes, seatOrder: ['no-such-seat'] }));
    }
    if (name === 'combat' && shotParams.get('shotKit') === '1') {
      configureArmamentKitPreview(ctx.getRegistries(), run, shotParams.get('shotMainHand'), shotParams.get('shotOffHand'));
    }
    // ---- THE POOL REACH DOORS, AT ONE SITE FOR EVERY SCREEN THAT DRAWS A HUD ---
    //
    // `?shotMaxHp` / `?shotMaxMana` / `?shotMaxStamina` / `?shotMana` — STAND AT A
    // DIFFERENT MAXIMUM.
    //
    // A REACH STATE, exactly the shape and reason as `?shotAt` and `?shotEvent`
    // below. His bar-scaling rule ("the size of that bar should scale depending on
    // the max total") is a claim about how the HUD behaves ACROSS maxima, and no
    // instrument could vary a maximum: every capture this repo has ever taken of
    // the HUD was taken at the reaver's own numbers. One max is not the scale, in
    // the same way one map is not the map. These are the levers tools/hudbars.mjs
    // and tools/hudparity.mjs sweep, and the proof that a bar's length tracks the
    // number is worth nothing without them.
    //
    // They move the RUN's fields, which are the same fields a curse and an armour
    // mod move (actions.js runMods, loadout.js) — so a value enters through the
    // door a real maximum enters, never through the renderer.
    //
    // MOVED HERE 2026-08-22 (E9 / #254) FROM INSIDE THE `combat|fx` BRANCH, and
    // the move is the point: the map now draws the SAME HUD through the same
    // renderer, and a lever that reaches one screen and not the other cannot ask
    // whether the two agree — the instrument would be comparing a posed combat
    // screen against an unposed map. One site, every `?shot=` state that shows a
    // HUD. THE WIDENING IS REAL AND DELIBERATE: states that never read these
    // params before (reward, shop, rest, event, death) now do. They are dev-only
    // reach params on a boot that cannot touch a save, and a per-state allow-list
    // here would be a second copy of the state list above.
    const shotMaxHp = Number(shotParams.get('shotMaxHp'));
    if (Number.isFinite(shotMaxHp) && shotMaxHp > 0) {
      run.maxHp = Math.floor(shotMaxHp);
      run.hp = Math.min(run.hp, run.maxHp);
    }
    // Current mana enters through the run, before combat entity creation; the
    // renderer never receives a fabricated value.
    const shotMana = Number(shotParams.get('shotMana'));
    if (shotParams.has('shotMana') && Number.isFinite(shotMana)) {
      run.mana = Math.max(0, Math.min(run.maxMana, Math.floor(shotMana)));
    }
    const shotMaxMana = Number(shotParams.get('shotMaxMana'));
    if (Number.isFinite(shotMaxMana) && shotMaxMana > 0) {
      run.maxMana = Math.floor(shotMaxMana);
      run.mana = Math.min(run.mana, run.maxMana);
    }
    const shotMaxStamina = Number(shotParams.get('shotMaxStamina'));
    if (Number.isFinite(shotMaxStamina) && shotMaxStamina > 0) {
      run.maxStamina = Math.floor(shotMaxStamina);
      run.stamina = Math.min(run.stamina, run.maxStamina);
    }
    // `newRun()` ends in `startClimb()` -> `showMap()`, so on the map state the
    // screen is ALREADY DRAWN by the time the lines above run. Re-draw it, or the
    // photograph shows the un-posed character while the URL says otherwise — the
    // exact silent-lie shape that cost a whole set of E9 frames on 2026-08-22
    // (gamedesign/sunna/log/2026/2026-08-22_the-caps-that-were-never-reachable.md).
    // Guarded on a door actually having fired so an ordinary `?shot=map` mounts
    // once, as it always has.
    const posedPools = ['shotMaxHp', 'shotMana', 'shotMaxMana', 'shotMaxStamina']
      .some((k) => shotParams.has(k));
    if (posedPools && name === 'map') showMap();
    // `?shotCarried=<flaskId,...>` — CARRY POTIONS ON THE MAP. The map pose
    // carries none, so its Potions minis and the run HUD's carried icons had
    // nothing to open; tools/flask-menu-probe.mjs compares their menus with the
    // shared plan. Unknown ids are skipped; the map is redrawn, as above.
    const shotCarried = name === 'map' ? shotParams.get('shotCarried') : null;
    if (shotCarried) {
      run.flasks = shotCarried.split(',').filter((id) => ctx.getRegistries().flasks.has(id)).map((flaskId) => ({ flaskId }));
      showMap();
    }
    // `?shotAt=<nodeId|floor:N>` — STAND SOMEWHERE ON THE MAP.
    //
    // A REACH STATE, same shape and same reason as `?shotEvent` above. Every map
    // measurement this repo has ever taken was taken at the entrance row, because
    // that is the only map position any instrument could open — so "the framing
    // hides a next-step option" was 12 numbers about one screen out of thirteen.
    // The framing MID-CLIMB is a different problem with a different shape (the
    // fan-out from one node, not the spread of the doors), and it could not be
    // measured at all. `floor:N` picks a node on that floor rather than naming an
    // id, so a sweep can walk the act without knowing the graph first.
    //
    // `?shotStorage=full` — STAND AT THE CAP.
    //
    // A REACH STATE, the same shape and reason as `?shotMaxHp`: the full-bag
    // refusal (the ninth armament against an 8-slot cap) is a claim about how
    // the reward menu behaves AT the storage boundary, and no instrument could
    // fill a bag — a fresh shot run always has room, so every capture ever
    // taken of the armament row was taken with slots free, and "refused
    // legibly" and "silently claimed-but-not-stored" read identically (#290
    // review at b6b7df0: collectArmament ignored addToStorage's false and
    // could poison meta.found with a piece the bag refused). The bag fills
    // THROUGH THE REAL WRITER — addToStorage, the same door every real drop
    // enters, its own cap and duplicate rules deciding what fits — never by
    // assigning the array.
    if ((name === 'map' || name === 'reward') && shotParams.get('shotStorage') === 'full') {
      const cap = ctx.getRegistries().balance.equipment.storageSlots || 8;
      for (const piece of ctx.getRegistries().equipment.armaments) {
        if ((run.loadout.storage || []).length >= cap) break;
        addToStorage(run.loadout, piece.id, cap);
      }
    }
    const shotAt = name === 'map' ? shotParams.get('shotAt') : null;
    if (shotAt) {
      const g = run.mapGraph;
      const byFloor = /^floor:(\d+)$/.exec(shotAt);
      const at = byFloor
        ? Object.values(g.nodes).filter((n) => n.floor === Number(byFloor[1])).map((n) => n.id)[0]
        : (g.nodes[shotAt] ? shotAt : null);
      if (!at) throw new Error(`?shotAt=${shotAt}: no such node in this act. Use a node id (n4_2) or floor:N — a silent fallback here would report a framing measured somewhere else.`);
      run.mapNodeId = at;
      run.floor = g.nodes[at].floor;
      run.path = [at];
      showMap();
    }
    // `?shotWalk=<n>` — STAND SOMEWHERE WITH A TRAIL BEHIND YOU.
    //
    // A REACH STATE, and the third of the same shape (`?shotEvent`, `?shotAt`).
    // `?shotAt` teleports: it sets `run.path = [at]`, a path of length one, which
    // is the right answer for a FRAMING measurement and the wrong one for
    // everything about fog. Fog is a function of the trail — "previously visited
    // locations remain revealed" — so a map posed with no history can only ever
    // photograph the first frame of it, and the one claim worth photographing is
    // that the light MOVES and the trail STAYS.
    //
    // It walks the graph rather than naming nodes: from the first entrance, take
    // the lowest-numbered `next` each step, n times. Deterministic given the seed,
    // so two runs of the camera produce the same picture; and it uses the graph's
    // own edges, so a walk this produces is a walk a player could have taken —
    // a hand-written path list would eventually name an edge that does not exist
    // and pose a state the game cannot reach.
    const shotWalk = name === 'map' ? shotParams.get('shotWalk') : null;
    if (shotWalk != null) {
      if (shotAt) throw new Error('?shotWalk and ?shotAt both set: they pose the same thing two ways. Use one — shotAt teleports, shotWalk leaves a trail.');
      const steps = Number(shotWalk);
      if (!Number.isInteger(steps) || steps < 1) {
        throw new Error(`?shotWalk=${shotWalk}: needs a positive whole number of steps. A silent fallback would photograph a different map than the one asked for.`);
      }
      const g = run.mapGraph;
      let id = [...g.startIds].sort()[0];
      const walked = [id];
      for (let i = 1; i < steps; i++) {
        const next = [...(g.nodes[id].next || [])].sort();
        // Running out of graph is LOUD. A walk that quietly stopped short would
        // hand back a screenshot of floor 4 labelled floor 9, and the reader would
        // have no way to tell.
        if (!next.length) throw new Error(`?shotWalk=${steps}: this act runs out at step ${i} (${id} has nowhere to go). The boss is the last node; ask for fewer steps.`);
        id = next[0];
        walked.push(id);
      }
      run.mapNodeId = id;
      run.floor = g.nodes[id].floor;
      run.path = walked;
      showMap();
    }
    if (name === 'death') {
      // A run that ended on floor 4 with a few fights behind it, so the stats
      // table has real numbers under the title instead of a row of zeroes.
      run.floor = 4;
      run.stats.fightsWon = 3;
      run.stats.damageDealt = 214;
      run.stats.damageTaken = 96;
      run.stats.lastHit = { sourceId: 'e1', sourceName: 'Ash Warden', move: 'Cleave', amount: 14 };
      run.hp = 0;
      mountGameOver(app, { registries: ctx.getRegistries(), game: run, victory: false, earned: [], onTitle: showTitle, onHistory: showHistory, onRunAgain: showTitle });
    } else if (name === 'victory') {
      // The other end of the same door as ?shot=death: the run won, the stats
      // real, the deck the class's own — so the victory face is photographed
      // rather than trusted from the defeat one.
      run.floor = run.mapGraph ? run.mapGraph.floors : 12;
      run.stats.fightsWon = 11;
      run.stats.damageDealt = 640;
      run.stats.damageTaken = 212;
      mountGameOver(app, { registries: ctx.getRegistries(), game: run, victory: true, earned: [{ name: 'Twinblade', kind: 'armament' }], onTitle: showTitle, onHistory: showHistory, onRunAgain: showTitle });
    } else if (name === 'boss') {
      // Straight into the act-1 boss; the intro card is held for the camera.
      enterCombat(run.mapGraph.startIds[0], 'bossOmen');
    } else if (name === 'event') {
      // A REACH STATE, and the precedent is `rest` directly below — added for the
      // identical reason and quoting its own words: "one state for the one screen
      // being fixed, so the fix has a picture instead of an assertion." The event
      // screen is one of the screens no instrument this repo owns can open, which
      // is why 24 of 24 of its choice bars sat under the tap floor with nothing
      // ever regressing against it (Sunna's run-loop sweep). That COUNT is the
      // census card and is not touched here.
      //
      // `graveOfTheNameless` on purpose: three choices, and the last one is
      // "Leave" sitting 9-11 px under a choice with a real and irreversible
      // consequence. It is the exact adjacency the fix is about, so the picture
      // shows the thing rather than a friendlier event that happens to have three
      // bars. `?shotEvent=<id>` overrides it, through the one `shotParams` const.
      const evId = shotParams.get('shotEvent') || 'graveOfTheNameless';
      showEvent(evId);
    } else if (name === 'rest' || name === 'smith') {
      if (isConfiguredRun(run)) {
        const node = Object.values(run.mapGraph.nodes).find(row => row.type === 'shrine');
        if (!node) throw new Error('Configured rest screenshot requires an authored rest node');
        run.mapNodeId = node.id; run.floor = node.floor;
        run.path = screenshotRoutePath(run.mapGraph, node.id);
        // A bounded, ephemeral earned-point fixture goes through the production
        // XP/claim ledger; arbitrary unearned attribute allocations are not posed.
        const rawPoints = shotParams.get('shotRestPoints');
        if (rawPoints !== null) {
          const points = Number(rawPoints);
          if (!Number.isInteger(points) || ![0, 1].includes(points)) throw new Error('?shotRestPoints: expected exactly 0 or 1');
          if (points === 1) {
            awardLevelXp(ctx.getRegistries(), run, levelXpToNext(ctx.getRegistries(), run.level.level), {
              pointsPerLevel: gameModule(run, 'progression')?.attributePointsPerLevel || 0, grantStats: !!gameModule(run, 'stats') });
          }
        }
        if (shotParams.get('shotRestState') === 'wounded') {
          run.hp = Math.max(1, Math.floor(run.maxHp * .6)); run.mana = 0; run.stamina = 0;
          if (run.flaskCharges) { run.flaskCharges.hpCurrent = 0; run.flaskCharges.manaCurrent = 0; }
        }
        if (name === 'smith') run.smithingStones = Math.max(1, run.smithingStones || 0);
        persist(); showRest(); return;
      }
      // A REACH STATE, not the denominator. Constantine could not scroll the
      // Smith grid on a phone; the reason nobody caught it is that the Shrine is
      // one of seven player-facing screens no instrument we own can open, so
      // there was never a baseline to regress against. That COUNT — sixteen
      // screens mounted against nine ?shot= states — is Bjorn's card and is not
      // touched here. This is one state for the one screen being fixed, so the
      // fix has a picture instead of an assertion.
      //
      // POSED MID-CLIMB ON PURPOSE, because the defect is a function of HOW MANY
      // cards the grid holds and a fresh 10-card deck may not overflow at all.
      // Ten more from the class's own authored pool, in authored order — no rng,
      // so the grid photographs identically every run — gives the twenty-card
      // deck the bug was reproduced on.
      run.floor = 8;
      // An isolated wounded arrival exercises the real recovery preview and
      // commitment; it never touches the player's durable saves.
      if (shotParams.get('shotRestState') === 'wounded') {
        run.hp = Math.max(1, Math.floor(run.maxHp * .6));
        run.mana = 0;
      }
      run.deck.push(...createDeck(ctx.getRegistries().classes.get(run.class).cardPool.slice(0, 10), createIdGen('shot')));
      // `?shotSmithingStones=0|1` — stand on both sides of the Smith affordability
      // edge without writing durable storage. The accepted values are deliberately
      // closed to the owner-approved issue #211 economy: this reach door cannot
      // pose a purse the shipped faucet/cost table cannot currently produce.
      const shotSmithingStonesRaw = shotParams.get('shotSmithingStones');
      if (shotSmithingStonesRaw != null) {
        const shotSmithingStones = Number(shotSmithingStonesRaw);
        if (!Number.isInteger(shotSmithingStones) || ![0, 1].includes(shotSmithingStones)) {
          throw new Error(`?shotSmithingStones=${shotSmithingStonesRaw}: expected exactly 0 or 1. A silent fallback would photograph the wrong affordability state.`);
        }
        run.smithingStones = shotSmithingStones;
      }
      // AND A PURSE THAT CAN PAY, for the reason `?shot=shop` twelve lines below
      // already states about its own remove grid: a fresh run has earned no
      // point, so the Level up panel this state now has to reach mounts LOCKED,
      // and a photograph of a greyed-out feature is a green on nothing. Same
      // posing discipline as the twenty-card deck above — enough to reach the
      // control, no rng, identical every run. Five points waiting on the ledger
      // (plan phase 6): what five levels grant, without the fights.
      run.level.unspentPoints = Math.max(run.level.unspentPoints || 0, 5);
      // `?shot=smith` — THE SAME SHRINE WITH THE UPGRADE TRANSACTION OPEN. The
      // Smith is a modal over the Shrine, not a screen of its own, so the review
      // of 2026-09-11 could not photograph it: `?shot=smith` was not a state and
      // fell through to the title. One Stone so the upgrade is affordable and
      // the modal opens on an offer, not a refusal.
      if (name === 'smith') run.smithingStones = Math.max(1, run.smithingStones || 0);
      showRest(name === 'smith' ? 'smith' : null);
    } else if (name === 'shop' || name === 'blacksmith') {
      // Core's configured shop door: the node is posed as a shop node and showShop opens the Shop, or the Blacksmith for
      // `?shot=blacksmith` (the stock rides run.shopStock). The legacy market/master poses went with the legacy shops.
      if (!gameModule(run, 'shops')) throw new Error('Configured shop screenshot requires shops to be enabled');
      const nodes = Object.values(run.mapGraph.nodes);
      const node = nodes.find(row => row.actualType === 'shop' || row.resolved?.kind === 'merchant') || run.mapGraph.nodes[run.mapGraph.startIds[0]];
      run.mapNodeId = node.id; run.floor = node.floor;
      run.path = screenshotRoutePath(run.mapGraph, node.id);
      run.cinders = name === 'blacksmith' ? 2000 : 999;
      run.gameProfileOpenShop = `${run.actNumber}:${node.id}`;
      if (name === 'blacksmith') {
        run.smithingStones = 12;
        run.loadout.storage.push('katana');
        run.shopStock = buildBlacksmithStock(ctx.getRegistries(), ctx.getRng(), run);
      }
      persist(); showShop(); return;
    } else if (name === 'reward') {
      // Core's configured reward door: the production offer/save/renderer callbacks, no posed alternate UI and no
      // preselected option. (The legacy poses `?shotReward=full|empty|draft|...` went with the legacy door.)
      if (!isConfiguredRun(run)) throw new Error('Reward shot requires a configured game profile.');
      beginGameProfileReward({ source: 'combat', after: 'map' });
    } else if (name === 'combat' || name === 'fx') {
      // `?shotMaxPoise=<n>` — STAND AT A DIFFERENT STAGGER THRESHOLD. Unlike the
      // four POOL doors (which sit above the shot branches, right after newRun,
      // because the map reads them too) there is no run field to write: the
      // player's poise max
      // is derived per fight from the loadout (engine/combat.js reads the
      // equipment threshold receipt at entity creation). So this door enters at
      // the receipt's OUTPUT seam — the explicit override createCombat already
      // owns (Law 0 clause 3: an override is data), one stage above the entity,
      // which is where ?shotMaxHp sits relative to the derived-stat formula IT
      // bypasses. Module-scoped, never written to the run: a shot lever must not
      // leak into a save. 0 is a legal value on purpose — it poses the refusal
      // (no vessel, the bar ABSENT), which is A11's zero edge.
      const shotMaxPoise = Number(shotParams.get('shotMaxPoise'));
      if (shotParams.has('shotMaxPoise') && Number.isFinite(shotMaxPoise) && shotMaxPoise >= 0) {
        ctx.setShotPoiseMaxOverride(Math.floor(shotMaxPoise));
      }
      // TWO FLASKS IN THE POSE, ONE OF EACH KIND, AND IT IS NOT DRESSING. A
      // drunk flask does not come back this climb, and `useFlask` is a row in the
      // second-beat table — but a board with an EMPTY flask row draws no flask
      // control at all, so the census could not tell "this action is not wired"
      // from "this pose has nothing to press". Those two readings are opposite
      // and looked identical. An untargeted flask owes a hold, a targeted one
      // does not (it enters aim mode, which is already a second beat), so the
      // pose carries one of each and the check sees both cells of the row.
      run.flasks = [{ flaskId: 'crimsonFlask' }, { flaskId: 'blightCoating' }];
      const g = run.mapGraph;
      // A seeded start can resolve to an event. This fixture promises combat,
      // so select an actual fight and enter through the production fight door.
      const isFight = node => ['monster', 'fight', 'elite'].includes(node.type) || node.resolved?.kind === 'fight';
      const node = g.startIds.map(id => g.nodes[id]).find(isFight)
        || Object.values(g.nodes).find(isFight) || g.nodes[g.startIds[0]];
      // Presentation-only QA overrides stay inside the existing memory-only shot gate.
      // They exercise the production selector and renderer, without altering saves.
      if (shotParams.has('shotLayeredScene')) node.layeredSceneId = shotParams.get('shotLayeredScene');
      if (shotParams.has('shotTime')) run.presentationTimeId = shotParams.get('shotTime');
      if (shotParams.has('shotWeather')) run.presentationWeatherId = shotParams.get('shotWeather');
      run.mapNodeId = node.id; run.floor = node.floor;
      run.path = screenshotRoutePath(g, node.id);
      if (shotParams.get('shotArcane') === 'matrix') enterCombat(node.id, 'packHunt');
      else startFight(node.type === 'elite' ? 'elite' : 'normal', node.id);
      if (name === 'fx') setTimeout(poseFxShowcase, 1600);
    }
  }

  return {
    map: () => poseRunState('map'),
    combat: () => poseRunState('combat'),
    fx: () => poseRunState('fx'),
    boss: () => poseRunState('boss'),
    death: () => poseRunState('death'),
    victory: () => poseRunState('victory'),
    rest: () => poseRunState('rest'),
    smith: () => poseRunState('smith'),
    event: () => poseRunState('event'),
    shop: () => poseRunState('shop'),
    blacksmith: () => poseRunState('blacksmith'),
    reward: () => poseRunState('reward'),
    compendium: () => {
      // A ?shot= STATE, AND THAT IS THE POINT (Marina's condition on #78, and Rune's
      // census). tools/release-shots.mjs derives its denominator from the states
      // this file declares, and tools/screenreach.mjs can only reach a screen that
      // has one — so a new screen without a shot state is a screen no instrument
      // owns, which is the eight the census already counts. The seeded variant
      // (?shot=compendium&shotFound=…) photographs the other edge: what the screen
      // looks like once pieces are yours. Both edges, both shapes.
      const found = new URLSearchParams(location.search).get('shotFound');
      const meta = saves.loadMeta();
      if (found != null) meta.found = found ? found.split(',') : [];
      mountCompendium(app, { registries: ctx.getRegistries(), meta, onBack: showTitle });
    },
    startup: () => {
      showStartupGate({ forcedFamily: shotParams.get('shotInput') || '' });
    },
    title: () => {
      // A REACH STATE, the same shape as `?shot=rest` and for the same sentence:
      // one state for the one screen being watched, so the watch has a measurement
      // instead of a faith. `deleteSave` is a second beat this game has had since
      // the title screen shipped — a two-click arm in title.js's own hand until
      // 2026-08-14, the shared machinery's hold since — and its row in
      // src/model/secondbeat.js spent a week saying "no ?shot= state reaches a
      // title screen with saved runs on it". This is that state, and it is what
      // made the collapse safe to make.
      //
      // THE SAVE IS REAL AND ENTERS BY THE REAL DOORS: newRun → ensureProfile →
      // startClimb → persist() → saves.saveRun writes the run into (memory)
      // storage, and showTitle surfaces it back through saves.listSlots →
      // slotSummary reading those bytes — the same writer and the same reader a
      // player's save walks. Nothing is posed into the DOM; the occupied slot is
      // the storage speaking.
      newRun({ classId: 'reaver', seedString: shotParams.get('shotSeed') || 'SHOWCASE', slot: 1 });
      showTitle();
    },
    profile: () => {
      // A REACH STATE for title-screen Profile (`profileRestore` in secondbeat.js —
      // the inline .prof-confirm box). The set-aside profile is real and set aside
      // BY THE REAL ACT that sets one aside: ensureProfile writes profile A
      // through the real writer, startNewProfile archives it through
      // replacePrimaryWith — the one path allowed to replace the primary — and
      // the drawer entry the screen lists is that archive read back through
      // saves.listArchives. The instrument still opens the section by the
      // player's own door: Profile on the title screen.
      saves.ensureProfile();
      // A PROFILE THE PLAYER HAS TOUCHED, not a second fresh one. Two untouched
      // profiles are the same bytes, and the archive de-duplicates by content
      // (save.js archiveMeta): restoring A over an identical B set B aside INTO
      // A's own entry — the drawer read "seen 2 times" instead of growing, and
      // tools/holdconfirm.mjs read "entries 1 -> 1" as a restore that set nothing
      // aside. A real outgoing profile is never byte-identical to the one it
      // replaces (it carries its results), so the pose writes one setting through
      // the real writer — the default value, so nothing behaves differently — and
      // the two profiles are distinct the way two real ones are. ONLY WHEN THE
      // PROFILE IS UNTOUCHED: ?shotSettings has already written the settings an
      // instrument asked for (holdConfirm 'off' or 'long' on this very screen),
      // and those bytes already make the profile distinct — overwriting them
      // would pose the default where the caller asked for an edge (Codex, #537).
      {
        const posed = saves.loadMeta();
        if (!Object.keys(posed.settings || {}).length) saves.saveMeta({ ...posed, settings: { holdConfirm: 'normal' } });
      }
      saves.startNewProfile();
      showTitle();
      showProfile();
    },
    crisis: () => {
      // The worst morning (`freshProfile` in secondbeat.js — the .confirm-fresh
      // modal). The torn bytes were planted at the storage seam beside
      // pickStorage(), BEFORE the manager's first read — see the comment there
      // for why that is the real door. From here the boot is exactly a player's:
      // showTitle → showProfileNoticeIfNeeded → profileStatus().ok is false →
      // mountProfileNotice. Nothing on this branch mentions the notice screen.
      showTitle();
    },
    history: () => {
      // Run history with runs IN it, written through the real recorder
      // (saves.recordResult → the same bytes finishRun writes), so the screen is
      // read back the way a player's is. Three results, one of them custom, so
      // the win-rate line, the per-class chips and the excluded tag all show.
      saves.recordResult({ victory: true, className: 'Reaver', act: 3, floor: 12, fightsWon: 11, seed: 'SHOWCASE' });
      saves.recordResult({ victory: false, className: 'Starseer', act: 1, floor: 4, fightsWon: 3, seed: 'GOLDBOUGH' });
      saves.recordResult({ victory: false, className: 'Reaver', act: 2, floor: 7, fightsWon: 6, seed: 'ASHFALL', custom: true, ascension: 2 });
      showHistory();
    },
    about: () => {
      // Settings → About, opened through the real door: the category rides in
      // the profile the way a player's last-chosen tab does (settings.js CAT_KEY),
      // posed here into the ephemeral shot store, and Settings opens from the
      // title as it does for a player.
      {
        const posed = saves.loadMeta();
        saves.saveMeta({ ...posed, settings: { ...(posed.settings || {}), settingsCategory: 'About' } });
        const adopted = saves.loadMeta();
        ctx.setActiveMeta(adopted);
        ctx.setActiveSettings(adopted.settings || (adopted.settings = {}));
      }
      showTitle();
      showSettings();
    },
    prologue: () => {
      newRun({classId:shotParams.get('class') || 'reaver', customization:{name:'Forsaken',tint:'gold'}, seedString:'SHOWCASE'});
    },
    settings: () => {
      // Advanced configuration, through the same modal and profile settings path a
      // player uses. shotSettings may choose a subsection or tune a row.
      {
        const posed = saves.loadMeta();
        saves.saveMeta({ ...posed, settings: {
          ...(posed.settings || {}), settingsCategory: 'Advanced',
          settingsAdvancedCategory: posed.settings?.settingsAdvancedCategory || 'Progression',
        } });
        const adopted = saves.loadMeta();
        ctx.setActiveMeta(adopted);
        ctx.setActiveSettings(adopted.settings || (adopted.settings = {}));
      }
      showTitle();
      showSettings();
    },
    customize: () => poseCustomize('customize'),
    components: () => poseCustomize('components'),
  };

  function poseCustomize(name) {
    // EldenSpire#29 slice 1. The character-creation screen had no ?shot= state,
    // and #29's own boundary records what that cost: no sweep can open a screen
    // it cannot reach, so customize went unexamined for the whole week combat
    // was measured three times over. A seed is passed rather than randomised so
    // the seed field photographs the same on every run.
    showCustomize(1, name === 'components');
  }
}
