// src/main.js — boot + run orchestrator (SPEC §7.1)
//
// M2 flow: Title → class select → act map → [combat | shrine | shop | event |
// treasure] → … → boss → game over. One rng is created from the seed and its
// stream counters are saved with the run after every committed choice, so a
// whole run is reproducible from its seed string and a reload restores
// exactly (mid-combat: the combat restarts from its start — StS behavior,
// because counters are saved BEFORE the combat begins).

import { contentBundle } from './content/index.js';
import { validateContent } from './model/validate.js';
import { createRegistries } from './model/registries.js';
import { createRunState } from './model/state.js';
import { createRng, seedToString, seedFromString } from './engine/rng.js';
import { createCombat } from './engine/combat.js';
import { generateActMap } from './engine/mapgen.js';
import { createSaveManager, createMemoryStorage } from './engine/save.js';
import {
  rollEncounter,
  rollRuneReward,
  rollCardRewardIds,
  rollFlaskDrop,
  rollRelicReward,
  buildShopStock,
  resolveUnknownNode,
} from './engine/encounters.js';
import { mountTitle } from './ui/screens/title.js';
import { mountCustomize } from './ui/screens/customize.js';
import { KEEPSAKES } from './content/keepsakes.js';
import { executeRunEffects } from './engine/actions.js';
import { mountMap } from './ui/screens/map.js';
import { mountCombat } from './ui/screens/combat.js';
import { mountRewards } from './ui/screens/reward.js';
import { mountRest } from './ui/screens/rest.js';
import { mountShop } from './ui/screens/shop.js';
import { mountEvent } from './ui/screens/event.js';
import { mountGameOver } from './ui/screens/gameover.js';

const app = document.getElementById('app');

// ---- content validation at boot (SPEC §3.14) — loud, on-screen -------------
const validation = validateContent(contentBundle);
if (!validation.ok) {
  const banner = document.createElement('div');
  banner.className = 'validation-banner';
  banner.textContent =
    `CONTENT VALIDATION FAILED (${validation.errors.length} errors)\n` +
    validation.errors.slice(0, 12).map((e) => ` · ${e.path}: ${e.msg}`).join('\n');
  document.body.prepend(banner);
  console.error('Content validation errors:', validation.errors);
}

const registries = createRegistries(contentBundle);

function pickStorage() {
  try {
    window.localStorage.setItem('sote_probe', '1');
    window.localStorage.removeItem('sote_probe');
    return window.localStorage;
  } catch (e) {
    return createMemoryStorage(); // e.g. blocked third-party storage
  }
}
const saves = createSaveManager(pickStorage());

// ---- run state ----------------------------------------------------------------
let run = null;
let rng = null;

function randomSeedString() {
  return seedToString((Math.random() * 0xffffffff) >>> 0);
}

function newRun({ classId, seedString, customization, keepsakeId }) {
  let seed;
  try {
    seed = seedFromString(seedString || randomSeedString());
  } catch (e) {
    seed = seedFromString(randomSeedString()); // invalid chars → fresh seed
  }
  run = createRunState({ seed, classId, registries });
  run.seedString = seedToString(seed);
  run.customization = customization || { name: 'Tarnished', glyph: '⚔', tint: 'gold' };
  run.stats = { fightsWon: 0, damageDealt: 0, damageTaken: 0 };
  run.path = [];
  run.seenEvents = [];
  run.lastEncounters = [];
  rng = createRng(seed);

  // Keepsake: a one-time bundle of run-level effects (content/keepsakes.js).
  const keepsake = KEEPSAKES.find((k) => k.id === keepsakeId);
  if (keepsake && keepsake.effects.length) {
    executeRunEffects({ run, registries, rng }, keepsake.effects);
  }

  run.mapGraph = generateActMap({ config: registries.mapConfig(1), rng });
  // Pre-roll every '?' node (stream 'events') so outcomes are seed-determined
  // and the Stonesword Key can reveal them (SPEC §6).
  const assigned = [];
  for (const node of Object.values(run.mapGraph.nodes)) {
    if (node.type === 'event') {
      node.resolved = resolveUnknownNode(registries, rng, { seenEvents: assigned });
      if (node.resolved.kind === 'event') assigned.push(node.resolved.eventId);
    }
  }
  saves.saveRun(run, rng);
  showMap();
}

function resumeRun() {
  run = saves.loadRun(registries);
  if (!run) return showTitle();
  rng = createRng(run.seed, run.streamCounters);
  if (run.combatEntered && run.combatEntered.encounterId) {
    // Mid-combat save: restart that combat from its start (SPEC §3.12).
    enterCombat(run.combatEntered.nodeId, run.combatEntered.encounterId, { resuming: true });
  } else if (run.shopStock) {
    showShop();
  } else {
    showMap();
  }
}

// ---- screens --------------------------------------------------------------------
function showTitle() {
  run = null;
  mountTitle(app, {
    hasSave: saves.hasRun(),
    onBegin: showCustomize,
    onContinue: resumeRun,
    onAbandon: () => {
      saves.clearRun();
      showTitle();
    },
  });
}

function showCustomize() {
  mountCustomize(app, {
    registries,
    defaultSeedString: randomSeedString(),
    onBack: showTitle,
    onStart: (config) => newRun(config),
  });
}

