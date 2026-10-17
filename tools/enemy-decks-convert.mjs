#!/usr/bin/env node
// Re-runnable conversion: legacy weighted `moves` enemies (src/content/enemies/act1-3.js) -> enemies-module
// pack JSON (games/ashenspire/packs/core/enemies.json, enemyCards.json, enemyRelics.json). Owner 2026-10-17,
// docs/plans/enemy-decks.md. Enemies follow the player's rules: player-shaped cards with owner-relative
// targets (`enemy` = the opponent, `self` = the owner), the player's gear (gear.json, lootable), attribute
// relics, and stats from attributes + level. The JSON is the source of truth after conversion.
//   node tools/enemy-decks-convert.mjs          write
//   node tools/enemy-decks-convert.mjs --dry    report only
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { enemyPools, enemyItemBonuses, resolveGearItem, mergeGameSettings } from '../engine/kernel/gameConfig.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACK = 'games/ashenspire/packs/core';
const DRY = process.argv.includes('--dry');
const json = path => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
const settings = json('engine/modules/enemies/defaults.json');
const bundle = json('games/ashenspire/bundles/core/bundle.json');
const gearSettings = mergeGameSettings(json('engine/modules/gear/defaults.json'), bundle.modules.gear?.settings || {});
const gear = json(`${PACK}/gear.json`);

const { act1Enemies } = await import(pathToFileURL(resolve(ROOT, 'src/content/enemies/act1.js')));
const { act2Enemies } = await import(pathToFileURL(resolve(ROOT, 'src/content/enemies/act2.js')));
const { act3Enemies } = await import(pathToFileURL(resolve(ROOT, 'src/content/enemies/act3.js')));
const roster = [...act1Enemies, ...act2Enemies, ...act3Enemies];

// Tier from encounter pools: boss > elite > minion.
const encounters = [];
for (const file of readdirSync(resolve(ROOT, 'src/content/encounters')).filter(f => f.endsWith('.js')).sort()) {
  const mod = await import(pathToFileURL(resolve(ROOT, 'src/content/encounters', file)));
  for (const value of Object.values(mod)) if (Array.isArray(value)) encounters.push(...value.filter(row => row && Array.isArray(row.enemies)));
}
const RANK = { minion: 0, elite: 1, boss: 2 };
function tierOf(id) {
  let tier = 'minion';
  for (const enc of encounters) if (enc.enemies.includes(id)) {
    const t = enc.pool === 'boss' ? 'boss' : enc.pool === 'elite' ? 'elite' : 'minion';
    if (RANK[t] > RANK[tier]) tier = t;
  }
  return tier;
}

// Attribute points (owner 2026-10-17): minion 2, elite 4, boss 6. Gear per tier and the rarest it may be.
const PLAN = {
  minion: { budget: 2, deck: 6, gear: ['rightHand'], maxRarity: 'common', relics: 0 },
  elite: { budget: 4, deck: 8, gear: ['rightHand', 'armor'], maxRarity: 'uncommon', relics: 0 },
  boss: { budget: 6, deck: 10, gear: ['rightHand', 'leftHand', 'armor'], maxRarity: 'rare', relics: 1 },
};
const ATTRS = ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'];
const words = s => String(s).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
const isSelfHeal = e => e.op === 'heal' && (e.target === 'self' || e.target == null);
// Owner-relative targets: what the legacy enemy aimed at "player" is its opponent.
const relative = target => (target === 'player' ? 'enemy' : target === 'allPlayers' ? 'allEnemies' : target || 'self');

function maneuverOf(move) {
  if (move.counterDamage) return 'counter';
  if (move.delay && move.intent !== 'block') return 'smash';
  if (move.intent === 'attack') return 'attack';
  if (move.intent === 'block') return 'defend';
  return 'casting';
}
function healShape(tags) {
  return settings.healRules.shapes.filter(s => s.tags.every(t => tags.includes(t))).sort((a, b) => b.tags.length - a.tags.length)[0];
}

