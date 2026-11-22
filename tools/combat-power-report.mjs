#!/usr/bin/env node
// Combat-power table (owner, 2026-11-21): scores every Core card and every item with src/model/combatPower.js and writes
// src/content/generated/combatPower.js ({cardCombatPower, itemCombatPower}).
//
//   node tools/combat-power-report.mjs            # rewrite the generated file
//   node tools/combat-power-report.mjs --check    # exit 1 when the generated file is stale (npm run combat-power:check)
//   node tools/combat-power-report.mjs --print    # print the table to stdout, write nothing
//
// Cards: each Core card, and each starting weapon art, is measured in-engine exactly as tools/card-budget-report.mjs does (tools/lib/cardBudgetMeasure.mjs: final
// damage, Block + Ward, Poise, counter/reflect/evade stacks, resolved SP/MP for the reference class), then turned into the scorer's card
// face: statuses, keywords, tags and the other ops come from the card definition. Items: weapons (incl. shields and staves) carry their
// attack/guard profile and weapon-art face, armour and relics their modifiers and property rules; the same extraction the simulator embeds.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contentBundle as b } from '../src/content/index.js';
import { scoring } from '../src/content/generated/scoring.js';
import { baseFace, scoreCard, scoreItem, combatPower, rankOf } from '../src/model/combatPower.js';
import { registries, holdable, measure, CLASSES, tagOf } from './lib/cardBudgetMeasure.mjs';

const OUT = fileURLToPath(new URL('../src/content/generated/combatPower.js', import.meta.url));
const args = process.argv.slice(2);

// ---------------------------------------------------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------------------------------------------------
const statusIds = new Set(Object.keys(scoring.statuses));
const OP_FIELD = { draw: 'draw', heal: 'heal', loseHp: 'loseHp', discard: 'discard', restoreStamina: 'restoreSp', gainEnergy: 'restoreSp', restoreMana: 'restoreMp' };

/** The scorer's card face for a measured Core card. */
export function faceOf(def, row) {
  const f = baseFace();
  Object.assign(f, { name: def.name, cls: def.class, rarity: def.rarity, type: def.type, camp: (def.tags || []).includes('camp:spell') ? 'spell' : 'physical' });
  f.sp = row.costs.sp; f.mp = row.costs.mp;
  f.dmg = row.final.damage || 0; f.hits = Math.max(1, row.final.hits || 1);
  f.blk = (row.final.block || 0) + (row.final.ward || 0); f.poise = row.final.poise || 0;
  f.counter = row.final.counter || 0; f.reflect = row.final.reflect || 0;
  if (row.final.evade) f.statuses.push(['evade', row.final.evade, 'self']);
  f.kw = [...(def.keywords || [])]; f.tags = [...(def.tags || [])];
  for (const e of def.effects || []) {
    const amount = typeof e.amount === 'number' ? e.amount : 1;
    if (e.op === 'applyStatus') {
      if (typeof e.status === 'string' && typeof e.stacks === 'number' && statusIds.has(e.status)) f.statuses.push([e.status, e.stacks, e.target === 'self' ? 'self' : 'enemy']);
    } else if (e.op === 'gainBarrier') f.statuses.push(['barrier', amount, 'self']);
    else if (e.op === 'restorePoise') f.blk += amount;
    else if (OP_FIELD[e.op]) f[OP_FIELD[e.op]] += amount;
    else if (e.op === 'removeStatus') { if (e.target === 'self') f.cleanse += 1; }
    else if (e.op === 'moveEngagement') f.move += 1;
    else if (e.op === 'pullEnemy' || e.op === 'swapRows') f.pull += 1;
  }
  if (def.ramp && !f.tags.includes('ramp.honed')) f.tags.push('ramp.honed');
  return f;
}

