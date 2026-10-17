#!/usr/bin/env node
// Players and enemies in one shape (owner 2026-10-17): games/ashenspire/packs/core/characters.json.
// Tags decide which block applies (character.player -> player, character.enemy -> enemy); stats use one
// algorithm (characters module: tagRules + statRules + gear + relics). Default decks are mostly card-pool
// keys resolved by class and weapon type (cardPools.json). Class base HP is calibrated so each class keeps
// its legacy max HP with its starting gear.
//   node tools/characters-convert.mjs        (first run reads classes.json + starterDeck.json + enemies.json)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enemyPools, enemyItemBonuses, resolveEnemyAttributes, mergeGameSettings, enemyLevel } from '../engine/kernel/gameConfig.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACK = 'games/ashenspire/packs/core';
const json = p => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const CHAR_DEFAULTS = 'engine/modules/characters/defaults.json';

export const CARD_POOLS = {
  strike: { slot: 'mainHand', byTag: { default: 'core.strike' }, byClass: {} },
  defend: { slot: 'offHand', fallbackSlot: 'mainHand', byTag: { default: 'core.defend' }, byClass: {} },
  counter: { slot: 'mainHand', byTag: { default: 'core.counter' }, byClass: {} },
  smash: { slot: 'mainHand', byTag: { default: 'core.smash' }, byClass: {} },
  sweep: { slot: 'mainHand', byTag: { default: 'core.sweep' }, byClass: {} },
  evade: { slot: 'offHand', fallbackSlot: 'mainHand', byTag: { default: 'core.evade' }, byClass: {} },
  special: { slot: 'mainHand', byTag: {}, byClass: {} },
};

// Unified enemy row from an enemies-module row.
export function enemyCharacter(row) {
  const { id, name, tier, attributes, attributePriority, priorityWeights, variance, attributeCaps, attributePoints,
    defaultDeck, defaultGear, defaultRelics, levelProfile, art, size, tint, artFaces, ...rest } = row;
  return {
    id, name, tags: ['character.enemy', `tier.${tier}`],
    ...(attributes && Object.keys(attributes).length ? { attributes } : {}),
    attributePriority, ...(priorityWeights ? { priorityWeights } : {}), ...(variance ? { variance } : {}),
    ...(attributeCaps ? { attributeCaps } : {}), ...(attributePoints !== undefined ? { attributePoints } : {}),
    levelProfile, defaultDeck, defaultGear: defaultGear || [], defaultRelics: defaultRelics || [],
    presentation: { art, size, ...(tint ? { tint } : {}), ...(artFaces ? { artFaces } : {}) },
    enemy: rest,
  };
}

function playersFromClasses() {
  const classes = json(`${PACK}/classes.json`), starter = json(`${PACK}/starterDeck.json`);
  const pool = id => ({ 'core.strike': 'strike', 'core.defend': 'defend', 'core.counter': 'counter', 'core.smash': 'smash', 'core.sweep': 'sweep' })[id];
  return classes.map(c => {
    CARD_POOLS.special.byClass[`class.${c.id}`] = { default: c.specialCardId };
    return {
      id: c.id, name: c.name.replace(/\s+/g, '_'), tags: ['character.player', `class.${c.id}`],
      attributes: c.attributes,
      attributePriority: Object.keys(c.attributes).sort((a, b) => c.attributes[b] - c.attributes[a]),
      level: 1,
      // Owner 2026-10-17: 11 cards by default; the equipped weapon decides which version of each.
      defaultDeck: [{ pool: 'strike', copies: 3 }, { pool: 'defend', copies: 2 }, { pool: 'counter', copies: 1 }, { pool: 'smash', copies: 1 },
        { pool: 'sweep', copies: 1 }, { pool: 'evade', copies: 1 }, { card: 'base.draw', copies: 1 }, { pool: 'special', copies: starter.classSpecificCopies }],
      defaultGear: [...(c.loadout.rightHand ? [{ key: 'mainHand', id: c.loadout.rightHand }] : []), ...(c.loadout.leftHand ? [{ key: 'offHand', id: c.loadout.leftHand }] : [])],
      defaultRelics: [],
      presentation: { art: c.id, size: 'medium' },
      player: { specialCardId: c.specialCardId, description: c.description, legacyMaxHp: c.maxHp },
    };
  });
}

export function writeCharacters({ enemies } = {}) {
  const path = resolve(ROOT, PACK, 'characters.json');
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  const players = existing ? existing.filter(c => c.tags.includes('character.player')) : playersFromClasses();
  // Keep player decks on the 11-card default when re-running.
  for (const p of players) if (!p.defaultDeck.some(e => e.pool === 'evade')) p.defaultDeck.splice(5, 0, { pool: 'evade', copies: 1 });
  if (existing) for (const p of players) CARD_POOLS.special.byClass[`class.${p.id}`] = { default: p.player.specialCardId };
  const enemyRows = enemies ? enemies.map(enemyCharacter) : existing.filter(c => c.tags.includes('character.enemy'));
  // Calibrate class base HP: legacy max HP minus what attributes + level + starting gear already give.
  const defaults = json(CHAR_DEFAULTS);
  const bundle = json('games/ashenspire/bundles/core/bundle.json');
  const gearSettings = mergeGameSettings(json('engine/modules/gear/defaults.json'), bundle.modules.gear?.settings || {});
  const settings = { ...json('engine/modules/enemies/defaults.json'), ...defaults };
  const content = { gear: json(`${PACK}/gear.json`), enemyRelics: json(`${PACK}/enemyRelics.json`) };
  for (const p of players) {
    const tag = `class.${p.id}`;
    defaults.tagRules[tag].pools.hp = 0;
    const attrs = resolveEnemyAttributes(p, settings);
    const hp = enemyPools({ ...p, resolvedAttributes: attrs }, { ...settings, tagRules: defaults.tagRules }, enemyLevel(p, settings), enemyItemBonuses(p, content, gearSettings)).hp;
    defaults.tagRules[tag].pools.hp = (p.player.legacyMaxHp ?? hp) - hp;
  }
  writeFileSync(resolve(ROOT, CHAR_DEFAULTS), JSON.stringify(defaults, null, 2) + '\n');
  writeFileSync(path, JSON.stringify([...players, ...enemyRows], null, 2) + '\n');
  writeFileSync(resolve(ROOT, PACK, 'cardPools.json'), JSON.stringify(CARD_POOLS, null, 2) + '\n');
  return { players: players.length, enemies: enemyRows.length, classHp: Object.fromEntries(players.map(p => [p.id, defaults.tagRules[`class.${p.id}`].pools.hp])) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const enemies = existsSync(resolve(ROOT, PACK, 'enemies.json')) ? json(`${PACK}/enemies.json`) : undefined;
  console.log(writeCharacters({ enemies }));
}