function showMap() {
  mountMap(app, { registries, run, onPick: enterNode });
}

function enterNode(nodeId) {
  const node = run.mapGraph.nodes[nodeId];
  run.mapNodeId = nodeId;
  run.path.push(nodeId);
  run.floor = node.floor;

  let kind = node.type;
  if (kind === 'event') {
    const res = node.resolved || { kind: 'fight' };
    if (res.kind === 'event') {
      run.seenEvents.push(res.eventId);
      saves.saveRun(run, rng);
      return showEvent(res.eventId);
    }
    kind = res.kind; // fight | shrine | treasure
  }

  switch (kind) {
    case 'monster':
    case 'fight':
      return startFight('normal', nodeId);
    case 'elite':
      return startFight('elite', nodeId);
    case 'boss':
      return startFight('boss', nodeId);
    case 'shrine':
      saves.saveRun(run, rng);
      return showRest();
    case 'merchant':
      run.shopStock = buildShopStock(registries, rng, run);
      saves.saveRun(run, rng);
      return showShop();
    case 'treasure': {
      const relicId = rollRelicReward(registries, rng, run.relics);
      return mountRewards(app, {
        registries,
        run,
        rewards: { relicId, title: 'TREASURE' },
        onDone: () => {
          saves.saveRun(run, rng);
          showMap();
        },
      });
    }
    default:
      throw new Error(`Unknown node kind '${kind}'`);
  }
}

// ---- combat ------------------------------------------------------------------------
function startFight(pool, nodeId) {
  const encounterId = rollEncounter(registries, rng, { pool, exclude: run.lastEncounters });
  if (pool === 'normal') {
    run.lastEncounters.push(encounterId);
    if (run.lastEncounters.length > 2) run.lastEncounters.shift();
  }
  enterCombat(nodeId, encounterId);
}

function enterCombat(nodeId, encounterId, { resuming = false } = {}) {
  run.combatEntered = { nodeId, encounterId };
  if (!resuming) saves.saveRun(run, rng); // counters BEFORE the combat → reload restarts it identically
  const enc = registries.encounters.get(encounterId);
  const combat = createCombat({
    registries,
    rng,
    player: {
      classId: run.class,
      maxHp: run.maxHp,
      hp: run.hp,
      deck: run.deck,
      relicIds: run.relics,
      flasks: run.flasks,
    },
    enemyIds: enc.enemies,
  });
  const label =
    enc.pool === 'boss' ? 'THE WATCHFUL OMEN' : enc.pool === 'elite' ? `ELITE · FLOOR ${run.floor}` : `FLOOR ${run.floor}`;
  mountCombat(app, {
    registries,
    run,
    combat,
    label,
    onEnd: (result, endedCombat) => onCombatEnd(result, endedCombat, enc),
  });
}

function onCombatEnd(result, combat, enc) {
  run.flasks = combat.player.flasks; // drunk flasks stay drunk

  if (result !== 'victory') {
    saves.clearRun();
    saves.recordResult({ victory: false, seed: run.seedString, class: run.class, floor: run.floor });
    return mountGameOver(app, { registries, game: run, victory: false, onTitle: showTitle });
  }

  run.hp = combat.player.hp;
  run.stats.fightsWon += 1;
  run.combatEntered = null;

  if (enc.pool === 'boss') {
    saves.clearRun();
    saves.recordResult({ victory: true, seed: run.seedString, class: run.class, floor: run.floor });
    return mountGameOver(app, { registries, game: run, victory: true, onTitle: showTitle });
  }

  const rewards = {
    title: enc.pool === 'elite' ? 'ELITE VANQUISHED' : 'VICTORY',
    runes: rollRuneReward(registries, rng, enc.pool, run.relics),
    cardIds: rollCardRewardIds(registries, rng, { classId: run.class, pool: enc.pool, relicIds: run.relics }),
    flaskId: rollFlaskDrop(registries, rng, run),
    relicId: enc.pool === 'elite' ? rollRelicReward(registries, rng, run.relics) : null,
  };
  mountRewards(app, {
    registries,
    run,
    rewards,
    onDone: () => {
      saves.saveRun(run, rng);
      showMap();
    },
  });
}

// ---- non-combat nodes -----------------------------------------------------------------
function showRest() {
  mountRest(app, {
    registries,
    run,
    onDone: () => {
      saves.saveRun(run, rng);
      showMap();
    },
  });
}

function showShop() {
  mountShop(app, {
    registries,
    run,
    onChanged: () => saves.saveRun(run, rng),
    onLeave: () => {
      run.shopStock = null;
      saves.saveRun(run, rng);
      showMap();
    },
  });
}

function showEvent(eventId) {
  mountEvent(app, {
    registries,
    run,
    rng,
    eventId,
    onDone: () => {
      if (run.combatEntered) {
        // A startCombat effect stored the encounter id (string form).
        const encounterId = typeof run.combatEntered === 'string' ? run.combatEntered : run.combatEntered.encounterId;
        run.combatEntered = null;
        return enterCombat(run.mapNodeId, encounterId);
      }
      saves.saveRun(run, rng);
      showMap();
    },
  });
}

showTitle();
