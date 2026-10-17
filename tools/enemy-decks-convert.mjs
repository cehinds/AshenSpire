#!/usr/bin/env node
// One-shot (re-runnable) conversion: legacy weighted `moves` enemies (src/content/enemies/act1-3.js)
// -> enemies-module pack JSON (games/ashenspire/packs/core/enemies.json, enemyCards.json,
// enemyGear.json, enemyRelics.json). Owner decisions 2026-10-17, docs/plans/enemy-decks.md.
// The JSON is the source of truth after conversion; re-running overwrites it.
//   node tools/enemy-decks-convert.mjs          write
//   node tools/enemy-decks-convert.mjs --dry    report only
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { enemyPools } from '../engine/kernel/gameConfig.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACK = 'games/ashenspire/packs/core';
const DRY = process.argv.includes('--dry');
const settings = JSON.parse(readFileSync(resolve(ROOT, 'engine/modules/enemies/defaults.json'), 'utf8'));

const { act1Enemies } = await import(pathToFileURL(resolve(ROOT, 'src/content/enemies/act1.js')));
const { act2Enemies } = await import(pathToFileURL(resolve(ROOT, 'src/content/enemies/act2.js')));
const { act3Enemies } = await import(pathToFileURL(resolve(ROOT, 'src/content/enemies/act3.js')));
const roster = [...act1Enemies, ...act2Enemies, ...act3Enemies];

// Tier from encounter pools: boss > elite > minion. An enemy no encounter fields is a minion.
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

// Attribute points (owner 2026-10-17): minion 2, elite 4, boss 6.
const PLAN = {
  minion: { budget: () => 2, deck: 6 },
  elite: { budget: () => 4, deck: 8 },
  boss: { budget: () => 6, deck: 10 },
};
const ATTRS = ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'];

const words = s => String(s).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
const hasHeal = move => (move.effects || []).some(e => e.op === 'heal' && (e.target === 'self' || e.target == null));

function maneuverOf(move) {
  if (move.counterDamage) return 'counter';
  if (move.delay && move.intent !== 'block') return 'smash';
  if (move.intent === 'attack') return 'attack';
  if (move.intent === 'block') return 'defend';
  return 'casting';
}

function healShape(tags) {
  const shapes = settings.healRules.shapes.filter(s => s.tags.every(t => tags.includes(t)));
  return shapes.sort((a, b) => b.tags.length - a.tags.length)[0];
}

function cardFor(enemy, tier, moveId, move) {
  const maneuver = maneuverOf(move);
  const tags = [`maneuver:${maneuver}`, maneuver === 'casting' ? 'camp:spell' : 'camp:physical', 'owner:enemy'];
  if (['defend', 'counter'].includes(maneuver)) tags.push('trait:reaction');
  const heal = hasHeal(move);
  if (heal) { tags.push('heal'); if (tier === 'minion') tags.push('exhaust'); }
  const effects = [];
  if (Number.isFinite(move.damage)) effects.push({ op: 'damage', target: 'player', amount: move.damage, ...(move.hits > 1 ? { hits: move.hits } : {}) });
  if (Number.isFinite(move.block)) effects.push({ op: 'block', target: 'self', amount: move.block });
  if (Number.isFinite(move.counterDamage)) effects.push({ op: 'counter', target: 'player', amount: move.counterDamage });
  for (const e of move.effects || []) effects.push(e.op === 'heal' && (e.target === 'self' || e.target == null)
    ? { op: 'heal', target: 'self', rule: 'healRules' } : structuredClone(e));
  let cost = settings.stanceCosts[maneuver];
  let costSource = 'stance';
  if (heal) { cost = healShape(tags).cost; costSource = 'healRules'; }
  if (Number.isFinite(move.sp) && !heal) { cost = { sp: move.sp, mp: 0 }; costSource = 'authored'; }
  const text = [];
  if (Number.isFinite(move.damage)) text.push(move.hits > 1 ? `Deal ${move.damage} damage ${move.hits} times.` : `Deal ${move.damage} damage.`);
  if (Number.isFinite(move.block)) text.push(`Gain ${move.block} Block.`);
  if (Number.isFinite(move.counterDamage)) text.push(`Prepare Counter: return ${move.counterDamage} damage.`);
  if (heal) text.push(`Heal ${healShape(tags).amount.percentMaxHp}% max HP.`);
  for (const e of move.effects || []) if (e.op === 'applyStatus') text.push(`Apply ${e.stacks ?? e.value ?? ''} ${words(e.status)} to ${e.target === 'self' ? 'self' : 'the player'}.`);
  for (const e of move.effects || []) if (e.op === 'addCard') text.push(`Shuffle ${words(e.card)} into the player's ${e.pile}.`);
  if (move.delay) text.push(`Charges for ${move.delay.turns} turn${move.delay.turns === 1 ? '' : 's'}.`);
  if (tags.includes('exhaust')) text.push('Exhaust.');
  return {
    id: `${enemy.id}.${moveId}`,
    name: words(moveId),
    owner: 'enemy',
    enemy: enemy.id,
    type: Number.isFinite(move.damage) ? 'attack' : 'skill',
    staminaCost: cost.sp,
    manaCost: cost.mp,
    costSource,
    tags,
    effects,
    ...(move.delay ? { delay: structuredClone(move.delay) } : {}),
    aiWeight: move.weight ?? 1,
    ...(move.maxConsecutive ? { maxConsecutive: move.maxConsecutive } : {}),
    textTemplate: text.join(' '),
    legacyMove: moveId,
  };
}

