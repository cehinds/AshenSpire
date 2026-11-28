// Every Core enemy's resolved own attributes at every level and a few seeds, plus its pools at its
// authored level. The player base-stat change must leave this byte-identical.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadGameProfileCatalog } from '../../tools/game-config.mjs';
import {
  characterSettings,
  enemyItemBonuses,
  enemyLevel,
  enemyPools,
  resolveEnemyAttributes,
  resolveGameAuthor,
} from '../../engine/kernel/gameConfig.js';

const GAME_PATH = fileURLToPath(new URL('../../games/ashenspire/game.json', import.meta.url));
const FIXTURE_PATH = fileURLToPath(new URL('../fixtures/enemy-attributes-baseline.json', import.meta.url));
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ENEMY_TAG = 'character.enemy';
// The highest Core enemy level (SPEC §17: Act 3 bosses).
const MAX_ENEMY_LEVEL = 11;
const LEVELS = Array.from(
  {
    length: MAX_ENEMY_LEVEL,
  },
  (unused, index) => index + 1,
);
const SEEDS = [
  null,
  'snapshotSeedA',
  'snapshotSeedB',
];
const WRITE_FLAG = '--write';

function attributeRow(attributes)
{
  return Object.values(attributes);
}

function enemySnapshot(row, settings, content, gear)
{
  const byLevel = {};
  for (const level of LEVELS)
  {
    byLevel[level] = SEEDS.map(seed => attributeRow(resolveEnemyAttributes(
      {
        ...row,
        level,
      },
      settings,
      seed,
    )));
  }
  const own = resolveEnemyAttributes(row, settings);
  const pools = enemyPools(
    {
      ...row,
      resolvedAttributes: own,
    },
    settings,
    enemyLevel(row, settings),
    enemyItemBonuses(row, content, gear),
  );
  return {
    own,
    pools,
    byLevel,
  };
}

export function EnemyAttributeSnapshot()
{
  const author = JSON.parse(readFileSync(GAME_PATH, 'utf8'));
  const profile = resolveGameAuthor(author, loadGameProfileCatalog());
  const settings = characterSettings(profile.modules);
  const content = profile.content;
  const gear = profile.modules.gear;
  const rows = new Map(content.enemies.map(row => [row.id, row]));
  for (const character of content.characters)
  {
    if (!character.tags.includes(ENEMY_TAG) || rows.has(character.id))
    {
      continue;
    }
    rows.set(character.id, character);
  }
  const out = {};
  for (const [id, row] of [...rows].sort(([left], [right]) => left.localeCompare(right)))
  {
    out[id] = enemySnapshot(row, settings, content, gear);
  }
  return out;
}

export function ReadEnemyAttributeBaseline()
{
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
}

if (process.argv[1] === SCRIPT_PATH && process.argv.includes(WRITE_FLAG))
{
  writeFileSync(FIXTURE_PATH, JSON.stringify(EnemyAttributeSnapshot()) + '\n');
}