function measureCards() {
  const byId = new Map();
  const kitOwner = new Map(); // weapon-art id -> the first class whose starting weapon grants it (the reference class for its score)
  for (const classId of CLASSES) {
    const { ids, kit } = holdable(classId);
    for (const id of kit) if (!kitOwner.has(id)) kitOwner.set(id, classId);
    for (const id of ids) {
      let row; try { row = measure(classId, id); } catch { continue; }
      if (row.error || row.playError) continue;
      if (!byId.has(id)) byId.set(id, {});
      byId.get(id)[classId] = row;
    }
  }
  // Reference class per card, as card-budget-report.mjs: the owning class, else Starseer for spells, else Reaver.
  const faces = {};
  for (const [id, classes] of byId) {
    if (!id.startsWith('core.') && !kitOwner.has(id)) continue;
    const first = Object.values(classes)[0];
    // Owner, 2026-11-21: the weapon art each class starts with (Sundering Hew, Twin Fang, Blight Touch) is in the table, scored as its starting class plays it.
    const refClass = kitOwner.has(id) ? kitOwner.get(id) : first.pool !== 'colorless' ? first.pool : first.camp === 'spell' ? 'starseer' : 'reaver';
    faces[id] = faceOf(registries.cards.get(id), classes[refClass] || first);
  }
  return faces;
}

// ---------------------------------------------------------------------------------------------------------------------
// Items (the simulator's extraction: tools that built items-raw.json)
// ---------------------------------------------------------------------------------------------------------------------
const parseMods = mods => (mods || []).map(m => { const [k, v] = String(m).split('='); return [k, Number.isNaN(+v) ? v : +v]; });

