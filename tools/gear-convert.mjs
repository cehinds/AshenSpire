#!/usr/bin/env node
// Re-runnable conversion: content/source/weapons.csv + outfits.csv -> games/ashenspire/packs/core/gear.json
// for the gear module (owner 2026-10-17). Each item gets a gear-type tag, effect tags from its old
// mods, and only the points its old mods implied; the gear module's fill algorithm places the rest.
//   node tools/gear-convert.mjs [--dry]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveGearItem } from '../engine/kernel/gameConfig.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const settings = JSON.parse(readFileSync(resolve(ROOT, 'engine/modules/gear/defaults.json'), 'utf8'));
function csv(path) {
  const lines = readFileSync(resolve(ROOT, path), 'utf8').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
  const parse = l => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') { q = !q; continue; } if (ch === ',' && !q) { o.push(c); c = ''; continue; } c += ch; } o.push(c); return o; };
  const head = parse(lines[0]);
  return lines.slice(1).map(l => { const v = parse(l); return Object.fromEntries(head.map((k, i) => [k, v[i] ?? ''])); });
}
const camel = s => s.replace(/[^A-Za-z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/^./, c => c.toLowerCase());

const WEAPON_TYPE = {
  straightSword: 'sword', greatsword: 'greatsword', dagger: 'dagger', shortbow: 'bow', katana: 'katana', halberd: 'polearm',
  warhammer: 'hammer', twinblade: 'twinblade', battleaxe: 'axe', frostSpear: 'spear', cinderAxe: 'axe',
  buckler: 'buckler', kiteShield: 'kiteShield', towerShield: 'towerShield', roundShield: 'roundShield', spikedShield: 'spikedShield',
  lantern: 'lantern', torch: 'torch', parryDagger: 'parryingDagger',
  ashStaff: 'staff', starstoneStaff: 'staff', wyrmhornStaff: 'staff', goldboughBranch: 'staff',
  boneSceptre: 'sceptre', emberlightSceptre: 'sceptre', gorefireBrand: 'sceptre', blightRod: 'rod', duskChime: 'chime',
};
const ARMOR_TYPE = name => /plate|oathsworn|harness/i.test(name) ? 'plate' : /mail|vigil/i.test(name) ? 'mail'
  : /leather|coat|jerkin|mantle/i.test(name) ? 'leathers' : 'robes';
const SHARED_ARMOR = new Set(['Wayfarer Plate', 'Nightweave', 'Rite Vestments', 'Gutter Leathers']);

// Old mods -> effect tags and the points they imply.
function fromMods(mods) {
  const tags = [], points = {};
  const add = (k, n) => { points[k] = (points[k] || 0) + n; };
  for (const m of (mods || '').split('|').filter(Boolean)) {
    const [k, raw] = m.split('='); const n = Number(raw);
    if (k === 'self.maxHp') add('constitution', Math.max(1, Math.round(n / 10)));
    else if (k === 'self.maxMana') add('wisdom', 1);
    else if (k === 'self.strength' || (k === 'strike.damage' && n > 0)) add('strength', n);
    else if (k === 'self.dexterity') add('dexterity', n);
    else if (k === 'defend.block' && n > 0) add('dr', 1);
    else if (k === 'power.potency') add('intelligence', 1);
    else if (k === 'self.maxStamina') tags.push(n > 0 ? 'light' : 'encumbered');
    else if (k === 'self.regen') tags.push('regen');
    else if (k === 'strike.damage') tags.push('unwieldy');
    else if (k === 'defend.block') tags.push('thin');
    else if (k === 'strike.hits') tags.push('flurry');
    else if (k === 'strike.cost') tags.push('heavy');
    else if (k === 'strike.poise') tags.push('stagger');
    else if (settings.tags[k.split('.')[1]]) tags.push(k.split('.')[1]);
  }
  return { tags: [...new Set(tags)], points };
}
// Keep set points inside the pool: trim the largest first.
function fit(item) {
  const ratings = ['ar', 'dr', 'poise'];
  const r = settings.poolSizes.ratings[item.rarity].max, b = settings.poolSizes.bonus[item.rarity].max;
  const cost = item.tags.reduce((s, t) => s + settings.tags[t].cost, 0);
  const total = keys => keys.reduce((s, k) => s + (item.points[k] || 0), 0);
  const attrs = Object.keys(item.points).filter(k => !ratings.includes(k));
  const trim = keys => { const k = keys.filter(x => item.points[x] > 0).sort((x, y) => item.points[y] - item.points[x])[0]; item.points[k]--; if (!item.points[k]) delete item.points[k]; };
  while (total(ratings) > r) trim(ratings);
  while (total(attrs) + cost > b && total(attrs) > 0) trim(attrs);
  return item;
}

const gear = [];
for (const w of csv('content/source/weapons.csv')) {
  const { tags, points } = fromMods(w.mods);
  gear.push(fit({ id: w.id, name: w.name, slot: w.kind === 'shield' ? 'leftHand' : 'rightHand', kind: w.kind,
    rarity: w.rarity, tags: [WEAPON_TYPE[w.id] || 'sword', ...tags], points, source: { file: 'content/source/weapons.csv', id: w.id } }));
}
const armour = new Map();
for (const o of csv('content/source/outfits.csv')) {
  const prev = armour.get(o.name);
  if (!prev) armour.set(o.name, { row: o, classes: [o.classId] });
  else { prev.classes.push(o.classId); if (!prev.row.mods && o.mods) prev.row = o; }
}
for (const [name, { row, classes }] of armour) {
  const { tags, points } = fromMods(row.mods);
  gear.push(fit({ id: `armor.${camel(name)}`, name, slot: 'armor', kind: 'armor', rarity: SHARED_ARMOR.has(name) ? 'common' : 'uncommon',
    tags: [ARMOR_TYPE(name), ...tags], points, classes: [...new Set(classes)].sort(), source: { file: 'content/source/outfits.csv', id: row.id } }));
}

for (const mode of ['split', 'merged']) {
  console.log(`\n== ${mode} ==`);
  for (const item of gear) {
    const r = resolveGearItem(item, { ...settings, pools: mode });
    const p = r.points;
    console.log(`${item.name.padEnd(20)} ${item.rarity[0]} AR${p.ar} DR${p.dr} P${p.poise} | S${p.strength} D${p.dexterity} C${p.constitution} W${p.wisdom} I${p.intelligence} | ${item.tags.join(',')}`);
  }
}
if (!DRY) {
  writeFileSync(resolve(ROOT, 'games/ashenspire/packs/core/gear.json'), JSON.stringify(gear, null, 2) + '\n');
  console.log(`\nwrote ${gear.length} items to games/ashenspire/packs/core/gear.json`);
}