// A player-shaped card (same fields as packs/core/cards.json), plus enemy planner hints.
function cardFor(enemy, tier, moveId, move) {
  const maneuver = maneuverOf(move);
  const heal = (move.effects || []).some(isSelfHeal);
  const type = Number.isFinite(move.damage) || maneuver === 'counter' ? 'attack' : maneuver === 'casting' ? 'power' : 'skill';
  const tags = [`camp:${maneuver === 'casting' ? 'spell' : 'physical'}`, `maneuver:${maneuver}`, `classification.${type}`, 'owner:enemy'];
  if (['defend', 'counter'].includes(maneuver)) tags.push('trait:reaction');
  if (heal) { tags.push('heal'); if (tier === 'minion') tags.push('exhaust'); }
  const effects = [];
  if (Number.isFinite(move.block)) effects.push({ op: 'block', target: 'self', amount: move.block });
  if (Number.isFinite(move.damage)) effects.push({ op: 'damage', target: 'enemy', amount: move.damage, ...(move.hits > 1 ? { hits: move.hits } : {}) });
  if (Number.isFinite(move.counterDamage)) effects.push({ op: 'damage', target: 'enemy', amount: move.counterDamage });
  for (const e of move.effects || []) effects.push(isSelfHeal(e) ? { op: 'heal', target: 'self', rule: 'healRules' } : { ...structuredClone(e), target: relative(e.target ?? (e.op === 'addCard' ? 'player' : 'self')) });
  let cost = settings.stanceCosts[maneuver], costSource = 'stance';
  if (heal) { cost = healShape(tags).cost; costSource = 'healRules'; }
  else if (Number.isFinite(move.sp)) { cost = { sp: move.sp, mp: 0 }; costSource = 'authored'; }
  const text = [];
  if (Number.isFinite(move.block)) text.push('Gain {block} Block.');
  if (Number.isFinite(move.damage)) text.push(move.hits > 1 ? `Deal {damage} damage ${move.hits} times.` : 'Deal {damage} damage.');
  if (Number.isFinite(move.counterDamage)) text.push('Prepare Counter: return {damage} damage.');
  if (heal) text.push(`Heal ${healShape(tags).amount.percentMaxHp}% max HP.`);
  for (const e of move.effects || []) if (e.op === 'applyStatus') text.push(`Apply ${e.stacks ?? e.value ?? ''} ${words(e.status)} to ${e.target === 'self' ? 'yourself' : 'the enemy'}.`);
  for (const e of move.effects || []) if (e.op === 'addCard') text.push(`Shuffle ${words(e.card)} into the enemy's ${e.pile}.`);
  if (move.delay) text.push(`Charges for ${move.delay.turns} turn${move.delay.turns === 1 ? '' : 's'}.`);
  return {
    id: `${enemy.id}.${moveId}`,
    name: words(moveId),
    class: 'enemy',
    rarity: 'enemy',
    cost: cost.sp,
    staminaCost: cost.sp,
    manaCost: cost.mp,
    costRule: 'fixed',
    costSource,
    type,
    icon: maneuver,
    keywords: tags.includes('exhaust') ? ['exhaust'] : [],
    effects,
    tags,
    textTemplate: text.join(' '),
    ...(type === 'attack' ? { damageSchool: maneuver === 'casting' ? 'magic' : 'physical', exposureBuildupPerHit: 0 } : {}),
    ...(move.delay ? { delay: structuredClone(move.delay) } : {}),
    owner: 'enemy',
    enemy: enemy.id,
    aiWeight: move.weight ?? 1,
    ...(move.maxConsecutive ? { maxConsecutive: move.maxConsecutive } : {}),
    legacyMove: moveId,
  };
}

function split(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map(w => (w / sum) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left-- > 0) out[i]++; });
  return out;
}

// Points follow the legacy stat shape (sharpened). CON stays at most 1 (owner: enemies are hard
// already). Floors: enough WIS/DEX that the enemy can pay its dearest card with its own stats.
function attributesFor(enemy, plan, cards, tier) {
  const needMp = Math.max(0, ...cards.map(c => c.manaCost)), needSp = Math.max(0, ...cards.map(c => c.staminaCost));
  const out = Object.fromEntries(ATTRS.map(id => [id, 0]));
  const weights = ATTRS.map(id => (Number(enemy.attributes?.[id]) || 1) ** 2);
  split(plan.budget, weights).forEach((n, i) => { out[ATTRS[i]] += n; });
  const rank = ATTRS.filter(id => id !== 'constitution').sort((a, b) => weights[ATTRS.indexOf(b)] - weights[ATTRS.indexOf(a)]);
  while (out.constitution > 1) { out.constitution--; out[rank[0]]++; }
  const pools = () => enemyPools({ tier, attributes: out, levelProfile: enemy.levelProfile }, settings);
  const donor = keep => rank.filter(id => id !== keep).find(id => out[id] > 0);
  for (let g = 0; g < 20 && pools().mp < needMp; g++) { const d = donor('wisdom'); if (!d) break; out[d]--; out.wisdom++; }
  for (let g = 0; g < 20 && pools().sp < needSp; g++) { const d = donor('dexterity'); if (!d) break; out[d]--; out.dexterity++; }
  return out;
}

