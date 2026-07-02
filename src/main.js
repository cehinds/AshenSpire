// src/main.js — boot: validate content → registries → screen router (SPEC §7.1)
//
// M1 flow: Title → class select → gauntlet (fight → reward → … → boss) →
// game over. The run's rng is created once from the seed, so a whole gauntlet
// is reproducible from the seed string (SPEC §3.11).

import { contentBundle, M1_GAUNTLET } from './content/index.js';
import { validateContent } from './model/validate.js';
import { createRegistries } from './model/registries.js';
import { createRng, seedToString, seedFromString } from './engine/rng.js';
import { createCombat } from './engine/combat.js';
import { mountTitle } from './ui/screens/title.js';
import { mountCombat } from './ui/screens/combat.js';
import { mountReward } from './ui/screens/reward.js';
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

// ---- game state --------------------------------------------------------------
let game = null;

function randomSeedString() {
  return seedToString((Math.random() * 0xffffffff) >>> 0);
}

function startRun(classId, seedString) {
  let seed;
  try {
    seed = seedFromString(seedString || randomSeedString());
  } catch (e) {
    // Invalid seed characters: fall back to a fresh random seed rather than
    // crashing the start button. The real seed shows in the combat header.
    seed = seedFromString(randomSeedString());
  }
  const cls = registries.classes.get(classId);
  game = {
    classId,
    seed,
    seedString: seedToString(seed),
    rng: createRng(seed),
    hp: cls.maxHp,
    maxHp: cls.maxHp,
    deck: cls.startingDeck.map((cardId, i) => ({ instanceId: `d${i}_${cardId}`, cardId, upgraded: false })),
    relicIds: [cls.startingRelic],
    gauntletIndex: 0,
    gauntletLength: M1_GAUNTLET.length,
    stats: { fightsWon: 0, damageDealt: 0, damageTaken: 0 },
  };
  showCombat();
}

function showTitle() {
  game = null;
  mountTitle(app, {
    registries,
    defaultSeedString: randomSeedString(),
    onStart: (classId, seedString) => startRun(classId, seedString),
  });
}

function showCombat() {
  const encounterId = M1_GAUNTLET[game.gauntletIndex];
  const encounter = registries.encounters.get(encounterId);
  const combat = createCombat({
    registries,
    rng: game.rng,
    player: {
      classId: game.classId,
      maxHp: game.maxHp,
      hp: game.hp,
      deck: game.deck,
      relicIds: game.relicIds,
    },
    enemyIds: encounter.enemies,
  });
  mountCombat(app, {
    registries,
    game,
    combat,
    fightIndex: game.gauntletIndex,
    fightCount: game.gauntletLength,
    onEnd: (result, endedCombat) => {
      if (result === 'victory') {
        game.hp = endedCombat.player.hp;
        game.stats.fightsWon += 1;
        const isLast = game.gauntletIndex >= game.gauntletLength - 1;
        if (isLast) {
          mountGameOver(app, { registries, game, victory: true, onTitle: showTitle });
        } else {
          const healed = Math.min(
            game.maxHp - game.hp,
            Math.floor((game.maxHp * registries.balance.gauntlet.healPct) / 100)
          );
          game.hp += healed;
          mountReward(app, {
            registries,
            game,
            healed,
            onContinue: () => {
              game.gauntletIndex += 1;
              showCombat();
            },
          });
        }
      } else {
        mountGameOver(app, { registries, game, victory: false, onTitle: showTitle });
      }
    },
  });
}

showTitle();
