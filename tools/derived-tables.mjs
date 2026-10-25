#!/usr/bin/env node
// Derived, read-only tables of the resolved Core profile (owner 2026-10-17): every character's attributes
// (own + each bonus source = total), HP terms, pools, resolved deck and gear; every gear item's resolved
// points; enemy decks; basic cards and pools. Generated - do not edit; regenerate after content changes.
//   node tools/derived-tables.mjs           write games/ashenspire/derived/*.json
//   node tools/derived-tables.mjs --check   fail if the files are stale
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGameProfileCatalog } from './game-config.mjs';
import { resolveGameAuthor, enemyAttributeTotal, enemyPools, enemyItemBonuses, enemyLevel, characterSettings, resolveEnemyAttributes, characterRule,
  displayName, resolveGearItem, enemyGearIds, enemyRelicIds, resolveCharacterDeck, deckCopyLimit } from '../engine/kernel/gameConfig.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'games/ashenspire/derived');
const ATTRS = ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'];

export function buildDerivedTables() {
  const profile = resolveGameAuthor(JSON.parse(readFileSync(resolve(ROOT, 'games/ashenspire/game.json'), 'utf8')), loadGameProfileCatalog());
  const s = characterSettings(profile.modules), g = profile.modules.gear, c = profile.content, r = s.statRules.hp;
  const gear = new Map(c.gear.map(i => [i.id, i])), relics = new Map(c.enemyRelics.map(x => [x.id, x])), cards = new Map(c.cards.map(x => [x.id, x]));
  const players = c.characters.filter(x => x.tags.includes('character.player'));
  const enemyRows = new Map(c.enemies.map(e => [e.id, e]));

  const characters = c.characters.map(source => {
    const row = enemyRows.get(source.id) || source;
    const own = resolveEnemyAttributes(row, s), bonus = enemyItemBonuses(row, c, g), level = enemyLevel(row, s), rule = characterRule(row, s);
    const sources = Object.fromEntries(ATTRS.map(k => [k, []]));
    for (const id of enemyGearIds(row)) { const p = resolveGearItem(gear.get(id), g).points; for (const k of ATTRS) if (p[k]) sources[k].push({ source: id, name: gear.get(id).name, kind: 'gear', amount: p[k] }); }
    for (const id of enemyRelicIds(row)) for (const m of relics.get(id).modifiers) {
      const [key, v] = m.replace('self.', '').split('=');
      if (ATTRS.includes(key)) sources[key].push({ source: id, name: relics.get(id).name, kind: 'relic', amount: Number(v) });
    }
    const attributes = Object.fromEntries(ATTRS.map(k => [k, { own: own[k], bonuses: sources[k], total: enemyAttributeTotal(row, s, k, own[k], bonus) }]));
    const t = k => attributes[k].total;
    const hpTerms = { base: rule.pools.hp, constitution: t('constitution') * r.constitution, strength: t('strength') * r.strength,
      dexterity: t('dexterity') * r.dexterity, wisdom: t('wisdom') * r.wisdom, intelligence: t('intelligence') * r.intelligence, level: (level - 1) * r.perLevel };
    const pools = enemyPools({ ...row, resolvedAttributes: own }, s, level, bonus);
    const deck = source.tags.includes('character.player') ? resolveCharacterDeck(source, c, g, s.cardPoolRules) : row.defaultDeck;
    return {
      id: source.id, name: source.name, displayName: displayName(source.name), tags: source.tags,
      kind: source.tags.includes('character.player') ? 'player' : 'enemy', tier: row.tier || null, level,
      attributePoints: Object.values(own).reduce((a, b) => a + b, 0), attributes,
      hp: { terms: hpTerms, total: pools.hp, formula: Object.values(hpTerms).join('+') + ` = ${pools.hp}` },
      pools: { hp: pools.hp, sp: pools.sp, mp: pools.mp, ar: pools.ar, dr: pools.dr, hand: pools.hand },
      gear: (source.defaultGear || []).map(e => ({ ...e, name: gear.get(e.id)?.name })),
      relics: (source.defaultRelics || []).map(e => ({ ...e, name: relics.get(e.id)?.name })),
      deck: { size: deck.length, cards: Object.entries(deck.reduce((m, id) => ((m[id] = (m[id] || 0) + 1), m), {})).map(([id, copies]) => ({ id, name: cards.get(id)?.name, copies })) },
    };
  });

  const gearTable = c.gear.map(item => {
    const res = resolveGearItem(item, g);
    return { id: item.id, name: item.name, slot: item.slot, kind: item.kind, rarity: item.rarity, tags: item.tags,
      setPoints: item.points || {}, points: res.points, values: res.values, modifiers: res.modifiers, pool: res.pools.mode === 'merged' ? res.pools.merged : { ratings: res.pools.ratings, bonus: res.pools.bonus } };
  });

  const effect = x => x.effects.map(f => ({ op: f.op, target: f.target, ...(f.amount !== undefined ? { amount: f.amount } : {}), ...(f.hits ? { hits: f.hits } : {}), ...(f.status ? { status: f.status, stacks: f.stacks } : {}), ...(f.card ? { card: f.card } : {}) }));
  const enemyDecks = c.enemies.map(e => ({
    id: e.id, name: e.name, tier: e.tier,
    cards: [...new Set(e.defaultDeck)].map(id => { const x = cards.get(id); return { id, name: x.name, copies: e.defaultDeck.filter(v => v === id).length, sp: x.staminaCost, mp: x.manaCost, keywords: x.keywords, effects: effect(x), hints: e.cardHints?.[id] || {} }; }),
    unlockCards: (e.unlockCards || []).map(id => ({ id, name: cards.get(id)?.name })),
  }));

  const rules = c.rewards.eligibility.combatCards, enemyIds = new Set(c.enemyCards.map(x => x.id));
  const rank = x => (Number.isSafeInteger(x.rank) ? x.rank : rules.rankOfRarity[x.rarity] ?? 1);
  const reaver = players.find(p => p.id === 'reaver') || players[0];
  const basicCards = {
    pools: c.cardPools,
    cards: c.cards.filter(x => !enemyIds.has(x.id) && rank(x) === 0).map(x => ({
      id: x.id, name: x.name, rarity: x.rarity, rank: 0, type: x.type, sp: x.staminaCost, mp: x.manaCost, tags: x.tags, effects: effect(x),
      copiesWithBasicTraining: deckCopyLimit(x.id, reaver, c, s, g, {}) === Infinity ? 'unlimited' : 'owned',
    })),
    cantrips: c.cards.filter(x => !enemyIds.has(x.id) && rank(x) === 0 && (x.tags || []).includes('camp:spell')).map(x => x.id),
  };
  return { 'characters.json': characters, 'gear.json': gearTable, 'enemyDecks.json': enemyDecks, 'basicCards.json': basicCards };
}

const text = value => JSON.stringify(value, null, 2) + '\n';
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tables = buildDerivedTables(), check = process.argv.includes('--check');
  mkdirSync(OUT, { recursive: true });
  let stale = [];
  for (const [file, value] of Object.entries(tables)) {
    const path = resolve(OUT, file);
    if (check) { if (!existsSync(path) || readFileSync(path, 'utf8').replace(/\r\n/g, '\n') !== text(value)) stale.push(file); }
    else writeFileSync(path, text(value));
  }
  if (check && stale.length) { console.error(`derived tables stale: ${stale.join(', ')} - run node tools/derived-tables.mjs`); process.exit(1); }
  console.log(check ? 'derived tables current' : `wrote ${Object.keys(tables).join(', ')} to games/ashenspire/derived/`);
}