// Player gear that fits the enemy: best match between the item's attribute points and the enemy's shape.
const RARITY = gearSettings.rarities;
const resolved = new Map(gear.map(item => [item.id, resolveGearItem(item, gearSettings)]));
// Deterministic variety: pick among the best few matches by a hash of the enemy id.
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
function pickGear(attributes, plan, enemyId) {
  const shape = ATTRS.map(a => attributes[a] + 0.5);
  const identity = item => { const w = {}; for (const t of item.tags) { const r = gearSettings.tags[t]; for (const [k, v] of Object.entries(r?.weights?.bonus || {})) w[k] = (w[k] || 0) + v * r.priority / 100; } return w; };
  const score = item => { const p = resolved.get(item.id).points, w = identity(item); return ATTRS.reduce((s, a, i) => s + (p[a] + (w[a] || 0)) * shape[i], 0); };
  return plan.gear.map((slot, i) => {
    const pool = gear.filter(item => item.slot === slot && RARITY.indexOf(item.rarity) <= RARITY.indexOf(plan.maxRarity) && !(item.classes && item.classes.length < 4))
      .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
    const top = pool.filter(item => score(item) >= score(pool[0]) * 0.85).slice(0, 4);
    return top[hash(enemyId + slot + i) % top.length]?.id;
  }).filter(Boolean);
}
// Enemy relics: attribute points only, 0-5 points across at most 3 attributes.
const RELICS = [
  { id: 'enemy.relic.ashenBlightCore', name: 'Ashen Blight Core', modifiers: ['self.strength=+2', 'self.constitution=+2', 'self.wisdom=-1', 'self.sp=-2'] },
  { id: 'enemy.relic.emberBand', name: 'Ember Band', modifiers: ['self.constitution=+1'] },
  { id: 'enemy.relic.graveSeal', name: 'Grave Seal', modifiers: ['self.strength=+2'] },
  { id: 'enemy.relic.titanHeart', name: 'Titan Heart', modifiers: ['self.constitution=+2', 'self.strength=+1'] },
  { id: 'enemy.relic.ashenCore', name: 'Ashen Core', modifiers: ['self.constitution=+2', 'self.strength=+2', 'self.wisdom=+1'] },
  { id: 'enemy.relic.abyssalCrown', name: 'Abyssal Crown', modifiers: ['self.constitution=+2', 'self.wisdom=+2', 'self.intelligence=+1'] },
];
const relicText = r => r.modifiers.map(m => { const [k, v] = m.split('='); return `${k.split('.')[1].slice(0, 3).toUpperCase()} ${v}`; }).join(', ');
// Owner 2026-10-17: most minions and elites, and a couple of blighted bosses, carry the Ashen Blight Core.
const BLIGHT_BOSSES = new Set(['blightedValkyrie', 'ashheartDragon']);
const BLIGHT_SKIP = new Set(['graveWisp', 'lanternMoth', 'mirrorScribe', 'eclipseCantor', 'courtSurgeon']);
function pickRelics(attributes, plan, enemyId, tier) {
  if (tier !== 'boss' && !BLIGHT_SKIP.has(enemyId)) return ['enemy.relic.ashenBlightCore'];
  if (BLIGHT_BOSSES.has(enemyId)) return ['enemy.relic.ashenBlightCore'];
  if (!plan.relics) return [];
  const caster = attributes.wisdom + attributes.intelligence > attributes.strength + attributes.dexterity;
  const options = caster ? ['enemy.relic.abyssalCrown', 'enemy.relic.emberBand', 'enemy.relic.titanHeart'] : ['enemy.relic.ashenCore', 'enemy.relic.graveSeal', 'enemy.relic.titanHeart'];
  return [options[hash(enemyId) % options.length]].slice(0, plan.relics);
}