// Largest-remainder split of `total` over weights.
function split(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map(w => (w / sum) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left-- > 0) out[i]++; });
  return out;
}

// Owner 2026-10-17: all five start at 0 and each enemy assigns its points freely, so each is
// distinct. The legacy stat shape decides the spread; the only floors are what its own cards
// need to be playable (WIS for MP costs, CON for SP costs above the tier base).
function attributesFor(enemy, plan, cards, tier) {
  const needMp = Math.max(0, ...cards.map(c => c.manaCost));
  const needSp = Math.max(0, ...cards.map(c => c.staminaCost));
  const out = Object.fromEntries(ATTRS.map(id => [id, 0]));
  // Sharpen the legacy shape (square it) so a brute leans STR and a wisp leans WIS.
  const weights = ATTRS.map(id => (Number(enemy.attributes?.[id]) || 1) ** 2);
  split(plan.budget(enemy), weights).forEach((n, i) => { out[ATTRS[i]] += n; });
  const rank = ATTRS.filter(id => id !== 'constitution').sort((a, b) => weights[ATTRS.indexOf(b)] - weights[ATTRS.indexOf(a)]);
  const pools = () => enemyPools({ tier, attributes: out, levelProfile: enemy.levelProfile }, settings);
  // Owner: enemies are hard already; CON stays small (at most 1), and never pushes HP >10% over legacy.
  const targetHp = Math.round(((enemy.hp?.[0] ?? 0) + (enemy.hp?.[1] ?? 0)) / 2);
  while (out.constitution > 1 || (out.constitution > 0 && pools().hp > targetHp * 1.1)) { out.constitution--; out[rank[0]]++; }
  // Only floors: enough WIS for the dearest MP card, enough DEX for the dearest SP card.
  const donor = keep => rank.filter(id => id !== keep).find(id => out[id] > 0);
  for (let guard = 0; guard < 20 && pools().mp < needMp; guard++) { const d = donor('wisdom'); if (!d) break; out[d]--; out.wisdom++; }
  for (let guard = 0; guard < 20 && pools().sp < needSp; guard++) { const d = donor('dexterity'); if (!d) break; out[d]--; out.dexterity++; }
  return out;
}

const GEAR = [
  { id: 'enemy.gear.heavyPlate', name: 'Heavy Plate', slot: 'armor', hp: 20 },
  { id: 'enemy.gear.mail', name: 'Rusted Mail', slot: 'armor', hp: 12 },
  { id: 'enemy.gear.plating', name: 'Bone Plating', slot: 'armor', hp: 8 },
  { id: 'enemy.gear.hide', name: 'Thick Hide', slot: 'armor', hp: 4 },
  { id: 'enemy.gear.ironTalisman', name: 'Iron Talisman', slot: 'trinket', hp: 6 },
  { id: 'enemy.gear.luckyTooth', name: 'Lucky Tooth', slot: 'trinket', hp: 2 },
];
const RELICS = [
  { id: 'enemy.relic.abyssalCrown', name: 'Abyssal Crown', hp: 100 },
  { id: 'enemy.relic.ashenCore', name: 'Ashen Core', hp: 60 },
  { id: 'enemy.relic.titanHeart', name: 'Titan Heart', hp: 30 },
  { id: 'enemy.relic.graveSeal', name: 'Grave Seal', hp: 20 },
  { id: 'enemy.relic.emberBand', name: 'Ember Band', hp: 10 },
];
// Relic count per tier: minions rarely carry one; bosses up to three.
const RELIC_SLOTS = { minion: 1, elite: 2, boss: 3 };