function itemFaces() {
  const rules = Object.fromEntries(b.propertyRules.map(r => [r.tag, r]));
  const ruleOf = r => ({ triggers: (r.triggers || []).map(t => ({ on: t.on, cond: !!t.if, once: !!t.once, perTurn: t.limitPerTurn || 0, do: t.do })), passives: r.passives || null });
  const tagFam = {};
  for (const t of b.tagging) if (['armament', 'armour', 'relic'].includes(t.family)) (tagFam[t.family + ':' + (t.scope ? t.scope + '/' : '') + t.objectId] ??= []).push(t.tagId);
  const items = [];
  const profile = Object.fromEntries(b.equipment.basicCardProfiles.map(p => [p.id, p]));
  const cardsById = Object.fromEntries(b.cards.map(c => [c.id, c]));
  const artFace = (id, item) => {
    const c = cardsById[id] || cardsById['core.' + id]; if (!c) return null;
    const spell = c.damageSchool && c.damageSchool !== 'physical';
    const m = { ...baseFace(), name: c.name, camp: spell ? 'spell' : 'physical', type: c.type === 'attack' ? 'attack' : 'skill', sp: c.staminaCost ?? c.cost ?? 1,
      mp: c.manaCost ?? item.weaponArtManaCost ?? 0, kw: [...(c.keywords || [])], tags: [...(c.tags || [])] };
    let dA = 0, bA = 0, pA = 0, hits = 1;
    for (const e of c.effects || []) {
      const a = typeof e.amount === 'number' ? e.amount : 0;
      if (e.op === 'damage') { const h = e.hits || 1; dA += a * h; hits = Math.max(hits, h); }
      else if (e.op === 'block') bA += a; else if (e.op === 'poiseDamage') pA += a;
      else if (e.op === 'applyStatus' && typeof e.stacks === 'number' && statusIds.has(e.status)) m.statuses.push([e.status, e.stacks, e.target === 'self' ? 'self' : 'enemy']);
      else if (e.op === 'draw') m.draw += a || 1; else if (e.op === 'heal') m.heal += a; else if (e.op === 'loseHp') m.loseHp += a;
      else if (e.op === 'moveEngagement') m.move = 1; else if (e.op === 'applyReflect') m.reflect += a || 1; else if (e.op === 'restoreMana') m.restoreMp += a;
    }
    // authored -> card face: x0.35 (spell x0.5) plus the rating add the survey measures (~3 per hit AR, ~6 per Block DR); the scoring's items.kit.weaponArt says the same
    m.dmg = dA ? Math.round(dA * (spell ? scoring.model.AUTH_SPELL : scoring.model.AUTH_PHYS) + (spell ? 0 : 3 * hits)) : 0; m.hits = hits;
    m.blk = bA ? Math.round(bA * scoring.model.AUTH_BLOCK + 6) : 0; m.poise = Math.round(pA * 0.5);
    if (!m.tags.some(t => t.startsWith('camp:'))) m.tags.push(spell ? 'camp:spell' : 'camp:physical');
    return m;
  };
  for (const a of b.equipment.armaments) {
    const tags = tagFam['armament:' + a.id] || [];
    const it = { kind: 'weapon', id: a.id, name: a.name, rarity: a.rarity, base: a.geom, sub: a.kind, mods: parseMods(a.mods),
      props: tags.filter(t => rules[t]), tags: tags.filter(t => !rules[t]), poise: a.poiseThreshold, weight: a.weight, dmgType: a.physicalDamageType, range: a.range };
    const kit = a.weaponCardPackage?.combatKit || {};
    const ap = profile[kit.attackProfileId || a.attackProfile], gp = profile[kit.guardProfileId || a.guardProfile];
    it.attackBase = ap ? ap.baseValue : 3; it.magicShare = ap?.magicShare ? +ap.magicShare : 0; it.guardBase = gp ? gp.baseValue : 1;
    const art = kit.artCardId ? artFace(kit.artCardId, a) : null;
    if (art) it.art = art;
    items.push(it);
  }
  for (const a of b.equipment.armour) {
    const tags = tagFam['armour:' + a.classId + '/' + a.id] || tagFam['armour:' + a.id] || [];
    items.push({ kind: 'armour', id: a.classId + '.' + a.id, name: a.name, rarity: a.unlock ? 'uncommon' : 'common', base: a.material || 'cloth', sub: a.classId, mods: parseMods(a.mods),
      props: tags.filter(t => rules[t]), tags: tags.filter(t => !rules[t]), poise: a.poiseThreshold });
  }
  for (const r of b.relics) {
    const tags = [...new Set([...(tagFam['relic:' + r.id] || []), ...(r.properties || [])])];
    items.push({ kind: 'relic', id: r.id, name: r.name, rarity: r.rarity, base: r.icon,
      mods: (r.passives?.modifiers || []).map(m => ['passive.' + m.tag + (m.resource ? '.' + m.resource : m.school ? '.' + m.school : ''), m.amount]),
      props: tags.filter(t => rules[t]), tags: tags.filter(t => !rules[t]) });
  }
  return { items, rules: Object.fromEntries(Object.entries(rules).map(([k, r]) => [k, ruleOf(r)])) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------------------------------------------------
export function buildTable() {
  const cardCombatPower = {};
  const faces = measureCards();
  for (const id of Object.keys(faces).sort()) {
    const f = faces[id], raw = scoreCard(f).raw, cp = combatPower(raw, f.rarity);
    cardCombatPower[id] = { raw, cp, rank: rankOf(cp), rarity: f.rarity };
  }
  const itemCombatPower = {};
  const { items, rules } = itemFaces();
  for (const it of items.sort((x, y) => (x.kind + ':' + x.id).localeCompare(y.kind + ':' + y.id))) {
    const s = scoreItem(it, scoring, rules);
    itemCombatPower[it.kind + ':' + it.id] = { raw: s.raw, cp: s.cp, rank: rankOf(s.cp), rarity: it.rarity };
  }
  return { cardCombatPower, itemCombatPower };
}

const oneLine = obj => '{\n' + Object.entries(obj).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n}';
const render = ({ cardCombatPower, itemCombatPower }) => '// GENERATED by tools/combat-power-report.mjs from content/source/scoring.json and the Core cards and items\n'
  + '// Do not edit by hand: run `npm run combat-power` (`npm run combat-power:check` fails when this file is stale).\n'
  + '// raw = effect power over 3 rounds, cp = raw - rarity discount, rank 0 = Unranked, 1..10 (src/model/combatPower.js).\n\n'
  + 'export const cardCombatPower = ' + oneLine(cardCombatPower) + ';\n\n'
  + 'export const itemCombatPower = ' + oneLine(itemCombatPower) + ';\n';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = render(buildTable());
  if (args.includes('--print')) console.log(text);
  else if (args.includes('--check')) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (current !== text) { console.error('src/content/generated/combatPower.js is stale: run `npm run combat-power`'); process.exit(1); }
    console.log('combat-power: generated table is fresh');
  } else {
    writeFileSync(OUT, text);
    console.log(`wrote ${OUT}`);
  }
}