const enemies = [], cards = [], report = [];
const content = { gear, enemyRelics: RELICS };
for (const enemy of roster) {
  const tier = tierOf(enemy.id), plan = PLAN[tier];
  const moves = Object.entries(enemy.moves || {});
  const enemyCards = moves.map(([moveId, move]) => cardFor(enemy, tier, moveId, move));
  const active = moves.map(([id, m], i) => ({ id, m, card: enemyCards[i] })).filter(x => !x.m.locked);
  const t = settings.tiers[tier];
  const size = Math.max(active.length, Math.min(t.deckSize[1], Math.max(t.deckSize[0], plan.deck)));
  const copies = split(size - active.length, active.map(x => x.m.weight ?? 1)).map(n => n + 1);
  const deck = active.flatMap((x, i) => Array(copies[i]).fill(x.card.id));
  const attributes = attributesFor(enemy, plan, enemyCards, tier);
  const ids = new Map(moves.map(([id], i) => [id, enemyCards[i].id]));
  const phases = enemy.phases ? structuredClone(enemy.phases).map(p => {
    if (p.unlockMoves) { p.unlockCards = p.unlockMoves.map(id => ids.get(id)); delete p.unlockMoves; }
    p.do = (p.do || []).map(step => step.op === 'heal' ? { op: 'heal', target: 'self', rule: 'healRules' } : { ...step, target: relative(step.target) });
    return p;
  }) : undefined;
  const row = {
    id: enemy.id, name: enemy.name, tier, attributes, deck,
    ...(moves.some(([, m]) => m.locked) ? { unlockCards: moves.filter(([, m]) => m.locked).map(([id]) => ids.get(id)) } : {}),
    ...(enemy.firstMove ? { firstCard: ids.get(enemy.firstMove) } : {}),
    gear: pickGear(attributes, plan, enemy.id), relics: pickRelics(attributes, plan, enemy.id, tier),
    poiseMax: enemy.poiseMax, levelProfile: enemy.levelProfile, size: enemy.size, art: enemy.id,
    ...(enemy.artFaces ? { artFaces: enemy.artFaces } : {}),
    ...(enemy.tint ? { tint: String(enemy.tint).replace(/^var\(--(.+)\)$/, '$1') } : {}),
    ...(enemy.blighted ? { blighted: true } : {}),
    ...(enemy.arcaneExposure ? { arcaneExposure: structuredClone(enemy.arcaneExposure) } : {}),
    ...(phases ? { phases } : {}),
  };
  {
    const owned = [...row.deck, ...(row.unlockCards || [])].map(id => enemyCards.find(c => c.id === id));
    const affordable = r => { const p = enemyPools(r, settings, undefined, enemyItemBonuses(r, content, gearSettings)); return owned.every(c => c.staminaCost <= p.sp && c.manaCost <= p.mp); };
    if (row.relics.includes('enemy.relic.ashenBlightCore') && !affordable(row)) row.relics = row.relics.filter(id => id !== 'enemy.relic.ashenBlightCore');
  }
  enemies.push(row);
  cards.push(...enemyCards);
  const p = enemyPools(row, settings, undefined, enemyItemBonuses(row, content, gearSettings));
  const legacy = Math.round(((enemy.hp?.[0] ?? 0) + (enemy.hp?.[1] ?? 0)) / 2);
  report.push(`${tier.padEnd(6)} ${enemy.id.padEnd(22)} HP ${String(p.hp).padStart(3)} (legacy ${legacy}) SP ${p.sp} MP ${p.mp} gear ${row.gear.join(',')} ${row.relics.join(',')}`);
}
console.log(report.join('\n'));
console.log(`\n${enemies.length} enemies, ${cards.length} cards, ${RELICS.length} relics`);
if (!DRY) {
  const write = (name, value) => writeFileSync(resolve(ROOT, PACK, name), JSON.stringify(value, null, 2) + '\n');
  write('enemies.json', enemies);
  write('enemyCards.json', cards);
  write('enemyRelics.json', RELICS.map(r => ({ ...r, text: relicText(r) })));
  console.log(`wrote ${PACK}/enemies.json, enemyCards.json, enemyRelics.json`);
}