// Best fit: one armor (or none), one trinket (or none), up to N relics; minimise the HP miss, then item count.
function hpKit(need, tier) {
  const armor = [null, ...GEAR.filter(g => g.slot === 'armor')];
  const trinket = [null, ...GEAR.filter(g => g.slot === 'trinket')];
  const relicSets = [[]];
  for (let n = 1; n <= RELIC_SLOTS[tier]; n++) for (const set of relicSets.filter(s => s.length === n - 1))
    for (const r of RELICS) if (!set.length || RELICS.indexOf(r) >= RELICS.indexOf(set.at(-1))) relicSets.push([...set, r]);
  let best = null;
  for (const a of armor) for (const t of trinket) for (const rs of relicSets) {
    const hp = (a?.hp || 0) + (t?.hp || 0) + rs.reduce((s, r) => s + r.hp, 0);
    const items = (a ? 1 : 0) + (t ? 1 : 0) + rs.length;
    // Miss, then item count, then fewest relics (gear first; relics fill what gear cannot).
    const score = [Math.abs(need - hp), items, rs.length];
    const diff = best ? score.findIndex((v, i) => v !== best.score[i]) : -1;
    if (!best || (diff >= 0 && score[diff] < best.score[diff]))
      best = { score, gear: [a, t].filter(Boolean).map(g => g.id), relics: rs.map(r => r.id), left: need - hp };
  }
  return best;
}

const enemies = [], cards = [], report = [];
for (const enemy of roster) {
  const tier = tierOf(enemy.id);
  const plan = PLAN[tier];
  const moves = Object.entries(enemy.moves || {});
  const enemyCards = moves.map(([moveId, move]) => cardFor(enemy, tier, moveId, move));
  const active = moves.map(([id, m], i) => ({ id, m, card: enemyCards[i] })).filter(x => !x.m.locked);
  const size = Math.max(active.length, Math.min(settings.tiers[tier].deckSize[1], Math.max(settings.tiers[tier].deckSize[0], plan.deck)));
  const copies = split(size - active.length, active.map(x => x.m.weight ?? 1)).map(n => n + 1);
  const deck = active.flatMap((x, i) => Array(copies[i]).fill(x.card.id));
  const attributes = attributesFor(enemy, plan, enemyCards, tier);
  const derived = enemyPools({ tier, attributes, levelProfile: enemy.levelProfile }, settings);
  const baseHp = derived.hp;
  const targetHp = Math.round(((enemy.hp?.[0] ?? baseHp) + (enemy.hp?.[1] ?? baseHp)) / 2);
  const kit = hpKit(Math.max(0, targetHp - baseHp), tier);
  const hp = baseHp + (targetHp > baseHp ? targetHp - baseHp - kit.left : 0);
  const { sp, mp } = derived;
  const unlockIds = new Map(moves.map(([id], i) => [id, enemyCards[i].id]));
  const phases = enemy.phases ? structuredClone(enemy.phases).map(p => {
    if (p.unlockMoves) { p.unlockCards = p.unlockMoves.map(id => unlockIds.get(id)); delete p.unlockMoves; }
    for (const step of p.do || []) if (step.op === 'heal') { delete step.amount; step.rule = 'healRules'; }
    return p;
  }) : undefined;
  const row = {
    id: enemy.id, name: enemy.name, tier, attributes, deck,
    ...(moves.some(([, m]) => m.locked) ? { unlockCards: moves.filter(([, m]) => m.locked).map(([id]) => unlockIds.get(id)) } : {}),
    ...(enemy.firstMove ? { firstCard: unlockIds.get(enemy.firstMove) } : {}),
    gear: kit.gear, relics: kit.relics,
    poiseMax: enemy.poiseMax, levelProfile: enemy.levelProfile, size: enemy.size, art: enemy.art,
    ...(enemy.artFaces ? { artFaces: enemy.artFaces } : {}),
    ...(enemy.tint ? { tint: enemy.tint } : {}),
    ...(enemy.blighted ? { blighted: true } : {}),
    ...(enemy.arcaneExposure ? { arcaneExposure: structuredClone(enemy.arcaneExposure) } : {}),
    ...(phases ? { phases } : {}),
  };
  enemies.push(row);
  cards.push(...enemyCards);
  const off = Math.abs(hp - targetHp) / targetHp;
  report.push(`${tier.padEnd(6)} ${enemy.id.padEnd(22)} SP ${sp} MP ${mp} HP ${hp} (was ~${targetHp}${off > 0.1 ? ' !>10%' : ''}) deck ${deck.length} gear ${kit.gear.length} relics ${kit.relics.length}`);
}

const gearRows = GEAR.map(g => ({ id: g.id, name: g.name, slot: g.slot, modifiers: [`self.maxHp=+${g.hp}`], text: `+${g.hp} max HP.` }));
const relicRows = RELICS.map(r => ({ id: r.id, name: r.name, modifiers: [`self.maxHp=+${r.hp}`], text: `+${r.hp} max HP.` }));
console.log(report.join('\n'));
console.log(`\n${enemies.length} enemies, ${cards.length} cards, ${gearRows.length} gear, ${relicRows.length} relics`);
if (!DRY) {
  const write = (name, value) => writeFileSync(resolve(ROOT, PACK, name), JSON.stringify(value, null, 2) + '\n');
  write('enemies.json', enemies);
  write('enemyCards.json', cards);
  write('enemyGear.json', gearRows);
  write('enemyRelics.json', relicRows);
  console.log(`wrote ${PACK}/enemies.json, enemyCards.json, enemyGear.json, enemyRelics.json`);
}
